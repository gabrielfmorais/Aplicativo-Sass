# ADR-007 — Diagnostic & Schedule Engine Architecture

**Status:** **Accepted** (D-06, 2026-08-26) com **Amendment A1** (D-26) e **Amendment A2** (D-66, 2026-08-27) · **Data:** 2026-08-26

## Amendment A1 — Governança das regras de domínio (decisão humana D-26, 2026-08-26)
> **Engineering may design the engine. Engineering may NOT invent production hair-care rules.**

- O engine (mecanismo: tipos, execução, versionamento, testes) é responsabilidade de engenharia.
- As **regras** (`DiagnosticRulesV1`, `ScheduleRulesV1`) são artefatos separados (`rules.ts` + documento `docs/domain-rules/*.md`) e passam por **validação humana especializada** antes de serem production-ready.
- Cada regra possui obrigatoriamente: `rule_id`, `version`, `description`, `inputs`, `output`, `rationale_source`, `validation_status ∈ {draft, awaiting_domain_review, candidate, validated, deprecated}`.
- **`candidate`** (esclarecimento D-67, 2026-08-27) = decisão humana de produto, **implementável e usável em desenvolvimento/internal beta**, ainda **não** validada por especialista.
- Só regras `validated` podem compor uma versão de engine em **PUBLIC RELEASE**; o build/teste de release público deve falhar se referenciar regra não `validated`. Regras `candidate` podem ser implementadas/testadas e usadas em dev/internal beta, mas **não** em release público. O requisito de validação para release **não** é enfraquecido.
- Agentes de IA **não** apresentam suposições próprias como conhecimento capilar validado; regras que criarem nascem como `draft` com `rationale_source` explícito ("hipótese de engenharia — requer revisão").
- Esta exigência não bloqueia a Foundation (SPEC-000), que implementa apenas o mecanismo e o schema das regras.

## Amendment A2 — Entrega em vertical slice única (decisão humana D-66, 2026-08-27)
> **Diagnostic/Assessment e Schedule mantêm fronteiras técnicas distintas, mas a primeira implementação MVP é entregue numa única vertical slice (SPEC-004).**

- Preservados: dois domain services puros e responsabilidades distintas (`packages/core/src/diagnostic/` e `.../schedule/`), regras versionadas quando necessário, D-26, determinismo, golden tests, mesma lógica autoritativa em qualquer runtime.
- Alterado **apenas** o que exigia SPEC-003 e SPEC-004 como **entregas separadas**: evita-se um pacote Diagnostic-esqueleto sem consumidor independente (único consumidor do resultado é o Schedule). A **SPEC-003 fica FOLDED INTO SPEC-004**; a fronteira de domínio Diagnostic **não** é revogada.
- A persistência do resultado de avaliação (`diagnostic_results`) **não** é pré-aprovada por esta ADR: a SPEC-004 faz necessity review explícita (pode ser artefato transitório entre os engines). Provenance/versão só existem se houver necessidade real.

## Context
Os engines são o coração do produto e o principal alvo de "melhorias" por agentes. Precisam ser determinísticos, versionados, testáveis, auditáveis e server-enforced, sem abrir mão de preview instantâneo no app (P01).

## Decision

### Forma
- Dois **domain services puros** em `packages/core`:
  - `diagnostic/engine/<version>/` → `runDiagnostic(input: DiagnosticInput): DiagnosticResult`
  - `schedule/engine/<version>/` → `generateSchedule(input: ScheduleInput): { plan: HairPlanDraft; cares: ScheduledCareDraft[] }`
- **Sem I/O, sem relógio, sem random.** `referenceDate`, `timezone`, `startsOn` são inputs. Qualquer aleatoriedade (ex.: variação de conteúdo) recebe `seed`.
- Regras expressas como **dados declarativos** quando possível (tabelas de pesos, matrizes needs → ciclo) em arquivos `rules.ts` por versão, facilitando revisão por especialista capilar e futura configuração via admin.
- Saída inclui `explanations[]` (racional legível) — insumo de P05 (personalização percebida).

### Versionamento
- Cada versão é um diretório imutável: `v1/`, `v2/`. `CURRENT_DIAGNOSTIC_VERSION` e `CURRENT_SCHEDULE_VERSION` exportados de um único lugar.
- Mudar comportamento = nova versão. **Nunca** editar `v1/` após release (exceto bug com decisão explícita registrada e teste de regressão).
- Golden tests: fixtures de entrada → saída esperada em `__fixtures__/`; qualquer diferença falha CI.
- `diagnostic_results.algorithm_version` e `hair_plans.algorithm_version` gravam a versão usada. Planos históricos nunca são regenerados retroativamente; reavaliação cria novo plano (`superseded`).

### Onde executa
| Cenário | Onde | Persistido? |
|---|---|---|
| Preview durante onboarding ("veja seu cronograma") | Cliente (mesmo código) | Não |
| Criação/regeneração oficial do plano | Edge Function `generate-plan` → RPC `create_plan_tx` | Sim |
| Testes | Node (Vitest) | — |

Cliente e servidor executam a **mesma versão** do pacote (garantido por lockfile e por checagem `expected_version` no request: se o app estiver desatualizado, servidor responde com a versão atual e o app re-renderiza).

### Contratos
`DiagnosticInput`, `DiagnosticResult`, `ScheduleInput`, `HairPlanDraft`, `ScheduledCareDraft` são schemas zod versionados em `packages/core/src/<ctx>/contracts/`. Snapshots são gravados em `jsonb` para reprodutibilidade.

## Alternatives Considered
- Engine só no cliente + gravação direta: viola P10; cliente adulterado cria planos arbitrários; sem auditoria confiável.
- Engine em PL/pgSQL: server-enforced, mas ruim para testes/versionamento/revisão por não-devs.
- Regras como JSON em tabela desde o início (configurável por admin): flexível, mas exige interpretador/validador e admin — pós-MVP; a forma declarativa em TS prepara essa migração.
- Serviço de regras externo / LLM: não determinístico, custo, fora do MVP.

## Trade-offs
+ Determinismo e auditoria ("qual algoritmo gerou este plano?").
+ Mesma lógica em preview e produção.
− Manter versões antigas no código (aceito; remover só quando nenhum plano ativo referenciar).
− Edge Function precisa importar `packages/core` (spike na Foundation).

## Consequences
- Assessment/Diagnostic e Schedule definem regras v1 com participação de especialista capilar, entregues juntos na **SPEC-004** (vertical slice — Amendment A2/D-66); SPEC-003 foi **folded into SPEC-004**. Os módulos `diagnostic/` e `schedule/` permanecem separados.
- CODEOWNERS obriga revisão humana em `packages/core/src/{diagnostic,schedule}/engine/**`.

## Security Impact
Reduz T07 (rate limit por usuária na Edge), T20 (índice único + RPC transacional). Engine não recebe dados além do necessário (data minimization).

## Reversibility
Alta na forma (pure functions são portáveis); baixa na política de versionamento (deliberado).
