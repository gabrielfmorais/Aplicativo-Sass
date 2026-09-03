# SPEC-033 — A prateleira mostra primeiro o que ela tem

| Campo | Valor |
|---|---|
| ID | SPEC-033 |
| Status | Implemented (aceite visual do dono pendente) |
| Owner | dono do produto |
| Bounded Context | Products (UI) — `apps/mobile/src/features/shelf` |
| Related SPECs | SPEC-023 (a prateleira), SPEC-027 (virou aba), SPEC-030 (a Hoje), SPEC-032 (o cabeçalho) |
| Criado / Atualizado | 2026-09-02 / 2026-09-02 |

## 1. Problem

A tela chamada **Prateleira** abria com **~470px de formulário vazio** — campo de nome mais sete
categorias — e o que ela tem em casa, que é o assunto da tela, começava **abaixo da dobra**.

E o **"Adicionar" ficava fixo no rodapé, permanentemente desabilitado** enquanto o formulário
estivesse vazio: um botão primário morto no pé de toda visita.

Cada produto era um `Card` inteiro com nome, categoria e um botão de remover — ~200px cada. Uma
prateleira de dez vidros virava duas telas de rolagem para ler dez nomes.

## 2. Goals

- G1 — Abrir mostrando **o que ela tem**.
- G2 — O cadastro é uma **ação**, não o topo permanente da tela.
- G3 — Nenhuma funcionalidade escondida: adicionar e tirar continuam à mão.

## 3. Non-Goals

- NG1 — Nada de banco, core, port ou RPC. `useAddProduct` e as regras da SPEC-023 ficam intactos.
- NG2 — A prateleira continua **não sendo loja nem catálogo**: nada de preço, marca, composição ou
  link. Isso é "Produtos para você", que é outra seção e outro momento (SPEC-030 §14).

## 4. Functional Requirements

- FR1 — Com produtos, a tela abre na **lista**; o formulário fica fechado.
- FR2 — A vaga primária do rodapé **muda de sentido**: fechada, abre o formulário; aberta, envia.
- FR3 — Com a prateleira **vazia**, o formulário já vem aberto e não oferece "Cancelar".
- FR4 — Uma leitura que **falhou** não abre o formulário.
- FR5 — Um produto por linha, num cartão só, com a ação de tirar à vista.

## 5. Business Rules

- BR1 — ⚠️ **`length === 0` só conta quando a leitura voltou.** `list` é `'loading' | 'error' | []`;
  tratar qualquer um dos dois primeiros como "vazia" abriria o formulário por cima de um estado que
  ainda não sabe de nada — e afirmaria "você não tem nada" a partir de um erro de rede. É a mesma
  armadilha que o `productCount: null` das sugestões evita.
- BR2 — Nada aqui afirma coisa alguma sobre o produto (SPEC-023).

## 6–12. Dados, contratos, autorização, segurança, privacidade, analytics

Nenhum impacto. Nenhuma port foi tocada.

## 13. UX Notes

⚠️ **Uma vaga primária só, que muda de sentido.** Dois botões primários ao mesmo tempo — um para
abrir e outro para enviar — seriam duas ações principais na mesma tela, que é a definição de nenhuma.

⚠️ **A explicação aparece quando importa:** cadastrando, ou sem nada cadastrado. Com a prateleira
cheia ela já sabe o que é a prateleira, e três linhas repetindo isso em toda visita empurram para
baixo justamente o que ela veio ver.

**A lista não some ao cadastrar** — é a referência de "já tenho isso", e some-la convidaria a
duplicata que a SPEC-023 traduz na fronteira.

## 14. Edge Cases

- EC1 — Loading e erro não abrem o formulário (BR1).
- EC2 — Nome comprido corta em uma linha e nunca empurra a categoria para fora.

## 15. Failure Modes

Inalterados: o erro de leitura continua oferecendo "Tentar novamente"; a duplicata continua chegando
como frase, não como falha do Postgres (SPEC-023).

## 16. Acceptance Criteria

- AC1 — Com produtos, nenhum campo de formulário está na tela até ela pedir.
- AC2 — A vaga primária nunca aparece desabilitada só porque o formulário está vazio.
- AC3 — Com a prateleira vazia, o formulário está aberto e não há "Cancelar".
- AC4 — Erro de leitura não abre o formulário.

## 17. Testing Strategy

Os **7 testes existentes da SPEC-023 passaram sem alteração** — eles partem da prateleira vazia, que
é exatamente o caso em que o formulário continua aberto. Quatro barreiras novas cobrem a inversão.
313 testes do app verdes. Validado a 390px nos dois estados.

## 18. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-02 | v0.1 — a inversão: lista primeiro, cadastro sob demanda, uma linha por produto. | agente (§0.2) |
