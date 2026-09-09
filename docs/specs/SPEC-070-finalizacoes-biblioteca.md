# SPEC-070 — Finalizações: a biblioteca pessoal de técnicas (e finalizar sem perder o lugar)

- **Status:** IN PROGRESS
- **Bounded context:** Care Tracking (`F38`)
- **Autorizada por:** o dono, 2026-09-09, com escopo detalhado (duas frentes na mesma mensagem: a
  área de Finalizações e o defeito do fluxo de "Finalizei").
- **Gate:** ⛔ **não atravessa D-26/D-70.** Ver §3.

---

## 1. Problem — o que o dono viu

Duas coisas, e a segunda é um defeito real que ele mediu usando o produto.

**(1) A área de Finalizações está crua.** A SPEC-056 lhe deu um lugar, e o lugar cumpriu o que
prometia: os seis nomes existem e a contagem dela aparece. Mas, olhando a tela: cartões repetitivos,
quase nenhuma hierarquia, nenhuma identidade visual, *"Você ainda não registrou"* repetido seis
vezes, e **tocar num nome não leva a lugar nenhum** — não há tela de detalhe. É uma lista
administrativa, não uma biblioteca.

**(2) Finalizar joga a usuária para o topo da tela.** Ela rola até a finalização, toca *"Finalizei"*,
a tela entra em loading, **volta ao topo**, e a pergunta seguinte — *"Qual finalização?"* — fica
abaixo, obrigando-a a rolar de novo para achar a etapa que ela mesma acabou de destravar.

## 1.1 A causa medida do defeito (2) — e ela é maior que a finalização

⚠️ **Não é a finalização: é toda escrita da Hoje.**

`apps/mobile/src/app/index.tsx` — `loadBoard()` começa com `setBoard('loading')`, e mais abaixo
`if (board === 'loading') return shell(<Loading …/>)`. Toda ação do cartão termina em
`run().then(onChanged)`, e `onChanged` **é** `loadBoard`. Então **concluir, pular, reagendar,
desfazer, o check-in, cada marcação do check-in, a etapa de finalização e a técnica** trocam a
**árvore inteira** por um spinner de tela cheia. A `ScrollView` do `Screen` é desmontada, e ao
remontar o scroll está em 0.

⚠️ **O `busyId` do cartão já existe e já é localizado** — a Hoje já sabia mostrar "estou salvando
isto aqui". Ele nunca chegou a ser visto no lugar dele, porque o spinner de tela cheia o destruía
junto com a tela.

⚠️ **É a quarta vez que este repositório mede a mesma forma de defeito**: a peça existe, a ligação
não (a `Section` que declarava `shelf` e não repassava, SPEC-041; o `oilDueOn` que o app nunca
passava, SPEC-053; o `Screen` que não consumia área segura, SPEC-060). Aqui a peça é o estado
localizado de ocupado.

⛔ **O conserto é na origem, não no scroll.** Restaurar posição de rolagem depois de um remount
trataria o sintoma e deixaria o remount — com o teclado, o foco e o motion todos ainda sendo
descartados a cada toque.

---

## 2. Goals

1. **Revalidar sem desmontar.** Uma recarga do board com dado já na tela **mantém a tela**; o
   spinner de tela cheia fica só para a **primeira** carga, quando não há o que preservar.
2. A etapa seguinte (*"Qual finalização?"*) **aparece no lugar**, logo abaixo do que ela tocou, com
   o movimento do design system e respeitando redução de movimento.
3. Finalizações vira uma **biblioteca pessoal**: home com hierarquia e identidade, e uma **tela de
   detalhe** por técnica.
4. O detalhe mostra **o que os registros dela sustentam**: quantas vezes, quando foi a última, o
   histórico, e o que ela **notou** nesses cuidados.
5. A superfície de *"Como fazer"* fica **preparada e honesta**, com o sign-off que a destrava
   nomeado no próprio código.

## 3. Non-Goals — a fronteira de domínio, explícita

**A. O que esta SPEC PODE fazer agora** (nada disso atravessa gate): UX, layout, hierarquia,
identidade visual, histórico pessoal, frequência, última utilização, e **relações observacionais
sustentadas pelos registros dela**.

**B. O que continua atrás de D-26/D-70 e NÃO entra:**

- ⛔ *"melhor para o seu cabelo"*, *"recomendadas para você"*, indicação por curvatura ou perfil;
- ⛔ eficácia, efeito, promessa de resultado;
- ⛔ **passo a passo substantivo** de cada finalização, e qualquer descrição/apresentação que
  ensine ou caracterize a técnica;
- ⛔ ranking, ordem de mérito, *"sua melhor finalização"* (isso é a `P7`);
- ⛔ indicação profissional.

⚠️ **Não existe conteúdo aprovado de finalização para reutilizar.** `CARE_GUIDES_V1` (SPEC-007)
cobre os **tipos de cuidado** (hidratação, nutrição, reconstrução, restauração), **não** as
finalizações. A SPEC-039 §8 já registrou por escrito que o vocabulário e o conteúdo de finalização
são *"conteúdo capilar substantivo, atrás do gate D-26/D-70"*. Então: **a superfície é preparada, o
conteúdo não é inventado.**

**O que exatamente destrava o "Como fazer":** o sign-off do **G2** (D-26 / D-70 / OQ-REL) por um
profissional de cuidados capilares sobre um texto de passo a passo por finalização, entregue como
`CARE_GUIDES_V1` foi — dado versionado com `validation_status`. Registrado em
`docs/product/DOMAIN-SIGNOFF-PACKAGE.md`.

**C. Fora de escopo por necessidade (D-47/D-48):** nenhuma migration, nenhuma tabela, nenhuma coluna,
nenhuma dependência nova.

---

## 4. Functional Requirements

### Fatia 1 — finalizar sem perder o lugar

- **FR1** — `loadBoard` distingue **primeira carga** de **revalidação**. Com um board já carregado,
  a recarga **não** troca o estado por `'loading'`: a tela continua exibindo o board atual e recebe
  o novo quando ele chega.
- **FR2** — o erro de uma **revalidação** não apaga a tela: o board bom continua, e a falha é dita
  onde a ação foi disparada (a Hoje já tem `message`/`failure` para isso). A tela de erro cheia
  fica para a falha da **primeira** carga, que é quando não há nada a preservar.
- **FR3** — a etapa *"Qual finalização?"* entra com `Reveal`, portanto **sem movimento** quando a
  redução de movimento está ligada, e **nunca antes de a preferência ser conhecida** (o estado
  inicial do hook é `null`).
- **FR4** — nenhuma restauração de scroll, nenhum `scrollTo` compensatório: com FR1 não há remount,
  e a posição nunca chega a ser perdida.

### Fatia 2 — a biblioteca

- **FR5** — o cartão da home mostra: **marca visual da técnica**, nome, **quantas vezes**, **quando
  foi a última vez**, e afordância de abrir (chevron).
- **FR6** — o estado **nunca registrada** é **mais leve** que o de uma técnica com história: sem
  cartão cheio, sem repetir uma frase de ausência seis vezes com o mesmo peso.
- **FR7** — tocar numa técnica abre **tela própria** com: nome, contagem, última utilização,
  **histórico dela** (as ocorrências, por data), **o que ela notou** nesses cuidados (§5), e a
  superfície de *"Como fazer"* no estado honesto.
- **FR8** — a tela de detalhe entra na pilha nativa (SPEC-061/ADR-012), então **volta pelo gesto**
  do iPhone e pelo botão físico do Android.

## 5. Business Rules

- **BR1 — contagem, nunca julgamento.** Sem média, sem nota, sem *"melhor"*, e a lista sai **na
  ordem do vocabulário**, jamais por contagem (seria a `P7`). Herdado da SPEC-056 BR3, intacto.
- **BR2 — a última utilização é fato, não ordem.** Ela **aparece** e **não ordena nada** — ordenar
  por recência escolheria um critério de importância, que é a `P7` de novo. Mesma decisão medida na
  SPEC-066.
- **BR3 — a data sai por MÁXIMO, não pela ordem de chegada.** Confiar na ordem do adapter acopla o
  domínio a uma promessa dele — a classe de defeito que a SPEC-063 mediu no `lastUsedFor`. Nenhum
  `Date` é criado: `YYYY-MM-DD` é cronológico por construção (ADR-008).
- **BR4 — a execução ANULADA não conta.** ⚠️ `void_execution` é *soft delete* (`voided_at`), então
  o `on delete cascade` **não dispara** e a linha de finalização **sobrevive** ao desfazer
  (SPEC-039 OQ4). A contagem de hoje inclui finalizações que ela **desfez**. Isso é corrigido aqui:
  a evidência é o que ela **manteve**, a mesma regra que a SPEC-047 já aplica (*"ela desfez aquilo;
  contá-la como evidência seria observar um fato que ela mesma retirou"*).
- **BR5 — observação, nunca causa.** *"Você notou definição em 3 dos 4 cuidados com Plopping que
  você avaliou"* é contagem nos registros dela. ⛔ *"Plopping melhora sua definição"* é alegação
  capilar. Barreira de teste no core e na tela, contra verbo de efeito, *"melhor"*, ranking,
  porcentagem e diagnóstico.
- **BR6 — o denominador é o cuidado com esta finalização QUE ELA AVALIOU.** Marca só existe presa a
  um check-in: cuidado sem check-in não diz nada sobre resultado, e incluí-lo no denominador
  encolheria a fração por um silêncio. Mesma disciplina da SPEC-047.
- **BR7 — amostra mínima de 3 cuidados avaliados com a técnica.** Abaixo disso não há observação
  nenhuma, e a tela **diz o que falta**. ⚠️ *"você notou em 1 de 1"* não é observação: é uma
  coincidência com forma de regra, e um único cuidado moveria a fração inteira.
- **BR8 — a marca com ZERO não vira observação.** *"…em 0 dos 4"* não é observação, é **acusação** —
  o espelho exato do que a SPEC-050 recusou. Só o que ela **notou** aparece.
- **BR9 — `other` e `unknown` não são técnicas do catálogo.** São saídas de registro, não nomes que
  se descobre. Herdado da SPEC-056 BR1, intacto — e continuam contando como registro no banco.

---

## 6. Data Model / API / Authorization / Privacy

**Zero migration. Zero tabela. Zero coluna. Zero RPC. Zero dependência.**

`WashDayPort.finishHistory()` passa a devolver, por ocorrência, o que a tela precisa —
`{ technique, executedOn, marks }` — em vez de só a técnica. As leituras são as tabelas que já
existem (`wash_day_finish` → `wash_days` → `care_executions`, e `checkins` → `checkin_marks`), todas
sob as policies `select_own` que já valem: `user_id` não vai como filtro, `auth.uid()` decide.

⚠️ **Leituras curtas em vez de `join` embutido**, pela razão já medida (SPEC-041/047): a FK de
`wash_days` para `care_executions` é composta e o PostgREST não promete embedding por FK composta.

**Privacidade:** nada sai do aparelho, nada agrega com terceiros, nada vira benchmark. É o histórico
dela, lido sob RLS.

**Free** (D-83): é o dado dela e o vocabulário que ela já vê ao registrar. Sem gate de entitlement.

---

## 7. Edge Cases

- **EC1** — zero registros: os seis nomes continuam ali (a descoberta), no estado leve. Não há tela
  vazia.
- **EC2** — técnica registrada mas com a execução anulada: **não conta** (BR4), e a técnica volta ao
  estado leve se era a única ocorrência.
- **EC3** — falha de leitura: erro com nova tentativa, nunca uma lista que finge zero.
- **EC4** — revalidação que falha com board bom na tela: a tela **fica**, e a falha é dita na ação.
- **EC5** — ocorrências fora de ordem vindas do adapter: a última utilização sai por máximo (BR3).
- **EC6** — virada de ano entre ocorrências: comparação lexicográfica de `YYYY-MM-DD` resolve.
- **EC7** — 3 cuidados avaliados com a técnica e nenhuma marca: nenhuma observação, e a tela diz que
  ela ainda não marcou nada nesses cuidados (não é erro, é ausência).

## 8. Acceptance Criteria

- **AC1** — tocar *"Finalizei"* **não** volta ao topo, e *"Qual finalização?"* fica visível.
- **AC2** — nenhuma ação da Hoje troca a tela por spinner de tela cheia quando já há board.
- **AC3** — a home de Finalizações mostra marca, nome, contagem, última vez e afordância de abrir.
- **AC4** — tocar numa técnica abre a tela de detalhe, e voltar cai na home de Finalizações.
- **AC5** — a contagem **exclui** execução anulada (BR4), com teste que falha no comportamento antigo.
- **AC6** — nenhum texto de nenhuma das duas telas afirma efeito, indicação, *"melhor"*, ranking ou
  porcentagem (barreira de teste).
- **AC7** — validado a 390px no DEV real, com console limpo.

## 8.1 Evidência da fatia 1 — medido a 390px no DEV real (2026-09-09)

Navegador real a 390×844 por `Emulation.setDeviceMetricsOverride` via CDP (nunca `--window-size`,
que no Windows não desce abaixo de ~500px e devolve um screenshot reescalado).

Fluxo: DEV sign-in → concluir um cuidado → rolar até a finalização → tocar *"Finalizei"* duas vezes
(tirando e repondo a resposta) → escolher **Plopping** → recarregar a página inteira.

| medição | valor |
|---|---|
| scroll antes | 180 |
| scroll depois de tirar a resposta | 180 |
| scroll depois de responder de novo | 180 |
| **mesma instância de `ScrollView`** | **sim** |
| topo de *"Qual finalização?"* | 319 (viewport 844) |
| dentro da viewport | sim |

⚠️ **A prova de que o remount acabou não é o número do scroll: é a identidade do scroller.** O
elemento que rolava antes do toque é **o mesmo objeto** depois dele. Com o defeito, a árvore inteira
era substituída e não haveria elemento para comparar.

⚠️ **A FR4 ficou confirmada por medição, não por opinião:** o dono pediu para levar a usuária até a
etapa seguinte *"somente se ela estiver fora da viewport"*, e ela **está dentro** — 319 de 844, logo
abaixo do chip que ela tocou. Então **nenhum `scrollTo` foi escrito**: máquina para uma condição que
não ocorre é o que a SPEC-016 AC3 chama de bug por escrito.

**Persistência:** depois de recarregar a página e entrar de novo, o cartão diz *"Finalização"* (e não
*"Você finalizou?"*) e *"Finalização feita"* (e não *"Qual finalização?"*) — os dois títulos só mudam
com a etapa e a técnica gravadas.

**Console limpo:** zero erro e zero exceção; sobram as deprecações do `react-native-web`
(`shadow*`, `pointerEvents`, `useNativeDriver`) que já existiam.

⚠️ **Uma limpeza de console que veio junto, e não estava no plano.** `src/app/` é o diretório do
`expo-router`, e **todo arquivo ali é tratado como rota**: `board-refresh.ts` nasceu lá e o app passou
a avisar, em toda carga, que a "rota" não tem `default export`. O `stacked-path.ts` (SPEC-061) já
fazia o mesmo desde que foi criado. Os dois foram para `src/shared/`, e os **dois avisos sumiram** —
medido antes e depois. O `check:docs-links` pegou a referência velha no `CLAUDE.md` na mesma rodada.

⚠️ **`aria-checked` continua nulo no preview web** (SPEC-051 OQ4, remedido aqui nos chips de
finalização): o estado do chip se afere pelo canal que ela vê e pelos títulos que mudam, nunca por
ARIA. Não é defeito do produto — a API é a suportada no iOS/Android.

## 8.2 Decisões que a auditoria fixou

**O "loading localizado no próprio CTA" já existia e passou a ser visível.** O `Button` do design
system mostra um `ActivityIndicator` quando `busy`, e a Hoje já passava `busy={busyId === item.id}`
— o spinner de tela cheia é que o destruía junto com a tela. ⚠️ **Nos chips, o sinal é o
esmaecimento, e isso é deliberado:** os tokens dizem por escrito que há *"um esmaecimento para todo
controle que recusa entrada, para 'desabilitado' sempre parecer a mesma coisa"*, e um spinner dentro
de um chip mudaria a largura dele, empurrando os vizinhos numa `Row` — inventar um segundo
vocabulário visual para um caso só custaria mais do que resolve.

⚠️ **Efeito colateral bom, e vale registrar:** `busyId` agora só é liberado **depois** da releitura,
porque a cadeia espera a promessa. A ação fica travada até a tela refletir a verdade nova, em vez de
liberar contra um estado velho. Antes isso era mascarado — a tela inteira estava bloqueada de
qualquer jeito.

**Aceito, e não corrigido (`onPause`/`onResume`):** essas duas disparam a releitura sem esperar, então
uma falha de releitura depois de uma pausa bem-sucedida deixa a tela velha **em silêncio**. ⚠️ **Não
é regressão de resultado:** antes, a mesma falha trocava a tela por um erro de tela cheia — ela
perdia a tela *e* a posição. Agora perde só a mensagem, e o `PauseCard` continua nomeando a falha da
**pausa**, que é a operação que importa ali. Encadear a releitura na promessa do `PauseCard` faria
ele dizer *"não foi possível pausar"* sobre uma pausa que **aconteceu** — uma mensagem errada é pior
que uma ausente.

## 9. O que só se prova em iPhone nativo (G7)

O gesto de voltar da pilha nativa, o motion real do `Reveal`, o Dynamic Type e a sensação de toque.
O preview web prova layout, fluxo, persistência e a ausência do remount — não prova gesto.

## 10. Change Log

- 2026-09-09 — criada a partir do escopo detalhado pelo dono. Fatia 1 (o defeito do fluxo) e
  fatia 2 (a biblioteca).
