import type { CatalogProduct, ProductCatalogPort, ProductCategory } from '@app/core';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Field, Loading, Row, Stack, Text } from '@/design/primitives';
import { color, space } from '@/design/tokens';
import { ProductThumb } from '@/features/shelf/ProductIdentity';

/**
 * SPEC-054 (F32) — **buscar o produto real em vez de digitar um apelido.**
 *
 * ⚠️ **O catálogo está VAZIO, e vai continuar até a ingestão acontecer** — ela depende de contrato,
 * feed e direito de imagem (**TRUE HUMAN GATE**, OQ1). A pergunta de desenho é o que a tela faz
 * enquanto isso, e a primeira resposta estava errada.
 *
 * ⚠️ **A primeira versão ESCONDIA a busca com o catálogo vazio**, com o raciocínio de que uma busca
 * que sempre volta vazia é um beco. O dono usou o produto e mostrou o custo real: ele digitou
 * *"wella"*, não achou nada, e **não teve como saber se o catálogo estava vazio ou se a busca tinha
 * quebrado**. Esconder não protege dela — apaga a informação de que a capability existe e está
 * crescendo.
 *
 * A correção é dizer a verdade em vez de sumir: **"Catálogo de produtos ainda em expansão"**, com o
 * cadastro manual logo abaixo, inteiro. E os dois casos ficam **distintos**:
 *
 * | situação | o que ela lê |
 * |---|---|
 * | catálogo vazio | *"ainda em expansão"* — o app está crescendo, não falhou |
 * | catálogo com linhas, termo sem par | *"não encontramos esse produto"* — a busca funcionou |
 *
 * ⚠️ **Digitar continua sendo o caminho completo** (G3), não o plano B: o catálogo chega **por cima**
 * da prateleira manual, nunca no lugar dela.
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
   * ⚠️ `null` enquanto não se sabe, e **`null` não é "não tem"**: dizer *"em expansão"* antes da
   * resposta seria afirmar sobre o catálogo sem tê-lo consultado. É a mesma armadilha do
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
      // Falhar em saber é tratado como vazio: a frase *"em expansão"* é verdadeira nos dois casos, e
      // a prateleira manual não pode depender disto.
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

  // Enquanto não se sabe, nada é afirmado — nem a busca, nem a expansão.
  if (available === null) return null;

  /**
   * ⚠️ **O estado que o dono pediu, e o que ele NÃO pode parecer.** *"Não encontramos"* aqui faria
   * parecer que a busca rodou e o produto dela não existe; *"erro"* faria parecer quebrado. O que é
   * verdade é a terceira coisa: **o catálogo ainda está sendo montado**, e o caminho de sempre está
   * logo abaixo.
   */
  if (available === false) {
    return (
      <Card tone="muted">
        <Stack gap="xs">
          <Text variant="bodyStrong">Catálogo de produtos ainda em expansão</Text>
          <Text tone="muted">
            Ainda estamos montando a lista de produtos com marca e foto. Enquanto isso, escreva o nome do
            jeito que você chama — é assim que a sua prateleira funciona, e nada se perde depois.
          </Text>
        </Stack>
      </Card>
    );
  }

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
        // ⚠️ Aqui o catálogo **tem** linhas: a busca rodou e não achou. É outra frase, de propósito.
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
