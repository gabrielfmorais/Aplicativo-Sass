import type { InsightsView, Observation } from '@app/core';

import { Button, Card, Loading, Screen, Stack, Tag, Text } from '@/design/primitives';

/**
 * SPEC-047 (P2) — **Seus padrões**.
 *
 * ⚠️ **O nome é modesto de propósito.** O Blueprint chama a capability de *"O que funciona
 * comigo?"*, e é para lá que ela caminha — mas essa frase, hoje, prometeria **causa**, e o que esta
 * camada entrega é **repetição**. Um título que afirma mais do que os dados sustentam é a primeira
 * forma de inventar insight, e a mais difícil de perceber depois.
 *
 * ⚠️ **Observação, nunca causa** (Blueprint §12): *"esteve em 4 dos seus 6 melhores"* é contagem
 * nos registros dela; *"melhorou seu cabelo"* seria alegação capilar (D-26/D-70). A primeira frase
 * da tela diz isso em voz alta, porque quem lê um número tende a completar a causa sozinha.
 *
 * ⚠️ **Nada é inventado para preencher.** Sem volume, a tela **diz que ainda está conhecendo a
 * rotina dela** — e esse é o estado normal de quem começou agora, não um erro.
 */
export function InsightsScreen({
  view,
  loading,
  failed,
  entitled,
  onRetry,
  onBack,
}: {
  view: InsightsView | null;
  loading: boolean;
  failed?: boolean;
  /** `advanced_insights` — decidido pelo servidor, nunca por uma checagem de tela. */
  entitled: boolean;
  onRetry?: () => void;
  onBack: () => void;
}) {
  const footer = <Button label="Voltar" variant="ghost" onPress={onBack} />;
  const header = (
    <Stack gap="sm">
      <Text variant="display" accessibilityRole="header">
        Seus padrões
      </Text>
      {/*
        A frase que define a capability, e o limite dela. "Apareceu junto" e "causou" são coisas
        diferentes, e é a Huna que tem de dizer qual das duas está mostrando.
      */}
      <Text tone="muted">
        São repetições nos seus próprios registros. A Huna mostra o que apareceu junto — não o que causou o
        quê.
      </Text>
    </Stack>
  );

  /**
   * Premium **como adição**, nunca como muro (D-83): a tela existe, explica o que ela acrescenta, e
   * não sugere que o Free seja uma versão quebrada esperando desbloqueio.
   */
  if (!entitled) {
    return (
      <Screen footer={footer}>
        {header}
        <Card>
          <Stack gap="sm">
            <Text variant="heading" accessibilityRole="header">
              Faz parte do premium
            </Text>
            <Text tone="muted">
              Comparar seus registros para encontrar repetições é uma das coisas que o premium acrescenta. Seu
              histórico continua sendo seu, e continua sendo registrado do mesmo jeito.
            </Text>
          </Stack>
        </Card>
      </Screen>
    );
  }

  if (loading) return <Loading label="Lendo seus registros…" />;

  if (!view) {
    return (
      <Screen footer={footer}>
        {header}
        <Card>
          <Stack gap="lg">
            <Text variant="heading" accessibilityLiveRegion="polite">
              Não foi possível ler seus registros agora.
            </Text>
            {failed && onRetry ? <Button label="Tentar novamente" onPress={onRetry} /> : null}
          </Stack>
        </Card>
      </Screen>
    );
  }

  /**
   * ⚠️ **O estado de poucos dados é a maior parte da vida útil da capability** para quem começou
   * agora — então ele é conteúdo, não placeholder: diz **o que falta** e **por quê**, em vez de
   * girar ou mostrar uma lista vazia.
   */
  /**
   * ⚠️ **SPEC-050 EC3 — as duas listas, não uma.** Um par pode alcançar 3 cuidados **avaliados**
   * enquanto nenhum item isolado alcança 3 cuidados **bem avaliados**: os denominadores são
   * diferentes. Olhar só `observations` esconderia padrões que existem.
   */
  if (!view.enoughData || (view.observations.length === 0 && view.patterns.length === 0)) {
    return (
      <Screen footer={footer}>
        {header}
        <Card>
          <Stack gap="sm">
            <Text variant="heading" accessibilityRole="header">
              A Huna ainda está conhecendo sua rotina
            </Text>
            {/*
              ⚠️ **Três silêncios diferentes, e dizer o errado é pior que não dizer nada.**
              A versão anterior tinha uma frase só e, com doze cuidados avaliados e nenhum produto
              marcado, ela dizia *"a partir de 5 a Huna começa a comparar"* — apontando para um
              volume que ela **já tinha**, e escondendo o motivo real. Cada estado agora diz o que
              **de fato** falta, porque é isso que ela pode fazer a respeito.
            */}
            <Text tone="muted">{missingReason(view)}</Text>
            {/*
              Por que esperar, dito com franqueza: com pouco registro, "padrão" é coincidência com
              cara de descoberta — e é melhor não dizer nada do que dizer isso.
            */}
            <Text variant="caption" tone="muted">
              Com poucos registros, uma repetição é só coincidência. A Huna prefere esperar a dizer algo que
              não se sustenta.
            </Text>
          </Stack>
        </Card>
      </Screen>
    );
  }

  /**
   * SPEC-051 — as marcações vão para a **sua** seção, e não para a lista de repetições: os
   * denominadores são diferentes, e misturá-las poria "que você avaliou" ao lado de "que você
   * avaliou bem" sem nada explicando a diferença.
   */
  const noticed = view.observations.filter((o) => o.kind === 'noticed');
  const repeated = view.observations.filter(isRepeated);

  return (
    <Screen footer={footer}>
      {header}
      {/*
        ⚠️ **Três seções, e cada uma responde a UMA pergunta** — SPEC-050 OQ1, decidida em
        2026-09-06 com a preferência do dono de simplificar a experiência **sem** apagar a distinção
        de dado por baixo.

        > *o que eu notei* · *o que se repete* (uma coisa) · *o que andou junto* (duas coisas)

        ⚠️ **O que mudou foi a arrumação, não a fronteira.** O par de produtos era a observação
        `combo` e vivia em *"O que se repete"*, contado dentro dos cuidados **bem avaliados**; a tela
        ficava com **duas** seções de "coisas que andaram juntas", com frases e denominadores
        diferentes, e a de cima ainda misturava item isolado com par. Agora todo par é `Pattern`,
        com uma frase, um denominador e **um** teto de três para todos.

        ⚠️ **O rótulo continua sendo o que separa os denominadores.** *"esteve em 4 dos 5 cuidados
        que você avaliou bem"* e *"apareceram juntos em 5 cuidados que você avaliou"* são números
        parecidos com significados diferentes — juntá-los numa lista só seria simplificar a tela
        mentindo sobre o dado.
      */}
      {/*
        SPEC-051 (`P13`) — **o que ela tem notado.**

        ⚠️ **Sem atribuição, e é aqui que a linha passa.** *"Frizz — você notou em 6 dos 12 cuidados
        que avaliou"* é ela se relendo: nenhuma entrada é apontada como origem. *"Com a Máscara X
        você notou maciez em 4 de 5"* seria **nomear um efeito capilar e atribuí-lo a um produto**, a
        alegação que a D-26/D-70 reserva a revisor de domínio.

        ⚠️ **O denominador é TODO cuidado avaliado**, não o subconjunto bem avaliado: a marca **é** o
        resultado, e contá-la dentro de "avaliou bem" seria contar um resultado dentro de outro.
      */}
      {noticed.length > 0 ? (
        <Stack gap="md">
          <Text variant="overline" tone="accent" accessibilityRole="header">
            O que você tem notado
          </Text>
          {/*
            ⛔ **FR3 — sem rótulo de dimensão aqui.** O título da seção já diz o que estas são, e
            repetir seria ruído. É também a única seção cujo conteúdo é **resultado** e não entrada
            (SPEC-051): a marca é o que ela **observou**, não o que ela **fez**.
          */}
          {noticed.map((o) => (
            <Card key={o.key}>
              <Stack gap="sm">
                <Text variant="heading" accessibilityRole="header" numberOfLines={2}>
                  {o.subject}
                </Text>
                <Text tone="muted">{o.detail}</Text>
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : null}

      <Stack gap="md">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          O que se repete
        </Text>
        {repeated.length > 0 ? (
          repeated.map((o) => (
            <Card key={o.key}>
              <Stack gap="sm">
                {/*
                  SPEC-064 FR1/FR4 — ⚠️ **a dimensão, que a tela jogava fora.** O core entrega quatro
                  (`product · technique · finish · noticed`) e a SPEC-047 passou três fatias dando a
                  cada uma o **verbo certo** — *"esteve em"*, *"você fez em"*, *"você finalizou assim
                  em"*. A tela lia o `kind` **uma vez**, só para separar as marcações, e renderizava
                  as outras três com o mesmo cartão: quem olhava não sabia se estava lendo um
                  produto, um jeito de fazer ou uma finalização.

                  ⛔ **Rótulo, não ícone** (FR2): quatro categorias abstratas se dizem melhor em
                  palavra. E é substantivo neutro — *"Produto"* diz de onde o dado saiu; *"produto
                  que funciona"* seria alegação (BR2).
                */}
                <Text variant="overline" tone="muted">
                  {DIMENSION_LABEL[o.kind]}
                </Text>
                <Text variant="heading" accessibilityRole="header" numberOfLines={2}>
                  {o.subject}
                </Text>
                {/*
                  ⛔ **A frase vem inteira do core, e a tela não encosta nela** (§3). O próprio core
                  diz por quê: *"espalhar a redação por dentro da tela é como uma afirmação causal
                  entraria sem ninguém notar"*. Por mais que destacar o número ajudasse a escanear, a
                  hierarquia tem de vir de **tudo em volta** da frase, nunca de dentro.
                */}
                <Text tone="muted">{o.detail}</Text>
              </Stack>
            </Card>
          ))
        ) : (
          /*
            FR5 — ⚠️ **o mesmo tratamento da seção irmã, e por consistência de LEITURA, não de
            estilo.** Duas seções vizinhas dizendo *"ainda não há"* com pesos diferentes fariam a
            primeira parecer um achado e a segunda um estado — quando as duas são a mesma coisa.
          */
          <Card tone="muted">
            <Text tone="muted">{missingReason(view)}</Text>
          </Card>
        )}
      </Stack>

      {/*
        SPEC-050 (`P8`) — **as combinações: duas coisas que ela registrou no mesmo cuidado.**

        ⚠️ **É a única seção de par da tela** (OQ1). Dois produtos, produto e técnica, técnica e
        finalização — todos entram por aqui, com a mesma frase.

        ⚠️ **Co-ocorrência com resultado, nunca efeito.** *"Apareceram juntos em 5 cuidados que você
        avaliou, e em 4 deles você avaliou bem"* é contagem nos registros dela; *"essa combinação é
        ideal para você"* seria alegação capilar (D-26/D-70), e não existe caminho de código que a
        produza.

        ⚠️ **Poucas, de propósito** (NG6): no máximo três. Uma tela cheia de combinações é uma tela
        estatística, e a decisão do dono foi que poucos padrões informativos valem mais que
        cobertura.
      */}
      <Stack gap="md">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          Suas combinações
        </Text>
        {view.patterns.length > 0 ? (
          view.patterns.map((p) => (
            <Card key={p.key}>
              <Stack gap="sm">
                <Text variant="heading" accessibilityRole="header" numberOfLines={2}>
                  {p.subject}
                </Text>
                <Text tone="muted">{p.detail}</Text>
              </Stack>
            </Card>
          ))
        ) : (
          /*
            ⚠️ **Estado honesto, não placeholder.** Sem par com amostra suficiente, a Huna diz isso —
            e não preenche a seção com combinação nenhuma.
          */
          /*
            SPEC-064 FR5 — ⚠️ **o estado ganhou um contêiner, e a razão é hierarquia.** Solto, este
            parágrafo tinha o mesmo peso de um achado e ocupava mais espaço que os dois juntos: a
            **explicação** dominava a tela que existe para mostrar **descobertas**. Num cartão
            apagado ele lê como estado — que é o que é —, do mesmo jeito que os estados do painel do
            cuidado. ⛔ O texto não mudou: continua dizendo por que a Huna prefere esperar.
          */
          <Card tone="muted">
            <Text tone="muted">
              A Huna ainda está conhecendo suas combinações. Ela só mostra um padrão quando as duas coisas
              apareceram juntas em pelo menos 3 cuidados que você avaliou — com menos que isso, uma repetição
              é só coincidência.
            </Text>
          </Card>
        )}
      </Stack>
      {/*
        ⚠️ **Rastreabilidade**, exigida pelo Blueprint: ela consegue ver de onde saiu cada número.
        Sem esta linha, a lista pareceria vir de algum lugar que não os registros dela.
      */}
      <Stack gap="sm">
        <Tag label={`Com base em ${view.ratedCares} cuidados que você avaliou`} tone="neutral" />
        <Text variant="caption" tone="muted">
          {/*
            ⚠️ "a resposta que você deu", não "a nota". O check-in é dela e a escala é dela — mas a
            palavra *nota* arrasta a ideia de avaliação **da Huna sobre o cabelo**, que é recusa
            registrada em três SPECs. A barreira de teste reprova a palavra, e está certa.
          */}
          Tudo aqui sai do que você registrou: os cuidados que concluiu, o que marcou que usou, como fez e
          finalizou, a resposta que deu no check-in e o que notou depois.
        </Text>
      </Stack>
    </Screen>
  );
}

/**
 * SPEC-064 FR1 — a dimensão de onde o dado saiu, em palavra.
 *
 * ⚠️ **Derivada do `kind`, nunca inferida do texto** (BR1) — ler o `detail` para adivinhar a
 * dimensão seria a tela reinterpretando a frase que o core monta de propósito (§3).
 */
type RepeatedKind = Exclude<Observation['kind'], 'noticed'>;

const DIMENSION_LABEL: Record<RepeatedKind, string> = {
  product: 'Produto',
  technique: 'Técnica',
  finish: 'Finalização',
};

/**
 * ⚠️ **A FR3 vira fato de compilação, e não um rótulo que nunca aparece.**
 *
 * A primeira versão tinha `noticed: 'Você notou'` na tabela só para o `Record` ficar exaustivo — uma
 * string que **nenhum caminho de código renderiza**, porque a seção de marcações não usa rótulo. Com
 * o `Exclude` e este guarda, a tabela contém exatamente o que existe na tela, e uma dimensão nova
 * continua quebrando o build até alguém decidir o rótulo dela.
 */
const isRepeated = (o: Observation): o is Observation & { kind: RepeatedKind } => o.kind !== 'noticed';

/**
 * Por que ainda não há padrão — em uma frase, e sempre a **verdadeira**.
 *
 * A ordem importa: cada pergunta só faz sentido depois da anterior. Sem cuidado avaliado não há o
 * que comparar; com poucos, comparar seria coincidência; com muitos avaliados mas nada marcado, o
 * que falta é o registro, não o volume; e com tudo isso pronto, o que falta é simplesmente uma
 * repetição — que pode nunca vir, e tudo bem.
 */
const missingReason = (view: InsightsView): string => {
  if (view.ratedCares === 0) {
    return 'Para comparar, a Huna precisa de cuidados que você tenha avaliado no check-in. Ainda não há nenhum.';
  }
  if (!view.enoughData) {
    const falta = view.ratedCaresMissing;
    return `Você já avaliou ${view.ratedCares} ${view.ratedCares === 1 ? 'cuidado' : 'cuidados'}. ${
      falta === 1 ? 'Falta 1' : `Faltam ${falta}`
    } para a Huna começar a comparar o que se repete.`;
  }
  if (view.ratedCaresWithRecord === 0) {
    return `Você avaliou ${view.ratedCares} cuidados, e ainda não registrou nada em nenhum deles. A Huna compara o que você marca no registro — produto, técnica ou finalização —, e é dali que sai a repetição.`;
  }
  return `A Huna já está comparando os ${view.ratedCaresWithRecord} ${
    view.ratedCaresWithRecord === 1 ? 'cuidado' : 'cuidados'
  } em que você registrou alguma coisa, e ainda não encontrou nada que se repita o bastante.`;
};
