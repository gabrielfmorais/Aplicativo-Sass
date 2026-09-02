import type { Progress } from '@app/core';

import { Card, Stack, Text } from '@/design/primitives';

/**
 * SPEC-009 §14 — three facts, in words, about what she actually recorded.
 *
 * Deliberately not a dashboard: no percentage, no score, no trend arrow, no chart. A fraction is
 * exact and cannot be over-read; "73%" from four cares invites a conclusion the data does not
 * support (§2). Every line names its scope ("neste plano") and the rating is labelled as her own
 * answer, so observed and inferred never blur (BR6/BR7).
 */
export function ProgressSummary({ progress }: { progress: Progress }) {
  const { elapsed, done, skipped, checkInCount, averageFeel, lifetimeDone } = progress;

  return (
    /**
     * SPEC-029 — o cartão de marca, e não o cinza.
     *
     * Este é o **conteúdo da aba Progresso**: o bloco que responde à pergunta que dá nome à tela.
     * Ele estava em `muted`, que é a superfície mais apagada do sistema — a tela inteira lia como um
     * documento em rascunho. A cor mora na superfície, nunca no texto (§14).
     */
    <Card tone="brand">
      <Text variant="overline" tone="accent" accessibilityRole="header">
        Seu progresso
      </Text>

      <Stack gap="xs">
        {elapsed === 0 ? (
          <Text tone="muted">
            Seu plano começou agora. O resumo aparece conforme você registra os cuidados.
          </Text>
        ) : (
          <>
            {/*
              SPEC-029 — hierarquia, e **só** hierarquia.
              As quatro linhas tinham o mesmo peso e o mesmo tamanho, então a resposta principal
              ("concluiu 2 de 3") não se distinguia do detalhe. Isto é `heading`; o resto desce para
              `caption`. ⚠️ **Nada aqui vira número grande, barra ou porcentagem** — a recusa da
              SPEC-009 §2 continua inteira, e é por isso que a frase continua sendo uma frase: uma
              fração em palavras é exata e não convida a conclusão que o dado não sustenta.
            */}
            <Text variant="heading">{`Neste plano, você concluiu ${done} de ${elapsed} cuidados até aqui.`}</Text>
            {skipped > 0 ? (
              <Text variant="caption" tone="muted">
                {skipped > 1 ? `Pulou ${skipped}.` : 'Pulou 1.'}
              </Text>
            ) : null}
          </>
        )}

        {/* Only when it says something the line above did not: after a reassessment the plan-scoped
            number restarts, and this is what keeps her earlier work visible (SPEC-014 FR7/EC6). */}
        {lifetimeDone > done ? (
          <Text
            variant="caption"
            tone="muted"
          >{`Desde o início, você concluiu ${lifetimeDone} cuidados.`}</Text>
        ) : null}

        {checkInCount > 0 ? (
          <Text variant="caption" tone="muted">
            {averageFeel === null
              ? `Você avaliou ${checkInCount} ${checkInCount > 1 ? 'cuidados' : 'cuidado'}.`
              : `Você avaliou ${checkInCount} cuidados · média ${averageFeel.toFixed(1).replace('.', ',')} de 5 (sua avaliação).`}
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}
