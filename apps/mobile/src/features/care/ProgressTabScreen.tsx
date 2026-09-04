import type { CareBoard, CareItem, CycleWeek, LocalDate } from '@app/core';
import { buildCycleView, buildProgress, buildTodayView } from '@app/core';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, Row, Screen, ScreenHeader, Stack, Text } from '@/design/primitives';
import { space } from '@/design/tokens';
import { CareTypeMark } from '@/features/care/CareTypeMark';
import { CycleSummary } from '@/features/care/CycleSummary';
import { HomeSection } from '@/features/care/HomeSection';
import { OUTCOME_LABEL } from '@/features/care/copy';
import { ProgressSummary } from '@/features/care/ProgressSummary';
import { formatPlannedDate } from '@/features/plan/copy';

/**
 * SPEC-034 — **Progresso é o ciclo.** A aba deixa de ser um saguão.
 *
 * O que havia aqui: o resumo acumulado, um cartão que **descrevia** as quatro semanas, um botão para
 * outra tela, e ~450px de vazio a 390px. Metade da aba era corredor. Descrever as semanas num
 * parágrafo e oferecer um botão é estritamente pior do que mostrá-las.
 *
 * ⚠️ **E o corredor mentia.** A `CycleScreen` era empilhada **sob o ramo de Cuidados**, então abrir
 * o ciclo daqui executava `setTab('care')`: a barra passava a destacar *Cuidados*, e o rodapé dizia
 * *"Voltar aos cuidados"* — para uma aba de onde ela nunca veio. É a mesma classe de defeito que a
 * SPEC-027 já registrou uma vez (o avatar morto no ramo da Prateleira): uma tela empilhada colocada
 * **depois** dos ramos de aba. A fusão não remenda a mentira, ela a apaga: não há mais tela
 * empilhada, não há mais botão de voltar (aba não volta — SPEC-027), não há mais `setTab`.
 *
 * ⚠️ **E o corredor divergia.** A `CycleScreen` calculava o `Progress` com
 * `buildTodayView(cares, executions, today, checkIns)` — **sem `pausedOn`** —, enquanto esta tela
 * passava a pausa. Com o plano pausado, as duas telas podiam discordar sobre *"o ciclo encerrou?"*,
 * que é exatamente o que o comentário de `buildTodayView` avisa que não pode acontecer (SPEC-022
 * BR2). Uma leitura só, uma verdade só.
 *
 * **Continua sem pontuar.** Nenhum percentual, nota, gráfico, tendência ou comparação: as barreiras
 * das SPECs 009, 019 e 021 valem aqui inteiras, e mudar de lugar não é licença para mudar de tom.
 *
 * ⚠️ **A tela é uma pilha de seções tituladas, e isso é a costura** (a mesma de `HomeSection` na
 * Hoje). *Suas fotos* (`F28`/`P10`/`P11`, Antes × Depois) e o cruzamento *tratamento + produto +
 * finalização + resultado* (`P8`, D-102) entram como mais uma seção, sem redesenhar nada. Não há
 * seção vazia esperando por elas: seção sem conteúdo é código morto, e a regra de necessidade a
 * proíbe (D-47/D-48).
 *
 * ⚠️ **Nada aqui está preso a três tipos de cuidado.** As semanas iteram o que o plano contém e a
 * cor vem de `careColor[code]`, um `Record` tipado — a Restauração do `F36` (D-102) entra sem tocar
 * nesta tela, e se alguém esquecer a cor dela o typecheck reclama em vez de renderizar cinza.
 */
export function ProgressTabScreen({
  board,
  today,
  profile,
  onStartNext,
  onShare,
}: {
  board: CareBoard | null;
  today: LocalDate;
  /** SPEC-021 — presente quando há um próximo ciclo a oferecer (D-82). */
  onStartNext?: () => void;
  /** SPEC-045 (F46) — o ciclo dela vira card, do lugar em que ela olha o ciclo. */
  onShare?: () => void;
  /** SPEC-026 fatia 7 — o acesso a **Você**, no cabeçalho. A tela só repassa. */
  profile: { readonly name: string | null; readonly onPress: () => void };
}) {
  const view = useMemo(() => {
    if (!board) return null;
    const todayView = buildTodayView(board.cares, board.executions, today, board.checkIns, board.pausedOn);
    const progress = buildProgress(todayView, board.lifetimeDoneCount);
    const cycle = buildCycleView(
      board.cares,
      board.executions,
      board.startsOn as LocalDate,
      today,
      board.checkIns,
      board.pausedOn,
    );
    /**
     * "Encerrado" é derivado, nunca armazenado (BR4/D-69) — e tem **duas** entradas, não uma. A data
     * de fim é a óbvia; a outra é ela ter resolvido tudo antes. A Hoje já trata esse caso e oferece
     * o próximo ciclo (D-82), então derivar só pela data faria as duas telas discordarem sobre o
     * mesmo fato.
     */
    const nothingLeft = progress.planned === 0 && progress.overdue === 0;
    return { progress, cycle, ended: today > cycle.endsOn || nothingLeft };
  }, [board, today]);

  return (
    <Screen>
      <ScreenHeader title="O que você já fez" profile={profile} />

      {view ? (
        <>
          <ProgressSummary progress={view.progress} />

          {/*
            SPEC-045 (F46) — **uma oferta, e só depois do fato.** Aparece quando já há cuidado
            atendido: um card de ciclo com zero não é conquista, é cobrança de véspera.
          */}
          {onShare && view.progress.done > 0 ? (
            <Button label="Compartilhar meu ciclo" variant="secondary" onPress={onShare} />
          ) : null}

          {/*
            ⚠️ **Só no fim do ciclo.** Em andamento, o `CycleSummary` e o `ProgressSummary` diziam
            quase a mesma coisa — "concluiu 1 de 2" nos dois cartões —, e dois cartões repetindo o
            mesmo fato é ruído, não reforço. Encerrado, ele diz o que o outro não diz: que acabou, e
            o que vem depois.
          */}
          {view.ended ? (
            <CycleSummary progress={view.progress} ended {...(onStartNext ? { onStartNext } : {})} />
          ) : null}

          <HomeSection title="O mês inteiro">
            {/*
             * FR4 — hoje pode cair fora das quatro semanas (plano ainda por começar, ou vencido e
             * ainda ativo). Dizer isso é melhor do que marcar uma semana ao acaso: a tela prefere
             * admitir que ela não está em nenhuma a inventar onde ela está.
             */}
            <Text tone="muted">
              {!view.cycle.outsideWindow
                ? 'As quatro semanas do seu cronograma, e o que aconteceu em cada uma.'
                : today < view.cycle.startsOn
                  ? // Duas maneiras de estar fora, e uma frase só para as duas diria uma falsidade
                    // metade das vezes (BR6): "já está fora" é o oposto de "ainda não começou".
                    `Estas são as quatro semanas do seu cronograma. Ele começa em ${formatPlannedDate(view.cycle.startsOn)}.`
                  : 'Estas são as quatro semanas do seu cronograma. Hoje já está fora delas.'}
            </Text>
            {view.cycle.weeks.map((week) => (
              <Week key={week.number} week={week} />
            ))}
          </HomeSection>

          {/*
           * EC4 — reagendar tem janela de 28 dias a partir de hoje, que pode passar do fim do plano.
           * Estes cuidados existem e são dela; some-los seria mentir, e desenhar uma quinta semana
           * seria inventar um ciclo que não existe.
           */}
          {view.cycle.beyond.length > 0 ? (
            <HomeSection title="Depois deste ciclo">
              <Card>
                <Stack gap="sm">
                  {view.cycle.beyond.map((item) => (
                    <CareLine key={item.id} item={item} />
                  ))}
                </Stack>
              </Card>
            </HomeSection>
          ) : null}
        </>
      ) : (
        // EC1 — sem plano não há o que somar, e um resumo zerado pareceria um resultado ruim em
        // vez de uma ausência.
        <Card tone="muted">
          <Text tone="muted">
            Seu progresso aparece assim que você tiver um cronograma e começar a registrar.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

/**
 * Uma semana. A corrente é a única acentuada — é a âncora da tela, e mais de um destaque numa
 * página de quatro cartões iguais não destaca nada.
 */
function Week({ week }: { week: CycleWeek }) {
  return (
    <Card tone={week.isCurrent ? 'accent' : 'surface'}>
      <Row gap="sm" style={styles.head}>
        <Text variant="overline" tone={week.isCurrent ? 'accent' : 'muted'} accessibilityRole="header">
          {`Semana ${week.number}`}
        </Text>
        {/* Em palavra, não só em cor: quem não distingue a tinta precisa ler onde está. */}
        {week.isCurrent ? (
          <Text variant="caption" tone="accent">
            você está aqui
          </Text>
        ) : (
          <Text variant="caption" tone="faint">
            {`${formatPlannedDate(week.startsOn)} — ${formatPlannedDate(week.endsOn)}`}
          </Text>
        )}
      </Row>
      {week.items.length === 0 ? (
        // Uma semana vazia é informação, não um vazio culpado: o plano não colocou nada ali.
        <Text tone="muted">Nenhum cuidado planejado nesta semana.</Text>
      ) : (
        <Stack gap="sm">
          {week.items.map((item) => (
            <CareLine key={item.id} item={item} />
          ))}
        </Stack>
      )}
    </Card>
  );
}

/** Tipo, data e estado — os três fatos, nenhum julgamento (FR3). */
function CareLine({ item }: { item: CareItem }) {
  return (
    <Stack gap="xs">
      <Row gap="sm" style={styles.line}>
        <CareTypeMark careTypeCode={item.careTypeCode} />
        <Text variant="caption" tone="muted">
          {`${formatPlannedDate(item.plannedDate)} · ${OUTCOME_LABEL[item.outcome]}`}
        </Text>
      </Row>
      {/*
        ⚠️ **O check-in dela estava sendo jogado fora.** `buildCycleView` já carrega o check-in de
        cada cuidado, e o ciclo mostrava só data e estado — a única coisa que o app sabe sobre
        **como foi** ficava invisível fora do dia em que ela respondeu.
        Fica numa linha própria, e só quando existe: em `nowrap`, a 390px, ela espremeria a data.
        **É a resposta dela, e o texto diz isso** — não é nota do app, não é média, não é tendência
        (SPEC-009 §2). Uma resposta por cuidado é fato; a linha que as ligasse seria um gráfico.
      */}
      {item.checkIn ? (
        <Text variant="caption" tone="faint">
          {`Você avaliou: ${item.checkIn.overallFeel} de 5`}
        </Text>
      ) : null}
    </Stack>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', justifyContent: 'space-between' },
  /** `nowrap` porque tipo e data numa linha só é o que faz quatro semanas caberem numa tela. */
  line: { alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap', gap: space.sm },
});
