# SPEC-026 — Huna Core Experience: navegação e identidade

| Campo | Valor |
|---|---|
| ID | SPEC-026 |
| Status | **Draft** |
| Owner | (humano) — projetopaporeto.erp@gmail.com |
| Bounded Context | **Nenhum — transversal de apresentação**, como a SPEC-016 e a SPEC-018. Vive em `apps/mobile` (DOMAIN-MAP §5), consumindo os contextos que já existem. |
| Related ADRs | ADR-001 (a UI não decide nada), ADR-008 |
| Related SPECs | SPEC-016 (o design system que isto evolui), SPEC-018 (a primeira experiência), e **todas** as que criaram as capabilities que esta organiza |
| Fase | Huna Core Experience — direção do dono, 2026-09-02 |
| Criado | 2026-09-02 |

## 1. Context

Em seis SPECs o produto ganhou nove capabilities Free. **Nenhuma delas ganhou um lugar.**

O app tem **uma rota** e sete modos booleanos (`showAccount`, `showCycle`, `showShelf`, `showHairEvents`, `washDay`, `reassessing`), cada um com um "voltar". Não existe navegação persistente: a usuária não sabe onde está nem o que mais existe.

E o efeito colateral tem nome. **A prateleira (`F26`) e "Meu cabelo mudou" (`F23`) estão dentro da Conta** — a tela de assinatura, lembretes e exclusão de conta. Duas capabilities de cuidado diário moram na gaveta de configurações porque, quando foram construídas, não havia outro lugar para pendurá-las. O ciclo (`F20`) é um botão *ghost* no fim de uma tela longa.

Visualmente, a SPEC-016 acertou a base — osso quente, grafite, ameixa — e a usou com parcimônia deliberada. Com nove capabilities na tela, a parcimônia virou palidez: o app é branco, e branco não é uma identidade.

## 2. Problem

**Muitas capabilities, nenhuma arquitetura de informação.** Cada SPEC resolveu onde a *sua* tela morava; ninguém resolveu onde **todas** moram. O resultado é um produto que faz nove coisas e parece fazer duas — e as sete restantes só são encontradas por quem já sabe que existem.

O segundo problema é o oposto do primeiro: resolver isso com sete abas seria trocar "escondido" por "sobrecarregado". A regra é **muitas capabilities, poucas categorias, poucas decisões por tela**.

## 3. Goals

- G1 — **Quatro categorias**, permanentes, que respondem "onde eu estou" e "o que mais existe".
- G2 — Nenhuma capability continua escondida dentro da Conta.
- G3 — A Hoje ganha **calendário clicável**: tocar num dia mostra o conteúdo daquele dia.
- G4 — Uma seção **"Sugestões para você"**, contextual, sem inventar conteúdo capilar.
- G5 — Identidade visível: vinho, ameixa, berry e roxo profundo entram de verdade, com o creme como base e não como o app inteiro.
- G6 — O hero deixa de ser textura abstrata e passa a ser **linguagem visual própria da Huna**.
- G7 — Nenhuma decisão a mais por tela do que hoje. Organizar é tirar peso, não somar.

## 4. Non-Goals

- **NG1 — Nenhuma capability é removida, adiada ou reduzida.** Design **organiza**; o escopo COMMITTED (§0.4) é inalterado por esta SPEC.
- **NG2 — Não é uma cópia do Flo.** Flo é benchmark de navegação, calendário, home, hierarquia, cards, microinterações e sensação premium — nunca de layout, cor ou copy.
- **NG3 — Nenhuma regra de negócio muda.** A UI continua não decidindo nada (ADR-001): nenhuma tela nova lê ou grava fora dos ports que já existem.
- **NG4 — Nenhum conteúdo capilar novo.** "Sugestões para você" **não** cria orientação capilar: o que ela mostra ou já passou pelo gate, ou é atalho para uma capability, ou é um fato que a própria usuária registrou. Inventar aqui joga o app inteiro no D-26.
- **NG5 — Community não entra agora.** Continua COMMITTED e `DEFERRED BY DEPENDENCY`; a quinta aba é prevista, não construída.
- **NG6 — Sem dark mode**, que continua OQ da SPEC-016.
- **NG7 — Não é IA.** Nenhuma sugestão vem de modelo, embedding ou heurística preditiva — a IA é a **última** capability (§0.4), e infraestrutura antecipada dela é proibida.
- **NG8 — Sem schema, RPC ou migration.** Esta SPEC não toca o banco.

## 5. User Stories

- Como usuária nova, quero entender em cinco segundos o que o app faz, sem caçar dentro de menus.
- Como usuária que cadastrou produtos ontem, quero achar minha prateleira sem passar pela tela de assinatura.
- Como usuária no meio do ciclo, quero tocar num dia da semana e ver o que tinha nele.
- Como usuária que abriu o app sem objetivo claro, quero que ele me mostre algo útil que **eu já posso fazer**.

## 6. Functional Requirements

### Navegação
- FR1 — Barra inferior permanente com **quatro** categorias: **HOJE · CUIDADOS · PROGRESSO · VOCÊ**.
- FR2 — A aba ativa é evidente por **forma e palavra**, nunca só por cor.
- FR3 — Trocar de aba **preserva** o estado da aba anterior dentro da sessão.
- FR4 — Uma tela aberta a partir de uma aba (Wash Day, prateleira, ciclo) volta para **aquela** aba.
- FR5 — A barra **some** onde ela atrapalharia: abertura, login, onboarding e a criação do plano (SPEC-018) não têm navegação — são uma sequência, não um lugar.
- FR6 — Distribuição das capabilities existentes: **HOJE** o dia e o que ele pede · **CUIDADOS** o cronograma, o ciclo, a prateleira e o Wash Day · **PROGRESSO** progresso, resumo de ciclo e o que ela registrou · **VOCÊ** perfil, "meu cabelo mudou", reavaliar, assinatura, lembretes e conta.

### Hoje e cronograma
- FR7 — Semana no topo, **clicável**: tocar num dia troca o conteúdo para aquele dia.
- FR8 — O dia selecionado é sempre explícito **em palavra**, não só em destaque visual.
- FR9 — Um cuidado é o principal da tela; o resto é secundário por construção.
- FR10 — Próximos cuidados visíveis sem rolar até o fim.
- FR11 — O ciclo completo alcançável em **um** toque.

### Sugestões
- FR12 — Seção "Sugestões para você" com atalhos contextuais para o que ela **já pode fazer**.
- FR13 — Cada sugestão é derivada de um fato do estado dela (não tem produtos; não registrou o Wash Day; o ciclo acabou; nunca contou uma mudança), **nunca** de conteúdo capilar novo.
- FR14 — Progressive disclosure: no máximo o que cabe sem rolar, e o resto sob pedido.
- FR15 — Uma sugestão dispensada não volta na mesma sessão.

### Identidade e hero
- FR16 — Paleta ampliada: vinho, ameixa, berry e roxo profundo, com superfícies suaves derivadas. Creme continua a base.
- FR17 — Todo valor novo continua em `apps/mobile/src/design/tokens.ts` — literal em tela de produto continua bug (SPEC-016 FR2).
- FR18 — Contraste: nenhum par texto/fundo abaixo de **4.5:1**. A SPEC-016 já reprovou um token por 3.09:1; a paleta nova não reabre isso.
- FR19 — Hero com **curvas reais**: figura feminina futurista/conceitual, meio digital meio androide, não humana realista e não robô mecânico, com o **cabelo como protagonista** e fios acompanhando o movimento.
- FR20 — O hero respeita redução de movimento: **estático** quando ela está ativa, e nada anima antes de a preferência ser conhecida (SPEC-018: o estado inicial do hook é `null`, não `false`).

## 7. Business Rules

- BR1 — A UI não decide nada (ADR-001). Nenhuma tela nova ganha regra.
- BR2 — **Uma sugestão nunca é uma afirmação capilar.** "Você ainda não tem produtos na prateleira" é um fato dela; "seu cabelo precisa de mais hidratação" é regra de domínio e exige sign-off (D-26/D-70).
- BR3 — Nenhuma tela pontua, compara com outras pessoas ou cobra — as barreiras das SPECs 019, 021, 022 e 024 continuam valendo, e esta SPEC as herda inteiras.
- BR4 — O que é Premium continua Premium e o que é Free continua Free: reorganizar não move nada entre planos (D-83).

## 8. Data Model Impact

**Nenhum.** Sem tabela, coluna, RPC, Edge Function ou migration. Ver `docs/architecture/DATA-MODEL.md` — esta SPEC não o altera.

## 9. API / Contracts

**Nenhum contrato novo.** As telas consomem os ports que já existem. A navegação é estado de apresentação e não é persistida (FR3 é escopo de sessão).

## 10. Authorization

Inalterada. Nenhuma tela nova lê ou escreve nada que a atual já não leia ou escreva, e entitlements continuam passando só pelo `EntitlementService`.

## 11. Security Considerations

Sem superfície nova: nenhuma tabela, nenhum grant, nenhum `SECURITY DEFINER`, nenhuma entrada de dado nova. O risco desta SPEC é de **regressão**, não de exposição — uma reorganização que perca um guard existente. AC10 é a barreira.

## 12. Privacy Considerations

Nenhum dado novo é coletado. "Sugestões para você" lê **apenas** o que já está na sessão dela e não envia nada para lugar nenhum. Sem analytics (D-31).

## 13. Analytics Events

**Nenhum** (D-31).

## 14. UX Notes (sem design visual)

- **Quatro categorias, e a quinta reservada.** Community é prevista na estrutura e ausente da tela.
- A aba **VOCÊ** não é "configurações": é ela. Perfil e cabelo primeiro; assinatura e conta depois.
- **CUIDADOS** é onde mora tudo o que é rotina: cronograma, ciclo, prateleira, Wash Day.
- Sugestões são **convites**, nunca cobranças: dispensáveis, silenciosas, e nunca contam quantas ela ignorou.
- Cor entra em **superfície e hierarquia**, não em texto pequeno — é assim que se ganha identidade sem perder legibilidade.

## 15. Edge Cases

- EC1 — Sem plano ativo: a barra existe, e as abas que dependem de plano dizem o que falta em vez de aparecerem vazias.
- EC2 — Plano pausado (`F22`): a Hoje continua calma e o calendário não marca atraso — pausada, nada atrasa.
- EC3 — Dia sem nada: estado vazio com palavra, nunca uma tela em branco.
- EC4 — Dia fora do ciclo: o calendário não navega para onde não há plano.
- EC5 — Fonte grande e tela pequena: a barra não engole o conteúdo, e os rótulos não somem.
- EC6 — Leitura falhando: a aba mostra erro com nova tentativa e **nunca** um estado vazio que finge (padrão das SPECs 023/024).
- EC7 — Redução de movimento ativa: transição de aba e hero ficam estáticos.

## 16. Failure Modes

Cada aba carrega o que é seu; uma leitura que falha derruba **aquela** aba, não a navegação. A barra nunca desaparece por erro de conteúdo.

## 17. Acceptance Criteria

- AC1 — Quatro abas permanentes, e a ativa é legível **em palavra**.
- AC2 — **Nenhuma capability alcançável só de dentro da Conta** — verificado por teste.
- AC3 — Tocar num dia da semana troca o conteúdo daquele dia.
- AC4 — O ciclo completo em um toque.
- AC5 — "Sugestões para você" só mostra o que é derivado de fato da usuária — barreira de teste contra linguagem capilar.
- AC6 — Nenhuma sugestão cobra, pontua ou compara — barreira de teste.
- AC7 — Zero literal de cor ou espaçamento fora de `apps/mobile/src/design/` (SPEC-016 AC1, por varredura).
- AC8 — Todo par texto/fundo novo ≥ 4.5:1 — verificado por cálculo, não por olho.
- AC9 — Hero com curvas reais, estático sob redução de movimento.
- AC10 — **Nenhuma capability perdida na reorganização:** toda tela que existia continua alcançável — verificado por teste que enumera as rotas.
- AC11 — `pnpm verify` verde, e **validação a 390px navegando de verdade no DEV real**.

## 18. Testing Strategy

RNTL para a navegação (as quatro abas, o retorno à aba de origem, o estado preservado), para o calendário clicável, para as sugestões e para as barreiras de AC2/AC5/AC6/AC10 · Vitest para qualquer derivação pura de sugestão · varredura para AC7 · cálculo de contraste para AC8 · e a validação visual do §17 AC11, que teste automatizado não substitui.

## 19. Dependencies

Nenhuma para as frentes 1–4. A frente 5 (hero) depende da **OQ1**.

## 20. Implementation Plan

1. **Navegação** — as quatro abas, a redistribuição das capabilities, e a Conta deixando de ser gaveta.
2. **Hoje + calendário clicável** — a semana no topo passa a comandar o conteúdo.
3. **Sugestões para você** — derivadas de fato, dispensáveis, sem conteúdo capilar novo.
4. **Identidade** — a paleta ampliada, com contraste verificado.
5. **Hero** — depois da OQ1 resolvida.

Cada fatia é validada a 390px no DEV real antes da seguinte (D-90).

## 21. Migration Plan

Não aplicável — sem banco.

## 22. Rollback Plan

Reverter a fatia. Nenhum dado é criado ou alterado, então rollback é `git revert` e nada mais.

## 23. Open Questions

- **OQ1 — BLOCKING para a frente 5 — a tecnologia do hero é dependência nova (§4 HUMAN GATE).** O dono pediu curvas reais e disse "não volte a tentar representar cabelo com retângulos" — e retângulo com `borderRadius` é literalmente tudo o que `View` sabe desenhar. As opções: **(a) `react-native-svg`** — curvas Bézier, gradientes e máscaras de verdade; é o pacote que o próprio Expo instala e suporta (`npx expo install`), funciona no preview web e anima com o `Animated` da plataforma; **(b) `@shopify/react-native-skia`** — muito mais poderoso (shaders, blur), muito mais pesado, e no web exige CanvasKit/WASM, o que quebraria o preview que hoje é o único jeito de validar a 390px; **(c) asset autoral** (`expo-image` + arquivo) — a melhor qualidade possível, e é a OQ1 da SPEC-018, que continua sem o asset existir; **(d) continuar com `View`** — é o placeholder atual, e é o que o dono acabou de recusar. *Recomendação:* **(a)**. *Assunção enquanto não houver decisão:* o hero atual continua como placeholder e as frentes 1–4 seguem sem ele.
- **OQ2 — IMPORTANT — o nome da terceira aba.** "PROGRESSO" descreve bem `F16`/`F29` e mal o histórico do que ela registrou (Wash Days, eventos de cabelo), que também mora ali. *Assunção:* "PROGRESSO", porque é a palavra que o dono usou e porque o histórico é o que **produz** o progresso. *Gatilho para reabrir:* se a aba virar majoritariamente histórico em vez de leitura de evolução.
- **OQ3 — CAN DEFER — persistir a aba entre sessões.** Reabrir na última aba é conveniente e também é uma forma de esconder a Hoje de quem fechou o app em outro lugar. *Assunção:* sempre abre em HOJE. *Gatilho:* pedido explícito.
- **OQ4 — CAN DEFER — quantas sugestões cabem.** Depende de quantas se aplicam ao mesmo tempo, o que só se sabe com a tela montada. *Assunção:* no máximo **duas** visíveis, o resto sob "ver mais".
- **OQ5 — CAN DEFER — a quinta aba.** Community entra quando escala, moderação, segurança e massa crítica existirem (§0.4). A estrutura já a prevê; nada dela é construído agora.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-02 | v0.1 — Draft criada a partir da direção do dono. **O diagnóstico que a justifica:** o app tem uma rota, sete modos booleanos e **duas capabilities de cuidado diário (`F26` prateleira e `F23` "meu cabelo mudou") morando dentro da tela de assinatura e exclusão de conta** — não por decisão, mas porque nenhuma SPEC anterior tinha um lugar para pendurá-las. A **OQ1 é o único gate**: curvas reais exigem uma dependência que o projeto não tem, e `View` só desenha retângulo — as frentes 1 a 4 não dependem dela e seguem primeiro (§0.2 "gate não bloqueia o resto"). | agente (§0.3/D-97) |
