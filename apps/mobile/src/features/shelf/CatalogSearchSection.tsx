import type { CatalogProduct, ProductCatalogPort, ProductCategory } from '@app/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Field, Row, Stack, Text } from '@/design/primitives';
import { color, space } from '@/design/tokens';
import { ProductThumb } from '@/features/shelf/ProductIdentity';

/**
 * SPEC-054 (F32) — buscar o produto real. **SPEC-058 — em tempo real (autocomplete).**
 *
 * Antes: digitar → clicar "Buscar". Agora a Huna sugere **enquanto ela digita** — a busca vai para o
 * servidor (RPC `catalog_search`, indexada, acento/maiúscula-insensível), com **debounce** e guarda
 * de resposta velha, e mostra **marcas** primeiro, depois **produtos**.
 *
 * ⛔ **Nada aqui recomenda nem ordena por mérito** (NG3). O ranking é textual (marca exata → prefixo →
 * contém) + foto; "melhor para você" é `P18`/D-26 e patrocínio é `T2`, cada um com seu gate.
 *
 * ⚠️ **Digitar continua sendo o caminho completo** (G3): o catálogo chega por cima da prateleira
 * manual, nunca no lugar dela.
 */

const MIN_TERM = 1;
const DEBOUNCE_MS = 250;

type Results = 'idle' | 'searching' | readonly CatalogProduct[];

export function CatalogSearchSection({
  catalog,
  busy,
  onPick,
}: {
  catalog: ProductCatalogPort;
  busy: boolean;
  onPick: (product: CatalogProduct) => void;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Results>('idle');
  /** Sequência para ignorar resposta velha: digitar rápido dispara várias buscas, e a última vence. */
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    catalog
      .isAvailable()
      .then((yes) => active && setAvailable(yes))
      .catch(() => active && setAvailable(false));
    return () => {
      active = false;
    };
  }, [catalog]);

  const run = useCallback(
    (q: string) => {
      const mine = ++seq.current;
      setResults('searching');
      catalog
        // Um termo só de dígitos é um código de barras (`F33`): ela pode digitar o que o scanner
        // ainda não lê. O `search_text` do servidor inclui o EAN, então o mesmo caminho serve.
        .search(/^[0-9]{8,14}$/.test(q) ? { ean: q } : { text: q })
        .then((rows) => {
          if (mine === seq.current) setResults(rows);
        })
        // Uma busca que falhou não é um erro a mostrar: digitar continua ali, e é o caminho completo.
        .catch(() => {
          if (mine === seq.current) setResults([]);
        });
    },
    [catalog],
  );

  const onChange = (t: string) => {
    setTerm(t);
    if (timer.current) clearTimeout(timer.current);
    const q = t.trim();
    if (q.length < MIN_TERM) {
      seq.current++; // cancela qualquer resposta em voo
      setResults('idle');
      return;
    }
    timer.current = setTimeout(() => run(q), DEBOUNCE_MS);
  };

  const pickBrand = (brand: string) => {
    if (timer.current) clearTimeout(timer.current);
    setTerm(brand);
    run(brand);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (available === null) return null;

  // Catálogo sem nenhuma linha: convite honesto, não beco (SPEC-054 — estado mantido por segurança).
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

  const rows = Array.isArray(results) ? results : [];
  // Marcas em destaque: as distintas dos resultados (o servidor já pôs a marca certa na frente),
  // até três, como atalho para filtrar. Toque → busca aquela marca.
  const brands = [...new Set(rows.map((r) => r.brand))].slice(0, 3);

  return (
    <Stack gap="sm">
      <Text variant="overline" tone="accent" accessibilityRole="header">
        Procurar o produto
      </Text>
      <Field
        value={term}
        onChangeText={onChange}
        accessibilityLabel="Marca ou nome do produto"
        placeholder="Marca, nome ou código de barras"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
      />

      {results === 'searching' && rows.length === 0 ? (
        <Text variant="caption" tone="faint">
          Procurando…
        </Text>
      ) : null}

      {Array.isArray(results) && results.length === 0 ? (
        <Text tone="muted">Não encontramos esse produto. Você pode escrever o nome abaixo.</Text>
      ) : null}

      {brands.length > 0 ? (
        <Stack gap="xs">
          <Text variant="caption" tone="faint" accessibilityRole="header">
            Marcas
          </Text>
          <Row>
            {brands.map((b) => (
              <Button
                key={b}
                label={b}
                variant="secondary"
                size="sm"
                disabled={busy}
                accessibilityLabel={`Ver produtos da ${b}`}
                onPress={() => pickBrand(b)}
              />
            ))}
          </Row>
        </Stack>
      ) : null}

      {rows.length > 0 ? (
        <Stack gap="xs">
          <Text variant="caption" tone="faint" accessibilityRole="header">
            Produtos
          </Text>
          <Card style={styles.list}>
            {rows.map((p, index) => (
              <View key={p.id} style={[styles.row, index < rows.length - 1 && styles.divided]}>
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
        </Stack>
      ) : null}

      {/*
        SPEC-057 — crédito onde as fotos aparecem. Atribuição completa em "Fontes de dados" (Conta).
      */}
      {rows.length > 0 ? (
        <Text variant="caption" tone="faint">
          Fotos e informações dos produtos: Open Beauty Facts (CC BY-SA)
        </Text>
      ) : null}
    </Stack>
  );
}

const styles = StyleSheet.create({
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
