# Runbook — conceder Premium à usuária de desenvolvimento (DEV)

**Para que serve.** Exercer as capabilities Premium no DEV real (D-90) enquanto o IAP não existe.
Sem uma linha em `subscriptions`, `get_my_entitlements()` devolve `[]` e **nada de Premium é
observável** — foi o que bloqueou a validação do `P2` Hair Intelligence.

⚠️ **Só no projeto DEV.** Nunca em produção. Esta é a porta que o `apply_billing_event` abre para o
provedor real; aqui ela é aberta à mão, e o `provider = 'manual'` existe no `CHECK` exatamente para
que essa origem fique registrada na própria linha.

## Por que SQL direto funciona

`subscriptions` tem `force row level security`, então nem o dono da tabela escapa das policies — mas
existe `subscriptions_owner_all ... for all to postgres`. O **SQL Editor do Supabase roda como
`postgres`**, então o `insert` abaixo passa. O app **não** consegue fazer isto: o cliente tem apenas
`SELECT` (a escrita real entra por `apply_billing_event`, que é `service_role`).

## Onde rodar

Supabase → projeto **`hair-care-dev`** (`ayecidupmxmirwfzwtea`) → **SQL Editor** → New query.

## O comando — conceder

```sql
insert into public.subscriptions (user_id, status, product_code, current_period_ends_at, provider)
values (
  'd6d596a1-4483-4499-96bd-df6b31f47860',  -- dev.preview@haircare.local
  'trial',
  'dev_manual_premium',
  now() + interval '365 days',
  'manual'
)
on conflict (user_id) do update set
  status                 = excluded.status,
  product_code           = excluded.product_code,
  current_period_ends_at = excluded.current_period_ends_at,
  provider               = excluded.provider;
```

## Conferir

```sql
select user_id, status, provider, current_period_ends_at
  from public.subscriptions
 where user_id = 'd6d596a1-4483-4499-96bd-df6b31f47860';
```

Depois, no app (ou por REST autenticado como ela), `get_my_entitlements()` passa a devolver os três
códigos do catálogo: `advanced_insights`, `plan_customization`, `premium_content`.

## Desfazer

```sql
delete from public.subscriptions
 where user_id = 'd6d596a1-4483-4499-96bd-df6b31f47860';
```

Ausência de linha **é** o estado Free (SPEC-010 BR1) — não existe status "free" a escrever.

## ⚠️ Efeito colateral que vale saber

`has_entitlement` concede **os três** códigos de uma vez: ela não separa por produto. Isso significa
que conceder Premium para validar o `P2` **também liga o `plan_customization`** (SPEC-015), e a
`generate-plan` passa a aplicar os dias preferidos dela no posicionamento dos cuidados. Não muda os
tipos de cuidado nem a cadência — o motor continua decidindo isso sozinho (SPEC-015 G3) —, mas as
**datas** podem sair diferentes de um plano gerado no Free. Ao comparar planos antes/depois, é este
o motivo.

## Estado medido em 2026-09-04

`subscriptions` vazia · `get_my_entitlements()` → `[]` · usuária DEV em Free.
