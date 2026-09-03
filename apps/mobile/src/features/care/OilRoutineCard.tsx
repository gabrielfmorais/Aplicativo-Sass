import type { OilRoutinePort, OilRoutineView } from '@app/core';
import { OIL_INTERVAL_OPTIONS } from '@app/core';
import { StyleSheet } from 'react-native';

import { Button, Card, Chip, Row, Stack, Text } from '@/design/primitives';
import { formatPlannedDate } from '@/features/plan/copy';

/**
 * SPEC-040 (F39) — o endereço da rotina de óleo, em Cuidados.
 *
 * ⚠️ **Nada aqui diz o que o óleo faz** (BR4/NG2). O intervalo é uma marca de calendário que ela
 * escolhe, como a frequência de lavagem do perfil — e **nenhuma opção é apresentada como
 * recomendada**: "a cada 3 dias é o ideal" seria afirmação capilar sem sign-off (D-26/D-70). O que
 * fazer, onde e com qual óleo é o `F38`/`F48`, e nenhum dos dois está aberto.
 */

/** Sem "recomendado", sem "ideal", sem estrela. Só o intervalo. */
export const intervalLabel = (days: number): string =>
  days === 7 ? '1x por semana' : days === 15 ? 'A cada 15 dias' : `A cada ${days} dias`;

export function OilRoutineCard({
  view,
  busy,
  onChoose,
  onTurnOff,
}: {
  view: OilRoutineView;
  busy: boolean;
  onChoose: (everyDays: number) => void;
  onTurnOff: () => void;
}) {
  const on = view.state !== 'none';
  return (
    <Card>
      <Text variant="heading" accessibilityRole="header">
        Rotina de óleo
      </Text>
      <Text tone="muted">
        {on
          ? 'Você escolheu de quantos em quantos dias quer lembrar. Dá para trocar ou desligar quando quiser.'
          : 'Se você tem uma rotina de óleo, escolha de quantos em quantos dias quer que a Huna lembre.'}
      </Text>

      <Row>
        {OIL_INTERVAL_OPTIONS.map((days) => (
          <Chip
            key={days}
            label={intervalLabel(days)}
            selected={view.everyDays === days}
            disabled={busy}
            onPress={() => onChoose(days)}
          />
        ))}
      </Row>

      {on && view.dueOn ? (
        <Stack gap="sm">
          <Text variant="caption" tone="muted">
            {/* Um fato datado, sem elogio e sem cobrança (NG3). */}
            {view.state === 'overdue'
              ? `Estava para ${formatPlannedDate(view.dueOn)}`
              : view.state === 'due_today'
                ? 'É hoje'
                : `Próxima: ${formatPlannedDate(view.dueOn)}`}
            {view.lastDoneOn ? ` · última vez em ${formatPlannedDate(view.lastDoneOn)}` : ''}
          </Text>
          <Button
            label="Desligar a rotina"
            variant="ghost"
            size="sm"
            disabled={busy}
            onPress={onTurnOff}
            style={styles.inline}
          />
        </Stack>
      ) : null}
    </Card>
  );
}

/** Um botão dentro do corpo não ocupa a linha inteira (mesma regra da SPEC-023/SPEC-024). */
const styles = StyleSheet.create({
  inline: { alignSelf: 'flex-start' },
});

export type { OilRoutinePort };
