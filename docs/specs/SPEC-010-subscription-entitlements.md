# SPEC-010 — Subscription & Entitlements

| Campo | Valor |
|---|---|
| ID | SPEC-010 |
| Status | **Approved — Parte 1** (infraestrutura: PR-A core, PR-B banco, PR-C Edge — decisão humana D-78, 2026-08-29). **Parte 2** (PR-D paywall/SDK, PR-E capacidade premium) permanece **não aprovada**, bloqueada por OQ1/OQ2/OQ3 (D-79). |
| Owner | (humano) — projetopaporeto.erp@gmail.com |
| Bounded Context | Subscription & Entitlements (DOMAIN-MAP §3.9) |
| Related ADRs | ADR-011 (Subscription & Entitlements), ADR-004 (Supabase), ADR-010 (Analytics), ADR-001 (Arquitetura) |
| Related SPECs | SPEC-000 (foundation: `has_entitlement` reservado), SPEC-001 (auth), SPEC-009 (Progress — candidato a insights premium) |
| Fase do roadmap | 9 |
| Criado / Atualizado | 2026-08-29 / 2026-08-29 (v0.2, aprovação parcial) |

> **Nota de escopo (necessidade / §0.2):** esta SPEC entrega a **infraestrutura** Billing → Subscription → Entitlement e o **paywall**, que são provider-agnósticos, seguros e testáveis. Três decisões são **TRUE HUMAN GATES** e ficam como OQ **BLOCKING**: (a) escolha do provider + custo, (b) preços/plano, (c) qual capacidade premium é liberada primeiro.
>
> **Recomendação da revisão (`spec-review`, 2026-08-29):** aprovar em **duas partes**. **Parte 1 — infraestrutura (PR-A core, PR-B banco, PR-C Edge):** não depende de nenhuma das três OQ, é provider-agnóstica e inteiramente testável em local/CI; pode ser aprovada e implementada já. **Parte 2 — app (PR-D paywall + SDK, PR-E capacidade premium):** só depois de OQ1/OQ2/OQ3. Aprovar a Parte 1 destrava ~2/3 da fase sem antecipar nenhuma decisão comercial nem gastar um centavo.

## 1. Context
Fase 9 do MVP-ROADMAP. Hipótese **H5** (PRODUCT-BRIEF): existe disposição a pagar, medida pelo funil `subscription_viewed → trial_started → subscription_started` (meta trial→paid ≥ 20%). Até aqui `EntitlementService` retorna free para todas (ADR-011 §MVP faseado); nenhuma feature premium foi construída — por decisão ("valor antes do paywall"). Agora o loop diário e o mensal estão completos, então há valor entregue antes de introduzir o paywall.

## 2. Problem
Precisamos cobrar por assinatura **dentro das lojas** (IAP é obrigatório para conteúdo digital — Apple/Google; cobrança externa = risco de rejeição, PRODUCT-BRIEF risco §), decidir a permissão premium **no servidor** (nunca `if plan === 'premium'` no cliente — ameaça T04), e refletir com segurança o estado de assinatura vindo do provider sem vazar a lógica do provider para o domínio.

## 3. Goals
- G1 — Refletir o estado de assinatura do provider em `public.subscriptions`, escrito **somente** pelo servidor (webhook/service role).
- G2 — Derivar **entitlements por capacidade** server-side (`has_entitlement`, `get_my_entitlements`), fonte de verdade única.
- G3 — `EntitlementService.can(code)` puro no core, usado **só para UI** (mostrar/ocultar/paywall), com cache curto e refresh após compra.
- G4 — Paywall Free/Trial/Premium com o funil H5 instrumentado.
- G5 — Gate server-side real sobre **uma** capacidade premium (a primeira; ver OQ3), provando a cadeia ponta a ponta.
- G6 — Trocar de provider depois sem tocar domínio nem schema de entitlements (ADR-011 reversibilidade).

## 4. Non-Goals
- NG1 — Reconciliação diária com a API do provider (pós-MVP; ADR-011). MVP confia no webhook + refresh explícito.
- NG2 — Múltiplos tiers/planos simultâneos, upgrade/downgrade com proração, add-ons. **Um** plano premium no MVP.
- NG3 — Códigos promocionais, cupons, referral, trials estendidos manuais, family sharing.
- NG4 — Billing na web / fora das lojas.
- NG5 — Reembolso/estorno além de refletir o `status` que o provider enviar (sem fluxo de suporte próprio).
- NG6 — `Entitlement` como **tabela** — é **função derivada** no MVP (DOMAIN-MAP §3.9).
- NG7 — Construir várias features premium. Só a primeira capacidade (OQ3) é gated aqui; as demais são SPECs próprias.
- NG8 — Admin/painel de assinaturas.

## 5. User Stories
- US1 — Como usuária free, quero entender o que ganho no premium e iniciar um trial sem fricção.
- US2 — Como usuária em trial/assinante, quero acessar a capacidade premium imediatamente após comprar.
- US3 — Como usuária que trocou de aparelho ou reinstalou, quero **restaurar** minha assinatura.
- US4 — Como usuária cuja assinatura expirou, quero uma degradação clara para free, sem perder meu histórico.

## 6. Functional Requirements
- FR1 — O app apresenta o paywall com a proposta de valor da capacidade premium e o preço vindo da loja (nunca hard-coded).
- FR2 — Compra e trial são feitos via **IAP nativo** intermediado pelo provider (SDK no app).
- FR3 — Após compra/trial, o provider notifica o backend por **webhook**; o backend atualiza `subscriptions`.
- FR4 — O app faz **refresh explícito** de entitlements após a compra e ao abrir (cache ≤ 5 min), sem depender do timing do webhook para a primeira liberação (ver FR9).
- FR5 — A capacidade premium (OQ3) só funciona se `has_entitlement(<code>)` for verdadeiro **no servidor**.
- FR6 — "Restaurar compras" reconsulta o provider e reflete o estado.
- FR7 — Sem assinatura (ausência de linha ou status não-ativo) ⇒ free; nenhum recurso premium acessível; histórico intacto.
- FR8 — O webhook é **idempotente** por `event_id`: reentrega não duplica efeito nem corrompe estado.
- FR9 — Liberação imediata após compra: o app pode confiar no resultado do SDK do provider para UI otimista, **mas** todo acesso premium efetivo revalida server-side (FR5). (Fecha a latência de segundos do webhook sem abrir brecha.)

## 7. Business Rules
- BR1 — **Free por padrão** (ADR-011): ausência de linha em `subscriptions` = free. Trial é `status` da subscription, não flag no perfil. Vive em `has_entitlement`/catalog.
- BR2 — Entitlements são nomeados por **capacidade**, nunca por plano: `advanced_insights`, `plan_customization`, `premium_content` (catálogo inicial, DOMAIN-MAP §3.9). Mapeamento status→capacidades em **um** arquivo do core (`packages/core/src/subscription/entitlements/catalog.ts`) **espelhado** pela função SQL `has_entitlement` (mesmo teste de paridade que já usamos para deno/import-map).
- BR3 — Status que concedem acesso: `trial`, `active`, `grace`. Status que negam: `expired`, `cancelled`, `refunded`. (Enum fechado.)
- BR4 — `subscriptions` é escrita **exclusivamente** pelo servidor, por **uma** RPC `SECURITY DEFINER` (`apply_billing_event`) com EXECUTE só para `service_role`, chamada pela Edge `billing-webhook`. O cliente tem **apenas SELECT** da própria linha. (Mesmo padrão de `create_plan_tx` — SPEC-004 §12b: nenhum papel de cliente detém INSERT/UPDATE, e o write path é um só, allowlistado e testável.)
- BR5 — A verdade é o servidor. `EntitlementService.can` no core é conveniência de UI; qualquer recurso premium tem verificação server-side (RLS/RPC checando entitlement). `if (plan === 'premium')` fora do `EntitlementService` é bug (ADR-011).
- BR6 — Domínio não conhece o provider: nomes/segredos/SDK do provider ficam na Edge Function (ACL) e no app (SDK), nunca em `packages/core`.

## 8. Data Model Impact
Atualizar `DATA-MODEL.md` (§3.12 e o diagrama ER). **Necessidade revisada (YAGNI):** só o mínimo para decidir entitlement + garantir idempotência/auditoria.

- **`public.subscriptions`** — uma linha por usuária (estado corrente):
  - `user_id uuid primary key references auth.users(id) on delete cascade` — 1:1, sem id sintético (a usuária é a chave natural).
  - `status text not null check (status in ('trial','active','grace','expired','cancelled','refunded'))`.
  - `product_code text not null` — identificador do produto IAP (loja), para telemetria/suporte.
  - `current_period_ends_at timestamptz` — quando expira o acesso corrente (nullable p/ estados sem período).
  - `provider text not null check (provider in ('revenuecat','apple','google','manual'))` — origem, para portabilidade/depuração (mesmo enum do DATA-MODEL §3.12).
  - `updated_at timestamptz not null default now()` (trigger `set_updated_at` da foundation).
  - RLS ON+FORCE; grant **SELECT** a `authenticated` (own row); nada para `anon`; nenhum INSERT/UPDATE/DELETE de cliente.
- **Divergências deliberadas do DATA-MODEL §3.12** (a SPEC é a versão nova; o doc é atualizado na implementação):
  - **1:1 em vez de 1:N** (`profiles ||--o{ subscriptions` vira `||--o|`): o MVP tem **um** plano (NG2), então múltiplas linhas por usuária só criariam a pergunta "qual vale". Histórico de eventos vive em `billing_events`.
  - **Sem `id` e sem `provider_subscription_id`**: com 1:1, `user_id` é a chave natural; a correlação com o provider usa o `app_user_id` = `auth.users.id` que enviamos a ele. DEFER até haver necessidade real.
  - **Sem `raw_last_event jsonb`**: guardar payload cru do provider é superfície de PII/segredo sem uso no MVP (§12). Substituído por `payload_hash` em `billing_events`.
  - **Sem `trial_ends_at`/`cancelled_at`**: o acesso é decidido por `status` + `current_period_ends_at`; datas separadas não mudam nenhuma decisão hoje.
  - **`last_event_id` sai da linha de estado** e vira a PK de `billing_events` — idempotência deixa de ser convenção e passa a ser constraint (FR8).
- **`public.billing_events`** — idempotência + auditoria do webhook (condição B: integridade/segurança):
  - `event_id text primary key` — id do evento do provider; o INSERT `on conflict do nothing` é o guard de idempotência (FR8).
  - `user_id uuid` (nullable se o evento não mapear a uma usuária conhecida), `type text not null`, `occurred_at timestamptz not null` (timestamp **do provider**, usado na regra de ordenação EC3), `received_at timestamptz not null default now()`, `payload_hash text` (sem PII/segredos; **não** guardamos o payload cru).
  - RLS ON+FORCE; **nenhum** grant a `anon`/`authenticated` (tabela de servidor); escrita só pela RPC `apply_billing_event`.
  - **Substitui `audit_log` para este escopo** — ADR-011 previa que o webhook gravasse `audit_log`, que **não existe** (adiada desde a SPEC-001). Construir a tabela genérica agora, para um único produtor, é escopo que ninguém pediu (§0.2 regra de necessidade); `billing_events` é append-only e cobre a mesma necessidade com uma constraint de idempotência. **Amenda a ADR-011** — registrar no Decision Register na aprovação desta SPEC; `audit_log` continua no roadmap para quando houver ≥2 produtores.
- **`Entitlement`**: **função**, não tabela (NG6).

## 9. API / Contracts
- **Edge Function `billing-webhook`** (Deno):
  - Verifica **HMAC** do provider (segredo em env da função) — assinatura inválida ⇒ 401, nada gravado.
  - zod valida o corpo do evento (contrato do provider) antes de qualquer escrita; traduz o vocabulário do provider para o do domínio (ACL, BR6).
  - Chama **`apply_billing_event`** (uma chamada, uma transação) e responde 200 rápido; erro interno ⇒ 5xx para o provider **reentregar** (a idempotência cobre o retry).
- **RPC `apply_billing_event(p_event_id text, p_user_id uuid, p_type text, p_occurred_at timestamptz, p_provider text, p_status text, p_product_code text, p_current_period_ends_at timestamptz, p_payload_hash text) returns boolean`** — `SECURITY DEFINER`, `search_path` fixo, **EXECUTE só para `service_role`**, allowlistada (`supabase/security/allowlists.sql`). Numa transação: `insert into billing_events … on conflict (event_id) do nothing`; se 0 linhas ⇒ retorna false (no-op, já processado, FR8/EC2); senão faz **upsert** em `subscriptions` por `user_id` **descartando evento mais antigo que o estado corrente** (`occurred_at` do provider, EC3) e retorna true.
  - *Por que DEFINER e não escrita direta com service role:* é o padrão já estabelecido (`create_plan_tx`, SPEC-004 §12b) — nenhum papel de cliente ganha INSERT/UPDATE, o write path é único e allowlistado, e idempotência + ordenação + upsert ficam atômicos em vez de dois round-trips do Deno.
- **RPC `has_entitlement(p_code text) returns boolean`** — `STABLE`, SECURITY **INVOKER** (usa RLS + `auth.uid()`); lê a própria `subscriptions`; retorna `true` sse `status ∈ {trial,active,grace}` **e** `p_code` pertence ao catálogo premium. `search_path` fixo. (Usável em policy — SUPABASE-RLS-STRATEGY §2.)
- **RPC `get_my_entitlements() returns setof text`** — `STABLE`, INVOKER; retorna os códigos concedidos à usuária corrente (vazio se free). Fonte de verdade para o app.
- **Core `EntitlementService`** — `can(code, snapshot): boolean` puro; `EntitlementsPort.get(): Promise<string[]>` implementado pelo adapter chamando `get_my_entitlements`. Catálogo em `subscription/entitlements/catalog.ts`.
- Nenhuma escrita de `subscriptions` exposta ao cliente (contrato: read-only).

## 10. Authorization
- `subscriptions`: RLS ON+FORCE; policy `select` own (`user_id = (select auth.uid())`); **nenhuma** policy de escrita e **nenhum** grant de INSERT/UPDATE/DELETE a `anon`/`authenticated` ⇒ escrita de cliente negada por privilégio (42501), não só por policy. A escrita do servidor entra pela DEFINER `apply_billing_event` (dona `postgres`), como em SPEC-004.
- `billing_events`: RLS ON+FORCE, **sem policies e sem grants** a qualquer papel de cliente; escrita só pela DEFINER.
- `has_entitlement`/`get_my_entitlements`: EXECUTE a `authenticated`; INVOKER, então RLS da `subscriptions` limita ao dono; parâmetro é só um code (nada forjável — a usuária vem de `auth.uid()`).
- Recurso premium (OQ3): a RLS/RPC do recurso chama `has_entitlement(<code>)` server-side (não confia no cliente).

## 11. Security Considerations
Checklist SECURITY-BASELINE §13, item a item:
- **Tabelas/colunas novas + RLS por verbo:** `subscriptions` (SELECT own; escrita negada por ausência de grant) e `billing_events` (nenhum verbo para cliente) — §10.
- **`SECURITY DEFINER`:** uma, `apply_billing_event` — justificada em §9 (write path único, atômico), `search_path` fixo, EXECUTE só para `service_role`, entra na allowlist com rationale (guardrails `tests.unapproved_security_definer_functions` + `tests.unpinned_security_definer_functions`).
- **Inputs validados nos dois lados:** zod na Edge; CHECK de `status`/`provider` + FK de `user_id` + tipos no banco.
- **Idempotência:** sim — PK `event_id` (FR8/EC2) + guarda de ordenação por `occurred_at` (EC3).
- **Entitlement verificado no servidor:** sim — `has_entitlement` na RLS/RPC do recurso premium (FR5).
- **PII nova:** estado de assinatura — entra na matriz do DATA-MODEL §4; fora de logs e analytics (§12/§13).
- **Teste de RLS positivo e negativo:** AC3/AC4 (pgTAP), incluindo isolamento entre usuárias.
- **Rate limit:** `billing-webhook` entra no inventário de SECURITY-BASELINE §10 — é endpoint público sem JWT (a autenticação é o HMAC).
- **Rollback da migration:** §22.

Ameaças: **T04** (flag `is_premium` insegura) mitigada por verdade server-side; **T18** (webhook forjado) mitigada por HMAC + idempotência + validação zod. Rate limit da Edge conforme padrão. `service_role` só na Edge (§3). Sem PII/segredos em `billing_events`, logs ou analytics. Novo segredo externo: **webhook signing secret** do provider ⇒ **HUMAN GATE** (credencial). Nova dependência: SDK do provider no app (ex.: `react-native-purchases`) ⇒ **§4 gate** (instalar dependência) — ver OQ1/Dependencies.

## 12. Privacy Considerations
Dado pessoal novo: estado de assinatura (`status`, `current_period_ends_at`, `product_code`) — necessário para a funcionalidade (base legal: execução de contrato). **Não** guardamos payload cru do provider, nem dados de pagamento (ficam no provider/loja — nunca tocamos cartão). Retenção: enquanto a conta existir; `on delete cascade` remove com a conta (SPEC-001). Fora de logs/analytics: nada de `event_id`/valores atrelados à pessoa em analytics. LGPD (D-32) revisto no release (Fase 10).

## 13. Analytics Events
Catálogo ADR-010 (port no-op até Fase 10), **sem PII**. Emissor explícito, porque ADR-010 manda o funil de assinatura sair da fonte de verdade:

| Evento | Props | Emissor | Catálogo |
|---|---|---|---|
| `subscription_viewed` | `{ source }` | app — paywall exibido (H5) | ADR-010 |
| `trial_started` | `{ product_code }` | app, na confirmação do SDK (H5) | ADR-010 |
| `subscription_started` | `{ product_code }` | app, na confirmação do SDK (H5) | ADR-010 |
| `paywall_dismissed` | `{ source }` | app — denominador do funil | **novo — amenda ADR-010** |
| `subscription_restored` | `{}` | app (US3) | **novo — amenda ADR-010** |
| `subscription_cancelled` | `{ product_code }` | Edge `billing-webhook` | ADR-010 — **DEFER para a Fase 10** |

- Os dois eventos novos entram no catálogo da ADR-010 (change log da ADR) na implementação — o catálogo é fechado por decisão, não por hábito.
- `subscription_cancelled` fica adiado com razão explícita: ADR-010 exige emissor server-side e a Edge só ganha port de analytics na Fase 10 (SPEC-011, provider + consentimento); antes disso seria evento que ninguém recebe. O **estado** de cancelamento não depende dele — vem do webhook para `subscriptions`.
- `trial_started`/`subscription_started` saem do app por causa da latência do webhook (FR9): o funil H5 precisa do instante da decisão da usuária. Reconciliação com o provider é NG1.

## 14. UX Notes (sem design visual)
- **Paywall**: proposta de valor da capacidade premium; preço/período **da loja** (nunca hard-coded); CTA trial/assinar; "Restaurar compras"; termos/EULA e link de privacidade (exigência das lojas). Estados: loading (buscando produtos), erro+retry (loja indisponível), indisponível (IAP off no device).
- **Recurso premium (OQ3)**: quando sem entitlement, mostra estado bloqueado que leva ao paywall (não um erro).
- **Pós-compra**: liberação otimista imediata na UI (FR9) + refresh; se o servidor ainda não refletiu, o acesso efetivo revalida (sem "piscar" liberado/bloqueado — usar o resultado do SDK para a sessão).
- **Degradação (expirou)**: volta a free com aviso claro; histórico intacto (FR7).
- Acessibilidade: labels nos CTAs, alvos ≥ 44px, Dynamic Type; preço lido por leitor de tela.

## 15. Edge Cases
- EC1 — Webhook chega **antes** do retorno do SDK (ou vice-versa): idempotência + upsert por `user_id` convergem ao mesmo estado.
- EC2 — Reentrega/duplicata do mesmo `event_id`: `on conflict do nothing` ⇒ no-op.
- EC3 — Eventos **fora de ordem** (expira depois de renovar): `apply_billing_event` compara o `occurred_at` do provider com o do último evento aplicado e **descarta o mais antigo** — a regra vive na transação, não no handler Deno.
- EC4 — Compra sem conta/sessão válida: o SDK exige usuária autenticada; sem `app_user_id` não há upsert (evento fica em `billing_events` com `user_id null` para auditoria).
- EC5 — Multi-device: estado é server-side; todos os devices convergem no próximo refresh.
- EC6 — Rede instável no paywall: erro+retry; nunca cobra sem confirmação da loja.
- EC7 — Relógio do cliente adiantado: acesso decidido por `current_period_ends_at` **do servidor**, não pelo device.
- EC8 — Reembolso/cancelamento: provider envia `refunded`/`cancelled` ⇒ acesso cai no próximo check server-side.

## 16. Failure Modes
- Webhook indisponível: provider reentrega; app usa resultado do SDK para a sessão; próximo refresh reconcilia.
- HMAC inválido: 401, nada gravado, alerta.
- Loja indisponível: paywall mostra erro+retry; nenhuma cobrança.
- `get_my_entitlements` falha: **fail closed** ⇒ trata como free (nunca libera premium por erro).
- SDK do provider ausente/erro de init: paywall desabilitado com mensagem; resto do app intacto.

## 17. Acceptance Criteria
- AC1 — Dado um evento de compra válido, quando o webhook processa, então `subscriptions` reflete `active`/`trial` e `has_entitlement(<code>)` = true. (pgTAP)
- AC2 — Dado o mesmo `event_id` reentregue, quando reprocessado, então nenhum efeito duplicado (idempotência). (pgTAP)
- AC3 — Dado um cliente autenticado, quando tenta INSERT/UPDATE/DELETE em `subscriptions`, então é negado por RLS/grants (42501). (pgTAP pos/neg)
- AC4 — Dado assinatura ausente/expirada, quando checa a capacidade premium, então acesso é negado server-side e a UI leva ao paywall. (pgTAP + RNTL)
- AC5 — Dado HMAC inválido, quando o webhook recebe, então 401 e nada é gravado. (teste da Edge)
- AC6 — Dado o catálogo do core, quando comparado à função `has_entitlement`, então status→capacidades **batem** (teste de paridade). (unit + pgTAP)
- AC7 — Dado compra concluída, quando o app faz refresh, então a capacidade libera em ≤ 1 refresh sem depender do timing do webhook (FR9). (RNTL)
- AC8 — Funil `subscription_viewed → trial_started → subscription_started` emitido sem PII. (unit do catálogo de analytics)
- AC9 — `EntitlementService.can` é puro (sem React/Expo/@supabase/Deno/`new Date()`); boundaries verdes. (dep-cruise)
- AC10 — Dado um evento **mais antigo** que o estado corrente (`occurred_at` anterior ao último aplicado), quando processado, então o estado **não regride** e o evento fica registrado (EC3). (pgTAP)
- AC11 — Dado `apply_billing_event`, então é DEFINER com `search_path` pinado, está na allowlist, e `authenticated`/`anon` **não** têm EXECUTE — os guardrails `tests.unapproved_security_definer_functions`, `tests.unpinned_security_definer_functions` e `tests.unapproved_grants` seguem em 0. (pgTAP)
- AC12 — Dado um evento cujo `user_id` não mapeia a uma usuária conhecida, quando processado, então nada é escrito em `subscriptions` e o evento fica em `billing_events` com `user_id null` (EC4). (pgTAP)

## 18. Testing Strategy
- **Unit (core):** `EntitlementService.can`, catálogo status→capacidades, fail-closed.
- **Integration (pgTAP):** RLS de `subscriptions`/`billing_events`, `has_entitlement`/`get_my_entitlements` (INVOKER, isolamento, forjar code), `apply_billing_event` (idempotência, ordenação EC3, usuária desconhecida EC4, grants/allowlist/`search_path`), paridade catálogo↔SQL, negativos de escrita.
- **Edge:** verificação HMAC, validação zod do corpo, tradução evento do provider → parâmetros do domínio, 5xx em erro interno.
- **RNTL:** paywall (estados), liberação otimista + revalidação, restaurar, degradação.
- **E2E (Fase 10):** compra sandbox (depende de credenciais/loja — gate).
- **Manual smoke:** sandbox do provider (gate de credencial).

## 19. Dependencies
- **OQ1 — Provider (BLOCKING / HUMAN GATE):** RevenueCat é candidato (ADR-011). Escolha final = **custo real + credencial + decisão comercial**. Alternativas: Adapty, Qonversion, StoreKit2/Play Billing direto (sem custo de provider, mais código sensível).
- **SDK do app** (ex.: `react-native-purchases`) — **nova dependência** ⇒ §4 gate; checklist de supply chain no PR.
- **Contas de loja / produtos IAP / signing secret** — **HUMAN GATE** (credenciais externas que só o humano fornece; App Store Connect / Google Play Console).
- SPEC-001 (auth: `app_user_id = auth.users.id`), SPEC-000 (`has_entitlement` reservado).
- Espelhar `supabase/functions/deno.json` ↔ core (regra CLAUDE.md §0.2) se a Edge importar core.

## 20. Implementation Plan
Ordenado para maximizar trabalho **independente de gate** primeiro (§0.3):
1. **PR-A (core, sem gate):** `EntitlementService` + `catalog.ts` + tipos + unit tests. Provider-agnóstico.
2. **PR-B (DB, sem gate de código):** migration `subscriptions` + `billing_events` + RLS + `apply_billing_event` + `has_entitlement`/`get_my_entitlements` + pgTAP + allowlists. Não depende do provider.
3. **PR-C (Edge, quase sem gate):** `billing-webhook` — HMAC + zod + uma chamada a `apply_billing_event`, testável com fixtures de evento genéricas; o segredo/URL do provider entra por env no deploy (gate de credencial só no deploy, Fase 10).
4. **PR-D (app — GATE):** integração do SDK do provider + paywall + refresh. Depende de OQ1 (provider) + dependência (§4) + produtos IAP (credencial).
5. **PR-E:** gate server-side da primeira capacidade premium (OQ3).
> PRs A/B/C são **independentes dos gates** e podem ser implementadas assim que a SPEC for aprovada; D/E dependem dos gates.

## 21. Migration Plan
Migrations novas e aditivas (forward-only), na ordem: `subscriptions`, depois `billing_events`, depois as funções `apply_billing_event`, `has_entitlement` e `get_my_entitlements` (a DEFINER entra junto da allowlist, no mesmo PR). Sem dados existentes a migrar (contexto novo). Compatível com app antigo: sem linha ⇒ free (BR1), então clientes sem o paywall continuam funcionando.

## 22. Rollback Plan
- Código: reverter PRs (core/edge/app) — sem efeito destrutivo.
- Migration: `drop function` das RPCs; `drop table billing_events`, `subscriptions` (sem dados de produção antes do release). Após release, tratar como dado de usuária (não dropar; desativar caminho).
- App: feature flag do paywall (ocultar) reverte a exposição sem redeploy de backend.

## 23. Open Questions
- **OQ1 — Provider + custo (BLOCKING / TRUE HUMAN GATE).** Qual provider (RevenueCat candidato) e a que custo. *Assunção enquanto aberta:* arquitetura provider-agnóstica; PRs A/B/C não dependem da resposta.
- **OQ2 — Preço e plano (BLOCKING / TRUE HUMAN GATE).** Valor, moeda, período (mensal/anual), duração do trial. Decisão comercial. *Assunção:* preço/período vêm da loja em runtime; nada hard-coded.
- **OQ3 — Primeira capacidade premium (BLOCKING / decisão de produto material).** Qual das três (`advanced_insights` sobre SPEC-009 / `plan_customization` / `premium_content`) é liberada primeiro, e seu escopo mínimo. *Assunção de engenharia (não decisão):* `plan_customization` tende a ter menor risco de domínio (não inventa ciência capilar); confirmar com o dono. Feature premium substantiva pode virar SPEC própria (NG7).
- **OQ4 — Grace period (IMPORTANT).** Usar o `grace` nativo do provider (billing retry) como acesso concedido. *Assunção:* sim, `grace` concede acesso (BR3).
- **OQ5 — Reconciliação (CAN DEFER).** Cron diário com a API do provider. *Assunção:* fora do MVP (NG1); webhook + refresh bastam.
- **OQ6 — Conteúdo/insights premium e o gate de domínio (IMPORTANT).** Se OQ3 = `advanced_insights`/`premium_content`, qualquer orientação capilar substantiva cai no gate D-26/D-70 (`candidate → validated`) antes do PUBLIC RELEASE. *Assunção:* preferir uma primeira capacidade **sem** nova regra capilar para não acoplar dois gates.

## 24. Change Log
| Data | Mudança | Autor |
|---|---|---|
| 2026-08-29 | Draft inicial: infraestrutura Billing→Subscription→Entitlement + paywall provider-agnósticos; provider/preço/1ª capacidade isolados como OQ BLOCKING (human gates). | agente (§0.3) |
| 2026-08-30 | **PR-C implementada** (Edge, sem deploy): `supabase/functions/billing-webhook/` — verificação **HMAC-SHA256** sobre o corpo cru (constant-time, fail-closed), **zod** no contrato do evento, ACL provider→domínio (`webhook.ts`, único lugar com vocabulário do provider — BR6) e **uma** chamada a `apply_billing_event`; 5xx em erro interno para reentrega (idempotência cobre). `deno test` (7) cobre HMAC (vetores publicados, AC5), validação zod e tradução (EC4 uuid→null). Segredo/URL do provider entram por env no deploy (Fase 10, gate de credencial). **HUMAN GATE mínimo pendente:** adicionar `billing-webhook/index.ts` ao `deno check` e um passo `deno test` em `.github/workflows/core-deno.yml` (§4 — edição de `.github/`) para o CI reforçar type-check + testes; hoje o CI cobre prettier + `deno lint` + pgTAP. Verificado localmente: deno check/lint/test verdes. | agente (§0.3) |
| 2026-08-30 | **PR-B implementada** (banco): migration `20260902000000_subscriptions.sql` — `subscriptions` (1:1, SELECT own, escrita de cliente negada por privilégio) + `billing_events` (idempotência por `event_id`, ordenação por `occurred_at`, sem payload cru) + RPC `apply_billing_event` (DEFINER, EXECUTE só `service_role`, allowlistada, `search_path` pinado) + `has_entitlement`/`get_my_entitlements` (STABLE, INVOKER). pgTAP `070_spec010_subscriptions.sql` (AC1–AC3, AC6, AC10–AC12, isolamento, fail-closed). Paridade catálogo↔SQL por `scripts/check-entitlement-catalog-parity.mjs` (AC6). DATA-MODEL §3.12/§3.12b atualizado. Falta PR-C (Edge `billing-webhook`). | agente (§0.3) |
| 2026-08-29 | v0.2 — correções da revisão `spec-review`: (1) write path passa a ser a DEFINER `apply_billing_event` (EXECUTE só `service_role`, allowlistada), padrão `create_plan_tx`, em vez de policy de escrita para service role — idempotência + ordenação + upsert num só ato atômico; (2) divergências do DATA-MODEL §3.12 explicitadas e naming alinhado (`product_code`, `current_period_ends_at`, enum de `provider`, 1:1); (3) `billing_events` documentado como **amenda à ADR-011** (substitui `audit_log`, que não existe); (4) §13 ganha emissor por evento, marca `paywall_dismissed`/`subscription_restored` como amenda ao catálogo da ADR-010 e adia `subscription_cancelled` (server-side) para a Fase 10; (5) checklist SECURITY-BASELINE §13 respondido item a item; (6) AC10–AC12 (ordenação EC3, grants/allowlist/`search_path` da DEFINER, evento sem usuária conhecida); (7) `has_entitlement`/`get_my_entitlements` declaradas `STABLE`. Recomendação de aprovação em duas partes. | agente (§0.3) |
