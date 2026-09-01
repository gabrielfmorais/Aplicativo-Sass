import type { CareTypeCode } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { Row, Text } from '@/design/primitives';
import { careColor, radius, space } from '@/design/tokens';
import { CARE_TYPE_LABEL } from '@/features/plan/copy';

/**
 * A care type, named and marked — the same way on every screen (SPEC-016 FR5).
 *
 * This existed twice, character for character, in `TodayScreen` and `PlanScreen`: the same dot, the
 * same hue lookup, the same label beside it. Two copies of something whose whole job is to look
 * identical everywhere is the one duplication worth removing — the first time they drift, a plan
 * and the day it produces stop looking like the same product, and nothing fails to tell anyone.
 *
 * The **word** carries the meaning; the hue is the second channel. A user who cannot separate teal
 * from amber still reads "Hidratação" and "Nutrição".
 */
export function CareTypeMark({ careTypeCode, big }: { careTypeCode: CareTypeCode; big?: boolean }) {
  return (
    <Row gap="sm" style={styles.row}>
      <View style={[styles.hue, { backgroundColor: careColor[careTypeCode].fg }]} />
      <Text variant={big ? 'title' : 'heading'}>{CARE_TYPE_LABEL[careTypeCode]}</Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  // `nowrap` so a long pt-BR label never drops below its own dot.
  row: { alignItems: 'center', flexWrap: 'nowrap', flexShrink: 1 },
  hue: { width: space.sm, height: space.sm, borderRadius: radius.pill },
});
