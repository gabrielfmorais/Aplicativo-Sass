import type { EntitlementsPort, PlanPreferencesPort, Weekday } from '@app/core';
import { EntitlementService, normalizePreferredWeekdays } from '@app/core';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * `0` = Sunday … `6` = Saturday, the same numbering the core and the database use.
 *
 * Three letters, not one: in pt-BR a single initial collides three ways (segunda/sexta/sábado) and
 * two ways (quarta/quinta), so a sighted user could not tell the buttons apart. The screen-reader
 * label is the full name.
 */
const WEEKDAYS: readonly { readonly value: Weekday; readonly short: string; readonly full: string }[] = [
  { value: 0, short: 'Dom', full: 'domingo' },
  { value: 1, short: 'Seg', full: 'segunda-feira' },
  { value: 2, short: 'Ter', full: 'terça-feira' },
  { value: 3, short: 'Qua', full: 'quarta-feira' },
  { value: 4, short: 'Qui', full: 'quinta-feira' },
  { value: 5, short: 'Sex', full: 'sexta-feira' },
  { value: 6, short: 'Sáb', full: 'sábado' },
];

type Loaded = { readonly granted: readonly string[]; readonly selected: readonly Weekday[] };

/**
 * SPEC-015 FR1 — the premium capability `plan_customization`: the weekdays she wants her cares on.
 *
 * The gate here is **UI only** (ADR-011/BR5): it decides what to show, never what is allowed. The
 * server revalidates `has_entitlement` when the plan is generated and produces the engine default
 * without it, so a tampered client that renders this section gains a saved row and no effect.
 *
 * Fail closed (§16): loading, error or unknown entitlement all render as free — an error must never
 * imply access. A failed read still offers a retry, so a flaky network is not mistaken for a
 * downgrade.
 *
 * Saving does not change her current schedule. Nothing replaces a live plan except an explicit
 * confirmation on the preview (FR4/SPEC-014), which is what `onApply` opens.
 */
export function PlanCustomizationSection({
  entitlements,
  planPreferences,
  onApply,
}: {
  entitlements: EntitlementsPort;
  planPreferences: PlanPreferencesPort;
  /** Absent while she has no active plan: the plan preview is already the next screen she sees. */
  onApply?: () => void;
}) {
  const [state, setState] = useState<Loaded | 'loading' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setState('loading');
    setMessage(null);
    let active = true;
    Promise.all([entitlements.get(), planPreferences.get()])
      .then(([granted, preferences]) => {
        if (!active) return;
        setState({ granted, selected: preferences?.preferredWeekdays ?? [] });
      })
      .catch(() => active && setState('error'));
    return () => {
      active = false;
    };
  }, [entitlements, planPreferences]);
  useEffect(() => load(), [load]);

  if (state === 'loading') return <Text>Carregando suas preferências…</Text>;

  if (state === 'error') {
    return (
      <View style={styles.section}>
        <Text style={styles.title} accessibilityRole="header">
          Seus dias preferidos
        </Text>
        <Text accessibilityLiveRegion="polite">
          Não foi possível carregar suas preferências. Seu cronograma segue o padrão.
        </Text>
        <Pressable style={styles.button} onPress={load} accessibilityRole="button">
          <Text>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  const canCustomize = EntitlementService.can('plan_customization', state.granted);

  if (!canCustomize) {
    return (
      <View style={styles.section}>
        <Text style={styles.title} accessibilityRole="header">
          Seus dias preferidos
        </Text>
        <Text style={styles.body}>
          Escolher em que dias da semana seus cuidados caem faz parte do premium. Hoje seu cronograma segue os
          intervalos que a avaliação indicou.
        </Text>
      </View>
    );
  }

  const toggle = (day: Weekday) => {
    setSaved(false);
    setMessage(null);
    const selected = state.selected.includes(day)
      ? state.selected.filter((d) => d !== day)
      : normalizePreferredWeekdays([...state.selected, day]);
    setState({ ...state, selected });
  };

  const save = () => {
    if (saving) return; // double-submit guard: the same row, written twice, is still one write too many
    setSaving(true);
    setMessage(null);
    planPreferences
      .save({ preferredWeekdays: state.selected })
      .then(() => setSaved(true))
      .catch(() => setMessage('Não foi possível salvar seus dias. Tente novamente.'))
      .finally(() => setSaving(false));
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        Seus dias preferidos
      </Text>
      <Text style={styles.body}>
        Escolha em que dias da semana você prefere cuidar do cabelo. Isso muda só{' '}
        <Text style={styles.emphasis}>quando</Text> cada cuidado cai — quais cuidados e com que frequência
        continua vindo da sua avaliação.
      </Text>

      <View style={styles.days}>
        {WEEKDAYS.map((day) => {
          const on = state.selected.includes(day.value);
          return (
            <Pressable
              key={day.value}
              style={[styles.day, on && styles.dayOn]}
              onPress={() => toggle(day.value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={day.full}
            >
              <Text style={styles.dayText}>{day.short}</Text>
            </Pressable>
          );
        })}
      </View>

      {state.selected.length === 0 ? (
        <Text style={styles.body}>Sem dias escolhidos, seu cronograma segue o padrão da avaliação.</Text>
      ) : null}

      <Pressable
        style={styles.button}
        onPress={save}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}
      >
        <Text>{saving ? 'Salvando…' : 'Salvar meus dias'}</Text>
      </Pressable>

      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {message}
        </Text>
      ) : null}

      {saved ? (
        <View style={styles.saved}>
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            Salvo. Seu cronograma atual continua como está — ele só muda quando você gerar um novo.
          </Text>
          {onApply ? (
            <Pressable style={styles.button} onPress={onApply} accessibilityRole="button">
              <Text>Ver novo cronograma</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  title: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 20 },
  emphasis: { fontWeight: '600' },
  days: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  day: {
    minWidth: 48,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOn: { borderWidth: 3 },
  dayText: { fontSize: 16 },
  button: { padding: 14, borderWidth: 1, borderRadius: 8, alignItems: 'center', minHeight: 48 },
  saved: { gap: 8 },
});
