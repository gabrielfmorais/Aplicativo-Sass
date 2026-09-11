# Pacote de sign-off de domínio (D-26 / D-70) — **EVIDENCE-BASED DOMAIN SIGN-OFF**

**Atualizado:** 2026-09-11. **Modelo de revisão alterado por decisão do dono nesta data.**

> ⚠️ **Este documento é feito para ser copiado inteiro para o revisor.** Ele é autossuficiente: não
> pressupõe acesso ao código nem ao resto da documentação. Tudo que o revisor precisa para decidir
> está aqui, inclusive os números exatos que o software usa hoje.

---

## 0. Instruções para o revisor

Você está revisando as **regras e textos de domínio capilar** de um aplicativo de cronograma capilar
(pt-BR, mercado brasileiro). O software **já está construído e funcionando**; nada aqui pede que você
escreva código ou desenhe produto. O que se pede é uma coisa só: **decidir o que a evidência
sustenta.**

### 0.1 A regra que criou este documento

O projeto tem uma decisão vinculante — **D-26** — que diz: *a engenharia projeta o mecanismo, mas
**nunca inventa regra capilar de produção**.* Toda regra ou texto de domínio criado sem revisão
especializada nasce marcado como `candidate`, e a consequência é dura e já está implementada:

- `candidate` **funciona** em desenvolvimento e beta interno;
- `candidate` **bloqueia o lançamento público** — há um teste automatizado (`assertProductionRules`)
  que **lança erro** se o app tentar ir a produção com qualquer regra não `validated`.

**Sua revisão é o que muda `candidate` → `validated`.**

### 0.2 Hierarquia de evidência que você deve usar

Nesta ordem, e a ordem importa:

1. **Literatura científica** revisada por pares (tricologia, ciência de polímeros e queratina,
   ciência cosmética).
2. **Dermatologia e cosmetologia** — consensos, diretrizes e textos de referência.
3. **Fontes oficiais** — agências reguladoras (ANVISA, FDA, SCCS), farmacopeias, normas técnicas.
4. **Evidência físico-química do fio** — estrutura da cutícula e do córtex, ligações dissulfeto,
   ponte salina e de hidrogênio, ponto isoelétrico, porosidade, sorção de água, dano por calor e por
   processo químico.
5. **Experiência relatada por usuárias** (fóruns, comentários, comunidades) — ⛔ **apenas como
   evidência secundária de variabilidade e de uso real.**

⛔ **Comentário de usuária NUNCA prova eficácia.** Ele pode mostrar que uma prática existe, que é
comum, que varia entre pessoas, ou que gera um efeito percebido. **Não pode** sustentar uma afirmação
de que algo funciona, repara, melhora ou é indicado. Se a única evidência para um item for relato de
uso, a resposta correta é `needs change` ou `rejected`, não `validated`.

### 0.3 Como responder cada item

Para **cada** decisão numerada abaixo, devolva:

```
ITEM: <número e nome>
VEREDITO: validated | needs change | rejected
NÍVEL DE EVIDÊNCIA: forte | moderada | fraca | ausente
FONTES: <referências concretas — artigo, diretriz, norma, capítulo>
JUSTIFICATIVA: <por que a evidência sustenta ou não sustenta>
SE "needs change": <o texto ou número corrigido, exatamente como deve ficar>
RESPOSTAS ÀS PERGUNTAS: <uma a uma, pelas letras>
```

⚠️ **Responda `needs change` em vez de `validated` sempre que a afirmação for mais forte do que a
evidência.** Um item que fica `candidate` **não quebra nada** — só continua bloqueando o release
daquela parte. Um item validado indevidamente vira afirmação capilar publicada.

⚠️ **Separe o que é "seguro e comum" do que é "eficaz".** Muitas práticas aqui são inofensivas e
amplamente usadas, e mesmo assim não têm evidência de eficácia. Diga qual das duas coisas você está
atestando.

### 0.4 Vocabulário do produto (para você ler os itens)

| termo no app | o que significa aqui |
|---|---|
| **cronograma capilar** | plano de 28 dias alternando tipos de cuidado, prática popular no Brasil |
| **hidratação** | cuidado voltado a repor **água** no fio |
| **nutrição** | cuidado voltado a repor **lipídios/óleos** |
| **reconstrução** | cuidado voltado a repor **massa/proteína** |
| **restauração** | quarto tipo, introduzido em 2026; ver item 1.4 |
| **finalização** | técnica aplicada no cabelo úmido após o cuidado, para definir o fio |
| **check-in** | nota de 1 a 5 que a usuária dá ao cuidado, mais marcações opcionais |
| **avaliação capilar** | questionário de 10 perguntas no onboarding. ⛔ **Nunca chamado de diagnóstico** |

---

## 1. As regras de frequência do cronograma

**Por que este é o item mais importante:** é o núcleo do produto. Todo o resto pendura nele.

### Contexto comum a 1.1–1.5

O app coleta **10 respostas** no onboarding (nenhuma delas é imagem, exame ou medição):

`hairPattern` (liso · ondulado · cacheado · crespo · em transição/misto) ·
`scalpTendency` (oleoso rápido · equilibrado · ressecado · não sei) ·
`strandThickness` (fino · médio · grosso · não sei) ·
`washFrequency` (1×/semana ou menos · 2×/semana · 3–4×/semana · 5+/semana · varia) ·
`heatUsage` (nunca · raramente · 1–2×/semana · 3–4×/semana · quase diário) ·
`chemicalTreatments` (lista: coloração · descoloração · alisamento/progressiva · relaxamento ·
permanente · nenhuma) · `primaryGoal` (maciez e hidratação · definição e controle de frizz · reduzir
quebra e fortalecer · recuperar dano de química ou calor · manter saudável) ·
`currentConcerns` (lista: ressecamento · frizz · quebra · embaraço · falta de brilho · oleosidade ·
pontas duplas) · `perceivedPorosity` (demora a molhar · absorve normalmente · molha e seca rápido ·
não sei) · `routineAvailability` (pouco tempo · tempo médio · bastante tempo).

⚠️ **Quatro dessas dez não influenciam o cronograma hoje**, e isso é deliberado em dois casos e
acidental em dois — ver item **1.6**, que é uma pergunta direta para você.

### 1.1 Quantos cuidados por semana (`schedule.sessions_per_week`)

**Regra candidata, exata, como está no código:**

| `washFrequency` respondido | cuidados/semana no plano |
|---|---|
| 1×/semana ou menos | **1** |
| 2×/semana | **2** |
| 3–4×/semana | **3** |
| 5+/semana | **3** |
| varia | **2** |

**Onde é usada:** `packages/core/src/schedule/engine/v1/generate-schedule.ts` (constante
`SESSIONS_PER_WEEK`) e a mesma tabela na v2. É o primeiro passo de toda geração de plano.

**Comportamento atual:** define quantos cuidados o ciclo de 28 dias terá — **4, 8 ou 12**.

**Claims que habilitaria:** nenhum explícito. O app **nunca diz com que frequência lavar** — a
frequência de lavagem é tratada como **fato observado dela**, não como recomendação. A frase que a
usuária vê é *"A frequência dos cuidados acompanha a sua rotina de lavagem."*

**Capabilities que desbloqueia:** todo o cronograma (`F5`), e por dependência tudo que lê o plano.

**Riscos conhecidos:**
- Acoplar intensidade de tratamento à frequência de lavagem pode **sobretratar** quem lava muito e
  **subtratar** quem lava pouco.
- O teto em 3 é arbitrário: quem lava 7×/semana recebe o mesmo que quem lava 3×.
- `varia → 2` é uma escolha de não escalar na dúvida.

**Alternativas já discutidas e descartadas:** desacoplar cuidado de lavagem (rejeitado porque quase
todo cuidado do cronograma acontece no banho, então o plano proporia cuidados em dias em que ela não
lava); recomendar uma frequência de lavagem (**rejeitado como alegação capilar** — é exatamente o que
a D-26 proíbe).

**Perguntas objetivas:**
- **(a)** Há evidência de que a frequência de tratamento condicionante deva acompanhar a frequência
  de lavagem, em vez de ser independente dela?
- **(b)** O teto de 3 cuidados/semana tem base? Existe evidência de dano ou de ganho nulo acima de
  alguma frequência?
- **(c)** Para quem lava 5+/semana, tratar apenas 3 vezes é seguro, insuficiente ou indiferente?
- **(d)** Alguma das outras respostas (porosidade, espessura, padrão) deveria alterar este número?

### 1.2 A alternância hidratação ↔ nutrição, e o que a "ênfase" faz

**Regra candidata, exata (motor v1 — o que cada usuária recebeu até 2026-09-07):**

1. A **ênfase** é decidida por prioridade determinística:
   - **Objetivo** primeiro: `maciez e hidratação` → hidratação · `definição e controle de frizz` →
     **nutrição** · `reduzir quebra` → hidratação · `recuperar dano` → hidratação · `manter saudável`
     → não decide, segue.
   - **Queixas** depois: qualquer uma de `ressecamento, embaraço, falta de brilho, quebra` →
     hidratação; senão `frizz` → nutrição.
   - **Padrão** por último: cacheado/crespo/em transição → hidratação.
   - Sem sinal → `balanced`.
2. Os cuidados **alternam** hidratação/nutrição. A ênfase decide **apenas qual dos dois abre** o
   ciclo. ⚠️ **A proporção é sempre meio a meio.**

**Onde é usada:** `packages/core/src/diagnostic/engine/v1/assess.ts` (`decideEmphasis`) e
`.../schedule/engine/v1/generate-schedule.ts`.

**Comportamento atual — e um fato medido que você precisa saber:** o projeto rodou o motor sobre o
**espaço inteiro de respostas (307.200 perfis)** e mediu: no **v1**, um perfil de cabelo **cacheado**
recebe um cronograma **idêntico** ao de um cabelo **liso** com as mesmas outras respostas — **960 de
960 casos, zero diferença**. A ênfase só troca qual eixo abre, e `hidratação` e `balanced` abrem os
dois por hidratação.

⚠️ **Isso já derrubou uma frase do app.** O texto dizia *"Cabelos com curvatura costumam pedir mais
hidratação."* ao lado de um cronograma que **não tinha mais hidratação**. Foi corrigido para a forma
observacional *"Você marcou que seu cabelo tem curvatura."* — **essa correção já está feita** e não
depende de você.

**Claims que habilitaria:** que curvatura, queixa e objetivo justificam inclinar o cronograma para
água ou para lipídio.

**Capabilities que desbloqueia:** a personalização do plano, e a explicação *"Por que este
cronograma?"* (`F21`).

**Riscos conhecidos:** a dicotomia hidratação/nutrição é **vocabulário de mercado brasileiro**, não
necessariamente uma distinção com base físico-química nítida — um mesmo produto pode fazer as duas
coisas. Alternância meio a meio pode não corresponder a necessidade real nenhuma.

**Alternativas já discutidas:** proporção variável por perfil (**implementada no v2**, item 1.3);
abandonar a dicotomia (não discutido — exigiria refazer o produto).

**Perguntas objetivas:**
- **(a)** A distinção **hidratação (água) × nutrição (lipídio)** tem sustentação físico-química, ou é
  convenção comercial? Se for convenção, ela é **inofensiva** ou **enganosa**?
- **(b)** Há evidência de que cabelo com curvatura tenha necessidade **diferente** de água ou lipídio?
- **(c)** Faz sentido que **frizz** aponte para lipídio e **ressecamento** para água, ou os dois são o
  mesmo fenômeno visto de ângulos diferentes?
- **(d)** Alternar meio a meio é defensável como padrão, ou existe proporção com melhor sustentação?
- **(e)** ⚠️ O app deve continuar usando as palavras "hidratação" e "nutrição", já que a usuária
  brasileira as reconhece, mesmo que a base científica seja frágil? Ou isso é afirmar uma distinção
  que não existe?

### 1.3 Peso de necessidade e distribuição por quota (motor v2 — **o motor corrente**)

**Regra candidata, exata, com os números do código:**

```
sinais de dano = [ tem química?  ·  usa calor 3+×/semana?  ·  objetivo de dano OU queixa de quebra? ]
contagem = quantos dos três são verdadeiros  (0 a 3)

peso hidratação    = 3  (+1 se a ênfase for hidratação)
peso nutrição      = 3  (+1 se a ênfase for nutrição)
peso reconstrução  = 0 se contagem < 2 ; 1 se contagem == 2 ; 2 se contagem >= 3
peso restauração   = 1 SOMENTE se contagem == 3 ; senão 0

as vagas do ciclo (4, 8 ou 12) são divididas entre os quatro tipos
na proporção dos pesos, por maior-resto.

cuidados fortes (reconstrução, restauração) nunca abrem o ciclo
e nunca ficam lado a lado.
```

**Onde é usada:** `packages/core/src/schedule/engine/v2/generate-schedule.ts` (`needWeights`,
`quotaFromWeights`, `placeStrong`). **É a versão corrente desde 2026-09-07.**

**Comportamento atual, medido sobre os 307.200 perfis:** o v1 produz **12** cronogramas distintos; o
v2 produz **19**. **18,1% do espaço recebe zero reconstruções.** A restauração só aparece com os três
sinais simultâneos.

**Claims que habilitaria:** que a **quantidade** de reconstrução deve crescer com a quantidade de
sinais de dano; que existe um estado que pede um quarto tipo de cuidado.

**Capabilities que desbloqueia:** `F36` (motor por necessidade) para release, e é pré-requisito
conceitual do **`P4` cronograma adaptativo**.

**Riscos conhecidos:**
- Os números 3, 3, 0/1/2 e 1 são **hipótese de engenharia pura**. Não há fonte.
- Contar sinais heterogêneos (uma química = um calor frequente = uma queixa) trata coisas diferentes
  como equivalentes.
- Dois dos cinco objetivos já contam como "dano", o que torna a reconstrução frequente.
- ⚠️ **Excesso de reconstrução é um risco real e conhecido no uso popular** (fio rígido, quebra);
  o app já alerta sobre isso no texto do guia, mas a **frequência** que ele mesmo propõe não foi
  revisada.

**Alternativas já discutidas:** manter a regra binária do v1 (uma reconstrução por ciclo, ou nenhuma);
pesos por porosidade (**recusado** — ver 1.6).

**Perguntas objetivas:**
- **(a)** Dois de três sinais de dano justificam reconstrução no ciclo? E três justificam **duas**?
- **(b)** O peso base **3 : 3** entre condicionamento hidratante e lipídico é defensável?
- **(c)** Existe frequência **máxima** de reconstrução com base em evidência? Se sim, qual, e ela deve
  virar um teto rígido no software?
- **(d)** "Nunca lado a lado" e "nunca abre o ciclo" para cuidados fortes: há base ou é estética?
- **(e)** Um cabelo **sem nenhum sinal de dano** deve receber **zero** reconstrução, como o v2 faz?

### 1.4 Restauração — o quarto tipo de cuidado

**Regra candidata:** existe um quarto tipo chamado **restauração**, com peso 1 **apenas** quando os
três sinais de dano estão presentes, e que nunca se repete na mesma janela de 28 dias.

**Onde é usada:** `CARE_TYPE_CODES` no core, `CHECK` de duas tabelas do banco, o motor v2, e o guia
(item 2.4).

**Comportamento atual:** é o cuidado mais raro do sistema. ⚠️ **Nenhuma usuária real o recebeu até a
ativação do v2**, e o primeiro plano com restauração foi gerado em 2026-09-07.

**Claims que habilitaria:** que existe uma categoria de cuidado **distinta** de reconstrução, para
uma fase de dano mais severo.

**Capabilities que desbloqueia:** o quarto tipo em todo o produto (guia, cor, cronograma, registro).

**Riscos conhecidos:** ⚠️ **este é o item de menor sustentação de todo o pacote.** "Restauração" é
termo de mercado, e a fronteira entre ela e "reconstrução" pode não existir fisicamente. O texto do
guia foi escrito deliberadamente **sem dizer o que a restauração faz no fio**, exatamente porque a
engenharia não sabia.

**Alternativas já discutidas:** não ter o quarto tipo (era o estado até 2026-09-03); tratá-lo como
uma reconstrução mais intensa em vez de categoria própria.

**Perguntas objetivas:**
- **(a)** ⚠️ **"Restauração" é uma categoria de cuidado distinta de "reconstrução", com base
  físico-química?** Ou é o mesmo tipo de intervenção com outro nome comercial?
- **(b)** Se não for distinta, o app deve **remover** o quarto tipo, ou mantê-lo como rótulo
  reconhecível pela usuária brasileira?
- **(c)** Se for distinta, **o que exatamente** a diferencia, e o texto do guia (item 2.4) deve dizê-lo?
- **(d)** Exigir os **três** sinais simultâneos é conservador demais, adequado, ou insuficiente?

### 1.5 A janela de 28 dias e o espaçamento dos cuidados

**Regra candidata:** o plano cobre **28 dias fixos**, com os dias exatos vindos de uma tabela:

| cuidados/semana | dias a partir do início |
|---|---|
| 1 | 0, 7, 14, 21 |
| 2 | 0, 4, 7, 11, 14, 18, 21, 25 |
| 3 | 0, 2, 5, 7, 9, 12, 14, 16, 19, 21, 23, 26 |

**No v1 apenas:** quando há reconstrução, ela substitui **o primeiro cuidado no dia 14 ou depois**.

**Onde é usada:** `OFFSETS` e `RECONSTRUCTION_FROM_DAY` em `.../engine/v1/generate-schedule.ts`.

**Comportamento atual:** define o calendário que a usuária vê e os lembretes que recebe.

**Claims que habilitaria:** que 28 dias é um período de ciclo sensato e que esses intervalos são
adequados.

**Riscos conhecidos:** 28 dias é herdado do uso popular brasileiro ("cronograma mensal"), não de
fisiologia. O dia 14 para reconstrução é arbitrário.

**Perguntas objetivas:**
- **(a)** Há base para um ciclo de 28 dias, ou é convenção de calendário?
- **(b)** Os intervalos (2 a 7 dias entre cuidados) são compatíveis com o que se sabe sobre sorção e
  perda de água e lipídios pelo fio?
- **(c)** Faz diferença **onde** no ciclo a reconstrução cai?

### 1.6 ⚠️ As quatro perguntas que o app faz e não usa — decisão sua

**Fato medido:** das 10 perguntas do onboarding, **quatro não alteram o cronograma**:

| pergunta | por que não é usada |
|---|---|
| `perceivedPorosity` (porosidade percebida) | ⛔ **Recusa deliberada da engenharia.** Traduzir porosidade em frequência foi julgada a alegação mais substantiva do conjunto, e a D-26 proíbe engenharia de inventá-la. Há **teste automatizado** garantindo que o plano é invariante a ela. |
| `routineAvailability` (tempo disponível) | ⛔ **Veto explícito do dono:** *"este cuidado cabe no seu tempo"* seria recomendação capilar. Também com teste. |
| `strandThickness` (espessura do fio) | ⚠️ **Nunca teve consumidor nem veto.** Ninguém decidiu que não deve contar; simplesmente não existe regra que a use. |
| `scalpTendency` (tendência do couro) | ⚠️ **Idem.** |

**Risco conhecido:** perguntar e não usar custa o tempo dela e sugere uma personalização que não
acontece.

**Perguntas objetivas:**
- **(a)** ⚠️ **A porosidade percebida deve influenciar a frequência ou a proporção dos cuidados?** Se
  sim, **como exatamente** — e qual a evidência? (Esta é a pergunta de maior valor do pacote inteiro.)
- **(b)** A **espessura do fio** deve influenciar? Como?
- **(c)** A **tendência do couro** deve influenciar o cronograma do **comprimento**? Ou são coisas
  independentes?
- **(d)** Alguma delas deve ser **removida do onboarding** por não ter uso defensável?

---

## 2. O conteúdo dos guias de cuidado

**O que são:** um texto por tipo de cuidado, exibido em *"Como fazer"*. Cada um tem: o que é ·
passos · duração estimada · erros comuns.

**Onde é usado:** `packages/core/src/content/v1/guides.ts` (`CARE_GUIDES_V1`), exibido na aba
Cuidados e no cartão do cuidado do dia.

**Restrições que o texto já respeita (verificadas por teste automatizado):** sem marca, sem produto
comercial, sem dosagem química, sem resultado prometido, sem linguagem de diagnóstico. Onde o tempo
importa, o texto **remete à embalagem do produto dela** em vez de dar um número inventado.

### 2.1 Hidratação — texto exato

> **O que é:** "Repõe a água que o fio perde no dia a dia. É o cuidado que devolve maciez e movimento."
>
> **Passos:** 1. Lave o cabelo como de costume e retire o excesso de água com a toalha. · 2. Separe o
> cabelo em mechas e aplique a máscara de hidratação do comprimento às pontas. · 3. Evite a raiz e o
> couro cabeludo. · 4. Deixe agir pelo tempo indicado na embalagem do seu produto. · 5. Enxágue bem,
> até a água sair limpa.
>
> **Duração:** 20 min.
>
> **Erros comuns:** Aplicar na raiz — o cabelo fica pesado e volta a ficar oleoso mais rápido. ·
> Enxaguar antes do tempo indicado na embalagem. · Aplicar no cabelo encharcado — o excesso de água
> dilui a máscara.

### 2.2 Nutrição — texto exato

> **O que é:** "Repõe os óleos naturais do fio. É o cuidado que devolve brilho e ajuda a controlar o
> frizz."
>
> **Passos:** 1. Lave o cabelo e retire bem o excesso de água. · 2. Aplique a máscara de nutrição do
> meio às pontas, mecha por mecha. · 3. Deixe agir pelo tempo indicado na embalagem do seu produto. ·
> 4. Enxágue bem.
>
> **Duração:** 20 min.
>
> **Erros comuns:** Repetir a nutrição em dias seguidos — o excesso de óleo deixa o fio pesado e sem
> volume. · Aplicar na raiz. · Enxaguar pela metade e deixar resíduo no fio.

### 2.3 Reconstrução — texto exato

> **O que é:** "Repõe a massa que o fio perde com química, calor e atrito. É o cuidado mais forte do
> cronograma, por isso entra com menos frequência."
>
> **Passos:** 1. Lave o cabelo e retire bem o excesso de água. · 2. Aplique a máscara de reconstrução
> em mechas finas, do comprimento às pontas. · 3. Respeite o tempo da embalagem — aqui, deixar agindo
> mais tempo não melhora o resultado. · 4. Enxágue bem. · 5. Se a embalagem do seu produto indicar,
> finalize com hidratação ou nutrição.
>
> **Duração:** 25 min.
>
> **Erros comuns:** Deixar agir além do tempo indicado na embalagem. · Fazer reconstrução com mais
> frequência do que o cronograma pede — o fio fica rígido e quebra com mais facilidade. · Pular a
> hidratação ou a nutrição seguinte quando a embalagem indicar.

### 2.4 Restauração — texto exato

> **O que é:** "É o cuidado de recuperação do cronograma: entra em fases em que o cabelo pede mais
> atenção do que a rotina normal, e sai quando a fase passa."
>
> **Passos:** 1. Lave o cabelo e retire bem o excesso de água. · 2. Aplique o produto de recuperação
> em mechas finas, do comprimento às pontas. · 3. Evite a raiz e o couro cabeludo. · 4. Deixe agir
> pelo tempo indicado na embalagem do seu produto. · 5. Enxágue bem e siga o que a embalagem indicar
> para depois.
>
> **Duração:** 30 min.
>
> **Erros comuns:** Deixar agir além do tempo indicado na embalagem. · Repetir por conta própria
> antes do que o cronograma pede. · Trocar por outro cuidado no meio da fase, sem registrar a troca.

⚠️ **Note que este texto evita dizer o que a restauração faz** — foi escrito assim de propósito,
porque a engenharia não tinha base. Se você validar o item 1.4, provavelmente precisará reescrever
este "o que é".

### 2.5 Análise dos guias

**Claims que habilitariam:** todas as afirmações mecanicistas acima — que hidratação repõe água, que
nutrição repõe óleos, que reconstrução repõe massa, que aplicar na raiz deixa oleoso mais rápido, que
reconstrução em excesso enrijece o fio, que deixar agir mais tempo não melhora o resultado.

**Capabilities que desbloqueia:** `F7` (conteúdo), e o *"Como fazer"* de toda a aba Cuidados.

**Riscos conhecidos:**
- ⚠️ **"Erros comuns" são as afirmações mais fortes do pacote** e as menos fundamentadas. *"O fio
  fica rígido e quebra com mais facilidade"* é uma afirmação de dano.
- As durações (20/20/25/30 min) são estimativas sem fonte.
- *"Evite a raiz"* é repetido em três dos quatro guias e pode ser conselho desnecessário.

**Alternativas já discutidas:** remover os "erros comuns" (mantidos porque são a parte mais útil do
guia na percepção do dono); dar tempos numéricos (rejeitado — remeter à embalagem foi julgado mais
seguro).

**Perguntas objetivas:**
- **(a)** Cada frase de "o que é" descreve corretamente o mecanismo? Se não, **reescreva**.
- **(b)** Os "erros comuns" têm base? Especificamente: aplicar condicionante na raiz aumenta
  oleosidade? Reconstrução frequente causa rigidez e quebra? Tempo além do indicado é inócuo ou
  prejudicial?
- **(c)** As durações são plausíveis, ou devem sair?
- **(d)** Falta algum passo relevante de **segurança** (por exemplo, teste de mecha, ou o que fazer em
  caso de irritação)?
- **(e)** ⚠️ Há algo nesses textos que **contraindique** uma condição de couro ou um quadro
  dermatológico e que precise de aviso?

---

## 3. As finalizações — vocabulário e o conteúdo ainda bloqueado

### 3.1 O vocabulário (já aprovado pelo dono, ainda `candidate`)

**Lista exata:** `fitagem_tradicional` · `fitagem_estruturada` · `dedoliss` · `rake_and_shake` ·
`plopping` · `twist_out` · `other` ("fiz uma fora desta lista") · `unknown` ("não sei o nome").

**Onde é usada:** `FINISH_TECHNIQUES` em `packages/core/src/care-tracking/domain/wash-day.ts`, com
`CHECK` no banco; exibida na tela de registro e na área Finalizações.

**Comportamento atual:** ⚠️ **serve apenas para REGISTRO.** A usuária marca qual finalização fez. O
app **não recomenda nenhuma**, não descreve nenhuma e não ensina nenhuma.

**Claims que habilitaria hoje:** nenhum. *"Eu fiz fitagem"* é fato relatado por ela.

**Riscos conhecidos:** são nomes de técnica populares no Brasil, sem padronização. Duas pessoas podem
chamar coisas diferentes de "fitagem".

**Perguntas objetivas:**
- **(a)** Os nomes são reconhecíveis e distintos o bastante para servirem de vocabulário estável?
- **(b)** Falta alguma técnica de finalização relevante no Brasil?
- **(c)** Alguma delas apresenta **risco** (tração, quebra, retenção de umidade prolongada) que
  justifique um aviso?

### 3.2 O que está bloqueado e depende de você

⛔ **Nada disto existe no app**, e a superfície está construída e vazia, esperando:

1. **"Como fazer" passo a passo** de cada finalização.
2. **Descrição/apresentação** de cada técnica (o que é, para que serve).
3. **"Recomendadas para você"** — indicação por curvatura ou perfil.
4. **Ranking** entre finalizações.

**Capabilities que desbloqueia:** o resto do `F38` (área de Finalizações completa).

**Perguntas objetivas:**
- **(a)** É defensável indicar finalização **por padrão de curvatura**? Com que evidência?
- **(b)** Se sim, **qual técnica para qual padrão**, e qual o nível de evidência de cada par?
- **(c)** Se não, o app deve manter as finalizações **apenas como registro**, para sempre?
- **(d)** Se você puder escrever um "como fazer" por técnica, ele entra como `validated`. **Escreva-o**
  aqui, com fonte.

---

## 4. As marcas do check-in, e o limite da atribuição

### 4.1 O vocabulário (ainda `candidate`)

**Lista exata:** `maciez` · `brilho` · `frizz` · `definição` · `ressecamento`.

**Onde é usada:** `CHECKIN_MARKS` em `packages/core/src/care-tracking/domain/care-tracking.ts`.

**Comportamento atual:** depois de dar a nota de 1 a 5, a usuária pode marcar, opcionalmente, o que
notou. A lista **mistura qualidades de sinal oposto de propósito** — a nota carrega a valência, e a
lista é neutra. A pergunta é *"O que você notou?"*.

**Riscos conhecidos:** são percepções subjetivas, não medidas. "Definição" e "frizz" podem ser o mesmo
fenômeno para pessoas diferentes.

**Perguntas objetivas:**
- **(a)** Essas cinco são as qualidades certas para alguém descrever o resultado de um cuidado?
- **(b)** Falta alguma (volume, peso, cacho formado, maleabilidade)?
- **(c)** Elas são independentes o bastante para serem contadas separadamente?

### 4.2 ⚠️ A atribuição — o limite mais importante do produto

**O que o app faz hoje:** conta co-ocorrência e diz, por exemplo:

> *"Máscara da feira — esteve em 4 dos 5 cuidados que você avaliou bem."*
> *"Frizz — você notou em 4 dos 6 cuidados que você avaliou."*

**O que o app se recusa a fazer hoje:** ligar uma marca a uma entrada. A frase proibida seria:

> ⛔ *"Nos cuidados em que você usou a Máscara X, você notou maciez em 4 de 5."*

**Por que a recusa:** *"esteve em 4 dos 5 que você avaliou bem"* co-ocorre com **o julgamento geral
dela**. *"Você notou maciez"* co-ocorre com um **atributo capilar nomeado** — e a distância entre
"apareceu junto" e "causou" colapsa na leitura quando o resultado tem nome de propriedade do cabelo.

**Capabilities que desbloqueia:** `P14` (insights de cabelo), e é o degrau conceitual imediatamente
antes de **`P18` (recomendações personalizadas)**.

**Riscos conhecidos:** amostras minúsculas (o app mostra a partir de 5 cuidados avaliados); nenhum
controle; confusão por variáveis não registradas (clima, sono, água, hormônio).

**Perguntas objetivas:**
- **(a)** ⚠️ **Com que tamanho de amostra, se algum, é defensável dizer a uma pessoa que uma
  observação dela se associa a um produto ou técnica que ela usou?**
- **(b)** Existe formulação que comunique associação **sem** sugerir causa, ou a associação é
  inevitavelmente lida como causa por quem não é técnico?
- **(c)** Se for defensável, **qual formulação exata** você aprova? Escreva-a.
- **(d)** Se não for, o app deve parar onde está — contando co-ocorrência com o julgamento geral — e
  **nunca** nomear o atributo junto da entrada?

---

## 5. Couro cabeludo — sintoma clínico

**Estado:** ⛔ **não existe no app.** O banco **recusa** os valores `itching`, `flaking` e `sensitive`
antes de qualquer revisão.

**O que existe:** a usuária registra a tendência do couro no Wash Day com três valores **não
clínicos**: `oleoso rápido` · `equilibrado` · `ressecado` — reaproveitando o vocabulário já aceito do
onboarding.

**O que está bloqueado:** coceira, descamação, dor, queda, sensibilidade.

**Capabilities que desbloqueia:** a metade `couro` do `P13`, e o `P15` (insights de couro).

⚠️ **Este item tem DUAS chaves, e você só tem uma.** Além do sign-off de domínio, ele exige **base
legal LGPD** para tratar dado de saúde (a tabela de consentimentos não existe). **Mesmo que você
valide, ele continua bloqueado** até o dono resolver a parte jurídica.

**Riscos conhecidos:** a fronteira entre cosmético e clínico é fina. Coletar sintoma sem orientar pode
atrasar cuidado médico; orientar sem ser profissional é exercício ilegal.

**Perguntas objetivas:**
- **(a)** Um app de cronograma capilar **deve** coletar sintoma de couro? Qual o benefício e qual o
  risco?
- **(b)** Se sim, **quais** sintomas são seguros de coletar sem virar triagem clínica?
- **(c)** Que **sinais de alerta** deveriam disparar *"procure um profissional"*, e com que texto?
- **(d)** Há sintoma que o app **jamais** deveria registrar?

---

## 6. `F24` SOS e `F30` orientação profissional — ainda sem conteúdo

**Estado:** ambos `COMMITTED`, **sem uma linha escrita**, porque os dois são conteúdo capilar
substantivo por natureza.

- **`F24` SOS básico:** o que fazer quando algo deu errado (química malsucedida, quebra súbita,
  ressecamento extremo).
- **`F30` orientação profissional:** quando procurar um profissional.

**Perguntas objetivas:**
- **(a)** Que situações um app **pode** orientar com segurança, e quais deve apenas encaminhar?
- **(b)** Para o `F30`: quais são os critérios objetivos de *"procure um profissional"*?
- **(c)** Você consegue escrever esses dois conteúdos com fonte? Se sim, **escreva-os** — eles entram
  como `validated`.

---

## 7. Resumo — o que cada veredito libera

| Item | Libera | Também depende de |
|---|---|---|
| **1.1–1.6** regras de frequência | **PUBLIC RELEASE do cronograma** (o núcleo). Sem isto, nada é publicável | — |
| **2** guias | *"Como fazer"* dos quatro cuidados | — |
| **3.2** conteúdo de finalização | O resto do `F38` | — |
| **4.2** atribuição | `P14`, e o degrau antes de **`P18` recomendações** e **`P4` adaptativo** | — |
| **5** couro | Metade `couro` do `P13`, `P15` | ⛔ **base legal LGPD** |
| **6** SOS e orientação | `F24`, `F30` | — |

⚠️ **O item 1 é o bloqueador raiz.** Enquanto as regras de frequência forem `candidate`, o app **não
pode ser publicado**, por mais que tudo o mais esteja validado.

---

## 8. O que **não** está sendo perguntado

Para você não gastar esforço onde não é preciso:

- ⛔ **Não** se pede opinião de produto, interface, preço ou estratégia.
- ⛔ **Não** se pede revisão de código, arquitetura ou segurança.
- ⛔ **Não** se pede recomendação de marca ou produto comercial — o app não vende, não indica marca e
  não tem afiliado.
- ⛔ **Não** se pede diagnóstico de pessoa alguma. Não há usuária real neste pacote, e nenhum dado
  pessoal aparece aqui.

---

## 9. Contexto de governança (para o revisor entender o peso da resposta)

- O veredito é registrado no repositório e altera o campo `validation_status` de cada regra, de
  `candidate` para `validated`, `needs change` ou `rejected`.
- Existe um teste automatizado que **impede o lançamento público** com qualquer regra não validada.
- Um item marcado `rejected` **não quebra o app**: aquela parte simplesmente continua bloqueada para
  release, e o resto do produto segue.
- ⚠️ **A engenharia não pode sobrepor este veredito.** A regra D-26 existe justamente para que a
  pressa de entregar não vire afirmação capilar publicada.
