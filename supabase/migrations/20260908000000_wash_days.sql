-- SPEC-024 §8/§10 (F25) — Wash Day: o que ela realmente fez.
--
-- > **"Wash Day é estrutural. Não é uma tela de anotação, e tratá-la como tal inviabiliza metade do
-- > Premium."** — Blueprint §9
--
-- O produto sabe o que estava **planejado** e se ela **fez**. Não sabe **o que ela fez de fato** —
-- quais produtos, com que técnica. É esse meio que `P5`, `P6`, `P8` e a Hair Intelligence vão ler.
--
-- **Nenhum campo de texto livre, em lugar nenhum.** É a decisão mais importante do arquivo. Texto
-- livre é fácil agora e **não se compara nem se agrega** — destruiria `P5`, `P6`, `P7` e `P8`.
-- Produtos vêm da prateleira dela (`products`, SPEC-023); técnicas vêm de enum fechado. A razão de
-- privacidade e a de produto são, aqui, a mesma decisão.
--
-- **O hub não tem coluna de conteúdo.** Produtos e técnicas penduram nele; couro cabeludo (`F31`),
-- foto (`F28`) e clima (`P21`) vão pendurar depois. Cada um chega numa fatia diferente, e um hub
-- magro aceita cada uma **sem mexer nas anteriores** — um hub gordo obriga a mexer nele toda vez.
--
-- **Não repete o que já existe.** *"Como ficou"* é o check-in (SPEC-006), ancorado na **mesma**
-- execução. Duplicar aqui criaria duas verdades sobre a mesma coisa.

/**
 * A FK de posse desta SPEC aponta para `(products.id, products.user_id)`, e uma FK composta exige
 * chave única no alvo. `products` nasceu sem ela porque ninguém a referenciava — exatamente como
 * `care_executions`, que ganhou a sua quando `checkins` precisou (SPEC-006). Mesmo precedente,
 * mesma solução: aditiva, e nenhuma linha existente muda.
 */
alter table public.products drop constraint if exists products_id_user_unique;
alter table public.products add constraint products_id_user_unique unique (id, user_id);

create table if not exists public.wash_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  care_execution_id uuid not null,
  created_at timestamptz not null default now(),
  -- Um registro por execução (FR4): voltar ao mesmo cuidado **edita**, nunca cria o segundo. É o
  -- que torna o `upsert` do cliente idempotente sem precisar de RPC.
  constraint wash_days_execution_unique unique (care_execution_id),
  -- Como em `checkins`: o banco recusa um registro cujo dono difira do dono da execução. E o
  -- `on delete cascade` é o que faz BR5 acontecer sozinho — anular uma execução leva o registro
  -- junto para o passado, sem nenhuma regra de aplicação para lembrar disso.
  constraint wash_days_execution_owner_fk
    foreign key (care_execution_id, user_id) references public.care_executions (id, user_id)
    on delete cascade,
  -- Alvo das FKs de posse das junções abaixo. Sem isto, `with check (user_id = auth.uid())` sozinho
  -- deixaria um cliente adulterado pendurar a **própria** linha no Wash Day de **outra pessoa**:
  -- a policy só olha o `user_id` da linha nova, não a quem o hub pertence. Ninguém leria essa linha
  -- — nem a vítima — mas ela contaria quando `P8` agregasse por `wash_day_id`.
  constraint wash_days_id_user_unique unique (id, user_id)
);

comment on table public.wash_days is
  'SPEC-024: o hub do que ela realmente fez num cuidado. Sem colunas de conteúdo de propósito — produtos, técnicas e, depois, couro cabeludo, foto e clima penduram nele.';

create index if not exists wash_days_user_created_at
  on public.wash_days (user_id, created_at desc);

/**
 * Os produtos usados. Junção pura: sem quantidade, sem ordem, sem observação — nenhum deles tem
 * consumidor hoje (D-47/D-48), e ordem em particular é OQ5.
 *
 * `product_id` **não** tem cascade de exclusão porque `products` não permite DELETE: um produto sai
 * da prateleira por `archived_at`, e continua aparecendo aqui. O uso aconteceu (SPEC-023 BR4).
 */
create table if not exists public.wash_day_products (
  wash_day_id uuid not null,
  product_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wash_day_id, product_id),
  -- Integridade de posse pelo banco, nas **duas** pontas: o produto é dela, e o Wash Day também.
  constraint wash_day_products_owner_fk
    foreign key (product_id, user_id) references public.products (id, user_id) on delete cascade,
  constraint wash_day_products_hub_owner_fk
    foreign key (wash_day_id, user_id) references public.wash_days (id, user_id) on delete cascade
);

/**
 * As técnicas. **Junção, não `text[]`** (OQ1): o array é mais barato hoje e mais caro exatamente
 * onde a promessa do Premium está — `P8` consulta *técnica × produto × resultado*, e isso é `join`.
 *
 * ⚠️ **O vocabulário nomeia o que ela FAZ, nunca o que aquilo PROVOCA.** "Umectação" é um
 * procedimento; "selar as cutículas" seria afirmação capilar e jogaria a capability no gate D-26
 * (OQ3). Cada valor abaixo passou por esse critério, e acrescentar um é mudança de produto.
 */
create table if not exists public.wash_day_techniques (
  wash_day_id uuid not null,
  technique text not null check (
    technique in (
      'pre_wash_oil',        -- umectação antes da lavagem
      'scalp_massage',       -- massagem no couro cabeludo
      'double_cleanse',      -- lavou duas vezes
      'co_wash',             -- lavou só com condicionador
      'left_on_longer',      -- deixou agir mais tempo
      'cold_rinse',          -- enxaguou com água fria
      'detangled_with_fingers',
      'wide_tooth_comb',
      'air_dried',           -- secou ao ar
      'blow_dried',          -- secou com secador
      'heat_protectant',     -- usou protetor térmico
      'scrunched',           -- amassou os fios
      'diffuser',
      'protective_style'     -- prendeu em penteado de proteção
    )
  ),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wash_day_id, technique),
  -- Mesma razão de `wash_day_products`: a policy valida o dono da linha, e só a FK composta
  -- valida o dono do **hub**.
  constraint wash_day_techniques_hub_owner_fk
    foreign key (wash_day_id, user_id) references public.wash_days (id, user_id) on delete cascade
);

alter table public.wash_days enable row level security;
alter table public.wash_days force row level security;
alter table public.wash_day_products enable row level security;
alter table public.wash_day_products force row level security;
alter table public.wash_day_techniques enable row level security;
alter table public.wash_day_techniques force row level security;

-- **`DELETE` nas junções é correto, e só nelas.** Desmarcar um produto é ela corrigindo o que
-- marcou, não apagando histórico — o registro do dia continua, sem aquela linha. O hub não tem
-- DELETE: ele morre com a execução, por cascade.
revoke all on public.wash_days from anon, authenticated;
revoke all on public.wash_day_products from anon, authenticated;
revoke all on public.wash_day_techniques from anon, authenticated;
grant select, insert on public.wash_days to authenticated;
grant select, insert, delete on public.wash_day_products to authenticated;
grant select, insert, delete on public.wash_day_techniques to authenticated;

drop policy if exists wash_days_select_own on public.wash_days;
create policy wash_days_select_own on public.wash_days
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists wash_days_insert_own on public.wash_days;
create policy wash_days_insert_own on public.wash_days
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists wash_days_owner_all on public.wash_days;
create policy wash_days_owner_all on public.wash_days
  for all to postgres using (true) with check (true);

drop policy if exists wash_day_products_select_own on public.wash_day_products;
create policy wash_day_products_select_own on public.wash_day_products
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists wash_day_products_insert_own on public.wash_day_products;
create policy wash_day_products_insert_own on public.wash_day_products
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists wash_day_products_delete_own on public.wash_day_products;
create policy wash_day_products_delete_own on public.wash_day_products
  for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists wash_day_products_owner_all on public.wash_day_products;
create policy wash_day_products_owner_all on public.wash_day_products
  for all to postgres using (true) with check (true);

drop policy if exists wash_day_techniques_select_own on public.wash_day_techniques;
create policy wash_day_techniques_select_own on public.wash_day_techniques
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists wash_day_techniques_insert_own on public.wash_day_techniques;
create policy wash_day_techniques_insert_own on public.wash_day_techniques
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists wash_day_techniques_delete_own on public.wash_day_techniques;
create policy wash_day_techniques_delete_own on public.wash_day_techniques
  for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists wash_day_techniques_owner_all on public.wash_day_techniques;
create policy wash_day_techniques_owner_all on public.wash_day_techniques
  for all to postgres using (true) with check (true);

-- Rollback (sem dado de produção antes do release, SPEC-024 §22):
--   drop table if exists public.wash_day_techniques;
--   drop table if exists public.wash_day_products;
--   drop table if exists public.wash_days;
