import type { Product, ProductCatalogPort, ProductPort } from '@app/core';
import { PRODUCT_CATEGORIES, PRODUCT_NAME_MAX_LENGTH } from '@app/core';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  Field,
  Loading,
  Row,
  Screen,
  ScreenHeader,
  Stack,
  Text,
} from '@/design/primitives';
import { HIT_TARGET_MIN, color, space } from '@/design/tokens';
import { useAddProduct } from '@/features/shelf/use-add-product';
import { CatalogSearchSection } from '@/features/shelf/CatalogSearchSection';
import { CATEGORY_LABEL, ProductCaption, ProductMark } from '@/features/shelf/ProductIdentity';
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

type Loadable<T> = 'loading' | 'error' | T;

export function ShelfScreen({
  products,
  catalog,
  profile,
  onOpenUsage,
}: {
  products: ProductPort;
  /**
   * SPEC-054 (F32) — a leitura do catálogo de produtos reais.
   *
   * ⚠️ **Opcional, e não por conveniência:** a tela tem de funcionar inteira sem ele, porque é
   * exatamente assim que ela funciona hoje e vai continuar funcionando até a ingestão acontecer
   * (**TRUE HUMAN GATE**, OQ1). Sem esta prop, a busca não existe e digitar é o caminho completo.
   */
  catalog?: ProductCatalogPort;
  /**
   * SPEC-027 — a prateleira virou aba, então ela ganha o mesmo cabeçalho das outras: o avatar é a
   * porta de **Você**, e é a mesma porta em todas as abas. Uma aba sem avatar seria a única tela do
   * app onde o perfil some.
   */
  profile?: { readonly name: string | null; readonly onPress: () => void };
  /**
   * SPEC-049 (P6) — **Smart Shelf**: como ela usa o que tem. Fica aqui porque é aqui que ela olha
   * para a prateleira; premium é decidido lá dentro, e a porta aparece para todo mundo.
   */
  onOpenUsage?: () => void;
}) {
  const [list, setList] = useState<Loadable<readonly Product[]>>('loading');
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  /**
   * SPEC-033 — o cadastro é uma **ação**, não o topo permanente da tela.
   *
   * ⚠️ **A tela chamada "Prateleira" mostrava, antes de qualquer produto, ~470px de formulário
   * vazio** — campo mais sete categorias. O que ela tem em casa, que é o assunto, começava abaixo
   * da dobra. E o "Adicionar" ficava fixo no rodapé, permanentemente desabilitado enquanto o
   * formulário estivesse vazio: um botão primário morto no pé de toda visita.
   *
   * ⚠️ **Aberto por padrão quando a prateleira está vazia**, e isso não é exceção — é o mesmo
   * princípio: mostrar primeiro o que a tela é sobre. Sem nenhum produto, o formulário **é** o
   * conteúdo, e escondê-lo atrás de um toque seria esconder a única coisa que há para fazer.
   */
  const [adding, setAdding] = useState(false);

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

  /**
   * ⚠️ **`length === 0` só conta quando a leitura voltou.** `list` é `'loading' | 'error' | Product[]`
   * — tratar qualquer um dos dois primeiros como "vazia" abriria o formulário por cima de um estado
   * que ainda não sabe de nada, e é a mesma armadilha que o `productCount: null` das sugestões evita.
   */
  const empty = Array.isArray(list) && list.length === 0;
  const formOpen = adding || empty;

  return (
    <Screen
      footer={
        // Sem "Voltar": aba não volta, sai-se dela tocando outra aba (SPEC-027).
        formOpen ? (
          <Stack gap="sm">
            <Button label="Adicionar" onPress={add.submit} disabled={!add.ready} busy={add.busy} />
            {/* Só quando há para onde voltar: com a prateleira vazia, fechar deixaria a tela sem nada. */}
            {empty ? null : (
              <Button label="Cancelar" variant="ghost" onPress={() => setAdding(false)} disabled={add.busy} />
            )}
          </Stack>
        ) : (
          /**
           * ⚠️ **Uma vaga primária só, que muda de sentido.** Fechado, ela **abre** o formulário;
           * aberto, ela **envia**. Dois botões primários ao mesmo tempo — um para abrir e outro para
           * enviar — seriam duas ações principais na mesma tela, que é a definição de nenhuma.
           */
          <Button label="Adicionar produto" onPress={() => setAdding(true)} />
        )
      }
    >
      <ScreenHeader title="Seus produtos" {...(profile ? { profile } : {})} />

      {/*
        SPEC-049 (P6) — a porta do Smart Shelf. Só quando ela **tem** produtos: numa prateleira
        vazia, "como você usa" não teria o que contar, e um botão que leva a nada é pior que nenhum.
      */}
      {onOpenUsage && Array.isArray(list) && list.length > 0 ? (
        /*
          ⚠️ **SPEC-055 — largura de conteúdo, não da tela.**

          Em largura total, um botão `secondary` (branco, borda, cantos arredondados) tem **a mesma
          forma de um campo de texto** — e logo abaixo de um cabeçalho, é exatamente o que ele
          parecia. Um botão do tamanho do que ele diz volta a se parecer com um botão.
        */
        <Button
          label="Como você usa sua prateleira"
          variant="secondary"
          size="sm"
          onPress={onOpenUsage}
          style={styles.inlineStart}
        />
      ) : null}

      {/*
        A explicação aparece quando ela importa: cadastrando, ou sem nada cadastrado. Com a
        prateleira cheia, ela já sabe o que é a prateleira — e três linhas repetindo isso em toda
        visita empurram para baixo justamente o que ela veio ver.
      */}
      {formOpen ? (
        <Text tone="muted">
          O que você já tem em casa, do jeito que você chama. Serve para o app não sugerir o que você não tem.
        </Text>
      ) : null}

      {/*
        SPEC-054 (F32) — buscar o produto real vem **antes** de digitar, e some inteiro quando o
        catálogo está vazio (FR8). ⚠️ Digitar continua logo abaixo, sempre: o catálogo chega **por
        cima** da prateleira manual, nunca no lugar dela (G3).
      */}
      {formOpen && catalog ? (
        <CatalogSearchSection catalog={catalog} busy={busy} onPick={add.fromCatalog} />
      ) : null}

      {formOpen ? (
        <>
          <Field
            value={add.draft}
            onChangeText={add.type}
            accessibilityLabel="Nome do produto"
            placeholder="Nome do produto"
            maxLength={PRODUCT_NAME_MAX_LENGTH}
            autoCapitalize="sentences"
            autoCorrect={false}
            // SPEC-060 FR9 — no iPhone a tecla passa a dizer "Concluído": fecha o teclado e revela
            // as categorias logo abaixo do campo, em vez de "return".
            returnKeyType="done"
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
        </>
      ) : null}

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
        <Text variant="overline" tone="accent" accessibilityRole="header">
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
          /**
           * ⚠️ **Uma linha por produto, num cartão só.** Cada produto era um `Card` inteiro com nome,
           * categoria e um botão de remover — ~200px cada. Uma prateleira de dez vidros virava uma
           * rolagem de duas telas para ler dez nomes. Aqui a linha diz tudo o que a lista precisa
           * dizer, e a ação continua à vista: nada ficou atrás de um toque.
           */
          <Card style={styles.list}>
            {list.map((product, index) => (
              <View key={product.id} style={[styles.row, index < list.length - 1 && styles.divided]}>
                {/*
                  SPEC-054 — a foto real quando existe, e um lugar neutro do mesmo tamanho quando
                  não (FR7): a linha não pode pular de altura conforme o produto tenha imagem.
                */}
                <ProductMark identity={product.catalog} name={product.name} />
                <View style={styles.text}>
                  {/* Uma linha só: um nome comprido corta, e nunca empurra a categoria para fora. */}
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {product.name}
                  </Text>
                  {/* ⚠️ A marca vem JUNTO da categoria, nunca no lugar do nome que ela escolheu. */}
                  <ProductCaption product={product} categoryLabel={CATEGORY_LABEL[product.category]} />
                </View>
                <Button
                  label="Tirar"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  accessibilityLabel={`Tirar ${product.name} da prateleira`}
                  onPress={() => archive(product.id)}
                />
              </View>
            ))}
          </Card>
        )}
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** Um botão dentro do corpo não ocupa a linha inteira (mesma regra da SPEC-023/SPEC-024). */
  inlineStart: { alignSelf: 'flex-start' },
  /** Sem respiro no cartão: quem respira é a linha, e o filete precisa atravessar de borda a borda. */
  list: { paddingVertical: 0, paddingHorizontal: 0, gap: 0, overflow: 'hidden' },
  divided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: HIT_TARGET_MIN,
  },
  /** `flex: 1` deixa o nome encolher e mantém o botão colado à direita, sempre no mesmo lugar. */
  text: { flex: 1, gap: space.xs },
});
