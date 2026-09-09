import type {
  CareBoard,
  CareTrackingPort,
  HairPlanPort,
  HairEventPort,
  HairProfilePort,
  Celebration,
  HunaAvatar,
  ProductPort,
  ProductCatalogPort,
  JourneyPort,
  JourneyView,
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
  ShareMoment,
} from '@app/core';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  EntitlementService,
  buildNotificationIntents,
  buildCycleView,
  buildProgress,
  buildTodayView,
  detectCelebration,
  careDoneMoment,
  cycleMoments,
  journeyMoment,
  milestoneMoments,
  washDayMoment,
} from '@app/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Loading, Screen, Stack, Text } from '@/design/primitives';
import { NativeStack, type StackLayer } from '@/design/NativeStack';
import { EMPTY_PATH, openFromTab, pop, push, type StackedKey, type StackedPath } from './stacked-path';
import { BottomInsetOwnedByChrome } from '@/design/safe-area';
import { TabBar, type TabKey } from '@/design/TabBar';

import { useAuth } from '@/bootstrap/auth';
import { AccountScreen } from '@/features/account/AccountScreen';
import { DataSourcesScreen } from '@/features/account/DataSourcesScreen';
import { CareTabScreen } from '@/features/care/CareTabScreen';
import { FinishesScreen } from '@/features/care/FinishesScreen';
import { useOilRoutine } from '@/features/care/use-oil-routine';
import { JourneyScreen } from '@/features/journey/JourneyScreen';
import { useJourney } from '@/features/journey/use-journey';
import { SharePreviewScreen } from '@/features/sharing/SharePreviewScreen';
import { InsightsScreen } from '@/features/insights/InsightsScreen';
import { useInsights } from '@/features/insights/use-insights';
import { ShelfUsageScreen } from '@/features/insights/ShelfUsageScreen';
import { useShelfUsage } from '@/features/insights/use-shelf-usage';
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
  productCatalog,
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
  productCatalog: ProductCatalogPort;
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
  const { auth, deletion, entitlements, share, insights } = useAuth();
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
  /**
   * SPEC-061 / ADR-012 — **um caminho, não um destino.**
   *
   * Era um valor só, e a pilha de dois níveis vivia **à mão**: `dataSources` voltava para `you`
   * porque alguém escreveu `setStacked('you')` no `onBack` daquela tela. Com um caminho de verdade,
   * voltar é `pop` — e o gesto de borda do iPhone, que fecha a camada do topo, produz exatamente a
   * mesma coisa que o botão. **Dois caminhos de saída que não podem divergir porque são o mesmo.**
   */
  const [stack, setStack] = useState<StackedPath>(EMPTY_PATH);
  /**
   * SPEC-045 (F46) — **de onde ela veio decide o que o card pode ser**. A tela de compartilhar é uma
   * só (SPEC-044 G5: o F46 acrescenta gatilhos, não outro caminho); o que muda é a lista de momentos
   * que cada lugar entrega.
   */
  const [shareFrom, setShareFrom] = useState<'journey' | 'progress' | { careLabel: string; washDay?: true }>(
    'journey',
  );
  const openShare = (from: 'journey' | 'progress' | { careLabel: string; washDay?: true }) => {
    setShareFrom(from);
    // Empilha sobre o caminho que existir: vindo da Jornada, voltar cai nela; vindo de uma aba, na aba.
    pushStacked('share');
  };
  /** Abre a partir de uma **aba**: começa um caminho novo, porque a aba é a raiz. */
  const openStacked = (screen: StackedKey) => setStack(openFromTab(screen));
  /** Abre a partir de uma tela **já empilhada**: acrescenta um degrau. */
  const pushStacked = (screen: StackedKey) => setStack((s) => push(s, screen));
  /** Volta um degrau. É o que o botão "Voltar" e o gesto de borda fazem — o mesmo `pop`. */
  const closeStacked = () => setStack(pop);
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
          /**
           * ⚠️ **SPEC-040 FR8 nunca funcionou até aqui, e nada acusava.**
           *
           * O `oil_due` existia no domínio, tinha teste no core e estava documentado como entregue —
           * mas o parâmetro era **opcional** e esta chamada simplesmente **não o passava**. A rotina
           * de óleo lembrava a usuária **zero vezes** desde que foi entregue, com tudo verde. É o
           * mesmo defeito que a SPEC-041 mediu na `Section` que declarava `shelf` e não repassava:
           * a peça existe, a ligação não.
           *
           * O parâmetro passou a ser **obrigatório e agrupado** (`OilReminderInput`), então esquecer
           * qualquer uma das três partes deixou de compilar.
           *
           * SPEC-053 — `times` são só os **com lembrete ligado**: um horário desligado continua na
           * rotina e continua registrável, ele só não toca (FR3).
           */
          oil: {
            dueOn: oilRoutine.view.dueOn,
            times: oilRoutine.view.times.filter((t) => t.reminderEnabled).map((t) => t.at),
            everyDays: oilRoutine.view.everyDays,
          },
        })
      : [];
    void notificationScheduler.reconcile(intents).catch(() => {
      // Scheduling is best effort: a failure here must not break the daily screen, and it must not
      // be reported as success either — the preference stays exactly as the server has it.
    });
  }, [board_, prefs, notificationScheduler, today, now, oilRoutine.view]);

  /**
   * SPEC-047 (P2) — `advanced_insights`, decidido pelo SERVIDOR. A tela nunca conclui sozinha que
   * ela é premium: aqui só se lê o que `get_my_entitlements()` concedeu.
   */
  const [granted, setGranted] = useState<readonly string[]>([]);
  useEffect(() => {
    let active = true;
    entitlements
      .get()
      .then((codes: readonly string[]) => active && setGranted(codes))
      // Fail closed: uma leitura que não voltou **não** vira premium.
      .catch(() => active && setGranted([]));
    return () => {
      active = false;
    };
  }, [entitlements]);
  const canSeeInsights = EntitlementService.can('advanced_insights', granted);
  const insightsState = useInsights(insights, canSeeInsights);
  /** SPEC-049 (P6) — a prateleira contada pelo uso, no mesmo gate. */
  const shelfUsage = useShelfUsage(insights, products, canSeeInsights);

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

  /**
   * SPEC-043 OQ1 — a celebração no lugar dela.
   *
   * A `useJourney` recarrega a cada mudança do board (concluir um cuidado muda o board), então uma
   * conquista nova aparece como uma `JourneyView` diferente da anterior. `detectCelebration` compara
   * as duas e **nunca comemora a linha de base** (a primeira leitura da sessão): dar parabéns na
   * abertura por marcos antigos seria o oposto de "na hora". A referência guarda a última vista; o
   * efeito só a atualiza quando há vista (uma releitura que falhou não pode virar celebração falsa).
   */
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const lastJourney = useRef<JourneyView | null>(null);
  useEffect(() => {
    const next = journey.view;
    if (!next) return;
    const found = detectCelebration(lastJourney.current, next);
    lastJourney.current = next;
    if (found) setCelebration(found);
  }, [journey.view]);

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

  /**
   * SPEC-060 FR4/BR2 — dentro da casca, **a `TabBar` é a dona do pé**: ela já soma o inset do
   * indicador de home, então o `Screen` de qualquer tela aqui dentro não soma de novo. Fosse um
   * prop atravessando todas as telas até o `Screen`, alguém esqueceria de repassar — que é
   * exatamente o defeito que a SPEC-041 e a SPEC-053 mediram.
   */
  /**
   * SPEC-061 / ADR-012 — a casca, agora com a **pilha nativa dentro dela**.
   *
   * ⚠️ **A pilha fica ACIMA da `TabBar`, e isso é o desenho inteiro:** a barra **não desliza** com a
   * transição, que é como as pilhas do próprio iOS se comportam sob uma tab bar — e é o que preserva
   * a decisão da SPEC-026/027 de a barra continuar visível sobre a tela empilhada (*"sair de uma
   * tela nunca deve exigir encontrar o botão certo antes"*).
   */
  const shell = (content: React.ReactNode) => {
    const layers: StackLayer[] = [
      { id: 'root', content },
      ...stack.map((key) => ({ id: key, content: stackedContentOf(key) })),
    ];
    return (
      <BottomInsetOwnedByChrome>
        <View style={styles.shell}>
          <View style={styles.shellBody}>
            <NativeStack layers={layers} onDismiss={closeStacked} />
          </View>
          <TabBar
            active={tab}
            onChange={(next) => {
              // Trocar de aba esvazia o caminho: a aba é a raiz, e voltar para ela é sair da pilha.
              setStack(EMPTY_PATH);
              setTab(next);
              // A celebração é da Hoje, na hora: trocar de aba a encerra em vez de a carregar junto.
              setCelebration(null);
            }}
          />
        </View>
      </BottomInsetOwnedByChrome>
    );
  };

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
    /**
     * SPEC-045 (F46) — o card do Wash Day **só para cuidado do plano**. Um registro avulso
     * (SPEC-052) chega a esta tela pela mesma porta, e comemorá-lo premiaria fazer mais (OQ4). A
     * distinção é o `scheduledCareId` da execução: `null` é avulso. Fail-closed — se o board não
     * estiver carregado para confirmar, não se oferece o card.
     */
    const planCare =
      board !== null &&
      board !== 'loading' &&
      board !== 'error' &&
      board.executions.some((e) => e.id === washDay.careExecutionId && e.scheduledCareId !== null);
    return (
      <WashDayScreen
        careExecutionId={washDay.careExecutionId}
        careTitle={washDay.careTitle}
        washDays={washDays}
        products={products}
        {...(planCare
          ? {
              onShare: () => {
                // Sair para o card fecha o registro: recarrega o board (como o "Pronto" faria) para
                // a Hoje dizer "Você registrou o que usou" quando ela voltar.
                setWashDay(null);
                loadBoard();
                openShare({ careLabel: washDay.careTitle, washDay: true });
              },
            }
          : {})}
        // Recarregar ao sair é o que faz a Hoje dizer "Você registrou o que usou" na volta (FR7):
        // o board carrega quais execuções têm registro, e ela acabou de criar um.
        onBack={() => {
          setWashDay(null);
          loadBoard();
        }}
      />
    );
  }

  /**
   * SPEC-061 / ADR-012 — o conteúdo de cada camada empilhada, por chave.
   *
   * Antes eram oito `return shell(...)` antecipados, e por isso **o conteúdo da aba nunca era
   * calculado** enquanto uma tela empilhada estava aberta. Agora a aba é a **raiz da pilha** e
   * continua montada por baixo — que é o que o iOS faz, e o que faz o gesto ter para onde voltar.
   *
   * ⚠️ Efeito colateral bom e deliberado: voltar **não remonta** a aba, então a rolagem e o estado
   * dela sobrevivem à ida e à volta.
   */
  const stackedContentOf = (key: StackedKey): React.ReactNode => {
    if (key === 'hairEvents') {
      return (
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
        />
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
    if (key === 'journey') {
      return (
        <JourneyScreen
          view={journey.view}
          loading={journey.loading}
          failed={journey.failed}
          onRetry={journey.reload}
          {...(journey.view ? { onShare: () => openShare('journey') } : {})}
          onBack={closeStacked}
        />
      );
    }

    /**
     * SPEC-044 (F45) — **o preview é o consentimento** (BR2). Este é o único caminho até o share: não
     * existe outro ramo, e nenhuma ação em outra tela compartilha nada. Ele só existe quando há
     * jornada — um card sem conquista não teria o que dizer.
     *
     * Voltar leva de volta à **Jornada**, de onde ela veio, e não à Hoje.
     */
    if (key === 'share') {
      /**
       * SPEC-045 (F46) — os momentos deste ponto de entrada, **derivados de fato já canônico**
       * (SPEC-044 BR4). Nenhum número é calculado aqui: sequência, marcos e contagens vêm prontos das
       * mesmas views que as telas mostraram, senão o card e a tela poderiam discordar.
       */
      const view = journey.view;
      const moments = [
        ...(typeof shareFrom === 'object'
          ? [
              shareFrom.washDay
                ? washDayMoment({ careLabel: shareFrom.careLabel, journey: view })
                : careDoneMoment({ careLabel: shareFrom.careLabel, journey: view }),
            ]
          : []),
        ...(shareFrom === 'progress' && board && board !== 'loading' && board !== 'error'
          ? cycleMomentsOf(board, today())
          : []),
        ...(view ? [journeyMoment(view), ...milestoneMoments(view)] : []),
      ];
      return (
        <SharePreviewScreen
          moments={moments}
          displayName={displayName}
          avatar={avatar}
          share={share}
          onBack={closeStacked}
        />
      );
    }

    /**
     * SPEC-047 (P2) — **Seus padrões**, superfície própria e Premium.
     *
     * O gate real é do servidor (`advanced_insights`); a tela existe para quem não tem, e explica o
     * que o premium **acrescenta** em vez de bloquear (D-83).
     */
    if (key === 'insights') {
      return (
        <InsightsScreen
          view={insightsState.view}
          loading={insightsState.loading}
          failed={insightsState.failed}
          entitled={canSeeInsights}
          onRetry={insightsState.reload}
          onBack={closeStacked}
        />
      );
    }

    /** SPEC-049 (P6) — **Smart Shelf**: a prateleira dela, contada pelo uso. Mesmo gate premium. */
    if (key === 'shelfUsage') {
      return (
        <ShelfUsageScreen
          view={shelfUsage.view}
          loading={shelfUsage.loading}
          failed={shelfUsage.failed}
          entitled={canSeeInsights}
          onRetry={shelfUsage.reload}
          onBack={closeStacked}
        />
      );
    }

    /** SPEC-056 (F38, shell) — Finalizações: os nomes e o que ela já registrou. Lê `wash_day_finish`. */
    if (key === 'finishes') {
      return <FinishesScreen washDays={washDays} onBack={closeStacked} />;
    }

    /** SPEC-057 (F32) — Fontes de dados: a atribuição da Open Beauty Facts. Volta para a Conta. */
    if (key === 'dataSources') {
      return <DataSourcesScreen onBack={closeStacked} />;
    }

    if (key === 'you') {
      return (
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
          onOpenDataSources={() => pushStacked('dataSources')}
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
        />
      );
    }

    /**
     * ⚠️ **Exaustividade, e ela não é cerimônia.** Aqui havia um `return null`: acrescentar um
     * destino a `StackedKey` sem escrever o ramo produziria uma **camada em branco** — a tela abre,
     * não mostra nada, e nada acusa. É a forma de defeito que esta SPEC existe para não repetir.
     * Agora, faltar um ramo é **erro de compilação**.
     */
    const naoTratado: never = key;
    return naoTratado;
  };

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
  if (tab === 'shelf')
    return shell(
      <ShelfScreen
        products={products}
        catalog={productCatalog}
        profile={profileChip}
        onOpenUsage={() => openStacked('shelfUsage')}
      />,
    );

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
        onOpenFinishes={() => openStacked('finishes')}
        oil={{
          view: oilRoutine.view,
          busy: oilRoutine.busy,
          onChoose: oilRoutine.choose,
          onTurnOff: oilRoutine.turnOff,
          message: oilRoutine.message,
          failure: oilRoutine.failure,
          // SPEC-053 — as quatro ações dos horários, juntas: metade delas deixaria a tela
          // acrescentar e não remover.
          times: {
            onAdd: oilRoutine.addTime,
            onUpdate: oilRoutine.updateTime,
            onToggleReminder: oilRoutine.setTimeReminder,
            onRemove: oilRoutine.removeTime,
          },
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
        onShare={() => openShare('progress')}
        onOpenInsights={() => openStacked('insights')}
      />,
    );

  /**
   * SPEC-018 — a criação do plano é uma **sequência**, não um lugar: sem plano, a barra sai do
   * caminho (FR5). Pôr quatro abas em volta de "vamos montar seu cronograma" convidaria a sair
   * dela antes de terminar.
   */
  if (!board) {
    const plan = (
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
    /**
     * ⚠️ SPEC-061 — **a Conta é alcançável daqui, e continua sendo.** Sem plano a barra sai do
     * caminho (SPEC-018 FR5), mas `onOpenAccount` empilha a Conta — e antes desta SPEC o ramo
     * empilhado vinha **antes** deste `if`, então a Conta aparecia com a casca. Passar a raiz para a
     * casca preserva isso: a barra volta enquanto a Conta está aberta e some ao voltar, que é
     * exatamente o que já acontecia.
     */
    return stack.length > 0 ? shell(plan) : plan;
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
      // Pausar e retomar recarregam o board: o estado pausado muda atraso, lembretes e progresso de
      // uma vez, e reconstruir a partir do servidor é mais barato que reproduzir a mudança aqui. A
      // promessa é **devolvida** (sem `.catch` que engula): o `PauseCard` trava o duplo toque
      // enquanto ela está no ar e mostra a falha — antes o board recarregava calado ainda despausado.
      onPause={() =>
        careTracking.pause(timeZone()).then(() => {
          loadBoard();
        })
      }
      onPreviewResume={() => careTracking.resume({ timeZone: timeZone(), commit: false })}
      onResume={() =>
        careTracking.resume({ timeZone: timeZone(), commit: true }).then(() => {
          loadBoard();
        })
      }
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
      journeyView={journey.view}
      onShare={(careLabel) => openShare({ careLabel })}
      celebration={celebration}
      // Compartilhar a conquista leva à Jornada compartilhável (F45/F46), onde o marco alcançado
      // está entre os momentos; fechar o cartão é só encerrar o momento.
      onCelebrationShare={() => {
        setCelebration(null);
        openShare('journey');
      }}
      onCelebrationDismiss={() => setCelebration(null)}
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
    productCatalog,
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
      productCatalog={productCatalog}
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

/**
 * SPEC-068 (`F46`) — a **fiação** dos momentos do Progresso; a escolha é do core.
 *
 * ⚠️ **Só montagem de view mora aqui.** Qual card sai — em andamento, encerrado, o progresso da vida
 * inteira, nenhum — é `cycleMoments`, função pura e testada: as três invariantes (exatamente um card
 * de ciclo, nunca os dois, nenhum com zero atendido) ficariam sem teste dentro deste arquivo, que
 * tem 900+ linhas e nenhuma cobertura.
 */
const cycleMomentsOf = (
  board: Extract<CareBoard, { cares: unknown }>,
  hoje: LocalDate,
): readonly ShareMoment[] => {
  const view = buildTodayView(board.cares, board.executions, hoje, board.checkIns, board.pausedOn);
  // `startsOn` vem do plano, nunca de hoje: agrupar a partir de hoje renomearia todas as semanas.
  const cycle = buildCycleView(
    board.cares,
    board.executions,
    board.startsOn as LocalDate,
    hoje,
    board.checkIns,
    board.pausedOn,
  );
  return cycleMoments({ progress: buildProgress(view, board.lifetimeDoneCount), cycle, today: hoje });
};
