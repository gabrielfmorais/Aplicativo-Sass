import type { CareBoard, CareItem, CycleWeek, LocalDate } from '@app/core';
import { buildCycleView, buildProgress, buildTodayView } from '@app/core';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, Row, Screen, Stack, Text } from '@/design/primitives';
import { space } from '@/design/tokens';
import { OUTCOME_LABEL } from '@/features/care/copy';
import { CycleSummary } from '@/features/care/CycleSummary';
import { CareTypeMark } from '@/features/care/CareTypeMark';
import { formatPlannedDate } from '@/features/plan/copy';

/**
 * SPEC-019 — a forma do mês.
 *
 * Ela via o **dia** e via as quatro semanas exatamente uma vez, no preview, antes de confirmar.
 * Depois disso o ciclo sumia: "em que semana eu estou?" não tinha resposta em tela nenhuma, e a
 * oferta de novo ciclo (D-82) chegava sem que ela tivesse visto o ciclo que estava terminando.
 *
 * **Só leitura.** Concluir, pular e reagendar continuam na Hoje (NG5). Um segundo caminho de escrita
 * para as mesmas transições duplicaria os estados em voo, os guardas de duplo toque e a reconciliação
 * de conflito — caro demais para pagar antes de observar o atrito de verdade (OQ2).
 *
 * **Não pontua nada** (NG2). Sem nota, sem score, sem percentual, sem barra de aderência. Pular é
 * desfecho válido e reagendar não é falha (BR4): a tela conta o que aconteceu e cala a boca.
 */
export function CycleScreen({
  board,
  today,
  onBack,
  onStartNext,
}: {
  board: CareBoard;
  today: LocalDate;
  onBack: () => void;
  /** SPEC-021 — presente quando há um próximo ciclo a oferecer (D-82). */
  onStartNext?: () => void;
}) {
  const cycle = useMemo(
    () =>
      buildCycleView(
        board.cares,
        board.executions,
        board.startsOn as LocalDate,
        today,
        board.checkIns,
        board.pausedOn,
      ),
    [board, today],
  );
  /**
   * SPEC-021 — os **mesmos** números que a Hoje mostra, não uma segunda contagem: duas verdades
   * sobre o mesmo mês divergiriam na primeira vez que qualquer regra de desfecho mudasse (BR1).
   */
  const progress = useMemo(
    () =>
      buildProgress(
        buildTodayView(board.cares, board.executions, today, board.checkIns),
        board.lifetimeDoneCount,
      ),
    [board, today],
  );
  /**
   * "Encerrado" é derivado, nunca armazenado (BR4/D-69) — e tem **duas** entradas, não uma.
   *
   * A data de fim é a óbvia. A outra é ela ter resolvido tudo antes: a Hoje já trata esse caso e
   * oferece o próximo ciclo (D-82), então marcar aqui só pela data faria as duas telas discordarem
   * sobre o mesmo fato — a Hoje dizendo "chegou ao fim" enquanto o ciclo diz "como está indo" e não
   * oferece nada.
   */
  const nothingLeft = progress.planned === 0 && progress.overdue === 0;
  const ended = today > cycle.endsOn || nothingLeft;

  return (
    <Screen footer={<Button label="Voltar aos cuidados" variant="ghost" onPress={onBack} />}>
      <Stack gap="sm">
        <Text variant="overline" tone="faint">
          {`${formatPlannedDate(cycle.startsOn)} — ${formatPlannedDate(cycle.endsOn)}`}
        </Text>
        <Text variant="display" accessibilityRole="header">
          Seu ciclo
        </Text>
        {/*
         * FR4 — hoje pode cair fora das quatro semanas (plano ainda por começar, ou vencido e ainda
         * ativo). Dizer isso é melhor do que marcar uma semana ao acaso: a tela prefere admitir que
         * ela não está em nenhuma a inventar onde ela está.
         */}
        <Text tone="muted">
          {!cycle.outsideWindow
            ? 'As quatro semanas do seu cronograma, e o que aconteceu em cada uma.'
            : today < cycle.startsOn
              ? // Duas maneiras de estar fora, e uma frase só para as duas diria uma falsidade
                // metade das vezes (BR6): "já está fora" é o oposto de "ainda não começou".
                `Estas são as quatro semanas do seu cronograma. Ele começa em ${formatPlannedDate(cycle.startsOn)}.`
              : 'Estas são as quatro semanas do seu cronograma. Hoje já está fora delas.'}
        </Text>
      </Stack>

      {/* No fim, o resumo **abre** a tela: ela veio fechar o mês, não conferir a semana 2. Em
          andamento, ele fecha — porque aí o que importa é o desenho, e o número é contexto. */}
      {ended ? <CycleSummary progress={progress} ended {...(onStartNext ? { onStartNext } : {})} /> : null}

      {cycle.weeks.map((week) => (
        <Week key={week.number} week={week} />
      ))}

      {ended ? null : <CycleSummary progress={progress} ended={false} />}

      {/*
       * EC4 — reagendar tem janela de 28 dias a partir de hoje, que pode passar do fim do plano.
       * Estes cuidados existem e são dela; some-los seria mentir, e desenhar uma quinta semana seria
       * inventar um ciclo que não existe.
       */}
      {cycle.beyond.length > 0 ? (
        <Stack gap="md">
          <Text variant="overline" tone="accent" accessibilityRole="header">
            Depois deste ciclo
          </Text>
          <Card>
            <Stack gap="sm">
              {cycle.beyond.map((item) => (
                <CareLine key={item.id} item={item} />
              ))}
            </Stack>
          </Card>
        </Stack>
      ) : null}
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
    <Row gap="sm" style={styles.line}>
      <CareTypeMark careTypeCode={item.careTypeCode} />
      <Text variant="caption" tone="muted">
        {`${formatPlannedDate(item.plannedDate)} · ${OUTCOME_LABEL[item.outcome]}`}
      </Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', justifyContent: 'space-between' },
  /** `nowrap` porque tipo e data numa linha só é o que faz quatro semanas caberem numa tela. */
  line: { alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap', gap: space.sm },
});
