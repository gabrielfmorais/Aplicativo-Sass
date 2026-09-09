# SPEC-067 — A aba Cuidados abre pelo cuidado

| Campo | Valor |
|---|---|
| ID | SPEC-067 |
| Status | Approved (frente escolhida pelo agente, §0.3) |
| Owner | dono do produto |
| Bounded Context | Care/Content — **arranjo de tela apenas** |
| Related ADRs | ADR-001 |
| Related SPECs | SPEC-026 (a aba), SPEC-031 (os guias ganham lugar), SPEC-040/053 (a rotina de óleo), SPEC-056 (Finalizações), SPEC-020 (meu cabelo mudou) |
| Direção | `docs/design/UI-INTELLIGENCE.md` |
| Criado / Atualizado | 2026-09-09 / 2026-09-09 |

## 1. Problem — medido a 390×844

A aba se chama **Cuidados**, e o conteúdo sobre cuidado é a última coisa nela. Posições medidas no
DEV real, com a rotina de óleo da usuária de desenvolvimento (três horários):

| Bloco | Topo | O que é |
|---|---|---|
| Meu cabelo mudou | **194** | um **evento**, raro |
| Rotina de óleo | **406** | **configuração** que ela ajusta uma vez |
| Finalizações | **1198** | conteúdo |
| Como fazer cada cuidado | **1393** | **o conteúdo que dá nome à aba** |

Altura rolável: **1640**. Ou seja: os guias da SPEC-007 começam a **1,65 tela** de distância, nos
últimos 15% da página, e a configuração de óleo sozinha ocupa **792px — 94% de uma tela inteira**.

⚠️ **A ordem não foi decidida: ela é a ordem de chegada.** Cada SPEC acrescentou o seu bloco no fim
do arquivo, e a SPEC-031 escreveu, ao trazer os guias, que eles *"ganham endereço"* — ganharam o
endereço mais distante da tela.

## 2. ⚠️ O que a medição derrubou da minha própria hipótese

A primeira leitura foi que o **cabeçalho vinho** de *"Sua rotina"* estava fora da família das outras
abas. ⛔ **Errado, e conferido no código antes de escrever:** o `ScreenHeader` com a superfície
tingida é o padrão das **quatro** abas desde a SPEC-026 FR16, e a SPEC-032 registra por que ele fica.
Não há defeito ali, e mexer nele seria desfazer uma decisão por impressão.

## 3. Goals

- G1 — Quem abre **Cuidados** vê **cuidado**: os guias primeiro.
- G2 — O que é configuração continua alcançável, embaixo, sem sumir.
- G3 — A próxima capability que chegar **decide** onde entra, em vez de cair no fim.

## 4. Non-Goals

- NG1 — ⛔ Nenhuma palavra do conteúdo capilar muda (D-26/D-70 intocados).
- NG2 — ⛔ Nenhum bloco sai da aba, nenhum vira tela nova, nenhuma porta some.
- NG3 — ⛔ Nada muda no cabeçalho (§2).
- NG4 — Zero dependência, migration, porta, estado ou primitiva.

## 5. Functional Requirements

- FR1 — A ordem passa a ser: **Como fazer cada cuidado** → **Finalizações** → **Rotina de óleo** →
  **Meu cabelo mudou**.
- FR2 — Todos os blocos continuam presentes e com o mesmo conteúdo.
- FR3 — A ordem vira **teste**, com o motivo escrito: um bloco novo tem de escolher a posição dele.

## 6. Business Rules

- BR1 — **Conteúdo antes de configuração**: o que ela consulta vem antes do que ela ajusta uma vez.
- BR2 — **Rotina antes de evento**: a rotina de óleo é mantida com frequência; *"meu cabelo mudou"*
  acontece raramente e é por isso que fica por último — ⛔ não por ser menos importante.
- BR3 — Blocos condicionais (óleo, eventos) podem não existir; a ordem dos que existem não muda.

## 7. Data Model / API / Authorization / Privacy

**Nenhum impacto.** É a ordem de quatro blocos num JSX.

## 8. Edge Cases

- EC1 — Sem a capability de eventos: o bloco não existe e nada se desloca por cima do conteúdo.
- EC2 — Sem rotina de óleo carregada: idem.
- EC3 — Rotina de óleo com dez horários: cresce, e agora cresce **abaixo** do conteúdo.

## 9. Acceptance Criteria

- AC1 — Os quatro blocos aparecem na ordem da FR1, com teste que falha se um novo entrar no fim sem
  decisão.
- AC2 — Nenhum bloco perdeu texto, botão ou destino.
- AC3 — Validado a 390px no DEV real, com a posição dos blocos **medida** antes e depois.

## 9.1 Evidência — medido antes e depois, a 390×844

| Bloco | Antes | Depois |
|---|---|---|
| **Como fazer cada cuidado** | 1393 | **177** |
| Finalizações | 1198 | 441 |
| Rotina de óleo | 406 | 653 |
| Meu cabelo mudou | 194 | 1445 |

Altura rolável idêntica (**1640** nos dois): ⛔ **nada foi removido nem encolhido** — o que mudou foi
qual conteúdo a primeira tela mostra. Os guias saíram dos últimos 15% da página para o topo, e a
configuração de óleo passou a começar **no fim da primeira dobra**.

⚠️ **Um achado de arrumação que a reordenação expôs:** o comentário da SPEC-031 — *"os guias ganham
lugar"* — estava escrito **acima do bloco de óleo**, não acima dos guias, e teria viajado com o bloco
errado. Foi para onde pertence, e o óleo ganhou o comentário que explica por que ele desceu.

✅ **Validado a 390px no DEV real, console limpo:** a aba abre com os quatro guias
(Hidratação · Nutrição · Reconstrução · Restauração), Finalizações logo abaixo, e todas as portas
continuam funcionando.

⚠️ **A barreira foi verificada CONTRA o defeito**, não só escrita: com os guias devolvidos ao fim do
arquivo, dois dos três testes falham e nomeiam a ordem errada.

## 10. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-09 | Medido depois: guias 1393 → 177, com a altura rolável idêntica. Comentário da SPEC-031 recolocado sobre os guias, onde sempre pertenceu | agente |
| 2026-09-09 | Criada. ⚠️ A ordem era a de chegada, não uma decisão — os guias começavam a 1,65 tela do topo, e a hipótese sobre o cabeçalho foi derrubada pela leitura do código antes de virar mudança | agente |
