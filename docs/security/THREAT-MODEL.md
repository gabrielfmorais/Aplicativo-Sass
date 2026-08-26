# THREAT MODEL — v0.1

| Campo | Valor |
|---|---|
| Status | Draft v0.1 — revisar a cada SPEC que toque autorização, dados ou integrações |
| Método | STRIDE simplificado + matriz Likelihood × Impact |
| Escalas | Likelihood/Impact: Low / Medium / High. Risk = combinação qualitativa |

## 1. Ativos

| Ativo | Valor |
|---|---|
| Credenciais e sessões das usuárias | Alto |
| Dados pessoais (perfil, cabelo, notas, histórico) | Alto (LGPD, reputação) |
| Integridade de planos/execuções (histórico) | Médio-Alto (valor do produto) |
| Estado de assinatura / entitlements | Alto (receita) |
| Service role / segredos de provedores | Crítico |
| Código-fonte e pipeline de deploy | Alto |
| Conta admin / dashboard Supabase | Crítico |

## 2. Atores

Usuária maliciosa (própria conta) · Atacante externo não autenticado · Usuária curiosa (IDOR) · Insider/admin comprometido · Dependência/agent de IA comprometido ou errante · Provider externo comprometido.

## 3. Matriz de ameaças

| ID | Ameaça | Vetor | L | I | Mitigação | Residual |
|---|---|---|---|---|---|---|
| T01 | Account takeover | Credential stuffing, reset abuse, token roubado | M | H | Supabase Auth rate limits; senha vazada (HIBP) bloqueada; Captcha; refresh rotation; tokens em SecureStore; social login (Apple/Google) | L-M |
| T02 | IDOR / broken access control | Alterar `id` em request PostgREST/RPC | H | H | RLS por `user_id = auth.uid()` em toda tabela; RPCs validam ownership; `NotFound` indistinguível de `Forbidden`; testes negativos de RLS | L |
| T03 | Falha de RLS (tabela nova sem policy, policy permissiva) | Erro humano/agent | M | H | RLS ON por padrão (fail closed); CI verifica `relrowsecurity` em todas as tabelas de `public`; teste automatizado por tabela; CODEOWNERS em `supabase/` | L |
| T04 | Privilege escalation (usuária vira admin / premium) | UPDATE em `profiles.role`, `subscriptions` | M | H | Sem coluna role editável; `subscriptions` sem policy de escrita para `authenticated`; admin por claim + tabela só via migration; entitlement no servidor | L |
| T05 | Token leakage | Logs, crash reports, deep links, clipboard | M | H | Scrub de PII/tokens; nunca token em URL; SecureStore; `sendDefaultPii=false` | L |
| T06 | Secrets leakage | Commit acidental, `.env` no bundle, agent escreve segredo em doc | M | Crítico | `.gitignore`; gitleaks em CI; `EXPO_PUBLIC_` só para chaves públicas; revisão de diff; rotação por runbook | L |
| T07 | Abuso de Edge Functions (custo, DoS, geração em massa) | Chamadas repetidas a `generate-plan` | M | M | JWT obrigatório; rate limit por usuária; idempotência; timeouts; alertas de custo | L-M |
| T08 | SQL injection | RPC dinâmico, `EXECUTE` com concatenação | L | H | Sem SQL dinâmico; parâmetros tipados; `search_path` fixo; revisão de funções | L |
| T09 | XSS / injeção de conteúdo | Markdown de conteúdo, notas exibidas | L | M | Render de markdown sem HTML raw; escape padrão RN; conteúdo só de admin/seed | L |
| T10 | Deep link abuse | Link malicioso abre tela com parâmetros forjados (ex.: `plan_id` alheio, open redirect) | M | M | Parâmetros validados por zod; nunca confiar em ids de deep link sem RLS; allowlist de rotas; Universal Links/App Links verificados | L |
| T11 | Malicious uploads | Fora do MVP | — | — | Ver SECURITY-BASELINE §9 quando aplicável | — |
| T12 | Rate abuse / enumeração | Enumerar emails no signup/reset; enumerar ids | M | M | Mensagens genéricas; uuid v4; Auth rate limit; Captcha | L |
| T13 | Admin compromise | Phishing de fundador; dashboard sem MFA | L | Crítico | MFA obrigatório no Supabase/GitHub; least privilege em org; auditoria; sem service role em máquinas pessoais fora de CLI autenticada | M |
| T14 | Supply-chain / dependency compromise | Pacote npm malicioso, typosquatting, Action comprometida | M | H | Lockfile; `pnpm audit`; checklist de dependência; Actions pinadas por SHA; sem scripts postinstall automáticos; Renovate revisado | M |
| T15 | Agente de IA altera autorização inadvertidamente | "Corrigir bug" flexibilizando policy, usando service role, desabilitando teste | H | H | `CLAUDE.md` proíbe; CODEOWNERS; CI falha se RLS off ou teste removido; PR template exige "Security Impact"; MCP Supabase só em dev | M |
| T16 | Migration destrutiva | `DROP`, `TRUNCATE`, alteração de coluna com dados, executada em prod | M | H | Fluxo migration (local → staging → prod com approval); revisão obrigatória; backups PITR; proibição explícita para agentes | L-M |
| T17 | Exposição de dados via analytics/logging | Evento com nota livre, email em propriedade | M | M | Catálogo tipado de eventos; PII proibida em props; revisão em SPEC | L |
| T18 | Webhook forjado (billing) | POST falso concedendo premium | M | H | Verificação HMAC; idempotência por `event_id`; reconciliação periódica com provider | L |
| T19 | Replay / double submit | Rede instável, retry | H | M | Idempotency keys (`client_execution_id`); `ON CONFLICT DO NOTHING`; RPC atômica | L |
| T20 | Multi-device race (dois planos ativos) | Geração simultânea | L | M | Índice único parcial `one_active_plan_per_user`; RPC transacional | L |
| T21 | OTA update malicioso/errado (EAS Update) | Conta EAS comprometida | L | H | MFA EAS; branch de update por ambiente; code signing do EAS Update | L |
| T22 | Timezone manipulation | Cliente envia tz falsa para "concluir" cuidado de outro dia | M | L | Servidor calcula `executed_on` com tz do perfil e valida diferença plausível (±1 dia) | L |
| T23 | Retenção excessiva / falha em exclusão | Dados sobrevivem à exclusão | M | H | Cascade por FK; job de purga testado; runbook para provedores externos | L-M |

## 4. Riscos residuais aceitos (a confirmar)

- **T13/T14/T15 (Medium):** dependem de disciplina operacional (MFA, revisão humana). Mitigação adicional: reduzir número de pessoas com acesso a prod; revisar trimestralmente.
- Chaves públicas (`anon key`, DSN) no bundle são públicas por design; segurança depende inteiramente de RLS — por isso T02/T03 têm controles redundantes.

## 5. Gatilhos de revisão deste documento

Nova tabela com dados de usuária · nova função SECURITY DEFINER · nova Edge Function · novo provider externo · deep links · uploads · admin UI · qualquer incidente.
