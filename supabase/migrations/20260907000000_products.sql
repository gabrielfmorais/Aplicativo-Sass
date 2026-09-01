-- SPEC-023 §8/§10 (F26) — `products`: a prateleira dela, e nada além dela.
--
-- **O problema, do Blueprint §10.** *"Ela tem doze produtos no banheiro e não sabe quais estão
-- ajudando. Compra mais."* O app não pode responder isso sem saber o que ela usa — e não pode saber
-- sem que registrar seja fácil e gratuito.
--
-- **Não é loja e não é catálogo.** Catálogo global é `P18`. Aqui ela cadastra o que tem, do jeito
-- que chama. Nada nesta tabela guarda composição, indicação, preço, marca, benefício ou link, e a
-- razão é a mesma de sempre: o app **não sabe** nada disso, e inventar seria pior que não ter.
--
-- **Por que texto livre aqui, e não na SPEC-020.** Lá o texto seria PII **sem consumidor**. Aqui o
-- nome **é** o produto — sem ele não há prateleira — e um vocabulário fechado de nomes de produto
-- seria justamente o catálogo global que `P18` reserva. Oitenta caracteres e nenhum outro campo
-- aberto mantêm o dado do tamanho de um nome, não de um diário.
--
-- **Sem RPC**, ao contrário de `hair_events` e `plan_pauses`: esta linha não guarda invariante de
-- servidor. Não há dia civil a decidir nem idempotência a garantir — o duplo toque cai no índice
-- único. A posse é RLS mais `with check`, como em `profiles` e `plan_preferences`.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- **PII** — como ela chama o produto dela. O app não normaliza, não corrige e não completa.
  name text not null,
  -- Organização de prateleira, **não afirmação capilar**: nenhum valor diz para que serve ou o que
  -- faz. É o que mantém esta capability fora do gate de domínio (D-26/D-70).
  category text not null check (
    category in ('shampoo', 'conditioner', 'mask', 'leave_in', 'oil', 'styler', 'other')
  ),
  -- Fora da prateleira, não fora do banco (BR4/D-69): um produto já usado precisa continuar
  -- existindo para o uso continuar fazendo sentido quando o Wash Day (`F25`) chegar.
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint products_name_length check (char_length(name) between 1 and 80),
  constraint products_name_not_blank check (btrim(name) <> '')
);

comment on table public.products is
  'SPEC-023: a prateleira da usuária — o que ela possui, do jeito que ela chama. Não é catálogo (P18) e não guarda composição, preço, marca ou benefício.';
comment on column public.products.name is
  'PII — nome escolhido pela usuária. Texto livre justificado: o nome é o produto, e um vocabulário fechado de nomes seria o catálogo global que P18 reserva.';

-- **Um produto ativo por nome.** Resolve o duplo toque sem chave de idempotência, e o `where`
-- parcial ainda permite recadastrar o mesmo nome depois de arquivar (EC5). `lower()` porque
-- "Shampoo X" e "shampoo x" são o mesmo vidro no banheiro dela.
create unique index if not exists products_active_name_per_user
  on public.products (user_id, lower(name)) where archived_at is null;

create index if not exists products_user_created_at
  on public.products (user_id, created_at desc);

alter table public.products enable row level security;
alter table public.products force row level security;

-- A própria prateleira, e mais nada. **Sem DELETE:** arquivar é UPDATE, e a linha morre por cascade
-- junto com a conta.
revoke all on public.products from anon, authenticated;
grant select, insert, update on public.products to authenticated;

drop policy if exists products_select_own on public.products;
create policy products_select_own on public.products
  for select to authenticated
  using (user_id = (select auth.uid()));

-- `with check` é o que impede um cliente adulterado de escrever na prateleira de outra pessoa.
drop policy if exists products_insert_own on public.products;
create policy products_insert_own on public.products
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists products_update_own on public.products;
create policy products_update_own on public.products
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- FORCE row level security vale também para o dono da tabela.
drop policy if exists products_owner_all on public.products;
create policy products_owner_all on public.products
  for all to postgres using (true) with check (true);

-- Rollback (sem dado de produção antes do release, SPEC-023 §22):
--   drop table if exists public.products;
