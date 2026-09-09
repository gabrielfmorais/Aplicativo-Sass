import type { JourneyView } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Stack, Text } from '@/design/primitives';
import { space } from '@/design/tokens';

/**
 * SPEC-069 — **a Jornada, em resumo, na Hoje.**
 *
 * ⚠️ **O que existia era uma porta sem informação.** A entrada da Jornada na Hoje era um botão
 * *"Sua jornada"* e nada mais: ocupava uma linha inteira da home para dizer **zero** sobre a jornada
 * dela, e lia como um botão solto no meio da tela — a queixa do dono, palavra por palavra.
 *
 * ⚠️ **Resumo, e não a tela em miniatura.** Nível, pontos e sequência são os três fatos que a
 * própria tela da Jornada abre; a barra de progressão, os marcos e o histórico continuam **lá**. Uma
 * home que repete a tela inteira não é resumo, é duplicação — e a Jornada tem **superfície própria**
 * (D-103), que é justamente o que este cartão não pode substituir.
 *
 * ⛔ **Nenhuma regra de gamificação nova.** Todo número vem do `JourneyView` que a rota já carrega
 * para a celebração e para os momentos compartilháveis (`F46`). ⛔ E nada aqui fala do **cabelo**: a
 * Jornada mede **consistência com o plano**, nunca como o cabelo está (D-103/D-26), com barreira de
 * teste.
 *
 * ⛔ **Sem cobrança.** Nenhum *"faltam X para o próximo nível"*, nenhuma contagem regressiva, nenhum
 * *"não perca sua sequência"* — a razão pela qual a entrada nasceu quieta (SPEC-043) continua
 * valendo: quem quiser olhar, olha.
 */
export function JourneySummary({ view, onOpen }: { view: JourneyView | null; onOpen: () => void }) {
  return (
    <Card>
      <Stack gap="sm">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          Sua jornada
        </Text>

        {/*
          ⚠️ **A PORTA existe mesmo sem os números, e isto foi um defeito do próprio diff.** A
          primeira versão só renderizava o cartão quando a view existia — então, enquanto a jornada
          carregava, a entrada **piscava**; e se a leitura **falhasse**, ela perdia o único caminho
          até a tela da Jornada, que é justamente quem tem o estado de erro com nova tentativa.

          ⛔ Sem view, nada de zero heroico: o cartão mostra o que sabe (nada) e continua sendo porta.
        */}
        {view ? (
          /*
            A hierarquia do resumo: **o nível é a identidade** — "Constante" é o que ela reconhece —,
            e os pontos são a medida. Juntos numa linha, com o peso separando os dois.
          */
          <View style={styles.line}>
            <Text variant="bodyStrong">{`Nível ${view.level.level} · ${view.level.name}`}</Text>
            <Text tone="muted">{`${view.points} ${view.points === 1 ? 'ponto' : 'pontos'}`}</Text>
          </View>
        ) : null}

        {/*
          ⚠️ **A sequência só aparece quando existe.** "0 cuidados em sequência" não é informação: é
          uma falta apontada na home, e apontar falta é o oposto do que a D-103 permite.

          ⚠️ **Pausada, ela congela** (SPEC-022) — e continua sendo verdade, então continua aparecendo.
        */}
        {view && view.streak > 0 ? (
          <Text variant="caption" tone="muted">
            {`${view.streak} ${view.streak === 1 ? 'cuidado' : 'cuidados'} em sequência`}
          </Text>
        ) : null}

        {/* SPEC-055 FR5 — é uma porta para outra tela, e portas se parecem com portas. */}
        <Button label="Ver jornada" variant="secondary" size="sm" onPress={onOpen} style={styles.action} />
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  /**
   * `space.md` entre os dois, e ⚠️ **não `space-between`**: numa linha esticada de borda a borda, os
   * pontos ficariam soltos no canto direito, longe do nível a que pertencem. Lado a lado, leem como
   * uma frase só.
   */
  line: { flexDirection: 'row', alignItems: 'baseline', gap: space.md, flexWrap: 'wrap' },
  /** Não ocupa a linha: uma porta do tamanho do que ela diz (SPEC-055). */
  action: { alignSelf: 'flex-start' },
});
