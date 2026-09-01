-- SPEC-018 fatia 2 — `profiles`: como a usuária quer ser chamada, e nada mais.
--
-- **Por que agora, e por que só agora.** O DATA-MODEL §3.1 desenhou esta tabela e a marcou como
-- entidade futura: D-63 decidiu que ela nasceria "numa SPEC futura quando houver requisito
-- concreto". O requisito chegou — a primeira experiência da Huna pergunta o nome — e a tabela nasce
-- com **exatamente uma** coluna de produto. `timezone`, `locale` e `onboarding_status` estavam no
-- desenho original e **não** entram: nenhum tem consumidor hoje (D-47/D-48), e `onboarding_status`
-- foi explicitamente rejeitado por D-63, que derivou "onboarding concluído" da existência de um
-- `hair_profiles`. Criar coluna por antecipação é o erro que aquela decisão evitou.
--
-- ⚠️ **PII.** `display_name` é dado pessoal: um nome ou apelido que a usuária escolhe. Isto muda o
-- inventário do produto — o DATA-MODEL §4.2 dizia "não coletamos nome nem apelido", e passa a dizer
-- o contrário. Mudança registrada lá e na SPEC, nunca silenciosa.
--
-- **Linha existe ≠ nome existe.** `display_name` é nullable de propósito: pular a pergunta é grátis,
-- e a **existência da linha** é o que registra "já perguntamos". Sem essa distinção, o app voltaria
-- a perguntar o nome a cada abertura para quem escolheu não responder — que é a definição de não
-- ouvir. Nulo = ela decidiu não dizer. Linha ausente = ainda não perguntamos.
--
-- Aditiva: uma tabela, nenhuma RPC, nenhum SECURITY DEFINER. Como `plan_preferences` e ao contrário
-- de planos ou execuções, esta linha não guarda invariante de servidor — é a declaração dela sobre
-- ela mesma. A posse é RLS mais `with check`.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Nulo é uma resposta válida: "prefiro não dizer". Ver a nota acima.
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Um apelido, não um texto. O limite protege contra um cliente adulterado gravando PII em massa
  -- num campo que a interface trata como uma palavra; 60 cabe em qualquer nome real.
  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 60),
  -- Só espaço em branco não é um nome. Evita a linha que parece preenchida e cumprimenta o vazio.
  constraint profiles_display_name_not_blank
    check (display_name is null or btrim(display_name) <> '')
);

comment on table public.profiles is
  'SPEC-018: identidade escolhida pela usuária. Uma linha por usuária; a existência dela significa que já perguntamos o nome, e display_name nulo significa que ela preferiu não dizer.';
comment on column public.profiles.display_name is
  'PII — nome ou apelido escolhido pela usuária. Opcional por decisão de produto: pular não custa nada a ela.';

-- `drop … if exists` antes de criar porque no DEV esta migration é **colada no SQL Editor** enquanto
-- o histórico de migrations não é reparado (runbook DEV-DATABASE-PROVISION §5): uma segunda colagem
-- não pode falhar no meio e deixar metade das policies aplicadas.
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- A própria linha, e mais nada. Sem DELETE: a linha morre junto com a conta, por cascade a partir
-- de `auth.users` — e "apagar meu nome" é um UPDATE para nulo, não a remoção da linha, porque a
-- linha também guarda o fato de já termos perguntado.
revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

-- `with check` é o que impede um cliente adulterado de escrever o nome de outra pessoa.
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- FORCE row level security vale também para o dono da tabela.
drop policy if exists profiles_owner_all on public.profiles;
create policy profiles_owner_all on public.profiles
  for all to postgres using (true) with check (true);

-- Rollback (sem dado de produção antes do release, SPEC-018 §22):
--   drop table if exists public.profiles;
