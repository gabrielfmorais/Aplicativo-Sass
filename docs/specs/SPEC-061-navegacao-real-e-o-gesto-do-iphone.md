# SPEC-061 — Navegação real e o gesto de voltar do iPhone

| Campo | Valor |
|---|---|
| ID | SPEC-061 |
| Status | **Draft** — aguarda aprovação humana **e um ADR** (§19) |
| Owner | (humano) |
| Bounded Context | — (transversal de apresentação / casca do app) |
| Related ADRs | ADR-001 (camadas) · **falta um ADR de navegação** (§19) |
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

## 5. O nó real, e por que isto precisa de um ADR

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

## 6. Riscos, honestamente

- **Blast radius alto**: a casca inteira, os oito destinos e os dois modos de reavaliação.
- ⛔ **Hoje não é validável.** Todos os destinos empilhados ficam **atrás do login**, e a credencial do
  preview DEV desta máquina é recusada (SPEC-060 §23.1). Refatorar navegação sem conseguir **clicar
  por ela** contraria a D-90 no ponto exato em que ela mais importa. **Esta SPEC não deve começar
  antes de o acesso DEV voltar.**

## 7. Acceptance Criteria (rascunho)

- AC1 — Arrastar da borda volta, medido **num iPhone ou simulador**, não em teste.
- AC2 — `Fontes de dados` volta para `Você`, e `Você` volta para a aba de origem, sem nenhum
  `onBack` dizendo para onde ir.
- AC3 — Trocar de aba não deixa nada na pilha.
- AC4 — A tela de compartilhar recebe seu momento por parâmetro de rota e mostra a mesma lista de
  hoje, vinda de cada uma das três entradas.
- AC5 — Todas as suítes existentes seguem verdes: nenhuma tela mudou de contrato.

## 8. Open Questions

- **OQ1 (BLOCKING)** — o ADR de navegação (§5). Sem ele isto não começa.
- **OQ2 (BLOCKING)** — acesso ao DEV (§6). Sem ele isto não termina.
- **OQ3 (CAN DEFER)** — quais destinos ganhariam mais como **sheet** no iOS (compartilhar é o
  candidato óbvio). Fatia própria, depois desta.

## 9. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-08 | Rascunho criado a partir da OQ1 da SPEC-060, com o nó arquitetural nomeado | agente |
