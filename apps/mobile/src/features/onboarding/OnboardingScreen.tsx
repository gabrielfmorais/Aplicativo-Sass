import type { HairProfileInput, HairProfilePort, HairProfileSnapshot } from '@app/core';
import { HairProfileInputSchema } from '@app/core';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// UX labels (pt-BR) for the approved inputs (SPEC-002 §6). Values are the domain vocabulary.
type Opt<T> = { value: T; label: string };
const PATTERN: Opt<HairProfileInput['hairPattern']>[] = [
  { value: 'straight', label: 'Liso' },
  { value: 'wavy', label: 'Ondulado' },
  { value: 'curly', label: 'Cacheado' },
  { value: 'coily', label: 'Crespo' },
  { value: 'transitioning_or_mixed', label: 'Misto / Em transição' },
  { value: 'unknown', label: 'Não sei' },
];
const THICKNESS: Opt<HairProfileInput['strandThickness']>[] = [
  { value: 'fine', label: 'Fino' },
  { value: 'medium', label: 'Médio' },
  { value: 'coarse', label: 'Grosso' },
  { value: 'unknown', label: 'Não sei' },
];
const SCALP: Opt<HairProfileInput['scalpTendency']>[] = [
  { value: 'oily_quickly', label: 'Fica oleoso rapidamente' },
  { value: 'balanced', label: 'Equilibrado' },
  { value: 'dry_tendency', label: 'Tende a ficar seco' },
  { value: 'unknown', label: 'Não sei' },
];
const WASH: Opt<HairProfileInput['washFrequency']>[] = [
  { value: 'once_or_less_weekly', label: '1x ou menos por semana' },
  { value: 'twice_weekly', label: '2x por semana' },
  { value: 'three_to_four_weekly', label: '3–4x por semana' },
  { value: 'five_or_more_weekly', label: '5x ou mais por semana' },
  { value: 'varies', label: 'Varia muito' },
];
const CHEMICAL: Opt<HairProfileInput['chemicalTreatments'][number]>[] = [
  { value: 'coloring', label: 'Coloração' },
  { value: 'bleaching_or_highlights', label: 'Descoloração / Luzes' },
  { value: 'straightening_relaxing_or_progressive', label: 'Alisamento / Relaxamento / Progressiva' },
  { value: 'perm_or_chemical_texturizing', label: 'Permanente / Texturização química' },
];
const HEAT: Opt<HairProfileInput['heatUsage']>[] = [
  { value: 'almost_never', label: 'Quase nunca' },
  { value: 'one_to_two_weekly', label: '1–2x por semana' },
  { value: 'three_to_four_weekly', label: '3–4x por semana' },
  { value: 'almost_daily', label: 'Quase todo dia' },
];
const CONCERNS: Opt<HairProfileInput['currentConcerns'][number]>[] = [
  { value: 'dryness', label: 'Ressecado' },
  { value: 'breakage', label: 'Quebra com facilidade' },
  { value: 'tangling', label: 'Embaraça muito' },
  { value: 'dullness', label: 'Sem brilho' },
  { value: 'frizz', label: 'Com bastante frizz' },
  { value: 'no_major_concern', label: 'Sem problema importante' },
];
const GOAL: Opt<HairProfileInput['primaryGoal']>[] = [
  { value: 'softness_and_hydration', label: 'Mais maciez e hidratação' },
  { value: 'reduce_breakage_and_strengthen', label: 'Reduzir quebra e fortalecer' },
  { value: 'recover_chemical_or_heat_damage', label: 'Recuperar danos de química/calor' },
  { value: 'definition_and_frizz_control', label: 'Mais definição e controle de frizz' },
  { value: 'maintain_healthy_hair', label: 'Manter o cabelo saudável' },
];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={selected ? styles.chipTextSelected : undefined}>{label}</Text>
    </Pressable>
  );
}

function Question<T extends string>({
  title,
  hint,
  options,
  isSelected,
  onSelect,
}: {
  title: string;
  hint?: string;
  options: Opt<T>[];
  isSelected: (v: T) => boolean;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={styles.question}>
      <Text style={styles.qTitle} accessibilityRole="header">
        {title}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.chips}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={isSelected(o.value)}
            onPress={() => onSelect(o.value)}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Minimal, mobile-first onboarding for SPEC-002: collects the 8 approved inputs (§6) and saves an
 * immutable snapshot. No diagnosis (D-26). Onboarding completion is derived from the snapshot's
 * existence (no onboarding_status). Prevents accidental double-submit via the submitting state.
 *
 * `onCancel` is optional: absent for first onboarding (there is nowhere to go back to), present for
 * SPEC-014 reassessment so the questions step can be abandoned at any point (AC6) without a device
 * back button, leaving the active plan untouched.
 */
export function OnboardingScreen({
  hairProfile,
  onSaved,
  onCancel,
}: {
  hairProfile: HairProfilePort;
  onSaved: (snapshot: HairProfileSnapshot) => void;
  onCancel?: () => void;
}) {
  const [hairPattern, setHairPattern] = useState<HairProfileInput['hairPattern']>();
  const [strandThickness, setStrandThickness] = useState<HairProfileInput['strandThickness']>();
  const [scalpTendency, setScalpTendency] = useState<HairProfileInput['scalpTendency']>();
  const [washFrequency, setWashFrequency] = useState<HairProfileInput['washFrequency']>();
  const [chemicalTreatments, setChemical] = useState<HairProfileInput['chemicalTreatments']>([]);
  const [heatUsage, setHeatUsage] = useState<HairProfileInput['heatUsage']>();
  const [currentConcerns, setConcerns] = useState<HairProfileInput['currentConcerns']>([]);
  const [primaryGoal, setPrimaryGoal] = useState<HairProfileInput['primaryGoal']>();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const toggleChemical = (v: HairProfileInput['chemicalTreatments'][number]) =>
    setChemical((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  // no_major_concern is exclusive (§6): selecting it clears the rest; any other clears it.
  const toggleConcern = (v: HairProfileInput['currentConcerns'][number]) =>
    setConcerns((prev) => {
      if (v === 'no_major_concern') return prev.includes(v) ? [] : ['no_major_concern'];
      const rest = prev.filter((x) => x !== 'no_major_concern');
      return rest.includes(v) ? rest.filter((x) => x !== v) : [...rest, v];
    });

  const input = useMemo(
    () => ({
      hairPattern,
      strandThickness,
      scalpTendency,
      washFrequency,
      chemicalTreatments,
      heatUsage,
      currentConcerns,
      primaryGoal,
    }),
    [
      hairPattern,
      strandThickness,
      scalpTendency,
      washFrequency,
      chemicalTreatments,
      heatUsage,
      currentConcerns,
      primaryGoal,
    ],
  );
  const parsed = HairProfileInputSchema.safeParse(input);
  const canSave = parsed.success && !submitting;

  const save = () => {
    if (!parsed.success) {
      setMessage('Responda todas as perguntas para continuar.');
      return;
    }
    setSubmitting(true);
    setMessage(null);
    hairProfile
      .save(parsed.data)
      .then(onSaved)
      .catch(() => {
        setMessage('Não foi possível salvar. Tente novamente.');
        setSubmitting(false);
      });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Sobre o seu cabelo
      </Text>
      <Text style={styles.subtitle}>Algumas perguntas rápidas para personalizar seus cuidados.</Text>

      {onCancel ? (
        <Pressable
          style={styles.cancel}
          onPress={onCancel}
          disabled={submitting}
          accessibilityRole="button"
        >
          <Text>Cancelar</Text>
        </Pressable>
      ) : null}

      <Question
        title="Qual é o seu tipo de curvatura?"
        options={PATTERN}
        isSelected={(v) => hairPattern === v}
        onSelect={setHairPattern}
      />
      <Question
        title="Qual é a espessura do fio?"
        options={THICKNESS}
        isSelected={(v) => strandThickness === v}
        onSelect={setStrandThickness}
      />
      <Question
        title="Como é o seu couro cabeludo?"
        options={SCALP}
        isSelected={(v) => scalpTendency === v}
        onSelect={setScalpTendency}
      />
      <Question
        title="Com que frequência você lava o cabelo?"
        options={WASH}
        isSelected={(v) => washFrequency === v}
        onSelect={setWashFrequency}
      />
      <Question
        title="Você faz alguma química?"
        hint="Selecione todas que fizer, ou deixe em branco se nenhuma."
        options={CHEMICAL}
        isSelected={(v) => chemicalTreatments.includes(v)}
        onSelect={toggleChemical}
      />
      <Question
        title="Com que frequência você usa calor?"
        hint="Secador, chapinha, modelador…"
        options={HEAT}
        isSelected={(v) => heatUsage === v}
        onSelect={setHeatUsage}
      />
      <Question
        title="O que mais te incomoda hoje?"
        hint="Pode escolher mais de uma."
        options={CONCERNS}
        isSelected={(v) => currentConcerns.includes(v)}
        onSelect={toggleConcern}
      />
      <Question
        title="Qual é o seu principal objetivo?"
        options={GOAL}
        isSelected={(v) => primaryGoal === v}
        onSelect={setPrimaryGoal}
      />

      <Pressable
        style={[styles.save, !canSave && styles.saveDisabled]}
        disabled={!canSave}
        onPress={save}
        accessibilityRole="button"
      >
        <Text style={styles.saveText}>{submitting ? 'Salvando…' : 'Salvar perfil'}</Text>
      </Pressable>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 20 },
  title: { fontSize: 24, fontWeight: '600' },
  subtitle: { fontSize: 15, opacity: 0.8 },
  question: { gap: 8 },
  qTitle: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, opacity: 0.7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 20,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: '#1c1c1e', borderColor: '#1c1c1e' },
  chipTextSelected: { color: '#fff' },
  save: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: '#1c1c1e',
    marginTop: 8,
  },
  saveDisabled: { opacity: 0.4 },
  saveText: { color: '#fff', fontWeight: '600' },
  cancel: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  message: { color: '#b00020' },
});
