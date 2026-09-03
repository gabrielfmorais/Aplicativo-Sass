-- SPEC-040 §7 (F39) — a rotina de óleo.
--
-- > *"Lembrar do óleo. Simples assim."* — Blueprint §23
--
-- Óleo hoje só existe **escondido dentro de Nutrição** — uma categoria da prateleira e uma técnica
-- de pré-lavagem. Para muita gente ele é uma rotina **paralela**, com frequência própria, e uma
-- rotina que o app não conhece é uma rotina que ele não ajuda a manter.
--
-- **Não entra no cronograma** (NG1). O plano é um ciclo de quatro semanas gerado por motor
-- versionado a partir do perfil (SPEC-004/SPEC-038); enfiar o óleo lá dentro faria uma escolha dela
-- virar saída de engine e mudaria o significado de "cuidado planejado".
--
-- ⚠️ **Nada aqui diz o que o óleo faz.** O intervalo é um número de dias que **ela escolhe**, como o
-- `wash_frequency` do perfil — não uma recomendação. Com que frequência ela deveria passar óleo,
-- onde, como, qual e por quê é conteúdo capilar substantivo ⇒ gate D-26/D-70.

create table if not exists public.oil_routines (
  -- Uma rotina por usuária (NG6). Duas não têm consumidor hoje, e a PK sendo o usuário faz o
  -- "ligar de novo" cair num `on conflict do update` em vez de acumular linhas mortas.
  user_id uuid primary key references auth.users (id) on delete cascade,
  every_days smallint not null check (every_days between 1 and 60),
  -- Quando ela começou. **Não reseta ao trocar o intervalo** (§7): a próxima data deriva do último
  -- feito, e a história é dela.
  started_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.oil_routines is
  'SPEC-040 (F39): a rotina de óleo dela — de quantos em quantos dias ela quer lembrar. Intervalo escolhido por ela, nunca recomendado pelo app (D-26).';

create table if not exists public.oil_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- `postponed` é uma resposta legítima, não um fracasso (BR2/D-28): mostrar o estado e pedir ação,
  -- nunca mover sozinho.
  kind text not null check (kind in ('done', 'postponed')),
  happened_on date not null,
  client_event_id uuid not null,
  created_at timestamptz not null default now(),
  -- Idempotência por intenção: o retry depois de uma resposta perdida devolve o mesmo evento, e não
  -- o segundo (FR4/EC3).
  constraint oil_events_client_unique unique (user_id, client_event_id)
);

comment on table public.oil_events is
  'SPEC-040 (F39): o que aconteceu na rotina de óleo — feito ou adiado, no dia civil dela. Append-only pelo cliente: escrita só por record_oil_event.';

create index if not exists oil_events_user_happened_on
  on public.oil_events (user_id, happened_on desc);

alter table public.oil_routines enable row level security;
alter table public.oil_routines force row level security;
alter table public.oil_events enable row level security;
alter table public.oil_events force row level security;

-- **O cliente não escreve nenhuma das duas.** O dia civil depende do fuso dela (ADR-008) e
-- `current_date` no servidor é UTC; deixar o cliente mandar a data faria a verdade do histórico
-- depender de um relógio que ele controla. `DELETE` em `oil_routines` porque desligar a rotina é
-- dela, e apagar a rotina não apaga o histórico (FR2/BR5).
revoke all on public.oil_routines from anon, authenticated;
revoke all on public.oil_events from anon, authenticated;
grant select, delete on public.oil_routines to authenticated;
grant select on public.oil_events to authenticated;

drop policy if exists oil_routines_select_own on public.oil_routines;
create policy oil_routines_select_own on public.oil_routines
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists oil_routines_delete_own on public.oil_routines;
create policy oil_routines_delete_own on public.oil_routines
  for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists oil_routines_owner_all on public.oil_routines;
create policy oil_routines_owner_all on public.oil_routines
  for all to postgres using (true) with check (true);

drop policy if exists oil_events_select_own on public.oil_events;
create policy oil_events_select_own on public.oil_events
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists oil_events_owner_all on public.oil_events;
create policy oil_events_owner_all on public.oil_events
  for all to postgres using (true) with check (true);

/**
 * Liga a rotina, ou troca o intervalo (FR1/FR2).
 *
 * `started_on` só é escrito na criação: trocar a frequência muda a **próxima data** — que deriva do
 * último feito —, não a história. E ele vem do fuso dela, não de `current_date`.
 */
create or replace function public.set_oil_routine(p_every_days smallint, p_timezone text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.care_current_user();
begin
  -- O CHECK da tabela revalida o intervalo; repetir a faixa aqui seria uma segunda fonte de verdade
  -- a divergir da primeira (mesmo raciocínio de `record_hair_event`).
  insert into public.oil_routines (user_id, every_days, started_on)
  values (v_user, p_every_days, public.care_local_today(p_timezone))
  on conflict (user_id) do update
    set every_days = excluded.every_days,
        updated_at = now();
end;
$$;

revoke all on function public.set_oil_routine(smallint, text) from public, anon;
grant execute on function public.set_oil_routine(smallint, text) to authenticated;

/**
 * Registra o que aconteceu: `done` ou `postponed` (FR3/FR4).
 *
 * O dia civil vem do fuso dela e a idempotência é do servidor — as duas pelo mesmo motivo da
 * SPEC-020. `on conflict do nothing` porque o SELECT não fecha a corrida: dois aparelhos, ou um
 * retry cruzando o original, passam os dois pela leitura, e o segundo receberia violação de
 * unicidade para um evento que existe — o pior desfecho possível de uma chave de idempotência.
 */
create or replace function public.record_oil_event(
  p_kind text,
  p_client_event_id uuid,
  p_timezone text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.care_current_user();
  v_event_id uuid;
begin
  if p_client_event_id is null then
    raise exception 'record_oil_event: client_event_id is required' using errcode = '22023';
  end if;

  select id into v_event_id from public.oil_events
   where user_id = v_user and client_event_id = p_client_event_id;
  if v_event_id is not null then
    return v_event_id;
  end if;

  -- Registrar sem rotina não é um evento: é um cliente adulterado, ou uma tela velha de alguém que
  -- acabou de desligar. Recusar aqui evita histórico que nenhuma rotina explica.
  if not exists (select 1 from public.oil_routines where user_id = v_user) then
    raise exception 'record_oil_event: no oil routine' using errcode = 'P0002';
  end if;

  insert into public.oil_events (user_id, kind, happened_on, client_event_id)
  values (v_user, p_kind, public.care_local_today(p_timezone), p_client_event_id)
  on conflict (user_id, client_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select id into v_event_id from public.oil_events
     where user_id = v_user and client_event_id = p_client_event_id;
  end if;

  return v_event_id;
end;
$$;

revoke all on function public.record_oil_event(text, uuid, text) from public, anon;
grant execute on function public.record_oil_event(text, uuid, text) to authenticated;

-- Rollback (sem dado de produção antes do release, SPEC-040 §7):
--   drop function if exists public.record_oil_event(text, uuid, text);
--   drop function if exists public.set_oil_routine(smallint, text);
--   drop table if exists public.oil_events;
--   drop table if exists public.oil_routines;
