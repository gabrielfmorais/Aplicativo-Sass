import type { Product, ProductCatalogIdentity } from '@app/core';
import { Image, StyleSheet } from 'react-native';

import { Text } from '@/design/primitives';
import { color, radius } from '@/design/tokens';

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

/**
 * ⚠️ **SPEC-055 FR6 — sem imagem, NADA é renderizado. E isso é o conserto de uma regressão minha.**
 *
 * A primeira versão reservava um quadrado neutro *"para a linha não pular"*. Com o catálogo vazio —
 * que é o estado de hoje e o **permanente** até a ingestão acontecer (SPEC-054 OQ1) — a Prateleira
 * ganhou **três caixas cinza em branco**, e três caixas em branco leem como **imagem quebrada**.
 *
 * ⚠️ **Um espaço reservado que nunca vai ser preenchido é pior que nenhum**: ele promete uma foto
 * que não existe e, pior, sugere que alguma coisa falhou ao carregar. A linha voltar a ser
 * exatamente a de antes da SPEC-054 é o comportamento certo — e é o que a validação a 390px mostrou.
 */
export function ProductThumb({ identity }: { identity: ProductCatalogIdentity | null }) {
  if (!identity?.imageUrl) return null;
  return (
    <Image
      source={{ uri: identity.imageUrl }}
      style={styles.thumb}
      resizeMode="contain"
      // A imagem é ilustrativa e o nome está ao lado: descrevê-la de novo seria repetição para quem
      // usa leitor de tela.
      accessibilityElementsHidden
    />
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
});
