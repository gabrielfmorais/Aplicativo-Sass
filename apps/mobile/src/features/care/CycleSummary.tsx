import type { Progress } from '@app/core';

import { Button, Card, Stack, Text } from '@/design/primitives';

/**
 * SPEC-021 (F29) — o mês, contado por ela mesma.
 *
 * A SPEC-019 deu a forma das quatro semanas e deixou o fecho de fora. Ele chega aqui: ao fim do
 * ciclo, ela vê o que aconteceu **antes** de decidir o próximo — que é a diferença entre escolher e
 * chutar.
 *
 * **Uma frase por fato, e nenhuma a mais.** Sem porcentagem, sem nota, sem barra de aderência, sem
 * comparação com ciclo anterior ou com ninguém. Um percentual sobre oito cuidados não significa
 * nada, e lido como avaliação faz dano — a SPEC-009 já pagou esse preço uma vez.
 *
 * **Pular é desfecho, não falha; reagendar não é erro** (SPEC-019 BR4). Por isso não há "parabéns"
 * nem "você faltou": as duas frases são a mesma coisa, transformar registro em julgamento.
 *
 * Os números são os do `Progress` — os mesmos que a Hoje mostra. Recontá-los aqui criaria duas
 * verdades sobre o mesmo mês, que divergiriam na primeira vez que qualquer regra mudasse (BR1).
 */
export function CycleSummary({
  progress,
  ended,
  onStartNext,
}: {
  progress: Progress;
  /** Derivado da data de fim do ciclo, nunca armazenado (BR4). Muda o tempo verbal, não os números. */
  ended: boolean;
  /** Presente só quando há um próximo a oferecer (D-82). */
  onStartNext?: () => void;
}) {
  const { elapsed, done, skipped, total, planned, checkInCount, averageFeel } = progress;

  return (
    <Card tone={ended ? 'accent' : 'muted'}>
      <Text variant="overline" tone={ended ? 'accent' : 'muted'} accessibilityRole="header">
        {ended ? 'Ciclo encerrado' : 'Como está indo'}
      </Text>

      <Stack gap="xs">
        {elapsed === 0 ? (
          // EC1/FR4 — nada aconteceu ainda, e dizer isso é melhor do que mostrar zeros que leem
          // como resultado. É a mesma frase que a tela de Progresso já usa, de propósito.
          <Text tone="muted">
            {`Este ciclo tem ${total} ${total === 1 ? 'cuidado' : 'cuidados'}. O resumo aparece conforme você registra.`}
          </Text>
        ) : (
          <>
            <Text>
              {ended
                ? `Você concluiu ${done} dos ${total} cuidados deste ciclo.`
                : `Até aqui, você concluiu ${done} de ${elapsed} cuidados.`}
            </Text>
            {skipped > 0 ? <Text tone="muted">{skipped > 1 ? `Pulou ${skipped}.` : 'Pulou 1.'}</Text> : null}
            {/* Em aberto, não "em falta": um cuidado que ainda não chegou não é dívida (EC5). */}
            {!ended && planned > 0 ? (
              <Text tone="muted">
                {planned > 1 ? `Ainda faltam ${planned} no ciclo.` : 'Ainda falta 1 no ciclo.'}
              </Text>
            ) : null}
            {/* Zero avaliações some, em vez de virar um "0 avaliados" que parece cobrança (EC3). */}
            {checkInCount > 0 ? (
              <Text tone="muted">
                {averageFeel === null
                  ? `Você avaliou ${checkInCount} ${checkInCount > 1 ? 'cuidados' : 'cuidado'}.`
                  : `Você avaliou ${checkInCount} cuidados · média ${averageFeel.toFixed(1).replace('.', ',')} de 5 (sua avaliação).`}
              </Text>
            ) : null}
          </>
        )}
      </Stack>

      {ended && onStartNext ? (
        <Button label="Montar o próximo ciclo" variant="secondary" onPress={onStartNext} />
      ) : null}
    </Card>
  );
}
