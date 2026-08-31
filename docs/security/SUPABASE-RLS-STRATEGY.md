# SUPABASE RLS STRATEGY

| Campo | Valor |
|---|---|
| Status | v0.2 — 2026-08-31. §2 e §3 descrevem o que **existe hoje** no banco, não o que foi imaginado na fundação. Uma tabela ou função que a necessity review descartou (D-66/D-71/D-78) sai da matriz em vez de continuar parecendo planejada: um documento de segurança que descreve objetos inexistentes faz alguém proteger a coisa errada. Policies reais continuam nascendo com a migration de cada SPEC |
| Relacionados | [DATA-MODEL](../architecture/DATA-MODEL.md) · [SECURITY-BASELINE](SECURITY-BASELINE.md) · [ADR-004](../adr/ADR-004-supabase-architecture.md) |

## 1. Princípios

1. **Fail closed:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` em toda tabela de `public`. Sem policy = sem acesso.
2. **Ownership direto:** toda tabela de dados de usuária possui `user_id`; policy padrão `user_id = (select auth.uid())` (subselect para performance/caching do planner).
3. **Grants mínimos:** `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;` e depois `GRANT` explícito por tabela/verbo. Policies só operam sobre o que o grant permite.
   **Default privileges da plataforma são não confiáveis.** O Supabase configura `ALTER DEFAULT PRIVILEGES` em `public`, portanto uma relação nova **pode nascer com privilégios implícitos para `anon`/`authenticated` sem nenhum `GRANT` na migration**. O conjunto exato varia por versão do Supabase/Postgres (observado no CI em 2026-08-26, Postgres 17: `MAINTAIN, REFERENCES, TRIGGER, TRUNCATE` para ambos os roles, grantor `postgres`) e **não é tratado como contrato**: não dependemos de nenhum conjunto específico de default grants e não os allowlistamos. Regras derivadas: (a) toda migration que cria relação exposta em `public` executa, na mesma transação, `revoke all on public.<relação> from anon, authenticated;` **antes** de conceder apenas o necessário; (b) o harness `tests.unapproved_grants()` (baseado em `pg_class.relacl`/`aclexplode`) reporta qualquer grant implícito como não aprovado (fail closed); (c) fixtures negativos **normalizam** a relação (`REVOKE ALL`) para uma baseline determinística de zero antes de injetar uma violação explícita, e nunca fazem asserções sobre privilégios implícitos específicos.
4. **Mutação por RPC quando há regra:** transições de estado, idempotência e multi-tabela nunca via UPDATE direto do cliente.
5. **Escrita server-only:** tabelas cujo conteúdo é derivado de engine/webhook não têm policy de INSERT/UPDATE para `authenticated`.
6. **Admin por claim, não por linha editável.**
7. **Toda policy tem teste** positivo e negativo (pgTAP em `supabase/tests/`).
8. **Sem `USING (true)` em tabela de usuária.** Catálogos públicos usam `USING (is_active)` / `status = 'published'`.

## 2. Funções auxiliares (definidas em migration da fase Foundation)

| Função | Tipo | Existe? | Uso |
|---|---|---|---|
| `auth.uid()` | nativa | sim | ownership |
| `public.set_updated_at()` | trigger | sim (SPEC-000) | timestamps |
| `public.has_entitlement(code text)` | `STABLE SECURITY INVOKER` | sim (SPEC-010) | deriva de `subscriptions` do próprio `auth.uid()`; `search_path` fixo |
| `public.get_my_entitlements()` | `STABLE SECURITY INVOKER` | sim (SPEC-010) | enumera o catálogo e delega a decisão a `has_entitlement`, para a lógica viver num lugar só |
| ~~`public.is_admin()`~~ | — | **não existe** | Previsto na fundação para `admin_users`/`audit_log`, que também não foram construídos. Nasce junto do primeiro consumidor real (admin web é pós-MVP) |

## 3. Matriz por tabela (MVP)

Legenda: **U** = `authenticated` (própria linha via `user_id = auth.uid()`) · **P** = público autenticado (leitura de catálogo) · **S** = somente `service_role`/Edge · **R** = via RPC · **M** = somente migration · **—** = negado

| Tabela | RLS | SELECT | INSERT | UPDATE | DELETE | Notas |
|---|---|---|---|---|---|---|
| ~~profiles~~ | — | — | — | — | — | **NÃO EXISTE** (necessity review SPEC-001 v0.2, D-63): ownership é direto em `auth.users`, "onboarding concluído" é derivado da existência de um `hair_profiles`, e o timezone vem do aparelho a cada chamada em vez de uma coluna que pode envelhecer |
| ~~consents~~ | — | — | — | — | — | **NÃO EXISTE** — **DEFER → SPEC-013** (SPEC-001 §necessity): aceite de termos ≠ consentimento LGPD, e a base legal ainda é decisão jurídica (D-32). **Isto é uma pendência real de release**, não uma tabela descartada |
| hair_profiles | ON | U | U (INSERT direto; trigger BEFORE INSERT atribui `version` com advisory lock) | — | — | imutável |
| ~~diagnostic_results~~ | — | — | — | — | — | **NÃO EXISTE** (D-66/SPEC-004 §9): a avaliação tem um consumidor só, o Schedule, e é reproduzível pelas versões de engine gravadas no plano. Nada a proteger |
| hair_plans | ON | U | S | S | — | status só via servidor |
| scheduled_cares | ON | U | S (geração) / R (`reschedule_care` cria nova linha) | R (`skip_care`, status) | — | usuária nunca altera `planned_date` |
| care_executions | ON | U | R (`complete_care`, `log_adhoc_care`) | R (`void_execution` em janela) | — | idempotente |
| checkins | ON | U | R (`submit_checkin`) | R (janela curta, opcional) | — | 1:1 |
| ~~care_types~~ | — | — | — | — | — | **NÃO EXISTE** (D-71/SPEC-007 §8.2): o código do cuidado é `text` + CHECK; o conteúdo é constante no core, versionada com o app |
| ~~content_articles~~ | — | — | — | — | — | **NÃO EXISTE** (D-71). O gate premium por conteúdo (`has_entitlement('premium_content')`) era desta linha: **não há conteúdo premium hoje**, e o conteúdo da SPEC-007 é gratuito por decisão. A primeira capacidade premium é `plan_customization` (D-79/SPEC-015), gated na geração do plano, não numa policy de leitura |
| notification_preferences | ON | U | U | U | **—** | Sem grant de DELETE: desligar é `enabled = false`, não apagar a linha |
| plan_preferences (**SPEC-015**) | ON | U | U | U | **—** | Preferência dela sobre a própria rotina; sem RPC (não guarda invariante de servidor). **Guardar não concede a capacidade premium**: aplicar é gated por `has_entitlement('plan_customization')` na geração (fail closed). "Sem preferência" é o array vazio, por isso ninguém tem DELETE |
| subscriptions | ON | U | S | S | — | webhook |
| billing_events (**SPEC-010**) | ON | **—** | S | — | — | Tabela de servidor: **nenhum** grant para `anon`/`authenticated`; escrita só pela DEFINER `apply_billing_event`. Idempotência por `event_id` (PK) |
| ~~admin_users~~ | — | — | — | — | — | **NÃO EXISTE**: nenhum fluxo de admin foi construído (admin web é pós-MVP) |
| ~~audit_log~~ | — | — | — | — | — | **NÃO EXISTE** (D-78): nunca foi construída. O único produtor real de auditoria, o webhook de billing, ganhou `billing_events` — amenda à ADR-011 |
| account_deletion_requests (**SPEC-001 aprovada**) | ON | U | U (`with check user_id = auth.uid()`) | **— (sem grant de UPDATE)** | U (cancelar = apagar o próprio pedido) | Acesso direto: grants mínimos + RLS + PK; sem RPC. `anon`: nenhum privilégio. Exclusão efetiva de `auth.users` é privilegiada/server-owned |

## 4. RPCs planejadas e postura de segurança

| RPC | Security | Motivo |
|---|---|---|
| `complete_care(scheduled_care_id, client_execution_id, executed_at, client_tz)` | INVOKER | roda como a usuária; RLS garante ownership; ON CONFLICT para idempotência |
| `log_adhoc_care(...)` | INVOKER | idem |
| `reschedule_care(scheduled_care_id, new_date)` | INVOKER | marca original + cria nova |
| `skip_care(scheduled_care_id, reason)` | INVOKER | |
| `submit_checkin(care_execution_id, ...)` | INVOKER | |
| `void_execution(care_execution_id)` | INVOKER | "desfazer" em janela curta; grava `voided_at` (pendente D-12) |
| `get_my_entitlements()` | INVOKER | lê `subscriptions` própria |
| ~~`request_account_deletion()`~~ | — | **Removida pela SPEC-001 (aprovada):** o pedido de exclusão é escrito por acesso direto com grants mínimos + RLS + PK; `audit_log` foi adiado; nenhuma função `SECURITY DEFINER` é introduzida pela SPEC-001 |
| `create_plan_tx(...)` | chamada só por Edge com service role | transação de geração de plano; `REVOKE EXECUTE FROM authenticated, anon` |
| `has_entitlement()`, `get_my_entitlements()` | INVOKER, STABLE | **existem** (SPEC-010). `has_entitlement` é chamada pela Edge `generate-plan` com o JWT da usuária para decidir a customização premium (SPEC-015 FR3) |
| ~~`is_admin()`~~ | — | **não existe**: sem `admin_users`, sem policy que a use, sem consumidor. Nasce com o primeiro fluxo de admin (pós-MVP) |
| `apply_billing_event(...)` | DEFINER, EXECUTE só `service_role` | **existe** (SPEC-010): único caminho de escrita em `subscriptions`/`billing_events`; idempotente por `event_id`; `search_path` fixo |

Regra: **nenhuma nova função `SECURITY DEFINER` sem linha nesta tabela + SPEC + teste.**

## 5. Padrão de policy (modelo)

```sql
-- Exemplo conceitual (não executar; a migration real vem da SPEC)
alter table public.hair_profiles enable row level security;
alter table public.hair_profiles force row level security;

revoke all on public.hair_profiles from anon, authenticated;
grant select, insert on public.hair_profiles to authenticated;

create policy "hair_profiles_select_own" on public.hair_profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "hair_profiles_insert_own" on public.hair_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));
-- sem policy de update/delete => negado
```

## 6. Testes de RLS (obrigatórios por tabela)

Casos mínimos, executados com `set local role authenticated; set local request.jwt.claims = '{"sub": "<uuid>"}'`:

```
Usuária A lê a própria linha                      → 1 linha
Usuária A lê linha de B                           → 0 linhas (não erro — evita enumeração)
Usuária A insere com user_id = A                  → ok
Usuária A insere com user_id = B                  → erro RLS
Usuária A faz UPDATE em tabela server-only        → erro (sem grant)
anon lê tabela de usuária                         → 0 linhas / erro de grant
Usuária A chama complete_care em care de B        → erro/NotFound
complete_care duas vezes com mesma client_execution_id → 1 execução
Usuária sem entitlement gera plano com preferência salva → plano padrão do engine (SPEC-015 FR3)
Cliente tenta escrever subscriptions / billing_events → erro de privilégio (42501)
```

Ferramenta: **pgTAP** via `supabase test db` (arquivos em `supabase/tests/*.sql`). CI roda contra Postgres local (`supabase start`).

## 7. Verificações automáticas em CI (fase Foundation)

- Query que falha se alguma tabela em `public` tiver `relrowsecurity = false` ou `relforcerowsecurity = false`.
- Query que lista funções `SECURITY DEFINER` e compara com allowlist versionada (`supabase/security/allowlists.sql`) — `tests.unapproved_security_definer_functions()`.
- Query que falha se alguma função `SECURITY DEFINER` em `public` **não fixar o `search_path`**, ou fixá-lo de um jeito que resolve por `"$user"` — `tests.unpinned_security_definer_functions()`. Estar na allowlist prova que a função foi **revisada**, nunca que é **segura de executar**: sem pin, nomes não qualificados resolvem pelo `search_path` de quem chama, então quem consegue criar um objeto num schema anterior no caminho decide o que a função executa, com os privilégios do dono. Provado pelo fixture negativo (`004`), não apenas afirmado.
- Query que falha se `anon`/`authenticated` tiverem grants em tabelas não listadas em allowlist de grants.
- Supabase Advisors (`get_advisors security`) executados em staging e tratados antes do release.

## 8. Performance de RLS

- Índice em `user_id` em toda tabela de usuária (RLS filtra por ele).
- `(select auth.uid())` em vez de `auth.uid()` direto (initPlan caching).
- Evitar joins dentro de policies; se necessário ownership transitivo, preferir coluna `user_id` redundante (decisão do DATA-MODEL).
