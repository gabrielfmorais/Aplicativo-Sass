# SPEC-047 — Hair Intelligence determinística (P2, primeira fatia)

| Campo | Valor |
|---|---|
| ID | SPEC-047 |
| Status | Implemented |
| Owner | dono do produto |
| Bounded Context | **Insights** (`packages/core/src/insights`) — Premium |
| Related ADRs | **D-26/D-70** (nada afirma sobre cabelo), **D-83** (premium é adição), D-31 (analytics), §0.4 §3.1 (IA por último) |
| Related SPECs | SPEC-024 (o que ela usou), SPEC-006 (como ficou), SPEC-023 (a prateleira), SPEC-009 (`MIN_CHECKINS_FOR_AVERAGE`, a mesma disciplina) |
| Capability | `P2` — **COMMITTED**, primeira fatia |
| Criado / Atualizado | 2026-09-04 / 2026-09-05 (fatia 3: finalização, §14) |

## 1. Context

> A pergunta que ela precisa responder: **"O que funciona comigo?"** — Blueprint §12

O produto acumula meses de registro real dela — cuidados atendidos, produtos marcados, check-ins — e
**sem interpretação isso é só um arquivo**. Esta é a capability central do Premium, e o critério
mestre do dono: a Huna precisa cumprir cada vez melhor a promessa de *descobrir o que funciona para
o cabelo de cada usuária*.

**Determinística primeiro, sem IA** (§0.4): nenhuma etapa aqui precisa de modelo, e é esta camada
que a IA vai **consultar** um dia.

## 2. Goals

- **G1** Ela vê **repetições reais** nos próprios registros.
- **G2** Toda afirmação é **rastreável** ao que ela registrou.
- **G3** Sem volume, a Huna **diz que ainda está conhecendo a rotina dela**.

## 3. Non-Goals

- **NG1** ⛔ **Nenhuma causalidade.** *"Esteve em 4 dos 5"* é contagem; *"melhorou seu cabelo"* é
  alegação capilar (D-26/D-70).
- **NG2** ⛔ **Nenhum insight inventado para preencher tela.** Tela honestamente vazia > tela cheia
  de nada.
- **NG3** ⛔ Nenhuma comparação com outras usuárias. Nada sai, nada vira benchmark.
- **NG4** ⛔ Nenhuma nota, porcentagem ou diagnóstico.
- **NG5** ⛔ Nenhuma IA, nenhum embedding, nenhuma tabela de chat.
- **NG6** ⛔ Nenhuma migration, nenhuma escrita: é **leitura pura** do que já existe.

## 4. Functional Requirements

- **FR1** `buildInsights` é puro e recebe **fatos dela**: cuidado atendido, avaliação e produtos.
- **FR2** Abaixo de `MIN_RATED_CARES` (**5**), `enoughData: false` e **zero observação**.
- **FR3** Um produto só é nomeado a partir de `MIN_OCCURRENCES` (**3**) aparições.
- **FR4** "Bem avaliado" é `feel >= HIGH_FEEL` (**4**) — a escala do check-in é 1..5.
- **FR5** Tela própria, Premium por `advanced_insights`.
- **FR6** O texto do estado de poucos dados é **"A Huna ainda está conhecendo sua rotina"**.

## 5. Business Rules

- **BR1** ⚠️ **O denominador é o que ela AVALIOU, não o que ela fez.** Cuidado sem check-in não diz
  nada sobre resultado; contá-lo faria a Huna parecer ter mais evidência do que tem.
- **BR2** **Conta por cuidado, não por marcação.** O mesmo produto duas vezes no mesmo registro é um
  cuidado — contar marcações inflaria a repetição sem nenhum fato novo.
- **BR3** ⚠️ **"que você avaliou bem", nunca "os mais bem avaliados".** O conjunto é *todo* cuidado
  com nota ≥ 4, não um top-N: com vinte, a outra frase viraria *"os seus 20 mais bem avaliados"* e
  sugeriria um ranking que não existe.
- **BR4** **Execução anulada fica de fora.** Ela desfez aquilo.
- **BR5** Empate desempata pelo nome — a ordem não pode depender do banco.
- **BR6** Os limiares são **guardas de exibição, não afirmação estatística**, e estão documentados
  como arbitrários — a mesma disciplina do `MIN_CHECKINS_FOR_AVERAGE` (SPEC-009).

## 6. Segurança e privacidade

- Todas as leituras são sob **RLS**, com a JWT dela. Os `in (…)` filtram por ids vindos das próprias
  linhas dela; um id de terceiro não passaria pela RLS de qualquer modo.
- **Nenhuma escrita.** Nenhuma rede externa. Nada agrega com terceiros.
- ⚠️ **O gate premium é de APRESENTAÇÃO, não de dado — e isso precisa estar dito.** `advanced_insights`
  vem do servidor (`get_my_entitlements()`), e a tela nunca decide sozinha que ela é premium. Mas os
  dados de origem são **dela** e o Free já tem `SELECT` neles: um cliente adulterado consegue
  computar as mesmas observações **sobre o próprio histórico**. Nada de outra usuária vaza, e nenhum
  conteúdo de servidor é exposto — o que o premium vende aqui é **a leitura**, e ela roda no
  aparelho. Mover a computação para uma RPC tornaria o gate de dado; ficou **fora desta fatia** por
  YAGNI e está registrado em OQ2, porque um gate que parece server-side sem ser é pior que um gate
  honesto.

## 7. Data Model Impact

**Nenhum.** Sem tabela, sem coluna, sem migration.

## 8. Edge Cases

- **EC1** Zero registro avaliado: diz o que falta, não gira.
- **EC2** Cuidados sem check-in: não entram no denominador.
- **EC3** Produto arquivado continua no histórico — foi para isso que `products` nasceu sem `DELETE`.
- **EC4** Leitura falha: mensagem honesta e nova tentativa.
- **EC5** ⚠️ **Histórico grande.** As leituras filtram por `in (…ids)` e cada uuid custa ~37
  caracteres: sem teto, ~300 execuções montariam uma URL de 11 mil caracteres e bateriam no limite de
  URI — a tela quebraria **para quem mais tem dado**. A janela é de **60 cuidados atendidos**, do
  mais recente para trás, e é honesta na tela: o número exibido é o que foi realmente lido.

## 9. Acceptance Criteria

- **AC1** No DEV real a 390px, com Premium: estado de poucos dados **e** estado de observação.
- **AC2** Nenhuma frase causal — barreira de teste no core **e** na tela.
- **AC3** Premium é **adição**, não muro — barreira de teste.
- **AC4** Nenhum número sem rastreabilidade.

## 10. Open Questions

- **OQ1 (parcialmente fechada)** ✅ **Técnica entrou** (fatia 2), com o vocabulário **já aprovado**
  da SPEC-024 e o rótulo vindo do app por um resolvedor — o core não guarda cópia de interface.
  ✅ **Finalização (`F38`) entrou depois**, quando o dono forneceu o vocabulário — ver §13 e **§14**.
  Faltam **couro** e **dia da semana**.
- **OQ2 (CAN DEFER)** Mover a derivação para o servidor, tornando o gate premium um gate de **dado**
  (ver §6).
- **OQ3 (CAN DEFER)** O nome do Blueprint para a superfície é *"O que funciona comigo?"* (`P3`).
  Ficou como **"Seus padrões"** porque, hoje, a primeira frase prometeria **causa** e a camada
  entrega **repetição** — um título que afirma mais do que os dados sustentam é a forma mais difícil
  de perceber de inventar insight.

## 11. Change Log

| Data | Mudança |
|---|---|
| 2026-09-04 | SPEC criada e implementada. Repetição de produto nos cuidados que ela avaliou bem, com estado honesto de poucos dados. |
| 2026-09-05 | **§14 — a dimensão de finalização** (SPEC-048). Terceiro verbo (*"você finalizou assim em"*), `other`/`unknown` fora da observação (OQ3 da SPEC-048, resolvida), a finalização contando como registro, e as três leituras do hub em paralelo. |

## 12. Evidência

✅ **Validado a 390px no DEV real, com Premium concedido** (`advanced_insights` ativo):

- **Poucos dados (4 avaliados):** *"A Huna ainda está conhecendo sua rotina · Você já avaliou 4
  cuidados. A partir de 5, a Huna começa a comparar o que se repete."*
- **Observação (5 avaliados):** *"Máscara da feira — esteve em 4 dos 5 cuidados que você avaliou
  bem"*, com *"Com base em 5 cuidados que você avaliou"*.

Os dados foram criados pelos **mesmos caminhos de servidor que o app usa** (`complete_care`,
`submit_checkin`, escrita do Wash Day sob RLS) — e a tentativa de usar `resolution=merge-duplicates`
foi **recusada com `42501`**, confirmando que o cliente não tem `UPDATE` nessas tabelas.

**Dois achados da auditoria, os dois corrigidos:**

1. **Escala.** `in (…ids)` sem teto quebraria para quem tem histórico longo — janela de 60.
2. **Precisão da frase.** *"os seus N mais bem avaliados"* sugeria um ranking inexistente; virou
   *"dos N cuidados que você avaliou bem"* (BR3).

E um **nomeado, não corrigido**: o gate premium é de apresentação, não de dado (§6, OQ2).

### 12.3 Fatia 2 — a dimensão de técnica (mesmo dia)

✅ **390px no DEV real, as duas dimensões juntas:**

- *"Máscara da feira — **esteve em** 4 dos 5 cuidados que você avaliou bem"*
- *"Secou naturalmente — **você fez em** 3 dos 5 cuidados que você avaliou bem"*

**O verbo muda com o tipo** (`esteve em` para produto, `você fez em` para técnica) e nenhum dos
dois afirma efeito. Os dados foram marcados pelo caminho de cliente que a SPEC-024 já autoriza.

## 13. ⛔ Por que a finalização do `F38` NÃO entrou *nesta* fatia

> ✅ **Resolvido depois.** O dono forneceu o vocabulário em 2026-09-04 e a fatia de **registro** foi
> construída na **SPEC-048**. O texto abaixo fica como está porque explica **por que engenharia não
> podia resolver isso sozinha** — a decisão que faltava era humana, e foi ela que chegou.


O pedido era registrar **qual finalização** ela fez. Isso exige um **vocabulário de técnicas de
finalização** — e ele é conteúdo capilar substantivo, atrás do gate **D-26/D-70**. Não é
interpretação minha: está escrito na barreira que a própria SPEC-039 §8 deixou no repositório.

> *"Se você chegou aqui acrescentando uma FINALIZAÇÃO (fitagem, dedoliss, day after, técnica por
> curvatura): ela não mora nesta lista. […] o vocabulário de técnicas de finalização é o `F38` —
> conteúdo capilar substantivo, atrás do gate D-26/D-70."*

**Inventar essa lista é exatamente o que a D-26 proíbe engenharia de fazer.** As três saídas
possíveis, e por que só uma serve:

| saída | por quê não / sim |
|---|---|
| inventar a lista | ⛔ é engenharia criando vocabulário de domínio (D-26) |
| campo de texto livre | ⛔ recusado na SPEC-024: texto livre não se compara nem se agrega, e destruiria `P5`/`P6`/`P7`/`P8` |
| **reusar o vocabulário aprovado** | ✅ **feito nesta fatia** — e **seis das catorze técnicas da SPEC-024 são movimentos de finalização** (`air_dried`, `blow_dried`, `diffuser`, `scrunched`, `heat_protectant`, `protective_style`), então parte do que o `F38` promete já é observável **sem cruzar gate nenhum** |

**O que falta é uma decisão humana**, não código: a lista de finalizações (fitagem, dedoliss, day
after, técnica por curvatura, …) precisa vir do dono ou de um revisor de domínio. Com a lista na
mão, o resto é pequeno — coluna `finish_technique` em `wash_day_finish`, `CHECK`, porta, chip na
tela, e a quarta trava mantendo os vocabulários disjuntos.

## 14. A dimensão de finalização (SPEC-048, fatia de integração)

Com o vocabulário do `F38` na mão (SPEC-048), a finalização vira a **terceira dimensão** observável,
ao lado de produto e técnica. **Zero migration** — é leitura de `wash_day_finish.finish_technique`,
que a fatia de registro já grava.

**O verbo muda de novo, e é o verbo que carrega a garantia:**

| dimensão | frase |
|---|---|
| produto | *Máscara da feira — **esteve em** 4 dos 5 cuidados que você avaliou bem* |
| técnica | *Secou naturalmente — **você fez em** 3 dos 5 …* |
| **finalização** | *Plopping — **você finalizou assim em** 3 dos 5 …* |

Nenhuma das três afirma efeito. ⚠️ **A finalização é a dimensão mais perto de virar conselho** —
*"a melhor finalização para o seu cabelo"* é literalmente o que o `F38` promete **depois** do
sign-off —, então a barreira de linguagem tem um teste só para ela, no core **e** na tela.

### ⛔ `other` e `unknown` NUNCA viram observação (SPEC-048 OQ3, resolvida)

Os dois motivos são diferentes, e os dois são sobre **não inventar insight**:

- **`other`** é *"fiz uma finalização fora desta lista"*. Três cuidados marcados com `other` podem
  ser **três técnicas diferentes** — dizer *"Outra finalização — você finalizou assim em 3 dos 5"*
  afirmaria uma repetição que talvez não exista.
- **`unknown`** é *"fiz, e não sei o nome"*: **ausência de identificação**, não uma identificação
  que se repete. A mesma distinção entre ausência e resposta que o `F35` teve de fazer.

As duas continuam sendo respostas legítimas, continuam gravadas e **continuam contando como
registro** — o que elas não fazem é virar padrão. ⚠️ **O denominador não encolhe por causa delas:**
os cuidados com `other`/`unknown` seguem no *"dos 5"*, porque aconteceram, e tirá-los inflaria a
repetição das outras. Barreira de teste em `FINISH_TECHNIQUES_NOT_OBSERVABLE`, verificada nos dois
sentidos (removida a regra, o teste falha).

### Outros dois ajustes que vieram junto

- **Dizer *qual* finalização já é registro.** `ratedCaresWithRecord` passou a contar a finalização;
  sem isso, a tela mandaria *"marque o que usou"* para quem marcou a finalização e nada mais.
- **As três leituras do hub foram para um `Promise.all`.** A leitura nova somaria um sexto round
  trip em série na tela Premium que já é a mais cara do app; técnicas, finalização e produtos são
  independentes entre si.

✅ **Validada a 390px no DEV real**, com histórico semeado e depois **desfeito**: com 5 cuidados bem
avaliados (3 `plopping`, 1 `dedoliss`, 1 `other`), a tela mostrou *"Plopping — você finalizou
assim em 3 dos 5 cuidados que você avaliou bem"*, **sem** *"Outra finalização"* e **sem** `Dedoliss`
(1 ocorrência, abaixo do mínimo). Zero problema de console.
