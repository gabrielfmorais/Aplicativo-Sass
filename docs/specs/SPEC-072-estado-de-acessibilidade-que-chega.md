# SPEC-072 — O estado de acessibilidade que chega à plataforma

- **Status:** DONE
- **Bounded context:** Design System (`apps/mobile/src/design`) — transversal
- **Origem:** **SPEC-051 OQ4**, aberta em 2026-09-09 e deixada explicitamente sem correção.
- **Gate:** ⛔ nenhum. Zero migration, zero backend, zero dependência, zero conteúdo capilar.

---

## 1. Problem — o que a SPEC-051 mediu e registrou

Ao validar as marcações do check-in a 390px, a SPEC-051 mediu uma coisa que não era sobre o produto:

> `aria-checked` **não existe no preview web** — medido, **zero** elementos na página inteira,
> inclusive os chips `radio` já validados na SPEC-042/SPEC-048 —, porque o `react-native-web` 0.21
> descarta o `accessibilityState` legado que o `Chip` usa.

E tirou a consequência certa:

> **Consequência para toda validação futura: a 390px o estado de um chip não se afere por ARIA** —
> afere-se pelo canal que ela vê, o rótulo em ameixa.

⚠️ **Isso é uma perda de INSTRUMENTO, não um defeito de produto.** No iOS e no Android o
`accessibilityState` é a API suportada e o leitor de tela recebe o estado. Mas o projeto inteiro
valida no preview web (D-80/D-90), e ali o estado deixou de ser observável — então **nenhuma
asserção de acessibilidade pode ser feita a 390px**, e a SPEC-051 teve de conferir seleção pela cor.

**Por que ficou sem correção:** a SPEC-051 recusou o conserto parcial, e a recusa estava certa —

> ⛔ **Não corrigido de propósito:** são **nove** usos de `accessibilityState` (inclusive a `TabBar`
> da SPEC-035), consertar só o `Chip` deixaria o app inconsistente, e o alvo seria o ambiente de
> validação e não o produto.

⚠️ **Esta SPEC remove as duas objeções de uma vez:** corrige **todos** os usos, e a correção **não
é sobre o ambiente de validação** — é a API moderna da própria plataforma.

## 1.1 A medição que destrava

Medido no `node_modules` desta máquina, não assumido:

- **`react-native` 0.86.2** — o `Pressable` aceita `aria-busy`, `aria-checked`, `aria-disabled`,
  `aria-expanded` e `aria-selected`, e os funde no mesmo estado nativo:
  `checked: ariaChecked ?? accessibilityState?.checked`. ⚠️ **Semântica nativa idêntica** — não é
  uma API paralela, é a mesma coisa por um nome novo, com o legado como fallback.
- **`react-native-web` 0.21** — `aria-*` está em `forwardedProps`/`createDOMProps`, então **chega ao
  DOM**.

**Logo:** trocar o legado pelo moderno **não muda nada no iPhone** e **devolve a medição no web**.

## 2. Goals

1. O estado de acessibilidade dos controles chega à plataforma nas **três** (iOS, Android, web).
2. A validação a 390px volta a poder **afirmar** estado por ARIA, em vez de inferir por cor.
3. A regra vira **guardrail executável**, porque a ausência de um atributo é invisível em teste de
   render e no olho.

## 3. Non-Goals

- ⛔ **Nenhuma mudança visual.** Nenhum token, nenhuma cor, nenhum espaçamento, nenhum rótulo.
- ⛔ **Nenhuma mudança de comportamento.** Nenhum controle passa a fazer algo diferente.
- ⛔ **Nenhum papel (`accessibilityRole`) muda** — `radio`, `checkbox`, `tab` e `button` ficam como
  estão; esta SPEC troca **como o estado é declarado**, nunca o que o controle é.
- ⛔ **Não é uma auditoria de acessibilidade.** Rótulos ausentes, ordem de foco, contraste e Dynamic
  Type não entram: são frentes próprias, e uma delas (Dynamic Type, SPEC-060 OQ3) só se valida em
  iPhone real (G7).

## 4. Functional Requirements

- **FR1** — Todo estado de acessibilidade é declarado por `aria-*` nos componentes que o emitem.
- **FR2** — O `Button` continua sendo **quem traduz**: ele recebe o estado a anunciar e emite
  `aria-*`. A prop chama-se **`a11y={{ expanded, busy }}`**.

  ⚠️ **Esta FR foi CORRIGIDA durante a implementação, e o motivo é a FR4.** A primeira versão dizia
  *"o `Button` continua com a mesma API pública (`accessibilityState`)"*, argumentando que renomear
  faria cinco telas mudarem sem ganho. **O ganho apareceu ao escrever o guardrail:** com o nome legado
  também na API do design system, a regra não conseguia distinguir *"passou a prop do `Button`"*
  (correto) de *"pôs o legado num `Pressable` cru"* (defeito) sem interpretar o JSX. Um nome próprio
  torna a regra **exata**, e uma regra exata é o que impede a próxima ocorrência.
- **FR3** — `Chip` emite `aria-checked` e `aria-disabled`; `TabBar` emite `aria-selected`.
- **FR4** — `pnpm check:a11y-state` falha se `accessibilityState` aparecer **fora** de
  `apps/mobile/src/design/` — o legado passa a ser privilégio das primitivas, que é onde ele é
  traduzido.

## 5. Business Rules

- **BR1 — o legado não é removido, é encapsulado.** O `Pressable` do RN funde
  `aria-X ?? accessibilityState?.X`: manter o legado onde o moderno já está seria ruído, mas o
  `Button` **recebe** o legado como API própria e o converte. Quem chama não precisa saber.
- **BR2 — `aria-disabled` acompanha `disabled`, não o substitui.** O `disabled` do `Pressable`
  continua sendo o que **recusa o toque**; o `aria-disabled` é o que **anuncia**. Trocar um pelo
  outro transformaria um controle recusado num controle que só parece recusado.
- **BR3 — nada é declarado a mais.** Um `aria-*` com valor `undefined` não vira atributo, e inventar
  estado onde o controle não tem nenhum é a forma de acessibilidade que mente para o leitor de tela.

## 6. Data Model / API / Authorization / Privacy

**Nada.** Nenhuma tabela, coluna, RPC, policy, rede ou dado dela é tocado.

## 7. Edge Cases

- **EC1** — controle sem estado (um `Button` comum): nenhum `aria-*` de estado é emitido além de
  `aria-disabled`/`aria-busy`, que ele já computa.
- **EC2** — `Chip` desabilitado e selecionado ao mesmo tempo: os dois atributos saem, independentes.
- **EC3** — plataforma nativa: o valor chega por `accessibilityState` depois da fusão do RN, **como
  antes** — é o mesmo caminho, e por isso nada regride no iPhone.

## 8. Acceptance Criteria

- **AC1** — a 390px no DEV real, os chips do check-in expõem `aria-checked` com o valor certo, e a
  aba ativa expõe `aria-selected`.
- **AC2** — nenhum `accessibilityState` fora do design system (guardrail).
- **AC3** — `pnpm verify` verde; nenhuma mudança visual.
- **AC4** — o guardrail é **verificado contra o defeito**: repondo um `accessibilityState` numa tela,
  ele falha e **nomeia o arquivo**.

## 8.1 O que a implementação achou

⚠️ **O `tsc` pegou um erro meu, e vale registrar por quê.** Ao renomear a prop do `Button`, a
substituição em massa acertou também dois `Pressable` **crus** (`CareGuideLibrary` e a lista de
avatares do `ProfileIdentity`), que não têm essa prop. **O compilador nomeou os dois** — é a barreira
certa para esta classe de erro, e é por isso que o guardrail estático olha só o que o tipo não vê.

⚠️ **E a prova de que o nativo não regride veio de MEDIR o nó renderizado, não de ler a documentação.**
Com `aria-expanded`, o nó do `Pressable` sai com
`accessibilityState: {busy: false, disabled: false, expanded: true}` — **exatamente** o que saía
antes. É a fusão `expanded: ariaExpanded ?? accessibilityState?.expanded` do RN 0.86 acontecendo, e
está fixada em teste.

## 8.2 Evidência — medido a 390px no DEV real (2026-09-11)

Navegador real a 390×844 por `Emulation.setDeviceMetricsOverride` via CDP.

⭐ **O número que fecha a OQ4 da SPEC-051.** Ela mediu **zero** `aria-checked` na página inteira.
Depois desta SPEC, na mesma tela autenticada:

| atributo | antes (SPEC-051) | agora |
|---|---|---|
| `aria-checked` | **0** | **24** |
| `aria-selected` | — | **11** |
| `aria-expanded` | — | **12** |
| `aria-disabled` | — | **0** |

⚠️ **`aria-disabled` em zero é o resultado CERTO, não uma falta** (BR3): nada estava recusando toque
naquela tela, e declarar o atributo mesmo assim seria acessibilidade que mente para o leitor de tela.

**Estado que muda, e é observável:** a aba ativa sai `Hoje=true` com as outras três em `false`, e
trocar para Cuidados vira `Cuidados=true` com `Hoje=false`. O dia escolhido na faixa da semana sai
com `aria-selected=true`. Um chip do cartão foi alternado e o atributo acompanhou:
**`true → false → true`**.

**Console limpo:** zero erro e zero exceção; sobram as deprecações do `react-native-web`
(`shadow*`, `pointerEvents`, `useNativeDriver`) que já existiam. Sem transbordo horizontal, e
**nenhuma mudança visual** — a tela é a mesma.

### ⚠️ Um dado do DEV foi destruído nesta validação, e restaurado

Alternar o chip *"Finalizei"* para medir o atributo **apagou a técnica de finalização daquele
cuidado**: sair de `done` limpa `finish_technique` na mesma escrita, e isso é **projeto**, não
defeito (SPEC-048). Voltar a `done` restaura a etapa, **não** a técnica — são escritas diferentes.
Medido: `fitagem_tradicional` sumiu das 7 linhas, e foi **reposta** pela mesma porta da usuária (sob
RLS, restaurando um fato que era dela). Conferido depois, no banco e na tela: *"Fitagem tradicional ·
1 vez · última em ter, 08/09"*.

⛔ **Lição operacional:** medir um atributo **alternando** um controle destrutivo custa o dado. Onde o
estado já está no valor que se quer observar, **observa-se sem tocar**; só um controle cuja alternância
é reversível pode ser usado para provar a virada.

## 9. O que só se prova em iPhone nativo (G7)

Que o VoiceOver anuncia o estado. O que esta SPEC prova é que o **atributo chega** — no web por
medição direta, no nativo pela fusão do próprio RN, que é código dele e não suposição minha.

## 10. Change Log

- 2026-09-11 — criada para fechar a **OQ4 da SPEC-051**, depois de medir o suporte a `aria-*` em
  `react-native` 0.86.2 e `react-native-web` 0.21.
