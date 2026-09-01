import type { ResumeOutcome } from '@app/core';
import { useState } from 'react';

import { Button, Card, Stack, Text } from '@/design/primitives';
import { formatPlannedDate } from '@/features/plan/copy';

/**
 * SPEC-022 fatia 3 — a pausa, na tela.
 *
 * O Blueprint §5 diz o que ela sente hoje: *"a única saída é pular cuidado por cuidado, e o app
 * acumula atrasos que a fazem sentir que falhou — quando ela apenas viveu."*
 *
 * **Nada aqui cobra.** Nem ao pausar, nem ao voltar. "Parar sem perder nada, e voltar sem culpa" é
 * o objetivo declarado, e uma única palavra de reprovação em qualquer um dos dois momentos o
 * desfaz.
 *
 * **Ela sabe antes de confirmar** (FR4). A previsão vem do servidor, pela mesma função que executa
 * — nunca de uma conta refeita aqui. Uma segunda cópia da regra de deslocamento em TypeScript
 * divergiria da primeira, e a divergência apareceria como o app prometendo uma coisa e fazendo
 * outra.
 */

/** O que a retomada vai fazer, em palavras. Contagem, nunca julgamento. */
const outcomeLine = (outcome: ResumeOutcome, pausedOn: string): string => {
  if (outcome.action === 'new_cycle') {
    return 'Seu ciclo ficou parado tempo demais para continuar de onde estava. Ao voltar, montamos o próximo a partir de agora — o que você já registrou continua salvo.';
  }
  const cares = outcome.careCount === 1 ? '1 cuidado' : `${outcome.careCount} cuidados`;
  const days = outcome.shiftDays === 1 ? '1 dia' : `${outcome.shiftDays} dias`;
  return outcome.shiftDays === 0
    ? `Seus ${cares} restantes continuam nos dias em que estavam. Você pausou hoje, ${formatPlannedDate(pausedOn)}.`
    : `${cares} restantes andam ${days} para frente, mantendo o espaçamento entre eles. Nada do que você já fez muda de lugar.`;
};

export function PauseCard({
  pausedOn,
  busy,
  onPause,
  onPreviewResume,
  onResume,
}: {
  /** `null` quando o cronograma está andando. */
  pausedOn: string | null;
  busy: boolean;
  onPause: () => void;
  /** Pergunta ao servidor o que aconteceria, sem escrever nada. */
  onPreviewResume: () => Promise<ResumeOutcome>;
  onResume: () => void;
}) {
  const [preview, setPreview] = useState<ResumeOutcome | 'asking' | null>(null);

  if (pausedOn === null) {
    return (
      <Card tone="muted">
        <Text variant="heading" accessibilityRole="header">
          Pausar meu cronograma
        </Text>
        {/* Diz o que a pausa faz por ela, não o que ela deixa de fazer. */}
        <Text tone="muted">
          Viagem, uma semana impossível, cabelo em proteção. Enquanto pausado, nada fica atrasado e nenhum
          lembrete chega — e nada do que você registrou se perde.
        </Text>
        <Button label="Pausar" variant="secondary" disabled={busy} onPress={onPause} />
      </Card>
    );
  }

  return (
    <Card tone="accent">
      <Text variant="heading" accessibilityRole="header">
        Seu cronograma está pausado
      </Text>
      <Text tone="muted">{`Desde ${formatPlannedDate(pausedOn)}. Nada está atrasado e nenhum lembrete vai chegar.`}</Text>

      {preview === null ? (
        <Button
          label="Quero voltar"
          disabled={busy}
          onPress={() => {
            setPreview('asking');
            // Falhar em prever não pode virar uma retomada às cegas: some a pergunta e ela tenta
            // de novo, em vez de o app confirmar algo que não sabe explicar.
            onPreviewResume()
              .then(setPreview)
              .catch(() => setPreview(null));
          }}
        />
      ) : preview === 'asking' ? (
        <Text tone="muted">Vendo o que acontece quando você voltar…</Text>
      ) : (
        <Stack gap="sm">
          {/* A explicação **antes** do botão, e não depois: é o que FR4 pede, e é a diferença
              entre ela decidir e ela descobrir. */}
          <Text accessibilityLiveRegion="polite">{outcomeLine(preview, pausedOn)}</Text>
          <Button label="Voltar aos meus cuidados" disabled={busy} onPress={onResume} />
          <Button
            label="Continuar pausado"
            variant="ghost"
            disabled={busy}
            onPress={() => setPreview(null)}
          />
        </Stack>
      )}
    </Card>
  );
}
