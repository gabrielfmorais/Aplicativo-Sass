# SPEC-036 — O hero abstrato da Huna

| Campo | Valor |
|---|---|
| ID | SPEC-036 |
| Status | **Implemented — direção aprovada pelo dono (2026-09-03)** |
| Owner | dono do produto |
| Bounded Context | Design system (`apps/mobile/src/design`) — nenhum contexto de domínio |
| Related ADRs | ADR-001 (fronteiras), D-101 (dependência reversível não é gate) |
| Substitui | **SPEC-028** (musa digital) e **SPEC-029** (personagem) — as duas ficam `Superseded` |
| Related SPECs | SPEC-018 (a primeira experiência), SPEC-026, SPEC-027, SPEC-035 |
| Criado / Atualizado | 2026-09-03 / 2026-09-03 |

## 1. Context

O hero da Huna passou por **quatro** direções, e três delas foram reprovadas visualmente pelo dono:
fitas abstratas finas (SPEC-018), musa digital de frente (SPEC-028), figura de perfil (SPEC-027) e
personagem android redesenhada a partir de referência (SPEC-029).

⚠️ **O padrão não era técnico.** Cada tentativa de figura humana falhou pelo mesmo motivo: rosto,
cabeça, corpo e silhueta são implacáveis — um milímetro errado vira "estranho", e a 390px o erro
aparece antes de qualquer outra coisa. A quarta tentativa chegou com referência concreta e critério
explícito, e ainda assim foi reprovada.

**Esta SPEC encerra a frente de personagem por decisão do dono**, e registra a direção que ficou.

## 2. Decisão canônica (dono, 2026-09-03)

O hero da Huna é **abstrato e editorial**, inspirado em **fluxo, mechas, movimento capilar e a
identidade da marca**.

**Não existe, e não volta sem uma nova decisão explícita do dono:**

- personagem · mulher · rosto · cabeça · corpo · androide · silhueta humana.

**O que ele prioriza, nesta ordem:** beleza · movimento · sofisticação · integração com a
experiência.

⚠️ **Ele NÃO precisa parecer cabelo literal.** Este ponto é a diferença entre esta direção e as
anteriores: o hero evoca fluxo e movimento capilar, e não ilustra um cabelo. Cobrar realismo dele é
reabrir, por outro caminho, a exigência que reprovou as quatro tentativas anteriores.

**A composição abstrata hoje no repositório é a versão aprovada.** Ela não é placeholder, não é
provisória e não está esperando substituição.

## 3. Goals

- G1 — Uma abertura que se reconheça de relance como **Huna**, pela cor e pelo gesto.
- G2 — Movimento lento e vivo, sem virar animação.
- G3 — Legível a **390px** — validação real, não teste unitário.
- G4 — Trocável: o desenho é **dado**, e a costura de integração não muda quando ele mudar.

## 4. Non-Goals

- NG1 — **Nenhuma figura humana**, em nenhuma forma (§2).
- NG2 — **Não** é realismo, e não é ilustração de cabelo literal.
- NG3 — **Não** se redesenha tela alguma: o contrato público do componente não muda.
- NG4 — **Não** entra dependência nova. `react-native-svg` já estava no projeto (D-101).
- NG5 — **Não** há texto, botão, logo ou interface dentro da figura.

## 5. Functional Requirements

- FR1 — A geometria é **dado puro** em `apps/mobile/src/design/huna-hero.ts`: sem React, sem SVG,
  sem `react-native`. É o que permite renderizá-la fora do app e **olhar a cada passo** — o passo que
  faltava em todas as versões reprovadas, julgadas só depois de prontas.
- FR2 — Cada cena é feita de **três ou quatro massas grandes**, nenhuma com largura menor que 50
  unidades de palco. **Barreira de teste.**
- FR3 — No máximo **uma** massa opaca por cena; as demais são translúcidas. **Barreira de teste.**
  Massa opaca sobre massa opaca cria borda, e uma fileira de bordas paralelas lê como listra.
- FR4 — Cada massa tem período e atraso **próprios**, com amplitude de poucos graus. **Barreira de
  teste.** Períodos iguais fariam o conjunto girar em bloco.
- FR5 — Nada anima antes de a preferência de **redução de movimento** ser conhecida — o estado
  inicial do hook é `null`, não `false`.
- FR6 — A figura é **decorativa** para tecnologia assistiva e não recebe toque.
- FR7 — Dois enquadramentos, `portrait` e `banner`, que são **composições diferentes** e não uma
  recortada em dois tamanhos. **Barreira de teste** compara as espinhas.
- FR8 — A altura de render de cada enquadramento é dado do enquadramento (`FRAME_HEIGHT`), não da
  tela (SPEC-016 FR2/AC1).

## 6. Business Rules

- BR1 — **Nenhuma figura humana entra aqui sem decisão explícita e nova do dono.** Quatro tentativas,
  quatro reprovações; reabrir por conta própria é repetir um ciclo já pago.
- BR2 — O desenho vive em `huna-hero.ts`; `HunaFigure.tsx` é o palco e **não sabe desenhar nada**.
- BR3 — O contrato público é `<HunaFigure frame style />` e sobrevive a qualquer troca de desenho.

## 7–13. Dados, contratos, autorização, segurança, privacidade, analytics

Nada. É desenho: sem tabela, sem RPC, sem policy, sem evento, sem dado da usuária.

## 14. UX Notes

Quatro telas consomem o componente — `WelcomeScreen`, `SignInScreen`, `OnboardingScreen` e `Moment` —
e nenhuma sabe como ele é desenhado.

## 15. Edge Cases

- EC1 — **Tela de 320pt.** A figura é dimensionada por proporção; `slice` recorta, nunca deforma.
- EC2 — **Redução de movimento ligada.** Nada se move e o desenho continua inteiro.
- EC3 — **Faixa baixa (132pt).** O `banner` tem composição própria; o `portrait` numa faixa dessas
  mostraria só a parte de cima da composição.

## 16. Failure Modes

- FM1 — Girar a **View** da camada gira o retângulo que a recorta, e a borda reta aparece a 390px:
  a rotação vive dentro do SVG, e a caixa é 20% maior que a camada.
- FM2 — `Animated.createAnimatedComponent` injeta `collapsable` num `<G>`, que vaza para o DOM no
  web. Os dois defeitos só apareceram no app real — nenhum teste os pegaria.

## 17. Acceptance Criteria

- AC1 — *(humano)* **Aprovado pelo dono em 2026-09-03** para a composição atual.
- AC2 — Massas poucas e largas, no máximo uma opaca, balanço próprio por massa. **Teste.**
- AC3 — As duas cenas não compartilham espinhas. **Teste.**
- AC4 — A figura é invisível para tecnologia assistiva. **Teste.**
- AC5 — Zero literal de dimensão do hero em tela de produto. **Varredura.**

## 18. Testing Strategy

`apps/mobile/__tests__/welcome-screen.test.tsx` guarda as barreiras estruturais. **O que o teste não
alcança é exatamente o que reprovou quatro versões** — se a composição é bonita — e por isso a
validação a 390px no DEV real é parte do DONE desta SPEC.

## 19–22. Dependências, plano, migração, rollback

Nenhuma dependência nova, nenhuma migration. Rollback é reverter o commit.

## 23. Open Questions

- OQ1 — **Asset autoral externo.** Continua sendo uma possibilidade, não uma pendência: o contrato de
  troca está em `docs/design/HUNA-HERO-ASSET.md`. ⚠️ Ele vale para um hero **abstrato** — nenhum
  asset com figura humana satisfaz esta SPEC.

## 24. Change Log

| Data | Mudança |
|---|---|
| 2026-09-03 | v1.0 — o dono encerrou a frente de personagem e aprovou a composição abstrata existente. Substitui SPEC-028 e SPEC-029. |
