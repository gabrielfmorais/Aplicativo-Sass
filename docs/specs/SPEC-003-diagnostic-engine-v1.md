# SPEC-003 — Diagnostic Engine v1

| Campo | Valor |
|---|---|
| ID | SPEC-003 |
| Status | **FOLDED INTO SPEC-004** (decisão humana 2026-08-27 — D-66; ADR-007 Amendment A2). **Não implementada** — nenhum código/migration/dependência foi criado. A responsabilidade técnica do Assessment/Diagnostic é entregue na vertical slice da SPEC-004; a fronteira de domínio Diagnostic permanece (módulo `packages/core/src/diagnostic/`). Este documento fica como registro histórico. |
| Owner | @gabrielfmorais (humano) |
| Bounded Context | Diagnostic (Core — regras) — DOMAIN-MAP §3.3 |
| Related ADRs | ADR-001 (camadas), ADR-007 (Diagnostic & Schedule Engine + A1 governança de regras — D-26), ADR-008 (time) |
| Related SPECs | SPEC-002 (Hair Profile — implemented; entrega `HairProfileSnapshot`, os 8 inputs autoritativos) · SPEC-004 (Schedule + generate-plan — consome `DiagnosticResult`; **persiste** o resultado) |
| Decisões vinculantes | D-06 (engines puros, versionados, golden tests), **D-26** (engenharia projeta o mecanismo; **não** inventa regra/ciência capilar de produção) |
| Fase do roadmap | 3 — Diagnostic Engine v1 |
| Labels | `engine` |
| Criado / Atualizado | 2026-08-27 / 2026-08-27 |

> **Terminologia (produto):** "diagnostic" aqui = **avaliação/classificação capilar personalizada**, **não** diagnóstico médico ou dermatológico. Nada nesta SPEC afirma condição de saúde.
>
> **Separação obrigatória (D-26):** esta SPEC define **(A) a estrutura técnica** do engine (função pura, versionada, determinística, testável). Ela **NÃO** define **(B) o conteúdo de domínio** — as regras que mapeiam os inputs para a saída (pesos, níveis, "se X então Y", classificação de dano, frequência ideal). O conteúdo (B) é **hipótese de engenharia até validação especializada** e **bloqueia a implementação** do que for voltado à usuária (§23, BLOCKING).
>
> ✅ **Decisão de arquitetura RESOLVIDA (D-66, 2026-08-27 — ADR-007 Amendment A2):** **FOLD** — a entrega do Assessment/Diagnostic Engine acontece na **SPEC-004** (vertical slice), mantendo `diagnostic/` e `schedule/` como módulos distintos. `diagnostic_results` **não** é pré-aprovada (necessity review na SPEC-004). Este documento permanece como registro; o conteúdo técnico abaixo é insumo para a SPEC-004. Termo de produto: **"Avaliação capilar"** (nunca diagnóstico médico/dermatológico).

## 1. Context
SPEC-002 coleta e preserva o perfil capilar (8 inputs aprovados — D-62) como `HairProfileSnapshot` imutável. Ainda não há nada que **interprete** esse perfil. O Diagnostic Engine é a primeira peça de valor derivado: transforma o perfil numa avaliação estruturada e **determinística**, que a SPEC-004 usará para gerar o cronograma. Maior risco de produto = as regras capilares (D-26): por isso o engine é isolado, puro e versionado, e as regras são governadas.

## 2. Problem
Dado um `HairProfileSnapshot`, produzir uma avaliação **estável, explicável e versionada** (mesma entrada + mesma versão ⇒ mesma saída), sem I/O, sem inventar ciência capilar, e com um contrato claro para o downstream — de forma que as regras possam ser revisadas por especialista e evoluídas por **nova versão** sem quebrar resultados anteriores.

## 3. Goals
- G1 `DiagnosticEngine.run(input, version)` **puro, determinístico, sem I/O** (ADR-007/D-06): mesma entrada + mesma versão ⇒ mesma saída (golden tests).
- G2 A entrada autoritativa é o `HairProfileSnapshot` da SPEC-002 (os 8 inputs); sem coletar dados novos.
- G3 A saída carrega `algorithm_version` e é **imutável**; toda avaliação é rastreável ao `hair_profile_id` de origem.
- G4 As regras vivem como **dados versionados** com o envelope de governança D-26 (`rule_id, version, description, inputs, output, rationale_source, validation_status`); só `validated` vai a produção.
- G5 Explicabilidade: a saída inclui **reason codes** estáveis (por que aquela avaliação); a copy pt-BR é da camada de UI/conteúdo, sem jargão médico. **Sem** score/porcentagem/`confidence` (falsa precisão — §3 do memo).
- G6 Mudar comportamento = **nova versão** do engine; versões liberadas nunca são editadas.

## 4. Non-Goals
- **Persistência** (`diagnostic_results`), Edge Function `generate-plan`, RPC, DB, RLS — **SPEC-004** (esta SPEC é pacote puro, "sem persistência ainda" — MVP-ROADMAP F3).
- Cronograma/plano/frequência ideal — SPEC-004.
- Tela de resultado / "preview" para a usuária — SPEC-004/005.
- **As regras de domínio v1 e a taxonomia de saída** (conteúdo capilar) — **HUMAN PRODUCT GATE + especialista** (§7-B, §23 BLOCKING; D-26).
- IA / assistente / recomendação por IA — fora do MVP; tratado separadamente depois.
- Coletar novos inputs; alterar o `HairProfileSnapshot` (contrato da SPEC-002).
- Nova dependência npm; state manager; qualquer runtime não puro.

## 5. User Stories
- US1 (sistema) Dado o perfil salvo, o engine produz uma avaliação determinística que a SPEC-004 consegue transformar em plano.
- US2 (produto, via SPEC-004) A usuária poderá ver "como entendemos o seu cabelo" em linguagem clara (reasons) — a **tela** é da SPEC-004/005; aqui só o dado.
- US3 (evolução) Especialista revisa/atualiza as regras; uma **nova versão** do engine é criada sem alterar avaliações antigas.

## 6. Functional Requirements
| ID | Requisito |
|---|---|
| FR1 | `DiagnosticEngine.run(input: HairProfileSnapshot, version: AlgorithmVersion): DiagnosticResult` — função pura em `packages/core/src/diagnostic/`. Sem I/O, sem `new Date()` (ADR-008), sem rede/fs/env. |
| FR2 | A saída inclui `algorithm_version`, o `hair_profile_id` de origem, a avaliação estruturada (§7-B) e `evidence` (reason codes estáveis; a copy pt-BR fica na UI/conteúdo). **Sem** `confidence`/score/porcentagem. |
| FR3 | Determinismo total: mesma `(input, version)` ⇒ saída idêntica (golden fixtures). |
| FR4 | Inputs `unknown`/`varies` (SPEC-002) são tratados de forma **definida** pelas regras aprovadas (ex.: caem em default conservador), nunca causam erro. |
| FR5 | Regras carregam o envelope D-26 e `validation_status`; o default de produção só pode apontar para uma versão `validated`. |
| FR6 | Versionamento: regras/engine em `packages/core/src/diagnostic/versions/<v>/`; mudar comportamento = nova versão; versão liberada é imutável. |

## 7. Business Rules

### 7-A. Estrutura técnica (engenharia — definida aqui)
| ID | Regra | Onde |
|---|---|---|
| BR1 | O engine é **puro/determinístico/sem I/O**; toda dependência de "hoje"/aleatório é proibida (ADR-008/D-06). | `packages/core/src/diagnostic` |
| BR2 | Regras são **dados versionados**, não código espalhado; carregam `rule_id, version, description, inputs, output, rationale_source, validation_status ∈ {draft, awaiting_domain_review, validated, deprecated}` (D-26/ADR-007 A1). | `diagnostic/versions/<v>` |
| BR3 | `DiagnosticResult` é imutável e carrega `algorithm_version` e `hair_profile_id`; a mesma versão nunca muda de comportamento após liberada. | tipo em core |
| BR4 | Entrada = `HairProfileSnapshot` (SPEC-002); o engine **não** conhece Supabase/UI/DB nem lê `auth.users`. | contrato core |

### 7-B. Conteúdo de domínio (NÃO definido aqui — HUMAN PRODUCT GATE / D-26)
O que o engine **produz** e **como** os 8 inputs mapeiam para essa saída é **conteúdo capilar** e exige validação especializada. Itens que **não** são inventados por engenharia (nascem `draft`, requerem aprovação antes de produção):
- **Taxonomia de saída:** quais eixos/rótulos a avaliação produz (ex.: necessidades de hidratação/nutrição/reconstrução em níveis; flags de dano por calor/química). *Hipótese de engenharia — não aprovada.* **Sem** `confidence`/score sem método calibrado (§3 do memo).
- **Regras v1:** o mapeamento concreto `inputs → saída` (pesos, limiares, "se X então Y"), incluindo o tratamento de `unknown`/`varies` e como combinações interagem.
- **Racional/fonte** de cada regra (`rationale_source`) e o critério de `validated`.

**Decisões de domínio a validar (lista exata — HUMAN/ESPECIALISTA; nenhuma escrita agora):**
1. Quais **outputs inferidos** a avaliação produz e por quê (eixos de necessidade e/ou flags) — só os que habilitam uma decisão concreta do Schedule.
2. Para cada output: a **regra** `inputs(8) → output` (limiares/pesos/combinações), incl. `unknown`/`varies`.
3. Quais flags são **inferência real** vs. mera repetição do observado (evitar "falsa inteligência" — §5 do memo).
4. Conjunto de **reason codes** (identificadores estáveis) que justificam cada output.
5. Critério de `validated` e `rationale_source` de cada regra; quem assina.
6. O que a usuária **vê** como "Avaliação capilar" (se algo) e quando incrementa a versão.

## 8. Data Model Impact
**Nenhum.** SPEC-003 é pacote puro: sem tabela, sem migration, sem RLS, sem seed. A persistência do `DiagnosticResult` (tabela `diagnostic_results`) é da **SPEC-004** (DATA-MODEL §3.4).

## 9. API / Contracts
- **Core (`packages/core/src/diagnostic`)**, TypeScript puro:
  - `run(input: HairProfileSnapshot, version: AlgorithmVersion): DiagnosticResult`.
  - `DiagnosticResult` (shape definido por engenharia; **conteúdo dos campos** conforme §7-B): `{ algorithmVersion, hairProfileId, assessment: <taxonomia aprovada>, evidence: ReadonlyArray<{ reasonCode: string }> }`. **Sem** `confidence`/score; **sem** strings de UX no core (copy pt-BR = camada de conteúdo/UI).
  - `AlgorithmVersion` (ex.: `'diag-v1'`).
  - Regras expostas como dados versionados com metadados D-26 (BR2).
- Sem RPC, sem Edge Function, sem HTTP. O consumidor (SPEC-004) importa o tipo e chama a função pura (ou a executa numa Edge Function **na SPEC-004**, reusando `packages/core` via Deno — CORE-RUNTIME-SPIKE/D-40).

## 10. Authorization
Não se aplica: função pura, sem dados persistidos e sem superfície de rede nesta SPEC. Autorização/persistência entram na SPEC-004 (onde `diagnostic_results` terá RLS).

## 11. Security Considerations
Superfície mínima: **0 tabela, 0 RPC, 0 Edge, 0 grant, 0 dependência**. O engine recebe dados já de posse da usuária (o snapshot) em memória e retorna um valor; **não** persiste, **não** loga valores de perfil, **não** faz rede. Checklist SECURITY-BASELINE §13: sem novo dado persistido, sem PII em logs/analytics (o engine não loga), sem segredos. Ameaça relevante: apenas correção/consistência de regras (governança D-26), não superfície de ataque.

## 12. Privacy Considerations
Nenhum dado pessoal novo é coletado ou persistido. O `HairProfileSnapshot` já existe (SPEC-002). O `DiagnosticResult` não é persistido nesta SPEC. Nada em logs/analytics.

## 13. Analytics Events
**Nenhum** nesta SPEC (coerente com SPEC-002: analytics deferido para SPEC-011). Eventos como `diagnostic_completed` podem surgir quando houver persistência/tela (SPEC-004+).

## 14. UX Notes
Sem UI nesta SPEC. A apresentação é da SPEC-004/005. A UI/conteúdo renderiza os **reason codes** em linguagem clara pt-BR; termo de produto: **"Avaliação capilar"** — **sem** termos médicos/dermatológicos (D-26/terminologia) e sem exibir score/porcentagem.

## 15. Edge Cases
- EC1 Todos/vários inputs `unknown`/`varies`: a saída deve ser definida (avaliação conservadora / default) — comportamento **conforme regras aprovadas** (§7-B). Sem `confidence`.
- EC2 `HairProfileSnapshot` de uma versão futura com campos extras: o engine ignora o desconhecido de forma determinística (contrato estável) — ou requer nova versão do engine (decisão de versionamento).
- EC3 Combinações raras de inputs: cobertas por golden fixtures acordadas com o especialista.

## 16. Failure Modes
- Input que não satisfaz o contrato `HairProfileSnapshot`: erro de validação (`ValidationError`) antes de rodar; o engine não "adivinha".
- Regra referenciando versão inexistente/`draft` em produção: proibido por FR5 (guard/teste).

## 17. Acceptance Criteria (técnicos — verificáveis sem o conteúdo de domínio)
| ID | Critério |
|---|---|
| AC1 | `run(input, version)` é **puro e determinístico**: a mesma `(input, version)` produz saída idêntica (golden test); nenhuma dependência de relógio/aleatório/rede (dep-cruise + revisão). |
| AC2 | A saída carrega `algorithmVersion` e o `hairProfileId` de origem. |
| AC3 | O engine importa **apenas** o contrato da SPEC-002 e primitivas puras do core; **não** importa React/Expo/`@supabase/*`/Deno APIs (dep-cruise verde). |
| AC4 | Inputs `unknown`/`varies` não causam erro; produzem saída definida (conforme regras aprovadas). |
| AC5 | Regras carregam o envelope D-26; um teste/guard garante que o **default de produção** aponta para uma versão `validated` (nunca `draft`). |
| AC6 | Mudar comportamento cria **nova versão**; a versão anterior permanece no código e seus golden fixtures continuam passando (imutabilidade de versão liberada). |
| AC7 | **(BLOCKED até §23)** Os golden fixtures refletem as regras/taxonomia **aprovadas** pelo especialista; a v1 só é `validated` após revisão de domínio. |

## 18. Testing Strategy
- **Unit + golden (Vitest, `packages/core`):** determinismo, `algorithm_version`, tratamento de `unknown`/`varies`, guard de `validation_status`, imutabilidade entre versões. Golden fixtures = pares (input → resultado esperado) **acordados com o especialista** (BLOCKED até §23).
- **Boundary (dep-cruise):** engine puro, sem imports proibidos.
- Sem integração/RLS/E2E nesta SPEC (sem persistência/UI).

## 19. Dependencies
- SPEC-002 (implemented) — `HairProfileSnapshot`, os 8 inputs autoritativos.
- **Conteúdo de domínio (bloqueante):** taxonomia de saída + regras v1 validadas por especialista (§7-B/§23).
- ADR-001/007/008. **Nenhuma dependência npm nova** (TS puro; zod já presente se for validar o input).

## 20. Architecture mechanisms
| Mecanismo | KEEP / REMOVE / DEFER | Motivo |
|---|---|---|
| `DiagnosticEngine.run` puro/versionado | **KEEP** | núcleo do valor; testável sem app (D-06) |
| Regras como dados versionados + envelope D-26 | **KEEP** | governança de regras capilares (ADR-007 A1) |
| `DiagnosticResult` tipo + golden tests | **KEEP** | contrato determinístico p/ SPEC-004 |
| Persistência `diagnostic_results` / Edge `generate-plan` / RPC / RLS | **DEFER → SPEC-004** | roadmap: "sem persistência ainda" |
| Tela de resultado / preview | **DEFER → SPEC-004/005** | fora do pacote puro |
| Taxonomia + regras v1 (conteúdo) | **HUMAN GATE / BLOCKING** | ciência capilar (D-26) |
| Nova dependência / state manager / IA | **REMOVE / DEFER** | YAGNI; IA fora do MVP |

## 21. Implementation Plan (NÃO iniciar; HUMAN GATE)
1. **[após §23]** Taxonomia de saída aprovada → tipo `DiagnosticResult` final.
2. Engine puro `run()` + `AlgorithmVersion` + estrutura de regras-como-dados (envelope D-26).
3. **[após §23]** Regras v1 validadas → golden fixtures (input → resultado) acordados.
4. Guard de `validation_status` (default de produção = `validated`).
5. Testes golden + boundary; export do contrato para a SPEC-004.

## 22. Migration / Rollback Plan
Nenhuma migration (pacote puro). Rollback = reverter a PR de código. Versões de engine são aditivas (nova pasta `versions/<v>`), nunca destrutivas.

## 23. Open Questions & Gates
| ID | Classe | Pergunta | Assunção |
|---|---|---|---|
| **OQ0** | **RESOLVED (D-66, 2026-08-27)** | Separar vs. fold. | **FOLD em SPEC-004** (ADR-007 Amendment A2); módulos `diagnostic/`+`schedule/` mantidos; `diagnostic_results` sob necessity review na SPEC-004. |
| **OQ1** | **BLOCKING BEFORE IMPLEMENTATION (HUMAN PRODUCT GATE + especialista / D-26)** | Qual é a **taxonomia de saída** aprovada (eixos/rótulos/flags) e as **regras v1** que mapeiam os 8 inputs para ela (incl. `unknown`/`varies`)? Sem `confidence`. | não inventar; engine só entra em produção com regras `validated`. A estrutura técnica (§7-A) pode ser construída antes; o conteúdo user-facing não. |
| OQ2 | IMPORTANT BEFORE IMPLEMENTATION | Como versões futuras do `HairProfileSnapshot` (novos inputs) se relacionam com versões do engine (EC2)? | contrato estável; input novo ⇒ possível nova versão do engine |
| OQ3 | CAN DEFER | `reasons[]` — vocabulário/estrutura final (códigos + mensagens pt-BR) | definir com o conteúdo de domínio (OQ1) |
| OQ4 | CAN DEFER | Persistência e execução via Edge (Deno) — desenho | SPEC-004 |

## 24. Change Log
| Data | Mudança | Autor |
|---|---|---|
| 2026-08-27 | v0.1 Draft via `spec-create`. Escopo mínimo (Ponytail/YAGNI): engine **puro, versionado, determinístico** + contrato `DiagnosticResult` + regras-como-dados com envelope D-26 + golden tests. **Sem** persistência/Edge/RLS/UI/dependência/IA (deferidos). Conteúdo capilar (taxonomia + regras v1) separado como **HUMAN GATE / BLOCKING** (§7-B, §23-OQ1, D-26). "diagnostic" = avaliação capilar personalizada, não médica. | Claude |
| 2026-08-27 | v0.2 **Boundary review** (memo): removida falsa precisão (`confidence`/score); `reasons[]` → `evidence` (reason codes estáveis, copy na UI/conteúdo); termo de produto "Avaliação capilar"; lista exata de decisões de domínio (§7-B); **OQ0 BLOCKING NOW** — decisão de arquitetura separar vs. fold em SPEC-004 (recomendação: fold). Continua Draft. | Claude |
| 2026-08-27 | **FOLDED INTO SPEC-004** (decisão humana D-66; ADR-007 Amendment A2). Não implementada; sem código. Fronteira de domínio preservada (módulo `diagnostic/`). Documento vira registro histórico + insumo da SPEC-004. | Humano / Claude |
