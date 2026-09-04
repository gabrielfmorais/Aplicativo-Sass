// SPEC-046 — o contrato de versão entre cliente e Edge Function (SPEC-038 OQ4).
// Puro, sem rede, sem env. Run: `deno test` em supabase/functions.
import { CURRENT_SCHEDULE_VERSION, isKnownScheduleVersion } from '@app/core';

import { resolveScheduleVersion } from './schedule-version.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// ------------------------------------------------------------------ compatibilidade
Deno.test('app antigo, que não manda versão, continua funcionando', () => {
  const d = resolveScheduleVersion(undefined);
  assert(d.ok, 'ausente tem de ser aceito');
  assert(d.version === CURRENT_SCHEDULE_VERSION, 'ausente = a versão corrente do servidor');
});

Deno.test('null também é ausência — não é uma versão inválida', () => {
  const d = resolveScheduleVersion(null);
  assert(d.ok, 'null tem de cair no padrão, não recusar');
  assert(d.version === CURRENT_SCHEDULE_VERSION, 'null = a versão corrente do servidor');
});

// ------------------------------------------------------------------ contrato
Deno.test('a versão que ela previu é a que o servidor usa', () => {
  const d = resolveScheduleVersion('v1');
  assert(d.ok, 'v1 é conhecida');
  assert(d.version === 'v1', 'o servidor honra a versão prevista');
});

Deno.test('e vale para toda versão da allowlist, não só a corrente', () => {
  for (const v of ['v1', 'v2']) {
    assert(isKnownScheduleVersion(v), `${v} deveria estar na allowlist`);
    const d = resolveScheduleVersion(v);
    assert(d.ok && d.version === v, `${v} deveria ser honrada`);
  }
});

// ------------------------------------------------------------------ falha segura
// ⚠️ Cair na versão corrente "para não falhar" seria exatamente a divergência silenciosa que este
// contrato elimina: ela confirmaria um cronograma e receberia outro.
Deno.test('versão desconhecida é RECUSADA, nunca substituída em silêncio', () => {
  for (const v of ['v3', 'v0', 'V1', 'v1 ', '', 'latest']) {
    assert(!resolveScheduleVersion(v).ok, `"${v}" deveria ser recusada`);
  }
});

Deno.test('tipo errado é recusado — não existe coerção aqui', () => {
  for (const v of [1, true, {}, [], { version: 'v1' }]) {
    assert(!resolveScheduleVersion(v).ok, `${JSON.stringify(v)} deveria ser recusado`);
  }
});

// ⚠️ A allowlist é a MESMA tabela de despacho do `buildPlan`. Duas listas divergiriam no dia em que
// uma versão nova entrasse só numa delas — e a divergência apareceria como plano gerado por um
// motor que o cliente não previu.
Deno.test('a allowlist não é uma cópia: quem ela aceita, o buildPlan sabe executar', () => {
  for (const v of ['v1', 'v2', 'v3', 'nope']) {
    const aceita = resolveScheduleVersion(v).ok;
    assert(aceita === isKnownScheduleVersion(v), `divergência entre allowlist e despacho em "${v}"`);
  }
});

// ------------------------------------------------------------------ idempotência da decisão
Deno.test('a decisão é pura: mesma entrada, mesma saída', () => {
  const a = resolveScheduleVersion('v2');
  const b = resolveScheduleVersion('v2');
  assert(JSON.stringify(a) === JSON.stringify(b), 'a decisão não pode depender de estado');
});

// ------------------------------------------------------------------ o que a resposta afirma
// ⚠️ A resposta devolve a versão **lida do plano gravado**, não a recém-computada. Numa repetição
// idempotente `create_plan_tx` devolve o plano que já existia e preserva a versão dele — responder
// com a computada faria a resposta afirmar uma coisa e o banco guardar outra, que é a divergência
// silenciosa de novo, agora na superfície que existe para eliminá-la.
//
// A forma é verificável aqui; o valor vem do banco e está coberto pela evidência no DEV real.
Deno.test('a decisão nunca inventa uma versão: ou é conhecida, ou é recusa', () => {
  for (const v of [undefined, null, 'v1', 'v2', 'v9', 42]) {
    const d = resolveScheduleVersion(v);
    if (d.ok) {
      assert(isKnownScheduleVersion(d.version), `versão devolvida fora da allowlist: ${d.version}`);
    }
  }
});
