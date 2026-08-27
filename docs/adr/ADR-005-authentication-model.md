# ADR-005 — Authentication Model

**Status:** **Accepted** (diff da revisão D-21 aprovado por humano em 2026-08-26) · **Data:** 2026-08-26
**Escopo de implementação:** autenticação permanece fora da SPEC-000; implementada somente sob SPEC-001, preservando todos os requisitos de segurança desta revisão.

## Context
Público jovem, mobile, baixa tolerância a fricção (P01). Apple exige Sign in with Apple quando há login social de terceiros. Fluxos de senha trazem reset, credential stuffing e verificação de senhas vazadas. Admin exige modelo mais forte. Não implementar agora; decidir o modelo.

## Decision
- **Provider:** Supabase Auth (GoTrue). Sem auth próprio.
- **Métodos (usuária, MVP):** **Sign in with Apple**, **Google Sign-In** e **Email OTP (passwordless, código de 6 dígitos)**. Email + senha **não** é fluxo principal do MVP (pode ser desabilitado na configuração do projeto). Sem telefone/SMS (custo, SIM swap, PII).
- **Recuperação de acesso:** o próprio Email OTP; não existe fluxo de reset de senha. Recuperação para quem perdeu acesso ao email é operação de suporte auditada (pós-MVP; runbook).
- **Account linking / duplicidade:** email verificado é a chave de vinculação; Supabase vincula identidades com o mesmo email verificado automaticamente (`manual linking` desligado no MVP). Apple "Hide My Email" (relay) é tratado como email distinto — a SPEC de Identity deve definir a UX de colisão ("já existe conta com este email — entre com o método original") e a política de merge (pós-MVP).
- **OTP:** expiração curta (≤ 10 min), uso único, rate limit nativo do Auth + Captcha (Turnstile) antes do lançamento público; mensagens genéricas anti-enumeração.
- **Sessão:** JWT de acesso curto (padrão 1h) + refresh token rotation; tokens em `expo-secure-store`; logout revoga refresh token e cancela notificações locais.
- **Deep links de auth** (OTP/magic link, OAuth callback): rota allowlisted, parâmetros validados, sem tokens em logs; preferir código digitado a link clicável no MVP para reduzir superfície de deep link.
- **Onboarding anônimo:** não usar usuários anônimos no MVP; onboarding começa localmente e a conta é criada antes de persistir o Hair Profile.
- **Perfil:** ~~trigger `on auth.users insert` cria `profiles`~~ — **Amendment A1 (SPEC-001 aprovada, 2026-08-26):** o provisionamento do perfil de aplicação é **adiado para a SPEC-002** e feito por comando idempotente na primeira sessão autenticada (Opção B); a SPEC-001 **não** usa trigger em `auth.users` nem RPC `ensure_my_profile`. A decisão principal desta ADR (Apple + Google + Email OTP) permanece inalterada.
- **Admin (pós-MVP):** mesma instância de Auth; `admin_users` + custom claim `app_role` via Custom Access Token Hook; MFA TOTP obrigatório (`aal2`); sessão mais curta; sem login social para admin.
- **Exclusão de conta:** exigida pela Apple; **Amendment A1:** a SPEC-001 registra o pedido em `account_deletion_requests` por acesso direto (grants mínimos + RLS + constraints; sem RPC wrapper); a exclusão efetiva de `auth.users` permanece privilegiada/server-owned e a política (imediata vs grace) é decisão humana pendente (D-55).

A SPEC-001 (Identity) deve tratar explicitamente: Sign in with Apple; Google; Email OTP; account linking; prevenção de contas duplicadas; colisão email/provider; expiração de OTP; rate limiting; deep link security; sessão; logout; account recovery.

## Alternatives Considered
- **Apple + Google + email/senha com confirmação (versão anterior desta ADR):** mais fricção (senha + confirmação), fluxo de reset, superfície de credential stuffing. Rejeitada por decisão humana D-21.
- Auth0/Clerk/Firebase Auth: duplicam identidade e quebram `auth.uid()` nativo em RLS.
- Apenas social login: exclui usuárias sem conta Apple/Google e complica QA.
- Usuários anônimos com claim posterior: melhora TTV, mas complica merge/RLS/limpeza; adiado.

## Trade-offs
+ Menor fricção; sem reset de senha; sem senhas para vazar.
+ RLS nativa com `auth.uid()`; zero código de auth próprio.
− Dependência da caixa de email na primeira entrada (entregabilidade de email é requisito operacional: provedor SMTP próprio configurado no Supabase antes do lançamento).
− Configuração Apple/Google exige contas de desenvolvedor.
− Colisões com Apple relay exigem UX explícita.

## Consequences
- SPEC-001 detalha fluxos, telas, erros, testes, incluindo inbox de teste local (Inbucket/Mailpit do `supabase start`).
- Foundation não implementa auth; apenas registra variáveis em `.env.example`.

## Security Impact
Alto. Cobre T01 (reduzido: sem senhas), T05, T10, T12, T13.

## Reversibility
Média: adicionar email+senha depois é trivial (configuração); migrar provedores de auth é doloroso.

## Change Log
| Data | Mudança |
|---|---|
| 2026-08-26 | Versão inicial: Apple + Google + email/senha. |
| 2026-08-26 | Revisão por decisão humana D-21: email/senha substituído por Email OTP passwordless; adicionadas seções de linking, OTP, deep links; lista de tópicos obrigatórios da SPEC-001. |
