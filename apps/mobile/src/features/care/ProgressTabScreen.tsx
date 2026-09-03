import type { CareBoard, LocalDate } from '@app/core';
import { CYCLE_WEEKS, buildCycleView, buildProgress, buildTodayView } from '@app/core';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, Screen, ScreenHeader, Stack, Text } from '@/design/primitives';
import { CycleSummary } from '@/features/care/CycleSummary';
import { ProgressSummary } from '@/features/care/ProgressSummary';

/**
 * SPEC-026 fatia 1 (FR6) — **Progresso**: o que ela acumulou, e nada além disso.
 *
 * O resumo já existia (SPEC-009), mas morava no fim da Hoje, abaixo de tudo o que era acionável.
 * Ler o que se acumulou não compete com fazer o cuidado do dia — e no fim de uma tela longa ele
 * simplesmente não era lido.
 *
 * **Continua sem pontuar.** Nenhum percentual, nota, gráfico, tendência ou comparação: as barreiras
 * das SPECs 009, 019 e 021 valem aqui inteiras, e mudar de lugar não é licença para mudar de tom.
 * Uma fração é exata e não se lê a mais; "73%" de quatro cuidados convida a uma conclusão que o
 * dado não sustenta.
 *
 * **O fecho do ciclo (`F29`) mora aqui também, e só quando o ciclo fecha.** Ele nasceu dentro da
 * visão de ciclo, onde só chegava quem foi procurar. Mostrá-lo o tempo todo, ao lado do resumo,
 * punha dois cartões dizendo o mesmo fato na mesma tela. Os números são os mesmos: **um**
 * `buildProgress`, e as duas leituras bebem dele — recontar criaria duas verdades sobre o mesmo
 * mês, que divergiriam na primeira mudança de regra.
 */
export function ProgressTabScreen({
  board,
  today,
  profile,
  onOpenCycle,
}: {
  board: CareBoard | null;
  today: LocalDate;
  /** SPEC-026 FR11 — o ciclo completo, a um toque de onde ela lê o acumulado. */
  onOpenCycle: () => void;
  /** SPEC-026 fatia 7 — o acesso a **Você**, no cabeçalho. A tela só repassa. */
  profile: { readonly name: string | null; readonly onPress: () => void };
}) {
  const summary = useMemo(() => {
    if (!board) return null;
    const view = buildTodayView(board.cares, board.executions, today, board.checkIns, board.pausedOn);
    const progress = buildProgress(view, board.lifetimeDoneCount);
    const cycle = buildCycleView(
      board.cares,
      board.executions,
      board.startsOn as LocalDate,
      today,
      board.checkIns,
      board.pausedOn,
    );
    /**
     * **Duas entradas, e as mesmas duas da visão de ciclo** (SPEC-021): a data de fim **ou** não ter
     * sobrado nada. Derivar só pela data faria as duas telas discordarem sobre o mesmo mês — uma
     * dizendo "ciclo encerrado" enquanto a outra ainda diz "como está indo".
     */
    const nothingLeft = progress.planned === 0 && progress.overdue === 0;
    return { progress, ended: today > cycle.endsOn || nothingLeft };
  }, [board, today]);

  return (
    <Screen>
      <ScreenHeader title="O que você já fez" profile={profile} />

      {summary ? (
        <>
          <ProgressSummary progress={summary.progress} />
          {/*
            ⚠️ **Só no fim do ciclo.** Os dois lado a lado diziam quase a mesma coisa — "concluiu 2
            de 3, pulou 1, avaliou 2" nos dois cartões —, e dois cartões repetindo o mesmo fato é
            ruído, não reforço. Encerrado, o `CycleSummary` diz o que o outro não diz: que acabou, e
            o que vem depois. Andando, quem tem a informação única é o `ProgressSummary`, com o
            acumulado que atravessa reavaliação (SPEC-014 FR7).
          */}
          {summary.ended ? <CycleSummary progress={summary.progress} ended /> : null}
          <Stack gap="md">
            <Text variant="overline" tone="accent" accessibilityRole="header">
              O mês inteiro
            </Text>
            <Card>
              <Text tone="muted">
                {`As ${CYCLE_WEEKS} semanas do seu cronograma, e o que aconteceu em cada uma.`}
              </Text>
              <Button label="Ver meu ciclo" variant="secondary" onPress={onOpenCycle} style={styles.action} />
            </Card>
          </Stack>
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

const styles = StyleSheet.create({
  action: { alignSelf: 'flex-start' },
});
