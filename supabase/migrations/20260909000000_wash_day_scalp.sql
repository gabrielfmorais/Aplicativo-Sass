-- SPEC-025 §8/§10 (F31) — como o couro cabeludo esteve.
--
-- O app pergunta **como ficou o cabelo** (SPEC-006, um toque, 1 a 5) e não pergunta nada sobre o
-- couro cabeludo — que é metade da queixa de quem tem raiz oleosa e pontas secas.
--
-- **Por que aqui e não em `checkins`.** `checkins` é append-only, sem `UPDATE` e sem grant de
-- escrita para o cliente: a única porta é `submit_checkin`. Uma coluna ali só poderia ser
-- preenchida no mesmo instante do check-in — ou a pergunta entra no caminho dele e transforma um
-- toque em dois (regressão no coração do produto), ou ela fica sem resposta para sempre. O hub do
-- Wash Day existe por execução, é opcional, é editável, e foi desenhado para isto (SPEC-024 §8).
--
-- **Por que junção e não coluna no hub.** A coluna era a forma mais natural, e exigiria
-- `grant update (scalp_feel)`. `tests.unapproved_grants()` lê `pg_class.relacl`; um grant de coluna
-- vive em `pg_attribute.attacl`, e **nenhum guardrail do projeto olha para lá** — o privilégio
-- existiria calado, fora do alcance da allowlist, que é pior do que um que ela reprova. `UPDATE` na
-- tabela `wash_days` inteira seria pior ainda: deixaria o cliente reapontar `care_execution_id` e
-- mover o registro de um cuidado para outro.
--
-- ⚠️ **O vocabulário é o de `hair_profiles.scalp_tendency` (SPEC-002), sem `unknown`.** Reaproveitar
-- o conjunto que já passou pelo gate de domínio é o que mantém esta capability fora do D-26.
-- Coceira, descamação, dor, ferida e queda **não** entram: nomear sintoma muda a natureza do dado
-- para saúde, o que exige base legal e a tabela `consents` que não existe (D-32), além de sign-off
-- de domínio (D-26). Duas chaves, e nenhuma delas é do agente (SPEC-025 OQ2).

create table if not exists public.wash_day_scalp (
  -- Uma resposta por Wash Day, e portanto por execução (FR4). A PK é o hub: não existe segunda
  -- linha a desempatar, e trocar de resposta é `on conflict do update`, uma escrita atômica.
  wash_day_id uuid primary key,
  scalp_feel text not null check (
    scalp_feel in (
      'oily_quickly',  -- oleoso rápido
      'balanced',      -- equilibrado
      'dry_tendency'   -- tendência a ressecar
    )
  ),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Posse validada pelo banco nas duas pontas, como nas outras junções do Wash Day: `with check`
  -- olha o dono da linha nova, e só a FK composta olha a quem o **hub** pertence. Sem ela, um
  -- cliente adulterado penduraria a própria resposta no Wash Day de outra pessoa — ninguém leria,
  -- nem a vítima, e ela contaria quando `P2` agregasse por `wash_day_id`.
  constraint wash_day_scalp_hub_owner_fk
    foreign key (wash_day_id, user_id) references public.wash_days (id, user_id) on delete cascade
);

comment on table public.wash_day_scalp is
  'SPEC-025: como o couro cabeludo esteve naquele cuidado, na palavra dela. Vocabulário de hair_profiles.scalp_tendency (SPEC-002), sem sintoma clínico — nenhum valor é melhor que outro, e o app não interpreta.';
comment on column public.wash_day_scalp.scalp_feel is
  'SPEC-025 BR3: observação, não nota. Sem ordem e sem escala — um couro oleoso não é uma nota baixa.';

alter table public.wash_day_scalp enable row level security;
alter table public.wash_day_scalp force row level security;

-- `UPDATE` porque trocar de resposta é uma escrita só; `DELETE` porque tirar a resposta é ela
-- corrigindo o que disse, e um registro sem resposta é um estado válido (EC2).
revoke all on public.wash_day_scalp from anon, authenticated;
grant select, insert, update, delete on public.wash_day_scalp to authenticated;

drop policy if exists wash_day_scalp_select_own on public.wash_day_scalp;
create policy wash_day_scalp_select_own on public.wash_day_scalp
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists wash_day_scalp_insert_own on public.wash_day_scalp;
create policy wash_day_scalp_insert_own on public.wash_day_scalp
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists wash_day_scalp_update_own on public.wash_day_scalp;
create policy wash_day_scalp_update_own on public.wash_day_scalp
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists wash_day_scalp_delete_own on public.wash_day_scalp;
create policy wash_day_scalp_delete_own on public.wash_day_scalp
  for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists wash_day_scalp_owner_all on public.wash_day_scalp;
create policy wash_day_scalp_owner_all on public.wash_day_scalp
  for all to postgres using (true) with check (true);

-- O hub deixa de ser só "o que ela fez": passa a carregar também o que ela **observou**. Sem isto,
-- a próxima coisa a pendurar (`F28` foto, `P21` clima) parece fora do lugar.
comment on table public.wash_days is
  'SPEC-024/SPEC-025: o registro daquele cuidado — o que ela usou, como fez e o que observou. Sem colunas de conteúdo de propósito: produtos, técnicas e couro cabeludo penduram nele, e foto (F28) e clima (P21) vão pendurar depois.';

-- Rollback (sem dado de produção antes do release, SPEC-025 §22):
--   drop table if exists public.wash_day_scalp;
