-- SPEC-048 (F38, fatia 1) — QUAL finalização ela fez.
--
-- A SPEC-039 entregou a **etapa** (`done` / `skipped`): se ela finalizou. O que faltava era *qual*,
-- e isso exigia um vocabulário — que a barreira da SPEC-039 §8 marcou, por escrito, como conteúdo
-- capilar substantivo atrás do gate D-26/D-70. **A lista veio do dono** (2026-09-04) e entra como
-- `candidate`.
--
-- ⚠️ **Registro, não recomendação.** *"Eu fiz Fitagem"* é fato observável informado por ela;
-- *"Fitagem é melhor para o seu cabelo"* continua **bloqueado**. Nada nesta migration, no vocabulário
-- ou na tela indica, ordena, pontua ou promete efeito — e é essa contenção, não uma revisão, que
-- mantém a **fatia de registro** utilizável antes do sign-off.
--
-- ⚠️ **Não duplica `WASH_DAY_TECHNIQUES`.** As catorze técnicas legadas ficam onde estão e o
-- histórico não é reescrito (SPEC-039 §8) — seis delas são movimentos de finalização e continuam
-- sendo técnicas. Os dois vocabulários seguem **estruturalmente disjuntos**, com trava de teste.
--
-- ⚠️ **Sem campo de texto livre** (SPEC-024): `other` cobre a técnica fora do vocabulário e
-- `unknown` é "não sei o nome". Texto livre não se compara nem se agrega, e destruiria P5/P6/P7/P8.
--
-- `day_after` **não** entra nesta versão, por decisão do dono: revitalização/day after é conceito
-- separado, e entra se o roadmap justificar.

alter table public.wash_day_finish
  add column if not exists finish_technique text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'wash_day_finish_technique_check'
  ) then
    alter table public.wash_day_finish
      add constraint wash_day_finish_technique_check check (
        finish_technique is null or finish_technique in (
          'fitagem_tradicional',
          'fitagem_estruturada',
          'dedoliss',
          'rake_and_shake',
          'plopping',
          'twist_out',
          'other',    -- fez uma finalização fora desta lista
          'unknown'   -- fez, e não sabe identificar pelo nome
        )
      );
  end if;

  /*
   * ⚠️ **Técnica só existe quando ela finalizou.** "Pulei a finalização, e a técnica foi fitagem" é
   * um estado impossível, e o banco é o único lugar onde ele fica impossível de verdade: um segundo
   * caminho de escrita (retry, outro aparelho, cliente adulterado) contornaria uma checagem de
   * aplicação.
   *
   * `null` continua significando **"ainda não disse qual"**, que é diferente de `unknown` ("fiz e
   * não sei o nome") — a mesma distinção que o `F35` já teve de fazer entre ausência e resposta.
   */
  if not exists (
    select 1 from pg_constraint where conname = 'wash_day_finish_technique_requires_done'
  ) then
    alter table public.wash_day_finish
      add constraint wash_day_finish_technique_requires_done check (
        finish_technique is null or finish_status = 'done'
      );
  end if;
end $$;

comment on column public.wash_day_finish.finish_technique is
  'SPEC-048 (F38): QUAL finalização ela fez. Vocabulário CANDIDATE (dono, 2026-09-04) — registro, nunca recomendação; "melhor para você", indicação por curvatura, passo a passo e ranking seguem bloqueados por D-26/D-70. NULL = ainda não disse qual; unknown = fez e não sabe o nome.';

-- Nenhum grant novo: o cliente já tem select/insert/update/delete na tabela (SPEC-039 §7), e a
-- coluna entra sob as policies que já existem.

-- ROLLBACK:
--   alter table public.wash_day_finish drop constraint if exists wash_day_finish_technique_requires_done;
--   alter table public.wash_day_finish drop constraint if exists wash_day_finish_technique_check;
--   alter table public.wash_day_finish drop column if exists finish_technique;
