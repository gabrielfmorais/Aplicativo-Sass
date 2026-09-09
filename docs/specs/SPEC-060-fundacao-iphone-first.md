# SPEC-060 — Fundação iPhone-first: área segura, teclado, notificação em primeiro plano e barra de status

| Campo | Valor |
|---|---|
| ID | SPEC-060 |
| Status | Approved (decisão do dono nesta conversa: **"HUNA É IPHONE-FIRST"** + *"corrija autonomamente tudo que seja reversível"*) |
| Owner | dono do produto |
| Bounded Context | — (transversal de apresentação) + Notifications (DOMAIN-MAP §3.7) |
| Related ADRs | ADR-001 (camadas), ADR-009 / D-22 (notificações), ADR-008 (datas/tz) |
| Related SPECs | SPEC-016 (design system), SPEC-026/027/035/055 (direção visual e casca), SPEC-008 (lembretes), SPEC-018 (NameScreen), SPEC-001 (SignIn) |
| Fase do roadmap | Fundação de plataforma — pré-beta |
| Criado / Atualizado | 2026-09-08 / 2026-09-08 |

## 1. Context

O dono decidiu em 2026-09-08: **a Huna é iPhone-first**. Android continua suportado, mas o iOS é a
plataforma principal — UX, layout, área segura, teclado, inputs, navegação, sheets, gestos,
animações, share, notificações, IAP, acessibilidade e performance percebida se decidem primeiro pelo
iPhone.

⚠️ **A validação a 390px no preview web continua sendo proxy útil e NÃO equivale a validação iOS
nativa.** É justamente essa diferença que esta SPEC ataca: **o navegador não tem entalhe, não tem
Dynamic Island, não tem indicador de home e não tem o teclado do iOS** — então a classe inteira de
defeito tratada aqui é **invisível** no único ambiente em que o produto foi olhado até hoje. Não é
coincidência que nada disso tenha aparecido em 59 SPECs: o ambiente de validação não conseguia
mostrar.

## 2. Problem

Quatro defeitos medidos no repositório, todos exclusivos ou muito piores no iPhone.

**(1) O app não tem área segura em lugar nenhum.** `react-native-safe-area-context` está em
`dependencies` desde sempre e tem **zero importações** em `apps/mobile/src` (medido). Não há
`SafeAreaProvider` na raiz, e o `Screen` fixa `paddingTop: space.xxl` (32pt) enquanto o topo seguro
de um iPhone com Dynamic Island começa em **59pt**. No pé, a `TabBar` fixa `paddingBottom: space.lg`
(16pt) contra um indicador de home de **34pt**.

⚠️ **E o repositório já afirmava por escrito que isso estava resolvido.** O comentário da `TabBar`
diz, textualmente: *"Não é `safe area` — é folga de leitura; **a área segura de verdade é do
`Screen`, que já a trata**"*. O `Screen` não trata. É exatamente a forma de defeito que este projeto
já mediu duas vezes — a `Section` que declarava `shelf` e não repassava (SPEC-041), e o `oilDueOn`
que o app nunca passava (SPEC-053): **a peça existe, a ligação não existe, e a prosa afirma que
existe.**

**(2) No iPhone, lembrete que dispara com o app aberto não aparece.** O adapter nunca chama
`Notifications.setNotificationHandler`, e sem ele o iOS **suprime** a notificação local em primeiro
plano por padrão (o Android a mostra). A SPEC-008 inteira — cinco intents, teto diário, reconciliação
— entrega **nada** no caso mais comum de todos: ela está com a Huna aberta na hora do cuidado. É a
mesma família do defeito da SPEC-053, em que a rotina de óleo lembrou zero vezes com tudo verde.

**(3) A tela de login tem um beco sem saída que só existe no iPhone.** O campo do código usa
`keyboardType="number-pad"`, e **o teclado numérico do iOS não tem tecla de retorno**. Sem
`KeyboardAvoidingView` na `SignInScreen` e sem descarte por gesto, o teclado cobre *"Confirmar
código"* e **não há como fechá-lo**. No Android o botão de voltar do sistema resolve; no iPhone, não.

**(4) O teclado cobre o que a tela existe para oferecer, em toda tela com campo menos uma.** Só a
`NameScreen` tem `KeyboardAvoidingView`. `SignInScreen`, `ShelfScreen` (cadastrar produto),
`WashDayScreen` (cadastrar produto) e `CatalogSearchSection` (busca) não têm.

## 3. Goals

- G1 — O conteúdo da Huna nunca fica sob a Dynamic Island, sob o entalhe ou sob o indicador de home,
  em qualquer iPhone, e continua correto num aparelho sem entalhe (inset 0).
- G2 — Um lembrete que dispara com o app em primeiro plano **aparece** no iPhone.
- G3 — Em toda tela com campo de texto, o teclado do iPhone não cobre o campo nem a ação primária, e
  sempre existe um jeito de fechá-lo.
- G4 — A barra de status do iOS é declarada, não herdada por acaso.
- G5 — Uma só mecânica para cada um desses problemas, no lugar que todas as telas já atravessam —
  não uma correção por tela (a regra que o próprio `Screen` já enuncia sobre o fundo: *"um fundo que
  algumas telas têm e outras não é pior que fundo nenhum"*).

## 4. Non-Goals

- NG1 — **Nenhuma dependência nova.** `react-native-safe-area-context` e `expo-status-bar` já estão
  instaladas e não usadas. Nada de `react-native-gesture-handler`, nada de biblioteca de sheets.
- NG2 — **Não reestruturar a navegação.** O app navega por estado (`openStacked`), não por rotas do
  `expo-router`, então **não existe o gesto de voltar arrastando da borda**, que é nativo do iOS.
  É um achado real desta auditoria e é grande demais para esta fatia — vira OQ1, SPEC própria.
- NG3 — Nenhuma mudança de conteúdo, cópia de produto, regra capilar ou régua de pontuação.
  D-26/D-70 e D-103 intactos.
- NG4 — Nada que dependa de conta Apple Developer, build nativo, IAP ou push remoto (G5/G7 do
  BETA-READINESS seguem gates do dono).
- NG5 — Não trocar `keyboardType` do código de 6 dígitos nem introduzir auto-submit: o teclado
  numérico é o certo para seis dígitos; o que falta é **saída**, não outro teclado.
- NG6 — `supportsTablet` continua `false`. iPhone-first significa iPhone.

## 5. User Stories

- US1: Como usuária de iPhone 15, quero ler o título da tela sem que a Dynamic Island o cubra.
- US2: Como usuária de iPhone, quero que o botão da barra de abas não fique debaixo da barra de
  gestos do sistema.
- US3: Como usuária com a Huna aberta, quero ver o lembrete do cuidado quando ele dispara.
- US4: Como usuária digitando o código de acesso, quero conseguir fechar o teclado e ver o botão.

## 6. Functional Requirements

- FR1 — A raiz do app monta `SafeAreaProvider` com `initialWindowMetrics`, para que o primeiro frame
  já saia com o inset certo em vez de renderizar com 0 e pular.
- FR2 — `Screen` soma o inset **superior** ao seu `paddingTop` de design.
- FR3 — `Screen` soma o inset **inferior** ao pé (rodapé fixo ou fim do scroll) **somente quando
  nada abaixo dele já cuida disso**.
- FR4 — A casca autenticada declara que **a `TabBar` é a dona do pé**; a `TabBar` soma o inset
  inferior ao seu `paddingBottom` de design.
- FR5 — `Screen` envolve seu corpo num `KeyboardAvoidingView` com `behavior="padding"` no iOS, o que
  resolve o teclado em **todas** as telas de uma vez. A `NameScreen` perde o dela (dois aninhados
  padeariam em dobro).
- FR6 — A `ScrollView` do `Screen` usa `keyboardDismissMode="interactive"`, o gesto nativo do iOS de
  arrastar o teclado para baixo — a saída que faltava no campo do código.
- FR7 — O adapter de notificação registra `setNotificationHandler` no escopo do módulo, exibindo
  alerta e som com o app em primeiro plano.
- FR8 — A raiz declara `<StatusBar style="dark" />`.
- FR9 — O campo de email da `SignInScreen` ganha `returnKeyType="go"` e submete pelo retorno
  (guardado por `busy` e por fase, então não duplica); os campos de nome de produto e de busca do
  catálogo ganham `returnKeyType="done"`, que **fecha o teclado e revela o que está logo abaixo**
  (as categorias, os resultados) em vez de dizer "return". ⛔ O campo do código de 6 dígitos **não**
  ganha nada: `number-pad` no iOS não tem tecla de retorno, e prop que não faz nada é ruído — a
  saída dele é o FR6.

## 7. Business Rules

- BR1 — **O inset SOMA, nunca SUBSTITUI o espaçamento de design.** Substituir daria, num iPhone com
  indicador de home, exatamente 34pt de nada — e num iPhone SE (inset 0) daria **zero** respiro. O
  espaçamento é legibilidade; o inset é hardware. São duas coisas.
- BR2 — **Um só dono do pé por janela.** `Screen` dentro da casca não soma inset inferior, porque a
  `TabBar` já somou; somar nos dois empurraria o conteúdo 34pt acima da barra, sem motivo visível.
- BR3 — O fundo (`HunaBackdrop`) continua **atravessando** a área segura. Inset é para conteúdo; um
  fundo que para no entalhe é uma faixa branca no topo do aparelho.
- BR4 — Vive em `apps/mobile/src/design/` (ADR-001: é apresentação, não domínio). `packages/core`
  não sabe o que é um entalhe.
- BR5 — ⚠️ **O topo é do frame; o `style` da tela não o redeclara.** O `style` do chamador é o último
  do array, então um `paddingTop` ali **vence o inset** — foi assim que `Moment` e `NameScreen`
  apagaram a Dynamic Island (§23.2). A única exceção é a abertura, que sangra o hero de propósito com
  `paddingTop: 0`, e ela é caso de teste nomeado, não silêncio.

## 8. Data Model Impact

**Nenhum.** Zero migration, zero tabela, zero coluna, zero RPC. Não toca `DATA-MODEL.md`.

## 9. API / Contracts

Nenhum contrato de rede muda. O contrato de componente muda em um ponto, e para menos: `Screen`
passa a resolver o teclado sozinho, então a `NameScreen` deixa de envolvê-lo.

## 10. Authorization

Nenhum impacto. Nenhuma policy, grant, RLS ou entitlement é lido, criado ou alterado.

## 11. Security Considerations

Nada de novo entra ou sai do aparelho. `setNotificationHandler` decide **apresentação** de uma
notificação **local** já agendada por esta mesma aplicação — não cria canal, não recebe payload
externo, não expõe conteúdo novo. O conteúdo dos lembretes é o que a SPEC-008 já produz, sem PII
(D-22 / SECURITY-BASELINE §13).

## 12. Privacy Considerations

Nenhum dado pessoal novo. Nenhum log, evento ou analytics acrescentado. O texto do lembrete que passa
a ser exibido em primeiro plano é o mesmo que já era exibido em segundo plano.

## 13. Analytics Events

Nenhum. O provider de analytics não existe (D-31, gate G6).

## 14. UX Notes

- O ganho é invisível quando está certo: nada se mexe num aparelho sem entalhe.
- No iPhone com entalhe, o cabeçalho desce, a barra de abas sobe, e as proporções internas de cada
  tela não mudam — porque o inset entra no **frame**, não nos cartões.
- Acessibilidade: nenhum rótulo, papel ou estado muda. O toque de 44pt (`HIT_TARGET`) continua igual —
  e passa a estar **de fato** alcançável no pé, que era onde o indicador de home o disputava.

## 15. Edge Cases

- EC1 — Aparelho sem entalhe (SE, boa parte do Android): inset 0, layout idêntico ao de hoje.
- EC2 — Preview web: `react-native-safe-area-context` reporta 0 no navegador. **Consequência
  registrada: o preview a 390px NÃO consegue provar o FR1–FR4.** O que ele prova é ausência de
  regressão; a prova do mecanismo é teste com inset injetado.
- EC3 — Rotação: `orientation: "portrait"` está travado, então não há inset lateral variável.
- EC4 — Tela sem rodapé e sem scroll (`Moment`, `Loading`): o inset superior ainda se aplica.
- EC5 — Permissão de notificação negada: o handler não muda nada; a reconciliação já sai cedo.
- EC6 — Teclado aberto sobre uma tela com rodapé fixo: o `KeyboardAvoidingView` sobe o conjunto;
  o rodapé permanece o último elemento tocável.

## 16. Failure Modes

- Se `SafeAreaProvider` não estiver montado, `useSafeAreaInsets` lança. Por isso a raiz é o lugar, e
  por isso existe teste que renderiza a árvore inteira.
- Se `setNotificationHandler` falhar, o comportamento degrada para o de hoje (nada em primeiro
  plano) — nunca para menos que hoje.

## 17. Acceptance Criteria

- AC1 — Dado um inset superior de 59pt, quando qualquer `Screen` renderiza, então seu
  `paddingTop` é `space.xxl + 59`, e não `59` nem `space.xxl`.
- AC2 — Dado um inset inferior de 34pt, quando a `TabBar` renderiza, então seu `paddingBottom` é
  `space.lg + 34`.
- AC3 — Dado o mesmo inset, quando um `Screen` renderiza **dentro da casca**, então ele **não** soma
  inset inferior (a `TabBar` é a dona).
- AC4 — Dado um `Screen` **fora** da casca com rodapé, então o rodapé soma o inset inferior.
- AC5 — Insets zerados produzem exatamente o espaçamento de hoje (nenhuma regressão em aparelho sem
  entalhe e no preview web).
- AC6 — O módulo do adapter de notificação registra um handler que pede alerta e som em primeiro
  plano.
- AC7 — A `ScrollView` do `Screen` declara `keyboardDismissMode="interactive"`.
- AC8 — A `NameScreen` não tem mais `KeyboardAvoidingView` próprio, e continua com o botão acessível.
- AC9 — Existe um teste que falha se `apps/mobile/src` voltar a ficar sem nenhum consumidor de
  `useSafeAreaInsets` — a barreira contra o exato defeito que abriu esta SPEC.

## 18. Testing Strategy

- RNTL com o mock oficial de `react-native-safe-area-context` e insets injetados, medindo o estilo
  resolvido de `Screen`, do rodapé e da `TabBar` (AC1–AC5).
- Teste de módulo do adapter de notificação verificando o handler (AC6).
- Suítes existentes de todas as telas seguem verdes (prova de não-regressão com inset 0).
- Validação no DEV real a 390px: a jornada continua funcionando e nada se moveu (prova de EC1/AC5,
  **não** de AC1–AC4).

## 19. Dependencies

**Nenhuma nova.** `react-native-safe-area-context@~5.7.0` e `expo-status-bar@~57.0.1` já constam de
`apps/mobile/package.json`. Sem checklist de supply chain porque nada entra.

## 20. Implementation Plan

1. `design/safe-area.tsx` — provider da raiz, hooks e o contexto de "quem é o dono do pé".
2. `Screen` e `TabBar` consomem; a casca declara a posse do pé.
3. `KeyboardAvoidingView` no `Screen`; remoção do da `NameScreen`.
4. Handler de notificação em primeiro plano + `StatusBar`.
5. Testes; `improve`; validação no DEV real.

## 21. Migration Plan

Não se aplica — nenhuma migration, nenhum dado, nenhuma compatibilidade de app antigo (é
apresentação local, e o app é binário de loja que carrega seu próprio layout).

## 22. Rollback Plan

Reverter o commit. Não há estado persistido, nem contrato de servidor, nem schema.

## 23. Open Questions

- **OQ1 (IMPORTANT)** — **O gesto de voltar arrastando da borda não existe no app.** A navegação é
  por estado (`openStacked`), não por rotas do `expo-router`, então o iOS não tem o que reconhecer. É
  a lacuna iPhone-first mais estrutural que esta auditoria encontrou. *Assunção enquanto aberta:* todo
  destino empilhado continua com um "voltar" explícito na tela, que é o que existe hoje e funciona.
  Vira SPEC própria — é refactor de navegação, não ajuste de frame (NG2, §5 blast radius).
- **OQ2 (CAN DEFER)** — `ios.bundleIdentifier` não está declarado em `app.json`. É necessário para
  qualquer build nativo e é **identidade de loja**, portanto anda junto com a conta Apple Developer
  (gate G7 do BETA-READINESS). *Assunção enquanto aberta:* não escolher em nome do dono.
- **OQ3 (CAN DEFER)** — Dynamic Type: os tokens de tipografia usam tamanhos fixos e
  `allowFontScaling` fica no padrão (`true`), então o texto escala mas o layout nunca foi olhado com
  a fonte grande do iOS. *Assunção enquanto aberta:* o padrão do RN, que é escalar.
- **OQ4 (CAN DEFER)** — Haptics no toque (`expo-haptics`) é expectativa forte do iPhone e seria
  dependência nova (reversível, D-101). *Assunção enquanto aberta:* sem haptics, como hoje.

## 23.1 Evidência — o que foi medido

**Testes (a prova do mecanismo, EC2).** 8 casos em `apps/mobile/__tests__/iphone-safe-area.test.tsx`
com inset injetado (`top: 59, bottom: 34`) e 1 em `notification-foreground.test.ts`.
`pnpm verify` verde: core 455 testes / 31 arquivos, mobile 538 testes / 53 suítes, mais o guardrail
novo `check-safe-area: ok (2 consumidores no design system)`.

**Navegador real a 390px** (`Emulation.setDeviceMetricsOverride` via CDP, nunca `--window-size`),
depois das correções da auditoria: abertura com rodapé `12px / 24px`, login com conteúdo
`32px / 24px` — exatamente `space.md`/`space.xl` e `space.xxl`/`space.xl` com inset 0. Viewport 390,
sem transbordo horizontal, **console limpo**. É a prova do AC5 no ambiente real, não só em teste.

⚠️ **O que NÃO foi observado, e por quê.** A casca autenticada (a `TabBar`) não foi alcançada: a
credencial do preview DEV desta máquina é recusada pelo Auth do DEV — medido contra
`/auth/v1/token?grant_type=password`, `400 invalid_credentials`, com a anon key **válida** (o
`/auth/v1/settings` responde e confirma `google: false`, batendo com a D-84). É a tarefa de 30
segundos do runbook (Authentication → Users → Add user, com *Auto Confirm User*), e é do dono.
**O custo disso é menor do que parece:** o §4 do `WEB-DEV-PREVIEW.md` já lista *"safe areas reais"*
entre o que o preview web **não** valida, porque o navegador reporta inset 0.

## 23.2 O defeito que a auditoria achou dentro desta própria SPEC

⚠️ **`Moment` e `NameScreen` apagavam o inset do topo pelo `style`.** As duas passavam
`paddingTop: space.xxl` para o `Screen`, e o `style` do chamador é o **último** do array de estilos.
Consequência: num iPhone com Dynamic Island, o cumprimento pelo nome, a espera enquanto o cronograma
é montado e a revelação do plano — as três telas da primeira experiência — renderizariam a 32pt,
**debaixo da ilha**, enquanto todas as outras estariam corretas a 91pt.

⚠️ **O que faz esse achado valer registro: as duas declarações eram duplicação PURA antes desta
fatia.** `styles.content` já aplicava `space.xxl`, então eram no-ops que ninguém tinha motivo para
remover. No instante em que o topo virou *espaçamento + inset*, duplicação morta virou defeito vivo.
É a tese desta SPEC reaparecendo dentro dela mesma.

⛔ **`WelcomeScreen` mantém `paddingTop: 0`, e isso é decisão, não esquecimento:** a abertura sangra
o hero até a borda de cima (SPEC-018/036). Um teste que exigisse inset de *toda* tela transformaria
essa composição num defeito — daí a exceção estar escrita como caso de teste próprio.

**A barreira foi verificada contra o defeito**, e não só escrita: repondo o `paddingTop` no
`Moment`, o teste falha e **nomeia a tela**. Uma asserção que passa com o sistema quebrado é pior que
nenhuma (a lição do pgTAP da SPEC-052).

## 25. Fatia 2 — o piso de toque do iPhone, e o que a varredura NÃO achou

A auditoria iPhone-first continuou depois do merge da fatia 1, agora sobre **alvos de toque** e
**Dynamic Type** — os dois itens de acessibilidade que a decisão do dono nomeia.

**FR10 — nenhum controle abaixo de 44pt.** A varredura mediu os **onze `Pressable`** do app e achou
**um só** lugar abaixo do piso da HIG: os três links de atribuição de `DataSourcesScreen`, com
`paddingVertical: space.xs` (4) sobre uma linha de 22 — **30pt**. Todo o resto já estava em 44 ou 48,
porque vem das primitivas (`Button`, `Chip`, `Field`, `TabBar`); estes escapavam por serem
`Pressable` próprio.

⚠️ **E são links de conformidade, não decoração:** ODbL e CC BY-SA **exigem** a atribuição
(SPEC-057), e um link de licença difícil de acertar com o polegar é o pior lugar do app para
economizar 14pt. Passaram a `minHeight: HIT_TARGET_MIN`, com o rótulo centrado — nada cresce na tela
além da área tocável.

**AC10** — barreira em `apps/mobile/__tests__/iphone-touch-targets.test.tsx`, que mede o alvo
**resolvido** de todo nó com papel interativo, e não a intenção de quem escreveu. Verificada contra o
defeito: repondo o `paddingVertical: 4`, ela falha e **nomeia a tela e o papel**.

### O que a varredura mediu e decidiu NÃO mudar

⚠️ **Dynamic Type está correto, e vale registrar para ninguém "consertar" depois.** Os tokens de
tipografia trazem `fontSize` e `lineHeight` fixos, o que parecia risco — mas o RN escala **os dois**
quando `allowFontScaling` está ligado (o padrão), então a caixa da linha acompanha a letra. Os
`numberOfLines={1}` que sobram são **truncamento deliberado**: o rótulo da aba (que é o que as barras
do próprio iOS fazem), o nome no cabeçalho e o nome de produto na prateleira, este último já
resolvido como decisão própria em 2026-09-08. ⛔ **Nada de `maxFontSizeMultiplier`:** capar a fonte é
tirar acessibilidade de quem precisa dela, e a medição não mostrou layout quebrando.

⚠️ **`accessibilityState` legado continua como está** (nove usos, SPEC-051 OQ4). No **iOS nativo** é a
API suportada e funciona; o que não funciona é o `react-native-web` 0.21 descartá-la no preview. Numa
SPEC iPhone-first isso é ainda mais claramente **limite do ambiente de medição, não defeito do
produto**.

**Fora desta fatia:** `allowBadge: true` é pedido na permissão de notificação (padrão da biblioteca)
enquanto o handler usa `shouldSetBadge: false`. Inconsistência inofensiva — pedir menos hoje
limitaria uma escolha futura sem ganho nenhum.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-08 | Criada a partir da decisão iPhone-first do dono e da auditoria do repositório | agente |
| 2026-09-08 | Fatia 1 implementada e mergeada (#167). A auditoria achou os dois `paddingTop` que apagavam o inset (§23.2) | agente |
| 2026-09-08 | Fatia 2 (§25): piso de toque de 44pt nos links de atribuição, com barreira; Dynamic Type medido e deliberadamente não alterado | agente |
