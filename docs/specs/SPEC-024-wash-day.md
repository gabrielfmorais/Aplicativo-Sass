# SPEC-024 — Wash Day: o que ela realmente fez

| Campo | Valor |
|---|---|
| ID | SPEC-024 |
| Status | **Implemented** — `F25` e `F27` fechados, validados no DEV real a 390px |
| Owner | (humano) — projetopaporeto.erp@gmail.com |
| Bounded Context | **Care Tracking** (DOMAIN-MAP §3.5) — o registro é sobre a execução, e vive com ela |
| Related ADRs | ADR-001, ADR-006, ADR-008 |
| Related SPECs | SPEC-005 (a execução a que se refere), SPEC-006 (a avaliação, que já existe), SPEC-023 (os produtos), SPEC-020 (o precedente de vocabulário fechado) |
| Fase | MASTER PRODUCT BACKLOG — **F25** |
| Criado | 2026-09-01 |

## 1. Context

> **"Wash Day é estrutural. Não é uma tela de anotação, e tratá-la como tal inviabiliza metade do Premium."** — Blueprint §9

O produto sabe o que estava **planejado** e se ela **fez**. Não sabe **o que ela fez de fato**: quais produtos, com que técnica, e com que resultado. Sem isso, *"o que funciona comigo?"* é uma pergunta sem dados — e é a pergunta central do Premium.

Esta SPEC existe depois da SPEC-023 por escolha de sequência: o Wash Day **consome** os produtos, e o hub desenhado sem o seu principal consumidor nasceria errado.

## 2. Problem

Hoje, quando ela conclui um cuidado, o app registra **que** aconteceu e **como ela avaliou** (SPEC-005/SPEC-006). Some tudo o que está no meio: o que ela pôs no cabelo, o que ela fez com ele. É exatamente o meio que `P5`, `P6`, `P8` e a Hair Intelligence precisam ler depois.

## 3. Goals

- G1 — Ela registra **o que usou** e **como fez**, em segundos, logo depois do cuidado.
- G2 — O registro fica ligado à **execução**, ao dia e ao histórico dela.
- G3 — O modelo é **comparável e agregável** — é o que decide se o Premium existe.
- G4 — Registrar é **opcional e rápido**. Um Wash Day não preenchido não vale nada; um formulário longo não é preenchido.

## 4. Non-Goals

- **NG1 — Não é diário de texto livre.** Texto livre não se compara nem se agrega, e destruiria `P5`, `P6`, `P7` e `P8`. É a decisão mais importante desta SPEC.
- **NG2 — Não interpreta.** Comparar Wash Days, achar padrões e mostrar o que se repete nos melhores é `P5`/`P6`/`P8` — Premium, e exige volume mínimo.
- **NG3 — Nunca afirma causalidade** entre produto e resultado. Nem no Free, nem no Premium.
- **NG4 — Não exige nada.** Nenhum campo obrigatório além do vínculo com a execução.
- **NG5 — Não repete a avaliação.** *Como ficou* já é o check-in (SPEC-006), ancorado na mesma execução. Duplicar seria pedir duas vezes a mesma coisa e criar duas verdades.
- **NG6 — Sem foto** (`F28`) e **sem contexto/clima** (`P21`) nesta fatia — mas o modelo prevê o encaixe.
- **NG7 — Sem couro cabeludo** (`F31`) nesta fatia, pelo mesmo motivo.
- **NG8 — Nenhuma dependência nova.**

## 5. User Stories

- Como usuária que acabou de fazer a hidratação, quero dizer o que usei antes de esquecer.
- Como usuária com doze produtos, quero marcar dois toques em vez de escrever um parágrafo.
- Como usuária depois de alguns meses, quero que meus registros respondam "o que funciona comigo?" — e isso começa aqui.

## 6. Functional Requirements

- FR1 — Depois de concluir um cuidado, o app oferece registrar o Wash Day — **oferece**, não exige.
- FR2 — Ela marca **quais produtos** da prateleira usou (nenhum, um ou vários).
- FR3 — Ela marca **quais técnicas** usou, de uma lista fechada.
- FR4 — O registro é **um por execução**. Voltar ao mesmo cuidado edita o registro, não cria o segundo.
- FR5 — Ela pode registrar em partes: marcar produtos hoje e técnicas depois, sem perder o que marcou.
- FR6 — De dentro do Wash Day ela **adiciona um produto novo** à prateleira — é quando o cadastro custa menos (Blueprint §10).
- FR7 — O registro aparece junto do cuidado no histórico, como fato, sem interpretação.
- FR8 — Tudo compõe dos tokens e primitivas de `apps/mobile/src/design/`.

## 7. Business Rules

- BR1 — A UI não decide nada (ADR-001).
- BR2 — **Vocabulário controlado em tudo.** Produtos vêm da prateleira dela; técnicas vêm de enum fechado. Nenhum campo de texto.
- BR3 — Um produto **arquivado** continua aparecendo nos registros antigos: o uso aconteceu (SPEC-023 BR4).
- BR4 — Nenhuma frase liga produto a resultado. O Free registra; ler é Premium, e ler exige volume.
- BR5 — O registro é ancorado na **execução efetiva**, não no cuidado planejado nem no dia: uma execução anulada (D-12) leva o registro junto para o passado, como o check-in já faz (SPEC-006 BR3).
- BR6 — Nada aqui é diagnóstico: é o que ela fez.

## 8. Data Model Impact

**Três tabelas, e a forma é a decisão inteira desta SPEC.**

- `wash_days` — o hub: `id`, `user_id`, `care_execution_id` (único), `created_at`. Sem colunas de conteúdo: tudo o que descreve o dia pendura nele.
- `wash_day_products` — junção `(wash_day_id, product_id)`, PK composta.
- `wash_day_techniques` — junção `(wash_day_id, technique)`, com `CHECK` na lista fechada. **Junção, não `text[]`** (OQ1 resolvida): o array é mais barato hoje e mais caro exatamente onde a promessa do Premium está — `P8` consulta *técnica × produto × resultado*, e isso é `join`.

**Posse validada nas duas pontas.** Cada junção tem FK composta para o **hub** (`wash_day_id, user_id`) além da FK para o produto. Sem ela, `with check (user_id = auth.uid())` sozinho deixaria um cliente adulterado pendurar a **própria** linha no Wash Day de **outra pessoa**: a policy só olha o dono da linha nova, não a quem o hub pertence. Ninguém leria essa linha — nem a vítima — mas ela contaria quando `P8` agregasse por `wash_day_id`.

**Por que o hub não tem colunas de conteúdo.** Cada coisa que descreve o dia — produtos, técnicas, e depois couro cabeludo, foto e clima — chega numa fatia diferente. Um hub magro aceita cada uma sem alterar as anteriores; um hub gordo obriga a mexer nele toda vez.

**O encaixe do que ainda não existe:** `F28` foto → `wash_day_photos`; `F31` couro cabeludo → colunas de escolha fechada no hub ou junção própria; `P21` clima → `wash_day_context`. Nenhum deles muda `wash_days`.

## 9. API / Contracts

`WashDayPort` com `getFor(careExecutionId)`, `markProduct` e `markTechnique`. **Sem RPC** (OQ2 resolvida): a `unique (care_execution_id)` torna o upsert do cliente idempotente sozinha.

**Uma marcação por chamada, e não `setProducts(ids)` como esta seção dizia na v0.1.** §16 exige que uma escrita que falha não derrube as outras e que a tela diga **qual** falhou; um `set` em lote devolve um erro só e deixa a tela adivinhando o que entrou. A PK das junções absorve o toque repetido, então nada se perde na troca.

`getFor` devolve os produtos **com nome**, não ids: um produto arquivado depois do uso continua no registro (BR3/AC4), e a prateleira ativa não sabe mais dele. O hub é criado na **primeira marcação**, nunca em `getFor` — abrir e não marcar não é um registro.

## 10. Authorization

`SELECT`/`INSERT`/`UPDATE`/`DELETE` da própria linha para a junção (desmarcar um produto é remover a linha da junção — e ali `DELETE` **é** correto: ela está corrigindo o que marcou, não apagando histórico). Sem `DELETE` no hub. `user_id` validado por `with check`; integridade de posse por FK composta, como em `scheduled_cares`.

## 11. Security Considerations

Duas tabelas com RLS `enable`+`force`; grants na allowlist; **nenhum `SECURITY DEFINER` se OQ2 confirmar**. Cliente adulterado não marca produto de outra pessoa (FK composta com `user_id`) nem escreve em Wash Day alheio. Sem texto livre ⇒ **sem PII acidental**.

## 12. Privacy Considerations

Rotina pessoal é dado dela. Vocabulário fechado evita PII acidental — é a razão de privacidade da mesma decisão que a razão de produto (comparabilidade). Foto entra pelas regras de `F28`, não aqui.

## 13. Analytics Events

**Nenhum** (D-31).

## 14. UX Notes (sem design visual)

- Aparece **depois de concluir**, junto do check-in que já existe — ela já está ali.
- Marcar produtos é uma lista de chips da prateleira dela. Prateleira vazia: um convite para adicionar, não um beco.
- **Progressivo:** ela pode sair no meio e voltar. Sem "salvar" no fim — cada marcação é um fato.
- Nenhum campo obrigatório, nenhuma barra de progresso, nenhuma cobrança por registro incompleto.

## 15. Edge Cases

- EC1 — Prateleira vazia: oferece adicionar dali (FR6).
- EC2 — Execução anulada depois do registro: o registro vai junto para o passado (BR5).
- EC3 — Produto arquivado depois do registro: continua aparecendo no registro antigo (BR3).
- EC4 — Ela desmarca tudo: um Wash Day sem nada marcado é válido — ela abriu e não quis dizer.
- EC5 — Dois toques no mesmo produto: marca e desmarca; nunca duas linhas.
- EC6 — Sem rede: erro explícito, e o que já foi marcado não se perde da tela.
- EC7 — Tela pequena e fonte grande: rola.

## 16. Failure Modes

Cada marcação é uma escrita própria e independente: uma que falha não derruba as outras, e a tela diz qual falhou. Sem "salvar tudo no fim", não existe salvamento parcial silencioso.

## 17. Acceptance Criteria

- AC1 — Depois de concluir um cuidado, ela registra produtos e técnicas em segundos.
- AC2 — Um registro por execução; voltar edita.
- AC3 — Sair no meio e voltar preserva o que ela marcou.
- AC4 — Produto arquivado continua visível no registro antigo.
- AC5 — Execução anulada leva o registro junto.
- AC6 — Um cliente adulterado não lê nem escreve Wash Day de outra usuária (pgTAP).
- AC7 — **Nenhum campo de texto livre em lugar nenhum** — verificado por teste.
- AC8 — **Nenhuma frase liga produto a resultado, nem sugere, nem pontua** — barreira de teste.
- AC9 — `pnpm verify` verde, pgTAP verde no CI, **validação visual a 390px**.

## 18. Testing Strategy

pgTAP para posse, isolamento, unicidade por execução e cascata da anulação · Vitest para o vocabulário de técnicas · RNTL para marcar, desmarcar, sair e voltar, prateleira vazia, erro por marcação, e as barreiras de AC7/AC8.

## 19. Dependencies

**Nenhuma nova.** Depende de `F26` (SPEC-023), que já existe.

## 20. Implementation Plan

1. ✅ Banco: as três tabelas, allowlist, pgTAP (#88).
2. ✅ Core: vocabulário de técnicas e o port (#89).
3. ✅ App: o registro depois do cuidado concluído, com atalho para adicionar produto (#89).
4. ✅ Validação a 390px no DEV real e fechamento do `F25` **e do `F27`** — a junção produto ↔ execução é literalmente o `F27`, e separá-la teria criado um hub sem o consumidor que o justifica.

## 21. Migration Plan

Aditiva. **Aplicar no DEV é ação do dono.**

## 22. Rollback Plan

Reverter a PR e derrubar as duas tabelas. Nenhuma linha existente é alterada.

## 23. Open Questions

- **OQ1 — RESOLVIDA: junção.** O array é mais simples de escrever e ler; a junção agrega melhor e é o que `P8` vai consultar (*"técnica × produto × resultado"*). *Assunção:* **junção**, pela mesma razão que a SPEC existe — o modelo do Free é o que viabiliza o Premium, e um array é mais barato hoje e mais caro exatamente onde a promessa está.
- **OQ2 — RESOLVIDA: tabela direta.** O hub precisa ser criado sob demanda ("marque um produto e o Wash Day passa a existir"), o que é um upsert por `care_execution_id` — e um índice único o torna idempotente sem função. *Assunção:* tabela direta, como `products`. *Gatilho para reabrir:* qualquer invariante que o schema não consiga expressar.
- **OQ3 — RESOLVIDA na fatia de banco: catorze valores, cada um passado pelo critério.** `pre_wash_oil` · `scalp_massage` · `double_cleanse` · `co_wash` · `left_on_longer` · `cold_rinse` · `detangled_with_fingers` · `wide_tooth_comb` · `air_dried` · `blow_dried` · `heat_protectant` · `scrunched` · `diffuser` · `protective_style`. **Todos nomeiam gesto, nenhum nomeia efeito** — e o teste recusa `selar_as_cuticulas` explicitamente, para a linha ficar desenhada e não só descrita. Acrescentar um valor é mudança de produto. *Texto original:* Precisa ser fechada e neutra: nomes do que ela **faz**, nunca do que aquilo **provoca**. *"Umectação"* nomeia um procedimento; *"selar as cutículas"* é afirmação capilar e abriria o gate D-26. *Assunção:* uma lista curta e descritiva, revisada por esse critério antes de existir. **Se a lista escorregar para efeito, a capability sai do Free e entra no gate** — é a única parte desta SPEC com esse risco.
- **OQ4 — CAN DEFER — registro avulso**, fora de qualquer cuidado planejado. O Blueprint cita *"a vida real não pede licença ao cronograma"*, mas hoje `care_executions.scheduled_care_id` não é anulável (ver SPEC-020 OQ3). *Assunção:* fora desta fatia; entra quando execução ad hoc existir.
- **OQ5 — CAN DEFER — ordem dos produtos.** *"Em que ordem"* está no Blueprint. Ordem é um dado a mais na junção e não tem consumidor hoje. *Assunção:* fora (D-47/D-48).

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-01 | v0.3 — **fatia 2 (core + app) implementada; `F25` e `F27` DONE.** §9 corrigida para uma marcação por chamada (o `set` em lote contradizia §16). **BLOCKER da auditoria:** o registro esquecia o produto arquivado — `ProductPort.list()` devolve só os ativos, correto para a prateleira e errado para um registro do passado, e o vidro usado sumia dos chips enquanto a linha da junção seguia intacta no banco. Foi para guardar esse fato que `products` nasceu sem `DELETE` (SPEC-023 BR4). `WashDayRecord` passou a carregar os produtos com nome, lidos sem filtro de arquivado. **IMPORTANT:** marcar e desmarcar rápido podia inverter no banco, porque o PostgREST não promete ordem — uma fila por chip resolve. **Na tela a 390px:** "Você registrou o que usou" mentia no caso EC4 (abrir e desmarcar tudo), já que o board conhece a existência do registro e nunca o conteúdo — o rótulo do botão passou a ser o único portador do fato. | agente (§0.2) |
| 2026-09-01 | v0.2 — **fatia 1 (banco) implementada; OQ1, OQ2 e OQ3 resolvidas.** Junção para técnicas, sem RPC, e a lista de catorze valores montada sob o critério "gesto, nunca efeito". **Achado ao escrever o pgTAP:** `with check` valida o dono da **linha**, não o dono do **hub** — sem FK composta, um cliente adulterado penduraria a própria linha no Wash Day alheio, invisível para todos e contável por `P8`. Fechado nas duas junções. | agente (§0.2) |
| 2026-09-01 | v0.1 — Draft criada para o **F25**, depois da SPEC-023 porque o Wash Day consome os produtos. **Hub magro por decisão:** cada coisa que descreve o dia chega numa fatia diferente, e um hub sem colunas de conteúdo aceita cada uma sem mexer nas anteriores. A OQ3 é a única com risco de domínio — uma lista de técnicas que escorregue de *o que ela faz* para *o que aquilo provoca* tira a capability do Free e a joga no gate D-26. | agente (§0.4/D-97) |
