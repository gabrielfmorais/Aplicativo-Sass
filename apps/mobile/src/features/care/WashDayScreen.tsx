import type {
  FinishStatus,
  FinishTechnique,
  Product,
  ProductCategory,
  ProductPort,
  ScalpFeel,
  WashDayPort,
  WashDayTechnique,
} from '@app/core';
import {
  FINISH_STATUSES,
  FINISH_TECHNIQUES,
  PRODUCT_CATEGORIES,
  PRODUCT_NAME_MAX_LENGTH,
  SCALP_FEELS,
  WASH_DAY_TECHNIQUES,
} from '@app/core';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, Chip, Field, Loading, Row, Screen, Stack, Text } from '@/design/primitives';
import { useAddProduct } from '@/features/shelf/use-add-product';
import { reasonOf } from '@/shared/failure-detail';

/**
 * SPEC-024 (F25) — o que ela realmente fez neste cuidado.
 *
 * O app já sabia o que estava **planejado** e se ela **fez**. Some tudo o que está no meio: o que
 * ela pôs no cabelo e o que fez com ele. É esse meio que `P5`, `P6`, `P8` e a Hair Intelligence vão
 * ler — e é por isso que o Blueprint §9 chama o Wash Day de estrutural, não de tela de anotação.
 *
 * **Nenhum campo de texto sobre o cuidado** (AC7). Produtos vêm da prateleira dela; técnicas vêm de
 * lista fechada. O único campo digitável da tela cadastra um **produto** (SPEC-023), e está aqui
 * porque cadastrar custa menos no minuto em que ela acabou de usar o vidro (FR6).
 *
 * **Não interpreta e não pontua** (NG2/NG3/AC8). Nada aqui liga produto a resultado, sugere, compara
 * ou cobra: ler é `P5`/`P6`/`P8`, é Premium, e exige um volume que ela ainda não tem. *Como ficou*
 * também não se pergunta aqui — já é o check-in da mesma execução (NG5).
 *
 * **Sem botão de salvar.** Cada marcação é uma escrita própria: uma que falha não derruba as outras,
 * e a tela diz qual falhou (§16). Sair no meio e voltar preserva o que ela marcou (AC3).
 */

/**
 * Cada rótulo nomeia o que ela FAZ, nunca o que aquilo provoca. "Umectação antes" é um procedimento;
 * "sela as cutículas" seria afirmação capilar e jogaria a capability no gate de domínio (D-26/D-70).
 */
export const TECHNIQUE_LABEL: Record<WashDayTechnique, string> = {
  pre_wash_oil: 'Umectação antes',
  scalp_massage: 'Massagem no couro',
  double_cleanse: 'Lavei duas vezes',
  co_wash: 'Só condicionador',
  left_on_longer: 'Deixei agir mais tempo',
  cold_rinse: 'Enxaguei com água fria',
  detangled_with_fingers: 'Desembaracei com os dedos',
  wide_tooth_comb: 'Pente de dente largo',
  air_dried: 'Secou naturalmente',
  blow_dried: 'Secador',
  heat_protectant: 'Protetor térmico',
  scrunched: 'Amassei os fios',
  diffuser: 'Difusor',
  protective_style: 'Prendi o cabelo',
};

/**
 * SPEC-025 BR3 — **nenhum é melhor que outro.** Não há ordem, não há escala e não há ícone de
 * positivo ou negativo: um couro oleoso não é uma nota baixa. A ordem abaixo é a do vocabulário do
 * perfil (SPEC-002), e existir uma ordem de leitura não é existir uma ordem de valor.
 */
const SCALP_LABEL: Record<ScalpFeel, string> = {
  oily_quickly: 'Oleoso rápido',
  balanced: 'Equilibrado',
  dry_tendency: 'Ressecado',
};

/**
 * SPEC-039 (F37) — a etapa, não a técnica.
 *
 * Os dois rótulos dizem **o que ela fez**; nenhum afirma nada sobre cabelo (BR4). "Pulei dessa vez"
 * é uma resposta legítima e não uma falha: a etapa faz parte do processo da maioria, e nem por isso
 * deixar de fazê-la vira cobrança (NG5).
 */
const FINISH_LABEL: Record<FinishStatus, string> = {
  done: 'Finalizei',
  skipped: 'Pulei dessa vez',
};

/**
 * SPEC-048 (F38) — **como cada finalização se chama na tela.**
 *
 * Mora aqui, junto de `TECHNIQUE_LABEL` e `SCALP_LABEL`, porque o vocabulário do Wash Day é desta
 * tela: a Hoje e os Insights **importam** este mapa em vez de manter cópia. Dois mapas para a mesma
 * lista discordariam na primeira renomeação, e o rótulo apareceria diferente em duas telas sobre o
 * mesmo registro dela.
 *
 * ⚠️ **Vocabulário CANDIDATE** (dono, 2026-09-04): serve para ela **registrar o que fez**, nunca
 * para o app indicar. "Fitagem é melhor para o seu cabelo", indicação por curvatura, passo a passo
 * e ranking seguem bloqueados por D-26/D-70 — e é essa contenção que deixa o registro utilizável
 * antes do sign-off.
 */
export const FINISH_TECHNIQUE_LABEL: Record<FinishTechnique, string> = {
  fitagem_tradicional: 'Fitagem tradicional',
  fitagem_estruturada: 'Fitagem estruturada',
  dedoliss: 'Dedoliss',
  rake_and_shake: 'Rake and shake',
  plopping: 'Plopping',
  twist_out: 'Twist out',
  other: 'Outra finalização',
  unknown: 'Não sei o nome',
};

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  shampoo: 'Shampoo',
  conditioner: 'Condicionador',
  mask: 'Máscara',
  leave_in: 'Leave-in ou creme',
  oil: 'Óleo ou sérum',
  styler: 'Finalizador',
  other: 'Outro',
};

type Marked = {
  products: readonly Product[];
  techniques: readonly WashDayTechnique[];
  scalpFeel: ScalpFeel | null;
  /** SPEC-039 — campo próprio, e não um valor dentro de `techniques`: a BR3 aparecendo no tipo. */
  finishStatus: FinishStatus | null;
  /** SPEC-048 — **qual**, ou `null` para "ainda não disse qual" (que não é `unknown`). */
  finishTechnique: FinishTechnique | null;
};
type Ready = { shelf: readonly Product[]; marked: Marked };
type Loadable<T> = 'loading' | 'error' | T;

const isReady = (state: Loadable<Ready>): state is Ready => state !== 'loading' && state !== 'error';

const toggled = <T,>(list: readonly T[], value: T, used: boolean): readonly T[] =>
  used ? (list.includes(value) ? list : [...list, value]) : list.filter((v) => v !== value);

const toggledProduct = (list: readonly Product[], product: Product, used: boolean): readonly Product[] =>
  used
    ? list.some((p) => p.id === product.id)
      ? list
      : [...list, product]
    : list.filter((p) => p.id !== product.id);

export function WashDayScreen({
  careExecutionId,
  careTitle,
  washDays,
  products,
  onBack,
}: {
  careExecutionId: string;
  /** O cuidado a que este registro pertence, para ela saber sobre qual dia está falando. */
  careTitle: string;
  washDays: WashDayPort;
  products: ProductPort;
  onBack: () => void;
}) {
  const [state, setState] = useState<Loadable<Ready>>('loading');
  /** Quantas marcações estão no ar. Existe só para "Pronto" não sair no meio de uma escrita. */
  const [inFlight, setInFlight] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  /**
   * Uma fila por chip. Marcar e desmarcar rápido dispara duas requisições independentes, e o
   * PostgREST não promete ordem: sem isto, o `delete` podia chegar antes do `insert` e o banco
   * terminar no estado oposto ao da tela — que só apareceria no próximo reload, como se ela tivesse
   * marcado algo que não marcou.
   */
  const [queues] = useState(() => new Map<string, Promise<unknown>>());

  const load = useCallback(() => {
    setState('loading');
    let active = true;
    Promise.all([products.list(), washDays.getFor(careExecutionId)])
      .then(([shelf, record]) => {
        if (!active) return;
        setState({
          shelf,
          marked: {
            products: record.products,
            techniques: record.techniques,
            scalpFeel: record.scalpFeel,
            finishStatus: record.finishStatus,
            finishTechnique: record.finishTechnique,
          },
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFailure(reasonOf(error));
        // Nunca uma tela vazia que finge que ela não marcou nada.
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [products, washDays, careExecutionId]);
  useEffect(() => load(), [load]);

  const setMarked = (change: (marked: Marked) => Marked) =>
    setState((current) => (isReady(current) ? { ...current, marked: change(current.marked) } : current));

  /**
   * Otimista de propósito: marcar precisa responder no toque, e a viagem ao servidor não é rápida o
   * bastante para isso. Se a escrita falhar, **aquela** marcação volta atrás e a tela diz qual foi —
   * as outras seguem, porque são escritas independentes (§16).
   */
  const mark = (key: string, write: () => Promise<void>, revert: () => void, what: string) => {
    setMessage(null);
    setFailure(null);
    setInFlight((n) => n + 1);
    const queued = (queues.get(key) ?? Promise.resolve())
      // A falha anterior daquele chip já foi tratada e mostrada; ela não pode impedir a próxima
      // marcação do mesmo chip de sair.
      .catch(() => undefined)
      .then(write)
      .catch((error: unknown) => {
        revert();
        setMessage(`Não foi possível marcar ${what} agora. Tente de novo.`);
        setFailure(reasonOf(error));
      })
      .finally(() => setInFlight((n) => n - 1));
    queues.set(key, queued);
    return queued;
  };

  const toggleProduct = (product: Product, used: boolean) => {
    setMarked((m) => ({ ...m, products: toggledProduct(m.products, product, used) }));
    mark(
      `product:${product.id}`,
      () => washDays.markProduct({ careExecutionId, productId: product.id, used }),
      () => setMarked((m) => ({ ...m, products: toggledProduct(m.products, product, !used) })),
      product.name,
    );
  };

  const toggleTechnique = (technique: WashDayTechnique, used: boolean) => {
    setMarked((m) => ({ ...m, techniques: toggled(m.techniques, technique, used) }));
    mark(
      `technique:${technique}`,
      () => washDays.markTechnique({ careExecutionId, technique, used }),
      () => setMarked((m) => ({ ...m, techniques: toggled(m.techniques, technique, !used) })),
      TECHNIQUE_LABEL[technique],
    );
  };

  /**
   * SPEC-025 — escolha única: tocar em outra troca, tocar na marcada tira. Uma escrita só nos dois
   * casos, e a fila é a mesma das marcações — dois toques rápidos aqui têm o mesmo problema de
   * ordem que dois toques num chip de produto.
   */
  const chooseScalp = (scalpFeel: ScalpFeel) => {
    if (!isReady(state)) return;
    const previous = state.marked.scalpFeel;
    const next = previous === scalpFeel ? null : scalpFeel;
    setMarked((m) => ({ ...m, scalpFeel: next }));
    mark(
      'scalp',
      () => washDays.setScalpFeel({ careExecutionId, scalpFeel: next }),
      () => setMarked((m) => ({ ...m, scalpFeel: previous })),
      SCALP_LABEL[scalpFeel],
    );
  };

  /**
   * SPEC-039 — a etapa de finalização, com a mesma mecânica do couro: tocar em outra troca, tocar na
   * marcada tira (FR8). Uma escrita só nos dois casos, e a mesma fila — dois toques rápidos aqui
   * teriam o mesmo problema de ordem que dois toques num chip de produto.
   */
  const chooseFinish = (finishStatus: FinishStatus) => {
    if (!isReady(state)) return;
    const previous = state.marked.finishStatus;
    const previousTechnique = state.marked.finishTechnique;
    const next = previous === finishStatus ? null : finishStatus;
    /**
     * ⚠️ **Sair de `done` apaga a técnica, e a tela precisa saber disso.** O adapter limpa a coluna
     * na mesma escrita, porque o `CHECK` recusa "pulei, e a técnica foi fitagem" (SPEC-048). Se a
     * tela guardasse a técnica antiga, ela continuaria aparecendo aqui depois de sumir do banco — a
     * divergência silenciosa que só o próximo reload mostraria.
     */
    const nextTechnique = next === 'done' ? previousTechnique : null;
    setMarked((m) => ({ ...m, finishStatus: next, finishTechnique: nextTechnique }));
    mark(
      'finish',
      () => washDays.setFinishStatus({ careExecutionId, finishStatus: next }),
      () => setMarked((m) => ({ ...m, finishStatus: previous, finishTechnique: previousTechnique })),
      FINISH_LABEL[finishStatus],
    );
  };

  /**
   * SPEC-048 (F38) — **qual** finalização, com a mesma mecânica da etapa e do couro: tocar em outra
   * troca, tocar na marcada tira. Uma escrita só nos dois casos, e a mesma fila do `finish`, porque
   * as duas escrevem na **mesma linha**: em filas separadas, escolher a técnica e trocar a etapa em
   * sequência rápida poderiam chegar fora de ordem e a última a gravar venceria.
   */
  const chooseTechnique = (finishTechnique: FinishTechnique) => {
    if (!isReady(state)) return;
    const previous = state.marked.finishTechnique;
    const next = previous === finishTechnique ? null : finishTechnique;
    setMarked((m) => ({ ...m, finishTechnique: next }));
    mark(
      'finish',
      () => washDays.setFinishTechnique({ careExecutionId, finishTechnique: next }),
      () => setMarked((m) => ({ ...m, finishTechnique: previous })),
      FINISH_TECHNIQUE_LABEL[finishTechnique],
    );
  };

  /**
   * Cadastrar dali já marca: ela está adicionando porque **acabou de usar**, e o toque a mais é
   * exatamente o que faz um registro não ser preenchido (FR6/G4).
   */
  const add = useAddProduct(products, (product) => {
    setAdding(false);
    setState((current) => (isReady(current) ? { ...current, shelf: [product, ...current.shelf] } : current));
    toggleProduct(product, true);
  });

  const busy = inFlight > 0 || add.busy;

  /**
   * O que a tela oferece: a prateleira de hoje **mais** o que ela marcou e já não está nela (BR3).
   * Um produto arquivado não volta a ser oferecido para um registro novo — mas some do registro em
   * que foi usado só se a tela o esquecer, e esquecê-lo seria apagar um fato que o banco guardou.
   */
  const offered = isReady(state)
    ? [...state.shelf, ...state.marked.products.filter((p) => !state.shelf.some((s) => s.id === p.id))]
    : [];

  if (state === 'loading') return <Loading label="Abrindo seu registro…" />;
  if (state === 'error') {
    return (
      <Screen scroll={false} footer={<Button label="Voltar" variant="ghost" onPress={onBack} />}>
        <Card tone="muted">
          <Stack gap="lg">
            <Text>Não foi possível abrir seu registro.</Text>
            <Button label="Tentar novamente" variant="secondary" onPress={load} />
            {__DEV__ && failure ? (
              <Text variant="caption" tone="faint">
                {failure}
              </Text>
            ) : null}
          </Stack>
        </Card>
      </Screen>
    );
  }

  const productForm = (
    <Stack gap="sm">
      <Field
        value={add.draft}
        onChangeText={add.type}
        accessibilityLabel="Nome do produto"
        placeholder="Nome do produto"
        maxLength={PRODUCT_NAME_MAX_LENGTH}
        autoCapitalize="sentences"
        autoCorrect={false}
        editable={!add.busy}
      />
      <Row>
        {PRODUCT_CATEGORIES.map((value) => (
          <Chip
            key={value}
            label={CATEGORY_LABEL[value]}
            selected={add.category === value}
            onPress={() => add.toggleCategory(value)}
            disabled={add.busy}
          />
        ))}
      </Row>
      <Button
        label="Adicionar à prateleira"
        variant="secondary"
        size="sm"
        onPress={add.submit}
        disabled={!add.ready}
        busy={add.busy}
        style={styles.inline}
      />
    </Stack>
  );

  return (
    <Screen
      footer={
        // Nada a salvar: cada marcação já é um fato. O botão só espera a última escrita voltar, para
        // uma falha não acontecer numa tela que ela já deixou.
        <Button label="Pronto" onPress={onBack} disabled={busy} />
      }
    >
      <Stack gap="sm">
        <Text variant="overline" tone="faint">
          {careTitle}
        </Text>
        {/*
          O título nomeia a **tela**, não a primeira seção. Enquanto o Wash Day só perguntava
          produtos e técnicas, "O que você usou?" cobria tudo o que estava embaixo; com o couro
          cabeludo (SPEC-025) ele passou a prometer um terço do que a tela pede. Um título que
          descreve só a primeira seção não é questão de estilo — é impreciso, e só apareceu
          olhando a tela inteira a 390px.
        */}
        <Text variant="display" accessibilityRole="header">
          Seu registro
        </Text>
        <Text tone="muted">
          Marque o que usou, como seu couro esteve, como você fez e se finalizou. Nada aqui é obrigatório, e
          dá para voltar depois.
        </Text>
      </Stack>

      {message ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      {__DEV__ && failure ? (
        <Text variant="caption" tone="faint">
          {failure}
        </Text>
      ) : null}

      <Stack gap="md">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          Produtos
        </Text>
        {offered.length === 0 ? (
          // Convite, não beco (EC1): a prateleira vazia se resolve aqui mesmo.
          <Stack gap="md">
            <Text tone="muted">Sua prateleira está vazia. Comece pelo que você usou hoje.</Text>
            {productForm}
          </Stack>
        ) : (
          <Stack gap="md">
            <Row>
              {offered.map((product) => {
                const selected = state.marked.products.some((p) => p.id === product.id);
                return (
                  <Chip
                    key={product.id}
                    label={product.name}
                    multi
                    selected={selected}
                    onPress={() => toggleProduct(product, !selected)}
                    accessibilityLabel={`${product.name} — ${CATEGORY_LABEL[product.category]}`}
                  />
                );
              })}
            </Row>
            <Button
              label="Usei um produto novo"
              variant="ghost"
              size="sm"
              accessibilityState={{ expanded: adding }}
              onPress={() => setAdding((v) => !v)}
              style={styles.inline}
            />
            {adding ? productForm : null}
          </Stack>
        )}
        {add.message ? (
          <Text tone="danger" accessibilityLiveRegion="polite">
            {add.message}
          </Text>
        ) : null}
        {__DEV__ && add.failure ? (
          <Text variant="caption" tone="faint">
            {add.failure}
          </Text>
        ) : null}
      </Stack>

      <Stack gap="md">
        {/* SPEC-025 — **fora do caminho do check-in** (FR7): a pergunta de fios continua sendo um
            toque na Hoje, e esta mora aqui, onde nada é obrigatório. Sem "como estava?" com cara de
            avaliação: nenhum valor é melhor que outro (BR3/NG4). */}
        <Text variant="overline" tone="accent" accessibilityRole="header">
          Seu couro cabeludo
        </Text>
        <Row>
          {SCALP_FEELS.map((feel) => (
            <Chip
              key={feel}
              label={SCALP_LABEL[feel]}
              selected={state.marked.scalpFeel === feel}
              onPress={() => chooseScalp(feel)}
            />
          ))}
        </Row>
      </Stack>

      <Stack gap="md">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          Como você fez
        </Text>
        <Row>
          {WASH_DAY_TECHNIQUES.map((technique) => {
            const selected = state.marked.techniques.includes(technique);
            return (
              <Chip
                key={technique}
                label={TECHNIQUE_LABEL[technique]}
                multi
                selected={selected}
                onPress={() => toggleTechnique(technique, !selected)}
              />
            );
          })}
        </Row>
      </Stack>

      <Stack gap="md">
        {/*
          SPEC-039 FR4 — **seção própria, logo depois de "Como você fez".** A vizinhança é
          deliberada: é encostada nas catorze técnicas que a separação precisa ficar visível. Uma
          técnica responde *como*; a etapa responde *se aconteceu* (BR3), e fundi-las é o que a
          D-102 proibiu — a lista de lá aceitaria o valor sem erro nenhum, e é por isso que a
          barreira do §8 é teste e não comentário.

          SPEC-048 (F38) — **qual** finalização entrou logo abaixo, e *dentro desta mesma seção*:
          é a resposta seguinte à mesma pergunta, não um assunto novo. Como fazer cada uma segue
          atrás do gate D-26/D-70.
        */}
        <Text variant="overline" tone="accent" accessibilityRole="header">
          Finalização
        </Text>
        <Row>
          {FINISH_STATUSES.map((value) => (
            <Chip
              key={value}
              label={FINISH_LABEL[value]}
              selected={state.marked.finishStatus === value}
              onPress={() => chooseFinish(value)}
            />
          ))}
        </Row>
        {/*
          ⚠️ **Só depois de ela dizer que finalizou.** Perguntar *qual* antes de *se* inverteria a
          ordem canônica (SPEC-039 FR2), e o banco recusa a combinação: técnica só existe com a
          etapa em `done`.

          ⚠️ **Pergunta, não indicação.** Nada vem sugerido, marcado ou ordenado por perfil —
          "melhor para você" é D-26/D-70 e não está aqui.
        */}
        {state.marked.finishStatus === 'done' ? (
          <Stack gap="md">
            <Text variant="bodyStrong">
              {state.marked.finishTechnique === null ? 'Qual finalização?' : 'Finalização feita'}
            </Text>
            <Row>
              {FINISH_TECHNIQUES.map((value) => (
                <Chip
                  key={value}
                  label={FINISH_TECHNIQUE_LABEL[value]}
                  selected={state.marked.finishTechnique === value}
                  onPress={() => chooseTechnique(value)}
                />
              ))}
            </Row>
          </Stack>
        ) : null}
      </Stack>
    </Screen>
  );
}

/**
 * Um botão dentro do corpo **não** ocupa a linha inteira.
 *
 * Esticado e centralizado, "Usei um produto novo" lia como um cabeçalho de seção entre os chips e o
 * formulário, e "Adicionar à prateleira" parecia um segundo campo vazio. Largura cheia é a forma da
 * ação primária, que nesta tela mora no rodapé — e só lá. É o mesmo ajuste que "Tirar da prateleira"
 * já tinha na SPEC-023.
 */
const styles = StyleSheet.create({
  inline: { alignSelf: 'flex-start' },
});
