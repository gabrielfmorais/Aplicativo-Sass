import type { JourneyView } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Loading, ProgressBar, Row, Screen, Stack, Text } from '@/design/primitives';
import { color, radius, space } from '@/design/tokens';

/**
 * SPEC-043 (F40/F41/F42) + SPEC-059 — **Sua jornada**.
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
 * marco não alcançado é apenas um marco que ainda não chegou — e a barra de nível mostra **o que ela
 * já fez** dentro da faixa, a mesma progressão que *"faltam X para Y"* já dizia em palavra.
 */
export function JourneyScreen({
  view,
  loading,
  failed,
  onRetry,
  onShare,
  onBack,
}: {
  view: JourneyView | null;
  loading: boolean;
  failed?: boolean;
  onRetry?: () => void;
  /** SPEC-044 (F45) — a conquista mora aqui, então o card sai daqui. */
  onShare?: () => void;
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

  const reached = view.milestones.filter((m) => m.reached).length;

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
        <Stack gap="md">
          {/*
            SPEC-059 — o nível ganha um medalhão que **evolui de cor** com a faixa: começa quieto e
            aprofunda na família da marca até o vinho no topo. É "subir de nível" visto, não só lido —
            e continua sendo constância, nunca uma nota do cabelo.
          */}
          <View style={styles.levelRow}>
            <LevelMedallion level={view.level.level} />
            <Stack gap="xs" style={styles.levelText}>
              <Text variant="overline" tone="accent">
                {`Nível ${view.level.level}`}
              </Text>
              <Text variant="display" accessibilityRole="header">
                {view.level.name}
              </Text>
            </Stack>
          </View>
          <Text tone="muted">
            {view.level.toNext === null
              ? `${view.points} pontos de constância.`
              : `${view.points} pontos · faltam ${view.level.toNext} para ${view.level.nextName}.`}
          </Text>
          {/*
            A barra só existe quando há próxima faixa. **Não é meta nem cobrança:** mostra os pontos
            que ela **já fez** dentro do nível — o preenchido é conquista, não dívida —, e no topo
            (levelSpan null) ela some, porque não há próximo a perseguir (D-103).
          */}
          {view.level.levelSpan !== null ? (
            <ProgressBar
              value={view.level.pointsIntoLevel}
              total={view.level.levelSpan}
              label={`Sua constância rumo a ${view.level.nextName}`}
            />
          ) : null}
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

      {/*
        SPEC-059 — os marcos viram uma **coleção**: cada um é uma medalha, conquistada (cheia, na cor
        da marca) ou ainda por chegar (contorno quieto, nunca vermelha). Mostrar a coleção inteira é
        o ponto — ver o que ainda vem é convite, não cobrança (a mesma regra dos marcos de sempre).
        O contador conta **o que ela já tem**, não o que falta.
      */}
      <Stack gap="md">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          Conquistas
        </Text>
        <Row gap="md">
          {view.milestones.map((milestone) => (
            <Badge key={milestone.key} label={milestone.label} reached={milestone.reached} />
          ))}
        </Row>
        <Text variant="caption" tone="muted">
          {reached === 1 ? 'Você já conquistou 1 marco.' : `Você já conquistou ${reached} marcos.`}
          {` ${view.caresAttended} cuidados do seu plano até aqui.`}
        </Text>
      </Stack>

      {/*
        SPEC-044 (F45) — a porta do card. **Uma oferta, nunca um empurrão:** o botão é secundário,
        vem depois da conquista e não promete nada sobre o que vai acontecer — quem decide o que
        aparece, e se vai aparecer, é a tela seguinte (BR2).
      */}
      {onShare ? <Button label="Compartilhar minha jornada" variant="secondary" onPress={onShare} /> : null}
    </Screen>
  );
}

/**
 * SPEC-059 — o medalhão do nível. **A cor aprofunda com a faixa** (quieto → berry → ameixa → violeta
 * → vinho), então subir de nível se vê. Todos os tons vêm da família da marca (tokens); nada aqui é
 * cor de ação nem de sucesso — é identidade, não estado.
 */
const LEVEL_LOOK = [
  { bg: color.surfaceMuted, fg: color.inkMuted, border: color.borderStrong },
  { bg: color.berry, fg: color.onFilled, border: color.berry },
  { bg: color.accent, fg: color.onFilled, border: color.accent },
  { bg: color.violet, fg: color.onFilled, border: color.violet },
  { bg: color.wine, fg: color.onFilled, border: color.wine },
] as const;

function LevelMedallion({ level }: { level: number }) {
  const look = LEVEL_LOOK[Math.min(Math.max(level, 1), LEVEL_LOOK.length) - 1] ?? LEVEL_LOOK[0];
  return (
    <View
      style={[styles.medallion, { backgroundColor: look.bg, borderColor: look.border }]}
      accessibilityLabel={`Nível ${level}`}
    >
      <Text variant="title" style={{ color: look.fg }}>
        {String(level)}
      </Text>
    </View>
  );
}

/**
 * Uma medalha da coleção. **Conquistada** é cheia, na ameixa da marca, com o traço de confirmação;
 * **por chegar** é um contorno quieto — nunca vermelha, nunca um cadeado que leia como negação. O
 * rótulo fica legível nos dois estados, porque ver o que ainda vem é parte da coleção.
 */
function Badge({ label, reached }: { label: string; reached: boolean }) {
  return (
    <View style={styles.badge}>
      <View style={[styles.badgeMark, reached ? styles.badgeMarkOn : styles.badgeMarkOff]}>
        {reached ? (
          <Text variant="heading" tone="onFilled">
            ✓
          </Text>
        ) : null}
      </View>
      <Text variant="caption" tone={reached ? 'default' : 'faint'} center>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  levelText: { flexShrink: 1 },
  medallion: {
    width: space.xxxl,
    height: space.xxxl,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Três por linha a 390px; o rótulo centra sob a medalha. */
  badge: { width: '30%', alignItems: 'center', gap: space.xs },
  badgeMark: {
    width: space.xxxl,
    height: space.xxxl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badgeMarkOn: { backgroundColor: color.accent, borderColor: color.accent },
  /** Por chegar: contorno quieto, sem preenchimento. **Nada fica vermelho** — não há falha aqui. */
  badgeMarkOff: { backgroundColor: color.surfaceMuted, borderColor: color.border },
});
