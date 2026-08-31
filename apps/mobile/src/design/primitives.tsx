import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { CONTENT_MAX_WIDTH, HIT_TARGET, color, elevation, radius, space, type } from './tokens';

/**
 * SPEC-016 FR1 — the shared vocabulary. Every primitive here has a real consumer in the same slice
 * that introduced it (AC3); none exists on the theory that a screen will want it one day.
 *
 * These own *appearance*. They own no business rule, no data fetching and no navigation — a screen
 * still receives its ports as props (ADR-001).
 */

// ---------------------------------------------------------------------------------------- Text

export function Text({
  variant = 'body',
  tone = 'default',
  center,
  style,
  children,
  ...rest
}: {
  variant?: keyof typeof type;
  tone?: 'default' | 'muted' | 'faint' | 'accent' | 'onFilled' | 'danger' | 'success';
  center?: boolean;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
} & Omit<React.ComponentProps<typeof RNText>, 'style' | 'children'>) {
  const tones = {
    default: color.ink,
    muted: color.inkMuted,
    faint: color.inkFaint,
    accent: color.accent,
    onFilled: color.onFilled,
    danger: color.danger,
    success: color.success,
  } as const;
  return (
    <RNText
      style={[type[variant] as TextStyle, { color: tones[tone] }, center && styles.center, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

// -------------------------------------------------------------------------------------- Screen

/**
 * The page frame: warm canvas, comfortable gutters, and a width cap so the web preview shows
 * something phone-shaped instead of a row of chips 1500px wide.
 */
export function Screen({
  children,
  scroll = true,
  footer,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Pinned below the scroll area — for a primary action that must stay reachable. */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const body = <View style={[styles.content, style]}>{children}</View>;
  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );
}

// -------------------------------------------------------------------------------------- Button

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Shows a spinner and blocks presses — the double-submit guard is still the caller's job. */
  busy?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      style={({ pressed }) => [
        styles.button,
        buttonVariant[variant].container,
        pressed && !off && buttonVariant[variant].pressed,
        off && styles.buttonOff,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={buttonVariant[variant].spinner} />
      ) : (
        <Text variant="bodyStrong" tone={buttonVariant[variant].tone}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const buttonVariant = {
  primary: {
    container: { backgroundColor: color.accent },
    pressed: { backgroundColor: color.accentPressed },
    tone: 'onFilled',
    spinner: color.onFilled,
  },
  secondary: {
    container: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.borderStrong },
    pressed: { backgroundColor: color.surfacePressed },
    tone: 'default',
    spinner: color.ink,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: color.surfaceMuted },
    tone: 'muted',
    spinner: color.inkMuted,
  },
  danger: {
    container: { backgroundColor: color.dangerSoft, borderWidth: 1, borderColor: color.danger },
    pressed: { backgroundColor: color.danger },
    tone: 'danger',
    spinner: color.danger,
  },
} as const satisfies Record<
  string,
  {
    container: ViewStyle;
    pressed: ViewStyle;
    tone: 'onFilled' | 'default' | 'muted' | 'danger';
    spinner: string;
  }
>;

// ---------------------------------------------------------------------------------------- Chip

/**
 * The onboarding's whole interaction, so it earns its polish. Selected is accent-tinted rather than
 * filled black: it reads as chosen without shouting, and keeps a row of chips calm.
 */
export function Chip({
  label,
  selected,
  onPress,
  multi = false,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `true` renders as a checkbox to assistive tech; `false` as a radio within its group. */
  multi?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipOn : styles.chipOff,
        pressed && !disabled && (selected ? styles.chipOnPressed : styles.chipOffPressed),
      ]}
    >
      <Text variant={selected ? 'bodyStrong' : 'body'} tone={selected ? 'accent' : 'default'}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------- Card

export function Card({
  children,
  tone = 'surface',
  style,
}: {
  children: ReactNode;
  tone?: 'surface' | 'muted' | 'accent';
  style?: StyleProp<ViewStyle>;
}) {
  const tones = {
    surface: { backgroundColor: color.surface, borderColor: color.border },
    muted: { backgroundColor: color.surfaceMuted, borderColor: color.border },
    accent: { backgroundColor: color.accentSoft, borderColor: color.accentBorder },
  } as const;
  return <View style={[styles.card, tones[tone], style]}>{children}</View>;
}

// --------------------------------------------------------------------------------- ProgressBar

export function ProgressBar({ value, total, label }: { value: number; total: number; label?: string }) {
  const clamped = total > 0 ? Math.min(Math.max(value / total, 0), 1) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: value }}
      {...(label ? { accessibilityLabel: label } : {})}
      style={styles.progressTrack}
    >
      <View style={[styles.progressFill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

// --------------------------------------------------------------------------------------- Field

export function Field({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  editable = true,
  ...rest
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  accessibilityLabel: string;
  editable?: boolean;
} & Omit<
  React.ComponentProps<typeof TextInput>,
  'value' | 'onChangeText' | 'placeholder' | 'accessibilityLabel' | 'editable' | 'style'
>) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      accessibilityLabel={accessibilityLabel}
      placeholderTextColor={color.inkFaint}
      style={[styles.field, !editable && styles.fieldOff]}
      {...(placeholder ? { placeholder } : {})}
      {...rest}
    />
  );
}

// ------------------------------------------------------------------------------- Stack helpers

/** Vertical rhythm without every screen re-deriving margins. */
export function Stack({
  gap = 'lg',
  children,
  style,
}: {
  gap?: keyof typeof space;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap: space[gap] }, style]}>{children}</View>;
}

/** Wrapping row — the chip groups, mainly. */
export function Row({
  gap = 'sm',
  children,
  style,
}: {
  gap?: keyof typeof space;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.row, { gap: space[gap] }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  screen: { flex: 1, backgroundColor: color.canvas, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH },
  scrollContent: { flexGrow: 1 },
  content: { paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.xl, gap: space.xl },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.canvas,
    gap: space.sm,
  },
  button: {
    minHeight: HIT_TARGET,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  buttonOff: { opacity: 0.45 },
  chip: {
    minHeight: HIT_TARGET,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  chipOff: { backgroundColor: color.surface, borderColor: color.border },
  chipOffPressed: { backgroundColor: color.surfacePressed },
  chipOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  chipOnPressed: { backgroundColor: color.accentBorder },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.sm, ...elevation.card },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.accent },
  field: {
    minHeight: HIT_TARGET,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    color: color.ink,
    ...type.body,
  },
  fieldOff: { opacity: 0.5 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
