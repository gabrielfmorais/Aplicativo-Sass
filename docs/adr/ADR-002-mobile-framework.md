# ADR-002 — Mobile Framework

**Status:** **Accepted** (aprovação humana D-20, 2026-08-26) · **Data:** 2026-08-26
**Nota de reversibilidade:** decisão estrutural — só pode ser alterada por nova ADR que explicitamente substitua esta (`Superseded by ADR-XXX`).

## Context
App B2C iOS + Android, equipe pequena, desenvolvimento assistido por IA, backend Supabase (SDK JS de primeira classe), necessidade de iteração rápida (OTA), notificações locais, IAP, deep links, futura possibilidade de admin web compartilhando regras.

## Decision
**Expo (managed workflow, SDK atual estável) + React Native + TypeScript (strict)**, com:
- **Expo Router** para navegação file-based e deep links nativos.
- **EAS Build / Submit / Update** para builds, lojas e OTA (OTA apenas para JS; mudanças de engine sempre com bump de `algorithm_version`).
- **TanStack Query** para estado servidor; estado global mínimo (Zustand) apenas se necessário.
- **zod** para validação compartilhada (core ↔ app ↔ Edge Functions).
- **expo-secure-store**, **expo-notifications** (locais), **expo-linking**.
- Testes: Vitest (core), Jest + React Native Testing Library (app), Maestro para E2E (avaliar na fase de testes).

## Alternatives Considered
| Opção | Prós | Contras | Por que não |
|---|---|---|---|
| Flutter | Performance UI, consistência visual | Dart; Supabase SDK menos maduro que JS; ecossistema de IA/copilot menor; sem compartilhar TS com Edge Functions/admin | Perde reutilização do core em TS |
| Nativo (Swift + Kotlin) | Melhor plataforma | Duas bases; equipe pequena; sem OTA | Custo inviável |
| Kotlin Multiplatform | Compartilha lógica | UI ainda por plataforma; maturidade | Complexidade |
| PWA / Capacitor | Barato | Notificações iOS limitadas, IAP, sensação não-nativa, retenção pior | Contradiz P03/P04 |
| React Native bare (sem Expo) | Controle total | Perde EAS, config plugins, upgrades mais difíceis | Sem necessidade de módulos custom no MVP |

## Trade-offs
+ Um único domínio TS (`packages/core`) roda no app, em Deno (Edge) e em Node (testes/admin).
+ Ecossistema maduro, forte base de conhecimento para agentes de IA.
+ OTA reduz ciclo de correção.
− Dependência do Expo/EAS (vendor). Mitigação: managed workflow é ejetável; `expo prebuild` mantém saída nativa reproduzível.
− Bundle inicial maior que nativo; aceitável.
− Novas versões do SDK exigem upgrade disciplinado (chore trimestral).

## Consequences
- Estrutura `apps/mobile` definida em [REPOSITORY-STRUCTURE](../architecture/REPOSITORY-STRUCTURE.md).
- Fase Foundation cria o app vazio com lint/typecheck/test configurados — **sem telas de produto**.

## Security Impact
- Nunca `service_role` no bundle; apenas `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- EAS Update com code signing e MFA na conta Expo (T21 no threat model).
- Deep links via Expo Router com validação zod dos parâmetros.

## Reversibility
Baixa-média (troca de framework é reescrita de UI). O domínio em `packages/core` sobrevive a uma troca de framework.
