# SPEC-029 — A personagem da Huna ⛔ SUPERSEDED

> ⛔ **SUPERSEDED por [SPEC-036](SPEC-036-huna-hero-abstrato.md) (dono, 2026-09-03).**
>
> **Esta SPEC não vale mais como direção, e nada dela deve ser implementado.** A personagem — a
> android feminina de perfil que os requisitos abaixo descrevem — foi **reprovada visualmente pelo
> dono**, e com ela toda a frente de figura humana no hero: sem personagem, sem mulher, sem rosto,
> sem cabeça, sem corpo, sem androide. A direção vigente é um hero **abstrato e editorial**, e está
> na SPEC-036.
>
> **O documento fica aqui como registro do que foi tentado**, porque a lição custou quatro rodadas:
> toda tentativa de figura humana falhou pelo mesmo motivo, e é isso que a SPEC-036 BR1 impede de
> repetir. Ler os FRs abaixo como requisito é reabrir uma decisão fechada.

| Campo | Valor |
|---|---|
| ID | SPEC-029 |
| Status | **Superseded por SPEC-036** (2026-09-03) — nunca representou a direção final |
| Owner | dono do produto |
| Bounded Context | Design system (`apps/mobile/src/design`) — nenhum contexto de domínio |
| Related ADRs | ADR-001 (fronteiras), D-101 (dependência reversível não é gate) |
| Related SPECs | SPEC-018 (a primeira experiência), SPEC-026, SPEC-027, **SPEC-028 (substituída no desenho)** |
| Fase do roadmap | Huna Core Experience |
| Criado / Atualizado | 2026-09-02 / 2026-09-02 |

## 1. Context

A SPEC-028 tinha **encerrado** a frente artística do hero. Três versões foram reprovadas visualmente
pelo dono, e a conclusão registrada — aceita na época — era que ilustração dessa qualidade não sairia
de SVG procedural escrito por agente. O `HunaFigure` ficou no repositório como **placeholder
técnico**, com a instrução explícita de não receber novas tentativas.

Essa conclusão estava errada pela metade, e o dono reabriu a frente trazendo o que faltava: uma
**referência visual concreta** e um pedido de **simplificação**.

⚠️ **O limitador nunca foi a tecnologia. Era a ausência de alvo.** Cada uma das três versões foi um
chute sobre "o que é bonito", julgado só depois de pronto — e chute não converge. Com referência na
mão e um critério explícito ("um mascote, não uma obra de arte complexa"), o alvo virou verificável.

## 2. Problem

O hero da abertura precisa ser uma **figura de marca**: reconhecível de relance, memorável pela
silhueta, e viva o suficiente para a primeira tela não parecer estática. O que existia era um feixe
de vinte fitas finas que a 390px lia como cortina, não como cabelo.

## 3. Goals

- G1 Uma personagem **simples**: android feminina de perfil, rosto praticamente sem detalhes.
- G2 **Cabelo protagonista**, em 4–5 mechas largas e curvas.
- G3 Movimento **só no cabelo**: cabeça e corpo praticamente parados, cada mecha com o seu ritmo.
- G4 Legível a **390px** — validação real, não teste unitário.
- G5 Trocável: o desenho é dado, e a costura de integração não muda quando ele mudar.

## 4. Non-Goals

- NG1 **Não** é fotorrealismo, nem ilustração elaborada.
- NG2 **Não** há fundo: a figura é recortada (pedido literal: "fundo transparente ou neutro").
- NG3 **Não** se redesenha nenhuma tela do app. O contrato público do componente é o mesmo.
- NG4 **Não** entra dependência nova. `react-native-svg` já estava no projeto (D-101).
- NG5 **Não** há texto, botão, logo ou interface dentro da figura.

## 5. User Stories

- US1: Como alguém que abre o app pela primeira vez, quero **reconhecer uma marca** antes de um
  formulário, para saber onde estou.

## 6. Functional Requirements

- FR1 A figura é de **perfil**, com o nariz como única saliência; sem olho, boca, sobrancelha ou
  orelha. Barreira de teste estrutural (o ponto mais à frente fica na metade **de baixo** do crânio).
- FR2 O cabelo tem **no máximo 8** formas, das quais **ao menos 4** com largura ≥ 50 unidades de
  palco, e a maior ≥ 120. Barreira de teste.
- FR3 Existe mecha **atrás** e mecha **na frente** da figura. Barreira de teste.
- FR4 Cada mecha tem **período e atraso próprios** — nenhum par se repete. Barreira de teste.
- FR5 A tecnologia se limita a **dois** detalhes de luz: a gola no pescoço e o nó no filamento.
- FR6 Nada anima antes de a preferência de **redução de movimento** ser conhecida (o estado inicial
  do hook é `null`, não `false`).
- FR7 A figura é **decorativa** para tecnologia assistiva e não recebe toque.
- FR8 Dois enquadramentos do mesmo desenho: `portrait` e `banner`. O segundo **substitui** o `band`
  da SPEC-028 e não é um recorte dele: o `band` era o pôster vertical cortado na horizontal, e a
  350px de largura por 132 de altura isso lia como imagem cortada. O `banner` tem composição própria
  para a proporção da faixa, e é por isso que a troca custou uma palavra em cada consumidor.
- FR9 A altura de render de cada enquadramento é **dado do enquadramento** (`FRAME_HEIGHT`), não da
  tela: "o mesmo banner do login" não pode depender de alguém repetir o número (SPEC-016 FR2).

## 7. Business Rules

- BR1 A geometria vive em `apps/mobile/src/design/huna-hero.ts` — **TypeScript puro**, sem React,
  sem SVG, sem `react-native`. É isso que permite renderizá-la fora do app e **olhar antes de
  decidir**, que é o passo que faltou nas três versões reprovadas.
- BR2 A figura não declara textura capilar (nem liso escorrido, nem cacho definido) e não tem traço
  étnico: o produto atende liso, ondulado, cacheado e crespo, e a primeira tela não exclui nenhum.
- BR3 Sem promessa de resultado capilar em lugar nenhum — seria conteúdo substantivo e cairia no
  gate de domínio (D-26).

## 8. Data Model Impact

Nenhum. Não há banco, migration, RLS, RPC ou Edge Function nesta SPEC.

## 9. API / Contracts

O contrato público é o mesmo de antes, e é o que garante o NG3:

```tsx
<HunaFigure frame="portrait" | "banner" style={…} />
```

Quatro telas o consomem (`WelcomeScreen`, `SignInScreen`, `OnboardingScreen`, `Moment`). A **forma**
do contrato é a mesma, e é isso que o NG3 protege: nenhuma tela foi redesenhada, nenhuma soube como a
figura é feita. O que mudou em três delas foi **uma palavra** — o `band` que deixou de existir virou
`banner` (FR8) — e a altura, que saiu da tela e foi para o enquadramento (FR9).

## 10. Authorization

Não se aplica.

## 11. Security Considerations

Não se aplica: componente puramente visual, sem entrada externa e sem rede.

## 12. Privacy Considerations

Não se aplica.

## 13. Analytics Events

Nenhum.

## 14. UX Notes

O desenho e cada correção estão documentados **onde foram corrigidos**, em `huna-hero.ts` e
`HunaFigure.tsx`. Os defeitos que só apareceram quando a coisa foi renderizada:

| Defeito visto | Correção |
|---|---|
| O couro cabeludo lia como **boina** (meia-lua com bico sobre a testa) | Forma sólida que desce pela nuca; cabelo termina no pescoço, chapéu termina na orelha |
| Depois, lia como **fone de ouvido** (gancho em volta da orelha, testa vazada no meio) | Contorno interno passou a hugging a linha do cabelo, sem furo |
| Mecha terminando no vazio lia como **lasca solta** | Aninhada nas massas e sangrando pela borda |
| A mecha da frente lia como **rabo/cachecol** | Rota deslocada para o ombro, mais larga, ponta mais macia |
| Um anel no ombro lia como **anatomia**, não como junta de android | Substituído pela gola luminosa no pescoço |
| Corpo como **mancha pálida sem forma** | Tronco estreitado, silhueta fechada, sombra reforçada |
| Silhueta virou **casco** quando as mechas se enrolaram para dentro | Voltou o varrer horizontal, sangrando pela borda esquerda |

## 15. Edge Cases

- EC1 **Tela de 320pt.** A figura é dimensionada por proporção; `slice` recorta, nunca deforma.
- EC2 **Redução de movimento ligada.** Nada se move, e o desenho continua inteiro.
- EC3 **Faixa baixa (132pt).** O enquadramento `banner` mostra cabeça + gesto do cabelo; o
  `portrait` numa faixa dessas mostraria só o cabelo acima da testa.

## 16. Failure Modes

Não há caminho de falha: nenhuma leitura, nenhuma escrita, nenhuma dependência de rede. Se a consulta
de preferência de movimento falhar, o app fica **sem animação**, nunca sem conteúdo.

## 17. Acceptance Criteria

- AC1 **HUMANO, e nenhum teste responde por ele:** *"isso parece uma identidade visual premium e
  memorável para a Huna?"* Renderizar, passar nos testes e ter movimento **não** aprovam a figura.
- AC2 FR1–FR8 verificados por teste em `apps/mobile/__tests__/welcome-screen.test.tsx`.
- AC3 Jornada observada a **390px real** (`Emulation.setDeviceMetricsOverride`, não `--window-size`):
  abertura e login, sem erro de console. ✅ feito.
- AC4 Nenhuma tela alterada; nenhuma dependência adicionada. ✅ feito.

## 18. Open Questions

- OQ1 **O asset autoral externo continua sendo o teto.** Esta figura é o melhor desenho que sai
  daqui, não a ilustração final. O contrato de integração está em `docs/design/HUNA-HERO-ASSET.md`, e
  a troca continua sendo **um** módulo de geometria.
- OQ2 Fonte custom para o wordmark (herdada da SPEC-016, sem gatilho ainda).
