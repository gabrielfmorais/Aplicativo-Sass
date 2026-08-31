# Runbook — provisionar o banco do projeto Supabase DEV

> ✅ **Estado atual (medido 2026-08-31, depois deste runbook ter sido executado pelo dono):** o
> projeto **`hair-care-dev` / ref `ayecidupmxmirwfzwtea` está provisionado** —
> `node scripts/check-remote-schema.mjs` responde `OK — all 10 tables present`. DEV sign-in,
> onboarding real e o preview do cronograma funcionam. Este runbook fica como procedimento
> reproduzível (outro ambiente, reprovisionamento), **não** como descrição do estado de hoje.
>
> ⚠️ **Provisionar o banco não deploya as Edge Functions.** São passos separados, e o app não cria
> cronograma sem elas: ver `DEV-EDGE-FUNCTIONS-DEPLOY.md` (D-90).

> **Por que este runbook existe.** Em 2026-08-31 o app entrava (DEV sign-in, D-85) e parava em
> *"Não foi possível carregar seu perfil."*. A causa não era Auth, nem RLS, nem grants: **o projeto
> DEV remoto não tinha nenhuma das 10 tabelas.** Todas as migrations só tinham rodado localmente e
> no CI. `pnpm verify` verde, pgTAP verde, e mesmo assim nada funcionava — porque nada testava se o
> banco remoto havia sido provisionado alguma vez (D-87).


## 1. Diagnosticar (sem credencial nenhuma)

```
node scripts/check-remote-schema.mjs
```

Lê `apps/mobile/.env.local`, faz um GET por tabela e compara com o que as migrations criam. Uma
tabela ausente responde `PGRST205` independentemente de privilégio, então a anon key basta. Uma
tabela que existe e nega acesso conta como **presente** — é RLS funcionando, não falha.

Saída boa: `OK — all N tables present`. Saída ruim: a lista do que falta.

## 2. Aplicar as migrations — **somente no projeto DEV**

Precisa de duas credenciais que **só o dono tem** e que não existem nesta máquina:

| Credencial | Onde obter |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens → *Generate new token* |
| Senha do banco | Supabase → Project Settings → Database → *Database password* (ou reset) |

```bash
export SUPABASE_ACCESS_TOKEN=<token>

# 1. Confirme QUAL projeto — este comando escreve no banco, então o ref importa.
npx --yes supabase@latest projects list

# 2. Ligue o repositório ao projeto DEV (o ref sai do passo 1).
npx --yes supabase@latest link --project-ref <ref-do-hair-care-dev>

# 3. Veja o que seria aplicado ANTES de aplicar.
npx --yes supabase@latest db push --dry-run

# 4. Aplique.
npx --yes supabase@latest db push
```

Depois, o passo que fecha o ciclo:

```
node scripts/check-remote-schema.mjs      # tem de sair OK
```

### Regras que não mudam

- **Só `hair-care-dev`.** Nunca staging, nunca produção — em produção vale
  `docs/runbooks/migration-prod.md`, que é outro processo, com checklist humano.
- **Confira o `--project-ref` antes do `db push`.** É a única linha deste runbook que escreve num
  banco que não é o seu localhost.
- As migrations são **aditivas e forward-only**; nenhuma apaga dados. Ainda assim, `--dry-run`
  primeiro é barato.
- **Seeds locais não vão junto.** `supabase/seed/` (incluindo as allowlists de segurança usadas pelo
  pgTAP) roda em `db reset` local, nunca em `db push`. Isso é proposital: são helpers de teste e
  não têm nada que fazer num projeto remoto.

## 2b. Rota manual: SQL Editor (quando o CLI está bloqueado)

Usada em 2026-08-31: o Windows Application Control bloqueia `supabase.exe`, e desativar Smart App
Control para contornar isso **não é uma opção aceitável** — o antivírus estava certo em ser chato, e
a resposta é outro caminho, não um caminho mais fraco.

### Gerar o bundle

```
node scripts/make-dev-bootstrap.mjs           # escreve fora do repo, em %TEMP%
```

Ele concatena as migrations **literalmente**, na ordem dos timestamps (que é uma ordem topológica
válida: cada `references public.<tabela>` aponta para tabela criada num arquivo anterior), dentro de
um único `begin; … commit;`. Nenhuma migration usa `CREATE INDEX CONCURRENTLY`, então a transação é
segura: ou o banco fica exatamente com o schema das migrations, ou fica exatamente como estava.

**O bundle nunca entra no git.** Ele é derivado, descartável, e versioná-lo criaria uma segunda
fonte de verdade que envelhece em silêncio — exatamente o problema que D-87 já custou uma tarde.

**`supabase/seed/` fica de fora**, de propósito: os helpers de teste e as allowlists do pgTAP são
locais e não têm o que fazer num projeto remoto.

### Aplicar

1. Supabase → projeto **hair-care-dev** → **SQL Editor** → **New query**
2. Colar o conteúdo do bundle inteiro
3. **Run**
4. Conferir: `node scripts/check-remote-schema.mjs` → tem de sair `OK`

### ⚠️ 4. A history remota fica dessincronizada — reconcilie antes do próximo `db push`

Aplicar por SQL Editor cria o **schema** sem escrever nada em `supabase_migrations.schema_migrations`.
Para o CLI, o banco continua "sem nenhuma migration aplicada": **o próximo `supabase db push` tentaria
reaplicar tudo do zero**, e falharia feio no meio.

Assim que o CLI voltar a ser utilizável, antes de qualquer push:

```bash
npx --yes supabase@latest link --project-ref ayecidupmxmirwfzwtea
npx --yes supabase@latest migration list           # remoto aparece vazio
npx --yes supabase@latest migration repair --status applied <version> # uma por migration já aplicada
npx --yes supabase@latest migration list           # local e remoto batendo
```

As versões são os prefixos dos arquivos (`20260826000000`, `20260827000000`, …). `migration repair`
**só escreve na tabela de histórico** — não toca no schema.

**Enquanto isso não for feito, nenhuma migration nova pode ir por `db push` neste projeto.** Uma
migration nova, antes do repair, aplica-se por este mesmo caminho manual.

## 3. O que esperar depois

Com as tabelas no lugar, uma usuária **sem** `hair_profiles` cai no **onboarding**, que é o
comportamento correto — e sempre foi. A tela de erro aparecia porque a leitura **falhava**, não
porque estava vazia, e essa distinção é deliberada: tratar falha de leitura como "não tem perfil"
empurraria a usuária para o onboarding e arriscaria criar um segundo snapshot. Ausência é `null`;
falha é erro (SPEC-002).

Em desenvolvimento, a tela de erro agora mostra o motivo real embaixo do botão (`__DEV__` apenas,
D-87) — foi exatamente a informação que faltou nesse dia.
