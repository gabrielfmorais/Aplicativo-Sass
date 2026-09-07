// SPEC-046 OQ3 — a avaliação que ela viu é a que gera o plano.
// Puro, sem rede, sem env. Run: `deno test` em supabase/functions.
import { isUuid } from '@app/core';

import { resolvePinnedProfile } from './pinned-profile.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const UUID = '11111111-1111-4111-8111-111111111111';

// ------------------------------------------------------------------ compatibilidade
// ⚠️ A mesma forma do contrato de versão, e pela mesma razão: o app é binário de loja, então um
// cliente que não conhece o campo tem de continuar funcionando exatamente como antes.
Deno.test('app antigo, que não manda a avaliação, continua funcionando', () => {
  const d = resolvePinnedProfile(undefined);
  assert(d.ok, 'ausente tem de ser aceito');
  assert(d.hairProfileId === null, 'ausente = a avaliação mais recente, o comportamento de sempre');
});

Deno.test('null também é ausência — não é um id inválido', () => {
  const d = resolvePinnedProfile(null);
  assert(d.ok && d.hairProfileId === null, 'null tem de cair no padrão, não recusar');
});

// ------------------------------------------------------------------ contrato
Deno.test('a avaliação que ela previu é a que o servidor usa', () => {
  const d = resolvePinnedProfile(UUID);
  assert(d.ok, 'um uuid é aceito');
  assert(d.hairProfileId === UUID, 'o servidor honra a avaliação prevista');
});

// ------------------------------------------------------------------ falha segura
// ⚠️ Um id malformado não pode virar "tanto faz, usa a mais recente": seria a divergência
// silenciosa entrando pela porta do tratamento de erro.
Deno.test('id malformado é RECUSADO, nunca substituído pela avaliação mais recente', () => {
  for (const v of ['', ' ', 'nope', UUID + 'x', UUID.slice(0, -1), '../etc', "' or 1=1--"]) {
    assert(!resolvePinnedProfile(v).ok, `"${v}" deveria ser recusado`);
  }
});

Deno.test('tipo errado é recusado — não existe coerção aqui', () => {
  for (const v of [1, true, {}, [], { id: UUID }, [UUID]]) {
    assert(!resolvePinnedProfile(v).ok, `${JSON.stringify(v)} deveria ser recusado`);
  }
});

// ⚠️ A validação de forma é a MESMA do resto da fronteira (`isUuid`), não uma regex escrita de novo
// aqui — duas validações de uuid divergiriam, e a divergência apareceria como um id aceito num
// caminho e recusado no outro.
Deno.test('a validação de forma não é uma cópia: é a mesma da fronteira', () => {
  for (const v of [UUID, 'nope', '', UUID.toUpperCase()]) {
    assert(resolvePinnedProfile(v).ok === isUuid(v), `divergência de validação em "${v}"`);
  }
});

// ------------------------------------------------------------------ o que ele NÃO faz
// ⛔ Aceitar o id não é autorizar nada: a leitura acontece com a JWT dela, sob RLS. Aqui a garantia
// verificável é que a decisão **não devolve nada além do id** — nenhum dado de perfil atravessa
// esta fronteira vindo do cliente.
Deno.test('a decisão carrega um id e nada mais — o perfil nunca vem do cliente', () => {
  const d = resolvePinnedProfile(UUID);
  assert(d.ok, 'aceito');
  assert(JSON.stringify(d) === JSON.stringify({ ok: true, hairProfileId: UUID }), 'forma inesperada');
});

Deno.test('a decisão é pura: mesma entrada, mesma saída', () => {
  assert(
    JSON.stringify(resolvePinnedProfile(UUID)) === JSON.stringify(resolvePinnedProfile(UUID)),
    'a decisão não pode depender de estado',
  );
});
