import type { CareTypeCode, Product, ProductPort, WashDayPort } from '@app/core';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Stack, Tag, Text } from '@/design/primitives';
import { careColor, radius, space } from '@/design/tokens';
import { CATEGORY_LABEL, ProductCaption, ProductMark } from '@/features/shelf/ProductIdentity';
import { CARE_TYPE_LABEL } from '@/features/plan/copy';

/**
 * SPEC-041 (`F48`) + SPEC-063 — **os produtos que ela já tem, no momento do cuidado.**
 *
 * O `F25` registra o que ela usou **depois**; a `P18` **recomenda**; este painel **apresenta o que
 * já é dela**, na hora. É a única das três que não precisa de revisão de domínio — porque **não
 * decide nada por ela** (D-104).
 *
 * ## ⚠️ A auditoria que definiu esta rodada
 *
 * O pedido do dono era *"um produto principal da prateleira **para aquele cuidado**"*, com *"outras
 * opções **compatíveis**"* — e ele mesmo mandou auditar antes se a classificação autorizava a
 * afirmação. **Não autoriza.** As categorias são `shampoo · conditioner · mask · leave_in · oil ·
 * styler · other`, e o vocabulário diz por escrito que *"categoria é organização de prateleira, não
 * afirmação capilar"*. Os guias confirmam: existe *"máscara de hidratação"* **e** *"máscara de
 * reconstrução"* — a mesma categoria serve aos quatro tipos.
 *
 * ⛔ **Então "para este cuidado", "para esta etapa" e "compatível" não entram.** Mapear categoria a
 * tipo de cuidado seria engenharia inventando a regra capilar que a D-26 existe para impedir.
 *
 * ## O que o sistema sabe, e é melhor
 *
 * `lastUsedFor` devolve o que **ela marcou na última vez que fez este mesmo tipo de cuidado**. É
 * fato dela, registrado por ela — e é mais forte que uma regra inventada: o destaque emerge do
 * **histórico dela**, que é exatamente a promessa do produto.
 *
 * ⚠️ **E não existe "o principal" escolhido pelo app** (FR3): se ela marcou três produtos, os três
 * são fato igual. Eleger um seria inventar ordem de mérito, a mesma recusa que mantém a `P7` fora da
 * Smart Shelf.
 */

type State = 'loading' | 'error' | { lastUsed: readonly Product[]; shelf: readonly Product[] };

export function CareProductsPanel({
  careTypeCode,
  washDays,
  products,
}: {
  careTypeCode: CareTypeCode;
  washDays: WashDayPort;
  products: ProductPort;
}) {
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    let active = true;
    Promise.all([washDays.lastUsedFor(careTypeCode), products.list()])
      .then(([lastUsed, shelf]) => active && setState({ lastUsed, shelf }))
      .catch(() => active && setState('error'));
    return () => {
      active = false;
    };
  }, [careTypeCode, washDays, products]);

  if (state === 'loading') {
    return (
      <Card tone="muted">
        <Text tone="muted">Abrindo sua prateleira…</Text>
      </Card>
    );
  }
  if (state === 'error') {
    return (
      <Card tone="muted">
        {/* Uma conveniência que não carregou não vira erro em tela cheia: ela ainda pode fazer o
            cuidado, e a prateleira tem endereço próprio. */}
        <Text tone="muted">Não foi possível abrir sua prateleira agora.</Text>
      </Card>
    );
  }

  if (state.shelf.length === 0 && state.lastUsed.length === 0) {
    return (
      <Card tone="muted">
        <Text tone="muted">
          Sua prateleira está vazia. Quando você cadastrar o que tem em casa, ele aparece aqui na hora do
          cuidado.
        </Text>
      </Card>
    );
  }

  /**
   * A prateleira **menos** o que já apareceu no destaque: o mesmo vidro duas vezes na mesma tela foi
   * um achado real da auditoria da SPEC-026 (dois cartões dizendo o mesmo fato lado a lado).
   */
  const rest = state.shelf.filter((p) => !state.lastUsed.some((used) => used.id === p.id));
  const hue = careColor[careTypeCode];

  return (
    <Card tone="muted">
      <Stack gap="lg">
        {state.lastUsed.length > 0 ? (
          <Stack gap="sm">
            {/*
              FR1 — ⚠️ **o rótulo é um FATO, e nomear o cuidado é o que o torna específico sem
              afirmar adequação.** "Você usou na última Hidratação" é história dela; "produto para
              esta etapa" seria uma alegação que o sistema não pode fazer (BR1).
            */}
            <Text variant="overline" tone="accent">
              Você usou na última {CARE_TYPE_LABEL[careTypeCode]}
            </Text>
            <Stack gap="sm">
              {state.lastUsed.map((product) => (
                <View key={product.id} style={[styles.hero, { borderColor: hue.fg }]}>
                  <ProductMark identity={product.catalog} name={product.name} size={HERO_MARK} />
                  <View style={styles.heroText}>
                    {/*
                      SPEC-054 — **marca, linha e variante juntas**: é a variante que distingue um
                      vidro do outro na prateleira do banheiro, e cortá-la para caber deixaria dois
                      produtos parecendo o mesmo.
                    */}
                    {product.catalog ? (
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {[product.catalog.brand, product.catalog.line, product.catalog.variant]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                    {/* FR6 — duas linhas no destaque: nome de catálogo é longo e cortar em uma perde
                        justamente a variante que distingue um vidro do outro. */}
                    <Text variant="bodyStrong" numberOfLines={2}>
                      {product.name}
                    </Text>
                    <Tag label={CATEGORY_LABEL[product.category]} tone="neutral" />
                  </View>
                </View>
              ))}
            </Stack>
          </Stack>
        ) : null}

        {rest.length > 0 ? (
          <Stack gap="sm">
            <Text variant="overline" tone="accent">
              {state.lastUsed.length > 0 ? 'Outros da sua prateleira' : 'Da sua prateleira'}
            </Text>
            {/*
              FR4 — ⚠️ **eram `Tag` de nome cru, e a SPEC-041 tinha razão quando escreveu isso.** O
              argumento dela era que *"a foto viraria uma parede de miniaturas"* — verdade **com o
              catálogo vazio**, que era o estado da época. Hoje são **3.901 produtos com ~90% de
              foto** (SPEC-057/058): a miniatura passou a ser o que faz ela reconhecer o vidro. A
              premissa caiu, então a decisão cai junto.

              ⛔ E a ordem continua sendo a que a porta devolve (BR2): nada de mérito.
            */}
            {rest.map((product) => (
              <View key={product.id} style={styles.row}>
                <ProductMark identity={product.catalog} name={product.name} />
                <View style={styles.rowText}>
                  {/*
                    ⚠️ **O NOME DELA na primeira linha, sozinho — e isso foi um defeito visto a
                    390px.** A linha era `marca · nome` num só texto, e com uma marca longa o
                    resultado real foi *"Wella Professionals · Invigo N…"*: **a marca comeu o nome**,
                    que é justamente o que a SPEC-054 proíbe — *"o nome é o que ela reconhece na
                    prateleira do banheiro"*. Marca e categoria descem para a segunda linha, onde
                    cabem sem disputar.
                  */}
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {product.name}
                  </Text>
                  <ProductCaption product={product} categoryLabel={CATEGORY_LABEL[product.category]} />
                </View>
              </View>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}

/** O destaque é maior porque é onde ela reconhece o vidro; a lista é para percorrer. */
const HERO_MARK = 64;

const styles = StyleSheet.create({
  /**
   * A borda esquerda na cor do cuidado é o mesmo canal que o cartão da Hoje usa (SPEC-055): liga o
   * destaque ao cuidado que ela está fazendo **sem** dizer que o produto serve para ele.
   */
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    backgroundColor: 'transparent',
  },
  /** `flex: 1` deixa o nome encolher em vez de empurrar a marca para fora da linha. */
  heroText: { flex: 1, gap: space.xs, alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowText: { flex: 1, gap: space.xs },
});
