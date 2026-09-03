-- SPEC-039 §7 (F37) — a finalização é uma etapa, e agora ela existe no modelo.
--
-- O fluxo canônico é `LAVOU → TRATAMENTO → FINALIZAÇÃO → RESULTADO/CHECK-IN` (Blueprint §22,
-- D-102). Até aqui ele existia no Blueprint e em mais nenhum lugar: entre o tratamento (SPEC-005) e
-- o resultado (SPEC-006) não havia nada — e é ali que mora boa parte do que decide como o cabelo
-- dela fica.
--
-- ⚠️ **Esta migration não cria vocabulário de finalização.** `done`/`skipped` dizem se a etapa
-- aconteceu, e isso é o mesmo tipo de fato que "fiz o cuidado". **Quais** finalizações, como fazer e
-- "recomendadas para o seu cabelo" são conteúdo capilar substantivo ⇒ `F38`, atrás do gate
-- D-26/D-70. A linha está no §2 da SPEC.
--
-- **A fusão que a D-102 proibiu já tinha começado sozinha.** Seis das catorze `wash_day_techniques`
-- são movimentos de finalização (`air_dried`, `blow_dried`, `diffuser`, `scrunched`,
-- `heat_protectant`, `protective_style`), e o `CHECK` de lá aceitaria um valor novo de finalização
-- sem erro nenhum. Elas **ficam onde estão** — reclassificar reescreveria o registro que já é dela
-- (SPEC-024 BR3) —, e a barreira do §8 é o que impede a lista de crescer por aquele lado.
--
-- **Por que uma tabela e não uma coluna no hub.** A mesma razão medida na SPEC-025 §8: a coluna
-- exigiria `grant update (finish_status)`, que vive em `pg_attribute.attacl`, e nenhum guardrail do
-- projeto olha para lá — o privilégio existiria calado, fora do alcance da allowlist. `UPDATE` na
-- tabela `wash_days` inteira seria pior: deixaria o cliente reapontar `care_execution_id` e mover o
-- registro de um cuidado para outro.

create table if not exists public.wash_day_finish (
  -- Uma resposta por Wash Day, e portanto por execução (FR1/FR6). A PK é o hub: não existe segunda
  -- linha a desempatar, trocar de resposta é `on conflict do update` — uma escrita atômica — e o
  -- toque repetido, o retry depois de resposta perdida e o segundo aparelho caem todos na mesma
  -- linha.
  wash_day_id uuid primary key,
  finish_status text not null check (
    finish_status in (
      'done',    -- finalizou
      'skipped'  -- pulou a finalização dessa vez
    )
  ),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Posse validada pelo banco nas duas pontas, como nas outras junções do Wash Day (FR7): o
  -- `with check` olha o dono da linha nova, e só a FK composta olha a quem o **hub** pertence. Sem
  -- ela, um cliente adulterado penduraria a própria resposta no Wash Day de outra pessoa — ninguém
  -- leria, nem a vítima, e ela contaria quando o `P8` agregasse por `wash_day_id`.
  constraint wash_day_finish_hub_owner_fk
    foreign key (wash_day_id, user_id) references public.wash_days (id, user_id) on delete cascade
);

comment on table public.wash_day_finish is
  'SPEC-039 (F37): a etapa de finalização daquela execução — feita ou pulada. Sem vocabulário de técnica: quais finalizações e como fazer são o F38, atrás do gate D-26/D-70.';
comment on column public.wash_day_finish.finish_status is
  'SPEC-039 BR1: "skipped" é uma resposta dela; a ausência de linha é "ainda não disse". Sem DEFAULT de propósito — default é uma resposta que ninguém deu.';

alter table public.wash_day_finish enable row level security;
alter table public.wash_day_finish force row level security;

-- `UPDATE` porque trocar de resposta é uma escrita só; `DELETE` porque tirar a resposta e voltar a
-- "ainda não disse" é um estado válido e é dela (FR8).
revoke all on public.wash_day_finish from anon, authenticated;
grant select, insert, update, delete on public.wash_day_finish to authenticated;

drop policy if exists wash_day_finish_select_own on public.wash_day_finish;
create policy wash_day_finish_select_own on public.wash_day_finish
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists wash_day_finish_insert_own on public.wash_day_finish;
create policy wash_day_finish_insert_own on public.wash_day_finish
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists wash_day_finish_update_own on public.wash_day_finish;
create policy wash_day_finish_update_own on public.wash_day_finish
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists wash_day_finish_delete_own on public.wash_day_finish;
create policy wash_day_finish_delete_own on public.wash_day_finish
  for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists wash_day_finish_owner_all on public.wash_day_finish;
create policy wash_day_finish_owner_all on public.wash_day_finish
  for all to postgres using (true) with check (true);

-- O hub passa a carregar as **etapas** do processo, e não só o que ela usou e observou. É a mesma
-- razão de o `wash_days` ter nascido sem coluna de conteúdo: cada coisa chega numa fatia diferente,
-- e um hub magro aceita a próxima sem mexer nas anteriores. A próxima é o `F48` — os produtos da
-- finalização penduram na linha desta tabela, não numa coluna dela.
comment on table public.wash_days is
  'SPEC-024/025/039: o registro daquele cuidado — o que ela usou, como fez, o que observou e se finalizou. Sem colunas de conteúdo de propósito: produtos, técnicas, couro cabeludo e finalização penduram nele, e foto (F28), clima (P21) e produtos por etapa (F48) vão pendurar depois.';

-- Rollback (sem dado de produção antes do release, SPEC-039 §7):
--   drop table if exists public.wash_day_finish;
