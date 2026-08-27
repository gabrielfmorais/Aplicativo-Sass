# SPEC-001 — Identity & Authentication

| Campo | Valor |
|---|---|
| ID | SPEC-001 |
| Status | **Approved** (v0.3 aprovada por revisão humana de arquitetura, necessidade e segurança em 2026-08-26 — D-51; implementação ainda **não** iniciada) |
| Owner | @gabrielfmorais (humano) |
| Bounded Context | Identity & Account (DOMAIN-MAP §3.1) |
| Related ADRs | ADR-005 (Authentication Model — Accepted), ADR-004 (Supabase), ADR-001 (camadas), ADR-002 (Expo), ADR-010 (analytics) |
| Related SPECs | SPEC-000 (Foundation — implemented) · SPEC-002 (Hair Profile & Onboarding — recebe `profiles`, ver §8) · SPEC-013 (Release: SMTP produção, Captcha, termos/privacidade, caminho externo de exclusão para Google Play) |
| Decisões vinculantes | D-21 (Apple + Google + Email OTP), D-10 (exclusão via `account_deletion_requests`), D-13 (sem usuários anônimos), D-38 (Captcha deferred) |
| Fase do roadmap | 1 — Identity |
| Labels | `security`, `db` |
| Criado / Atualizado | 2026-08-26 / 2026-08-26 |

> Define arquitetura e comportamento. Nenhum código, migration, dependência, configuração de provider ou segredo é criado por esta SPEC. Princípio: **máxima segurança com a mínima complexidade necessária** — cada elemento existe por (1) funcionalidade central do MVP, (2) segurança/integridade/privacidade, (3) custo alto de corrigir depois ou (4) teste de hipótese central.

## 1. Context
Toda SPEC de produto depende de `auth.uid()` como base de ownership (RLS). O ICP tem baixa tolerância a fricção (H1: ≥ 60% concluem onboarding). D-21/ADR-005 fixaram Apple, Google e Email OTP passwordless; sem senha, sem SMS, sem anônimos.

## 2. Problem
Identificar a usuária de forma estável e segura, com o mínimo de passos; não criar contas duplicadas quando ela alterna provedores; manter sessão segura no dispositivo; sair e recuperar acesso; permitir solicitar exclusão de conta; e continuar seguro com o cliente mobile totalmente hostil.

## 3. Goals
- G1 Entrar com Apple, Google ou Email OTP (código digitado) em ≤ 3 interações após escolher o método.
- G2 Uma pessoa = uma conta quando os provedores entregam o **mesmo email verificado**; nunca unir por heurística de aplicação.
- G3 Sessão em **armazenamento seguro do runtime mobile**, com refresh automático e logout que revoga o refresh token.
- G4 Isolamento por RLS fail-closed para todo dado de usuária criado a partir daqui, provado por pgTAP.
- G5 Contrato mínimo de exclusão de conta (solicitar, cancelar, confirmação; exclusão efetiva é server-owned).
- G6 Nenhum OTP, token ou payload de provedor em logs, analytics ou persistência **controlados pela aplicação**; respostas não enumeráveis.

## 4. Non-Goals
Hair Profile/onboarding capilar e qualquer dado de produto (SPEC-002+) · email+senha, SMS, anônimos, MFA de usuária, magic link como UX principal · merge heurístico de contas e linking manual · purga física de `auth.users`/dados e notificação a provedores externos (operação privilegiada futura: job/runbook) · exportação de dados · Captcha (D-38) · logout global · admin auth · consentimento de analytics/marketing e persistência de aceite de termos (SPEC-013) · `audit_log` · site/caminho web de exclusão exigido pelo Google Play (release gate, SPEC-013).

## 5. User Stories
- US1 Nova usuária no iPhone toca "Continuar com Apple" e entra sem digitar nada.
- US2 Nova usuária no Android toca "Continuar com Google" e entra.
- US3 Usuária sem/contra login social digita o email, recebe um código, digita e entra.
- US4 Usuária que entrou com Google ontem e hoje usa email igual cai na **mesma** conta.
- US5 Usuária reabre o app no dia seguinte e continua logada.
- US6 Usuária troca de celular e recupera tudo entrando pelo mesmo método.
- US7 Usuária sai da conta neste aparelho; ninguém entra sem autenticar de novo.
- US8 Usuária pede exclusão da conta pelo app, recebe confirmação clara e pode cancelar o pedido.

## 6. Functional Requirements
| ID | Requisito |
|---|---|
| FR1 | Tela de entrada com Apple (iOS; obrigatória pela App Store quando há login social), Google e Email. |
| FR2 | Apple e Google terminam em `supabase.auth.signInWithIdToken` (fluxo com ID token) **ou** `signInWithOAuth` (browser + PKCE). Requisitos em §12/§13; a escolha técnica (SDK nativo vs browser) é decidida em *implementation planning* por spike, sem mudar o modelo. |
| FR3 | Email OTP: `signInWithOtp({ email, shouldCreateUser: true })` → usuária digita o código → `verifyOtp({ email, token, type: 'email' })`. Código digitado é a UX principal; nenhum deep link é necessário para OTP. |
| FR4 | Sessão persistida por adapter de storage do supabase-js sobre **armazenamento seguro do runtime** (§10); `autoRefreshToken`, `persistSession`, `detectSessionInUrl: false`. |
| FR5 | Logout local: `signOut({ scope: 'local' })` + limpeza local completa (storage seguro, caches, fila idempotente, notificações locais). Falha de rede não impede a limpeza local. |
| FR6 | Exclusão: a usuária registra o pedido (`INSERT` em `account_deletion_requests`), vê confirmação clara com o estado e pode cancelar (`DELETE` do próprio pedido) enquanto a exclusão efetiva não ocorrer. A exclusão efetiva (`auth.users` + cascata) é **server-owned**, fora desta SPEC. |
| FR7 | Todo estado de UI dá feedback; nenhuma ação sem resposta (§14). |
| FR8 | Mensagens úteis sem enumeração (BR8). |

## 7. Business Rules
| ID | Regra | Onde |
|---|---|---|
| BR1 | Identidade = Supabase Auth (`auth.users`, `auth.identities`). O domínio conhece só `user_id`; nunca lê `auth.users`. | core `identity` (tipos) / infra |
| BR2 | **Provider-managed verified identity linking** (Supabase Auth vincula automaticamente identidades com o mesmo email verificado, conforme o comportamento documentado do provedor; *manual linking* desligado) é **aceito**. **Application heuristic account merging** (por nome, device, similaridade de email, suposições sobre relay) é **proibido**; a aplicação não duplica nem substitui o linking do provedor. | Supabase Auth |
| BR3 | O app nunca infere que um Apple Private Relay pertence a outro email; um relay é tratado pelo provedor como o email verificado que é. | app |
| BR4 | Um `provider_id` pertence a um único `auth.users`; tentativa de duplicar falha e nada muda. | Supabase Auth |
| BR5 | Unlink não é exposto no MVP. | ausência de UI |
| BR6 | OTP: curto, uso único, rate limited, reenvio limitado, brute force mitigado — pelos mecanismos do provedor (§11); nenhum limitador próprio. | Supabase Auth config |
| BR7 | Autorização de dados é exclusivamente RLS/grants/constraints no servidor com `(select auth.uid())`. | Postgres |
| BR8 | Anti-enumeração: pedido/reenvio de OTP e colisões respondem igual existindo ou não conta ("Se este email puder receber códigos, enviamos um agora."). | app + `shouldCreateUser` |
| BR9 | Nunca persistir/registrar **pela nossa aplicação** (logs, analytics, tabelas, storage): OTP, access/refresh token, authorization code, `id_token`, payload bruto de provedor, email quando não operacionalmente necessário (redigido `a***@d***` quando necessário). Logs internos de serviços externos não controlados estão fora do escopo. | adapter de logging + catálogo |
| BR10 | Exclusão: só a própria usuária registra/cancela o pedido; a exclusão efetiva é privilegiada e server-owned. O comportamento da sessão após o pedido é decidido junto com a política de purga (imediata vs. grace) — OQ3; esta SPEC não o fixa. | tabela + RLS |

## 8. Data Model Impact (conceitual; sem migration)
| Entidade | Necessidade MVP | Necessidade de segurança | Caro adicionar depois? | Decisão |
|---|---|---|---|---|
| `auth.users` / `auth.identities` | sim (Supabase) | sim | — | **KEEP** (gerido pelo Auth; sem acesso do app) |
| `profiles` | não para autenticar; `timezone` é usado a partir de cronograma/“hoje” (SPEC-004/005), `display_name` é personalização, `onboarding_status` é estado de produto | nenhuma | não | **DEFER → SPEC-002** (nasce com o primeiro dado de produto, via comando idempotente — §9) |
| `consents` | sem consentimento LGPD definido; aceite de termos ≠ consentimento e não bloqueia o MVP | nenhuma | não | **DEFER → SPEC-013** |
| `audit_log` | nenhuma ação de Identity exige auditoria persistida; sem leitor (admin) | nenhuma agora | não | **DEFER** |
| `account_deletion_requests` | sim (Apple/Google exigem exclusão pelo app; LGPD) | integridade do pedido | sim (fluxo de loja) | **KEEP** |

Campo a campo de `profiles` (para a SPEC-002): `timezone` — lido por Schedule/Care Tracking, derivável do dispositivo; `locale` — hoje sempre `pt-BR`, candidato a remoção; `display_name` — opcional, só se o produto pedir; `onboarding_status` — pertence ao onboarding. Nenhum é pré-requisito de autenticação.

**Consequência documental (requer reconhecimento humano — OQ1):** ADR-005 ("trigger `on auth.users insert` cria `profiles`"), DATA-MODEL §3.1/§3.15, DOMAIN-MAP §3.1 e a matriz RLS assumem perfil no signup e RPCs de exclusão. Se esta SPEC for aprovada, essas linhas recebem nota de atualização em commit documental próprio.

`account_deletion_requests` (proposta mínima): `user_id uuid PK references auth.users on delete cascade` · `requested_at timestamptz not null default now()`. **Sem coluna de status e sem `scheduled_purge_at`**: existência da linha = pedido ativo; cancelar = a usuária apaga a própria linha; a política de purga (OQ3) lê `requested_at`. Ownership: usuária. Mutabilidade: nenhuma (só INSERT/DELETE próprios; `requested_at` só via default). PII: nenhuma. Lifecycle: criada pela usuária → removida pela usuária (cancelamento) ou pela purga (cascade).

## 9. Mecanismos de backend e contratos
| Mecanismo | Problema resolvido agora | Alternativa mais simples | Decisão |
|---|---|---|---|
| Trigger `after insert on auth.users` → `profiles` (DEFINER) | perfil no signup | não há perfil nesta SPEC | **REMOVE** desta SPEC |
| RPC `ensure_my_profile` (INVOKER, idempotente) | perfil sem trigger | — | **DEFER → SPEC-002** (Opção B recomendada) |
| RPCs `request/cancel_account_deletion` | transição de estado | **grants mínimos + RLS + constraints** cobrem ownership, operações permitidas e imutabilidade sem função; uma RPC INVOKER não adiciona fronteira de segurança (usa as permissões do caller) | **REMOVE** — acesso direto (§18) |
| Edge Functions, Auth hooks, custom claims, Captcha hook | nada no MVP | — | **REMOVE/DEFER** |

Provisionamento de perfil (registro para a SPEC-002): Opção A (trigger em `auth.users`) dá atomicidade, mas exige DEFINER no schema `auth`, pode bloquear o signup e é invisível ao app. **Opção B** (comando idempotente na primeira sessão autenticada) não bloqueia o signup, é testável por RLS e se recupera por retry. Recomendação: B, sem redundância.

Contrato do app (core `identity`, application): `AuthPort { signInWithProvider(apple|google), requestOtp(email), verifyOtp(email, code), signOut(), currentSession(), onSessionChange }` implementado em `apps/mobile/src/infrastructure/supabase`; erros mapeados para `AppError` da Foundation. Exclusão: `DeletionRequestPort { request(), cancel(), current() }` sobre a tabela via PostgREST.

## 10. Sessão e armazenamento seguro
- Tokens: access JWT com a **expiração configurada no Supabase Auth** (valor registrado apenas na configuração, não na lógica de produto) + refresh token com rotação. Comportamento obrigatório: **token expirado → refresh enquanto o refresh token for válido → `unauthenticated` quando o refresh não puder mais ter sucesso**. Logout revoga o refresh token no servidor; um access token já emitido permanece válido até sua expiração (não é invalidado instantaneamente).
- Armazenamento: **Secure storage required. Custom crypto NOT allowed without demonstrated requirement.** Avaliar Expo SecureStore (ou equivalente do runtime) no implementation planning; se o tamanho da sessão exceder o limite do mecanismo, tratar como decisão de implementação com evidência — nunca cair para storage inseguro. Storage seguro indisponível → sessão só em memória (não persistente), com aviso.
- Refresh ligado ao ciclo de vida do app (foreground/background); refresh inválido → limpeza local + `unauthenticated` (sem loop). Reinstalação: sessão residual é descartada no primeiro launch (reinstalar = deslogado). Offline: sessão em cache permite abrir o app; escritas usam a fila idempotente da Foundation.
- Logout global: **DEFER**.

## 11. OTP, rate limiting e abuso
| Parâmetro | Classificação | Posição |
|---|---|---|
| Formato do código | provider default (6 dígitos numéricos) | usar o default |
| Expiração | provider config (`otp_expiry`) | princípio: curta; valor final = **needs validation** (configuração) |
| Cooldown de reenvio | provider config (`max_frequency`) | princípio: limitado; valor final = needs validation; UI desabilita o botão |
| Tentativas de verificação | provider-enforced (`rate_limit_verify`) | sem contador próprio |
| Envio de email/hora | provider-enforced + capacidade do SMTP | sem limitador próprio |
| Captcha | hardening de release | **DEFER** (D-38) |

## 12. Provedores e account linking
| Cenário | Classe | Decisão |
|---|---|---|
| Mesmo email verificado entre provedores (Google ↔ OTP; Apple com email real ↔ OTP/Google) | provider-managed verified identity linking | **AUTO** (Supabase) |
| Apple Private Relay ↔ outro método | sem email verificado em comum | **nenhuma inferência pela aplicação**; o provedor trata o relay como email próprio; resultado: contas distintas |
| Emails diferentes, mesma pessoa | application heuristic merge | **DO NOT MERGE** (proibido) |
| `provider_id` já vinculado a outro usuário | provider | erro; nada muda |
| Linking autenticado (adicionar provedor) / unlink | — | **DEFER** |
| Linking não autenticado | — | proibido |
| Provedor revogado na origem | — | identidade fica órfã; usuária entra por OTP no email real |
UX preventiva na tela Apple: "compartilhe seu email para recuperar sua conta em qualquer aparelho". Apple: `sub` estável, nome só no primeiro login (não persistido aqui), nonce obrigatório. Google: email verificado, `sub` como `provider_id`. Validação de token/`aud`/nonce é do Supabase, nunca reimplementada.

## 13. Deep links e OAuth/OIDC security
Scheme `haircare://` já registrado. **Nenhum deep link cria sessão no MVP** (`detectSessionInUrl=false`; OTP digitado). Se o spike escolher OAuth por browser: PKCE + `state` (biblioteca), redirect exato `haircare://auth/callback` na allowlist do Supabase, callback validado por schema e processado uma única vez, sem parâmetros de sessão em logs, nunca redirecionar para URL de parâmetro. Universal/App Links: só com domínio (SPEC-013). Segredos de provedores existem apenas no dashboard do Supabase.

## 14. UX Notes
Estados: `idle` · `provider_in_progress` · `requesting_otp` · `waiting_for_otp` (cooldown visível) · `verifying` · `success` · `error` (retry) · `offline` · `cancelled` (volta a `idle` sem erro) · `deletion_requested` (confirmação clara do pedido + cancelar). Acessibilidade: labels, foco no campo de código, Dynamic Type, contraste.
Estados de identidade: **authentication** `unauthenticated | authenticated`; **account lifecycle** `active | deletion_requested`. Onboarding é da SPEC-002.

## 15. Edge Cases & Failure Modes
| Caso | Comportamento |
|---|---|
| OTP inválido/expirado | erro genérico único; reenvio conforme cooldown do provedor |
| Provedor cancelado / indisponível / SMTP falhou | `idle` sem erro (cancel) ou `InfrastructureError` retryable; outras opções seguem disponíveis |
| Rede cai após autenticação | sessão já persistida; nada mais nesta SPEC |
| Identidade com relay / email já vinculado | §12; sem ação da aplicação além do linking do provedor |
| Refresh inválido / usuária removida ou revogada | refresh falha → limpeza local → `unauthenticated` |
| Storage seguro indisponível | sessão em memória; aviso; nunca storage inseguro |
| Callback OAuth repetido (se browser flow) | `state` de uso único; segundo callback ignorado |
| Apple sem email utilizável | conta sem email → OTP impossível; runbook de suporte orienta revogar no Ajustes da Apple e entrar de novo |
| Pedido de exclusão duplicado / cancelamento repetido | PK impede duplicata (erro tratado como "já solicitado"); `DELETE` de linha inexistente é no-op |

## 16. Privacy Considerations
Dados: email e `provider_id` (só em `auth.*`, finalidade identidade/recuperação, até purga, nunca em analytics/logs da aplicação além de redação); `account_deletion_requests` (sem PII). Nada mais é persistido. `raw_user_meta_data` do Supabase não é copiado para o domínio.

## 17. Security Considerations
**Cliente totalmente hostil:** possui só `anon key` + JWT próprio. Não pode ler/inserir/apagar pedidos de exclusão de terceiros (RLS por `auth.uid()`), alterar `requested_at` (sem grant de UPDATE), forjar `user_id` (policy `with check`), excluir `auth.users` (operação privilegiada inexistente para o cliente), vincular provedor a outra conta (Supabase valida `id_token`/nonce/`aud`), descobrir se um email tem conta (respostas idênticas), brute-forçar OTP (uso único + rate limit do provedor), obter service role. Pode: gastar cota de email (limites do provedor; Captcha no release). Checklist SECURITY-BASELINE §13: 1 tabela com RLS por verbo ✔; **0 funções `SECURITY DEFINER`, 0 RPCs** ✔; inputs validados ✔; idempotência ✔ (PK + DELETE no-op); PII nova: nenhuma ✔; testes RLS ✔; rate limit = provedor ✔; rollback ✔. Ameaças: T01, T02/T03, T05, T10, T12, T23.

## 18. RLS / autorização (SQL só na implementação)
`account_deletion_requests`: `enable` + `force row level security`; `revoke all from anon, authenticated` (o Supabase concede privilégios implícitos — SUPABASE-RLS-STRATEGY §1.3); `grant select, insert, delete to authenticated` (**sem UPDATE**); policies para `authenticated`: select `using (user_id = (select auth.uid()))`, insert `with check (user_id = (select auth.uid()))`, delete `using (user_id = (select auth.uid()))`; `requested_at` protegido por ausência de UPDATE (INSERT com valor explícito é aceito, mas irrelevante para segurança: a purga é server-owned e pode ignorar/validar o valor); `anon`: nenhum grant. Entradas na allowlist de grants (`supabase/security/allowlists.sql`) com referência SPEC-001; nenhuma entrada de DEFINER. Guardrails da Foundation (`tables_without_rls`, `unapproved_grants`, `unapproved_security_definer_functions`) permanecem em zero após a allowlist.

## 19. Testing Strategy
- Unit (core `identity`): estados, mapeamento de erros do Auth → `AppError`, validação de email, catálogo de eventos sem segredos, regra "reinstall = deslogado", redactor de logs.
- Integração (Supabase local + inbox de teste): OTP request→verify cria usuário; linking Google↔OTP com mesmo email (via Admin API em teste); refresh/rotação; logout revoga refresh.
- Segurança (pgTAP): A lê/insere/apaga o próprio pedido; A não lê/apaga o de B (0 linhas, sem erro de existência); A não faz UPDATE (sem grant); INSERT com `user_id` de B falha; anon nada; PK impede duplicata; guardrails da Foundation em zero.
- E2E (ferramenta a escolher; **critical auth journeys must have E2E coverage**): Apple, Google, Email OTP, returning login, logout, sessão expirada, solicitar/cancelar exclusão.

## 20. Analytics Events
`auth_completed { provider, is_new_user }` · `auth_failed { provider, reason ∈ {cancelled, otp_invalid_or_expired, rate_limited, provider_error, network, unknown} }`. Podem ser adiados para a SPEC-011. Proibido em props: email, tokens, OTP, nome, relay, mensagens brutas.

## 21. Acceptance Criteria
| ID | Critério |
|---|---|
| AC1 | Given uma nova usuária, when autentica por Apple, Google **ou** Email OTP, then existe exatamente um `auth.users` para ela e uma sessão válida no app, sem nenhuma outra tabela de aplicação preenchida. |
| AC2 | Given usuária criada por Google (email verificado E), when entra por Email OTP em E, then a sessão pertence ao **mesmo** `auth.users` (linking gerido pelo provedor; 0 contas novas). |
| AC3 | Given usuária criada por Apple com Private Relay, when entra por OTP no email real, then o resultado é o do provedor (contas distintas) e **nenhuma lógica da aplicação** tenta inferir, vincular ou mesclar (verificado por revisão de código: inexistência de qualquer caminho de merge/linking na aplicação). |
| AC4 | Given qualquer email (com ou sem conta), when solicita OTP ou reenvio, then a resposta da API e a UX são indistinguíveis. |
| AC5 | Given um OTP usado ou expirado, when reenviado, then é rejeitado; e o limite de tentativas do provedor está ativo (teste de integração). |
| AC6 | Given sessão persistida, when o app é fechado e reaberto, then a usuária continua autenticada; when o access token expira e o refresh é válido, then a sessão é renovada sem interação; when o refresh não pode mais ter sucesso, then o app limpa o estado local e mostra a tela de entrada sem loop. |
| AC7 | A sessão nunca é gravada fora do armazenamento seguro do runtime; com o mecanismo indisponível, a sessão não é persistida (teste com adapter simulado indisponível). |
| AC8 | Given logout local, then o refresh token está revogado no servidor e o storage seguro/caches/fila/notificações locais estão limpos; a documentação registra que um access token já emitido expira na sua expiração configurada. |
| AC9 | Given usuárias A e B, when A usa um cliente modificado, then A não consegue `SELECT`/`INSERT`/`DELETE` em `account_deletion_requests` de B, não consegue `UPDATE` em linha alguma, anon não acessa nada, e nenhuma operação do cliente afeta `auth.users` (pgTAP + revisão de grants). |
| AC10 | Given um pedido de exclusão, then existe exatamente 1 linha da própria usuária (PK impede duplicata), a usuária recebe confirmação clara, pode cancelar (linha removida) e a exclusão efetiva permanece server-owned (nenhuma via cliente). |
| AC11 | Nenhum OTP, access/refresh token, authorization code, `id_token`, payload bruto de provedor ou email desnecessário aparece em **logs, analytics ou persistência controlados pela aplicação** (teste unitário do redactor + revisão do catálogo de eventos + inspeção do storage). |
| AC12 | Os checks bloqueantes da Foundation permanecem verdes com o novo schema: `tables_without_rls()` = 0, `unapproved_grants()` = 0 após allowlist, `unapproved_security_definer_functions()` = 0, `pnpm verify`. (O AC12 da SPEC-000 — autossuficiência documental — segue DEFERRED por decisão humana, não bloqueante, e não é afetado por esta SPEC.) |
| AC13 | Jornadas críticas (Apple, Google, OTP, returning login, logout, sessão expirada, exclusão/cancelamento) têm cobertura E2E executada em staging antes do release. |

## 22. Dependencies (candidatas; nenhuma instalada)
`@supabase/supabase-js` (necessário) · storage seguro do runtime (Expo SecureStore ou equivalente — necessário) · módulo/SDK de Apple e Google **conforme o spike** (não fixar) · estado servidor só se a Foundation não bastar. Sem crypto própria, sem state manager novo, sem lib de validação extra, sem ferramenta E2E fixada. Prerrequisitos operacionais (não bloqueiam a SPEC): SMTP próprio antes de OTP em staging/prod; Apple Developer + Google Cloud + keystores antes dos testes reais.

## 23. Release requirements (rastreáveis; fora desta implementação)
| Requisito | Loja | Gate |
|---|---|---|
| Exclusão de conta iniciável **dentro do app** | Apple App Store | coberto por FR6 desta SPEC |
| Caminho **externo/web** para solicitar exclusão da conta (além do app) | Google Play | **RELEASE REQUIREMENT** — SPEC-013; não construído agora |
| Exclusão efetiva server-owned + política de purga | ambas + LGPD | OQ3 (decisão humana) + job/runbook |
| SMTP de produção, Captcha, termos/privacidade | — | SPEC-013 |

## 24. Implementation Plan (fases pequenas)
1. `account_deletion_requests` + RLS/grants + allowlist + pgTAP.
2. Config Supabase local (Auth: senha desabilitada, OTP conforme §11, providers com placeholders) + `.env.example`.
3. Infra mobile: cliente Supabase, adapter de storage seguro, refresh no ciclo de vida, redação de logs, `AuthPort`/`DeletionRequestPort` + estados no core.
4. Email OTP end-to-end (inbox local).
5. Spike nativo vs browser → Google e Apple.
6. Logout, expiração, reinstall, pedido/cancelamento de exclusão.
7. Eventos (adapter no-op) + docs (DATA-MODEL, matriz RLS, runbook de suporte) + E2E.

## 25. Migration / Rollback Plan
Uma migration aditiva (`account_deletion_requests` + RLS/grants), pgTAP, `-- ROLLBACK:` (drop). Local → PR → staging → prod humano. Configuração de Auth via `config.toml` (local) e dashboard (remoto, humano).

## 26. Open Questions
| ID | Classe | Pergunta | Assunção enquanto aberta |
|---|---|---|---|
| — | **BLOCKING NOW** | nenhuma | — |
| OQ1 | IMPORTANT BEFORE IMPLEMENTATION | Reconhecer o adiamento de `profiles` (Opção B) e a remoção das RPCs de exclusão, com nota de atualização em ADR-005/DATA-MODEL/DOMAIN-MAP/RLS matrix? | sim (esta SPEC assume) |
| OQ2 | IMPORTANT BEFORE IMPLEMENTATION | Spike: SDKs nativos vs OAuth por browser (fricção, sem deep link de sessão, dev build) | decidir na fase 5 |
| OQ3 | IMPORTANT BEFORE IMPLEMENTATION / HUMAN DECISION | Exclusão imediata vs grace period — e, consequentemente, o comportamento da sessão após o pedido | não fixado; a tabela só registra `requested_at` |
| OQ4 | IMPORTANT BEFORE STAGING/PRODUCTION OTP | Provedor SMTP | local usa inbox de teste |
| OQ5 | IMPLEMENTATION / RELEASE PREREQUISITE | Contas Apple Developer / Google Cloud, keystores, dev builds; caminho web de exclusão (Google Play) | necessários antes das fases 5 e do release |
| OQ6 | CAN DEFER | Apple no Android; link no email de OTP; notificações server-to-server da Apple; logout global; `display_name`; termos/privacidade persistidos | pós-MVP / SPEC-013 |

## 27. Change Log
| Data | Mudança | Autor |
|---|---|---|
| 2026-08-26 | v0.1 Draft via `spec-create` | Claude |
| 2026-08-26 | v0.2 Revisão de necessidade (profiles/consents/audit_log deferidos; trigger e ensure_my_profile removidos; crypto própria removida; OTP reclassificado; ACs consolidados) | Claude |
| 2026-08-26 | Status → **Approved** (revisão humana final; D-51). Decisões de implementação pendentes permanecem rastreadas em §26 e no DECISION-REGISTER | Humano / Claude |
| 2026-08-26 | v0.3 Correções técnicas: RPCs de exclusão removidas (grants + RLS + constraints; sem UPDATE; cancelar = DELETE próprio; sem coluna de status); linking reformulado (provider-managed linking aceito × merge heurístico proibido); referência ao AC12 da Foundation corrigida (DEFERRED, não PASS); comportamento de sessão pós-pedido não fixado (OQ3); release requirement do Google Play registrado; expiração do access token = configuração do Supabase; BR9/AC11 restritos a logs/analytics/persistência controlados pela aplicação | Claude — aguardando aprovação humana |
