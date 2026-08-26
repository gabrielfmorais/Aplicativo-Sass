# ADR-004 — Supabase Architecture

**Status:** **Accepted** (D-03, 2026-08-26) · **Data:** 2026-08-26

## Context
Supabase oferece Postgres, Auth, PostgREST, RPC, Edge Functions e Storage. É preciso decidir onde cada tipo de lógica vive, como o cliente acessa dados, e como garantir que regras críticas sejam server-enforced sem duplicar o domínio em SQL.

## Decision

### Ambientes
Três projetos Supabase isolados: `dev` (local via `supabase start` + opcionalmente um projeto cloud dev), `staging`, `production`. Mesmas migrations; dados de produção nunca copiados para dev/staging.

### Acesso a dados
| Necessidade | Mecanismo |
|---|---|
| Leitura de dados próprios | PostgREST via SDK + RLS (queries tipadas por `supabase gen types`) |
| Escrita simples e sem regra (preferências, consentimento) | PostgREST + RLS `WITH CHECK` |
| Escrita com regra/transação/idempotência | **RPC `SECURITY INVOKER`** (roda como a usuária; RLS ainda se aplica) |
| Escrita que exige privilégio (audit, purga) | RPC `SECURITY DEFINER` **justificada** (allowlist) |
| Execução do engine TS, segredos, chamadas externas, webhooks | **Edge Function** (Deno), que usa service role só após validar JWT |
| Integridade | Constraints, índices únicos, triggers técnicos (`updated_at`, `profiles` on signup) |

### O que **não** fazemos
- Não colocar lógica de diagnóstico/cronograma em PL/pgSQL (fica em `packages/core`, executado na Edge Function).
- Não usar triggers para regra de produto.
- Não usar `service_role` fora de Edge Functions/CI.
- Não usar Realtime no MVP (sem caso de uso).
- Não usar Storage no MVP (sem uploads).

### Migrations
Supabase CLI. `supabase/migrations/<timestamp>_<slug>.sql`. Uma migration por mudança lógica, pequena, com seção `-- ROLLBACK:` comentada descrevendo reversão. Fluxo: local (`supabase db reset` + testes pgTAP) → PR → staging (CI `supabase db push` automático ao merge em `main`) → production (workflow manual com approval de environment).

### Tipos
`supabase gen types typescript` gera `apps/mobile/src/infrastructure/supabase/database.types.ts`, commitado e verificado em CI (diff = falha).

## Alternatives Considered
- **Backend próprio (NestJS/Fastify) na frente do Supabase:** controle total, mas dobra infra e perde RLS como fronteira principal; não justificado no MVP.
- **Toda lógica em Postgres Functions:** server-enforced, mas engine em SQL é difícil de versionar/testar e alienígena para o time.
- **Engine só no cliente com validação leve no servidor:** viola P10; cliente adulterado gera planos arbitrários e quebra invariantes.

## Trade-offs
+ RLS como primitiva única de autorização de dados; testável.
+ Engine em uma linguagem, executado onde faz sentido.
− Edge Function cold start (~centenas de ms) na geração de plano — aceitável (evento raro, com UI de "gerando").
− Duas superfícies de validação (zod + CHECK) — deliberado.

## Consequences
- Foundation cria: projeto local, migration 0001 (extensões, helpers `set_updated_at`, `is_admin`, `has_entitlement` stubs), pgTAP, CI checks de RLS. **Sem tabelas de produto.**
- Cada SPEC define tabelas, policies, RPCs e Edge Functions próprias.

## Security Impact
Central. Ver [SUPABASE-RLS-STRATEGY](../security/SUPABASE-RLS-STRATEGY.md). Allowlist de `SECURITY DEFINER` e verificação de RLS em CI.

## Reversibility
Média. Postgres + SQL migrations são portáveis; Auth/RLS/Edge são específicos, mas o domínio está fora deles.
