import type { CareTypeCode } from '@app/core';
import { CARE_GUIDES } from '@app/core';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Text } from '@/design/primitives';
import { HIT_TARGET_MIN, careColor, color, radius, space } from '@/design/tokens';
import { CareGuidePanel } from '@/features/care/CareGuidePanel';
import { HomeSection } from '@/features/care/HomeSection';
import { CARE_TYPE_LABEL } from '@/features/plan/copy';

/**
 * SPEC-031 — os guias, num lugar onde ela consiga chegar.
 *
 * ⚠️ **Isto não é conteúdo novo: é uma porta que faltava.** Os guias existem desde a SPEC-007, com
 * passos, duração e erros comuns, e são exibidos por `CareGuidePanel`. Mas o **único** caminho até
 * eles era "Como fazer" dentro de um cartão de cuidado — ou seja, ela só podia ler sobre nutrição
 * se houvesse uma nutrição agendada e ela achasse o cartão. Numa terça sem cuidado nenhum, o
 * conhecimento que o app já tem era inalcançável.
 *
 * É a mesma classe de problema que criou a SPEC-026: **capability sem lugar**. A diferença é que
 * aqui não havia sequer uma tela errada onde ela morasse — não havia nenhuma.
 *
 * ⚠️ **E não é uma segunda porta para o mesmo destino.** O "Como fazer" da Hoje é **contextual**:
 * este cuidado, agora, dentro do cartão dele. Este é **referência**: os três tipos, fora de
 * qualquer agenda. Um é a receita dentro do cardápio do dia; o outro é o livro de receitas.
 *
 * ⚠️ **Revelação é legítima aqui, e foi recusada na Hoje — a diferença importa.** Colapsar os
 * cartões da Hoje escondia **ação** ("Contar esse cuidado", "Fiz hoje"), e a SPEC-007 AC5 promete o
 * guia em todo cuidado acionável. Aqui não há ação nenhuma para esconder: é leitura, e três guias
 * abertos de uma vez seriam três telas de texto que ninguém pediu.
 *
 * **O gate de domínio continua onde estava.** O conteúdo é `candidate` (D-26/ADR-007 A1) e o
 * bloqueio é de **PUBLIC RELEASE**, não de posicionamento — mostrar o mesmo texto num segundo lugar
 * não muda o status dele, e nada aqui afirma nada além do que o guia já dizia.
 */

const ORDER: readonly CareTypeCode[] = ['hydration', 'nutrition', 'reconstruction'];

function GuideRow({ code, last }: { code: CareTypeCode; last: boolean }) {
  const [open, setOpen] = useState(false);
  const guide = CARE_GUIDES[code];
  const label = CARE_TYPE_LABEL[code];

  return (
    <View style={last ? undefined : styles.divided}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}, ${guide.durationMin} minutos`}
        accessibilityHint={open ? 'Toque para fechar o guia' : 'Toque para ler o guia'}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {/* A mesma marca de cor do cuidado que a Hoje e o ciclo usam: um tipo tem uma cor só. */}
        <View style={[styles.hue, { backgroundColor: careColor[code].fg }]} />
        <Text variant="heading" style={styles.label}>
          {label}
        </Text>
        <Text variant="caption" tone="muted">
          ~{guide.durationMin} min
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <CareGuidePanel guide={guide} showDuration={false} />
        </View>
      ) : null}
    </View>
  );
}

export function CareGuideLibrary() {
  return (
    <HomeSection title="Como fazer cada cuidado">
      <Card style={styles.panel}>
        {ORDER.map((code, index) => (
          <GuideRow key={code} code={code} last={index === ORDER.length - 1} />
        ))}
      </Card>
    </HomeSection>
  );
}

const styles = StyleSheet.create({
  /** Sem respiro no cartão: quem respira é a linha, e o filete precisa atravessar de borda a borda. */
  panel: { paddingVertical: 0, paddingHorizontal: 0, gap: 0, overflow: 'hidden' },
  divided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: HIT_TARGET_MIN,
  },
  pressed: { backgroundColor: color.surfacePressed },
  hue: { width: space.sm, height: space.sm, borderRadius: radius.pill },
  /** `flex: 1` empurra a duração para a direita e deixa o nome encolher, nunca transbordar. */
  label: { flex: 1 },
  body: { paddingHorizontal: space.lg, paddingBottom: space.lg },
});
