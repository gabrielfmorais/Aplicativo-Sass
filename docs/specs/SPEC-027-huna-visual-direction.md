# SPEC-027 — Direção visual da Huna: o hero, os ícones e a barra

| Campo | Valor |
|---|---|
| ID | SPEC-027 |
| Status | Implemented |
| Owner | dono (direção dada em sessão, 2026-09-02) |
| Bounded Context | — (design system + casca de navegação; nenhum contexto de domínio é tocado) |
| Related ADRs | ADR-001 (fronteiras), D-101 (dependência técnica reversível), D-97 (decidir é do agente) |
| Related SPECs | SPEC-016, SPEC-018, SPEC-023, SPEC-026 |
| Fase do roadmap | Beta Experience — continuação da SPEC-026 |
| Criado / Atualizado | 2026-09-02 / 2026-09-02 |

## 1. Context

A SPEC-026 deu lugar às nove capabilities Free e tirou o app do branco. Ela **não** resolveu três
coisas, e as três só aparecem olhando a tela a 390px:

1. O hero era uma figura **de frente** que lê como **microfone**.
2. Os ícones da barra não eram um conjunto: o de Cuidados lia como `((( )))`.
3. A barra tinha três abas num espaço de quatro e a categoria mais óbvia de um app pessoal — a
   prateleira — morava dois toques abaixo de outra aba.

A referência estética dada pelo dono é o Flo: feminino, moderno, elegante, premium — **adaptado** ao
universo capilar, com identidade própria da Huna e paleta puxando para roxo, vinho e ameixa.

## 2. Problem

O produto funcionava e parecia funcional. "Bem desenhado" e "funcional" não são a mesma coisa, e a
diferença entre os dois é a primeira impressão inteira.

## 3. Goals

- G1 — Um hero que remeta a **cabelo, beleza, cuidado e tecnologia**, de perfil, com o cabelo como
  protagonista e com movimento.
- G2 — Quatro ícones que formem um **conjunto**: simples, elegantes, legíveis a 23px, coerentes
  entre si e sem cara de biblioteca genérica.
- G3 — Uma barra inferior forte visualmente e clara na navegação, com **uma** porta por destino.
- G4 — Mais cor da marca na interface, sem poluição e sem perder legibilidade.

## 4. Non-Goals

- NG1 — Nenhuma mudança de banco, core, RPC, RLS ou contrato de dados. A rodada é UI/UX.
- NG2 — Nenhuma capability nova. Nada que existia sai do produto.
- NG3 — Nenhuma dependência nova. `react-native-svg` já estava aprovada (D-101).
- NG4 — Community **não** entra na barra. Continua COMMITTED e continua futura (§0.4).
- NG5 — Fonte custom, dark mode e o asset ilustrado autoral continuam OQ da SPEC-018/016.

## 5. User Stories

- US1: Como quem abre a Huna pela primeira vez, quero ver algo que diga "isto é sobre o meu cabelo"
  antes de ler qualquer texto.
- US2: Como usuária, quero alcançar a minha prateleira sem procurar dentro de outra aba.
- US3: Como usuária, quero **um** lugar para o meu perfil, e não dois que fazem a mesma coisa.

## 6. Functional Requirements

- FR1 — ⛔ **REVOGADO por [SPEC-036](SPEC-036-huna-hero-abstrato.md) (dono, 2026-09-03).** O texto
  original pedia uma *"figura feminina de perfil"*; a frente de figura humana está **encerrada** e o
  hero é abstrato e editorial. O que sobrevive é a massa que **atravessa o quadro** e o movimento
  por mecha. O resto da SPEC-027 — ícones, barra de quatro, porta única de Você — continua vigente.
- FR2 — O hero respeita redução de movimento e **nada anima antes de a preferência ser conhecida**
  (o estado inicial do hook é `null`, não `false` — herdado da SPEC-018).
- FR3 — O hero tem **dois enquadramentos** do mesmo desenho: `portrait` para o painel da abertura e
  `band` para as faixas curtas (login, interlúdios do onboarding, `Moment`).
- FR4 — A abertura é um **painel escuro que começa no topo da tela**, com o wordmark dentro dele.
- FR5 — A barra inferior tem quatro categorias com ícone **e** palavra: **Hoje · Cuidados ·
  Prateleira · Progresso**.
- FR6 — O avatar do cabeçalho é a **única** porta de **Você**.
- FR7 — A prateleira não tem uma segunda porta dentro de Cuidados.
- FR8 — A aba ativa se lê em quatro canais: pastilha, peso da palavra, cor da palavra, cor do ícone.
- FR9 — Os títulos de seção usam a cor da marca.

## 7. Business Rules

- BR1 — Nenhum texto novo faz afirmação capilar substantiva. A rodada é visual; conteúdo de domínio
  continua atrás do gate D-26.
- BR2 — Literal de cor ou número solto de espaçamento em tela de produto continua sendo bug
  (SPEC-016 FR2). O par novo `onFilledMuted` nasceu **como token**, não como literal.
- BR3 — Todo par de cor novo é **medido**, nunca estimado (SPEC-026 FR18/AC8).

## 8. Data Model Impact

Nenhum.

## 9. API / Contracts

Nenhum. Nenhuma port, RPC ou Edge Function é tocada.

## 10. Authorization

Inalterada. A prateleira mudou de lugar na navegação; as policies e grants de `products` são as
mesmas da SPEC-023.

## 11. Security Considerations

Nenhuma superfície nova. Nenhum dado novo trafega.

## 12. Privacy Considerations

Nenhum dado pessoal novo. O avatar continua exibindo apenas a inicial de `display_name` (SPEC-018).

## 13. Analytics Events

Nenhum.

## 14. UX Notes

**Hero.** Cinco camadas: massa de cabelo, perfil (testa→nariz→queixo→pescoço→ombro num contorno só),
coroa, duas mechas caindo na frente do corpo, e mechas/filamentos por cima. Sem rosto desenhado, sem
traço étnico e com o cabelo em **volume sem textura declarada** — continua servindo liso, ondulado,
cacheado e crespo, que é o argumento que criou o placeholder abstrato da SPEC-018.

**Barra.** Pastilha atrás do ícone na ativa, superfície em creme tingido, borda em `accentBorder`.

**Cuidados.** Ficou com "Meu ciclo" e recebeu "Meu cabelo mudou", que morava na tela de conta.

## 15. Edge Cases

- EC1 — Tela de 320pt com fonte grande: o painel da abertura cede espaço ao texto (`flex: 1` com
  `minHeight`), nunca o contrário.
- EC2 — Faixa curta (140–200pt de altura): o enquadramento `band` mantém a cabeça no quadro. Com o
  enquadramento `portrait` sobrava só o cabelo acima da testa.
- EC3 — "Prateleira" e "Progresso" a 13pt cabem na coluna de uma barra de quatro a 320pt.

## 16. Failure Modes

Nenhum caminho de dados foi tocado. Os estados de carregamento, vazio, erro e retry de cada tela
continuam os das SPECs que os criaram.

## 17. Acceptance Criteria

- AC1 — Dado o app aberto pela primeira vez, quando a abertura renderiza a 390px, então vê-se uma
  figura **de perfil** com cabelo longo sobre painel escuro, e o wordmark dentro do painel.
- AC2 — Dado o login ou um interlúdio do onboarding, quando a faixa do hero renderiza, então a
  **cabeça** está visível — testa, nariz e queixo.
- AC3 — Dada a barra inferior, então ela tem exatamente `['Hoje','Cuidados','Prateleira','Progresso']`
  e nenhuma aba chamada "Você".
- AC4 — Dada a aba Prateleira, quando se toca o avatar do cabeçalho, então **Você** abre.
- AC5 — Dada a aba Cuidados, então não há botão que abra a prateleira.
- AC6 — Dado qualquer par de cor novo, então ele mede ≥ 4.5:1 sobre as superfícies em que aparece.
- AC7 — Dado o hero, então todo caminho tem curva de Bézier. ⛔ A segunda metade original — *"e o
  contorno do rosto é assimétrico o bastante para não poder ser uma figura de frente"* — foi
  **revogada por [SPEC-036](SPEC-036-huna-hero-abstrato.md)**: não há rosto.

## 18. Testing Strategy

- Unit/RNTL: a barra (rótulos, posição anunciada, troca de aba), `CareTabScreen` (não oferece a
  prateleira; oferece "meu cabelo mudou"), `WelcomeScreen`, contraste da paleta.
- Barreiras de desenho: Bézier em todo caminho de cabelo, e a assimetria do perfil.
- **Validação visual a 390px é parte do DONE** (D-90) — teste automatizado não vê "microfone".

## 19. Dependencies

Nenhuma nova.

## 20. Implementation Plan

Uma PR: hero → composição da abertura → ícones → barra → arquitetura de navegação → cor de seção.

## 21. Migration Plan

Não se aplica.

## 22. Rollback Plan

Reverter a PR. Nenhum estado persistido depende dela.

## 23. Open Questions

- OQ1 (CAN DEFER) — O **asset ilustrado autoral** continua sendo o teto, e continua aberto desde a
  SPEC-018. O desenho atual é honesto e é vetorial; não é a ilustração final.
- OQ2 (CAN DEFER) — Community entra como quinta aba ou reorganiza as quatro. É problema do dia em
  que ela existir; hoje decidi-lo seria decidir sem informação.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-02 | v0.1 — a rodada de direção visual, com **duas** correções vindas de olhar a tela e não do código. **(1)** O hero de frente lia como microfone: o erro era a **pose**, não o traço — de frente o cabelo só pode ser moldura atrás de um oval claro, que é literalmente a silhueta de um microfone. **(2)** A coroa e a massa usavam o mesmo `url(#hair)` e mesmo assim discordavam da cor, porque o padrão do SVG é `objectBoundingBox` e as caixas têm tamanhos diferentes — a discordância aparecia como uma cunha escura na têmpora. `userSpaceOnUse` resolveu. Ícones: `((( )))` virou folha antes de virar mecha com cacho — o que resolve não é o arranjo, é a **inflexão**. | agente (§0.2) |
| 2026-09-02 | v0.2 — **ajuste de arquitetura pedido pelo dono**: a quarta vaga da barra é da **Prateleira**, não de "Você". O avatar do cabeçalho já é a porta do perfil, e duas entradas para o mesmo destino são o começo da confusão. A prateleira ganhou a vaga por ser o **dado** de onde saem Wash Day, Smart Shelf e Hair Intelligence. Consequências: a prateleira saiu de Cuidados (segunda porta), "meu cabelo mudou" veio da Conta para Cuidados, e o `ShelfScreen` perdeu o "Voltar". | dono + agente |
| 2026-09-02 | v0.3 — **achado da auditoria**: o ramo `tab === 'shelf'` estava **antes** das telas empilhadas, então tocar o avatar na Prateleira gravava `stacked = 'you'` e o ramo da aba vencia — o avatar era um botão morto na única aba em que ele é a porta de Você. Ordem de `if` é comportamento. | agente (§0.1) |
