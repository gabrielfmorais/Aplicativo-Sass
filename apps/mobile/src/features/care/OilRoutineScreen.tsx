import type { OilRoutineView } from '@app/core';

import { Button, Screen, Stack, Text } from '@/design/primitives';
import { OilRoutineCard } from '@/features/care/OilRoutineCard';

/**
 * SPEC-071 (F39) — **a rotina de óleo, na tela dela.**
 *
 * A configuração inteira morava dentro da aba Cuidados e ocupava quase uma tela: chips de intervalo,
 * a lista de horários com adicionar, editar, remover e ligar/desligar, e o botão de desligar a
 * rotina. A aba ficou com o **estado** (`OilRoutineSummary`) e o ajuste veio para cá — a mesma
 * separação que a SPEC-069 fez com a Jornada, e a régua que a SPEC-067 escreveu: o que ela
 * **consulta** fica na aba, o que ela **ajusta uma vez** ganha endereço.
 *
 * ⚠️ **O conteúdo é o mesmo `OilRoutineCard`, e isso é de propósito.** Reescrever a configuração aqui
 * criaria duas telas capazes de discordar sobre a mesma rotina; o cartão já é o dono daquele
 * vocabulário e das regras dele desde a SPEC-040/053.
 *
 * ⚠️ **Nada aqui recomenda frequência nem diz o que o óleo faz** (D-26/D-70), e ⛔ **nada premia
 * usar mais** (D-103).
 */
export function OilRoutineScreen({
  view,
  busy,
  onChoose,
  onTurnOff,
  message,
  failure,
  times,
  onBack,
}: {
  view: OilRoutineView;
  busy: boolean;
  onChoose: (everyDays: number) => void;
  onTurnOff: () => void;
  message?: string | null;
  failure?: string | null;
  times: {
    readonly onAdd: (at: string) => void;
    readonly onUpdate: (id: string, at: string) => void;
    readonly onToggleReminder: (id: string, enabled: boolean) => void;
    readonly onRemove: (id: string) => void;
  };
  onBack: () => void;
}) {
  return (
    <Screen footer={<Button label="Voltar" variant="ghost" onPress={onBack} />}>
      <Stack gap="sm">
        <Text variant="display" accessibilityRole="header">
          Rotina de óleo
        </Text>
        {/*
          ⚠️ Descreve o que a tela FAZ, sem dizer o que o óleo faz e sem sugerir com que frequência
          usá-lo. "A cada 3 dias é o ideal" seria afirmação capilar sem sign-off.
        */}
        <Text tone="muted">
          De quantos em quantos dias a Huna lembra, e em que horários do dia. Você escolhe — dá para ter
          quantos horários quiser.
        </Text>
      </Stack>

      <OilRoutineCard
        view={view}
        busy={busy}
        onChoose={onChoose}
        onTurnOff={onTurnOff}
        message={message ?? null}
        failure={failure ?? null}
        times={times}
      />
    </Screen>
  );
}
