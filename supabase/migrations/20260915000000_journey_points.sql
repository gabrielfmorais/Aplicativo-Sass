-- SPEC-043 (F40/F41/F42) — a Jornada Huna: o ponto como **fato datado**.
--
-- > A Huna recompensa **consistência com o plano**, não **quantidade de tratamentos**. — D-103
--
-- ⚠️ **Isto NÃO pontua o cabelo.** O produto recusou pontuar o cabelo e o ciclo em três SPECs
-- (009/019/021), e as barreiras de teste da aba Progresso continuam de pé. O que esta tabela mede é
-- **aderência ao plano** — outro objeto, verificável, que não afirma nada sobre cabelo. É por isso
-- que ela fica **fora** do gate D-26/D-70, e exatamente por isso que ela não pode se disfarçar de
-- leitura capilar em nenhuma cópia.
--
-- **Por que uma tabela, e não derivação pura.** Derivar tudo na leitura seria mais barato hoje e
-- **falsificaria o passado amanhã**: no dia em que a régua mudar (v2), todo ponto já concedido seria
-- recalculado com a régua nova, e o histórico dela viraria ficção. O Blueprint §24 é explícito — *o
-- ponto concedido é fato datado, não recálculo*. Guardar agora é o critério (C) do §0.2: caro e
-- perigoso de corrigir depois.
--
-- **Mas continua havendo UMA verdade.** A linha aqui não é uma contagem paralela: ela **aponta para
-- o fato canônico** que a originou (`fact_kind` + `fact_id`), e é a `unique` desse par que garante
-- que o mesmo cuidado não pontue duas vezes por retry, reload ou reprocessamento — a mesma
-- disciplina do `client_execution_id` da SPEC-005.

create table if not exists public.journey_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Qual fato canônico originou o ponto. O enum é fechado: um "ponto avulso", sem fato por trás,
  -- seria a segunda verdade que o Blueprint proíbe.
  fact_kind text not null check (fact_kind in ('care_execution', 'checkin', 'wash_day')),
  fact_id uuid not null,
  points smallint not null check (points between 1 and 100),
  /**
   * A régua que concedeu este ponto (ADR-007). Fica gravada **na linha**: quando a v2 existir, ela
   * vale para o que vier depois, e o que já foi concedido continua sendo o que foi.
   */
  rules_version text not null,
  -- O dia civil DELA (ADR-008), decidido pelo servidor.
  awarded_on date not null,
  created_at timestamptz not null default now(),
  -- Idempotência **pelo id do FATO**, não pela sessão (D-103).
  constraint journey_points_fact_unique unique (user_id, fact_kind, fact_id)
);

comment on table public.journey_points is
  'SPEC-043 (F40): pontos de CONSISTÊNCIA COM O PLANO, como fatos datados. Não pontua cabelo nem ciclo (SPEC-009/019/021) — mede aderência, que é outro objeto e fica fora do gate D-26/D-70.';
comment on column public.journey_points.rules_version is
  'SPEC-043: a régua que concedeu este ponto. Mudar a régua não reescreve o passado — histórico falsificável é histórico inútil (D-103).';

create index if not exists journey_points_user_awarded_on
  on public.journey_points (user_id, awarded_on desc);

alter table public.journey_points enable row level security;
alter table public.journey_points force row level security;

-- **O cliente não escreve, e não apaga.** Ponto é fato: quem concede é o servidor, a partir dos
-- fatos canônicos que ele mesmo lê. Sem `INSERT`, o cliente não forja pontos; sem `DELETE` nem
-- `UPDATE`, ele não reescreve a história dela.
revoke all on public.journey_points from anon, authenticated;
grant select on public.journey_points to authenticated;

drop policy if exists journey_points_select_own on public.journey_points;
create policy journey_points_select_own on public.journey_points
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists journey_points_owner_all on public.journey_points;
create policy journey_points_owner_all on public.journey_points
  for all to postgres using (true) with check (true);

/**
 * Concede o que ainda não foi concedido (FR3).
 *
 * ⚠️ **A usuária nunca manda pontos, nem qual fato pontuar.** A função **lê os fatos dela** —
 * execuções efetivas, check-ins e registros de Wash Day — e concede o que ainda não tem linha. Um
 * cliente adulterado não consegue inventar consistência que ele não fez: não há parâmetro para isso.
 *
 * ⚠️ **O teto é o plano, e é isso que impede o incentivo proibido.** Um ponto por execução efetiva,
 * um por check-in e um por registro — todos **por cuidado planejado**. Não existe caminho que pague
 * por lavar mais, fazer mais reconstrução ou usar mais produto: fazer além do plano não gera fato
 * planejado nenhum (D-103).
 *
 * `on conflict do nothing` fecha a corrida que o `where not exists` não fecha: dois aparelhos, ou
 * uma segunda chamada cruzando a primeira, chegam os dois aqui.
 */
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
  -- Cuidado planejado atendido: a execução efetiva (não anulada) daquele cuidado.
  with novos as (
    insert into public.journey_points (user_id, fact_kind, fact_id, points, rules_version, awarded_on)
    select v_user, 'care_execution', e.id, 10, v_version, v_today
      from public.care_executions e
     where e.user_id = v_user
       and e.voided_at is null
    on conflict (user_id, fact_kind, fact_id) do nothing
    returning 1
  )
  select v_awarded + count(*) into v_awarded from novos;

  -- Contou como ficou: um toque sobre o cuidado que ela acabou de fazer (SPEC-006).
  with novos as (
    insert into public.journey_points (user_id, fact_kind, fact_id, points, rules_version, awarded_on)
    select v_user, 'checkin', c.id, 5, v_version, v_today
      from public.checkins c
     where c.user_id = v_user
    on conflict (user_id, fact_kind, fact_id) do nothing
    returning 1
  )
  select v_awarded + count(*) into v_awarded from novos;

  -- Contou o que usou: o registro do Wash Day (SPEC-024).
  with novos as (
    insert into public.journey_points (user_id, fact_kind, fact_id, points, rules_version, awarded_on)
    select v_user, 'wash_day', w.id, 5, v_version, v_today
      from public.wash_days w
     where w.user_id = v_user
    on conflict (user_id, fact_kind, fact_id) do nothing
    returning 1
  )
  select v_awarded + count(*) into v_awarded from novos;

  return v_awarded;
end;
$$;

revoke all on function public.award_journey_points(text) from public, anon;
grant execute on function public.award_journey_points(text) to authenticated;

-- Rollback (sem dado de produção antes do release, SPEC-043 §7):
--   drop function if exists public.award_journey_points(text);
--   drop table if exists public.journey_points;
