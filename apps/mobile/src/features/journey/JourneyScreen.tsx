import type { JourneyView } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Loading, Row, Screen, Stack, Tag, Text } from '@/design/primitives';
import { color, radius, space } from '@/design/tokens';

/**
 * SPEC-043 (F40/F41/F42) — **Sua jornada**.
 *
 * ⚠️ **Superfície própria, e isso é arquitetura, não estética** (D-103). A Jornada **não** é um
 * widget pendurado na Progresso nem na visão de ciclo: aquelas telas respondem *"o que aconteceu"* e
 * continuam **sem nota**, com as barreiras de teste da SPEC-009/019/021 intactas.
 *
 * ⚠️ **Nada aqui fala do cabelo dela.** A Jornada diz *"minha consistência na jornada"*, nunca
 * *"quão saudável está meu cabelo"* — a segunda frase seria avaliação capilar, precisaria de revisor
 * (D-26) e o produto já a recusou três vezes. É por medir **aderência ao plano** que ela fica fora
 * do gate; o preço dessa isenção é não se disfarçar.
 *
 * ⚠️ **E não cobra.** Não há barra de meta, não há "faltam X para não perder", não há vermelho. Um
 * marco não alcançado é apenas um marco que ainda não chegou.
 */
export function JourneyScreen({
  view,
  loading,
  failed,
  onRetry,
  onBack,
}: {
  view: JourneyView | null;
  loading: boolean;
  failed?: boolean;
  onRetry?: () => void;
  onBack: () => void;
}) {
  if (loading) return <Loading label="Abrindo sua jornada…" />;
  /**
   * ⚠️ **Não carregou não é "carregando".** Sem este ramo, uma leitura que falhou deixava a tela
   * girando *"Abrindo sua jornada…"* **para sempre**, sem dizer o que houve e sem oferecer saída —
   * e a Jornada é justamente a tela em que ficar sem resposta dói mais, porque ela veio ver o que
   * construiu. A frase não culpa ela nem inventa número nenhum.
   */
  if (!view) {
    return (
      <Screen footer={<Button label="Voltar" variant="ghost" onPress={onBack} />}>
        <Card>
          <Stack gap="lg">
            <Text variant="heading" accessibilityLiveRegion="polite">
              {failed ? 'Não foi possível abrir sua jornada agora.' : 'Sua jornada começa com o seu plano.'}
            </Text>
            {failed && onRetry ? <Button label="Tentar novamente" onPress={onRetry} /> : null}
          </Stack>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label="Voltar" variant="ghost" onPress={onBack} />}>
      <Stack gap="sm">
        <Text variant="display" accessibilityRole="header">
          Sua jornada
        </Text>
        {/* A frase que define a capability, dita para ela — e a razão de nada aqui virar nota. */}
        <Text tone="muted">Aqui é a sua constância com o plano. Não é uma nota, e não é sobre o cabelo.</Text>
      </Stack>

      <Card tone="accent">
        <Stack gap="sm">
          <Text variant="overline" tone="accent">
            {`Nível ${view.level.level}`}
          </Text>
          <Text variant="display" accessibilityRole="header">
            {view.level.name}
          </Text>
          <Text tone="muted">
            {view.level.toNext === null
              ? `${view.points} pontos de constância.`
              : `${view.points} pontos · faltam ${view.level.toNext} para ${view.level.nextName}.`}
          </Text>
        </Stack>
      </Card>

      <Card>
        <Stack gap="sm">
          <Text variant="heading" accessibilityRole="header">
            Sequência
          </Text>
          <Text variant="display">{view.streak}</Text>
          <Text tone="muted">
            {/*
              ⚠️ A frase é a regra: a sequência conta **cuidados do plano**, não dias. Dizer "dias
              seguidos" seria prometer um streak diário — o incentivo que a D-103 proíbe, porque num
              plano de 4 a 12 cuidados por mês ele só se cumpre lavando mais.
            */}
            {view.streak === 1 ? 'cuidado do seu plano em sequência' : 'cuidados do seu plano em sequência'}
          </Text>
          {view.frozen ? (
            <Text variant="caption" tone="muted">
              Seu cronograma está pausado — sua sequência está guardada, esperando você.
            </Text>
          ) : (
            <Text variant="caption" tone="muted">
              Dia sem cuidado planejado não interrompe nada.
            </Text>
          )}
        </Stack>
      </Card>

      <Stack gap="md">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          Marcos
        </Text>
        <Row>
          {view.milestones.map((milestone) => (
            <View key={milestone.key} style={[styles.milestone, milestone.reached && styles.reached]}>
              <Tag label={milestone.label} tone={milestone.reached ? 'accent' : 'neutral'} />
            </View>
          ))}
        </Row>
        <Text variant="caption" tone="muted">
          {`${view.caresAttended} cuidados do seu plano até aqui.`}
        </Text>
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** Alcançado ganha borda; não alcançado fica quieto. **Nada fica vermelho** — não há falha aqui. */
  milestone: { borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent', padding: space.xs },
  reached: { borderColor: color.accentBorder },
});
