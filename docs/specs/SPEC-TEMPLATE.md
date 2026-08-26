# SPEC-NNN — Título

| Campo | Valor |
|---|---|
| ID | SPEC-NNN |
| Status | Draft / In Review / Approved / In Progress / Implemented / Superseded |
| Owner | (humano responsável) |
| Bounded Context | (ver DOMAIN-MAP) |
| Related ADRs | ADR-xxx, ADR-yyy |
| Related SPECs | SPEC-xxx |
| Fase do roadmap | |
| Criado / Atualizado | YYYY-MM-DD / YYYY-MM-DD |

## 1. Context
Por que esta feature existe agora. Hipótese do produto que suporta (H1–H5).

## 2. Problem
O problema concreto da usuária / do sistema.

## 3. Goals
- G1 …

## 4. Non-Goals
- NG1 … (explícito: o que **não** entra)

## 5. User Stories
- US1: Como usuária, quero … para …

## 6. Functional Requirements
- FR1 … (verificável)

## 7. Business Rules
- BR1 … (regra invariável; onde vive no código: `packages/core/src/<ctx>/...`)

## 8. Data Model Impact
Tabelas/colunas novas ou alteradas; ownership; lifecycle; índices; constraints; migração de dados existentes. Atualizar `DATA-MODEL.md`.

## 9. API / Contracts
RPCs, Edge Functions, schemas zod (input/output), erros retornados, idempotência.

## 10. Authorization
Quem pode fazer o quê. Policies RLS por verbo. Entitlements exigidos. `SECURITY DEFINER`? (justificar).

## 11. Security Considerations
Checklist SECURITY-BASELINE §13. Ameaças do THREAT-MODEL afetadas (T-ids). Rate limit.

## 12. Privacy Considerations
Dados pessoais novos? Necessários? Retenção. Exclusão/exportação. Fora de logs/analytics.

## 13. Analytics Events
Eventos do catálogo (novos ou existentes) com propriedades permitidas.

## 14. UX Notes (sem design visual)
Objetivo principal de cada tela; estados (loading/empty/error/offline); acessibilidade (labels, toque, Dynamic Type).

## 15. Edge Cases
- EC1 … (rede instável, double submit, timezone, multi-device, dados ausentes)

## 16. Failure Modes
O que acontece quando X falha; degradação; mensagens de erro (sem detalhes internos).

## 17. Acceptance Criteria
- AC1: Dado … quando … então …

## 18. Testing Strategy
Unit (core) · Integration (Supabase/RLS/RPC) · E2E (jornada) · Golden tests (engines) · Manual smoke.

## 19. Dependencies
SPECs, ADRs, serviços externos, credenciais, dependências npm novas (com checklist de supply chain).

## 20. Implementation Plan
Passos pequenos com blast radius mínimo; ordem; PRs previstas.

## 21. Migration Plan
Migrations (ordem), dados existentes, compatibilidade com app antigo (OTA/versões).

## 22. Rollback Plan
Como reverter código, migration e dados.

## 23. Open Questions
- OQ1 … (classificação: BLOCKING / IMPORTANT / CAN DEFER; assunção adotada enquanto aberta)

## 24. Change Log
| Data | Mudança | Autor |
|---|---|---|
