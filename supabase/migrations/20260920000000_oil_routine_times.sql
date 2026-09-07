-- SPEC-053 §8 — a rotina de óleo com vários horários no mesmo dia (evolução do F39).
--
-- > *"Se a usuária quiser 1 horário, pode. Se quiser 3, pode. Se quiser 10, pode. Ela escolhe: dias;
-- > quantos horários; horário de cada ocorrência; editar; remover; ativar/desativar."* — dono, 2026-09-07
--
-- A SPEC-040 entregou a rotina sabendo dizer **em que dia**. Quem passa óleo de manhã e à noite tem
-- uma rotina que o app conhece pela metade — e uma rotina que o app conhece pela metade é uma que
-- ele ajuda a manter pela metade.
--
-- ⚠️ **Nada aqui recomenda frequência, horário ou quantidade.** O horário é calendário dela, como o
-- `wash_frequency` do perfil. Com que frequência ela **deveria** passar óleo é conteúdo capilar
-- substantivo ⇒ gate D-26/D-70.
--
-- ⚠️ **Aditiva por construção:** uma rotina **sem** horários é o estado de todas as rotinas que
-- existem hoje, e continua se comportando exatamente como antes (FR4). Nenhuma linha é invalidada.

create table if not exists public.oil_routine_times (
  id uuid primary key default gen_random_uuid(),
  /**
   * ⚠️ **A FK aponta para `oil_routines`, não para `auth.users`.** Um horário sem rotina é
   * configuração que não descreve nada — e `record_oil_event` já recusa evento sem rotina. Desligar
   * a rotina leva os horários junto (FR8) e **não** leva o histórico, que mora em `oil_events`.
   */
  user_id uuid not null references public.oil_routines (user_id) on delete cascade,
  -- O horário civil dela. `time` e não `timestamptz` de propósito: "12:00" é 12:00 onde ela estiver,
  -- e quem o converte em instante é o agendador, com o fuso dela (ADR-008).
  time_local time not null,
  -- FR3 — desligado, o horário **continua na rotina** e continua podendo ser registrado; só não toca.
  reminder_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- FR7 — o mesmo horário duas vezes não são dois lembretes. O duplo toque cai aqui, e a fronteira
  -- traduz para "você já tem esse horário" (o padrão da SPEC-023).
  constraint oil_routine_times_unique unique (user_id, time_local)
);

comment on table public.oil_routine_times is
  'SPEC-053 (F39): os horários do dia em que ela quer lembrar do óleo. Escolhidos por ela, nunca recomendados pelo app (D-26). Sem horários = o comportamento da SPEC-040.';

create index if not exists oil_routine_times_user
  on public.oil_routine_times (user_id, time_local);

/**
 * SPEC-053 FR5 — qual horário este registro é.
 *
 * ⚠️ **`null` é "registrei o dia"**, que é todo o histórico anterior a esta migration e continua
 * sendo uma resposta legítima — não é ausência de dado a preencher. Sem `DEFAULT`, pela mesma razão
 * do `F35`: default é uma resposta que ninguém deu.
 *
 * ⚠️ **`on delete set null`, nunca cascade:** remover um horário não pode apagar um fato que
 * aconteceu. O passado não se reescreve (D-69).
 */
alter table public.oil_events
  add column if not exists routine_time_id uuid references public.oil_routine_times (id) on delete set null;

alter table public.oil_routine_times enable row level security;
alter table public.oil_routine_times force row level security;

/**
 * ⚠️ **Sem RPC, e o precedente é a SPEC-023 aplicado com o mesmo teste.**
 *
 * `oil_routines` e `oil_events` exigem RPC porque guardam invariante de **servidor**: o dia civil
 * depende do fuso dela (ADR-008) e `current_date` no servidor é UTC, então deixar o cliente mandar a
 * data faria a verdade do histórico depender de um relógio que ele controla.
 *
 * Um **horário do dia** não tem nenhum dos dois: é um `time` que ela escolhe, sem relógio de servidor
 * envolvido, e a duplicidade cai num índice único. Criar uma RPC aqui seria cerimônia sem invariante
 * para proteger — e mais uma função `SECURITY DEFINER` na allowlist sem nada que a justifique.
 */
revoke all on public.oil_routine_times from anon, authenticated;
grant select, insert, update, delete on public.oil_routine_times to authenticated;

drop policy if exists oil_routine_times_select_own on public.oil_routine_times;
create policy oil_routine_times_select_own on public.oil_routine_times
  for select to authenticated using (user_id = (select auth.uid()));

/**
 * `with check` no INSERT e nas duas pontas do UPDATE: `using` decide o que ela **alcança**, e
 * `with check` decide o que ela **deixa gravado**. Sem o segundo, um UPDATE poderia mover a linha
 * para outra dona — o buraco que a SPEC-024 mediu na FK composta do Wash Day.
 */
drop policy if exists oil_routine_times_insert_own on public.oil_routine_times;
create policy oil_routine_times_insert_own on public.oil_routine_times
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists oil_routine_times_update_own on public.oil_routine_times;
create policy oil_routine_times_update_own on public.oil_routine_times
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists oil_routine_times_delete_own on public.oil_routine_times;
create policy oil_routine_times_delete_own on public.oil_routine_times
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists oil_routine_times_owner_all on public.oil_routine_times;
create policy oil_routine_times_owner_all on public.oil_routine_times
  for all to postgres using (true) with check (true);

-- Rollback (sem dado de produção antes do release, SPEC-053 §22):
--   alter table public.oil_events drop column if exists routine_time_id;
--   drop table if exists public.oil_routine_times;
