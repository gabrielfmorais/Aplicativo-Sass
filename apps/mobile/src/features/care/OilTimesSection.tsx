import type { OilRoutineTime } from '@app/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, Row, Stack, Text } from '@/design/primitives';
import { color, space } from '@/design/tokens';

/**
 * SPEC-053 (F39, evolução) — **os horários do dia em que ela quer lembrar do óleo.**
 *
 * > *"Se a usuária quiser 1 horário, pode. Se quiser 3, pode. Se quiser 10, pode."* — dono
 *
 * ⛔ **Nenhum horário é sugerido, pré-marcado ou ordenado por mérito**, e nada nesta tela trata
 * "mais horários" como melhor. Com que frequência ela **deveria** passar óleo é conteúdo capilar
 * substantivo ⇒ D-26/D-70. Aqui só existe o calendário dela.
 *
 * ⛔ **Nenhuma contagem em tom de placar** (NG2/NG3): *"3 horários"* é uma lista; *"você passou óleo
 * 12 vezes este mês!"* seria elogio por quantidade, que a D-103 proíbe explicitamente.
 */

const MINUTE_STEP = 5;

const pad = (n: number) => String(n).padStart(2, '0');
const toHHMM = (h: number, m: number) => `${pad(h)}:${pad(m)}`;
const parse = (at: string): [number, number] => {
  const [h, m] = at.split(':').map(Number);
  return [h ?? 8, m ?? 0];
};

/**
 * ⚠️ **Dois seletores em vez de um picker, e a razão é medida.**
 *
 * Um picker nativo **não renderiza no preview web**, que é hoje o único jeito de olhar o produto
 * (D-80) — foi exatamente assim que a `@shopify/react-native-skia` foi reprovada (D-101). Aqui não
 * entra dependência nenhuma: são as primitivas que já existem, e o valor aparece por extenso ao
 * lado, para o toque não ser a única forma de saber onde ela está.
 */
function TimePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (at: string) => void;
  disabled: boolean;
}) {
  const [h, m] = parse(value);
  const step = (dh: number, dm: number) => onChange(toHHMM((h + dh + 24) % 24, (m + dm + 60) % 60));

  return (
    <Row>
      <Button
        label="− hora"
        variant="ghost"
        size="sm"
        disabled={disabled}
        accessibilityLabel="Uma hora antes"
        onPress={() => step(-1, 0)}
      />
      <Text variant="heading" accessibilityLiveRegion="polite">
        {toHHMM(h, m)}
      </Text>
      <Button
        label="+ hora"
        variant="ghost"
        size="sm"
        disabled={disabled}
        accessibilityLabel="Uma hora depois"
        onPress={() => step(1, 0)}
      />
      <Button
        label="− min"
        variant="ghost"
        size="sm"
        disabled={disabled}
        accessibilityLabel="Cinco minutos antes"
        onPress={() => step(0, -MINUTE_STEP)}
      />
      <Button
        label="+ min"
        variant="ghost"
        size="sm"
        disabled={disabled}
        accessibilityLabel="Cinco minutos depois"
        onPress={() => step(0, MINUTE_STEP)}
      />
    </Row>
  );
}

export function OilTimesSection({
  times,
  busy,
  onAdd,
  onUpdate,
  onToggleReminder,
  onRemove,
}: {
  times: readonly OilRoutineTime[];
  busy: boolean;
  onAdd: (at: string) => void;
  onUpdate: (id: string, at: string) => void;
  onToggleReminder: (id: string, enabled: boolean) => void;
  onRemove: (id: string) => void;
}) {
  /** `null` = nenhum editor aberto; `'new'` = acrescentando; um id = editando aquele. */
  const [editing, setEditing] = useState<null | 'new' | string>(null);
  const [draft, setDraft] = useState('08:00');

  const open = (target: 'new' | string, at: string) => {
    setDraft(at);
    setEditing(target);
  };
  const commit = () => {
    if (editing === 'new') onAdd(draft);
    else if (editing) onUpdate(editing, draft);
    setEditing(null);
  };

  return (
    <Stack gap="sm">
      <Text variant="overline" tone="accent" accessibilityRole="header">
        Horários
      </Text>
      {/*
        ⚠️ O texto diz o que a lista **é**, não o que ela deveria ter. "Quantos você quiser" é uma
        permissão; "3 é o ideal" seria uma recomendação capilar.
      */}
      <Text variant="caption" tone="muted">
        {times.length === 0
          ? 'Sem horário, a Huna lembra uma vez no dia da rotina. Você pode escolher quantos horários quiser.'
          : 'Cada horário pode ter o lembrete ligado ou desligado. Desligado, ele continua na sua rotina.'}
      </Text>

      {times.map((t) => (
        <View key={t.id} style={styles.row}>
          <Row>
            <Button
              label={t.at}
              variant="secondary"
              size="sm"
              disabled={busy}
              accessibilityLabel={`Editar o horário ${t.at}`}
              onPress={() => open(t.id, t.at)}
            />
            {/*
              `multi` e não `selected` sozinho: é uma marcação independente, e um chip que se
              anuncia como rádio faz a tecnologia assistiva prometer escolha única (SPEC-042).
            */}
            <Chip
              label={t.reminderEnabled ? 'Lembrete ligado' : 'Lembrete desligado'}
              multi
              selected={t.reminderEnabled}
              disabled={busy}
              onPress={() => onToggleReminder(t.id, !t.reminderEnabled)}
            />
            <Button
              label="Remover"
              variant="ghost"
              size="sm"
              disabled={busy}
              accessibilityLabel={`Remover o horário ${t.at}`}
              onPress={() => onRemove(t.id)}
            />
          </Row>
          {editing === t.id ? (
            <Stack gap="sm">
              <TimePicker value={draft} onChange={setDraft} disabled={busy} />
              <Row>
                <Button label="Salvar horário" size="sm" disabled={busy} onPress={commit} />
                <Button
                  label="Cancelar"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onPress={() => setEditing(null)}
                />
              </Row>
            </Stack>
          ) : null}
        </View>
      ))}

      {editing === 'new' ? (
        <Stack gap="sm">
          <TimePicker value={draft} onChange={setDraft} disabled={busy} />
          <Row>
            <Button label="Adicionar horário" size="sm" disabled={busy} onPress={commit} />
            <Button
              label="Cancelar"
              variant="ghost"
              size="sm"
              disabled={busy}
              onPress={() => setEditing(null)}
            />
          </Row>
        </Stack>
      ) : (
        <Button
          label="Adicionar horário"
          variant="secondary"
          size="sm"
          disabled={busy}
          onPress={() => open('new', '08:00')}
          style={styles.inline}
        />
      )}
    </Stack>
  );
}

const styles = StyleSheet.create({
  /** A régua na borda diz que a linha é **um** horário, e não mais um bloco solto na página. */
  row: {
    borderLeftWidth: 2,
    borderLeftColor: color.accentBorder,
    paddingLeft: space.md,
    gap: space.sm,
  },
  inline: { alignSelf: 'flex-start' },
});
