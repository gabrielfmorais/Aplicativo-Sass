-- SPEC-037 (F35) — as duas entradas novas de `hair_profiles`, sob cliente hostil.
--
-- O que está sendo defendido aqui é o **vocabulário**: o zod do cliente recusa antes da chamada, e
-- este CHECK recusa um cliente adulterado. É o segundo que importa — o primeiro é conveniência.
--
-- E a distinção que o produto inteiro depende: `null` (avaliação anterior à pergunta) continua
-- aceito, porque a tabela é append-only e imutável (D-62) e essas linhas existem.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-00000000003a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spec037a@example.test');

select tests.as_user('00000000-0000-4000-8000-00000000003a');

-- As colunas existem e continuam sem privilégio novo: a tabela segue SELECT+INSERT, sem UPDATE.
select has_column('public', 'hair_profiles', 'perceived_porosity', 'perceived_porosity existe');
select has_column('public', 'hair_profiles', 'routine_availability', 'routine_availability existe');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'SPEC-037 não abre grant novo');
select is((select count(*)::int from tests.tables_without_rls()), 0, 'RLS segue ligada e forçada');

-- Uma avaliação nova, completa.
insert into public.hair_profiles
  (user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments,
   heat_usage, current_concerns, primary_goal, perceived_porosity, routine_availability)
values
  ('00000000-0000-4000-8000-00000000003a', 'coily', 'coarse', 'dry_tendency', 'once_or_less_weekly', '{}',
   'almost_never', array['dryness'], 'softness_and_hydration', 'slow_to_wet', 'minimal');
select is(
  (select perceived_porosity from public.hair_profiles limit 1),
  'slow_to_wet',
  'a resposta dela é gravada como ela respondeu');

-- ⚠️ `null` continua legal, e é isso que mantém as avaliações anteriores válidas. Um NOT NULL aqui
-- teria exigido um default, e um default é uma resposta que ninguém deu.
insert into public.hair_profiles
  (user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments,
   heat_usage, current_concerns, primary_goal)
values
  ('00000000-0000-4000-8000-00000000003a', 'wavy', 'fine', 'balanced', 'twice_weekly', '{}',
   'almost_never', array['frizz'], 'maintain_healthy_hair');
select is(
  (select count(*)::int from public.hair_profiles where perceived_porosity is null),
  1,
  'uma avaliação sem as colunas novas continua sendo aceita (linha anterior à pergunta)');

-- Vocabulário fechado dos dois lados. `low_porosity` é o valor que a D-26 barra: classificar é
-- diagnóstico, e este CHECK é o que impede um cliente adulterado de gravar classificação.
select throws_ok(
  $$ insert into public.hair_profiles
       (user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments,
        heat_usage, current_concerns, primary_goal, perceived_porosity)
     values ('00000000-0000-4000-8000-00000000003a', 'curly', 'medium', 'balanced', 'twice_weekly', '{}',
        'almost_never', array['frizz'], 'maintain_healthy_hair', 'low_porosity') $$,
  '23514', null, 'CHECK recusa vocabulário de classificação de porosidade');

select throws_ok(
  $$ insert into public.hair_profiles
       (user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments,
        heat_usage, current_concerns, primary_goal, routine_availability)
     values ('00000000-0000-4000-8000-00000000003a', 'curly', 'medium', 'balanced', 'twice_weekly', '{}',
        'almost_never', array['frizz'], 'maintain_healthy_hair', 'bastante') $$,
  '23514', null, 'CHECK recusa disponibilidade fora da lista');

-- E a imutabilidade não foi afrouxada por causa das colunas novas: ninguém "completa" uma avaliação
-- antiga depois. Se um dia isso for desejado, é linha nova, não UPDATE.
select throws_ok(
  $$ update public.hair_profiles set perceived_porosity = 'unknown' $$,
  '42501', null, 'não existe UPDATE para preencher retroativamente uma avaliação antiga');

select * from finish();
rollback;
