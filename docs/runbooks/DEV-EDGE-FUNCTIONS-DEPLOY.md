# Runbook — deployar as Edge Functions no projeto DEV

**Contexto: D-90.** O banco do DEV está provisionado (D-87 resolvido — `all 10 tables present`), o
DEV sign-in funciona, o onboarding real funciona e o preview do cronograma aparece. Mesmo assim
**"Começar meu cronograma" falha**, porque as Edge Functions **nunca foram deployadas**:

```
POST /functions/v1/generate-plan  →  404 {"code":"NOT_FOUND","message":"Requested function was not found"}
```

O bootstrap SQL aplicou **migrations**. Edge Function é um deploy separado — nada no fluxo de
provisionamento do banco a inclui.

## Por que não há como contornar isso no código

`create_plan_tx` é executável **só por service_role** (SPEC-004 §12, G2/P10). O cliente tem
`SELECT` e mais nada em `hair_plans`/`scheduled_cares`. A Edge Function é literalmente o único
caminho que pode criar um plano — é assim de propósito. Fazer o app criar o plano direto exigiria
afrouxar grants ou colocar a service role no cliente; **as duas coisas estão proibidas** (CLAUDE.md
§3/§4) e nenhuma delas vai acontecer para destravar um ambiente de desenvolvimento.

**Portanto: sem deploy, não há cronograma. Não é um bug de código.**

## Diagnóstico (sem credencial, 5 segundos)

```
pnpm check:remote          # schema + functions
pnpm check:remote-functions # só as functions
```

Uma função ausente responde `404 NOT_FOUND` a qualquer chamador, então este check não precisa de
token nenhum. Saída atual:

```
[check-remote-schema] OK — all 10 tables present on ayecidupmxmirwfzwtea.supabase.co
[check-remote-functions] 3 of 3 functions not deployed on ayecidupmxmirwfzwtea.supabase.co:
  - billing-webhook
  - generate-plan
  - health
```

## O que precisa ser feito (TRUE HUMAN GATE — credencial)

Deployar exige **Supabase CLI** ou um **`SUPABASE_ACCESS_TOKEN`**. Medido nesta máquina em
2026-08-31: `supabase` não está no PATH, não é dependência do projeto, e a variável não existe. O
agente não tem como obter nenhum dos dois.

**Não dá para colar no dashboard.** Ao contrário das migrations, `generate-plan` importa `@app/core`
direto das fontes do workspace (`supabase/functions/deno.json`, Strategy A / D-49). O editor de
funções do dashboard não tem essa árvore; o deploy tem de ser feito por uma ferramenta que empacote
o repositório local.

### Rota recomendada — CLI via npx

```
# 1. Token: https://supabase.com/dashboard/account/tokens  →  "Generate new token"
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."     # PowerShell; NUNCA commitar, NUNCA no .env do app

# 2. Deploy das duas funções que o app chama
npx -y supabase@latest functions deploy generate-plan --project-ref ayecidupmxmirwfzwtea
npx -y supabase@latest functions deploy health        --project-ref ayecidupmxmirwfzwtea

# 3. Conferir
pnpm check:remote-functions      # tem de sair OK
```

`billing-webhook` **não é necessária** para a jornada do produto: ela existe para o provider de
pagamento chamar, e o IAP real está atrás de outro gate (D-79/D-86). Deployar só se e quando aquele
gate abrir.

### Secrets que a função precisa no projeto

`generate-plan` lê `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` do ambiente.
As três são **injetadas automaticamente** pelo runtime de Edge Functions do Supabase no próprio
projeto — não precisa configurar nada, e **a service role não deve aparecer em lugar nenhum do
repositório nem do `.env` do app**.

### Se o Windows Application Control bloquear o binário

Foi o que aconteceu com `supabase.exe` quando as migrations foram aplicadas (ver
`DEV-DATABASE-PROVISION.md` §2b), e **desativar o Smart App Control não é uma opção aceitável** — a
resposta é outro caminho, não um caminho mais fraco. Alternativa: rodar o mesmo comando dentro do
WSL, ou usar a Management API
(`POST https://api.supabase.com/v1/projects/{ref}/functions/deploy`) com o mesmo token.

## Depois do deploy — validar a jornada real (CLAUDE.md §0.1)

CI verde não vale como validação quando existe DEV real. A sequência a observar de ponta a ponta:

1. `pnpm --filter mobile run web` → `localhost:8081`
2. DEV sign-in
3. onboarding (ou perfil já existente)
4. preview → **"Começar meu cronograma"** → o cronograma persiste
5. **Hoje** → cartão de foco, week strip
6. concluir um cuidado → **check-in** aparece no mesmo lugar
7. **reload** → o estado continua lá

Se algo falhar, a tela agora diz **por quê** sob `__DEV__` (D-90): status e corpo reais da resposta,
em vez de só "tente novamente".
