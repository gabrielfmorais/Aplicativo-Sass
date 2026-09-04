-- SPEC-043 (F40) — o ponto é do CUIDADO PLANEJADO, não da linha de execução.
--
-- ⚠️ **Correção de um defeito medido no DEV real**, e ele quebrava a proibição central da D-103.
--
-- A versão anterior gravava `fact_id = care_executions.id`. Mas `void_execution` é **soft delete**
-- (`voided_at`), e refazer o cuidado cria uma execução **nova, com id novo** — que o par único
-- `(user_id, fact_kind, fact_id)` lê como outro fato. Medido contra o DEV: concluir → desfazer →
-- concluir pagou **10 pontos duas vezes pelo mesmo cuidado planejado** (135 → 145 → 155), e o laço
-- não tem fim. Nada disso exige cliente adulterado: são os botões da própria Hoje.
--
-- Isso violava a **BR2** da SPEC-043 — *"o teto é o plano: cada ponto é por cuidado planejado"* — e
-- a proibição que abre a D-103: **nenhum incentivo a repetir cuidado por pontos**. De quebra
-- inflava `caresAttended`, e com ele os marcos.
--
-- `checkins` e `wash_days` tinham o mesmo furo pela mesma porta: os dois são únicos por
-- `care_execution_id`, então a execução nova admitia um segundo check-in e um segundo registro.
--
-- **A correção é a chave, não uma trava a mais.** Passando a gravar o **cuidado planejado** como
-- `fact_id`, a `unique` que já existe faz o resto: um cuidado do plano paga **uma vez, para
-- sempre**, independentemente de quantas execuções ele tenha tido. Não há contador novo, não há
-- estado novo, e a regra fica onde é impossível contorná-la.

-- ---------------------------------------------------------------- reparo dos pontos já concedidos
-- Os pontos existentes apontam para execuções. Re-apontá-los para o cuidado planejado é o que os
-- torna comparáveis com os novos — sem isso, o mesmo cuidado teria uma linha por execução e outra
-- por plano, e a soma continuaria inflada.
--
-- A ordem importa: as duplicatas saem **antes** do update, senão o próprio update violaria a
-- `unique`. Sobrevive a **primeira** concedida (menor `awarded_on`, depois `created_at`), que é a
-- que corresponde ao momento em que ela realmente atendeu aquele cuidado.

-- 1. `care_execution` → o cuidado planejado da execução.
with mapeado as (
  select p.id,
         row_number() over (
           partition by p.user_id, e.scheduled_care_id
           order by p.awarded_on, p.created_at, p.id
         ) as rn
    from public.journey_points p
    join public.care_executions e on e.id = p.fact_id
   where p.fact_kind = 'care_execution'
)
delete from public.journey_points p
 using mapeado m
 where p.id = m.id and m.rn > 1;

update public.journey_points p
   set fact_id = e.scheduled_care_id
  from public.care_executions e
 where p.fact_kind = 'care_execution'
   and e.id = p.fact_id
   and p.fact_id is distinct from e.scheduled_care_id;

-- 2. `checkin` → o cuidado planejado, atravessando a execução.
with mapeado as (
  select p.id,
         row_number() over (
           partition by p.user_id, e.scheduled_care_id
           order by p.awarded_on, p.created_at, p.id
         ) as rn
    from public.journey_points p
    join public.checkins c on c.id = p.fact_id
    join public.care_executions e on e.id = c.care_execution_id
   where p.fact_kind = 'checkin'
)
delete from public.journey_points p
 using mapeado m
 where p.id = m.id and m.rn > 1;

update public.journey_points p
   set fact_id = e.scheduled_care_id
  from public.checkins c
  join public.care_executions e on e.id = c.care_execution_id
 where p.fact_kind = 'checkin'
   and c.id = p.fact_id
   and p.fact_id is distinct from e.scheduled_care_id;

-- 3. `wash_day` → idem.
with mapeado as (
  select p.id,
         row_number() over (
           partition by p.user_id, e.scheduled_care_id
           order by p.awarded_on, p.created_at, p.id
         ) as rn
    from public.journey_points p
    join public.wash_days w on w.id = p.fact_id
    join public.care_executions e on e.id = w.care_execution_id
   where p.fact_kind = 'wash_day'
)
delete from public.journey_points p
 using mapeado m
 where p.id = m.id and m.rn > 1;

update public.journey_points p
   set fact_id = e.scheduled_care_id
  from public.wash_days w
  join public.care_executions e on e.id = w.care_execution_id
 where p.fact_kind = 'wash_day'
   and w.id = p.fact_id
   and p.fact_id is distinct from e.scheduled_care_id;

comment on column public.journey_points.fact_id is
  'SPEC-043: o CUIDADO PLANEJADO (scheduled_cares.id) que originou o ponto — nunca a linha de execução. Execução é soft delete: refazer cria id novo, e keying pela execução pagava o mesmo cuidado várias vezes (D-103).';

-- ---------------------------------------------------------------- a concessão, re-chavada
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
   */
  with novos as (
    insert into public.journey_points (user_id, fact_kind, fact_id, points, rules_version, awarded_on)
    select distinct v_user, 'care_execution', e.scheduled_care_id, 10, v_version, v_today
      from public.care_executions e
     where e.user_id = v_user
       and e.voided_at is null
    on conflict (user_id, fact_kind, fact_id) do nothing
    returning 1
  )
  select v_awarded + count(*) into v_awarded from novos;

  -- Contou como ficou (SPEC-006). Atravessa a execução para chegar ao cuidado planejado, e ignora
  -- check-in pendurado em execução anulada — ela desfez aquilo.
  with novos as (
    insert into public.journey_points (user_id, fact_kind, fact_id, points, rules_version, awarded_on)
    select distinct v_user, 'checkin', e.scheduled_care_id, 5, v_version, v_today
      from public.checkins c
      join public.care_executions e on e.id = c.care_execution_id
     where c.user_id = v_user
       and e.voided_at is null
    on conflict (user_id, fact_kind, fact_id) do nothing
    returning 1
  )
  select v_awarded + count(*) into v_awarded from novos;

  -- Contou o que usou (SPEC-024), pela mesma travessia e pela mesma razão.
  with novos as (
    insert into public.journey_points (user_id, fact_kind, fact_id, points, rules_version, awarded_on)
    select distinct v_user, 'wash_day', e.scheduled_care_id, 5, v_version, v_today
      from public.wash_days w
      join public.care_executions e on e.id = w.care_execution_id
     where w.user_id = v_user
       and e.voided_at is null
    on conflict (user_id, fact_kind, fact_id) do nothing
    returning 1
  )
  select v_awarded + count(*) into v_awarded from novos;

  return v_awarded;
end;
$$;

revoke all on function public.award_journey_points(text) from public, anon;
grant execute on function public.award_journey_points(text) to authenticated;

-- ROLLBACK: reaplicar 20260915000000_journey_points.sql restaura a versão anterior da função. O
-- re-apontamento de `fact_id` não se desfaz — e não deve: a versão anterior pagava o mesmo cuidado
-- mais de uma vez.
