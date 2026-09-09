# SPEC-064 — "Seus padrões": quatro dimensões que a tela jogava fora

| Campo | Valor |
|---|---|
| ID | SPEC-064 |
| Status | Approved (frente escolhida pelo agente; o dono a nomeou candidata importante e mandou não esquecê-la) |
| Owner | dono do produto |
| Bounded Context | Insights (Premium) — **apresentação apenas** |
| Related ADRs | ADR-001, ADR-007 A1 / D-26 / D-70 |
| Related SPECs | SPEC-047 (a camada), SPEC-050 (padrões), SPEC-051 (o que ela notou), SPEC-062/063 (UI Intelligence aplicada) |
| Direção | `docs/design/UI-INTELLIGENCE.md` |
| Criado / Atualizado | 2026-09-09 / 2026-09-09 |

## 1. Por que esta, agora

O ciclo da North Star — **REGISTRAR → ENTENDER → IDENTIFICAR PADRÕES → COMPARAR → ADAPTAR →
RECOMENDAR** — está construído até *identificar padrões*; **comparar, adaptar e recomendar estão os
três atrás do D-26**. Ou seja: **"Seus padrões" é hoje o fim da cadeia**, e é a superfície onde a
promessa do produto aparece para ela.

É também a tela **Premium**. Se ela parece a mais barata do app, o que fica barato é a assinatura.

## 2. Problem — medido

O core entrega **quatro dimensões** (`product · technique · finish · noticed`), e a SPEC-047 trabalhou
para dar a cada uma o **verbo certo**: *"esteve em"*, *"você fez em"*, *"você finalizou assim em"*,
*"você notou em"*.

⚠️ **A tela renderiza as quatro com o mesmo cartão.** O `kind` é lido **uma vez**, só para separar
`noticed` do resto — e a distinção pela qual a SPEC-047 passou três fatias fica **invisível**: quem
olha vê uma lista de cartões brancos iguais e não sabe se está lendo um produto, um jeito de fazer ou
uma finalização.

Somado a isso: os textos explicativos (o estado vazio das combinações e a nota de rastreabilidade)
ocupam **mais** espaço que os achados.

## 3. ⛔ A restrição que decide o desenho

O core diz, sobre a frase de cada observação:

> *"**A frase inteira vem pronta**, e é de propósito: espalhar a redação por dentro da tela é como
> uma afirmação causal entraria sem ninguém notar."*

⛔ **Então a tela NÃO decompõe a frase.** Nada de destacar o número, separar o denominador ou
recompor o texto — por mais tentador que seja para escaneabilidade. A hierarquia tem de vir de
**tudo o que está em volta** da frase, nunca de dentro dela.

## 4. Goals

- G1 — Em um relance, ela sabe **de que dimensão** cada achado fala.
- G2 — O achado domina a tela; a explicação recua sem sumir.
- G3 — A superfície Premium parece Premium.

## 5. Non-Goals

- NG1 — ⛔ Não decompor, reescrever ou realçar parte da frase do core (§3).
- NG2 — ⛔ Nenhuma porcentagem, nota, score, ranking ou ordem de mérito. As recusas de
  SPEC-047/050/051 continuam inteiras.
- NG3 — ⛔ Nenhuma linguagem causal, de eficácia ou de indicação.
- NG4 — ⛔ Não fundir *"o que se repete"* com *"suas combinações"*: os denominadores são diferentes
  (SPEC-050 OQ1), e números parecidos com significados diferentes lado a lado seriam simplificar a
  tela **mentindo sobre o dado**.
- NG5 — Nenhuma dependência, token, migration ou leitura nova.

## 6. Functional Requirements

- FR1 — Cada observação de *"o que se repete"* mostra a **dimensão** a que pertence: **Produto**,
  **Técnica** ou **Finalização**, derivada do `kind` que já existe.
- FR2 — A dimensão é **rótulo**, não ícone: quatro categorias abstratas se dizem melhor em palavra, e
  a UI Intelligence só admite ícone quando ele acrescenta clareza que a palavra não dá.
- FR3 — ⛔ A seção *"O que você tem notado"* **não** recebe rótulo de dimensão: o título dela já diz,
  e repetir seria ruído — além de ser a única seção cujo conteúdo é **resultado**, não entrada.
- FR4 — O cartão põe a **dimensão acima do assunto**, o assunto como título e a frase do core
  intacta abaixo.
- FR5 — A nota de rastreabilidade e o estado vazio das combinações continuam presentes e passam a ler
  como **rodapé**, não como conteúdo de mesmo peso.

## 7. Business Rules

- BR1 — O rótulo de dimensão vem **do `kind`**, nunca inferido do texto.
- BR2 — ⛔ Rótulo é substantivo neutro. *"Produto"* descreve de onde saiu o dado; ⛔ *"produto que
  funciona"* seria alegação.
- BR3 — A ordem das listas não muda: continua a que o core devolve (SPEC-050 BR7).

## 8. Data Model / API / Authorization / Privacy

**Nenhum impacto.** Zero migration, zero RPC, zero policy, zero leitura nova. O gate `advanced_insights`
continua vindo do servidor, e a tela continua sem decidir nada sozinha.

## 9. Edge Cases

- EC1 — Só observações de um tipo: os rótulos se repetem, e tudo bem — é a verdade.
- EC2 — Sem premium, sem dados, erro, e poucos dados: os quatro estados continuam como estão.
- EC3 — Assunto longo (nome de produto de catálogo): trunca, nunca transborda.

## 10. Acceptance Criteria

- AC1 — Cada observação de repetição exibe a dimensão certa, para os três tipos.
- AC2 — A frase do core aparece **literal**, com teste que falha se a tela recompuser o texto.
- AC3 — A seção de marcações não ganha rótulo de dimensão.
- AC4 — Nenhum texto novo cai nas listas proibidas de SPEC-047/050/051.
- AC5 — Validado a 390px no DEV real com Premium, console limpo.

## 11. O que só se prova em iPhone nativo

⛔ Dynamic Type e sensação de toque (gate G7). O 390px prova hierarquia, truncamento e fluxo.

## 11.1 Evidência — o que foi medido

⚠️ **Dois achados da auditoria, os dois no próprio diff desta SPEC.**

**(1) O rótulo que nunca aparecia.** A primeira versão tinha `noticed: 'Você notou'` na tabela de
dimensões, só para o `Record` ficar exaustivo — uma string que **nenhum caminho de código
renderiza**, porque a FR3 diz que a seção de marcações não usa rótulo. É a forma branda do defeito
que este projeto já mediu quatro vezes (`Section`/`shelf`, `oilDueOn`, área segura, `lastUsedFor`):
**a peça existe e a ligação não**. Com `Exclude` e um guarda de tipo, a tabela passou a conter
exatamente o que existe na tela, e **uma dimensão nova continua quebrando o build** até alguém
decidir o rótulo dela — a exaustividade sobrevive sem a string morta.

**(2) Dois vazios com pesos diferentes.** A FR5 pôs o estado das combinações num cartão apagado, e a
seção vizinha — *"O que se repete"* sem repetição — ficou com o texto **solto**. Lado a lado, o
primeiro lia como estado e o segundo como achado, sendo os dois a mesma coisa. Corrigido nas duas, e
o caso ganhou teste (a tela só com marcações mostra as duas seções e nenhuma some).

**(3) Um docblock órfão.** As declarações novas entraram **entre** o comentário de `missingReason` e
a função — o comentário passou a documentar o tipo acima dele. Move, não reescreve.

✅ **Validado a 390px no DEV real, com Premium, console limpo** (`i-04-state.png`): *"Produto ·
Máscara da feira · esteve em 4 dos 6 cuidados que você avaliou bem"* e *"Técnica · Secou naturalmente
· você fez em 3 dos 6…"* — a dimensão em maiúsculas discretas acima do assunto, a frase do core
**inteira** abaixo, e o estado das combinações no cartão próprio. ⚠️ **O que a validação não prova:**
a dimensão `Finalização` não apareceu porque o histórico da usuária de desenvolvimento não tem
finalização repetida o bastante — está coberta por teste, não por medição.

## 12. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-09 | Auditoria: rótulo sem consumidor virou fato de compilação, os dois estados vazios pesam igual, docblock órfão recolocado | agente |
| 2026-09-09 | Criada. ⚠️ A restrição do core — a frase vem pronta de propósito — é o que define o desenho: a hierarquia vem de fora da frase, nunca de dentro | agente |
