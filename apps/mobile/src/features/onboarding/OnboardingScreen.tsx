import type { HairProfileInput, HairProfilePort, HairProfileSnapshot } from '@app/core';
import { HairProfileInputSchema } from '@app/core';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HunaFigure } from '@/design/HunaFigure';
import { Reveal } from '@/design/Reveal';
import { Button, Chip, ProgressBar, Row, Screen, Stack, Text } from '@/design/primitives';
import { radius, space } from '@/design/tokens';

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

/** Answers, exactly the eight of SPEC-002 §6 — the shape this screen builds toward. */
type Answers = {
  hairPattern?: HairProfileInput['hairPattern'];
  strandThickness?: HairProfileInput['strandThickness'];
  scalpTendency?: HairProfileInput['scalpTendency'];
  washFrequency?: HairProfileInput['washFrequency'];
  chemicalTreatments: HairProfileInput['chemicalTreatments'];
  heatUsage?: HairProfileInput['heatUsage'];
  currentConcerns: HairProfileInput['currentConcerns'];
  primaryGoal?: HairProfileInput['primaryGoal'];
};

const EMPTY: Answers = { chemicalTreatments: [], currentConcerns: [] };

/**
 * `no_major_concern` is exclusive (SPEC-002 §6): choosing it clears the rest, and choosing anything
 * else clears it. Kept here, next to the toggle it governs, exactly as before.
 */
const toggleConcern = (
  prev: HairProfileInput['currentConcerns'],
  v: HairProfileInput['currentConcerns'][number],
): HairProfileInput['currentConcerns'] => {
  if (v === 'no_major_concern') return prev.includes(v) ? [] : ['no_major_concern'];
  const rest = prev.filter((x) => x !== 'no_major_concern');
  return rest.includes(v) ? rest.filter((x) => x !== v) : [...rest, v];
};

const toggleChemical = (
  prev: HairProfileInput['chemicalTreatments'],
  v: HairProfileInput['chemicalTreatments'][number],
): HairProfileInput['chemicalTreatments'] => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

/**
 * One step = one question. `ready` is what the Continue button reads, so each step states its own
 * rule instead of a single validator far away deciding for all of them.
 */
type Step = {
  readonly key: string;
  readonly question: string;
  readonly hint?: string;
  readonly render: (a: Answers, set: (next: Answers) => void) => React.ReactNode;
  readonly ready: (a: Answers) => boolean;
};

const single = <K extends keyof Answers>(
  key: K,
  question: string,
  options: Opt<NonNullable<Answers[K]> & string>[],
): Step => ({
  key: key as string,
  question,
  render: (a, set) => (
    <Row>
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          selected={a[key] === o.value}
          onPress={() => set({ ...a, [key]: o.value })}
        />
      ))}
    </Row>
  ),
  ready: (a) => a[key] !== undefined,
});

const STEPS: readonly Step[] = [
  single('hairPattern', 'Qual é o seu tipo de curvatura?', PATTERN),
  single('strandThickness', 'Qual é a espessura do fio?', THICKNESS),
  single('scalpTendency', 'Como é o seu couro cabeludo?', SCALP),
  single('washFrequency', 'Com que frequência você lava o cabelo?', WASH),
  {
    key: 'chemicalTreatments',
    question: 'Você faz alguma química?',
    hint: 'Pode escolher mais de uma — ou seguir sem nenhuma.',
    render: (a, set) => (
      <Row>
        {CHEMICAL.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            multi
            selected={a.chemicalTreatments.includes(o.value)}
            onPress={() => set({ ...a, chemicalTreatments: toggleChemical(a.chemicalTreatments, o.value) })}
          />
        ))}
      </Row>
    ),
    // The only optional question: none is a real answer, so this step is always ready.
    ready: () => true,
  },
  single('heatUsage', 'Com que frequência você usa calor?', HEAT),
  {
    key: 'currentConcerns',
    question: 'O que mais te incomoda hoje?',
    hint: 'Pode escolher mais de uma.',
    render: (a, set) => (
      <Row>
        {CONCERNS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            multi
            selected={a.currentConcerns.includes(o.value)}
            onPress={() => set({ ...a, currentConcerns: toggleConcern(a.currentConcerns, o.value) })}
          />
        ))}
      </Row>
    ),
    ready: (a) => a.currentConcerns.length > 0,
  },
  single('primaryGoal', 'Qual é o seu principal objetivo?', GOAL),
];

/**
 * SPEC-018 fatia 3 — os interstícios entre blocos de perguntas.
 *
 * Oito perguntas seguidas, todas com a mesma forma, viram formulário: a pessoa para de ler e começa
 * a despachar. Uma pausa curta entre blocos devolve ritmo e diz onde ela está — e é o único lugar
 * desta tela em que o app fala **com** ela em vez de perguntar.
 *
 * **O que estes textos não fazem, por decisão.** Nenhum comenta o cabelo dela, nenhum interpreta uma
 * resposta e nenhum antecipa o que virá no cronograma. Uma frase do tipo "cabelo cacheado costuma
 * pedir mais hidratação" seria orientação capilar substantiva e cairia no gate de domínio (D-26/D-70)
 * — a batida emocional aqui não vale esse preço, e não precisa dele. Contar quantas perguntas faltam
 * é verdade verificável (BR3); dizer o que o cabelo dela precisa, não.
 */
type Interlude = {
  readonly key: string;
  readonly overline: string;
  readonly title: string;
  readonly body: string;
};

type FlowItem =
  | { readonly kind: 'question'; readonly step: Step }
  | { readonly kind: 'interlude'; readonly interlude: Interlude };

/** Depois de qual índice de `STEPS` cada pausa entra. Os blocos são: o cabelo · a rotina · o que ela quer. */
const INTERLUDES: readonly (readonly [number, Interlude])[] = [
  [
    2,
    {
      key: 'after-hair',
      overline: 'Seu cabelo',
      title: 'Essa parte já está registrada.',
      body: 'Agora quero entender a sua rotina — o que você faz com o cabelo no dia a dia. São três perguntas.',
    },
  ],
  [
    5,
    {
      key: 'after-routine',
      overline: 'Sua rotina',
      title: 'Falta pouco.',
      body: 'Só faltam duas perguntas: o que te incomoda hoje e o que você quer mudar.',
    },
  ],
];

const FLOW: readonly FlowItem[] = STEPS.flatMap((step, i) => {
  const item: FlowItem = { kind: 'question', step };
  const pause = INTERLUDES.find(([after]) => after === i);
  return pause ? [item, { kind: 'interlude', interlude: pause[1] } as FlowItem] : [item];
});

/** Quantas perguntas existem até `cursor`, inclusive. É o que a barra e o rótulo contam. */
const questionsThrough = (cursor: number) =>
  FLOW.slice(0, cursor + 1).filter((f) => f.kind === 'question').length;

/**
 * SPEC-002 onboarding, presented one question at a time (SPEC-016 FR3/G5).
 *
 * The questions, the options, the exclusivity rule and the validation are **exactly** those of
 * SPEC-002 — only the presentation changed. `HairProfileInputSchema` is still the one thing that
 * decides whether the answers may be saved, so a stepped UI cannot let through anything the single
 * scroll would have refused (AC2).
 *
 * Nothing is written until the last step is confirmed: leaving mid-way leaves no snapshot, which is
 * what makes reassessment safe to abandon (SPEC-014 G3).
 *
 * `onCancel` is optional: absent for first onboarding (there is nowhere to go back to), present for
 * reassessment so the questions can be abandoned at any point.
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
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  /** Posição no **fluxo**, que inclui as pausas — não no vetor de perguntas. */
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const item = FLOW[index] as FlowItem;
  const last = index === FLOW.length - 1;
  const parsed = useMemo(() => HairProfileInputSchema.safeParse(answers), [answers]);

  const back = () => {
    setMessage(null);
    if (index > 0) setIndex(index - 1);
    else onCancel?.();
  };

  const next = () => {
    setMessage(null);
    if (!last) {
      setIndex(index + 1);
      return;
    }
    // Belt and braces: the per-step `ready` gates the button, and the schema gates the write.
    if (!parsed.success) {
      setMessage('Responda todas as perguntas para continuar.');
      return;
    }
    if (submitting) return; // double-submit guard
    setSubmitting(true);
    hairProfile
      .save(parsed.data)
      .then(onSaved)
      .catch(() => {
        setMessage('Não foi possível salvar. Tente novamente.');
        setSubmitting(false);
      });
  };

  const canGoBack = index > 0 || onCancel !== undefined;
  // Numa pausa a barra mostra o que já foi respondido; numa pergunta, ela própria.
  const answered = questionsThrough(index);

  return (
    <Screen
      /**
       * A pausa fica centrada; as perguntas ficam ancoradas no topo. É deliberado: numa sequência
       * de oito passos, a pergunta precisa aparecer **sempre no mesmo lugar**, senão o olho procura
       * o título a cada troca. A pausa não pertence à sequência — ela interrompe — e centrada ela
       * lê como um momento em vez de mais uma tela do formulário.
       */
      style={item.kind === 'interlude' ? styles.fill : undefined}
      footer={
        <>
          <Button
            label={last ? 'Ver meu cronograma' : 'Continuar'}
            onPress={next}
            busy={submitting}
            // Uma pausa não tem o que validar: seguir é a única coisa que se faz nela.
            disabled={item.kind === 'question' && !item.step.ready(answers)}
          />
          {canGoBack ? (
            <Button
              label={index > 0 ? 'Voltar' : 'Cancelar'}
              onPress={back}
              variant="ghost"
              disabled={submitting}
            />
          ) : null}
          {message ? (
            <Text tone="danger" variant="caption" accessibilityLiveRegion="polite">
              {message}
            </Text>
          ) : null}
        </>
      }
    >
      {/* A barra fica **fora** do `Reveal`: ela é a continuidade entre os passos, e piscar junto com
          o conteúdo faria justamente a coisa que ela existe para desmentir — que nada avançou. */}
      <ProgressBar value={answered} total={STEPS.length} label={`Pergunta ${answered} de ${STEPS.length}`} />

      {/* `key` no item do fluxo: cada passo é conteúdo novo, e é isso que reinicia a transição. */}
      <Reveal
        key={item.kind === 'question' ? item.step.key : item.interlude.key}
        style={item.kind === 'interlude' ? styles.pause : undefined}
      >
        {item.kind === 'question' ? (
          <Stack gap="xl">
            <Stack gap="sm">
              <Text variant="overline" tone="faint">
                {`PERGUNTA ${answered} DE ${STEPS.length}`}
              </Text>
              <Text variant="display" accessibilityRole="header">
                {item.step.question}
              </Text>
              {item.step.hint ? (
                <Text variant="body" tone="muted">
                  {item.step.hint}
                </Text>
              ) : null}
            </Stack>
            <View style={styles.options}>{item.step.render(answers, setAnswers)}</View>
          </Stack>
        ) : (
          <Stack gap="xl">
            <HunaFigure frame="band" style={styles.ribbon} />
            <Stack gap="sm">
              <Text variant="overline" tone="accent">
                {item.interlude.overline}
              </Text>
              <Text variant="display" accessibilityRole="header">
                {item.interlude.title}
              </Text>
              <Text variant="body" tone="muted">
                {item.interlude.body}
              </Text>
            </Stack>
          </Stack>
        )}
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: { paddingBottom: space.md },
  /**
   * `flexGrow`, não `flex`: preenche o que sobra e ainda rola quando não sobra nada (EC1/EC5).
   * `fill` estica o corpo da tela; `pause` centra o conteúdo **dentro** do que sobrou — e é por isso
   * que são dois: sem separar, a barra de progresso descia junto e ficava no meio da tela na pausa.
   */
  fill: { flexGrow: 1 },
  pause: { flexGrow: 1, justifyContent: 'center' },
  /** Faixa, como no login: marca a pausa como um momento, sem competir com o texto. */
  // SPEC-028: cantos arredondados — sem a máscara do palco, a faixa terminaria num corte reto.
  ribbon: {
    height: space.xxxl * 2,
    marginHorizontal: -space.xl,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
});
