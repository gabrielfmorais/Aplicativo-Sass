import { isUuid } from '@app/core';

/**
 * SPEC-046 OQ3 — **qual avaliação gera este plano: a que ela VIU, não a mais recente.**
 *
 * ⚠️ **A deriva que sobrava depois do contrato de versão, e ela é do mesmo tipo.** A função lia
 * sempre a avaliação **mais recente** dela, enquanto o preview foi construído a partir de **uma**
 * avaliação específica. Entre ver o cronograma e confirmá-lo, um segundo aparelho, uma reavaliação
 * abandonada e retomada, ou simplesmente uma aba aberta há mais tempo bastam para as duas serem
 * avaliações diferentes — e aí ela **confirma um cronograma e recebe outro**, que é exatamente o que
 * a SPEC-004 AC3 existe para impedir.
 *
 * ⚠️ **É o *o quê*, não o *quando*.** A avaliação decide **quais** cuidados, **quantos** e com que
 * cadência; trocá-la troca o cronograma inteiro. É por isso que ela é o lado da OQ3 que precisava de
 * conserto — e é por isso que o lado do entitlement **não** se conserta assim (ver abaixo).
 *
 * O desenho é o mesmo do `resolveScheduleVersion`, de propósito: um cliente antigo que não conhece o
 * campo continua funcionando exatamente como antes.
 *
 * | o cliente manda | o servidor faz | por quê |
 * |---|---|---|
 * | nada | usa a avaliação **mais recente** | app antigo não conhece o campo; é o comportamento de sempre |
 * | um id | usa **aquela**, lida com a JWT dela | ela recebe o plano da avaliação que viu |
 * | lixo | **recusa (400)** antes de qualquer escrita | um id malformado não vira "tanto faz" |
 *
 * ⚠️ **Mandar um id não dá acesso a nada.** A leitura é feita com a **JWT dela** sob RLS, então um id
 * de outra pessoa simplesmente **não volta** — e a resposta é 409, não os dados de ninguém. E como
 * `hair_profiles` é imutável e append-only (D-62/D-64), a linha apontada não pode ter mudado entre o
 * preview e a confirmação: fixar o id fixa o conteúdo.
 *
 * ⛔ **O ENTITLEMENT NÃO ENTRA AQUI, e a razão é de segurança, não de escopo.** Deixar o cliente
 * fixar *"eu previ com preferências aplicadas"* seria deixá-lo **conceder a si mesmo** a capability
 * premium — a SPEC-015 FR3 põe essa decisão no servidor justamente para isso. O que sobra dessa
 * borda é limitado por construção: preferências mexem **só em datas** e nunca nos tipos, na
 * quantidade ou na cadência (barreira em `placement.test.ts`). Ou seja, virar premium (ou deixar de
 * ser) entre o preview e a confirmação pode mudar **em que dias** os cuidados caem, e nunca **quais
 * cuidados são** — e a resposta do servidor é, por definição, a correta sobre o direito dela.
 */
export type PinnedProfileDecision =
  { readonly ok: true; readonly hairProfileId: string | null } | { readonly ok: false };

export const resolvePinnedProfile = (raw: unknown): PinnedProfileDecision => {
  if (raw === undefined || raw === null) return { ok: true, hairProfileId: null };
  if (typeof raw !== 'string' || !isUuid(raw)) return { ok: false };
  return { ok: true, hairProfileId: raw };
};
