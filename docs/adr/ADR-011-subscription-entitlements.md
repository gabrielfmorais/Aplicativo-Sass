# ADR-011 — Subscription & Entitlements

**Status:** **Accepted — forma** (D-09, 2026-08-26). **Provider: DEFERRED** (D-24) — RevenueCat permanece apenas candidato; nenhuma menção a provider nesta ADR é decisão. · **Data:** 2026-08-26

## Context
Monetização Free/Trial/Premium via lojas (IAP obrigatório para conteúdo digital). Precisamos que a permissão premium seja decidida no servidor, que a lógica de provider não vaze para o domínio, e que checagens não se espalhem (`if plan === 'premium'`).

## Decision

```
Store IAP  →  Billing Provider (RevenueCat — candidato)  →  webhook  →  Edge Function billing-webhook
                                                                              ↓ (service role)
                                                                        subscriptions (Postgres)
                                                                              ↓
                                             has_entitlement(code) / get_my_entitlements()  (RPC INVOKER)
                                                                              ↓
                                    packages/core EntitlementService.can(code)  ←  app (cache curto)
```

- **Três camadas separadas:** Billing Provider (ACL na Edge Function) → `Subscription` (estado: trial/active/grace/expired/cancelled/refunded) → `Entitlement` (capacidade).
- **Entitlements nomeados por capacidade**, nunca por plano: `advanced_insights`, `plan_customization`, `premium_content`. Mapeamento plano→entitlements em **um** arquivo do core (`subscription/entitlements/catalog.ts`) espelhado na função SQL `has_entitlement`.
- **Fonte de verdade = servidor.** Recursos premium têm verificação server-side (RLS em `content_articles`, RPCs que checam `has_entitlement`). O app usa `EntitlementService` só para UI (mostrar/ocultar/paywall) com cache ≤ 5 min e refresh após compra.
- **Free por padrão**: ausência de linha em `subscriptions` = free. Trial é estado da subscription (vindo do provider), não flag no perfil.
- **Webhook**: HMAC verificado, idempotente por `event_id`, grava `audit_log`. Reconciliação diária opcional com API do provider (pós-MVP).
- **Provider:** RevenueCat é o candidato (abstrai App Store/Play, webhooks, sandbox). Decisão final em SPEC-010 com avaliação de custo/alternativas (Adapty, Qonversion, StoreKit/Play Billing direto).
- **MVP faseado:** até a fase Subscription, `EntitlementService` retorna free para todos; nenhuma feature premium é construída antes disso.

## Alternatives Considered
- Stripe: proibido para conteúdo digital in-app pela Apple (e Google), exceto casos regionais; risco de rejeição.
- StoreKit 2 + Play Billing direto: sem custo de provider, mas duas integrações, validação de recibo própria, webhooks (App Store Server Notifications) — mais código sensível.
- Flag `is_premium` em `profiles`: simples e **inseguro** (T04).

## Trade-offs
+ Segurança e testabilidade; troca de provider sem tocar domínio.
− Custo do provider a partir de certo volume; dependência de webhook (latência de segundos após compra — UI faz refresh explícito).

## Consequences
DATA-MODEL `subscriptions`; RPCs `get_my_entitlements`, `has_entitlement`; Edge Function `billing-webhook`; SPEC-010.

## Security Impact
Mitiga T04, T18. Nenhuma escrita de `subscriptions` pelo cliente.

## Reversibility
Alta na camada de provider; média no modelo de entitlements.
