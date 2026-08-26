# SECURITY BASELINE

| Campo | Valor |
|---|---|
| Status | Draft v0.1 — aguardando aprovação |
| Owner | AppSec / Engenharia |
| Relacionados | [THREAT-MODEL](THREAT-MODEL.md) · [SUPABASE-RLS-STRATEGY](SUPABASE-RLS-STRATEGY.md) · [MCP-POLICY](MCP-POLICY.md) |

Princípio: **Zero trust toward client applications.** O app mobile é um cliente hostil por hipótese.

---

## 1. Regras invioláveis (para humanos e agentes)

| # | Regra |
|---|---|
| S1 | `RLS ON` em toda tabela do schema `public`. Sem exceção. Tabela sem policy = ninguém acessa (fail closed). |
| S2 | `service_role` **nunca** no app mobile, em código client, em `.env` do app, em EAS secrets do build. Só em Edge Functions e CI de migrations. |
| S3 | Nenhum segredo em git, em `CLAUDE.md`, em docs, em prompts, em logs. `.env.example` contém apenas nomes. |
| S4 | Autorização é decidida no servidor (RLS/RPC/Edge). Esconder botão não é autorização. |
| S5 | Toda função `SECURITY DEFINER` exige: justificativa em SPEC, `SET search_path = ''` (ou schema fixo), validação de `auth.uid()`, validação de argumentos, `REVOKE EXECUTE ... FROM PUBLIC, anon` e `GRANT` mínimo, teste. |
| S6 | Toda mudança de RLS/policy/grant passa por PR com label `security` e possui teste automatizado (pgTAP ou script) positivo **e** negativo. |
| S7 | Regras premium verificadas no servidor (`has_entitlement()`); cliente só decide o que exibir. |
| S8 | Migrations destrutivas (`DROP`, `TRUNCATE`, remoção de coluna com dados, `ALTER ... DROP CONSTRAINT`, desativar RLS) exigem aprovação humana explícita e plano de rollback. |
| S9 | Inputs externos (form, deep link, RPC args, webhook, Edge body) são validados por schema antes de qualquer uso. |
| S10 | Erros expostos à usuária nunca revelam SQL, stack, existência de recursos de terceiros ou detalhes de infra. |
| S11 | Nenhum dado pessoal (nome, email, notas livres, respostas) em logs, analytics ou crash reports. Apenas `user_id` opaco. |
| S12 | Dependências novas exigem checklist de supply chain ([ENGINEERING-WORKFLOW](../architecture/ENGINEERING-WORKFLOW.md#supply-chain)). |

## 2. Identidade e sessão (resumo — ADR-005)

- Supabase Auth. Provedores no MVP (D-21): Sign in with Apple, Google, **Email OTP passwordless**. Email+senha não é fluxo principal.
- Tokens em `expo-secure-store`; nunca em AsyncStorage plano.
- Refresh token rotation habilitado; sessão expira por inatividade (configuração do projeto).
- OTP: expiração ≤ 10 min, uso único, mensagens genéricas anti-enumeração; sem fluxo de reset de senha.
- Rate limits nativos do Auth mantidos; Captcha (Turnstile) em signup/OTP avaliado antes do lançamento público.
- Exclusão de conta: fluxo próprio, grace period, purga completa.

## 3. Autorização — camadas

```
1. RLS (linha)            → ownership: user_id = auth.uid()
2. Grants (tabela/função) → authenticated vs anon vs service_role
3. RPC (operação)         → transições de estado válidas, idempotência
4. Entitlements           → has_entitlement(code) server-side
5. Admin                  → claim app_role + admin_users + MFA
```

Nenhuma camada substitui a outra. Detalhes em [SUPABASE-RLS-STRATEGY](SUPABASE-RLS-STRATEGY.md).

## 4. Admin

- MVP sem UI admin. Acesso ao Supabase Dashboard: apenas fundadores, MFA obrigatório, sem compartilhamento de conta.
- Operações administrativas = migration/seed revisada **ou** RPC administrativa que escreve em `audit_log`.
- Pós-MVP (`apps/admin`): `admin_users` + custom claim `app_role` via Auth Hook (custom access token hook) + `is_admin()` verifica **claim e tabela**; MFA obrigatório (`aal2`) para policies admin; sessão curta; auditoria em toda mutação.
- Nunca `profiles.role = 'admin'` editável pela própria usuária.

## 5. Edge Functions

- Verificar JWT em toda função chamada pelo app (`verify_jwt` + leitura de `auth.uid()` a partir do token, nunca de body).
- Webhooks: verificar assinatura HMAC do provider; rejeitar sem assinatura; idempotência por `event_id`.
- Service role: instanciado apenas dentro da função, escopo mínimo, nunca retornado/logado.
- Rate limiting: por `user_id` (tabela `rate_limits` ou Upstash — decidir na SPEC) para `generate-plan`.
- Sem `console.log` de payload completo.

## 6. Segredos e configuração

| Onde | O que pode existir |
|---|---|
| Bundle mobile (`EXPO_PUBLIC_*`) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, chave pública do billing SDK, DSN público de crash (aceitos como públicos) |
| EAS Secrets | Credenciais de build/assinatura de app apenas |
| Supabase Edge secrets | `SERVICE_ROLE_KEY` (injetada pela plataforma), `BILLING_WEBHOOK_SECRET`, chaves de provedores |
| GitHub Actions secrets | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` (staging/prod separados por environment com approval) |
| Git | **nada** |

Rotação: ao suspeitar de vazamento, rotacionar imediatamente (runbook `docs/runbooks/secret-rotation.md` — a criar na fase Foundation).
Scanner: gitleaks em pre-commit (opcional) e obrigatório em CI.

## 7. Privacidade (LGPD) — decisões de arquitetura

- **Data minimization:** não coletar gênero, nascimento, telefone, fotos, localização no MVP.
- Separação lógica: conta (`auth`), perfil (`profiles`), produto (`hair_*`, `care_*`), analytics (externo, pseudonimizado), marketing (não existe no MVP).
- Consentimentos versionados (`consents`); analytics só após consentimento (ou legítimo interesse documentado — decisão jurídica, **CAN DEFER**).
- Direitos: exclusão (MVP), exportação (arquitetura pronta; UI pós-MVP inicial), correção (edição de perfil = nova versão).
- Retenção: dados de produto até exclusão da conta; analytics ≤ 12 meses; audit_log ≥ 12 meses (proposta).
- Disclaimer: conteúdo não é orientação médica/dermatológica.

## 8. Logging e observabilidade

- Nunca logar: tokens, senhas, segredos, emails, nomes, notas livres, respostas de diagnóstico, corpos de webhook completos.
- Correlation id por request nas Edge Functions.
- Sentry (se adotado): `sendDefaultPii: false`, `beforeSend` com scrub.
- Analytics: propriedades restritas ao catálogo tipado (ADR-010).

## 9. Uploads (futuro — não no MVP)

Se fotos forem introduzidas: bucket privado; path `user/{auth.uid()}/...`; policy de Storage por prefixo; MIME allowlist (`image/jpeg`, `image/png`, `image/heic`); tamanho máx (ex. 8 MB); signed URLs curtas; strip de EXIF (geolocalização) no servidor; sem execução de conteúdo; SPEC própria + threat model atualizado.

## 10. Rate limiting — inventário

| Endpoint | Mecanismo | Fase |
|---|---|---|
| login / signup / reset | Supabase Auth nativo + Captcha | Identity |
| generate-plan | Edge Function: N por usuária/hora | Schedule |
| complete_care / checkin | Idempotência + RPC (barato) | Care Tracking |
| billing-webhook | Assinatura + idempotência | Subscription |
| share / referral / deep link | A definir na SPEC | Growth |
| admin RPCs | Auditoria + baixo volume | Admin |

## 11. Supply chain

- `pnpm` com lockfile commitado; `pnpm audit` em CI (falha em high/critical).
- Dependabot/Renovate semanal; atualizações major exigem revisão.
- Checklist para nova dependência: necessidade, alternativa em poucas linhas, manutenção ativa (< 12 meses), downloads, licença (MIT/Apache/BSD), tamanho, transitivas, histórico de CVEs.
- Sem `postinstall` scripts desconhecidos (`pnpm` bloqueia por padrão — manter).
- Ações do GitHub pinadas por SHA.

## 12. Segurança do processo com agentes de IA

- Agente não altera RLS, auth, migrations destrutivas, dependências ou `CLAUDE.md` sem instrução explícita (ver `CLAUDE.md`).
- PRs com mudança em `supabase/` ou `packages/core/src/**/domain` exigem revisão humana (CODEOWNERS).
- MCPs com escrita em Supabase apontam **somente** para projeto de desenvolvimento ([MCP-POLICY](MCP-POLICY.md)).
- Diff review obrigatório: agente reporta arquivos alterados, impacto em autorização e banco.

## 13. Checklist de segurança por SPEC (copiar na seção "Security Considerations")

- [ ] Quais tabelas/colunas novas? RLS definida para SELECT/INSERT/UPDATE/DELETE?
- [ ] Alguma função `SECURITY DEFINER`? Justificada, `search_path` fixo, grants mínimos?
- [ ] Inputs validados por schema (cliente e servidor)?
- [ ] Idempotência necessária?
- [ ] Entitlement verificado no servidor?
- [ ] PII nova? Adicionada à matriz do DATA-MODEL? Fica fora de logs/analytics?
- [ ] Teste de RLS positivo e negativo?
- [ ] Rate limit necessário?
- [ ] Rollback da migration?
