# SPEC-061 — Navegação real e o gesto de voltar do iPhone

| Campo | Valor |
|---|---|
| ID | SPEC-061 |
| Status | **IMPLEMENTED** (2026-09-09) — o ADR saiu ([ADR-012](../adr/ADR-012-navigation-architecture.md)) e a decisão foi **outra** que a do rascunho (§5) |
| Owner | (humano) |
| Bounded Context | — (transversal de apresentação / casca do app) |
| Related ADRs | ADR-001 (camadas) · **[ADR-012](../adr/ADR-012-navigation-architecture.md)** (esta decisão) |
| Related SPECs | SPEC-060 (OQ1, que originou esta) · SPEC-026/027/035 (casca e abas) · SPEC-044/045 (a tela de compartilhar e seus parâmetros) |
| Fase do roadmap | Fundação de plataforma — pós SPEC-060 |
| Criado / Atualizado | 2026-09-08 / 2026-09-08 |

## 1. Context

A SPEC-060 estabeleceu que a Huna é **iPhone-first** e corrigiu o que era corrigível sem tocar na
estrutura. Sobrou a lacuna que ela registrou como OQ1, e que é a maior das que restam: **o gesto de
voltar arrastando da borda esquerda não existe no app**.

Não é um bug: é uma consequência do desenho. O app **não navega por rotas** — navega por **estado**.

## 2. Problem

Medido em `apps/mobile/src/app/index.tsx`:

- há **um enum de oito destinos** (`hairEvents`, `you`, `journey`, `share`, `insights`, `shelfUsage`,
  `finishes`, `dataSources`) num único `useState`, mais o Wash Day e os modos de reavaliação em
  estados próprios;
- a pilha de dois níveis existe **à mão**: `dataSources` volta para `you` porque alguém escreveu
  `setStacked('you')` no `onBack` daquela tela, e não porque haja uma pilha;
- `share` carrega um **parâmetro rico** (`{ careLabel, washDay }` ou `'journey' | 'progress'`) num
  segundo `useState` paralelo ao destino.

O `expo-router` está montado, mas com **uma rota só**. Do ponto de vista do iOS, o app inteiro é uma
tela: **não há o que reconhecer** quando o polegar arrasta da borda. Toda volta depende de encontrar
e acertar um botão.

⚠️ **É a interação mais automática que existe num iPhone.** Um usuário de iOS volta arrastando antes
de procurar um botão — e quando nada acontece, a leitura não é *"este app não tem esse gesto"*, é
*"este app travou"*.

## 3. Goals

- G1 — Arrastar da borda esquerda volta, em todo destino empilhado.
- G2 — A pilha é real: `Prateleira → Você → Fontes de dados` volta um passo por vez, sem ninguém
  escrever para onde voltar.
- G3 — As quatro abas continuam sendo abas: trocar de aba **não** empilha, e o gesto não desfaz uma
  troca de aba.
- G4 — Nenhuma capability, tela, texto ou regra muda. É a mesma experiência com uma casca de
  verdade por baixo.

## 4. Non-Goals

- NG1 — Não transformar destino nenhum em **sheet/modal**, por mais que alguns peçam no iOS. É outra
  decisão de produto e outra fatia.
- NG2 — Não mexer em nenhuma regra de domínio, porta, adapter ou consulta.
- NG3 — Não introduzir `react-native-gesture-handler` nem biblioteca de navegação nova: o gesto vem
  do `Stack` nativo que o `expo-router` já traz.
- NG4 — Não mudar a barra de abas nem quais são as quatro (SPEC-027, decisão do dono).

## 5. ⚠️ A investigação derrubou a premissa do rascunho

**O rascunho apontou o bloqueio no lugar errado.** Ele dizia que *"as portas são montadas no topo de
`app/index.tsx` e passadas por prop, e uma rota montada pelo router não herda isso"*.

**Medido: falso.** As portas são montadas em `apps/mobile/src/bootstrap/auth.tsx` e já são expostas
por **contexto** (`AuthContext` / `useAuth()`), alcançável de qualquer ponto da árvore. O
`app/index.tsx` apenas **lê** `useAuth()` e repassa. O obstáculo que justificava o ADR **não
existia**.

⚠️ **O obstáculo real é outro:** o **estado carregado** — board, perfil, prefs, entitlements, jornada,
insights, prateleira — mora como estado de componente em `AuthenticatedApp` e desce por prop. Uma
rota empilhada pelo router é **irmã**, não filha: não veria nada disso. Sair por rotas obrigaria a
subir todo esse estado para um provider no layout.

⛔ **E aí entra o número que decidiu:** `app/index.tsx` tem 884 linhas e **zero cobertura de teste**
— medido, nenhuma das 54 suítes o importava. Reescrever o núcleo de navegação sem rede de segurança é
exatamente a forma de defeito que este projeto já mediu três vezes.

**A decisão está no [ADR-012](../adr/ADR-012-navigation-architecture.md): pilha NATIVA dirigida pelo
estado que já existe**, com `ScreenStack`/`ScreenStackItem` do `react-native-screens` (já
dependência, o `expo-router` depende dele). Mesmo gesto, sem mover estado nenhum, e cada tela mantém
exatamente os props que já tinha.

## 6. O que foi entregue

- `apps/mobile/src/design/NativeStack.tsx` — a pilha, **dentro da casca e ACIMA da `TabBar`**, para a
  barra **não deslizar** com a transição (é como as pilhas do próprio iOS se comportam sob uma tab
  bar, e é o que preserva a decisão da SPEC-026/027 de a barra continuar visível).
- `NativeStack.web.tsx` — **degradação honesta**: no web o `ScreenStack` é literalmente um `View`, e
  as camadas apareceriam **todas ao mesmo tempo**; a build web mostra só o topo, que é exatamente o
  comportamento anterior. O preview a 390px não regride (D-101).
- `apps/mobile/src/app/stacked-path.ts` — o caminho como **dado puro**. ⚠️ A pilha de dois níveis
  vivia **à mão**: `dataSources` voltava para `you` porque alguém escreveu `setStacked('you')` no
  `onBack` **daquela tela**. Agora voltar é `pop`, e **o gesto e o botão chamam a mesma função** —
  não há um segundo caminho de saída que possa divergir do primeiro.
- Exaustividade no despacho: faltar um ramo para uma `StackedKey` nova é **erro de compilação**, e não
  uma camada em branco. **Verificado contra o defeito:** com um destino sem ramo, o `tsc` falha e
  **nomeia a chave**.

⛔ **Fora, e por princípio:** `washDay` e a reavaliação são **fluxos de tela cheia** que cobrem a
barra. No iOS essa classe se fecha por ação explícita — arrasto de borda é para *push*, não para
apresentação de tela cheia —, então continuam com a saída que já tinham.

## 7. O nó original do rascunho (mantido como registro)

### 7.1 O nó como o rascunho o via

Todas as portas e todo o estado de leitura são montados **no topo** de `app/index.tsx` e passados
como props para cada tela. Rotas separadas não podem herdar isso por prop: cada rota é montada pelo
router, não por um pai que já tem tudo na mão.

Ou seja, a mudança não é "trocar `useState` por rota" — é decidir **como uma tela alcança suas
portas** quando o router a monta. Isso é decisão de arquitetura (ADR-001 diz que a tela recebe suas
portas; não diz por onde), e **ADR-001 não responde**. Por CLAUDE.md §1.4, *mudança arquitetural sem
ADR = não fazer*.

Duas saídas plausíveis, e a escolha é do ADR:

1. **Um provider de composição** na raiz, que já monta as portas e o estado de leitura, e um hook por
   contexto. Preserva ADR-001 (a tela continua sem conhecer `@supabase/*`) e é a menor mudança.
2. **Composição por rota**: cada rota monta o que precisa. Mais isolado e mais lento de carregar,
   e multiplica pontos de montagem.

*Recomendação para o ADR: (1).* É a que não espalha montagem, e a que mantém a tela recebendo portas.

### 7.2 Riscos que o rascunho listou

- **Blast radius alto**: a casca inteira, os oito destinos e os dois modos de reavaliação.
- ⛔ **Hoje não é validável.** Todos os destinos empilhados ficam **atrás do login**, e a credencial do
  preview DEV desta máquina é recusada (SPEC-060 §23.1). Refatorar navegação sem conseguir **clicar
  por ela** contraria a D-90 no ponto exato em que ela mais importa. **Esta SPEC não deve começar
  antes de o acesso DEV voltar.**

## 8. Acceptance Criteria — resultado

- AC1 — ⛔ **O gesto em si NÃO foi medido**, e não podia ser: o preview web não tem pilha nativa, e
  build nativo é o gate G7. O que está provado é a **fiação** — só as camadas acima da raiz têm
  `gestureEnabled` e botão físico, e `onDismissed` chama o **mesmo** `pop` do botão (teste).
- AC2 — ✅ **Medido no DEV real a 390px:** Conta → Fontes de dados → Voltar cai **na Conta**, e nenhum
  `onBack` diz para onde ir.
- AC3 — ✅ **Medido:** abrir a Jornada e tocar *Cuidados* esvazia o caminho e mostra Cuidados.
- AC4 — ✅ A tela de compartilhar recebe os mesmos momentos; a volta agora é estrutural (`pop`) em vez
  do condicional `shareFrom === 'journey' ? 'journey' : null`.
- AC5 — ✅ **552 testes / 56 suítes** verdes: nenhuma tela mudou de contrato.

### 8.1 Acceptance Criteria do rascunho

- AC1 — Arrastar da borda volta, medido **num iPhone ou simulador**, não em teste.
- AC2 — `Fontes de dados` volta para `Você`, e `Você` volta para a aba de origem, sem nenhum
  `onBack` dizendo para onde ir.
- AC3 — Trocar de aba não deixa nada na pilha.
- AC4 — A tela de compartilhar recebe seu momento por parâmetro de rota e mostra a mesma lista de
  hoje, vinda de cada uma das três entradas.
- AC5 — Todas as suítes existentes seguem verdes: nenhuma tela mudou de contrato.

## 9. Open Questions

- ✅ **OQ1 RESOLVIDA** — o ADR saiu ([ADR-012](../adr/ADR-012-navigation-architecture.md)), e com uma decisão **diferente** da que o rascunho supunha (§5).
- ✅ **OQ2 RESOLVIDA** — o G8 caiu em 2026-09-09 e a jornada autenticada foi medida a 390px.
- **OQ3 (CAN DEFER)** — quais destinos ganhariam mais como **sheet** no iOS (compartilhar é o
  candidato óbvio). Fatia própria, depois desta.

## 10. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-08 | Rascunho criado a partir da OQ1 da SPEC-060, com o nó arquitetural nomeado | agente |
| 2026-09-09 | ⚠️ A investigação derrubou a premissa do rascunho (as portas já viviam em contexto). ADR-012 escolheu **pilha nativa dirigida por estado** em vez de migração para rotas. Implementada e validada no DEV real | agente |
