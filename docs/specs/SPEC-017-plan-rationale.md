# SPEC-017 — "Por que isso está no meu plano?"

| Campo | Valor |
|---|---|
| ID | SPEC-017 |
| Status | **IMPLEMENTADA** — OQ1 resolvida pelo dono em 2026-09-01: **opção A**. Validada a 390px no DEV real. |
| Owner | (humano) — projetopaporeto.erp@gmail.com |
| Bounded Context | **Diagnostic / Assessment** (DOMAIN-MAP §3.3) — dono da evidência — exposto numa superfície de **Care Tracking** (§3.5) |
| Related ADRs | ADR-001 (UI não contém regra), ADR-006 (fronteiras de domínio), ADR-007 (regras capilares / gate de validação), ADR-008 (datas) |
| Related SPECs | SPEC-004 (produz `evidenceCodes`), SPEC-005 (a tela Hoje), SPEC-014 (reavaliação — origem da armadilha em §2.1), SPEC-016 (a linguagem visual em que isto aparece) |
| Capability | **F21** do MASTER PRODUCT BACKLOG (D-92) — `COMMITTED` |
| Fase do roadmap | Pós-beta-experience, antes das capabilities que exigem schema novo |
| Criado / Atualizado | 2026-08-31 / 2026-08-31 |

## 1. Context

O cronograma já sabe se explicar. `buildPlan` devolve `evidenceCodes` — `goal_hydration`, `concern_dryness`, `chemical_exposure`, `wash_frequency_baseline` — e `EVIDENCE_LABEL` os traduz para frases que a usuária lê no **preview**: *"Você quer mais maciez e hidratação."*, *"A frequência dos cuidados acompanha a sua rotina de lavagem."*

Essa explicação aparece **uma vez**, na tela que ela vê antes de confirmar, e depois desaparece. No dia seguinte ela abre a Hoje, vê "Hidratação", e não há nada na tela que ligue aquele cuidado à conversa de oito perguntas que ela teve com o app.

## 2. Problem

**A pergunta do segundo dia é "por que isso?".** Um cronograma que não se explica é uma lista de tarefas; um que se explica é um plano. A diferença é exatamente a percepção de personalização que o produto vende — e a informação para isso **já existe e já está aprovada como copy**. Não estamos criando conteúdo capilar novo: estamos deixando de jogar fora o que já mostramos uma vez.

### 2.1 A armadilha, medida antes de desenhar

`hair_plans.hair_profile_id` registra o snapshot de perfil que gerou o plano — a migration diz explicitamente que a reprodutibilidade de um plano é `hair_profile_id` + versões das engines. Mas:

- **`CareBoard` não expõe `hairProfileId`.** A tela Hoje recebe `planId`, `startsOn`, `cares`, `executions`, `checkIns` e `lifetimeDoneCount`. Nada que diga de qual perfil o plano nasceu.
- **O perfil atual pode não ser o do plano ativo.** Na reavaliação (SPEC-014), `OnboardingScreen.onSaved` grava um **novo** snapshot de `hair_profiles` *antes* do preview. Se ela **cancelar** no preview, o plano ativo continua intacto — que é o que G3 promete — mas ele aponta para o perfil **antigo**, enquanto `hairProfile.getCurrent()` devolve o **novo**.

**Consequência:** recomputar a evidência a partir do perfil atual explicaria, com toda a confiança, **um plano que ela não tem**. Esse é o defeito central que esta SPEC precisa evitar, e é por isso que ela existe em vez de ser um patch de UI.

## 3. Goals

- G1 — A usuária consegue, na Hoje, entender **por que o cronograma dela é assim**, sem sair da tela.
- G2 — A explicação é **verdadeira sobre o plano ativo**, não sobre o perfil mais recente.
- G3 — Zero conteúdo capilar novo: só a evidência que a SPEC-004 já produz e que a `EVIDENCE_LABEL` já traduz.
- G4 — Divulgação progressiva: a explicação está disponível, não empurrada — ela não pode competir com a ação do dia (SPEC-016 §14 princípio 1).

## 4. Non-Goals

- NG1 — **Rationale por cuidado individual.** Ver §7 BR1: a evidência é do **plano**, não de cada cuidado. Inventar "esta hidratação está aqui porque X" seria fabricar causalidade que a engine não produz — proibido por D-26 e pela regra de Hair Intelligence em D-92.
- NG2 — Regra capilar nova, texto novo com orientação capilar substantiva (gate D-26/D-70).
- NG3 — Mudar a engine de assessment ou qualquer `evidenceCode`.
- NG4 — Persistir rationale no banco **se houver caminho sem schema novo** (ver OQ1). Coluna nova é a última opção, não a primeira.
- NG5 — Explicar o plano na tela de Progresso ou na Conta. Uma superfície por vez.

## 5. User Stories

- US1 — Como usuária no segundo dia, quero saber por que o app escolheu estes cuidados, para confiar que ele me ouviu.
- US2 — Como usuária que reavaliou e desistiu no meio, quero que a explicação continue descrevendo o cronograma que eu realmente tenho.
- US3 — Como usuária apressada, quero que a explicação não fique no meu caminho quando eu só quero marcar o cuidado do dia.

## 6. Functional Requirements

- FR1 — A tela Hoje oferece acesso à avaliação que originou o plano ativo, **fechada por padrão** (divulgação progressiva, como "Como fazer").
- FR2 — O conteúdo é a lista de `evidenceCodes` do plano ativo, traduzida por `EVIDENCE_LABEL`, mais o aviso já existente de que é leitura cosmética e não diagnóstico.
- FR3 — A evidência é derivada do **perfil que gerou o plano ativo**, nunca do perfil corrente quando os dois diferem (§2.1).
- FR4 — Se a evidência não puder ser determinada, a tela **não mostra a seção** — ausência é melhor que uma explicação possivelmente errada (fail closed).
- FR5 — Estados: **conteúdo** e **ausente**. O carregamento é deliberadamente invisível, e o erro também: esta é uma leitura de fundo para uma seção opcional no fim da Hoje, e um esqueleto piscando ali custaria mais atenção do que a informação vale. Falhar em explicar não é falhar em nada que ela precise para agir — a seção some, e nenhum "tentar novamente" aparece para algo que ninguém pediu.

## 7. Business Rules

- BR1 — **A evidência é do plano, não do cuidado.** Qualquer frase na UI tem de dizer isso: "seu cronograma", nunca "este cuidado". A engine produz emphasis + evidence no nível do plano (SPEC-004 / assessment v1).
- BR2 — **A UI não decide nada** (ADR-001). Nenhuma regra de assessment é reimplementada aqui.
- BR3 — Copy de interface reaproveitada (`EVIDENCE_LABEL`) **não** é conteúdo capilar novo e não abre gate. Qualquer frase nova que oriente cuidado abre (D-26/D-70).
- BR4 — Acessibilidade não regride: `accessibilityRole`, rótulo, estado `expanded`, alvo ≥ 44px (SPEC-016 BR4).

## 8. Data Model Impact

**Nenhum.** A opção A não toca schema: `hair_plans.hair_profile_id`, `assessment_algorithm_version` e `schedule_algorithm_version` já existiam, gravados justamente para reprodutibilidade. Mudou só o `select` do board.

- Se a resposta for **A** (expor `hairProfileId` no board e ler o snapshot): **nenhuma** mudança de schema. `hair_plans.hair_profile_id` já existe; muda só o `select` do adapter e o tipo `CareBoard`.
- Se for **B** (persistir os códigos com o plano): coluna nova em `hair_plans` + migration + backfill dos planos existentes. **Só com aprovação explícita**, e NG4 diz que é a última opção.

## 9. API / Contracts

**Dois contratos de `packages/core` mudam, e a SPEC dizia isso desde o rascunho.** `CareBoard` ganha `hairProfileId`, `assessmentAlgorithmVersion` e `scheduleAlgorithmVersion`; `HairProfilePort` ganha `getById`. Nenhum port novo, nenhuma RPC, nenhuma Edge Function. *Texto original:* Na opção A: `CareBoard` ganha `hairProfileId: string`, e o `HairProfilePort` ganha uma leitura por id (`getById`) ou o board passa a trazer o snapshot. **Ambas mudam contrato de port** — logo, ao contrário da SPEC-016, esta SPEC **toca `packages/core`** e precisa dizer isso desde já.

## 10. Authorization

**Nenhuma decisão de acesso muda.** A leitura adicional (perfil por id) acontece sob a mesma RLS que já governa `hair_profiles`: a usuária só lê os próprios snapshots. Um cliente adulterado que peça o perfil de outra pessoa continua recebendo zero linhas — a política é `user_id = auth.uid()`, e nada aqui a afrouxa.

## 11. Security Considerations

Checklist SECURITY-BASELINE §13:
- Tabela/coluna nova + RLS: **N/A na opção A**; na opção B, coluna em tabela que já tem RLS forçada.
- Autorização server-side: **inalterada**.
- Inputs validados: nenhum input novo da usuária.
- Cliente adulterado: superfície inalterada — só leitura, sob RLS existente.
- **PII:** a evidência é derivada das respostas dela e **já é exibida hoje no preview**. Não passa a ser logada, enviada nem persistida em lugar novo. Nenhum campo de texto livre (DATA-MODEL §4 — a ausência de campo livre é propriedade a preservar).
- Segredo: nenhum.

## 12. Privacy Considerations

Nenhum dado novo é coletado. Um dado já coletado passa a ser exibido em **uma segunda tela para a própria dona dele**. Nenhum evento novo.

## 13. Analytics Events

**Nenhum.** Continua adiado com o provider (D-31). Não construir emissor sem consumidor.

## 14. UX Notes (sem design visual)

O padrão já existe na tela e deve ser reusado em vez de inventado: **"Como fazer"** é um botão terciário que abre um painel no lugar. A avaliação segue a mesma gramática — terciária, fechada por padrão, abre em contexto — para que a Hoje continue com **uma** ação primária (SPEC-016 G3/AC1 do desenho).

Onde ela vive é OQ2: no cartão de foco (mais visível, mais ruído) ou no fim da tela como uma seção "Sua avaliação" (mais calma, menos descoberta).

## 15. Edge Cases

- EC1 — Plano ativo cujo perfil de origem foi apagado (`on delete cascade` remove os planos junto, então na prática não ocorre) → FR4, seção ausente.
- EC2 — Reavaliou e **cancelou**: a explicação tem de descrever o plano **antigo** (§2.1). É o caso que define a SPEC.
- EC3 — Reavaliou e **confirmou**: perfil e plano voltam a coincidir; a explicação muda junto, e isso está correto.
- EC4 — `evidenceCodes` vazio (não deve ocorrer — `balanced_default` é o piso) → FR4.
- EC5 — Código de evidência sem tradução em `EVIDENCE_LABEL` → mostrar o código cru é pior que omitir a linha; omitir a linha, manter as demais.
- EC6 — Texto longo em pt-BR e fonte grande do sistema: a seção cresce, não quebra.

## 16. Failure Modes

Se a leitura extra (opção A) falhar, a seção **não aparece** e o resto da Hoje continua funcionando. **Uma explicação é secundária; o loop diário é o produto** — nada aqui pode derrubar a tela do dia. Isso é deliberado e contrasta com a contagem vitalícia, cujo erro hoje derruba o board (achado registrado em D-93 §OPTIONAL, ainda em aberto).

## 17. Acceptance Criteria

- AC1 — A explicação exibida corresponde ao **perfil que gerou o plano ativo**, provado por um teste no cenário EC2 (reavaliar → cancelar → a evidência é a antiga).
- AC2 — Nenhuma frase afirma causalidade por cuidado individual (BR1) — revisão de PR + teste de copy.
- AC3 — Fechada por padrão; abre e fecha; nunca bloqueia a ação primária.
- AC4 — Falha de leitura ⇒ seção ausente, Hoje intacta (FR4/§16).
- AC5 — Acessibilidade: role, rótulo, `expanded`, alvo ≥ 44px.
- AC6 — Nenhum `evidenceCode` novo, nenhuma regra de assessment alterada, nenhum texto capilar novo.
- AC7 — `pnpm verify` verde; se a opção A mudar `CareBoard`, os testes de adapter e de tela cobrem o campo novo.

## 18. Testing Strategy

- Unit no core, se a derivação da evidência ganhar função própria.
- RNTL na Hoje: fechada por padrão, abre, fecha, ausente quando não há evidência.
- **O teste que importa** é o EC2: perfil corrente ≠ perfil do plano ⇒ a explicação segue o plano. Sem ele, a regressão volta em silêncio e ninguém percebe.
- pgTAP: só se a opção B for escolhida.
- Validação no DEV real (regra de DONE, CLAUDE.md §0.1): reavaliar, cancelar, e conferir que a explicação não mudou.

## 19. Dependencies

Nenhuma dependência nova. Nenhum serviço, credencial ou custo.

## 20. Implementation Plan

**TODO — depende da OQ1.** Esboço para a opção A:

1. `CareBoard` expõe `hairProfileId`; adapter passa a selecioná-lo (core + infra, com testes).
2. Leitura do snapshot por id e derivação da evidência a partir dele.
3. A seção na Hoje, fechada por padrão, reusando a gramática de "Como fazer".
4. Validação no DEV real, incluindo o cenário EC2.

## 21. Migration Plan

N/A na opção A. Na opção B, migration + backfill — e aí esta seção deixa de ser N/A e precisa de `migration-review`.

## 22. Rollback Plan

Reverter a PR. Na opção A nada é persistido, então o rollback é local à leitura e à apresentação.

## 23. Open Questions

- **OQ1 — RESOLVIDA (dono, 2026-09-01): opção A.** *"Use `hairProfileId` do plano ativo e derive os `evidenceCodes` do snapshot que realmente originou aquele plano. Não persistir dado derivável apenas para evitar leitura."* Registro das opções como estavam:
  - **(A) Expor `hairProfileId` no `CareBoard` e derivar do snapshot de origem.** Sem schema novo; usa o que a migration já registrou para reprodutibilidade. Custo: muda `CareBoard` e um port — esta SPEC passa a tocar `packages/core`, ao contrário da SPEC-016. **Assunção adotada:** A.
  - **(B) Persistir os `evidenceCodes` junto do plano.** Explicação imutável e barata de ler, imune a qualquer mudança futura de engine. Custo: coluna nova, migration, backfill dos planos existentes, e um segundo lugar guardando algo derivável. NG4 diz que é a última opção.
  - **(C) Não fazer.** Manter a explicação só no preview. Registrado para que a escolha seja consciente.
- **OQ2 — Onde a seção vive na Hoje? (IMPORTANT.)** Cartão de foco (mais descoberta, mais ruído na ação principal) ou seção própria no fim (mais calma, menos descoberta). *Assunção:* seção própria, perto do Progresso, onde a leitura reflexiva já acontece.
- **OQ3 — A evidência aparece também no Histórico de planos passados? (CAN DEFER.)** *Assunção:* não. Não existe tela de planos passados; quando existir, reabrir.
- **OQ4 — O achado OPTIONAL de D-93 (contador vitalício derrubando o board) deveria ser resolvido junto?** (CAN DEFER — é SPEC-005/009, fora daqui.) *Assunção:* não; §16 desta SPEC apenas não repete o padrão.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-01 | v0.2 — **OQ1 resolvida (A) e implementada.** A evidência vem do snapshot que gerou o plano ativo, e a seção **se cala** quando não puder ser reproduzida — snapshot ausente, leitura falha, ou versão de engine diferente da atual. **Defeito achado na validação visual a 390px:** eu derivava de `assess`, mas a evidência que ela leu no preview é a de `buildPlan` — avaliação **mais** cronograma. A Hoje mostrava uma linha onde o preview mostrou duas: o mesmo plano com duas explicações. Corrigido, com teste de regressão e a segunda versão de engine conferida. | agente (§0.2) |
| 2026-08-31 | v0.1 — Draft criado para a capability F21 (COMMITTED em D-92). A armadilha de §2.1 foi **medida antes de desenhar**: `CareBoard` não expõe `hairProfileId`, e reavaliar-e-cancelar dessincroniza perfil corrente e plano ativo, então recomputar do perfil atual explicaria um plano que ela não tem. OQ1 é BLOCKING porque decide se a SPEC toca `packages/core` (opção A) ou o schema (opção B). | agente (§0.3) |
