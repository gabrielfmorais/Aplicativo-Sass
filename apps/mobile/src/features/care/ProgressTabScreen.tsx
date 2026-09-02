import type { CareBoard, LocalDate } from '@app/core';
import { buildProgress, buildTodayView } from '@app/core';
import { useMemo } from 'react';

import { Card, Screen, ScreenHeader, Text } from '@/design/primitives';
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
 */
export function ProgressTabScreen({
  board,
  today,
  profile,
}: {
  board: CareBoard | null;
  today: LocalDate;
  /** SPEC-026 fatia 7 — o acesso a **Você**, no cabeçalho. A tela só repassa. */
  profile: { readonly name: string | null; readonly onPress: () => void };
}) {
  const progress = useMemo(() => {
    if (!board) return null;
    const view = buildTodayView(board.cares, board.executions, today, board.checkIns, board.pausedOn);
    return buildProgress(view, board.lifetimeDoneCount);
  }, [board, today]);

  return (
    <Screen>
      <ScreenHeader eyebrow="O que você já fez" title="Progresso" profile={profile} />

      {progress ? (
        <ProgressSummary progress={progress} />
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
