# SPEC-025 — Check-in de couro cabeludo

| Campo | Valor |
|---|---|
| ID | SPEC-025 |
| Status | **Implemented** — `F31` fechado, validado no DEV real a 390px |
| Owner | (humano) — projetopaporeto.erp@gmail.com |
| Bounded Context | **Care Tracking** (DOMAIN-MAP §3.5) — é uma percepção ancorada numa execução, e vive com ela |
| Related ADRs | ADR-001, ADR-006, ADR-008 |
| Related SPECs | SPEC-006 (a percepção que já existe), SPEC-024 (o hub onde esta mora), SPEC-002 (o vocabulário que já foi aceito), SPEC-005 (a execução) |
| Fase | MASTER PRODUCT BACKLOG — **F31** |
| Criado | 2026-09-01 |

## 1. Context

O app pergunta **como ficou o cabelo** depois de um cuidado (SPEC-006, um toque, 1 a 5). Não pergunta nada sobre o **couro cabeludo** — e o couro cabeludo é metade da queixa de quem tem cabelo oleoso na raiz e seco na ponta, que é a combinação mais comum do público-alvo.

O perfil já guarda uma **tendência** declarada por ela (`hair_profiles.scalp_tendency`: oleoso rápido · equilibrado · tendência a ressecar · não sei). É uma foto tirada uma vez, no onboarding, e que só muda numa reavaliação. Esta SPEC transforma isso numa observação que acompanha o tempo.

O `F31` é o **último item Free do MASTER PRODUCT BACKLOG que não depende de gate externo**: `F24` e `F30` esperam sign-off de domínio, `F28` espera infraestrutura de mídia e base legal, `F32`/`F33` esperam curadoria, direito de imagem e custo.

## 2. Problem

Ela sente o couro mudar entre um cuidado e outro — e o app não tem onde ela dizer isso. Sem esse dado, `P2` Hair Intelligence não consegue olhar para a metade da cabeça de onde vem boa parte da insatisfação, e o `P5` não consegue relacionar *o que ela fez* com *como a raiz reagiu*.

## 3. Goals

- G1 — Ela registra **como o couro cabeludo esteve**, em um toque, junto do cuidado.
- G2 — O registro fica ligado à **execução**, ao dia e ao histórico dela.
- G3 — O vocabulário é **comparável e agregável**, como todo o resto da base.
- G4 — **Não custa nada ao loop diário.** O check-in de um toque continua sendo de um toque.

## 4. Non-Goals

- **NG1 — Não é sintoma clínico.** Coceira, descamação, dor, ferida, inflamação e queda **não** entram no vocabulário. Nomear sintoma é fazer o app coletar dado de saúde (base legal LGPD inexistente, D-32) e falar a língua do diagnóstico dermatológico (§2 da constituição, D-26). Ver OQ2.
- **NG2 — Não interpreta.** Ler a série, achar padrão e relacionar com produto e técnica é `P2`/`P5`/`P8` — Premium, e exige volume.
- **NG3 — Não aconselha.** Nenhuma frase diz o que fazer com o que ela respondeu.
- **NG4 — Não pontua.** Sem nota, escala boa/ruim, percentual, comparação ou elogio. Diferente do check-in de fios (1 a 5), aqui **não existe resposta melhor**: um couro oleoso não é uma nota baixa.
- **NG5 — Não altera o cronograma.** Nem automaticamente, nem por sugestão.
- **NG6 — Não repete a reavaliação.** `scalp_tendency` continua sendo do perfil; isto é a observação do dia.
- **NG7 — Nenhuma dependência nova.**

## 5. User Stories

- Como usuária de raiz oleosa e pontas secas, quero dizer como a raiz ficou, e não só o cabelo em geral.
- Como usuária que mudou de shampoo, quero que fique registrado como o couro esteve naquelas semanas.
- Como usuária apressada, quero que responder isso seja opcional e não me atrase.

## 6. Functional Requirements

- FR1 — Depois de concluir um cuidado, o app **oferece** dizer como o couro esteve. Oferece, não exige.
- FR2 — Ela escolhe **um** valor de uma lista fechada, ou nenhum.
- FR3 — Ela pode **trocar** a resposta e pode **tirar** a resposta.
- FR4 — Uma resposta por execução.
- FR5 — Responder depois é possível: sair e voltar não perde nem exige nada.
- FR6 — A resposta aparece junto do cuidado no histórico, **como fato**, sem interpretação.
- FR7 — **O check-in de fios continua sendo um toque** (SPEC-006). Esta pergunta não entra no caminho dele.
- FR8 — Tudo compõe dos tokens e primitivas de `apps/mobile/src/design/`.

## 7. Business Rules

- BR1 — A UI não decide nada (ADR-001).
- BR2 — **Vocabulário fechado**, e ele é `SCALP_TENDENCIES` sem `unknown` — *oleoso rápido · equilibrado · tendência a ressecar* —, que é exatamente o conjunto que a SPEC-002 já usa e que já passou pelo gate de domínio. Reaproveitar o vocabulário aceito, em vez de inventar um novo, é o que mantém esta capability fora do D-26 (mesmo raciocínio do D-96 para o `F23`).
- BR3 — Nenhum valor é melhor que outro. Não há ordem, não há escala.
- BR4 — Ancorada na **execução efetiva**: uma execução anulada (D-12) leva a resposta junto para o passado, como o check-in e o Wash Day já fazem.
- BR5 — Nada aqui é diagnóstico: é o que ela observou.

## 8. Data Model Impact

**Mora no hub do Wash Day (`wash_days`), não em `checkins` — e a restrição que decide isso é dura.**

`checkins` é **append-only**, sem `UPDATE` e sem grant de escrita para o cliente: a única porta é a RPC `submit_checkin`. Uma coluna `scalp_feel` ali só poderia ser preenchida **no mesmo instante** do check-in, o que deixa duas saídas, ambas ruins: ou a pergunta entra no caminho do check-in e o transforma de um toque em dois — regressão no coração do produto (FR7) —, ou ela fica sem resposta para sempre, porque append-only impede completar depois (FR5). Afrouxar o append-only para acomodar uma pergunta opcional seria trocar um invariante por uma tela.

O hub do Wash Day já resolve os dois: existe por execução, é opcional, é editável e foi **desenhado para isto** — a SPEC-024 §8 registra "couro cabeludo (`F31`) → colunas de escolha fechada no hub ou junção própria". Nada de tabela nova, nada de RPC nova, nada tocado no loop diário.

**A forma é uma junção `wash_day_scalp` com PK `(wash_day_id)`** (OQ1 resolvida, e a razão é de segurança — §11).

> ⚠️ O cabeçalho da migration da SPEC-024 chama o hub de *"o que ela realmente fez"*. Esta SPEC pendura nele uma **observação**, não um gesto — o comentário do hub precisa passar a dizer isso, senão a próxima pessoa lê que o hub só guarda ação e a próxima coisa a pendurar (`F28`, `P21`) vai parecer fora do lugar.

Detalhe de `docs/architecture/DATA-MODEL.md` §3.2d na fatia de implementação.

## 9. API / Contracts

Extensão do `WashDayPort` (SPEC-024): `getFor` passa a devolver a resposta de couro cabeludo, e uma escrita nova a define ou a remove. **Sem RPC**, pela mesma razão da SPEC-024: não há dia civil a decidir nem idempotência a guardar, e a posse é RLS mais `with check` mais a FK composta para o hub.

Vocabulário exportado por `packages/core`, espelhando o `CHECK` do banco — as duas listas são o preço de validar nos dois lados da fronteira (P07), e a de lá é a que importa.

## 10. Authorization

`SELECT`, `INSERT`, `UPDATE` e `DELETE` da própria linha na junção — `UPDATE` porque trocar de resposta é **uma** escrita atômica (`on conflict do update`), e um delete+insert deixaria uma janela sem resposta se a segunda metade falhasse. Os quatro na allowlist. Posse pelo banco: `with check (user_id = auth.uid())` valida o dono da linha, e a FK composta valida o dono do **hub** — sem ela, um cliente adulterado penduraria a própria resposta no Wash Day de outra pessoa (o BLOCKER da SPEC-024).

## 11. Security Considerations

RLS `enable`+`force`; grants na allowlist; **nenhum `SECURITY DEFINER` novo**. Cliente adulterado não lê nem escreve resposta de outra pessoa. Vocabulário fechado ⇒ **sem PII acidental** e sem texto livre.

**O que decidiu a OQ1: um grant de coluna seria invisível para o guardrail.** `tests.unapproved_grants()` lê `pg_class.relacl`; um `grant update (scalp_feel)` vive em `pg_attribute.attacl`, e **nenhum guardrail do projeto inspeciona `attacl`** (medido, não suposto). O privilégio existiria e a allowlist nunca saberia — pior do que reprovar, porque passa calado. A alternativa de dar `UPDATE` na tabela `wash_days` inteira é pior ainda: deixaria o cliente reapontar `care_execution_id` e mover o registro de um cuidado para outro. A junção não tem nenhum dos dois problemas.

## 12. Privacy Considerations

**É a seção mais importante desta SPEC.** O vocabulário aceito descreve **cosmética capilar** (oleoso, equilibrado, seco), não condição de saúde — é o mesmo dado que `hair_profiles.scalp_tendency` guarda desde a SPEC-002. Acrescentar coceira, descamação, dor, ferida ou queda mudaria a **natureza** do dado para saúde, o que exige base legal e a tabela `consents` que **não existe** (D-32, DEFER → SPEC-013). Enquanto ela não existir, esse vocabulário não entra (NG1/OQ2).

## 13. Analytics Events

**Nenhum** (D-31).

## 14. UX Notes (sem design visual)

- Vive na tela do Wash Day (SPEC-024), que é onde o registro daquele cuidado já mora — e **fora** do caminho do check-in de fios.
- Escolha única: tocar em outra opção troca; tocar na marcada tira.
- Nenhuma opção é apresentada como melhor. Sem ícone de positivo/negativo, sem cor de sucesso ou de perigo.
- Nenhum campo obrigatório, nenhuma barra de progresso, nenhuma cobrança por não responder.

## 15. Edge Cases

- EC1 — Ela nunca responde: é um estado válido, e o app não pergunta de novo nem insiste.
- EC2 — Ela responde e depois tira a resposta: válido, e a resposta some do registro.
- EC3 — Execução anulada depois da resposta: a resposta vai junto para o passado (BR4).
- EC4 — Dois toques rápidos na mesma opção: marca e desmarca; nunca duas linhas.
- EC5 — Toca em outra opção com a primeira ainda no ar: a última escolha dela é a que vale.
- EC6 — Sem rede: erro explícito, e o que ela já respondeu não some da tela.
- EC7 — Tela pequena e fonte grande: rola.

## 16. Failure Modes

Uma escrita própria e independente, como as marcações da SPEC-024: uma que falha não derruba as outras, a tela diz o que falhou e a escolha volta atrás sozinha. Sem "salvar no fim".

## 17. Acceptance Criteria

- AC1 — Ela responde em um toque, depois de concluir um cuidado.
- AC2 — Uma resposta por execução; trocar substitui, tirar remove.
- AC3 — Sair e voltar preserva a resposta.
- AC4 — **O check-in de fios continua sendo um toque** — verificado por teste.
- AC5 — Execução anulada leva a resposta junto.
- AC6 — Um cliente adulterado não lê nem escreve resposta de outra usuária (pgTAP).
- AC7 — **O vocabulário não nomeia sintoma** — barreira de teste sobre os valores reais.
- AC8 — **Nenhuma frase pontua, ordena, aconselha ou compara** — barreira de teste.
- AC9 — `pnpm verify` verde, pgTAP verde no CI, **validação visual a 390px no DEV real**.

## 18. Testing Strategy

pgTAP para posse, isolamento, unicidade por execução e cascata da anulação · Vitest para o vocabulário e a barreira de sintoma · RNTL para responder, trocar, tirar, sair e voltar, falha de escrita, e as barreiras de AC4/AC7/AC8.

## 19. Dependencies

**Nenhuma nova.** Depende do `F25` (SPEC-024), que já existe e está validado no DEV real.

## 20. Implementation Plan

1. ✅ Banco: `wash_day_scalp`, allowlist, pgTAP (#90).
2. ✅ Core: vocabulário e extensão do `WashDayPort` (#91).
3. ✅ App: a pergunta na tela do Wash Day (#91).
4. ✅ Validação a 390px no DEV real e fechamento do `F31`.

## 21. Migration Plan

Aditiva. Nenhum backfill: quem não respondeu não tem resposta, e isso é um estado válido.

## 22. Rollback Plan

Sem dado de produção antes do release. Rollback é remover o que a OQ1 criar.

## 23. Open Questions

- **OQ1 — RESOLVIDA: junção `wash_day_scalp`, e quem decidiu foi o guardrail.** A coluna `scalp_feel` no hub era a forma mais natural — escolha única modelada como escolha única — e exigiria `grant update (scalp_feel)`. Medido: `tests.unapproved_grants()` lê `pg_class.relacl`, um grant de coluna vive em `pg_attribute.attacl`, e **nenhum guardrail do projeto olha para `attacl`**. O privilégio existiria fora do alcance da allowlist — e um privilégio que o guardrail não enxerga é pior que um que ele reprova. Dar `UPDATE` na tabela inteira resolveria a visibilidade e criaria coisa pior: o cliente poderia reapontar `care_execution_id` e mover o registro de um cuidado para outro. A junção com `on conflict do update` mantém a troca atômica, mantém todo privilégio visível e repete o padrão das outras duas junções. *Gatilho para reabrir:* um guardrail que passe a cobrir `attacl`, ou a necessidade de mais de uma resposta por Wash Day.
- **OQ2 — CAN DEFER — vocabulário de sintoma (coceira, descamação).** É o que mais se pede num check-in de couro cabeludo, e é exatamente o que muda a natureza do dado para **saúde**. *Assunção:* fora, e continua fora até existirem **duas** coisas: base legal LGPD com a tabela `consents` (D-32 → SPEC-013) **e** sign-off de revisor de domínio (D-26). Não é uma omissão — é um gate com duas chaves, e nenhuma delas é do agente.
- **OQ3 — CAN DEFER — responder sem cuidado nenhum.** O couro muda em dias em que ela não fez cuidado. Hoje toda resposta pende de uma execução, e execução avulsa não existe (mesma limitação da SPEC-024 OQ4 e da SPEC-020 OQ3). *Assunção:* fora; entra quando execução ad hoc existir.
- **OQ4 — CAN DEFER — a série ao longo do tempo.** Ver a sequência das respostas é leitura, e leitura é `P2`. *Assunção:* fora (D-47/D-48).

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-02 | v0.2 — **implementada e validada no DEV real; `F31` DONE.** Marcar → trocar (troca, não soma) → reload → persistido, a 390px. **Dois achados ao escrever os testes:** o duplo do adapter devolvia o mesmo resultado para o `upsert` do hub e o do couro, então o teste de falha passava pelo motivo errado; e a barreira de sintoma da tela casava com "Condicionador" e "Finalizador" (`dor` no fim da palavra) — uma barreira que acusa o vocabulário certo é tão inútil quanto uma que nunca acusa nada. **Um achado no pgTAP:** a FK composta estava sendo testada com a PK já ocupada, então o ataque falhava por `23505` e não por `23503` — as duas camadas agora são exercitadas separadamente. **Um achado ao ver a tela:** o título "O que você usou?" descrevia uma de três seções; virou "Seu registro". | agente (§0.2) |
| 2026-09-01 | v0.1 — Draft criada para o **F31**, o último Free sem gate externo. **A decisão estrutural já está tomada e é a §8:** a resposta mora no hub do Wash Day e não em `checkins`, porque `checkins` é append-only e a alternativa seria transformar o check-in de um toque em dois — regressão no coração do produto. **A OQ1 já nasce resolvida por medição:** junção, e não coluna no hub, porque um `grant update (coluna)` vive em `pg_attribute.attacl` e **nenhum guardrail do projeto olha para lá** — o privilégio existiria calado, fora do alcance da allowlist. **A decisão de conteúdo é a §12/NG1:** o vocabulário é o `SCALP_TENDENCIES` que a SPEC-002 já usa e que já passou pelo gate; coceira e descamação mudariam a natureza do dado para saúde e ficam atrás de duas chaves que não são do agente (D-32 e D-26). | agente (§0.4/D-97) |
