import type { Product, ProductCategory, ProductPort } from '@app/core';
import { PRODUCT_CATEGORIES, PRODUCT_NAME_MAX_LENGTH } from '@app/core';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, Chip, Field, Loading, Row, Screen, Stack, Text } from '@/design/primitives';
import { useAddProduct } from '@/features/shelf/use-add-product';
import { reasonOf } from '@/shared/failure-detail';

/**
 * SPEC-023 (F26) — a prateleira dela.
 *
 * O Blueprint §10 abre com o problema inteiro: *"Ela tem doze produtos no banheiro e não sabe quais
 * estão ajudando. Compra mais."*
 *
 * **Não é loja e não é catálogo.** Ela cadastra o que tem, do jeito que chama. A tela não sugere,
 * não completa, não corrige e não mostra composição, preço, marca ou benefício — o app não sabe
 * nada disso, e inventar seria pior que não ter.
 *
 * **Não interpreta.** Sem "mais usado", ranking, combinação ou correlação: isso é `P6` Smart Shelf,
 * é Premium, e exige volume mínimo. Aqui é uma lista fiel, e uma lista fiel é o que o Premium
 * inteiro vai beber depois.
 *
 * **Dois campos e um botão.** Um formulário longo não é preenchido, e uma prateleira vazia não vale
 * nada.
 */

/** Os nomes que ela lê. Tipo de vidro no banheiro — nenhum diz para que serve (BR3). */
const CATEGORY_LABEL: Record<ProductCategory, string> = {
  shampoo: 'Shampoo',
  conditioner: 'Condicionador',
  mask: 'Máscara',
  leave_in: 'Leave-in ou creme',
  oil: 'Óleo ou sérum',
  styler: 'Finalizador',
  other: 'Outro',
};

type Loadable<T> = 'loading' | 'error' | T;

export function ShelfScreen({ products, onBack }: { products: ProductPort; onBack: () => void }) {
  const [list, setList] = useState<Loadable<readonly Product[]>>('loading');
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(() => {
    setList('loading');
    let active = true;
    products
      .list()
      .then((rows) => active && setList(rows))
      .catch((error: unknown) => {
        if (!active) return;
        setFailure(reasonOf(error));
        // Nunca uma prateleira vazia que finge que ela não cadastrou nada (§16).
        setList('error');
      });
    return () => {
      active = false;
    };
  }, [products]);
  useEffect(() => load(), [load]);

  // A mesma regra de cadastro que o Wash Day usa (SPEC-024 FR6). Uma cópia só: a normalização do
  // nome e a tradução da duplicata divergiriam entre as duas telas na primeira mudança de qualquer
  // uma delas, e a cópia esquecida mostraria o código cru do Postgres.
  const add = useAddProduct(products, load);
  const busy = add.busy || archiving;

  const archive = (id: string) => {
    if (busy) return;
    setArchiving(true);
    setMessage(null);
    products
      .archive(id)
      .then(load)
      .catch((error: unknown) => {
        setMessage('Não foi possível remover agora. Tente novamente.');
        setFailure(reasonOf(error));
      })
      .finally(() => setArchiving(false));
  };

  return (
    <Screen
      footer={
        <Stack gap="sm">
          <Button label="Adicionar" onPress={add.submit} disabled={!add.ready} busy={add.busy} />
          <Button label="Voltar" variant="ghost" onPress={onBack} disabled={busy} />
        </Stack>
      }
    >
      <Stack gap="sm">
        <Text variant="overline" tone="faint">
          Seus produtos
        </Text>
        <Text variant="display" accessibilityRole="header">
          Minha prateleira
        </Text>
        <Text tone="muted">
          O que você já tem em casa, do jeito que você chama. Serve para o app não sugerir o que você não tem.
        </Text>
      </Stack>

      <Field
        value={add.draft}
        onChangeText={add.type}
        accessibilityLabel="Nome do produto"
        placeholder="Nome do produto"
        maxLength={PRODUCT_NAME_MAX_LENGTH}
        autoCapitalize="sentences"
        autoCorrect={false}
        editable={!busy}
      />

      <Row>
        {PRODUCT_CATEGORIES.map((value) => (
          <Chip
            key={value}
            label={CATEGORY_LABEL[value]}
            selected={add.category === value}
            onPress={() => add.toggleCategory(value)}
            disabled={busy}
          />
        ))}
      </Row>

      {(add.message ?? message) ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {add.message ?? message}
        </Text>
      ) : null}
      {__DEV__ && (add.failure ?? failure) ? (
        <Text variant="caption" tone="faint">
          {add.failure ?? failure}
        </Text>
      ) : null}

      <Stack gap="md">
        <Text variant="overline" tone="muted" accessibilityRole="header">
          Na sua prateleira
        </Text>
        {list === 'loading' ? (
          <Loading label="Carregando sua prateleira…" />
        ) : list === 'error' ? (
          <Card tone="muted">
            <Text>Não foi possível carregar sua prateleira.</Text>
            <Button label="Tentar novamente" variant="secondary" onPress={load} />
          </Card>
        ) : list.length === 0 ? (
          // Convite, não cobrança (FR6/EC1).
          <Text tone="muted">Nada aqui ainda. Comece pelo que você mais usa.</Text>
        ) : (
          list.map((product) => (
            <Card key={product.id}>
              <Row gap="sm" style={styles.line}>
                <Text variant="bodyStrong">{product.name}</Text>
                <Text variant="caption" tone="muted">
                  {CATEGORY_LABEL[product.category]}
                </Text>
              </Row>
              <Button
                label="Tirar da prateleira"
                variant="ghost"
                size="sm"
                disabled={busy}
                accessibilityLabel={`Tirar ${product.name} da prateleira`}
                onPress={() => archive(product.id)}
                style={styles.archive}
              />
            </Card>
          ))
        )}
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' },
  archive: { alignSelf: 'flex-start' },
});
