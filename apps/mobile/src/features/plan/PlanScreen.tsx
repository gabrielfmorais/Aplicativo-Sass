import type {
  CareTypeCode,
  EntitlementsPort,
  HairPlanPort,
  HairProfileSnapshot,
  LocalDate,
  PlanDraft,
  PlanPreferences,
  PlanPreferencesPort,
} from '@app/core';
import { EntitlementService, buildPlan } from '@app/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, Loading, Row, Screen, Stack, Text } from '@/design/primitives';
import { CareTypeMark } from '@/features/care/CareTypeMark';
import { reasonOf } from '@/shared/failure-detail';

import { EVIDENCE_LABEL, formatPlannedDate } from './copy';
import { groupIntoWeeks } from './weeks';

/** What the preview draws. `careTypeCode` is the engine's own type, not a key of a copy map. */
type Item = { key: string; careTypeCode: CareTypeCode; plannedDate: string };

/**
 * The schedule, grouped by week (SPEC-016 slice 3).
 *
 * Twelve dates in a row are accurate and unreadable; four weeks of two or three are a routine she
 * can picture. Each care carries its type as a word and its hue as a mark — the same semantic
 * colours the daily screen uses, so a plan looks the same wherever she meets it (FR5).
 */
function Schedule({ items, startsOn }: { items: readonly Item[]; startsOn: LocalDate }) {
  const weeks = useMemo(() => groupIntoWeeks(items, startsOn), [items, startsOn]);
  if (items.length === 0) {
    return <Text tone="muted">Nenhum cuidado programado ainda.</Text>;
  }
  return (
    <Stack gap="md">
      {weeks.map((week) => (
        <Card key={week.number}>
          <Text variant="overline" tone="muted" accessibilityRole="header">
            {`Semana ${week.number}`}
          </Text>
          <Stack gap="sm">
            {week.items.map((care) => (
              <Row key={care.key} gap="sm" style={styles.careRow}>
                <CareTypeMark careTypeCode={care.careTypeCode} />
                <Text variant="caption" tone="muted">
                  {formatPlannedDate(care.plannedDate)}
                </Text>
              </Row>
            ))}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

/**
 * Why this plan and not another one — the moment the product stops being generic.
 *
 * Accent-tinted because it is the one thing on the screen that is *about her*, and the disclaimer
 * sits inside it rather than under the title: the sentence that says this is cosmetic and not a
 * diagnosis belongs next to the reading it qualifies (D-26/BR2).
 */
function Assessment({ draft }: { draft: PlanDraft }) {
  return (
    <Card tone="accent">
      <Text variant="heading" accessibilityRole="header">
        Sua avaliação capilar
      </Text>
      <Stack gap="xs">
        {draft.evidenceCodes.map((code) => (
          <Text key={code}>{`• ${EVIDENCE_LABEL[code] ?? code}`}</Text>
        ))}
      </Stack>
      <Text variant="caption" tone="muted">
        Uma leitura cosmética das suas respostas para montar o cronograma — não é diagnóstico médico.
      </Text>
    </Card>
  );
}

/**
 * SPEC-004 §5 — the first loop of perceived value: assessment + schedule in one screen.
 *
 * The preview runs the very same `buildPlan` from @app/core that the `generate-plan` Edge Function
 * runs, so what she confirms is what gets persisted (AC3). Confirming calls the server, which is the
 * only thing that can create a plan. Retrying reuses the same `clientRequestId`, so a failed or lost
 * response can never produce a second plan or a spurious supersede (AC9).
 *
 * Shown only while there is no active plan: the route loads the board once and renders the daily
 * screen instead as soon as one exists (SPEC-005).
 */
export function PlanScreen({
  profile,
  plans,
  today,
  newRequestId,
  onCreated,
  onOpenAccount,
  onCancel,
  entitlements,
  planPreferences,
}: {
  profile: HairProfileSnapshot;
  plans: HairPlanPort;
  today: LocalDate;
  newRequestId: () => string;
  onCreated: () => void;
  onOpenAccount?: () => void;
  /**
   * SPEC-015 — the two questions the server asks before it places her cares. The preview asks them
   * too, so what she confirms is what gets persisted (AC3). The answers decide only what is
   * *drawn*: the server re-reads both (`has_entitlement`, FR3) and ignores whatever the client
   * believed.
   */
  entitlements: EntitlementsPort;
  planPreferences: PlanPreferencesPort;
  /**
   * Present only when this preview is replacing an active plan (SPEC-014). Its presence is what
   * makes the screen say so and offer a way out — the same screen, told what it is doing.
   */
  onCancel?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /**
   * Why the last attempt failed, rendered **only under `__DEV__`** (D-87/D-90).
   *
   * "Tente novamente" is the right thing to say to a user and the wrong thing to say to a developer:
   * it invites a retry that, when `generate-plan` is not deployed at all, can never succeed. The
   * gateway's real answer — `HTTP 404: {"code":"NOT_FOUND"}` — takes one line to show and turns an
   * evening of guessing into a diagnosis. Never logged, never leaves the device.
   */
  const [failure, setFailure] = useState<string | null>(null);
  // One id per user intent: reused across retries so the server call stays idempotent.
  const requestId = useRef<string | null>(null);
  // The plan is not drawn until this resolves, so she never sees the default schedule flash into a
  // customised one.
  const [preferences, setPreferences] = useState<PlanPreferences | undefined | 'resolving'>('resolving');

  // Fail closed (§16): entitlement unknown, read failed, no row or an empty set all mean the engine
  // default — the same answer the server gives itself.
  useEffect(() => {
    let active = true;
    Promise.all([entitlements.get(), planPreferences.get()])
      .then(([granted, stored]) => {
        if (!active) return;
        const weekdays = stored?.preferredWeekdays ?? [];
        const premium = EntitlementService.can('plan_customization', granted) && weekdays.length > 0;
        setPreferences(premium ? { preferredWeekdays: weekdays } : undefined);
      })
      .catch(() => active && setPreferences(undefined));
    return () => {
      active = false;
    };
  }, [entitlements, planPreferences]);

  const applied = preferences === 'resolving' ? undefined : preferences;
  const draft = useMemo(() => buildPlan(profile, today, applied), [profile, today, applied]);

  const confirm = () => {
    if (submitting) return; // double-submit guard on top of the server-side idempotency
    requestId.current ??= newRequestId();
    setSubmitting(true);
    setMessage(null);
    setFailure(null);
    plans
      .generate({ clientRequestId: requestId.current, startsOn: today })
      .then(() => {
        requestId.current = null;
        onCreated();
      })
      .catch((error: unknown) => {
        setMessage('Não foi possível criar seu cronograma. Tente novamente.');
        setFailure(reasonOf(error));
      })
      .finally(() => setSubmitting(false));
  };

  // Memoised so the grouping below can actually be memoised: a fresh array every render would make
  // the `useMemo` in `Schedule` decorative, which is worse than not having one — it reads as a
  // guarantee it does not give.
  const items: Item[] = useMemo(
    () => draft.cares.map((c, i) => ({ key: `${c.plannedDate}-${i}`, ...c })),
    [draft],
  );

  // Not `null`: a white screen is indistinguishable from a crash, and on a slow connection it is the
  // first thing she would see (SPEC-016 FR4/EC5).
  if (preferences === 'resolving') return <Loading label="Montando seu cronograma…" />;

  const confirmLabel = submitting
    ? 'Criando…'
    : onCancel
      ? 'Confirmar novo cronograma'
      : 'Começar meu cronograma';

  return (
    <Screen
      footer={
        <Stack gap="sm">
          {/* The only filled button on the screen. `disabled` rather than `busy` on purpose: a
              full-width primary that says "Criando…" tells her more than a bare spinner, and the
              double-submit guard is in `confirm` either way. */}
          <Button
            label={confirmLabel}
            disabled={submitting}
            accessibilityState={{ busy: submitting }}
            onPress={confirm}
          />
          {onCancel ? (
            <Button label="Cancelar" variant="ghost" disabled={submitting} onPress={onCancel} />
          ) : onOpenAccount ? (
            <Button label="Sua conta" variant="ghost" onPress={onOpenAccount} />
          ) : null}
        </Stack>
      }
    >
      <Text variant="display" accessibilityRole="header">
        Este é o seu cronograma
      </Text>

      <Assessment draft={draft} />

      <Stack gap="md">
        <Text variant="overline" tone="muted" accessibilityRole="header">
          {`Próximas 4 semanas · ${items.length} ${items.length === 1 ? 'cuidado' : 'cuidados'}`}
        </Text>
        {/* The draft owns the start date, not this screen: grouping by `today` would silently
            mislabel every week if `buildPlan` ever moved the start away from it. */}
        <Schedule items={items} startsOn={draft.plan.startsOn as LocalDate} />
        {draft.weekdayPlacement && !draft.weekdayPlacement.fullyHonoured ? (
          <Text variant="caption" tone="muted">
            Sua rotina pede mais cuidados por semana do que os dias que você escolheu, então alguns ficaram no
            dia sugerido pela avaliação. Nenhum cuidado foi removido.
          </Text>
        ) : null}
      </Stack>

      {onCancel ? (
        <Card tone="muted">
          <Text variant="bodyStrong">
            Confirmar substitui seu cronograma atual. Seu histórico continua salvo.
          </Text>
        </Card>
      ) : null}

      {message ? (
        <Text accessibilityLiveRegion="polite" tone="danger">
          {message}
        </Text>
      ) : null}
      {__DEV__ && failure ? (
        <Text variant="caption" tone="faint">
          {failure}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  careRow: { alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' },
});
