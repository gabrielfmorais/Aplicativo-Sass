# O hero da Huna — contrato de integração do asset autoral

**Status:** aguardando o asset. O `HunaFigure` que está no código é **placeholder técnico**, não
design final (decisão do dono, 2026-09-02).

Este documento existe para que a troca do placeholder pelo asset real seja **integração**, e não
retrabalho. Ele diz duas coisas: o que o app garante ao asset, e o que o asset precisa entregar.

---

## 1. Onde o asset entra

Há **um** ponto de troca: `apps/mobile/src/design/HunaFigure.tsx`.

Quatro telas o consomem, e nenhuma sabe como ele é desenhado:

| Tela | Uso |
|---|---|
| `features/auth/WelcomeScreen` | `frame="portrait"`, cobrindo a viewport, atrás do conteúdo |
| `features/auth/SignInScreen` | `frame="band"`, faixa de ~96pt |
| `features/onboarding/OnboardingScreen` | `frame="band"`, nos interlúdios |
| `design/Moment` | `frame="band"`, na espera antes do cronograma |

⚠️ **Nenhuma delas muda quando o asset chegar.** O contrato público é só isto:

```tsx
<HunaFigure frame="portrait" | "band" style={…} />
```

O que o componente garante, e que o asset **herda de graça**: decorativo para leitor de tela ·
`pointerEvents="none"` · redução de movimento respeitada · dissolução no canvas · os dois
enquadramentos.

**O que se troca por dentro:** as constantes de desenho (`PROFILE`, `CAP`, `SHEEN`, `RIBBONS`) e o
corpo do `return`. O palco — enquadramento, máscara, driver de animação, hooks — fica.

---

## 2. O que o app garante ao asset

- **Enquadramento duplo.** O mesmo asset é usado num painel alto (abertura) e numa faixa baixa
  (login, interlúdios). O componente já recorta os dois; o asset só precisa **prever** que a faixa
  mostra a região da cabeça.
- **Dissolução, não corte.** Uma máscara em gradiente apaga o pé da composição para o creme
  (`#FBF8F5`). O asset **não** precisa trazer borda, canto arredondado nem fade próprio.
- **Redução de movimento.** Se a preferência estiver ativa, nada se move — e nada anima antes de a
  preferência ser **conhecida**. Isso é do componente, não do asset.
- **Escala.** O app roda de 320pt a tablets. O asset é dimensionado por proporção, nunca por pixel.

---

## 3. O que o asset precisa entregar

### 3.1 Composição

- Figura **de perfil**, ocupando a **direita** do quadro.
- O canto **superior esquerdo** é área reservada do wordmark: aproximadamente os **56% de largura ×
  30% de altura** iniciais precisam ser fundo (escuro ou vazio), sem detalhe que o texto branco
  tenha de disputar.
- O **terço inferior** deve ser cabelo/fundo — é ali que a máscara dissolve. Nada de rosto, mão ou
  detalhe importante abaixo de ~65% da altura.
- Proporção de referência: **360 × 780** (≈ 1:2,17). Sangria de 5% em cada lado é bem-vinda: o
  recorte varia com o aparelho.

### 3.2 Camadas (o que faz o movimento ser possível)

Entregar **em camadas separadas**, não achatado. O mínimo que o movimento atual usa:

1. fundo / campo de cor
2. cabelo **atrás** da figura
3. figura (rosto e corpo)
4. cabelo **do meio**
5. cabelo **da frente**, passando por cima do corpo
6. fios finos / mechas soltas
7. couro cabeludo / touca (por cima, escondendo as raízes)

Cada camada balança com período e **atraso** próprios — é o atraso entre elas que faz o cabelo
parecer vivo em vez de uma imagem girando inteira. Um asset achatado só pode se mover inteiro, e aí
o movimento fica errado.

### 3.3 Formatos

| Formato | Integra sem dependência? | Observação |
|---|---|---|
| **SVG** (camadas nomeadas) | ✅ | O caminho mais direto: `react-native-svg` já está no projeto e suporta máscara, gradiente e filtro. Preferido. |
| **PNG / WebP** (uma imagem por camada, transparente, @2x e @3x) | ✅ | Funciona com `Image`. Custa peso no bundle e não escala tão bem quanto vetor. |
| **Lottie** | ⚠️ | Traz `lottie-react-native` (dependência nativa). Precisa passar na validação a 390px do preview web antes de ser aceito (D-101). |
| **Rive** | ⚠️ | Mesma ressalva, e o runtime é nativo. |

⚠️ **Se o asset vier em Lottie ou Rive, a animação vem com ele** e o driver de movimento do
componente sai. As outras garantias (enquadramento, dissolução, redução de movimento, a11y) ficam.

### 3.4 Conteúdo

- **Sem detalhe facial**: sem olho, sem boca, sem sobrancelha. Além de ser a direção estética, é o
  que mantém a figura fora de "esta pessoa não se parece comigo".
- **Sem textura capilar declarada**: nem liso escorrido, nem cacho definido. O produto atende liso,
  ondulado, cacheado e crespo, e a primeira tela não pode excluir nenhuma delas.
- **Paleta**: vinho, ameixa, berry, roxo, lilás, com brilhos perolados — os tokens vivem em
  `apps/mobile/src/design/tokens.ts`.

### 3.5 Performance

- Alvo: **60fps** num aparelho intermediário. Sete camadas animadas é o limite atual.
- SVG: manter a contagem de caminhos na casa das dezenas, não das centenas.
- Raster: somar menos de ~1,5 MB para o conjunto completo, já comprimido.

---

## 4. Aceite

A pergunta de aceite é **do dono**, e nenhum teste responde por ela:

> *"Isso parece uma identidade visual premium e memorável para a Huna?"*

Renderizar, passar nos testes e ter movimento **não** aprovam o hero. O que o time garante é o resto:
integração, responsividade, composição, animação, performance, redução de movimento e validação real
a 390px.
