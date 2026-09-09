# UI Intelligence — a direção visual permanente da Huna

| Campo | Valor |
|---|---|
| Status | **Vigente** desde 2026-09-09 (decisão do dono) |
| Escopo | Toda decisão de apresentação do app: layout, hierarquia, estado, ritmo, motion, ícone, densidade |
| Relacionados | SPEC-016 (design system), SPEC-026/027/035/055 (rodadas visuais), SPEC-060/061 (iPhone-first), ADR-001, ADR-012 |

## 1. Para que esta camada existe

Até aqui, cada rodada visual da Huna nasceu de uma observação do dono e morreu na SPEC que a
resolveu. Funcionou — a SPEC-035 mediu contraste em vez de opinar, a SPEC-055 contou variantes em vez
de adivinhar —, mas o **critério** ficava espalhado por seis documentos e uma dúzia de comentários.

Esta camada é o critério, num lugar só. Ela não desenha nada: ela diz **como decidir** quando a
próxima tela precisar de uma decisão visual, e **de onde puxar referência** sem virar outro produto.

⚠️ **Ela não é um design system.** O design system da Huna é um só e mora em
`apps/mobile/src/design/` — `tokens.ts` e `primitives.tsx`. Este documento é a **direção** que
governa o que entra lá.

## 2. A cadeia de decisão

Toda decisão de apresentação atravessa esta ordem, e **para na primeira que responde**:

```
Huna Design System  →  Apple HIG  →  acessibilidade iOS  →  referência externa
                                                                   ↓
                                                    adaptação original React Native
                                                                   ↓
                                                       validação iPhone-first
```

1. **Huna Design System primeiro.** Se `tokens.ts` ou `primitives.tsx` já respondem, a resposta é
   essa. Uma segunda forma de dizer a mesma coisa é dívida, não escolha.
2. **Apple HIG depois.** É a plataforma principal (decisão do dono, 2026-09-08). Onde a HIG tem
   convenção — piso de toque, semântica de push × sheet, comportamento de gesto, ordem de leitura —
   ela vence preferência pessoal.
3. **Acessibilidade iOS junto**, nunca depois: contraste medido, alvo de 44pt, papel e rótulo,
   redução de movimento, Dynamic Type.
4. **Referência externa por último**, e só para o que as três primeiras não respondem: ritmo,
   densidade, vocabulário de estado, forma de motion.
5. **Adaptação original**, sempre. Nunca transporte.
6. **Validação iPhone-first**, e o que não der para validar fica **escrito como não validado**.

## 3. As fontes, e como cada uma é usada

⚠️ **Cada fonte responde a UMA pergunta.** Usar uma fonte fora da pergunta dela é como o produto
começa a parecer outro produto.

| Fonte | Responde | ⛔ Não responde |
|---|---|---|
| **Apple HIG** | comportamento de plataforma: navegação, gesto, sheet × push, piso de toque, ordem de leitura, o que o sistema já promete ao usuário | estética, cor, personalidade, tipografia da marca |
| **Phosphor Icons** | **convenção de ícone**: peso de traço, terminação, grade, o que sobrevive a 22px | os glifos em si — ⛔ **não é instalado** |
| **Shadcn** | **estrutura de componente**: a forma da API (variante + tamanho + estado), composição, onde mora o estado | visual, cor, sombra, código — é web |
| **21st.dev** | **ritmo e interação**: densidade, hierarquia dentro de um cartão, como um estado se anuncia | layout literal, medidas, componentes |
| **Animista** | **vocabulário de motion**: que curva, que duração, que tipo de entrada serve a que intenção | animar por animar |

### 3.1 Phosphor: referência, nunca dependência

⛔ **Os ícones da Huna são desenhados no repositório** (`apps/mobile/src/design/icons.tsx`), e a
SPEC-035 explica por quê: *"uma biblioteca traz mil glifos para usar quatro, e nenhum deles nasce
parecido com a Huna"*. Isso não muda.

O que o Phosphor dá é **régua**: peso de traço consistente, terminação arredondada, grade de 24,
massa óptica equivalente entre irmãos. São exatamente as regras que a SPEC-035 já enuncia — o
Phosphor é a confirmação de que elas são as regras certas, não a origem dos desenhos.

### 3.2 Shadcn: estrutura, não pixels

O valor do Shadcn aqui é **a forma da API**, que a Huna já usa sem ter nomeado:
`<Button variant size state />` em vez de dez componentes quase iguais. Quando uma primitiva precisar
crescer, ela cresce **por estado e variante**, não por um irmão novo.

⛔ **Nada de código.** É React DOM sobre Tailwind: classes, pseudo-seletores, cascata — três coisas
que não existem em React Native.

### 3.3 21st.dev: ritmo, não layout

Serve para responder *"por que este cartão parece caro e o meu não?"*. Quase sempre a resposta é
**ritmo**: menos coisas, mais respiro entre grupos, uma hierarquia clara em vez de três competindo.

⛔ **Não serve para copiar uma tela.** Uma tela boa de um produto que não é a Huna resolve um
problema que não é o da Huna.

### 3.4 Animista: intenção, não catálogo

Serve para escolher **a curva e a duração** que combinam com a intenção (entrar, revelar, confirmar).
A Huna já tem `REVEAL_MS = 260` e `CHIP_POP = 1.06`; o Animista ajuda a decidir o próximo, não a
trocar os que existem.

⚠️ **Toda animação obedece à redução de movimento, e o estado inicial do hook é `null`, não
`false`** — a lição já paga na SPEC-018: um `false` otimista faz a animação **começar** antes de a
preferência chegar, e isso não tem como ser desfeito.

## 4. Como uma referência web vira React Native

⚠️ **A tradução é o trabalho.** Copiar é o que produz app com cara de site.

| Na web | Na Huna |
|---|---|
| `:hover` como canal de estado | ⛔ não existe. Estado se diz por **cor, peso, borda ou forma** — nunca por algo que precise de cursor |
| `:focus-visible`, `outline` | papel + rótulo + `accessibilityState`; o foco é do leitor de tela |
| Sombra em tudo | `elevation.card`, e só onde a superfície precisa **subir** |
| Grid/flex com `gap` em CSS | `Stack`/`Row` com `space.*` — ⛔ número solto em tela de produto é bug (SPEC-016 FR2) |
| `rem`, media query | um `CONTENT_MAX_WIDTH` e uma largura de telefone; o alvo é 390px |
| Ícone de biblioteca | desenho próprio, grade de 24, massa óptica igual |
| Transição CSS | `Animated` com `useNativeDriver`, atrás de `useReduceMotion()` |
| Área clicável do texto | **44pt de piso**, medido por teste (SPEC-060 fatia 2) |

## 5. Os inegociáveis

1. **Um design system.** `tokens.ts` + `primitives.tsx`. ⛔ Não existe segundo lugar para cor,
   espaçamento, raio, tipo ou sombra.
2. **Primitiva sem consumidor real é bug** (SPEC-016 AC3). A direção não autoriza construir
   componente para o futuro.
3. **A identidade é da Huna.** Base osso, ameixa, grafite quente, cor semântica por tipo de cuidado.
   Uma referência que exija abrir mão disso está sendo usada errada.
4. **Contraste é número, não gosto.** A SPEC-035 mediu 1,03:1 numa pastilha que "existia" — o canal
   estava no código e não na tela.
5. **Nunca infantilizar, nunca template.** Sofisticado, feminino, moderno. Sem emoji decorativo, sem
   ilustração fofa, sem cantos redondos demais.
6. 🔒 **A restrição do hero vale em toda arte** (SPEC-036): abstrato, sem personagem, rosto, cabeça,
   corpo ou silhueta.
7. ⛔ **Apresentação nunca atravessa D-26/D-70.** Redesenhar como um conteúdo capilar aparece é
   livre; mudar **o que ele afirma** exige sign-off. Um bloco de destaque não pode transformar um
   passo em promessa de resultado.
8. **iPhone-first**, com o limite dito: o preview a 390px prova layout e fluxo, ⛔ **não** prova
   gesto, teclado do sistema, área segura real, haptics nem motion nativo — isso é build nativo (G7),
   e o que não for validado fica **escrito como não validado**.

## 6. Como isto se aplica na prática

Toda rodada visual segue o método que as SPECs anteriores pagaram caro para descobrir:

1. **Medir antes de opinar.** Contar ocorrências no repositório, medir contraste, olhar a tela real —
   a SPEC-055 abriu contando variantes, e foi a contagem que achou o problema.
2. **Julgar depois de pronto, fora do app.** A SPEC-036 e a SPEC-042 fixaram isso depois de quatro
   direções reprovadas: renderizar em vários tamanhos e **olhar**.
3. **Validar a 390px no DEV real**, com o console limpo, e registrar o que ficou de fora.
4. **Barreira de teste no que não pode voltar** — contraste, piso de toque, linguagem.

## 7. O primeiro piloto

**"Como fazer"** foi escolhido pelo dono como a primeira área a atravessar esta camada inteira. O
registro do que mudou, e por quê, fica na SPEC dela.
