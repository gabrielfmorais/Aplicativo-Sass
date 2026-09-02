# SPEC-031 — Os guias ganham lugar

| Campo | Valor |
|---|---|
| ID | SPEC-031 |
| Status | Implemented (aceite visual do dono pendente) |
| Owner | dono do produto |
| Bounded Context | Content (UI) — `apps/mobile/src/features/care` |
| Related SPECs | SPEC-007 (os guias), SPEC-026 (as categorias), SPEC-030 (a Hoje) |
| Criado / Atualizado | 2026-09-02 / 2026-09-02 |

## 1. Context

A aba **Cuidados** tinha dois cartões e ~450px de vazio. A SPEC-026 tinha decidido, com razão, que
esse vazio ficaria: preencher com atalho inventado seria complexidade para preencher espaço.

O que mudou não foi a régua — foi um **achado**.

## 2. Problem

Os guias da SPEC-007 (`CARE_GUIDES`: o que é, passos, erros comuns, duração) existiam desde sempre e
tinham **um único caminho**: o botão "Como fazer", **dentro do cartão de um cuidado agendado**.

Ou seja: ela só conseguia ler sobre nutrição se houvesse uma nutrição no cronograma **e** ela achasse
o cartão. Numa terça sem cuidado nenhum, o conhecimento que o app já tem era inalcançável.

É a mesma classe de problema que criou a SPEC-026 — **capability sem lugar** —, com o agravante de
que aqui não havia sequer uma tela errada onde ele morasse. Não havia nenhuma.

## 3. Goals

- G1 — Dar aos guias um endereço que não dependa de agenda.
- G2 — Preencher o vazio de Cuidados com **substância**, não com atalho inventado.

## 4. Non-Goals

- NG1 — Nenhum conteúdo novo. É o mesmo texto, no mesmo componente.
- NG2 — Nada de banco, core, RPC ou dependência.
- NG3 — Não mexer no "Como fazer" da Hoje, que continua exatamente como está.

## 5. Functional Requirements

- FR1 — A aba Cuidados lista os **três** tipos de cuidado, fora de qualquer agenda.
- FR2 — Cada linha mostra o nome, a marca de cor do tipo e a duração; tocar abre o guia em lugar.
- FR3 — Começam **fechados**.
- FR4 — A duração aparece **uma vez** por linha.

## 6. Business Rules

- BR1 — Nenhuma afirmação nova sobre cabelo. O texto é o da SPEC-007, sem acréscimo.
- BR2 — ⚠️ **O gate de domínio continua onde estava.** O conteúdo é `candidate` (D-26 / ADR-007 A1) e
  o bloqueio é de **PUBLIC RELEASE**, não de posicionamento. Mostrar o mesmo texto num segundo lugar
  não muda o status dele.

## 7–13. Dados, contratos, autorização, segurança, privacidade, analytics

Nenhum impacto. `CARE_GUIDES` é uma constante do bundle: sem fetch, sem loading, sem erro, e
funciona com o telefone offline (SPEC-007 §16).

## 14. UX Notes

⚠️ **Não é uma segunda porta para o mesmo destino.** O "Como fazer" da Hoje é **contextual** — este
cuidado, agora, dentro do cartão dele. Este é **referência** — os três tipos, fora de qualquer
agenda. Um é a receita dentro do cardápio do dia; o outro é o livro de receitas.

⚠️ **Revelação é legítima aqui, e foi recusada na Hoje.** Colapsar os cartões da Hoje escondia
**ação** ("Contar esse cuidado", "Fiz hoje"), e a SPEC-007 AC5 promete o guia em todo cuidado
acionável. Aqui não há ação nenhuma para esconder: é leitura, e três guias abertos de uma vez seriam
três telas de texto que ninguém pediu.

## 15. Edge Cases

- EC1 — Sem plano ativo, a biblioteca continua inteira: ela não depende de cronograma.

## 16. Failure Modes

Nenhum. Não há leitura de rede nesta seção.

## 17. Acceptance Criteria

- AC1 — Os três guias são alcançáveis sem nenhum cuidado agendado.
- AC2 — Começam fechados; abrem e fecham ao toque.
- AC3 — Abrir um guia **não** cria uma segunda ocorrência da duração.
- AC4 — O "Como fazer" da Hoje continua idêntico.

## 18. Testing Strategy

`care-guide-library.test.tsx` — os três tipos, abrir/fechar, e a duração que não se repete.
309 testes do app verdes. Validação a 390px: seção fechada e guia aberto.

## 19–22. Dependências, plano, migração, rollback

Nenhuma dependência. Sem migration. Reverter os quatro arquivos desfaz tudo.

## 23. Open Questions

- OQ1 (CAN DEFER) — Se o catálogo de tipos de cuidado crescer, três linhas viram uma lista longa e a
  biblioteca provavelmente quer tela própria. Com três, uma seção basta.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-02 | v0.1 — os guias ganham endereço. **Dois achados durante a implementação.** **(1)** A linha mostrava "~20 min" e o painel repetia logo abaixo: o mesmo dado duas vezes, um sobre o outro — daí `showDuration` no `CareGuidePanel`, ligado por padrão porque no cartão da Hoje o painel é a única coisa que a diz. **(2)** A primeira versão do teste exigia **exatamente uma** ocorrência da duração e falhou — não por defeito, mas porque **os três guias duram o mesmo** e cada linha mostra a sua. A invariante certa não é a contagem absoluta: é que **abrir não cria mais nenhuma**. | agente (§0.2) |
