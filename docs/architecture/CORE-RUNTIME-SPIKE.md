# CORE RUNTIME SPIKE — `packages/core` on Node, Deno and Hermes

| Campo | Valor |
|---|---|
| Data | 2026-08-26 |
| SPEC | SPEC-000 §16 / §20 (PR 3), AC8 |
| Decisão relacionada | D-40 (bundling), D-49 (árvore de decisão), ADR-007 (engine na Edge) |
| Resultado | **Estratégia A adotada — consumo direto do core a partir de Deno, sem build** |

## Hipótese testada
O mesmo código-fonte TypeScript de `packages/core` é consumido, sem duplicação nem etapa de build, por:
1. Node 22.23.2 (Vitest, tsc, ESLint);
2. Deno 2.9.5 (runtime das Supabase Edge Functions);
3. Expo SDK 57 / Hermes (Metro) — verificado na PR 4 do skeleton mobile.

## Problema observado na primeira tentativa
Deno **não** reescreve `import './x.js'` para `x.ts` (convenção Node/TS "ESM com extensão .js"). `deno check` falharia com "module not found".

## Causa raiz
Diferença de resolução de módulos: Node/TS aceitam a extensão `.js` apontando para fontes `.ts`; Deno exige a extensão real do arquivo (ou import map/sloppy imports instáveis).

## Estratégia A — resultado: **SUCESSO**
Mudança única e limpa: os imports relativos dentro do core usam a **extensão real `.ts`**, habilitada por `allowImportingTsExtensions: true` (válido porque o core só emite declarações — `emitDeclarationOnly`).

| Runtime | Como consome | Evidência |
|---|---|---|
| Node (tsc) | `tsc -p packages/core` | `pnpm typecheck` ✔ |
| Node (Vitest) | resolução Vite de `.ts` | `pnpm test` → 22/22 ✔ |
| ESLint / dependency-cruiser | resolução TS | `pnpm lint`, `pnpm dep-cruise` ✔ (30 módulos) |
| Deno | `supabase/functions/deno.json` → `"@app/core": "../../packages/core/src/index.ts"`; `"zod": "npm:zod@4.4.3"` | `deno check health/index.ts _spike/core-smoke.ts` ✔ · `deno run _spike/core-smoke.ts` → `{"ok":true,"runtime":"deno","denoVersion":"2.9.5","coreVersion":"0.0.0-foundation"}` ✔ · `deno lint` ✔ |
| Hermes (Metro) | Metro resolve `./x.ts` literalmente | verificado na PR 4 (ver SPEC-000 evidência AC9) |

Primitivas exercitadas sob Deno: `toLocalDate` com `Intl` (virada de dia, DST histórico), `addDays`, `globalThis.crypto.randomUUID`, `zod` (schema de regra de domínio), `fixedClock`.

## Estratégia B (bundle ESM) — **não necessária**
Não foi tentada porque A não apresentou motivo técnico. Permanece documentada em SPEC-000 §16 como fallback caso o bundling do deploy (`supabase functions deploy`) rejeite arquivos fora de `supabase/functions/` — ver verificação residual abaixo.

## Complexidade introduzida
- 1 flag de compilador (`allowImportingTsExtensions`).
- 1 arquivo `deno.json` com 3 entradas de import map (o mapeamento de `zod` **deve** espelhar `packages/core/package.json`; regra registrada no CLAUDE.md e no `/pre-commit-review`).
- 0 build steps, 0 hacks de runtime, 0 duplicação de código.

## Restrições que o core deve continuar respeitando (mecanizadas)
- `tsconfig`: `lib: ["ES2022"]`, `types: []` (sem DOM, sem @types/node).
- ESLint: sem `react*`, `expo*`, `@supabase/*`, `node:*`/built-ins; sem `process`, `fetch`, `window`; sem `new Date()`/`Date.now()` fora de `system-clock.ts`.
- dependency-cruiser: sem `dependencyTypes: core`.
- Dependências runtime: somente `zod` (ESM puro, compatível com os 3 runtimes). `date-fns`/`date-fns-tz` **não introduzidas** (D-33): `Intl.DateTimeFormat` cobre a conversão de fuso nos três runtimes.
- CI: job `core-deno` executa `deno check` + `deno run _spike/core-smoke.ts` + `deno lint` a cada mudança em `packages/core` ou `supabase/functions`.

## Verificações residuais (fora do alcance deste ambiente)
| Verificação | Status | Como reproduzir |
|---|---|---|
| `supabase functions serve health` local (edge-runtime real) | **BLOCKED — requer Docker Desktop** | `npx supabase start && npx supabase functions serve health --no-verify-jwt` → `curl localhost:54321/functions/v1/health` |
| Bundling de deploy inclui `../../packages/core/src/**` | Não verificado (deploy remoto proibido na SPEC-000) | Na SPEC-004 (primeira função real), `supabase functions deploy --project-ref <dev>` em projeto **dev**; se falhar, aplicar Estratégia B (esbuild → `functions/_shared/core.js`) via SPEC própria |
| Hermes: `Intl.DateTimeFormat(timeZone)` e `crypto.randomUUID` | Verificado por typecheck/bundle na PR 4; execução em dispositivo/simulador é smoke manual | `pnpm --filter mobile exec expo start` → rota placeholder mostra `todayInSaoPaulo` e um uuid |

## Decisão registrada
**D-40 = Estratégia A.** ADR-007 permanece inalterada (a decisão "engine na Edge importa o mesmo pacote" foi confirmada, não emendada).
