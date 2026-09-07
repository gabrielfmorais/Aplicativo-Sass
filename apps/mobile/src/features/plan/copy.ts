import type { CareTypeCode, EvidenceCode } from '@app/core';

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
  restoration: 'Restauração',
};

/**
 * ⚠️ **A chave é `EvidenceCode`, e não `string` — a tipagem É a barreira.**
 *
 * Com a chave solta, um código sem rótulo compilava, e as duas superfícies que leem este mapa caem
 * num `?? code`: o preview e o "Por que este cronograma?" mostrariam o identificador em snake_case
 * para a usuária. Agora acrescentar um código ao motor sem escrever a frase dele é erro de
 * compilação, que é onde esse defeito custa menos.
 */
export const EVIDENCE_LABEL: Record<EvidenceCode, string> = {
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
  /**
   * ⚠️ **Era *"Cabelos com curvatura costumam pedir mais hidratação."*, e a auditoria do motor
   * mediu que a frase afirma uma influência que não existe.**
   *
   * Ela aparece em 960 dos 307.200 perfis do espaço de respostas — só quando objetivo e queixas não
   * decidiram nada (prioridade 3 da avaliação). Nesses **960**, o cronograma que o motor **v1** — o
   * que toda usuária real recebe — produz é **idêntico** ao de um perfil de cabelo liso com as
   * mesmas outras respostas: no v1 a ênfase só escolhe qual eixo **abre** o ciclo, e `hydration` e
   * `balanced` abrem os dois por hidratação. **960 de 960, zero diferença.**
   *
   * Dizer "costumam pedir mais hidratação" ao lado de um cronograma que não tem mais hidratação é o
   * que a SPEC-017 FR4 proíbe — explicação plausível e errada é pior que nenhuma —, e é também a
   * única alegação capilar **causal** deste mapa, sem revisor de domínio (D-26/D-70).
   *
   * A correção é a menor possível e não toca motor nenhum (o v1 é imutável, ADR-001 §2): a frase
   * volta à forma **observacional** das outras treze, dizendo o que ela respondeu em vez do que o
   * cabelo dela precisaria. No v2 a curvatura muda mesmo a proporção (588 dos 960), e a frase
   * continua verdadeira lá — porque não afirma efeito em versão nenhuma.
   */
  textured_hair_moisture_support: 'Você marcou que seu cabelo tem curvatura.',
  wash_frequency_baseline: 'A frequência dos cuidados acompanha a sua rotina de lavagem.',
  balanced_default: 'Sem um sinal predominante, o cronograma começa equilibrado.',
};

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

const WEEKDAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/**
 * A data por extenso, para quando ela é o **título** da tela e não uma etiqueta.
 *
 * ⚠️ **Mesma regra de fuso do formato curto:** a string ISO já **é** o dia civil dela (ADR-008),
 * então é lida como números puros e nunca por um Wed, Sep  2, 2026  9:36:24 PM com deslocamento. Um
 * aqui traria o fuso do aparelho de volta para dentro de um dado que já não tem fuso.
 */
export const formatLongDate = (isoDate: string): string => {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const weekday = WEEKDAYS_LONG[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '';
  return `${weekday}, ${d} de ${MONTHS[m - 1] ?? ''}`;
};

/**
 * Formats an ISO `YYYY-MM-DD` civil date without touching timezones: the string already IS the
 * user's local day (ADR-008), so it is parsed as plain numbers, never through a Date-with-offset.
 */
export const formatPlannedDate = (isoDate: string): string => {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '';
  return `${weekday}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};
