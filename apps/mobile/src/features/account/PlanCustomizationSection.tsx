import type { EntitlementsPort, PlanPreferencesPort, Weekday } from '@app/core';
import { EntitlementService, normalizePreferredWeekdays } from '@app/core';
import { useCallback, useEffect, useState } from 'react';

import { Button, Card, Chip, Row, Stack, Text } from '@/design/primitives';

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

  if (state === 'loading') return <Text tone="muted">Carregando suas preferências…</Text>;

  if (state === 'error') {
    return (
      <Card>
        <Text variant="heading" accessibilityRole="header">
          Seus dias preferidos
        </Text>
        <Text tone="muted" accessibilityLiveRegion="polite">
          Não foi possível carregar suas preferências. Seu cronograma segue o padrão.
        </Text>
        <Button label="Tentar novamente" variant="secondary" onPress={load} />
      </Card>
    );
  }

  const canCustomize = EntitlementService.can('plan_customization', state.granted);

  if (!canCustomize) {
    return (
      <Card>
        <Text variant="heading" accessibilityRole="header">
          Seus dias preferidos
        </Text>
        {/* Framed as what premium *adds*, and the second half says the free schedule is a real
            schedule — not a degraded one waiting to be unlocked (G7/D-83). */}
        <Text tone="muted">
          Escolher em que dias da semana seus cuidados caem faz parte do premium. Hoje seu cronograma segue os
          intervalos que a avaliação indicou.
        </Text>
      </Card>
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
    <Card>
      <Text variant="heading" accessibilityRole="header">
        Seus dias preferidos
      </Text>
      <Text tone="muted">
        Escolha em que dias da semana você prefere cuidar do cabelo. Isso muda só{' '}
        <Text variant="bodyStrong" tone="muted">
          quando
        </Text>{' '}
        cada cuidado cai — quais cuidados e com que frequência continua vindo da sua avaliação.
      </Text>

      <Row gap="sm">
        {WEEKDAYS.map((day) => (
          <Chip
            key={day.value}
            label={day.short}
            accessibilityLabel={day.full}
            selected={state.selected.includes(day.value)}
            multi
            onPress={() => toggle(day.value)}
          />
        ))}
      </Row>

      {state.selected.length === 0 ? (
        <Text variant="caption" tone="muted">
          Sem dias escolhidos, seu cronograma segue o padrão da avaliação.
        </Text>
      ) : null}

      <Button
        label={saving ? 'Salvando…' : 'Salvar meus dias'}
        variant="secondary"
        disabled={saving}
        accessibilityState={{ busy: saving }}
        onPress={save}
      />

      {message ? (
        <Text accessibilityLiveRegion="polite" tone="danger">
          {message}
        </Text>
      ) : null}

      {saved ? (
        <Stack gap="sm">
          <Text accessibilityLiveRegion="polite" tone="success">
            Salvo. Seu cronograma atual continua como está — ele só muda quando você gerar um novo.
          </Text>
          {onApply ? <Button label="Ver novo cronograma" onPress={onApply} /> : null}
        </Stack>
      ) : null}
    </Card>
  );
}
