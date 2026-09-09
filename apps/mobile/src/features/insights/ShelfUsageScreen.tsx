import type { ShelfUsage } from '@app/core';

import { StyleSheet, View } from 'react-native';

import { Button, Card, Loading, Screen, Stack, Text } from '@/design/primitives';
import { space } from '@/design/tokens';
import { formatPlannedDate } from '@/features/plan/copy';
import { CATEGORY_LABEL, ProductCaption, ProductMark } from '@/features/shelf/ProductIdentity';

/**
 * SPEC-049 (P6) — **Como você usa sua prateleira**.
 *
 * > Ela tem doze produtos no banheiro e não sabe quais está usando. — Blueprint §10
 *
 * ⚠️ **Contagem, nunca julgamento.** *"Você usou em 8 dos seus 14 registros"* é fato dela. *"Este
 * produto funciona para você"* seria alegação capilar (D-26/D-70); *"seus melhores produtos"* seria
 * o **ranking pessoal**, que é o `P7` e é outra decisão. Não há média, nota nem ordem de mérito
 * nesta tela — há **quantas vezes**.
 *
 * ⚠️ **"Nunca apareceu" não é acusação.** Pode ser produto novo, sazonal, ou simplesmente não
 * marcado. A tela diz o fato e para. Sugerir descarte, troca ou compra é `P18`, atrás do seu gate.
 */
export function ShelfUsageScreen({
  view,
  loading,
  failed,
  entitled,
  onRetry,
  onBack,
}: {
  view: ShelfUsage | null;
  loading: boolean;
  failed?: boolean;
  /** `advanced_insights` — decidido pelo servidor, nunca por uma checagem de tela. */
  entitled: boolean;
  onRetry?: () => void;
  onBack: () => void;
}) {
  const footer = <Button label="Voltar" variant="ghost" onPress={onBack} />;
  const header = (
    <Stack gap="sm">
      <Text variant="display" accessibilityRole="header">
        Sua prateleira, em uso
      </Text>
      <Text tone="muted">Quantas vezes cada produto apareceu nos seus registros. Só isso, e nada além.</Text>
    </Stack>
  );

  /** Premium **como adição**, nunca como muro (D-83). */
  if (!entitled) {
    return (
      <Screen footer={footer}>
        {header}
        <Card>
          <Stack gap="sm">
            <Text variant="heading" accessibilityRole="header">
              Faz parte do premium
            </Text>
            <Text tone="muted">
              Ver como você usa a sua prateleira é uma das coisas que o premium acrescenta. Cadastrar, marcar
              e consultar seus produtos continua igual, e continua seu.
            </Text>
          </Stack>
        </Card>
      </Screen>
    );
  }

  if (loading) return <Loading label="Lendo seus registros…" />;

  if (!view) {
    return (
      <Screen footer={footer}>
        {header}
        <Card>
          <Stack gap="lg">
            <Text variant="heading" accessibilityLiveRegion="polite">
              Não foi possível ler seus registros agora.
            </Text>
            {failed && onRetry ? <Button label="Tentar novamente" onPress={onRetry} /> : null}
          </Stack>
        </Card>
      </Screen>
    );
  }

  if (view.totalProducts === 0) {
    return (
      <Screen footer={footer}>
        {header}
        <Card>
          <Stack gap="sm">
            <Text variant="heading" accessibilityRole="header">
              Sua prateleira ainda está vazia
            </Text>
            <Text tone="muted">
              Quando você cadastrar seus produtos e marcar o que usou nos cuidados, esta tela conta o resto.
            </Text>
          </Stack>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen footer={footer}>
      {header}

      {view.used.length > 0 ? (
        <Stack gap="md">
          <Text variant="overline" tone="accent" accessibilityRole="header">
            O que você mais usa
          </Text>
          {view.used.map((u) => (
            <Card key={u.product.id}>
              <Stack gap="sm">
                {/*
                  SPEC-066 FR1 — ⚠️ **a mesma identidade das outras superfícies.** A tela era uma
                  lista de nomes: a mesma queixa que o dono fez sobre a prateleira dentro do cuidado,
                  numa tela **Premium**. Foto, marca e categoria vêm do `ProductIdentity`, que é o
                  dono único disso desde a SPEC-063.
                */}
                <View style={styles.row}>
                  <ProductMark identity={u.product.catalog} name={u.product.name} />
                  <View style={styles.rowText}>
                    <Text variant="heading" accessibilityRole="header" numberOfLines={2}>
                      {u.product.name}
                    </Text>
                    <ProductCaption product={u.product} categoryLabel={CATEGORY_LABEL[u.product.category]} />
                  </View>
                </View>
                <Text tone="muted">
                  {`em ${u.cares} ${u.cares === 1 ? 'registro' : 'registros'} de ${view.recordedCares}`}
                </Text>
                {/*
                  SPEC-066 FR2 — ⚠️ **a metade da pergunta que a contagem não responde.** *"Em 4 de
                  6"* não distingue o produto que ela usou ontem do que ela largou em julho.

                  ⛔ **A data é dita e mais nada** (BR4): *"faz tempo que você não usa"* seria
                  conselho com cara de fato, e conselho sobre produto é `P18`.
                */}
                <Text variant="caption" tone="faint">
                  {`última vez em ${formatPlannedDate(u.lastUsedOn)}`}
                </Text>
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : (
        <Card>
          <Stack gap="sm">
            <Text variant="heading" accessibilityRole="header">
              A Huna ainda está conhecendo sua rotina
            </Text>
            <Text tone="muted">
              {`Você tem ${view.totalProducts} ${view.totalProducts === 1 ? 'produto' : 'produtos'} na prateleira e ainda não marcou nenhum num cuidado. É a marcação que conta a história.`}
            </Text>
          </Stack>
        </Card>
      )}

      {view.neverUsed.length > 0 ? (
        <Stack gap="sm">
          <Text variant="overline" tone="accent" accessibilityRole="header">
            Ainda sem registro
          </Text>
          {/*
            ⚠️ **Fato, não conselho.** A frase diz o que é: não apareceu. Nada sobre descartar,
            substituir ou comprar — isso é `P18`, atrás do próprio gate.
          */}
          <Text tone="muted">
            Estes estão na sua prateleira e ainda não apareceram em nenhum registro. Pode ser novo, pode ser
            de outra época — a Huna só conta o que você marcou.
          </Text>
          {/*
            FR3 — ⚠️ **eram `Tag` de nome cru**, e uma etiqueta é a forma mais apagada que este app
            tem. Estes são produtos que ela tem em casa e não está usando — o assunto inteiro desta
            seção —, e sem foto nem marca ela precisa lembrar de cor qual vidro é cada nome.
          */}
          {view.neverUsed.map((p) => (
            <View key={p.id} style={styles.row}>
              <ProductMark identity={p.catalog} name={p.name} />
              <View style={styles.rowText}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {p.name}
                </Text>
                <ProductCaption product={p} categoryLabel={CATEGORY_LABEL[p.category]} />
              </View>
            </View>
          ))}
        </Stack>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  /** `flex: 1` deixa o nome encolher em vez de empurrar a marca para fora da linha. */
  rowText: { flex: 1, gap: space.xs },
});
