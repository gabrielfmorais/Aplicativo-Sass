# ADR-003 — Repository Strategy (mono/multi-repo, workspaces, admin)

**Status:** **Accepted** (D-02; admin adiado por D-23, 2026-08-26) · **Data:** 2026-08-26

## Context
Precisamos: (a) domínio TS puro testável sem React Native; (b) mesmo domínio importado por Edge Functions (Deno) e, no futuro, por um admin web; (c) Supabase schema-as-code no mesmo fluxo de PR; (d) evitar monorepo "porque é sofisticado".

## Decision
**Um único repositório GitHub** com **pnpm workspaces mínimos**:

```
apps/mobile        (Expo)
packages/core      (domínio + application, TS puro)
supabase/          (migrations, functions, seed, tests — não é workspace npm)
docs/
```

- **Apenas dois pacotes npm** no MVP. Não criar `packages/ui`, `packages/types`, `packages/validation`, `packages/config` até existir um segundo consumidor real (admin). Tipos e schemas vivem em `packages/core`.
- **`apps/admin` não é criado no MVP.** Operação via Supabase Studio + migrations/seeds + runbooks. Critério para criar: ≥ 1 operação recorrente semanal que exija UI (ex.: edição de conteúdo por não-dev) ou necessidade de suporte a usuárias.
- Edge Functions importam `packages/core` via import map / bundling na fase Foundation (validar com spike; fallback: build de `core` para ESM em `supabase/functions/_shared/core`).
- Ferramentas de repo: `pnpm`, TypeScript project references, ESLint flat config compartilhado na raiz, Prettier, `dependency-cruiser`.
- GitHub é a fonte de verdade; branches `main`, `feature/*`, `fix/*`, `chore/*`, `docs/*`; PR obrigatório para `main` com CI verde e revisão.

## Alternatives Considered
- **Repo único sem workspaces** (core dentro de `apps/mobile/src/core` + Jest): mais simples, mas Edge Functions e admin não importam o core sem hacks; a fronteira vira convenção, não estrutura.
- **Multi-repo** (mobile, backend, core publicado no npm): overhead de versionamento e PRs cruzados para uma equipe pequena.
- **Monorepo completo** (Turborepo/Nx, 6+ pacotes): overengineering para o MVP.

## Trade-offs
+ Uma PR muda schema + core + app atomicamente.
+ Fronteira física do domínio.
− pnpm workspaces + Metro exigem configuração (`metro.config.js` com `watchFolders`) — custo único conhecido.
− Deno importar TS de workspace precisa de spike (risco baixo; alternativa de build documentada).

## Consequences
- Fase Foundation cria o esqueleto, CI, lint boundaries. Sem código de produto.
- Estrutura detalhada em [REPOSITORY-STRUCTURE](../architecture/REPOSITORY-STRUCTURE.md).

## Security Impact
- CODEOWNERS por diretório sensível (`supabase/**`, `packages/core/src/**/domain/**`, `.github/**`, `CLAUDE.md`).
- Secret scanning e branch protection em `main` (sem force push, revisão obrigatória, status checks).

## Reversibility
Alta para adicionar pacotes/apps; média para fundir de volta.
