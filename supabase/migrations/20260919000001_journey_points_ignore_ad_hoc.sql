-- SPEC-052 — ⚠️ **BLOCKER medido no DEV real: a execução avulsa QUEBRAVA a Jornada inteira.**
--
-- `award_journey_points` grava `fact_id = e.scheduled_care_id` nos **três** blocos (cuidado
-- atendido, check-in, wash day) — foi assim que a SPEC-043 consertou o pagamento duplo, ancorando o
-- ponto no **cuidado planejado** em vez de na linha de execução.
--
-- Com `scheduled_care_id` anulável (SPEC-052), uma execução avulsa faz esse `select` produzir
-- `fact_id = NULL`, e `journey_points.fact_id` é `not null`. Medido contra o DEV depois de registrar
-- **um** cuidado avulso:
--
--   400  23502  "Failing row contains (…, care_execution, null, 10, v1, 2026-09-06, …)"
--
-- ⚠️ **E o estrago não é o ponto que falta: é a função inteira que passa a lançar.** Um único
-- registro avulso fazia ela **parar de ganhar pontos pelos cuidados do PLANO** também — a Jornada
-- congelava em silêncio, e nada na tela diria por quê.
--
-- ⚠️ **Nenhum teste via, e o motivo importa.** O pgTAP da SPEC-052 perguntava *"quantos pontos
-- apontam para uma avulsa?"* e recebia **zero** — verdade, porque a função **abortou antes de
-- inserir qualquer coisa**. Uma asserção que passa quando o sistema falha é pior que nenhuma. Ela
-- passou a exigir que a função **conclua** e que os pontos dos cuidados planejados continuem sendo
-- concedidos com a avulsa presente.
--
-- **A correção diz a regra em vez de contorná-la:** só o **cuidado planejado** paga. A avulsa não
-- tem um, então não há o que conceder — que é exatamente a proibição que abre a D-103, *"nenhum
-- incentivo a fazer mais cuidados"*, agora dita pelo `where` em vez de acontecer por acidente.
--
-- Sem backfill: as linhas existentes já apontam para cuidados planejados (migration
-- `20260916000000`), e nenhuma avulsa chegou a virar ponto — a função nunca completou.

create or replace function public.award_journey_points(p_timezone text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.care_current_user();
  v_today date := public.care_local_today(p_timezone);
  v_version text := 'v1';
  v_awarded integer := 0;
begin
  /**
   * ⚠️ **`fact_id` é o CUIDADO PLANEJADO em todos os três.** É a chave que faz o teto ser o plano:
   * quantas execuções aquele cuidado teve não importa, ele paga uma vez.
   *
   * `distinct` porque uma execução anulada e refeita dá **duas** linhas apontando para o mesmo
   * cuidado planejado; sem ele, o `insert ... select` tentaria inserir a mesma chave duas vezes na
   * mesma instrução, e `on conflict` não protege contra conflito **dentro** do próprio comando.
   *
   * ⚠️ **E `scheduled_care_id is not null` (SPEC-052) é a regra, não uma defesa contra NULL:** a
   * execução **avulsa** não tem cuidado planejado, então não há o que pagar. Sem esta linha a
   * função lançava `23502` e a Jornada parava por inteiro — medido no DEV.
   */
  with novos as (
    insert into public.journey_points (user_id, fact_kind, fact_id, points, rules_version, awarded_on)
    select distinct v_user, 'care_execution', e.scheduled_care_id, 10, v_version, v_today
      from public.care_executions e
     where e.user_id = v_user
       and e.voided_at is null
       and e.scheduled_care_id is not null
    on conflict (user_id, fact_kind, fact_id) do nothing
    returning 1
  )
  select v_awarded + count(*) into v_awarded from novos;

  -- Contou como ficou (SPEC-006). Atravessa a execução para chegar ao cuidado planejado, e ignora
  -- check-in pendurado em execução anulada — ela desfez aquilo. ⚠️ E em execução avulsa: o check-in
  -- dela é registro legítimo e vale para a Hair Intelligence, mas não é aderência ao plano.
  with novos as (
    insert into public.journey_points (user_id, fact_kind, fact_id, points, rules_version, awarded_on)
    select distinct v_user, 'checkin', e.scheduled_care_id, 5, v_version, v_today
      from public.checkins c
      join public.care_executions e on e.id = c.care_execution_id
     where c.user_id = v_user
       and e.voided_at is null
       and e.scheduled_care_id is not null
    on conflict (user_id, fact_kind, fact_id) do nothing
    returning 1
  )
  select v_awarded + count(*) into v_awarded from novos;

  -- Contou o que usou (SPEC-024), pela mesma travessia e pelas mesmas duas razões.
  with novos as (
    insert into public.journey_points (user_id, fact_kind, fact_id, points, rules_version, awarded_on)
    select distinct v_user, 'wash_day', e.scheduled_care_id, 5, v_version, v_today
      from public.wash_days w
      join public.care_executions e on e.id = w.care_execution_id
     where w.user_id = v_user
       and e.voided_at is null
       and e.scheduled_care_id is not null
    on conflict (user_id, fact_kind, fact_id) do nothing
    returning 1
  )
  select v_awarded + count(*) into v_awarded from novos;

  return v_awarded;
end;
$$;

revoke all on function public.award_journey_points(text) from public, anon;
grant execute on function public.award_journey_points(text) to authenticated;

-- ROLLBACK:
--   ⚠️ Reverter esta função para a versão anterior só é seguro se NÃO houver execução avulsa
--   gravada; com uma, `award_journey_points` volta a lançar 23502 e a Jornada para. O rollback
--   correto desta fatia é o da SPEC-052 inteira (remover a porta e a RPC), não só esta função.
