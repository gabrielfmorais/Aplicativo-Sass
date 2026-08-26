# ADR-001 — Application Architecture

**Status:** **Accepted** (D-01, 2026-08-26) · **Data:** 2026-08-26

## Context
O produto tem regras críticas (diagnóstico, cronograma, entitlements) que serão desenvolvidas majoritariamente por agentes de IA. Sem fronteiras explícitas, essas regras acabam em componentes React e chamadas diretas ao Supabase. Ao mesmo tempo, o MVP precisa ser pequeno; Clean Architecture completa criaria dezenas de abstrações sem uso.

## Decision
Arquitetura em **camadas pragmáticas com módulos por bounded context**:

```
presentation → application → domain ← infrastructure
```

- **domain** (`packages/core/src/<ctx>/domain`): entidades, value objects, enums, schemas zod, engines puros, invariantes, erros tipados. Zero dependências de framework.
- **application** (`packages/core/src/<ctx>/application`): casos de uso como funções com dependências explícitas; **ports** (interfaces) para repositórios/serviços externos.
- **infrastructure** (`apps/mobile/src/infrastructure/*`, `supabase/functions/*`): implementações dos ports (Supabase, notificações locais, analytics, storage).
- **presentation** (`apps/mobile/src/features/<ctx>`, `src/app`): telas, componentes, hooks que chamam casos de uso.

Regras:
1. `domain` não importa `application`, `infrastructure`, `presentation`, React, Expo, Supabase.
2. `presentation` nunca importa `@supabase/*` nem contém regra de negócio (`if plan === 'premium'` proibido fora do EntitlementService).
3. Um caso de uso = uma função `(deps) => (input) => Promise<Result>`; sem classes obrigatórias, sem "interactor/presenter/gateway".
4. Repositórios só para agregados (HairPlan, CareExecution, HairProfile...). Leituras de tela usam **queries** (read models) diretas via adapter — não forçar tudo por repositório.
5. Enforcement: `no-restricted-imports` no ESLint por diretório + `dependency-cruiser` em CI + `packages/core/package.json` sem deps de UI/infra.

## Alternatives Considered
- **Feature folders sem camadas** (tudo em `features/x`): rápido, mas regras vazam para UI — exatamente o risco com IA.
- **Clean Architecture completa** (entities/use-cases/adapters/frameworks com interfaces para tudo): protege bem, mas custo alto para MVP e agentes tendem a gerar boilerplate incorreto.
- **Regras no banco (PL/pgSQL)**: engine de cronograma em SQL é difícil de testar/versionar; mantemos SQL apenas para integridade e transações.

## Trade-offs
+ Regras testáveis em Node puro em milissegundos; reutilizáveis em Edge Functions e admin.
+ Fronteiras verificáveis por lint.
− Duas "casas" para código (core e app) exigem disciplina de onde colocar cada coisa (DOMAIN-MAP §5 resolve).
− Alguma duplicação entre schema zod (core) e CHECK constraints (DB) — aceita: defesa em profundidade.

## Consequences
- `packages/core` é criado na fase Foundation com estrutura vazia + lint rules + testes de exemplo.
- Toda SPEC declara o que vai em domain/application/infrastructure/presentation.

## Security Impact
Positivo: regras críticas isoladas, revisáveis (CODEOWNERS em `packages/core/src/**/domain`), e executáveis server-side.

## Reversibility
Média. Remover camadas é fácil; recriá-las depois de vazamento de regras é caro. Decisão deliberadamente "sticky".
