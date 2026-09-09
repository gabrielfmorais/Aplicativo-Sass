# ADR-012 — Navegação: pilha nativa dirigida por estado, e **não** migração para rotas do router

| Campo | Valor |
|---|---|
| Status | Accepted (2026-09-09) |
| Contexto | SPEC-060 OQ1 → SPEC-061 |
| Relacionadas | ADR-001 (camadas), ADR-006 (fronteiras), SPEC-026/027/035 (a casca e a barra) |

## Contexto

A SPEC-060 mediu que **o gesto de voltar arrastando da borda não existe** no app. É a interação mais
automática que existe num iPhone: quem usa iOS arrasta antes de procurar um botão, e quando nada
acontece a leitura não é *"este app não tem esse gesto"*, é *"este app travou"*.

A causa é estrutural. O app navega por **estado**: um enum de oito destinos
(`hairEvents · you · journey · share · insights · shelfUsage · finishes · dataSources`) num
`useState`, mais o Wash Day e os modos de reavaliação em estados próprios. O `expo-router` está
montado com **uma rota só**, então o iOS não tem nada que reconheça como pilha.

⛔ **Não existe meio-termo:** o gesto de borda do iOS é interrompível, seguro o dedo, e acompanha a
transição. Reimplementá-lo à mão exigiria `react-native-gesture-handler` e ainda assim produziria uma
imitação que não se comporta como a de verdade. **Ou é pilha nativa, ou não é.**

## O que a investigação corrigiu do rascunho da SPEC-061

⚠️ **O rascunho apontou o bloqueio no lugar errado.** Ele dizia que *"as portas são montadas no topo
de `app/index.tsx` e passadas por prop, e uma rota montada pelo router não herda isso"*.

**Medido: é falso.** As portas são montadas em `apps/mobile/src/bootstrap/auth.tsx` e já são expostas
por **contexto** (`AuthContext` / `useAuth()`), alcançável de qualquer ponto da árvore. O
`app/index.tsx` apenas **lê** `useAuth()` e repassa. Ou seja, o obstáculo arquitetural que justificava
o ADR **não existia**.

⚠️ **O obstáculo real é outro, e é maior:** o **estado carregado** — `board`, `profile`, `prefs`,
entitlements concedidos, contagem de produtos, nome, avatar, e os derivados `journey`, `insights`,
`shelfUsage`, `oilRoutine`, `celebration` — mora como estado de componente em `AuthenticatedApp` e
desce por prop. Uma rota empilhada pelo router é **irmã**, não filha: não veria nada disso.

Sair disso por rotas obrigaria a **subir todo o estado carregado para um provider no layout**. É
possível, mas paga-se caro:

- ⚠️ **`app/index.tsx` tem 884 linhas e ZERO cobertura de teste** — medido: nenhuma das 54 suítes o
  importa. Reestruturar o núcleo de navegação sem rede de segurança é exatamente a forma de defeito
  que este projeto já mediu três vezes.
- A barra de abas **fica visível sob as telas empilhadas** por decisão de produto registrada
  (SPEC-026/027: *"sair de uma tela nunca deve exigir encontrar o botão certo antes"*). Preservar
  isso com rotas exige a barra no layout e o estado da aba no provider — mais superfície ainda.

## Decisão

**A camada empilhada vira uma pilha NATIVA dirigida pelo estado que já existe**, usando
`ScreenStack` / `ScreenStackItem` do `react-native-screens` — **que já é dependência** (o
`expo-router` depende dele). ⛔ **Não migramos para rotas do `expo-router`.**

Concretamente:

1. Um componente de apresentação em `apps/mobile/src/design/` recebe as camadas (raiz + a empilhada,
   quando houver) e as monta numa pilha nativa, com `onDismissed` devolvendo o estado ao fechar.
2. A pilha fica **dentro** da casca, **acima** da `TabBar` — então a barra **não desliza** com a
   transição, que é como as pilhas do próprio iOS se comportam sob uma tab bar.
3. O estado de navegação (`stacked`, `washDay`, `reassessing`) **não muda de lugar**. O `onDismissed`
   é a única ligação nova: o gesto vira a mesma mudança de estado que o botão "Voltar" já fazia.
4. **Web tem build própria** (`.web.tsx`), que renderiza **só a camada do topo** — exatamente o
   comportamento de hoje.

## Por que esta e não a migração para rotas

| | Pilha nativa dirigida por estado | Migração para rotas |
|---|---|---|
| Gesto de borda no iOS | ✅ nativo | ✅ nativo |
| Botão físico do Android | ✅ passa a fechar a empilhada | ✅ |
| Onde mora o estado carregado | **não muda** | precisa subir para provider no layout |
| Barra de abas fixa sob a transição | ✅ de graça (pilha dentro da casca) | exige barra no layout + aba no provider |
| Raio de alteração | seção de render de um arquivo | a casca inteira, 9 arquivos de rota, todo o estado |
| Rede de segurança | o estado e os props de cada tela **não mudam** | núcleo sem teste sendo reescrito |
| Dependência nova | nenhuma | nenhuma |

⚠️ **A migração para rotas não está errada — está cara e sem rede.** Ela entregaria o mesmo gesto ao
custo de reescrever o núcleo não testado do app. Quando houver deep linking, restauração de estado ou
URL como requisito, a conversa muda; hoje **não há nenhum desses requisitos**, e o §5 da CLAUDE.md
manda perguntar qual é a menor mudança segura.

## Consequências

- ✅ O gesto do iPhone passa a existir, com a transição e o cancelamento nativos.
- ✅ O Android ganha o botão físico de voltar fechando a empilhada — hoje **não há `BackHandler`
  nenhum no app** (medido), então lá o botão saía do app.
- ✅ Nenhuma tela muda de contrato: os props de cada uma continuam idênticos, e as 54 suítes seguem
  valendo.
- ⚠️ **Continua não havendo URL, deep link nem restauração de estado.** Não é regressão (não existem
  hoje), mas é o que esta decisão adia — e é o gatilho que a reabre.
- ⚠️ **O gesto não é observável no preview web.** A build web renderiza só a camada do topo, como
  hoje; o gesto e a animação só existem em build nativo (G7). O que o 390px prova é ausência de
  regressão.
- A `expo-router` continua montada com uma rota, agora **por decisão registrada** e não por acaso.

## Gatilhos para revisitar

Qualquer um destes reabre a migração para rotas: **deep linking** (notificação que abre uma tela
específica, link compartilhado), **restauração de estado** entre execuções, **URL** como requisito de
produto, ou a camada empilhada passando de ~10 destinos com parâmetros ricos.
