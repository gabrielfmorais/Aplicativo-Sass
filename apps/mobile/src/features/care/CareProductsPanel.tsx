import type { CareTypeCode, Product, ProductPort, WashDayPort } from '@app/core';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Row, Stack, Tag, Text } from '@/design/primitives';
import { space } from '@/design/tokens';
import { ProductThumb } from '@/features/shelf/ProductIdentity';

/**
 * SPEC-041 (F48) — **os produtos que ela já tem, no momento do cuidado.**
 *
 * O `F25` registra o que ela usou **depois**; a `P18` **recomenda**; este painel **apresenta o que
 * já é dela**, na hora. É a única das três que não precisa de revisão de domínio — porque **não
 * decide nada por ela** (D-104).
 *
 * ⚠️ **Nenhum filtro por categoria, e essa é a decisão inteira.** Mostrar "máscaras" num cuidado de
 * hidratação associaria produto a tipo de cuidado por indicação, que é conteúdo capilar substantivo
 * ⇒ gate D-26/D-70. O que este painel sabe é o que **ela** registrou: da última vez que fez um
 * cuidado deste tipo, usou estes. O resto é a prateleira dela, inteira, sem ordem de mérito.
 *
 * Marca e imagem chegam com o catálogo real (`F32`) — hoje não existem, e inventá-las é proibido.
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
   * A prateleira **menos** o que já apareceu em "da última vez": o mesmo vidro duas vezes na mesma
   * tela foi um achado real da auditoria da SPEC-026 (dois cartões dizendo o mesmo fato lado a lado).
   */
  const rest = state.shelf.filter((p) => !state.lastUsed.some((used) => used.id === p.id));

  return (
    <Card tone="muted">
      <Stack gap="md">
        {state.lastUsed.length > 0 ? (
          <Stack gap="sm">
            {/* Um fato dela, com data implícita e sem nenhuma sugestão embutida (NG1). */}
            <Text variant="bodyStrong">Da última vez você usou</Text>
            {/*
              ⚠️ **SPEC-054 G4 — aqui, e só aqui, a embalagem aparece.**

              Estes são os produtos **associados àquele cuidado**: é onde a foto carrega informação —
              *"é este vidro"* — em vez de ser enfeite. O resto da prateleira continua em `Tag`,
              porque ali a foto viraria uma parede de miniaturas sobre uma lista que ela só percorre.

              ⚠️ Com o catálogo vazio — o estado de hoje — cada linha volta a ser **nome e nada
              mais**, que é exatamente o que esta seção sempre mostrou.
            */}
            <Stack gap="xs">
              {state.lastUsed.map((product) => (
                <View key={product.id} style={styles.usedRow}>
                  <ProductThumb identity={product.catalog} />
                  <View style={styles.usedText}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {product.name}
                    </Text>
                    {product.catalog ? (
                      <Text variant="caption" tone="muted" numberOfLines={1}>
                        {[product.catalog.brand, product.catalog.line, product.catalog.variant]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </Stack>
          </Stack>
        ) : null}

        {rest.length > 0 ? (
          <Stack gap="sm">
            <Text variant="bodyStrong">
              {state.lastUsed.length > 0 ? 'Também na sua prateleira' : 'Na sua prateleira'}
            </Text>
            <Row>
              {/* `Tag`, e não `Chip`: isto é leitura, não escolha. Um `Chip` sem ação se anuncia
                  como rádio ou caixa de seleção para tecnologia assistiva e vira botão morto — o
                  defeito exato que a auditoria da SPEC-027 encontrou na aba Prateleira. Marcar o que
                  ela usou é na tela do registro (SPEC-024), que tem endereço próprio. */}
              {rest.map((product) => (
                <Tag
                  key={product.id}
                  // SPEC-054 — a marca vem junto do nome, nunca no lugar dele.
                  label={product.catalog ? `${product.catalog.brand} · ${product.name}` : product.name}
                />
              ))}
            </Row>
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  usedRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  /** `flex: 1` deixa o nome encolher em vez de empurrar a miniatura para fora da linha. */
  usedText: { flex: 1, gap: space.xs },
});
