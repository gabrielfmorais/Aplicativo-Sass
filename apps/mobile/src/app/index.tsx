import type {
  CareBoard,
  CareTrackingPort,
  HairPlanPort,
  HairEventPort,
  HairProfilePort,
  HunaAvatar,
  ProductPort,
  JourneyPort,
  OilRoutinePort,
  WashDayPort,
  HairProfileSnapshot,
  Instant,
  LocalDate,
  NotificationPreferences,
  NotificationPreferencesPort,
  NotificationSchedulerPort,
  PlanPreferencesPort,
  ProfilePort,
} from '@app/core';
import { DEFAULT_NOTIFICATION_PREFERENCES, buildNotificationIntents, buildTodayView } from '@app/core';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Loading, Screen, Stack, Text } from '@/design/primitives';
import { TabBar, type TabKey } from '@/design/TabBar';

import { useAuth } from '@/bootstrap/auth';
import { AccountScreen } from '@/features/account/AccountScreen';
import { CareTabScreen } from '@/features/care/CareTabScreen';
import { useOilRoutine } from '@/features/care/use-oil-routine';
import { JourneyScreen } from '@/features/journey/JourneyScreen';
import { useJourney } from '@/features/journey/use-journey';
import { SharePreviewScreen } from '@/features/sharing/SharePreviewScreen';
import { ProgressTabScreen } from '@/features/care/ProgressTabScreen';
import { HairEventsScreen } from '@/features/hair-events/HairEventsScreen';
import { ShelfScreen } from '@/features/shelf/ShelfScreen';
import { WashDayScreen } from '@/features/care/WashDayScreen';
import { DevSignIn } from '@/features/auth/DevSignIn';
import { SignInScreen } from '@/features/auth/SignInScreen';
import { WelcomeScreen } from '@/features/auth/WelcomeScreen';
import { TodayScreen } from '@/features/care/TodayScreen';
import { NameScreen } from '@/features/onboarding/NameScreen';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { PlanScreen } from '@/features/plan/PlanScreen';
import { reasonOf } from '@/shared/failure-detail';

type Loadable<T> = 'loading' | 'error' | T;

/** The device's wall clock as `HH:MM`, so the pure builder can skip a slot that already passed. */
const localTimeOf = (instant: Instant): string =>
  new Date(instant).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * The shared failure surface. Every load that can fail lands here, so it is worth being a real
 * screen rather than a bare sentence: the message, one action, and — only under `__DEV__` — the
 * reason (D-87/D-90).
 */
function Retry({ text, detail, onRetry }: { text: string; detail?: string; onRetry: () => void }) {
  return (
    <Screen scroll={false} style={styles.center}>
      <Card>
        <Stack gap="lg">
          <Text variant="heading" accessibilityLiveRegion="polite">
            {text}
          </Text>
          <Button label="Tentar novamente" onPress={onRetry} />
          {__DEV__ && detail ? (
            <Text variant="caption" tone="faint">
              {detail}
            </Text>
          ) : null}
        </Stack>
      </Card>
    </Screen>
  );
}

/**
 * Authenticated home. Three gates, each answered by one read:
 * no hair profile → onboarding (SPEC-002); no active plan → preview and confirmation (SPEC-004);
 * active plan → the daily screen (SPEC-005). The account stays reachable from either plan screen.
 */
function AuthenticatedApp({
  hairProfile,
  hairPlan,
  hairEvents,
  products,
  washDays,
  oil,
  journeyPort,
  careTracking,
  notificationPreferences,
  notificationScheduler,
  planPreferences,
  profile: userProfile,
  today,
  now,
  timeZone,
  newRequestId,
}: {
  hairProfile: HairProfilePort;
  hairPlan: HairPlanPort;
  hairEvents: HairEventPort;
  products: ProductPort;
  washDays: WashDayPort;
  oil: OilRoutinePort;
  journeyPort: JourneyPort;
  careTracking: CareTrackingPort;
  notificationPreferences: NotificationPreferencesPort;
  notificationScheduler: NotificationSchedulerPort;
  planPreferences: PlanPreferencesPort;
  profile: ProfilePort;
  today: () => LocalDate;
  now: () => Instant;
  timeZone: () => string;
  newRequestId: () => string;
}) {
  const { auth, deletion, entitlements, share } = useAuth();
  const [profile, setProfile] = useState<Loadable<HairProfileSnapshot | null>>('loading');
  const [board, setBoard] = useState<Loadable<CareBoard | null>>('loading');
  /**
   * SPEC-026 fatia 1 — a aba, e a tela empilhada sobre ela.
   *
   * Antes eram sete booleanos independentes, cada um com um "voltar" para a Hoje, e **duas
   * capabilities de cuidado diário moravam dentro da tela de assinatura** porque não havia outro
   * lugar. Agora há quatro categorias permanentes e uma pilha de um nível: quem abre a prateleira
   * de Cuidados volta para **Cuidados** (FR4), e não para a Hoje.
   */
  const [tab, setTab] = useState<TabKey>('today');
  /**
   * SPEC-026 fatia 3 — quantos produtos ativos ela tem. `null` enquanto não se sabe, e **`null`
   * não é zero**: uma leitura que falhou não pode virar "sua prateleira está vazia".
   *
   * Lido em silêncio e fora do caminho: a Hoje não espera por isto, e um erro aqui apenas faz a
   * sugestão não aparecer — uma oferta ausente não é um erro a mostrar.
   */
  const [productCount, setProductCount] = useState<number | null>(null);
  /**
   * SPEC-040 (F39) — uma fonte, dois consumidores: a Hoje mostra a ocorrência do dia, Cuidados
   * guarda o intervalo. Carregar em cada tela faria as duas discordarem sobre a mesma rotina.
   */
  const oilRoutine = useOilRoutine(oil, today(), timeZone, newRequestId);
  useEffect(() => {
    let active = true;
    products
      .list()
      .then((rows) => active && setProductCount(rows.length))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [products]);
  const [stacked, setStacked] = useState<null | 'hairEvents' | 'you' | 'journey' | 'share'>(null);
  const openStacked = (screen: 'hairEvents' | 'you' | 'journey' | 'share') => setStacked(screen);
  const closeStacked = () => setStacked(null);
  /**
   * SPEC-024 — o registro do que ela usou, aberto a partir de um cuidado concluído. Guarda a
   * execução e o nome do cuidado porque a tela precisa dizer de que dia se trata, e um id sozinho
   * não diz.
   */
  const [washDay, setWashDay] = useState<{ careExecutionId: string; careTitle: string } | null>(null);
  /**
   * SPEC-014 — reassessment reuses the screens that already exist, so it is a mode rather than a
   * route: 'profile' asks the same questions again, 'preview' shows what she would get. Nothing is
   * replaced until she confirms, so leaving at either step leaves the active plan untouched (G3).
   */
  const [reassessing, setReassessing] = useState<null | 'profile' | 'preview'>(null);
  // Why the last load failed. Rendered only under __DEV__ (D-87).
  const [failure, setFailure] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);

  // Read once per session. A failure is treated as "off": not notifying is always safer than
  // notifying from a preference we could not confirm (SPEC-008 §16, fail closed).
  useEffect(() => {
    let active = true;
    notificationPreferences
      .get()
      .then((p) => active && setPrefs(p ?? DEFAULT_NOTIFICATION_PREFERENCES))
      .catch(() => active && setPrefs(DEFAULT_NOTIFICATION_PREFERENCES));
    return () => {
      active = false;
    };
  }, [notificationPreferences]);

  /**
   * SPEC-018 FR5 — a pergunta do nome, feita uma vez e nunca de novo.
   *
   * `null` enquanto lê. `true` **só** quando a linha comprovadamente não existe: uma leitura que
   * falha não vira pergunta. Perguntar o nome outra vez a quem já respondeu é o único erro que esta
   * tela pode cometer, e um campo opcional jamais deve segurar a entrada do app — na dúvida, segue.
   *
   * Lê em paralelo com o perfil capilar de propósito: são duas perguntas independentes, e encadeá-las
   * dobraria a espera antes do primeiro pixel.
   */
  const [askName, setAskName] = useState<boolean | null>(null);
  /** SPEC-026 fatia 7 — o nome no avatar do cabeçalho. `null` quando ela pulou a pergunta. */
  const [displayName, setDisplayName] = useState<string | null>(null);
  /** SPEC-042 (F34) — a marca da Huna que ela escolheu, ou `null` (e vale a inicial do nome). */
  const [avatar, setAvatar] = useState<HunaAvatar | null>(null);
  useEffect(() => {
    let active = true;
    userProfile
      .get()
      .then((p) => {
        if (!active) return;
        setAskName(p === null);
        setDisplayName(p?.displayName ?? null);
        setAvatar(p?.avatar ?? null);
      })
      .catch(() => active && setAskName(false));
    return () => {
      active = false;
    };
  }, [userProfile]);

  const loadProfile = useCallback(() => {
    setProfile('loading');
    let active = true;
    hairProfile
      .getCurrent()
      // A read that fails is NOT the same as a user with no profile: treating it as "no profile"
      // would push her into onboarding and risk a second snapshot. Absence is `null` (SPEC-002).
      .then((p) => active && setProfile(p))
      .catch((error: unknown) => {
        if (!active) return;
        setFailure(reasonOf(error));
        setProfile('error');
      });
    return () => {
      active = false;
    };
  }, [hairProfile]);
  useEffect(() => loadProfile(), [loadProfile]);

  const loadBoard = useCallback(() => {
    setBoard('loading');
    let active = true;
    careTracking
      .getBoard()
      .then((b) => active && setBoard(b))
      .catch((error: unknown) => {
        if (!active) return;
        setFailure(reasonOf(error));
        setBoard('error');
      });
    return () => {
      active = false;
    };
  }, [careTracking]);
  // Only worth reading once there is a profile: without one there cannot be a plan.
  useEffect(() => {
    if (profile && profile !== 'loading' && profile !== 'error') return loadBoard();
  }, [profile, loadBoard]);

  // FR8 — reconcile whenever the board or the preference changes, which is exactly when the right
  // set of reminders can differ: a care completed, a plan regenerated, reminders turned off.
  const board_ = board;
  useEffect(() => {
    if (board_ === 'loading' || board_ === 'error') return;
    const intents = board_
      ? buildNotificationIntents({
          // SPEC-022 FR2 — pausada, nada toca. A mesma pausa que a Hoje e o ciclo enxergam (BR2).
          paused: board_.pausedOn !== null,
          view: buildTodayView(board_.cares, board_.executions, today(), board_.checkIns, board_.pausedOn),
          preferences: prefs,
          today: today(),
          nowLocalTime: localTimeOf(now()),
        })
      : [];
    void notificationScheduler.reconcile(intents).catch(() => {
      // Scheduling is best effort: a failure here must not break the daily screen, and it must not
      // be reported as success either — the preference stays exactly as the server has it.
    });
  }, [board_, prefs, notificationScheduler, today, now]);

  /**
   * SPEC-043 — a Jornada, carregada uma vez: a Hoje mostra a entrada, a tela mostra o resto.
   *
   * ⚠️ **Fica aqui, acima de todo `return`, e isso é obrigatório, não arrumação.** Chamado depois
   * do primeiro return antecipado, o hook só existe em alguns renders — e a ordem muda no instante
   * em que a leitura do perfil resolve, o que derruba a tela inteira com *"change in the order of
   * Hooks"*. É a mesma lição que o `IndexRoute` carrega logo abaixo: um hook não pode ficar atrás
   * de um return.
   */
  const journey = useJourney(journeyPort, board !== 'loading' && board !== 'error' ? board : null, today());

  if (askName === null || profile === 'loading') return <Loading label="Carregando seu perfil…" />;
  // Antes do cabelo, ela. A pergunta abre a primeira experiência e sai do caminho para sempre.
  if (askName) return <NameScreen profile={userProfile} onDone={() => setAskName(false)} />;
  if (profile === 'error') {
    return (
      <Retry
        text="Não foi possível carregar seu perfil."
        {...(failure ? { detail: failure } : {})}
        onRetry={loadProfile}
      />
    );
  }
  if (!profile) return <OnboardingScreen hairProfile={hairProfile} onSaved={setProfile} />;

  /**
   * A casca. A barra é permanente e **não** depende do que a aba conseguiu carregar: uma leitura
   * que falha derruba o conteúdo daquela aba, nunca a navegação (§16).
   */
  /**
   * O avatar do cabeçalho é a **única** porta para Você (SPEC-027, decisão do dono): a quarta vaga
   * da barra é da Prateleira, e duas entradas para o mesmo perfil seriam duas versões da mesma tela.
   */
  const profileChip = { name: displayName, avatar, onPress: () => openStacked('you') };

  const shell = (content: React.ReactNode) => (
    <View style={styles.shell}>
      <View style={styles.shellBody}>{content}</View>
      <TabBar
        active={tab}
        onChange={(next) => {
          setStacked(null);
          setTab(next);
        }}
      />
    </View>
  );

  if (reassessing === 'profile') {
    return (
      <OnboardingScreen
        hairProfile={hairProfile}
        onSaved={(snapshot) => {
          setProfile(snapshot);
          setReassessing('preview');
        }}
        onCancel={() => setReassessing(null)}
      />
    );
  }
  if (reassessing === 'preview') {
    return (
      <PlanScreen
        profile={profile}
        plans={hairPlan}
        today={today()}
        newRequestId={newRequestId}
        entitlements={entitlements}
        planPreferences={planPreferences}
        onCreated={() => {
          setReassessing(null);
          loadBoard();
        }}
        onCancel={() => setReassessing(null)}
      />
    );
  }

  // Empilhadas: abrem sobre a aba de origem e voltam para ela (FR4). A barra continua visível —
  // sair de uma tela nunca deve exigir encontrar o botão certo antes.
  if (washDay) {
    return (
      <WashDayScreen
        careExecutionId={washDay.careExecutionId}
        careTitle={washDay.careTitle}
        washDays={washDays}
        products={products}
        // Recarregar ao sair é o que faz a Hoje dizer "Você registrou o que usou" na volta (FR7):
        // o board carrega quais execuções têm registro, e ela acabou de criar um.
        onBack={() => {
          setWashDay(null);
          loadBoard();
        }}
      />
    );
  }

  if (stacked === 'hairEvents') {
    return shell(
      <HairEventsScreen
        events={hairEvents}
        today={today()}
        timeZone={timeZone}
        newEventId={newRequestId}
        onBack={closeStacked}
        {...(board && board !== 'loading' && board !== 'error'
          ? {
              onReassess: () => {
                closeStacked();
                setReassessing('profile');
              },
            }
          : {})}
      />,
    );
  }

  /**
   * SPEC-043 (F40/F41/F42) — **superfície própria** (D-103). A Jornada é uma tela empilhada, e não
   * um bloco dentro de Progresso: aquela aba responde *"o que aconteceu"* e continua **sem nota**,
   * com as barreiras da SPEC-009/019/021 intactas.
   *
   * A entrada fica na **Hoje**, que é onde o fato acontece — a consistência dela é feita de cuidados
   * concluídos, e é ali que ela acabou de concluir um.
   */
  if (stacked === 'journey') {
    return shell(
      <JourneyScreen
        view={journey.view}
        loading={journey.loading}
        failed={journey.failed}
        onRetry={journey.reload}
        {...(journey.view ? { onShare: () => setStacked('share') } : {})}
        onBack={() => setStacked(null)}
      />,
    );
  }

  /**
   * SPEC-044 (F45) — **o preview é o consentimento** (BR2). Este é o único caminho até o share: não
   * existe outro ramo, e nenhuma ação em outra tela compartilha nada. Ele só existe quando há
   * jornada — um card sem conquista não teria o que dizer.
   *
   * Voltar leva de volta à **Jornada**, de onde ela veio, e não à Hoje.
   */
  if (stacked === 'share' && journey.view) {
    return shell(
      <SharePreviewScreen
        journey={journey.view}
        displayName={displayName}
        avatar={avatar}
        share={share}
        onBack={() => setStacked('journey')}
      />,
    );
  }

  if (stacked === 'you') {
    return shell(
      <AccountScreen
        auth={auth}
        deletion={deletion}
        entitlements={entitlements}
        profile={userProfile}
        displayName={displayName}
        avatar={avatar}
        onAvatarChanged={setAvatar}
        onNameChanged={setDisplayName}
        planPreferences={planPreferences}
        notificationPreferences={notificationPreferences}
        notificationScheduler={notificationScheduler}
        onNotificationPreferencesChanged={setPrefs}
        // SPEC-027: "Meu cabelo mudou" saiu daqui e foi para **Cuidados** — contar que fez química
        // é rotina de cabelo, não configuração de conta. Aqui ficou o que é mesmo conta.
        // Empilhada sobre a aba de origem, então a saída é explícita: tocar numa aba também sai, mas
        // obrigaria a **escolher um destino** para deixar uma tela que não é aba.
        onBack={closeStacked}
        {...(board && board !== 'loading' && board !== 'error'
          ? {
              onReassess: () => setReassessing('profile'),
              onCustomize: () => setReassessing('preview'),
            }
          : {})}
      />,
    );
  }

  /**
   * SPEC-027 — a prateleira virou **aba**: o `ShelfScreen` deixa de ser empilhado e deixa de ter
   * "voltar", porque uma aba não volta para lugar nenhum — sai-se dela tocando outra.
   *
   * ⚠️ **A ordem deste `if` é comportamento, não arrumação.** Ele tem de vir **depois** das telas
   * empilhadas: colocado antes delas, tocar o avatar na Prateleira gravava `stacked = 'you'` e o
   * ramo da aba vencia mesmo assim — o avatar virava um botão que não fazia nada, na única aba em
   * que ele é a porta de Você. E tem de vir **antes** da leitura do board: a prateleira não depende
   * de cronograma nenhum, e esperar por um seria fazê-la carregar por um dado que ela não usa.
   */
  if (tab === 'shelf') return shell(<ShelfScreen products={products} profile={profileChip} />);

  if (board === 'loading') return shell(<Loading label="Carregando seus cuidados…" />);
  if (board === 'error') {
    return shell(
      <Retry
        text="Não foi possível carregar seus cuidados."
        {...(failure ? { detail: failure } : {})}
        onRetry={loadBoard}
      />,
    );
  }

  // Cuidados e Progresso funcionam **sem** plano ativo: dizem o que falta em vez de sumirem (EC1).
  if (tab === 'care') {
    return shell(
      <CareTabScreen
        profile={profileChip}
        onOpenHairEvents={() => openStacked('hairEvents')}
        oil={{
          view: oilRoutine.view,
          busy: oilRoutine.busy,
          onChoose: oilRoutine.choose,
          onTurnOff: oilRoutine.turnOff,
        }}
      />,
    );
  }
  /**
   * SPEC-034 — **o ciclo é a aba Progresso**, e não uma tela empilhada sob Cuidados.
   *
   * ⚠️ A versão anterior fazia `setTab('care')` antes de empilhar o ciclo, porque o ramo de
   * `tab === 'progress'` vinha **antes** do ramo empilhado e o ciclo nunca renderizaria de outro
   * jeito. O efeito visível: abrir o ciclo daqui (ou da Hoje) acendia *Cuidados* na barra e o
   * rodapé dizia *"Voltar aos cuidados"* — uma aba de onde ela nunca veio. Sem tela empilhada, não
   * há ordem de ramos para acertar nem `setTab` para esconder.
   */
  if (tab === 'progress')
    return shell(
      <ProgressTabScreen
        board={board}
        today={today()}
        profile={profileChip}
        onStartNext={() => setReassessing('profile')}
      />,
    );

  /**
   * SPEC-018 — a criação do plano é uma **sequência**, não um lugar: sem plano, a barra sai do
   * caminho (FR5). Pôr quatro abas em volta de "vamos montar seu cronograma" convidaria a sair
   * dela antes de terminar.
   */
  if (!board) {
    return (
      <PlanScreen
        profile={profile}
        plans={hairPlan}
        today={today()}
        newRequestId={newRequestId}
        entitlements={entitlements}
        planPreferences={planPreferences}
        onCreated={loadBoard}
        onOpenAccount={() => openStacked('you')}
      />
    );
  }
  return shell(
    <TodayScreen
      board={board}
      care={careTracking}
      hairProfile={hairProfile}
      today={today()}
      now={now}
      timeZone={timeZone()}
      newExecutionId={newRequestId}
      onChanged={loadBoard}
      onPause={() => {
        // Pausar e retomar recarregam o board: o estado pausado muda atraso, lembretes e progresso
        // de uma vez, e reconstruir a partir do servidor é mais barato que reproduzir a mudança aqui.
        void careTracking.pause(timeZone()).then(loadBoard).catch(loadBoard);
      }}
      onPreviewResume={() => careTracking.resume({ timeZone: timeZone(), commit: false })}
      onResume={() => {
        void careTracking.resume({ timeZone: timeZone(), commit: true }).then(loadBoard).catch(loadBoard);
      }}
      // SPEC-034 — o ciclo é uma **aba**, então "ver meu mês" troca de aba, como a sugestão da
      // prateleira já fazia. Não há mais cópia empilhada dele para abrir por cima da Hoje.
      onOpenCycle={() => setTab('progress')}
      onOpenWashDay={setWashDay}
      washDays={washDays}
      products={products}
      oil={{
        view: oilRoutine.view,
        busy: oilRoutine.busy,
        onDone: oilRoutine.markDone,
        onPostpone: oilRoutine.postpone,
      }}
      profile={profileChip}
      productCount={productCount}
      // A prateleira é aba: a sugestão leva **para a aba**, e não para uma cópia empilhada dela.
      onOpenShelf={() => setTab('shelf')}
      onReassess={() => setReassessing('profile')}
      onOpenJourney={() => openStacked('journey')}
    />,
  );
}

/** Single route: authentication, then hair profile, then plan, then the daily loop. */
export default function IndexRoute() {
  const {
    state,
    auth,
    hairProfile,
    hairPlan,
    hairEvents,
    products,
    washDays,
    oil,
    journey,
    careTracking,
    notificationPreferences,
    notificationScheduler,
    planPreferences,
    profile,
    today,
    now,
    timeZone,
    newRequestId,
    devSignIn,
  } = useAuth();
  // A abertura já foi vista nesta sessão. Ver `state` primeiro: um hook não pode ficar atrás de um return.
  const [started, setStarted] = useState(false);
  if (state === 'loading') return <Loading />;
  if (state.status !== 'authenticated') {
    /**
     * SPEC-018 FR1 — a marca vem antes do formulário. Alguém que nunca ouviu falar da Huna
     * encontrava a palavra "Entrar" como primeira coisa do produto; agora encontra o produto.
     *
     * O estado é local e de sessão de propósito: se ela voltar à entrada, ver a abertura de novo é
     * o comportamento certo — e não há nada a persistir sobre uma tela que não coleta nada.
     */
    if (!started) return <WelcomeScreen onStart={() => setStarted(true)} />;
    // The dev entry sits *beside* the real screen, never inside it: the official Apple / Google /
    // email flows are untouched, and in any build a user could hold `devSignIn` is null (D-85).
    return (
      <>
        <SignInScreen auth={auth} />
        {devSignIn ? <DevSignIn onPress={devSignIn} /> : null}
      </>
    );
  }
  return (
    <AuthenticatedApp
      hairProfile={hairProfile}
      hairPlan={hairPlan}
      hairEvents={hairEvents}
      products={products}
      washDays={washDays}
      oil={oil}
      journeyPort={journey}
      careTracking={careTracking}
      notificationPreferences={notificationPreferences}
      notificationScheduler={notificationScheduler}
      planPreferences={planPreferences}
      profile={profile}
      today={today}
      now={now}
      timeZone={timeZone}
      newRequestId={newRequestId}
    />
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center' },
  /** A casca: conteúdo que estica e a barra fixa embaixo dele. */
  shell: { flex: 1 },
  shellBody: { flex: 1 },
});
