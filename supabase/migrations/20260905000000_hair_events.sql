-- SPEC-020 §8/§10 (F23) — `hair_events`: o que mudou no cabelo dela, e quando.
--
-- **Por que esta tabela existe.** O MASTER PRODUCT BLUEPRINT §6 nomeia o maior risco do produto:
-- ela descolore o cabelo numa sexta e o cronograma de segunda continua o mesmo, montado para um
-- cabelo que não existe mais — e o app nem sabe. A reavaliação (SPEC-014) já resolve o cronograma;
-- o que faltava era o momento em que ela conta, e o registro de que contou.
--
-- **O Free registra; não interpreta.** Nenhuma regra aqui lê `event_type` para decidir coisa
-- alguma. Ele é um fato declarado por ela, e é isso que mantém a capability fora do gate de domínio
-- (D-26/D-70): a tabela não sabe o que descoloração faz com cabelo, e não deve saber.
--
-- **Sem texto livre**, de propósito (SPEC-020 NG5): seria a primeira PII de forma livre do produto,
-- sem consumidor, e mudaria a postura de privacidade inteira (DATA-MODEL §4).
--
-- **Sem FK para plano ou cuidado.** O evento é sobre o cabelo dela, não sobre uma linha do
-- cronograma. Amarrá-lo a um plano o faria desaparecer na próxima substituição — o oposto do
-- objetivo, que é justamente sobreviver às substituições e explicar as viradas do histórico.

create table if not exists public.hair_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Enum fechado, validado aqui e em zod (P07). Ampliar esta lista é mudança de produto, não de
  -- implementação: cada valor é uma palavra que a interface mostra a ela.
  event_type text not null check (
    event_type in (
      'chemical_treatment',
      'coloring',
      'bleaching_or_highlights',
      'haircut',
      'intense_heat',
      'beach_or_pool',
      'braids_or_protective_style',
      'care_pause',
      'noticed_change'
    )
  ),
  -- O dia civil **dela** (ADR-008). Validado como não-futuro pela RPC, que é quem conhece o fuso.
  occurred_on date not null,
  -- Idempotência por intenção, como `client_execution_id` (SPEC-005): dois toques no mesmo botão
  -- registram um evento, e um retry depois de resposta perdida não cria o segundo.
  client_event_id uuid not null,
  -- Anulado por engano. A linha **fica** — mesma decisão de `care_executions.voided_at` (D-12/D-69):
  -- o histórico nunca é apagado, só marcado.
  voided_at timestamptz null,
  created_at timestamptz not null default now()
);

comment on table public.hair_events is
  'SPEC-020: eventos que a usuária declara sobre o próprio cabelo (química, corte, praia, pausa…). Registro, nunca interpretação — nenhuma regra do produto lê event_type para decidir cuidado.';

create unique index if not exists hair_events_client_event_id_key
  on public.hair_events (user_id, client_event_id);

create index if not exists hair_events_user_occurred_idx
  on public.hair_events (user_id, occurred_on desc, created_at desc);

alter table public.hair_events enable row level security;
alter table public.hair_events force row level security;

-- Leitura da própria linha, e **nada** de escrita: toda escrita passa pelas RPCs abaixo, porque o
-- dia civil e a idempotência são invariantes de servidor. Sem DELETE, para ninguém e nunca.
revoke all on public.hair_events from anon, authenticated;
grant select on public.hair_events to authenticated;

drop policy if exists hair_events_select_own on public.hair_events;
create policy hair_events_select_own on public.hair_events
  for select to authenticated
  using (user_id = (select auth.uid()));

-- FORCE row level security vale também para o dono da tabela.
drop policy if exists hair_events_owner_all on public.hair_events;
create policy hair_events_owner_all on public.hair_events
  for all to postgres using (true) with check (true);

/**
 * Registra um evento. `SECURITY DEFINER` por duas razões, e só por elas:
 *
 * 1. **O dia civil é decisão do servidor.** "Não pode ser no futuro" precisa do fuso dela, que
 *    viaja na chamada (ADR-008) — e `care_local_today` já valida e limita o fuso recebido (T22).
 * 2. **A idempotência é do servidor.** Um cliente adulterado não pode duplicar um evento, e um
 *    retry depois de resposta perdida tem de devolver o mesmo fato.
 *
 * O `user_id` **não é parâmetro**: vem de `auth.uid()`. Um cliente adulterado não escreve para
 * outra pessoa porque não tem como nomeá-la.
 */
create or replace function public.record_hair_event(
  p_event_type text,
  p_occurred_on date,
  p_client_event_id uuid,
  p_timezone text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.care_current_user();
  v_today date;
  v_event_id uuid;
begin
  if p_client_event_id is null then
    raise exception 'record_hair_event: client_event_id is required' using errcode = '22023';
  end if;

  -- Replay idempotente: mesma intenção, mesma linha, nenhuma segunda escrita (FR7/EC3/EC4).
  select id into v_event_id from public.hair_events
   where user_id = v_user and client_event_id = p_client_event_id;
  if v_event_id is not null then
    return v_event_id;
  end if;

  if p_occurred_on is null then
    raise exception 'record_hair_event: occurred_on is required' using errcode = '22023';
  end if;

  -- Um evento é algo que **aconteceu**. Data futura é recusada aqui, não só na tela (AC2).
  v_today := public.care_local_today(p_timezone);
  if p_occurred_on > v_today then
    raise exception 'record_hair_event: occurred_on cannot be in the future' using errcode = '22023';
  end if;

  -- O tipo é revalidado pelo CHECK da tabela; deixar o constraint falhar aqui é deliberado — uma
  -- segunda lista de valores nesta função seria uma segunda fonte de verdade a divergir.
  --
  -- `on conflict do nothing` porque o SELECT acima **não** fecha a corrida: dois aparelhos, ou um
  -- retry cruzando o original, passam os dois pela leitura e chegam os dois aqui. Sem isto, o
  -- segundo receberia violação de unicidade e a tela diria "não foi possível registrar" para um
  -- evento que existe — que é o pior desfecho possível de uma chave de idempotência.
  insert into public.hair_events (user_id, event_type, occurred_on, client_event_id)
  values (v_user, p_event_type, p_occurred_on, p_client_event_id)
  on conflict (user_id, client_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select id into v_event_id from public.hair_events
     where user_id = v_user and client_event_id = p_client_event_id;
  end if;

  return v_event_id;
end;
$$;

/**
 * Anula um evento registrado por engano. A linha continua no banco (BR6) — some da lista, não do
 * histórico. Evento alheio e evento inexistente dão a **mesma** resposta: quem pergunta não
 * descobre se a linha existe.
 */
create or replace function public.void_hair_event(p_event_id uuid) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.care_current_user();
  v_affected int;
begin
  update public.hair_events
     set voided_at = now()
   where id = p_event_id
     and user_id = v_user
     and voided_at is null;

  get diagnostics v_affected = row_count;
  if v_affected = 0 then
    raise exception 'void_hair_event: event not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.record_hair_event(text, date, uuid, text) from public, anon;
grant execute on function public.record_hair_event(text, date, uuid, text) to authenticated;
revoke all on function public.void_hair_event(uuid) from public, anon;
grant execute on function public.void_hair_event(uuid) to authenticated;

-- Rollback (sem dado de produção antes do release, SPEC-020 §22):
--   drop function if exists public.void_hair_event(uuid);
--   drop function if exists public.record_hair_event(text, date, uuid, text);
--   drop table if exists public.hair_events;
