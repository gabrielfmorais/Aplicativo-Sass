-- SPEC-038 (F36) fatia 1 — `restoration` entra no vocabulário de `care_type_code`.
--
-- ⚠️ SEGURA PARA OS DADOS EXISTENTES, e o motivo é estrutural: um CHECK que ACEITA MAIS não pode
-- invalidar linha nenhuma. Toda linha que satisfazia a lista de três satisfaz a de quatro. Não há
-- backfill, não há reescrita, e nenhum plano histórico muda de significado.
--
-- ⚠️ E não muda cronograma nenhum. O motor v1 é imutável (ADR-001 §2) e continua produzindo três
-- tipos; quem vai poder emitir o quarto é o v2. Há teste no core travando isso: se o v1 emitir
-- `restoration`, ele reprova. Alargar o vocabulário e mudar comportamento são passos separados, e
-- este é só o primeiro.
--
-- `drop constraint` + `add constraint` é a forma de ALTERAR um CHECK no Postgres; o CHECK novo é um
-- superconjunto do antigo, então a tabela é revalidada e passa. As duas tabelas guardam o mesmo
-- vocabulário porque planejado e executado são registros distintos (D-69).

alter table public.scheduled_cares
  drop constraint if exists scheduled_cares_care_type_code_check;
alter table public.scheduled_cares
  add constraint scheduled_cares_care_type_code_check
  check (care_type_code in ('hydration', 'nutrition', 'reconstruction', 'restoration'));

alter table public.care_executions
  drop constraint if exists care_executions_care_type_code_check;
alter table public.care_executions
  add constraint care_executions_care_type_code_check
  check (care_type_code in ('hydration', 'nutrition', 'reconstruction', 'restoration'));

comment on column public.scheduled_cares.care_type_code is
  'SPEC-004/SPEC-038: hydration | nutrition | reconstruction | restoration. Vocabulario de produto (D-102), nao diagnostico (D-26). A REGRA que decide quando cada um entra vive no motor versionado e nasce candidate.';

-- ROLLBACK (só é seguro se nenhuma linha usar 'restoration' — confira antes):
--   alter table public.scheduled_cares drop constraint if exists scheduled_cares_care_type_code_check;
--   alter table public.scheduled_cares add constraint scheduled_cares_care_type_code_check
--     check (care_type_code in ('hydration', 'nutrition', 'reconstruction'));
--   alter table public.care_executions drop constraint if exists care_executions_care_type_code_check;
--   alter table public.care_executions add constraint care_executions_care_type_code_check
--     check (care_type_code in ('hydration', 'nutrition', 'reconstruction'));
