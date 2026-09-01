-- SPEC-022 §8/§10 (F22) — a pausa: parar sem perder nada, e voltar sem culpa.
--
-- **O problema, nas palavras do Blueprint §5.** Viagem, doença, gravidez, cabelo em proteção, uma
-- semana impossível. Hoje a única saída é pular cuidado por cuidado, e o app acumula atrasos que a
-- fazem sentir que falhou — quando ela apenas viveu.
--
-- **Tabela, não coluna** (OQ1). `hair_plans.paused_at` guardaria **uma** pausa e apagaria a anterior
-- a cada nova; a regra é que nada se apaga (BR4), então o histórico de pausas vem de graça numa
-- tabela append-only e não vem de jeito nenhum numa coluna.
--
-- **O que a retomada faz (OQ2, decisão do dono, D-98).** Desloca o que sobrou pelo tamanho da pausa,
-- preservando os intervalos que o engine calculou. Quando o deslocamento não couber no ciclo, a volta
-- **oferece um ciclo novo** em vez de desenhar uma quinta semana. Pausa curta preserva o plano;
-- pausa longa reconhece que o cronograma envelheceu.
--
-- **Deslocar altera `planned_date` no lugar, e isso não é reescrever histórico.** Só se movem
-- cuidados `planned`, sem execução efetiva, a partir do dia da pausa: um cuidado futuro sem execução
-- é uma **intenção**, não um fato. `care_executions` não é tocada, e o que ela já concluiu, pulou ou
-- reagendou fica exatamente onde estava. É deliberadamente diferente de `reschedule_care`, que cria
-- linha nova porque ali **ela** moveu um cuidado específico e a intenção original quer dizer algo;
-- aqui o tempo inteiro parou, e N linhas fantasma seriam ruído, não verdade. O movimento fica
-- registrado onde deve: nas duas datas desta tabela.

create table if not exists public.plan_pauses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null,
  -- Dias civis **dela** (ADR-008), decididos pelo servidor a partir do fuso que viaja na chamada.
  paused_on date not null,
  -- Nulo = pausa vigente. É o que "pausado" significa; não existe coluna de estado.
  resumed_on date null,
  created_at timestamptz not null default now(),
  -- Integridade de posse garantida pelo banco, como em `scheduled_cares`: uma pausa nunca carrega
  -- um user_id diferente do dono do plano que ela pausa.
  constraint plan_pauses_plan_owner_fk
    foreign key (plan_id, user_id) references public.hair_plans (id, user_id) on delete cascade,
  constraint plan_pauses_resumed_after_paused
    check (resumed_on is null or resumed_on >= paused_on)
);

comment on table public.plan_pauses is
  'SPEC-022: quando o cronograma parou e quando voltou. resumed_on nulo = pausado agora. Append-only: uma pausa encerrada nunca é apagada nem reaberta.';

-- **Uma pausa aberta por usuária.** Duas pausas simultâneas não significam nada, e o índice é o que
-- faz "pausar de novo" ser um no-op em vez de um estado impossível (EC6).
create unique index if not exists plan_pauses_one_open_per_user
  on public.plan_pauses (user_id) where resumed_on is null;

create index if not exists plan_pauses_user_paused_on
  on public.plan_pauses (user_id, paused_on desc);

alter table public.plan_pauses enable row level security;
alter table public.plan_pauses force row level security;

-- Leitura da própria pausa; **nenhuma escrita** para o cliente. Pausar e retomar mexem no
-- cronograma, e retomar move várias linhas — isso é transação de servidor, não de aplicativo.
revoke all on public.plan_pauses from anon, authenticated;
grant select on public.plan_pauses to authenticated;

drop policy if exists plan_pauses_select_own on public.plan_pauses;
create policy plan_pauses_select_own on public.plan_pauses
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists plan_pauses_owner_all on public.plan_pauses;
create policy plan_pauses_owner_all on public.plan_pauses
  for all to postgres using (true) with check (true);

/**
 * Pausa o cronograma ativo. Idempotente: pausar de novo devolve a pausa que já está aberta, sem
 * criar a segunda nem falhar — dois toques no mesmo botão são um pedido só (EC6).
 *
 * `SECURITY DEFINER` pelas razões de sempre: o dia civil é decisão do servidor (`care_local_today`
 * já valida e limita o fuso recebido, T22) e `user_id` nunca é parâmetro.
 */
create or replace function public.pause_plan(p_timezone text) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.care_current_user();
  v_plan_id uuid;
  v_pause_id uuid;
begin
  select id into v_pause_id from public.plan_pauses
   where user_id = v_user and resumed_on is null;
  if v_pause_id is not null then
    return v_pause_id;
  end if;

  -- Sem plano ativo não há o que pausar, e a ação nem aparece na interface (EC1). Se um cliente
  -- adulterado chamar assim mesmo, a resposta é um erro claro, não uma pausa órfã.
  select id into v_plan_id from public.hair_plans
   where user_id = v_user and status = 'active';
  if v_plan_id is null then
    raise exception 'pause_plan: no active plan' using errcode = 'P0002';
  end if;

  -- `on conflict do nothing` porque o SELECT acima **não** fecha a corrida: dois aparelhos, ou dois
  -- toques em voo, passam os dois pela leitura e chegam os dois aqui. Sem isto, o segundo receberia
  -- violação de unicidade e a tela diria "não foi possível pausar" para uma pausa que existe.
  insert into public.plan_pauses (user_id, plan_id, paused_on)
  values (v_user, v_plan_id, public.care_local_today(p_timezone))
  on conflict (user_id) where resumed_on is null do nothing
  returning id into v_pause_id;

  if v_pause_id is null then
    select id into v_pause_id from public.plan_pauses
     where user_id = v_user and resumed_on is null;
  end if;

  return v_pause_id;
end;
$$;

/**
 * Retoma — ou apenas **conta o que aconteceria**, que é o ponto de `p_commit`.
 *
 * O Blueprint exige que ela saiba **antes** de confirmar. A alternativa seria a tela calcular a
 * previsão por conta própria, e aí a regra de deslocamento existiria em dois lugares — SQL e
 * TypeScript — divergindo na primeira vez que qualquer um dos dois mudasse. Um `dry run` mantém
 * **uma** implementação: a tela pergunta, mostra a resposta, e confirma chamando a mesma função.
 *
 * Devolve `action`:
 *   - `shifted`    — o que sobrou andou `shift_days` dias; `care_count` cuidados movidos.
 *   - `new_cycle`  — o deslocamento não cabe no ciclo; a volta oferece montar o próximo.
 *   - `not_paused` — não havia pausa aberta. No-op, não erro (EC2).
 */
create or replace function public.resume_plan(p_timezone text, p_commit boolean default false)
returns table (action text, shift_days integer, care_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.care_current_user();
  v_today date;
  v_pause public.plan_pauses;
  v_plan public.hair_plans;
  v_shift integer;
  v_count integer;
  v_last date;
begin
  select * into v_pause from public.plan_pauses
   where user_id = v_user and resumed_on is null
   -- Trava a pausa: duas retomadas simultâneas deslocariam o cronograma duas vezes, e um
   -- cronograma deslocado em dobro é pior que um não deslocado.
   for update;
  if v_pause.id is null then
    return query select 'not_paused'::text, 0, 0;
    return;
  end if;

  v_today := public.care_local_today(p_timezone);
  v_shift := v_today - v_pause.paused_on;

  select * into v_plan from public.hair_plans where id = v_pause.plan_id;

  /**
   * EC5 — ela reavaliou durante a pausa. O plano pausado virou `superseded` e ela já tem um novo,
   * ativo, que nunca esteve parado. Deslocar os cuidados do plano morto moveria linhas que ninguém
   * mais vê, e manter a pausa aberta faria a Hoje dizer "pausado" sobre um cronograma novo em folha.
   *
   * A pausa termina com o plano que a tinha: fecha, e não há nada a deslocar.
   */
  if v_plan.status is distinct from 'active' then
    if p_commit then
      update public.plan_pauses set resumed_on = v_today where id = v_pause.id;
    end if;
    return query select 'not_paused'::text, 0, 0;
    return;
  end if;

  -- O que ainda é intenção: `planned`, sem execução efetiva, a partir do dia em que ela parou.
  -- O que ela concluiu, pulou ou reagendou não se move — aquilo já aconteceu.
  select count(*), max(sc.planned_date) into v_count, v_last
    from public.scheduled_cares sc
   where sc.plan_id = v_plan.id
     and sc.status = 'planned'
     and sc.planned_date >= v_pause.paused_on
     and not exists (
       select 1 from public.care_executions ce
        where ce.scheduled_care_id = sc.id and ce.voided_at is null
     );

  /**
   * O limite natural (D-98): o fim do ciclo, que é a janela de 28 dias do plano — dia 0 a 27 a
   * partir de `starts_on`. Se o último cuidado deslocado passar dali, o deslocamento deixou de
   * caber, e insistir desenharia um ciclo que não existe (SPEC-019 não tem quinta semana).
   *
   * Nada a deslocar também cai aqui: um ciclo sem intenção restante já acabou, e a Hoje já
   * oferece o próximo nesse caso (D-82).
   */
  if v_count = 0 or (v_last + v_shift) > (v_plan.starts_on + 27) then
    if p_commit then
      update public.plan_pauses set resumed_on = v_today where id = v_pause.id;
    end if;
    return query select 'new_cycle'::text, v_shift, coalesce(v_count, 0);
    return;
  end if;

  if p_commit then
    update public.scheduled_cares sc
       set planned_date = sc.planned_date + v_shift
     where sc.plan_id = v_plan.id
       and sc.status = 'planned'
       and sc.planned_date >= v_pause.paused_on
       and not exists (
         select 1 from public.care_executions ce
          where ce.scheduled_care_id = sc.id and ce.voided_at is null
       );
    update public.plan_pauses set resumed_on = v_today where id = v_pause.id;
  end if;

  return query select 'shifted'::text, v_shift, v_count;
end;
$$;

revoke all on function public.pause_plan(text) from public, anon;
grant execute on function public.pause_plan(text) to authenticated;
revoke all on function public.resume_plan(text, boolean) from public, anon;
grant execute on function public.resume_plan(text, boolean) to authenticated;

-- Rollback (sem dado de produção antes do release, SPEC-022 §22):
--   drop function if exists public.resume_plan(text, boolean);
--   drop function if exists public.pause_plan(text);
--   drop table if exists public.plan_pauses;
