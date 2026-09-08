import { Linking, Pressable, StyleSheet } from 'react-native';

import { Button, Card, Screen, Stack, Text } from '@/design/primitives';
import { color, space } from '@/design/tokens';

/**
 * SPEC-057 (F32) — **Fontes de dados: a atribuição, no lugar dela.**
 *
 * Parte do catálogo da Huna vem da **Open Beauty Facts**, uma base aberta. As licenças (ODbL nos
 * dados, CC BY-SA 3.0 nas imagens) **exigem atribuição** e aviso de licença — e é isto que esta tela
 * cumpre, de forma autoritativa e num lugar só, sem poluir cada cartão (a busca mostra um crédito
 * discreto onde as fotos aparecem). Conformidade em `docs/legal/OPEN-BEAUTY-FACTS-COMPLIANCE.md`.
 *
 * ⚠️ **Não afirma nada sobre cabelo.** É crédito de fonte, não conteúdo capilar.
 */

const Link = ({ label, url }: { label: string; url: string }) => (
  <Pressable
    onPress={() => void Linking.openURL(url)}
    accessibilityRole="link"
    accessibilityLabel={`${label} — abre no navegador`}
    style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
  >
    <Text tone="accent" variant="bodyStrong">
      {label}
    </Text>
  </Pressable>
);

export function DataSourcesScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen footer={<Button label="Voltar" variant="ghost" onPress={onBack} />}>
      <Stack gap="sm">
        <Text variant="display" accessibilityRole="header">
          Fontes de dados
        </Text>
        <Text tone="muted">
          Parte dos produtos do catálogo da Huna vem de bases de dados abertas. Aqui estão as fontes e as
          licenças que tornam isso possível.
        </Text>
      </Stack>

      <Card>
        <Stack gap="sm">
          <Text variant="heading" accessibilityRole="header">
            Open Beauty Facts
          </Text>
          <Text tone="muted">
            Os dados de produtos — marca, nome, categoria, tamanho e código de barras — vêm da Open Beauty
            Facts, sob a Open Database License (ODbL) e a Database Contents License (DbCL).
          </Text>
          <Text tone="muted">
            As fotos de produtos são de colaboradores da Open Beauty Facts, sob a licença Creative Commons
            Atribuição-CompartilhaIgual 3.0 (CC BY-SA 3.0), exibidas sem modificação.
          </Text>
          <Stack gap="xs">
            <Link label="openbeautyfacts.org" url="https://world.openbeautyfacts.org" />
            <Link label="Licença dos dados — ODbL 1.0" url="https://opendatacommons.org/licenses/odbl/1.0/" />
            <Link
              label="Licença das imagens — CC BY-SA 3.0"
              url="https://creativecommons.org/licenses/by-sa/3.0/"
            />
          </Stack>
        </Stack>
      </Card>

      <Card tone="muted">
        <Text tone="muted">
          A sua prateleira, os seus registros e o seu plano são seus — não vêm dessas fontes. O catálogo entra
          por cima do que você cadastra, nunca no lugar dele.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { paddingVertical: space.xs, alignSelf: 'flex-start' },
  linkPressed: { opacity: 0.6, borderRadius: space.xs, backgroundColor: color.brandTint },
});
