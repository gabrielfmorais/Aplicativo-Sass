import type { CareTypeCode } from '@app/core';

/**
 * pt-BR copy for the codes the engines emit. Copy lives in the UI, never in the core
 * (domain-rules worksheet §11). The full content per care type belongs to SPEC-007.
 *
 * Wording is deliberately cosmetic: this is an "avaliação capilar", never a diagnosis (D-26).
 */
export const CARE_TYPE_LABEL: Record<CareTypeCode, string> = {
  hydration: 'Hidratação',
  nutrition: 'Nutrição',
  reconstruction: 'Reconstrução',
};

export const EVIDENCE_LABEL: Record<string, string> = {
  goal_hydration: 'Você quer mais maciez e hidratação.',
  goal_frizz_definition: 'Você quer mais definição e controle de frizz.',
  goal_breakage_strength: 'Você quer reduzir a quebra e fortalecer os fios.',
  goal_damage_recovery: 'Você quer recuperar danos de química ou calor.',
  concern_dryness: 'Você marcou ressecamento.',
  concern_tangling: 'Você marcou que embaraça muito.',
  concern_dullness: 'Você marcou falta de brilho.',
  concern_breakage: 'Você marcou quebra dos fios.',
  concern_frizz: 'Você marcou frizz.',
  chemical_exposure: 'Você faz química no cabelo.',
  frequent_heat: 'Você usa calor com frequência.',
  textured_hair_moisture_support: 'Cabelos com curvatura costumam pedir mais hidratação.',
  wash_frequency_baseline: 'A frequência dos cuidados acompanha a sua rotina de lavagem.',
  balanced_default: 'Sem um sinal predominante, o cronograma começa equilibrado.',
};

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

/**
 * Formats an ISO `YYYY-MM-DD` civil date without touching timezones: the string already IS the
 * user's local day (ADR-008), so it is parsed as plain numbers, never through a Date-with-offset.
 */
export const formatPlannedDate = (isoDate: string): string => {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '';
  return `${weekday}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};
