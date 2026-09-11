import type { Product, ProductCatalogIdentity, ProductCategory } from '@app/core';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { CheckIcon } from '@/design/icons';
import { Text } from '@/design/primitives';
import { color, HIT_TARGET, radius, space, type as typeScale } from '@/design/tokens';

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
        /**
         * ⚠️ **Aqui havia só a metade iOS.** `accessibilityElementsHidden` não esconde nada no
         * Android, então a miniatura do produto **era anunciada** por lá — e no web o prop era
         * descartado. `aria-hidden` cobre as três de uma vez (SPEC-072).
         */
        aria-hidden
      />
    );
  }
  return (
    // O nome está ao lado; a inicial repetida só somaria ruído para quem usa leitor de tela.
    <View style={[styles.mark, box]} aria-hidden>
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
  /**
   * ⚠️ **`minHeight` e não `height`**: com Dynamic Type grande a segunda linha cresce, e uma altura
   * fixa cortaria a categoria em vez de deixar a linha crescer (iPhone-first, gate G7 para a prova
   * final). O piso é o alvo de toque do iOS (FR6).
   */
  pick: {
    minHeight: HIT_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  // O mesmo par de estados do `Chip` — é a mesma pergunta ("marcado?"), então é a mesma linguagem.
  pickOff: { backgroundColor: color.surface, borderColor: color.border },
  pickOffPressed: { backgroundColor: color.surfacePressed },
  pickOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  pickOnPressed: { backgroundColor: color.accentBorder },
  /** `flex: 1` deixa o nome encolher em vez de empurrar a marca de seleção para fora da linha (FR4). */
  pickText: { flex: 1, gap: space.xs },
  /** Largura reservada: sem ela o texto se mexe ao marcar, e a lista inteira treme a cada toque. */
  pickCheck: { width: 20, alignItems: 'center' },
});

/**
 * SPEC-065 — **o produto como coisa que se reconhece, na hora de marcar.**
 *
 * ⚠️ **Isto substitui um `Chip`, e a razão é medida, não estética.** Com o catálogo populado
 * (SPEC-057/058), o rótulo de um produto real é *"Wella Professionals · Invigo Nutri-Enrich Deep
 * Nourishing Shampoo"* — a 390px, **4 dos 7 produtos da prateleira real ocupavam a linha inteira
 * sozinhos**. A grade de pílulas já tinha virado uma lista vertical de pílulas de larguras desiguais:
 * o custo do chip, sem o benefício dele. E o rótulo `marca · nome` truncava **o nome dela** — o
 * mesmo defeito que a SPEC-063 corrigiu no painel do cuidado, aqui com um preço maior, porque lá ela
 * **lê** e aqui ela precisa **reconhecer para tocar**.
 *
 * ⛔ **Nada aqui sugere, ordena por uso ou começa marcado** (SPEC-065 §5). Esta tela é a **fonte** do
 * que a camada de inteligência lê depois: um produto pré-marcado que ela não desmarcou vira um fato
 * que ela nunca afirmou, e volta como *"esteve em 4 dos 6 cuidados que você avaliou bem"* — uma
 * repetição que o **app** criou e ela lê como descoberta sobre a própria rotina.
 */
export function ProductPickRow({
  product,
  selected,
  onPress,
}: {
  product: Product;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      aria-checked={selected}
      /**
       * ⚠️ O rótulo acessível traz **nome e categoria juntos**, como o chip trazia: a linha visual
       * separa as duas em dois `Text`, e um leitor de tela que os anunciasse soltos daria dois
       * fragmentos em vez de um produto.
       */
      accessibilityLabel={`${product.name} — ${CATEGORY_LABEL[product.category]}`}
      style={({ pressed }) => [
        styles.pick,
        selected ? styles.pickOn : styles.pickOff,
        /**
         * ⛔ **Sem estado `disabled`, e é decisão, não esquecimento.** A marcação é otimista: a tela
         * muda na hora e **volta atrás sozinha** se a escrita falhar (SPEC-024 §16). Travar a linha
         * enquanto a requisição voa cobraria a latência dela para proteger um caso que o rollback já
         * cobre — e era assim que o chip funcionava antes desta rodada.
         */
        pressed && (selected ? styles.pickOnPressed : styles.pickOffPressed),
      ]}
    >
      <ProductMark identity={product.catalog} name={product.name} />
      <View style={styles.pickText}>
        {/* O nome DELA lidera e sozinho (BR4/SPEC-054): a marca desce para a segunda linha, onde
            cabe sem comer o que ela reconhece. */}
        <Text
          variant={selected ? 'bodyStrong' : 'body'}
          tone={selected ? 'accent' : 'default'}
          numberOfLines={1}
        >
          {product.name}
        </Text>
        <ProductCaption product={product} categoryLabel={CATEGORY_LABEL[product.category]} />
      </View>
      {/*
        FR3 — ⚠️ **o segundo canal.** Fundo e borda em ameixa dizem "marcado" para quem enxerga a
        diferença; a marca de seleção diz para todo mundo. E há um motivo **medido** para não confiar
        no canal invisível: no preview web o `accessibilityState` legado é descartado
        (SPEC-051 OQ4), então a 390px o estado só se afere pelo que ela vê.
      */}
      <View style={styles.pickCheck}>{selected ? <CheckIcon color={color.accent} size={20} /> : null}</View>
    </Pressable>
  );
}
