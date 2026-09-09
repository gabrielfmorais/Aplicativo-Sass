import type { Product, ProductCatalogIdentity, ProductCategory } from '@app/core';
import { Image, StyleSheet, View } from 'react-native';

import { Text } from '@/design/primitives';
import { color, radius, type as typeScale } from '@/design/tokens';

/**
 * SPEC-063 FR8 — **um dono só para o rótulo de categoria.**
 *
 * ⚠️ Existiam **duas** cópias desta tabela, uma na `ShelfScreen` e outra na `WashDayScreen`, e elas
 * discordariam na primeira renomeação — o defeito que a SPEC-048 já pagou uma vez com o
 * `FINISH_TECHNIQUE_LABEL`. O terceiro consumidor (o painel do cuidado) foi o gatilho para resolver
 * em vez de escrever a terceira.
 *
 * ⛔ **Nenhum rótulo diz para que o produto serve.** "Máscara" é o tipo de vidro, não uma promessa —
 * é essa contenção que mantém a prateleira fora do gate D-26/D-70.
 */
export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  shampoo: 'Shampoo',
  conditioner: 'Condicionador',
  mask: 'Máscara',
  leave_in: 'Leave-in ou creme',
  oil: 'Óleo ou sérum',
  styler: 'Finalizador',
  other: 'Outro',
};

/**
 * SPEC-054 (F32) — **o produto como ele é no mundo**, quando o app sabe qual é.
 *
 * ⚠️ **A marca vem JUNTO do nome, nunca no lugar dele.** O nome é o que ela reconhece na prateleira
 * do banheiro — *"Máscara da feira"* continua sendo o que ela chamou —, e a marca é o que torna o
 * produto o mesmo para todo mundo. Trocar um pelo outro faria a prateleira dela deixar de parecer a
 * prateleira dela, que é a única coisa que a SPEC-023 tinha para dar.
 *
 * ⚠️ **Sem foto é caminho normal, não estado de erro** (FR7). Um produto de catálogo pode não ter
 * imagem, e a parte bloqueada por direito de uso é justamente essa — se a tela dependesse dela para
 * ficar utilizável, a capability inteira dependeria do gate.
 *
 * ⛔ **Nada aqui diz o que o produto faz.** Marca, linha, variante e categoria são identidade;
 * *"para cabelos cacheados"* seria indicação, e indicação é conteúdo capilar substantivo (D-26/D-70).
 */

const SIZE = 40;

/** A inicial que o monograma mostra: a primeira letra visível do nome **dela**. */
const initialOf = (name: string): string => (name.trim()[0] ?? '?').toUpperCase();

/**
 * SPEC-063 FR5 — **a marca do produto que SEMPRE existe**: a foto quando há, o monograma quando não.
 *
 * ⚠️ **Isto não contradiz a SPEC-055, e a diferença é o que importa.** O que aquela rodada removeu
 * foi um **quadrado cinza vazio**, que com o catálogo vazio virava três caixas em branco lendo como
 * *imagem quebrada* — um espaço reservado que nunca ia preencher. Um monograma **não é espaço
 * reservado: é conteúdo**, e é permanente para o produto manual, que nunca terá foto.
 *
 * E é ele que mantém a coluna de texto alinhada: sem marca nenhuma, uma lista em que metade tem foto
 * começa em dois lugares diferentes, que é a própria definição de lista bagunçada.
 *
 * ⚠️ **`name` é obrigatório**, não opcional com fallback: sem ele o monograma não tem letra, e um
 * parâmetro que dá para esquecer é a forma de defeito que a SPEC-053 mediu no `oilDueOn`.
 */
export function ProductMark({
  identity,
  name,
  size = SIZE,
}: {
  identity: ProductCatalogIdentity | null;
  name: string;
  size?: number;
}) {
  const box = { width: size, height: size, borderRadius: radius.sm };
  if (identity?.imageUrl) {
    return (
      <Image
        source={{ uri: identity.imageUrl }}
        style={[styles.thumb, box]}
        resizeMode="contain"
        accessibilityElementsHidden
      />
    );
  }
  return (
    // O nome está ao lado; a inicial repetida só somaria ruído para quem usa leitor de tela.
    <View style={[styles.mark, box]} accessibilityElementsHidden>
      <Text style={styles.markLetter}>{initialOf(name)}</Text>
    </View>
  );
}

/**
 * A segunda linha de um produto: **marca** quando existe, categoria sempre.
 *
 * ⚠️ Com o catálogo vazio — que é o estado de hoje e o permanente até a ingestão — isto devolve
 * exatamente o que a prateleira já mostrava.
 */
export function ProductCaption({ product, categoryLabel }: { product: Product; categoryLabel: string }) {
  const marca = product.catalog
    ? [product.catalog.brand, product.catalog.line, product.catalog.variant].filter(Boolean).join(' · ')
    : null;
  return (
    <Text variant="caption" tone="muted" numberOfLines={1}>
      {marca ? `${marca} · ${categoryLabel}` : categoryLabel}
    </Text>
  );
}

const thumbBase = {
  width: SIZE,
  height: SIZE,
  borderRadius: radius.sm,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: color.border,
} as const;

const styles = StyleSheet.create({
  thumb: { ...thumbBase, backgroundColor: color.surface },
  mark: {
    ...thumbBase,
    backgroundColor: color.brandTint,
    borderColor: color.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markLetter: { ...typeScale.bodyStrong, color: color.accent },
});
