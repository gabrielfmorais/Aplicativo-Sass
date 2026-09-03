# SPEC-034 — Progresso é o ciclo

| Campo | Valor |
|---|---|
| ID | SPEC-034 |
| Status | Implemented (aceite visual do dono pendente) |
| Owner | dono do produto |
| Bounded Context | Care Tracking (UI) — `apps/mobile/src/features/care` |
| Related SPECs | SPEC-009 (Progresso), SPEC-019 (a visão de ciclo), SPEC-021 (o resumo de ciclo), SPEC-026/SPEC-027 (as abas), SPEC-022 (a pausa) |
| Related decisions | D-102 (o quarto tipo de cuidado, as fotos, a correlação) |
| Criado / Atualizado | 2026-09-02 / 2026-09-02 |

## 1. Context

A aba **Progresso** era a última sem passe de design. A 390px ela tinha **dois cartões e ~450px de
vazio**: o resumo acumulado, e um cartão que **descrevia** as quatro semanas e oferecia um botão
para outra tela.

Metade de uma aba permanente da barra era corredor.

## 2. Problem

Três defeitos, e só o primeiro era visível a olho nu.

**(1) A aba era um saguão.** Descrever as quatro semanas num parágrafo e oferecer um botão é
estritamente pior do que mostrá-las. O conteúdo existia; morava noutro lugar.

**(2) ⚠️ A navegação mentia.** A `CycleScreen` era empilhada **sob o ramo de Cuidados**. O ramo de
`tab === 'progress'` vinha **antes** do ramo empilhado, então abrir o ciclo do Progresso exigia
`setTab('care')` para que ele renderizasse. O efeito visível: a barra passava a destacar
**Cuidados**, e o rodapé oferecia **"Voltar aos cuidados"** — para uma aba de onde ela nunca veio.
O mesmo valia partindo da Hoje.

É a **mesma classe de defeito que a SPEC-027 já registrou uma vez** (o avatar morto no ramo da
Prateleira): uma tela empilhada colocada **depois** dos ramos de aba.

**(3) ⚠️ As duas telas podiam discordar sobre o mesmo plano.** A `CycleScreen` derivava o `Progress`
com `buildTodayView(cares, executions, today, checkIns)` — **sem `pausedOn`** —, enquanto a aba
passava a pausa. Com o plano pausado, uma podia dizer *"atrasada"* e a outra não, e **"o ciclo
encerrou?"** podia diferir entre elas. O comentário de `buildTodayView` avisa exatamente isso
(SPEC-022 BR2): as três leituras **têm** de enxergar a mesma pausa. Nenhum teste cobria a divergência
porque cada tela era testada sozinha.

**(4) Duas frases que brigavam.** Com plano recém-criado e histórico anterior, o resumo dizia *"o
resumo aparece conforme você registra"* e, na linha seguinte, *"desde o início, você concluiu 4
cuidados"* — prometia um resumo que já estava ali. Não é contradição de dado (um é o plano, o outro
é a vida inteira): é **escopo faltando na frase**.

## 3. Goals

- G1 — Progresso deixa de ser corredor: o ciclo **é** o conteúdo da aba.
- G2 — A barra inferior nunca destaca uma aba onde a usuária não está.
- G3 — Uma leitura só do plano, uma verdade só sobre o mês.
- G4 — O check-in dela deixa de ser invisível fora do dia em que respondeu.

## 4. Non-Goals

- NG1 — Nenhuma capability nova do D-102 (fotos, Finalizações, óleo, Restauração) é implementada.
- NG2 — Nada de banco, core, RPC ou dependência. É UI.
- NG3 — **Continua sem pontuar**: sem percentual, nota, gráfico, tendência, comparação ou elogio. As
  barreiras das SPECs 009, 019 e 021 valem inteiras — mudar de lugar não é licença para mudar de tom.
- NG4 — Concluir, pular e reagendar continuam **só** na Hoje (SPEC-019 NG5).

## 5. Functional Requirements

- FR1 — A aba Progresso mostra: o resumo acumulado · as quatro semanas com o que aconteceu em cada
  uma · o que caiu **depois** do ciclo, quando houver · o fecho do ciclo, quando ele tiver acabado.
- FR2 — A `CycleScreen` deixa de existir. Não há tela empilhada de ciclo, e portanto não há botão de
  voltar: **aba não volta** (SPEC-027) — sai-se dela tocando outra.
- FR3 — "Ver meu ciclo", na Hoje, **troca de aba** — como a sugestão da prateleira já fazia.
- FR4 — O cartão "Meu ciclo" sai de **Cuidados**: a barra já é a porta do Progresso, e um cartão cujo
  botão apenas troca de aba é a segunda porta que a direção recusa.
- FR5 — A avaliação que ela deu a um cuidado (`check-in`) aparece na linha dele, **nomeada como
  dela**.

## 6. Business Rules

- BR1 — **Um resumo só enquanto o ciclo corre.** Fundidas as telas, o `ProgressSummary` e o
  `CycleSummary` "Como está indo" ficariam um embaixo do outro dizendo *"concluiu 1 de 2"* com
  palavras diferentes — o defeito que a auditoria da SPEC-026 já achou uma vez. Em andamento, quem
  conta é o `ProgressSummary`; o `CycleSummary` volta **no fim**, quando diz o que o outro não diz:
  que acabou, e o que vem depois.
- BR2 — **"Encerrado" continua tendo duas entradas** (SPEC-021 BR4): a data de fim **ou** não ter
  sobrado nada. Derivar só pela data faria a Hoje e o Progresso discordarem sobre o mesmo fato.
- BR3 — **A pausa entra na derivação.** Uma leitura de `buildTodayView`, com `pausedOn`, alimenta o
  resumo e o ciclo.
- BR4 — O check-in é **a resposta dela**, e o texto diz isso. Uma resposta por cuidado é fato; a
  linha que as ligasse seria um gráfico, e gráfico é recusa registrada (SPEC-009 §2).
- BR5 — **O que falta não precisa de frase.** A linha *"Ainda faltam N no ciclo"* saiu porque as
  quatro semanas estão logo abaixo, com data e estado de cada cuidado. Mostrar é melhor que contar.

## 7–13. Dados, contratos, autorização, segurança, privacidade, analytics

Nenhum impacto. Zero SQL, zero RPC, zero migration, zero coluna. Todos os números vêm de
`buildProgress`/`buildCycleView`, que já existiam e não mudaram.

## 14. UX Notes

⚠️ **A tela é uma pilha de seções tituladas, e isso é a costura** — a mesma de `HomeSection` na Hoje.
*Suas fotos* (`F28`/`P10`/`P11`, Antes × Depois) e o cruzamento *tratamento + produto + finalização +
resultado* (`P8`) entram como **mais uma seção**, sem redesenhar nada. **Não há seção vazia esperando
por elas:** seção sem conteúdo é código morto, e a regra de necessidade a proíbe (D-47/D-48). O que
torna encaixável é o **formato**, não um placeholder.

⚠️ **Nada aqui está preso a três tipos de cuidado** (D-102/`F36`). As semanas iteram o que o plano
contém, e a cor vem de `careColor[code]`, um `Record` tipado: a Restauração entra sem tocar nesta
tela, e se alguém esquecer a cor dela o **typecheck cobra** em vez de renderizar um ponto cinza.

⚠️ **Achado fora do Progresso, na mesma varredura:** `CareGuideLibrary` tinha a lista literal
`['hydration', 'nutrition', 'reconstruction']`. Um quarto tipo entraria no engine, no banco e em
`CARE_GUIDES` e **não apareceria na biblioteca** — sem erro de compilação, sem teste vermelho, apenas
um guia inalcançável. Agora deriva de `CARE_TYPE_CODES`, com asserção própria.

## 15. Edge Cases

- EC1 — Sem plano ativo, a aba diz que o progresso aparece quando houver cronograma. Um resumo zerado
  leria como resultado ruim em vez de ausência.
- EC2 — Hoje fora das quatro semanas (plano por começar, ou vencido e ainda ativo): a tela **admite**
  que ela não está em nenhuma, com frases opostas para os dois casos.
- EC3 — Reagendar tem janela de 28 dias e pode passar do fim do plano: esses cuidados vão para
  *"Depois deste ciclo"*, e não para uma quinta semana inventada.
- EC4 — Cuidado sem check-in não ganha linha vazia nem um zero que leria como resultado.

## 16. Failure Modes

Sem leitura de rede própria: a tela consome o `board` que a Hoje já carrega. Loading e erro do board
continuam onde estavam, no `shell`.

## 17. Acceptance Criteria

- AC1 — Abrir o ciclo pela Hoje deixa **Progresso** aceso na barra.
- AC2 — Não existe "Voltar aos cuidados" em lugar nenhum.
- AC3 — Cuidados não oferece "Ver meu ciclo".
- AC4 — Pausada, nada na aba diz "atrasada".
- AC5 — A avaliação dela aparece e é nomeada como dela.
- AC6 — A biblioteca de guias tem uma linha por tipo que o **core** define.
- AC7 — As barreiras anti-pontuação continuam verdes, com amostras que casam.

## 18. Testing Strategy

`progress-tab-screen.test.tsx` — os 14 testes da antiga `cycle-screen.test.tsx`, retargetados, mais 3
barreiras novas (check-in nomeado, pausa na derivação, tipo de cuidado vindo do plano).
`tab-bar.test.tsx` — o bloco do `CareTabScreen` reescrito. `care-guide-library.test.tsx` — uma linha
por `CARE_TYPE_CODES`. `reassessment.test.tsx` — a asserção que travava as duas frases que brigavam.

**317 testes verdes** (eram 313). Validação a 390px no DEV real: Progresso com plano ativo, entrada
pela Hoje com a aba certa acesa, e Cuidados sem a porta duplicada.

## 19–22. Dependências, plano, migração, rollback

Nenhuma dependência nova. Sem migration. Reverter os seis arquivos desfaz tudo — e a `CycleScreen`
volta do histórico do Git intacta.

## 23. Open Questions

- OQ1 (CAN DEFER) — ⚠️ **O vazio mudou de aba, e isso é honesto dizer.** Tirar o cartão do ciclo
  devolveu ~500px de vazio a **Cuidados**, que agora tem "Meu cabelo mudou" e os três guias. Foi uma
  troca deliberada: um cartão cujo botão apenas **troca de aba** confunde mais do que um vazio, e a
  SPEC-027 já removeu a prateleira daqui pela mesma razão. **Não se preenche com atalho inventado**
  (a régua da SPEC-026 continua valendo); o ocupante natural desse espaço já tem nome no roadmap —
  **`F38`, a área de Finalizações** (D-102), que nasce exatamente dentro de Cuidados.
- OQ2 (CAN DEFER) — O cabeçalho preenchido ("O que você já fez") e o rótulo do cartão ("Seu
  progresso") são dois títulos empilhados. É consistente com as outras três abas, então mexer nisso é
  decisão de sistema, não desta tela.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-02 | v0.1 — Progresso absorve o ciclo. **Três defeitos que só apareceram ao juntar as telas:** a barra acendia a aba errada e o rodapé oferecia voltar para onde ela nunca esteve; as duas telas derivavam o plano com **pausas diferentes**, então podiam discordar sobre o fim do ciclo; e o check-in que ela deu estava sendo carregado por `buildCycleView` e **jogado fora** na renderização. A fusão apaga os dois primeiros por construção — sem tela empilhada não há ordem de ramos para acertar. | agente (§0.2/§0.3) |
