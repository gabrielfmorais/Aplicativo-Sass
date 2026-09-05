import type { InsightsView } from '@app/core';

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
  const repeated = view.observations.filter((o) => o.kind !== 'noticed');

  return (
    <Screen footer={footer}>
      {header}
      {/*
        ⚠️ **Duas seções, e o rótulo é o que as separa.** Um cartão diz *"esteve em 4 dos 5 cuidados
        que você avaliou bem"* e outro *"apareceram juntos em 5 cuidados que você avaliou"* — os
        denominadores são diferentes, e sem o título eles se pareceriam demais para números tão
        parecidos.
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
          {noticed.map((o) => (
            <Card key={o.key}>
              <Stack gap="sm">
                <Text variant="heading" accessibilityRole="header">
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
                <Text variant="heading" accessibilityRole="header">
                  {o.subject}
                </Text>
                <Text tone="muted">{o.detail}</Text>
              </Stack>
            </Card>
          ))
        ) : (
          <Text tone="muted">{missingReason(view)}</Text>
        )}
      </Stack>

      {/*
        SPEC-050 (`P8`) — **as combinações.**

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
                <Text variant="heading" accessibilityRole="header">
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
          <Text tone="muted">
            A Huna ainda está conhecendo suas combinações. Ela só mostra um padrão quando as duas coisas
            apareceram juntas em pelo menos 3 cuidados que você avaliou — com menos que isso, uma repetição é
            só coincidência.
          </Text>
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
