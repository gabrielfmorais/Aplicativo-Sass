# SUPABASE RLS STRATEGY

| Campo | Valor |
|---|---|
| Status | Draft v0.1 — conceitual; policies reais nascem com as migrations de cada SPEC |
| Relacionados | [DATA-MODEL](../architecture/DATA-MODEL.md) · [SECURITY-BASELINE](SECURITY-BASELINE.md) · [ADR-004](../adr/ADR-004-supabase-architecture.md) |

## 1. Princípios

1. **Fail closed:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` em toda tabela de `public`. Sem policy = sem acesso.
2. **Ownership direto:** toda tabela de dados de usuária possui `user_id`; policy padrão `user_id = (select auth.uid())` (subselect para performance/caching do planner).
3. **Grants mínimos:** `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;` e depois `GRANT` explícito por tabela/verbo. Policies só operam sobre o que o grant permite.
4. **Mutação por RPC quando há regra:** transições de estado, idempotência e multi-tabela nunca via UPDATE direto do cliente.
5. **Escrita server-only:** tabelas cujo conteúdo é derivado de engine/webhook não têm policy de INSERT/UPDATE para `authenticated`.
6. **Admin por claim, não por linha editável.**
7. **Toda policy tem teste** positivo e negativo (pgTAP em `supabase/tests/`).
8. **Sem `USING (true)` em tabela de usuária.** Catálogos públicos usam `USING (is_active)` / `status = 'published'`.

## 2. Funções auxiliares (definidas em migration da fase Foundation)

| Função | Tipo | Uso |
|---|---|---|
| `auth.uid()` | nativa | ownership |
| `public.is_admin()` | `STABLE SECURITY INVOKER` | lê claim `app_role` do JWT **e** confere `admin_users` (defesa em profundidade); exige `aal2` quando MFA ativo |
| `public.has_entitlement(code text)` | `STABLE SECURITY INVOKER` | deriva de `subscriptions` do próprio `auth.uid()` |
| `public.set_updated_at()` | trigger | timestamps |

## 3. Matriz por tabela (MVP)

Legenda: **U** = `authenticated` (própria linha via `user_id = auth.uid()`) · **P** = público autenticado (leitura de catálogo) · **S** = somente `service_role`/Edge · **R** = via RPC · **M** = somente migration · **—** = negado

| Tabela | RLS | SELECT | INSERT | UPDATE | DELETE | Notas |
|---|---|---|---|---|---|---|
| profiles | ON | U | S (trigger no signup) | U (colunas permitidas: display_name, timezone, locale, onboarding_status) | — (exclusão via RPC) | Colunas sensíveis protegidas por trigger/`GRANT UPDATE (cols)` |
| consents | ON | U | U | — | — | append-only; revogação = novo registro |
| hair_profiles | ON | U | U (INSERT direto; trigger BEFORE INSERT atribui `version` com advisory lock) | — | — | imutável |
| diagnostic_results | ON | U | S | — | — | escrito por `generate-plan` |
| hair_plans | ON | U | S | S | — | status só via servidor |
| scheduled_cares | ON | U | S (geração) / R (`reschedule_care` cria nova linha) | R (`skip_care`, status) | — | usuária nunca altera `planned_date` |
| care_executions | ON | U | R (`complete_care`, `log_adhoc_care`) | R (`void_execution` em janela) | — | idempotente |
| checkins | ON | U | R (`submit_checkin`) | R (janela curta, opcional) | — | 1:1 |
| care_types | ON | P (`is_active`) | M | M | M | catálogo |
| content_articles | ON | P (`status='published' AND (NOT is_premium OR has_entitlement('premium_content'))`) | M/admin | M/admin | — | |
| notification_preferences | ON | U | U | U | U | |
| subscriptions | ON | U | S | S | — | webhook |
| admin_users | ON | admin (`is_admin()`) | M | M | M | |
| audit_log | ON | admin | S / função definer | — | — | append-only |
| account_deletion_requests | ON | U | R (`request_account_deletion`) | R (`cancel_account_deletion`) | — | |

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
| `request_account_deletion()` | **DEFINER** | precisa escrever em `audit_log` e agendar purga; justificativa: usuária não tem grant em `audit_log`. Controles: `search_path=''`, usa `auth.uid()` internamente, sem args sensíveis, `REVOKE FROM public/anon`, `GRANT EXECUTE TO authenticated` |
| `create_plan_tx(...)` | chamada só por Edge com service role | transação de geração de plano; `REVOKE EXECUTE FROM authenticated, anon` |
| `is_admin()`, `has_entitlement()` | INVOKER, STABLE | usadas em policies |

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
Usuária comum lê admin_users / audit_log          → negado
Usuária sem entitlement lê content premium        → 0 linhas
Usuária A chama complete_care em care de B        → erro/NotFound
complete_care duas vezes com mesma client_execution_id → 1 execução
```

Ferramenta: **pgTAP** via `supabase test db` (arquivos em `supabase/tests/*.sql`). CI roda contra Postgres local (`supabase start`).

## 7. Verificações automáticas em CI (fase Foundation)

- Query que falha se alguma tabela em `public` tiver `relrowsecurity = false` ou `relforcerowsecurity = false`.
- Query que lista funções `SECURITY DEFINER` e compara com allowlist versionada (`supabase/security/definer-allowlist.txt`).
- Query que falha se `anon`/`authenticated` tiverem grants em tabelas não listadas em allowlist de grants.
- Supabase Advisors (`get_advisors security`) executados em staging e tratados antes do release.

## 8. Performance de RLS

- Índice em `user_id` em toda tabela de usuária (RLS filtra por ele).
- `(select auth.uid())` em vez de `auth.uid()` direto (initPlan caching).
- Evitar joins dentro de policies; se necessário ownership transitivo, preferir coluna `user_id` redundante (decisão do DATA-MODEL).
