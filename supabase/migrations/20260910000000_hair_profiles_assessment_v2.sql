-- SPEC-037 (F35) — a avaliação capilar ampliada ganha duas entradas: porosidade percebida e
-- disponibilidade real de rotina. Aditiva; nenhuma coluna existente é tocada.
--
-- ⚠️ AS DUAS SÃO NULLABLE, E NÃO POR CONVENIÊNCIA. `hair_profiles` é append-only e imutável (D-62):
-- as linhas anteriores a esta migration existem, não podem ser reescritas e nunca responderam a
-- estas perguntas. `null` significa "esta avaliação é anterior à pergunta" e é diferente de
-- 'unknown', que é a resposta "não sei dizer". Um DEFAULT aqui inventaria uma resposta que ninguém
-- deu — e é exatamente esse dado inventado que o motor do F36 leria como fato dela.
--
-- Os valores são vocabulário de produto (D-62), NÃO diagnóstico (D-26). Os nomes de porosidade
-- descrevem comportamento observado ('slow_to_wet'), não classe capilar ('low_porosity'): traduzir
-- um no outro é regra capilar, mora no motor versionado e nasce `candidate`.
--
-- Os conjuntos espelham os enums de packages/core/src/hair-profile/domain/hair-profile.ts.

alter table public.hair_profiles
  add column if not exists perceived_porosity text,
  add column if not exists routine_availability text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hair_profiles'::regclass and conname = 'hair_profiles_perceived_porosity_check'
  ) then
    alter table public.hair_profiles
      add constraint hair_profiles_perceived_porosity_check
      check (perceived_porosity is null or perceived_porosity in
        ('slow_to_wet', 'absorbs_normally', 'wets_and_dries_fast', 'unknown'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hair_profiles'::regclass and conname = 'hair_profiles_routine_availability_check'
  ) then
    alter table public.hair_profiles
      add constraint hair_profiles_routine_availability_check
      check (routine_availability is null or routine_availability in
        ('minimal', 'moderate', 'generous', 'varies'));
  end if;
end
$$;

comment on column public.hair_profiles.perceived_porosity is
  'SPEC-037: o que ela OBSERVA ao molhar o cabelo, não uma classificação de porosidade (D-26). null = avaliação anterior à pergunta; ''unknown'' = ela respondeu que não sabe dizer.';

comment on column public.hair_profiles.routine_availability is
  'SPEC-037: tempo real disponível para a rotina. null = avaliação anterior à pergunta.';

-- Sem mudança de RLS, policy ou grant: colunas novas herdam as da tabela, que continuam sendo
-- SELECT + INSERT do próprio dono, sem UPDATE e sem DELETE (append-only).

-- ROLLBACK:
--   alter table public.hair_profiles
--     drop constraint if exists hair_profiles_perceived_porosity_check,
--     drop constraint if exists hair_profiles_routine_availability_check,
--     drop column if exists perceived_porosity,
--     drop column if exists routine_availability;
