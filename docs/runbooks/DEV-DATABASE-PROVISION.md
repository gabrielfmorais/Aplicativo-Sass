# Runbook — provisionar o banco do projeto Supabase DEV

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

## 3. O que esperar depois

Com as tabelas no lugar, uma usuária **sem** `hair_profiles` cai no **onboarding**, que é o
comportamento correto — e sempre foi. A tela de erro aparecia porque a leitura **falhava**, não
porque estava vazia, e essa distinção é deliberada: tratar falha de leitura como "não tem perfil"
empurraria a usuária para o onboarding e arriscaria criar um segundo snapshot. Ausência é `null`;
falha é erro (SPEC-002).

Em desenvolvimento, a tela de erro agora mostra o motivo real embaixo do botão (`__DEV__` apenas,
D-87) — foi exatamente a informação que faltou nesse dia.
