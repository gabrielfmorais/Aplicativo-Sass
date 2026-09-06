-- SPEC-052 (F25, entry point "registro avulso" do Blueprint §9) — a execução avulsa.
--
-- ⚠️ **Não é capability nova: é a última metade de uma que foi entregue pela metade.** O DOMAIN-MAP
-- §3.5 já dizia, desde antes da SPEC-005, que *"execução sem agendamento (ad hoc) é permitida
-- (`scheduled_care_id NULL`, `care_type` obrigatório)"*. Três SPECs adiaram a implementação, cada
-- uma apontando para a seguinte:
--
--   SPEC-005 §8  "nenhum fluxo desta fatia a exige. DEFER."
--   SPEC-006     "check-in avulso — quando aquela voltar."
--   SPEC-024 OQ4 "entra quando execução ad hoc existir."
--
-- O gatilho que as três nomearam chegou: `P2`, `P6`, `P8` e `P13` existem, e os quatro leem só o
-- que o plano propôs. Medido no DEV em 2026-09-06: 14 execuções, 6 com check-in — e **toda** a
-- inteligência do produto pendurada num cuidado que o motor sugeriu.
--
-- ⚠️ **Uma coluna, e a cadeia inteira segue sozinha.** `wash_days`, `checkins`, `checkin_marks`,
-- `wash_day_finish`, `wash_day_products`, `wash_day_techniques` e `wash_day_scalp` já penduram na
-- **execução**, não no plano: nenhuma delas muda uma linha. É por isso que a fonte de verdade proíbe
-- tabela paralela — não há o que ela resolveria.

-- ------------------------------------------------------------------ a coluna deixa de ser obrigatória
--
-- ⚠️ **O que NÃO muda, e cada um por uma razão:**
--
-- * `care_type_code` continua `not null` com o `CHECK` — é ele que carrega a identidade do cuidado
--   quando não há linha de plano de onde tirá-la. Esta é a metade do DOMAIN-MAP que sobrevive.
-- * `care_executions_care_owner_fk` é composta em `(scheduled_care_id, user_id)`. Em `MATCH SIMPLE`
--   (o padrão do Postgres) uma linha com qualquer coluna nula **não é verificada** — o que aqui é o
--   comportamento desejado, e não um furo: não há a que apontar.
-- * `care_executions_one_effective_per_care` é `unique (scheduled_care_id) where voided_at is null`.
--   ⚠️ **O teto de "0 ou 1 execução efetiva" (D-69/D-35) continua valendo inteiro**, porque a chave
--   dele nunca é nula num cuidado planejado; e `NULL` não colide com `NULL` em índice único, então
--   duas avulsas no mesmo dia são dois fatos — que é o certo (SPEC-052 BR2/EC3).
-- * `care_executions_client_unique (user_id, client_execution_id)` continua sendo a idempotência.
--
-- Compatível para trás: nenhuma linha existente muda, e um app antigo nunca produz `NULL` porque só
-- conhece `complete_care`.
alter table public.care_executions
  alter column scheduled_care_id drop not null;

comment on column public.care_executions.scheduled_care_id is
  'SPEC-052: o cuidado do plano que ela cumpriu, ou NULL quando ela registrou por conta (execução avulsa). Nulo aqui obriga care_type_code a carregar o tipo — DOMAIN-MAP §3.5.';

-- ------------------------------------------------------------------------------------ a RPC
--
-- ⚠️ **`SECURITY DEFINER` pela mesma razão do `complete_care`**, e não por conveniência: o dono e o
-- **dia civil dela** são invariantes de servidor (ADR-008). Deixar o cliente mandar a data faria a
-- verdade do histórico depender de um relógio que ele controla — o raciocínio já medido na SPEC-020
-- e na SPEC-040. O cliente continua com apenas `SELECT` em `care_executions`.
--
-- ⚠️ **Idempotente por `client_execution_id`, com a MESMA cláusula de replay concorrente**: dois
-- toques, ou um retry que cruza o original, produzem **um** fato e o mesmo id.
create or replace function public.record_ad_hoc_care(
  p_care_type_code text,
  p_client_execution_id uuid,
  p_timezone text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.care_current_user();
  v_execution_id uuid;
  v_executed_on date;
begin
  if p_client_execution_id is null then
    raise exception 'record_ad_hoc_care: client_execution_id is required' using errcode = '22023';
  end if;

  select id into v_execution_id from public.care_executions
   where user_id = v_user and client_execution_id = p_client_execution_id;
  if v_execution_id is not null then
    return v_execution_id; -- idempotent replay: no second fact, no state change
  end if;

  v_executed_on := public.care_local_today(p_timezone);

  begin
    -- ⚠️ `scheduled_care_id` explicitamente nulo: é o que faz desta linha uma avulsa. O tipo de
    -- cuidado vem do parâmetro e é validado pelo CHECK da tabela — nada de vocabulário novo (D-26).
    insert into public.care_executions
      (user_id, scheduled_care_id, care_type_code, client_execution_id, executed_on)
    values
      (v_user, null, p_care_type_code, p_client_execution_id, v_executed_on)
    returning id into v_execution_id;
  exception when unique_violation then
    -- Retry concorrente com a mesma chave: devolve o que a outra transação criou. A subtransação
    -- desfaz só este insert, nunca a transação de quem chamou.
    select id into v_execution_id from public.care_executions
     where user_id = v_user and client_execution_id = p_client_execution_id;
    if v_execution_id is null then raise; end if;
  end;

  return v_execution_id;
end;
$$;

comment on function public.record_ad_hoc_care(text, uuid, text) is
  'SPEC-052: registra um cuidado que ela fez fora do cronograma. Nao cria linha em scheduled_cares, nao paga ponto (journey_points chaveia no cuidado planejado) e nao conta aderencia.';

revoke all on function public.record_ad_hoc_care(text, uuid, text) from public, anon;
grant execute on function public.record_ad_hoc_care(text, uuid, text) to authenticated;

-- ROLLBACK:
--   drop function if exists public.record_ad_hoc_care(text, uuid, text);
--   -- ⚠️ Restaurar o NOT NULL só é possível se NÃO houver execução avulsa gravada:
--   --   alter table public.care_executions alter column scheduled_care_id set not null;
--   -- Havendo linhas, o rollback correto é remover a porta e a RPC e deixar a coluna anulável,
--   -- que é inócua — apagar as linhas seria destruir histórico que é dela.
