# ADR-006 — Domain Boundaries

**Status:** **Accepted** (D-04, 2026-08-26) · **Data:** 2026-08-26

## Context
O prompt de fundação propôs 12 módulos. Módulos demais no MVP geram fronteiras artificiais; módulos de menos misturam regras críticas com UI.

## Decision
Bounded contexts do MVP (detalhes em [DOMAIN-MAP](../architecture/DOMAIN-MAP.md)):

| Contexto | Classificação | Código no MVP |
|---|---|---|
| Identity & Account | Supporting | sim |
| Hair Profile | Core | sim |
| Diagnostic | Core (regras) | sim |
| Schedule / Planning | Core (regras) | sim |
| Care Tracking (calendar + execution + check-in) | Core | sim |
| Progress | Supporting | sim (mínimo) |
| Notifications | Supporting | sim (intents + canal local) |
| Content | Supporting | sim (seed + leitura) |
| Subscription & Entitlements | Supporting / segurança | sim |
| Audit | Supporting | sim (tabela + RPC) |
| Growth | Generic | **não** (placeholder) |
| Admin UI | Supporting | **não** |

Mudanças em relação ao original: `Calendar` + `Check-ins` + execução fundidos em **Care Tracking**; `Admin` dividido em Audit (agora) e Admin UI (depois); `Growth` sem código.

Regras de fronteira:
1. Contextos se comunicam por **tipos do core** (snapshots imutáveis) e por **dados no Postgres**; nunca por importar internals (`domain/*`) de outro contexto — só o `index.ts` público de cada contexto.
2. Engines (`Diagnostic`, `Schedule`) não conhecem persistência.
3. `Subscription` expõe apenas `EntitlementService`; nenhum outro contexto conhece o provider.
4. Cada contexto tem `README.md` curto com: responsabilidade, entidades, invariantes, SPECs relacionadas.

## Alternatives Considered
- Manter 12 módulos como listados: mais "completo", porém Calendar/Check-in separados duplicariam a noção de dia local e quebrariam o agregado.
- Um único módulo "hair": rápido, mas engines misturam com tracking — inaceitável para testabilidade.

## Trade-offs
+ Menos fronteiras, cada uma com motivo.
− Care Tracking é o maior contexto; exige subpastas claras (`calendar/`, `execution/`, `checkin/`).

## Consequences
Estrutura de `packages/core/src/` segue estes nomes. SPECs são numeradas por contexto.

## Security Impact
Fronteira explícita para Subscription/Entitlements e Audit reduz risco T04.

## Reversibility
Alta: contextos podem ser divididos posteriormente.
