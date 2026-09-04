import { CURRENT_SCHEDULE_VERSION, isKnownScheduleVersion, type ScheduleVersion } from '@app/core';

/**
 * SPEC-046 — **qual motor gera este plano**, decidido no servidor a partir do que o cliente previu.
 *
 * ⚠️ **É o conserto da deriva medida na SPEC-038 OQ4.** O app é binário de loja e a Edge Function
 * versiona à parte, então sem isto uma usuária com app antigo podia **prever um cronograma e
 * receber outro** — a quebra do SPEC-004 AC3 que o `buildPlan` como caminho único existe para
 * impedir. Mandar a versão prevista e o servidor honrá-la é o que faz preview e plano gravado serem
 * o mesmo objeto.
 *
 * Três casos, e os três importam:
 *
 * | o cliente manda | o servidor faz | por quê |
 * |---|---|---|
 * | nada | usa a corrente **dele** | app antigo não conhece o campo; é o comportamento de sempre |
 * | versão conhecida | **usa aquela** | ela recebe o que previu, mesmo que o servidor já ande à frente |
 * | versão desconhecida | **recusa** | app mais novo que o servidor: recusar é honesto, gerar outra coisa não |
 *
 * ⚠️ **Recusar é a decisão difícil, e é a certa.** Cair na versão corrente "para não falhar" era o
 * caminho tentador — e é exatamente a divergência silenciosa que esta função existe para eliminar.
 * Falha **antes** de qualquer escrita, então não sobra plano pela metade.
 *
 * ⚠️ **A allowlist é a mesma tabela de despacho do `buildPlan`** (`isKnownScheduleVersion`), não uma
 * cópia. Duas listas divergiriam no dia em que uma versão nova entrasse só numa delas.
 */
export type VersionDecision =
  { readonly ok: true; readonly version: ScheduleVersion } | { readonly ok: false };

export const resolveScheduleVersion = (raw: unknown): VersionDecision => {
  if (raw === undefined || raw === null) return { ok: true, version: CURRENT_SCHEDULE_VERSION };
  if (typeof raw !== 'string' || !isKnownScheduleVersion(raw)) return { ok: false };
  return { ok: true, version: raw };
};
