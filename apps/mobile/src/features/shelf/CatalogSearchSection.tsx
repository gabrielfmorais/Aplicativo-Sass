import type { CatalogProduct, ProductCatalogPort, ProductCategory } from '@app/core';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Field, Loading, Row, Stack, Text } from '@/design/primitives';
import { color, space } from '@/design/tokens';
import { ProductThumb } from '@/features/shelf/ProductIdentity';

/**
 * SPEC-054 (F32) — **buscar o produto real em vez de digitar um apelido.**
 *
 * ⚠️ **Com o catálogo vazio, esta seção NÃO aparece** (FR8) — e vazio é o estado de hoje e o
 * permanente até a ingestão acontecer, porque ela depende de contrato, feed e direito de imagem
 * (**TRUE HUMAN GATE**, OQ1). Uma busca que sempre volta vazia é pior que uma busca que não existe:
 * ela promete um caminho e entrega um beco, toda vez.
 *
 * ⚠️ **E digitar continua sendo o caminho completo** (G3), não o plano B. O catálogo chega **por
 * cima** da prateleira manual, nunca no lugar dela — quem tem um vidro que o app não conhece
 * continua tendo a prateleira inteira.
 *
 * ⛔ **Nada aqui recomenda.** Sem *"popular"*, sem *"recomendado"*, sem *"para o seu cabelo"* e sem
 * ordenação por mérito: o primeiro seria o `T2`, o último a `P18`, e os dois têm gate próprio (NG3).
 */

const MIN_TERM = 2;

export function CatalogSearchSection({
  catalog,
  busy,
  onPick,
}: {
  catalog: ProductCatalogPort;
  busy: boolean;
  /** Ela escolheu um produto real: a tela de cima preenche o formulário e o vínculo. */
  onPick: (product: CatalogProduct) => void;
}) {
  /**
   * ⚠️ `null` enquanto não se sabe, e **`null` não é "não tem"**: abrir a busca antes da resposta
   * mostraria por um instante um caminho que pode não existir. É a mesma armadilha do
   * `productCount: null` das sugestões (SPEC-026).
   */
  const [available, setAvailable] = useState<boolean | null>(null);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<'idle' | 'searching' | readonly CatalogProduct[]>('idle');

  useEffect(() => {
    let active = true;
    catalog
      .isAvailable()
      .then((yes) => active && setAvailable(yes))
      // Falhar em saber é o mesmo que não ter: a prateleira manual não pode depender disto.
      .catch(() => active && setAvailable(false));
    return () => {
      active = false;
    };
  }, [catalog]);

  const search = useCallback(() => {
    const texto = term.trim();
    if (texto.length < MIN_TERM) return;
    setResults('searching');
    catalog
      // Um termo só de dígitos é um código de barras (`F33`): ela pode digitar o que o scanner
      // ainda não lê.
      .search(/^[0-9]{8,14}$/.test(texto) ? { ean: texto } : { text: texto })
      .then((rows) => setResults(rows))
      // Uma busca que falhou não é um erro a mostrar: digitar continua ali, e é o caminho completo.
      .catch(() => setResults([]));
  }, [catalog, term]);

  if (available !== true) return null;

  return (
    <Stack gap="sm">
      <Text variant="overline" tone="accent" accessibilityRole="header">
        Procurar o produto
      </Text>
      <Row>
        <View style={styles.field}>
          <Field
            value={term}
            onChangeText={setTerm}
            accessibilityLabel="Marca ou nome do produto"
            placeholder="Marca, nome ou código de barras"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            onSubmitEditing={search}
          />
        </View>
        <Button
          label="Buscar"
          variant="secondary"
          size="sm"
          disabled={busy || term.trim().length < MIN_TERM}
          onPress={search}
        />
      </Row>

      {results === 'searching' ? <Loading label="Procurando…" /> : null}

      {Array.isArray(results) && results.length === 0 ? (
        // ⚠️ Sem resultado NÃO é falha dela nem do app: é um produto que o catálogo não tem, e o
        // caminho de digitar está logo abaixo, inteiro.
        <Text tone="muted">Não encontramos esse produto. Você pode escrever o nome abaixo.</Text>
      ) : null}

      {Array.isArray(results) && results.length > 0 ? (
        <Card style={styles.list}>
          {results.map((p, index) => (
            <View key={p.id} style={[styles.row, index < results.length - 1 && styles.divided]}>
              <ProductThumb identity={p} />
              <View style={styles.text}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {[p.brand, p.line, p.variant].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Button
                label="Adicionar"
                variant="ghost"
                size="sm"
                disabled={busy}
                accessibilityLabel={`Adicionar ${p.brand} ${p.name} à prateleira`}
                onPress={() => onPick(p)}
              />
            </View>
          ))}
        </Card>
      ) : null}
    </Stack>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1 },
  list: { paddingVertical: 0, paddingHorizontal: 0, gap: 0, overflow: 'hidden' },
  divided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  text: { flex: 1, gap: space.xs },
});

export type { ProductCategory };
