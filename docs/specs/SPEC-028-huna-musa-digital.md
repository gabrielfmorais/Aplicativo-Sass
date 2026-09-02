# SPEC-028 — A Musa Digital: o hero da Huna, refeito por outro método

| Campo | Valor |
|---|---|
| ID | SPEC-028 |
| Status | **Proposta visual — aguarda aprovação do dono** |
| Owner | dono (direção dada em sessão, 2026-09-02) |
| Bounded Context | — (design system; nenhum contexto de domínio é tocado) |
| Related ADRs | D-101 (dependência técnica reversível), D-97, D-90 (validação no real) |
| Related SPECs | SPEC-016, SPEC-018, SPEC-026, SPEC-027 |
| Criado / Atualizado | 2026-09-02 / 2026-09-02 |

## 1. Context

O hero da SPEC-027 foi **reprovado visualmente pelo dono**. O diagnóstico dele, literal: parece
ilustração vetorial genérica · humana demais · flat demais · não transmite tecnologia · não transmite
movimento real de cabelo · não tem a presença que a abertura da Huna precisa.

E a instrução foi explícita: **parar de iterar curvas sobre o mesmo desenho**.

## 2. Problem

O problema não era o traço. Era o **método**.

As três versões anteriores foram escritas à mão, caminho SVG por caminho SVG. Isso tem um teto, e o
teto é baixo: um humano ajustando pontos de controle um a um segura **quatro ou cinco** formas antes
de perder o conjunto. E quatro formas opacas leem *flat*, por melhor que estejam desenhadas — falta
sobreposição para o olho construir profundidade.

Cabelo bonito não é feito de poucas formas grandes. É feito de **muitas fitas finas que se cruzam**.
Isso não se escreve à mão: se gera.

## 3. Decisão de tecnologia

A direção autorizou trocar de tecnologia se o SVG fosse o limitador. **Ele não é**, e a medição está
no repositório: `react-native-svg@15.15.4` traz `Mask`, `ClipPath`, gradientes em espaço de usuário e
a suíte de filtros inteira.

| Opção | Veredito | Motivo concreto |
|---|---|---|
| **Rive** | Reprovada | Exige um `.riv` autorado no editor gráfico da Rive — ninguém nesta sessão produz esse arquivo. Runtime nativo: quebraria a validação a 390px, que hoje é o único jeito de ver o produto (é o critério que D-101 usa). |
| **Lottie** | Reprovada | O JSON é gerável por código, mas **a arte continua vindo do agente**: a mesma ilustração, num formato pior, mais uma dependência nativa e mais risco no preview. Trocar de formato não desenha melhor. |
| **`react-native-svg`** | **Escolhida** | Nada do que a figura precisa está fora dele — e o gargalo real (o método) não é resolvido por nenhuma das outras. |

⚠️ **Isto não fecha a porta para um asset autorado por ilustrador.** Continua sendo o teto, e continua
sendo OQ1. O que muda é que o hero deixa de ser um rascunho e passa a ser uma figura defensável
enquanto esse asset não existe.

## 4. Goals

- G1 — Uma **Musa Digital**: entre escultura digital, editorial de beleza, futurismo e feminilidade.
- G2 — Cabelo como **fitas orgânicas** com profundidade, sobreposição e leveza. Nenhuma leitura de
  capacete; nenhuma massa única atrás da cabeça.
- G3 — Movimento vivo e sutil, com atraso entre planos.
- G4 — Composição integrada ao fundo, **sem retângulo vinho dentro de um cartão**.

## 5. Non-Goals

- NG1 — Nenhuma mudança de banco, core, RPC ou contrato.
- NG2 — Nenhuma dependência nova.
- NG3 — Não é fotorrealismo, não é cartoon, não é robô metálico.
- NG4 — Nenhum detalhe facial: sem olho, sem boca, sem sobrancelha.

## 6. Functional Requirements

- FR1 — O cabelo é **gerado** a partir de espinhas e perfis de largura (`ribbon.ts`), não escrito à
  mão. Dezenove fitas, em quatro planos de profundidade.
- FR2 — O hero respeita redução de movimento; nada anima antes de a preferência ser conhecida.
- FR3 — A composição **se dissolve** no canvas por uma máscara em gradiente — sem borda, sem raio,
  sem emenda.
- FR4 — Dois enquadramentos do mesmo desenho: `portrait` (abertura) e `band` (login, interlúdios).
- FR5 — O corpo existe só até onde a silhueta precisa dele e **desaparece** num gradiente.

## 7. Business Rules

- BR1 — A figura continua servindo qualquer cabelo: sem rosto, sem traço étnico, e fitas que não são
  liso escorrido nem cacho definido. É o argumento que criou o placeholder abstrato da SPEC-018.
- BR2 — Nenhuma promessa de resultado capilar na copy (D-26).
- BR3 — Literal de cor ou espaçamento em tela de produto continua sendo bug. As cores da figura vivem
  em `apps/mobile/src/design/`, que é onde a paleta mora.

## 8–13. Dados, contratos, autorização, segurança, privacidade, analytics

Nenhum impacto em nenhum dos seis. A rodada é desenho.

## 14. UX Notes

**A leitura, camada por camada:** campo (gradiente da marca que some) · fitas de trás · figura ·
fitas do meio · fitas da frente · fios · touca. A touca é a última e existe para esconder as
dezenove raízes de uma vez — sem ela o feixe converge e o hero vira um bulbo.

**A regra que salva o rosto:** nenhuma fita desenhada **depois** da figura nasce à direita de
`x = 254`. A direita é onde está o perfil, e uma fita atravessando a testa apaga a única coisa que
impede o desenho de virar mancha.

## 15. Edge Cases

- EC1 — Tela de 320pt com fonte grande: o vão entre a marca e a copy encolhe; o texto fica inteiro.
- EC2 — Faixa curta (login): o enquadramento `band` mantém a cabeça no quadro.
- EC3 — Redução de movimento ativa: a figura fica estática e completa.

## 16. Failure Modes

Nenhum caminho de dados é tocado.

## 17. Acceptance Criteria

- AC1 — A 390px, a abertura mostra uma figura de perfil com cabelo em fitas sobrepostas, dissolvendo
  no creme, sem borda nem cartão.
- AC2 — O cabelo tem ≥ 16 fitas, em ≥ 4 planos, com fitas na frente da figura e mais da metade
  translúcidas.
- AC3 — Todo contorno de fita é feito de curvas — nenhum `L`, `H` ou `V`.
- AC4 — As duas pontas de cada fita afinam a zero.
- AC5 — O ponto mais à frente da cabeça fica **abaixo** da metade da altura dela (é o nariz; num
  desenho frontal o ponto mais largo é a têmpora, acima da metade).
- AC6 — ⚠️ **AC6 é humano.** *"Isso parece uma identidade visual premium e memorável para a Huna?"*
  Nenhum teste responde isso, e SVG que renderiza, teste que passa e movimento que existe **não**
  aprovam o hero.

## 18. Testing Strategy

`ribbon.test.ts` cobre a geometria (curvas, afinamento, caixa, espinha degenerada, `bulge`).
`welcome-screen.test.tsx` cobre as barreiras de composição: contagem de fitas, planos, translucidez,
e a estrutura que distingue perfil de frente. **Validação visual a 390px é parte do DONE (D-90)**, e
mesmo ela não substitui AC6.

## 19. Dependencies

Nenhuma nova.

## 20–22. Plano, migração, rollback

Uma PR. Sem migration. Reverter a PR desfaz tudo; nenhum estado persistido depende dela.

## 23. Open Questions

- OQ1 (CAN DEFER, **TRUE HUMAN GATE**) — O asset autorado por **ilustrador** continua sendo o teto.
  Depende de contratar alguém, e isso é decisão comercial do dono. Enquanto não existir, esta figura
  é a resposta honesta.
- OQ2 (CAN DEFER) — Um `FeGaussianBlur` nas fitas de trás daria profundidade de campo real. Ficou
  fora por custo de render em aparelho fraco, que ninguém mediu ainda.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-02 | v0.1 — o hero refeito **por outro método**, depois da reprovação visual do dono. Cinco correções vieram de olhar a tela, não do código: **(1)** o palco quase quadrado num aparelho de 844pt amplia pela altura e mostra 47% da largura — virou um túnel de fitas sem figura dentro; **(2)** as camadas eram `Svg` em fluxo normal e **empilhavam na vertical**, com o campo na metade de cima e a touca em cima da copy; **(3)** fitas simétricas para os dois lados leem **casulo**, não cabelo — cabelo comprido cai para um lado; **(4)** sem a touca, dezenove raízes convergem num bico; **(5)** ids de `defs` repetidos em sete `Svg`: no nativo são escopados, **na web não são**, e o desenho só estava certo porque as cópias eram idênticas. | agente (§0.2) |
