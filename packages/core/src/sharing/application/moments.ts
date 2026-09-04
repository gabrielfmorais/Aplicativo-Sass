import type { JourneyView } from '../../journey/index.ts';
import type { Progress } from '../../progress/index.ts';
import type { ShareMoment } from '../domain/share-moment.ts';

/**
 * SPEC-045 (F46) — os momentos, **derivados de fato já canônico**.
 *
 * ⚠️ **Nenhum número é calculado aqui** (SPEC-044 BR4). Sequência, pontos, cuidados atendidos e
 * contagens de ciclo entram prontos das views que a tela já mostrou. Recalcular abriria a porta para
 * o card e a tela discordarem sobre a mesma conquista — e a discordância apareceria justamente no
 * lugar em que ela mostra o app para outras pessoas.
 */

const cares = (n: number) => `${n} ${n === 1 ? 'cuidado' : 'cuidados'} do meu plano`;

/** A jornada inteira: o momento que o `F45` já produzia, agora nomeado como um entre vários. */
export const journeyMoment = (journey: JourneyView): ShareMoment => {
  const hasStreak = journey.streak > 0;
  return {
    kind: 'journey',
    key: 'journey',
    chip: 'Minha jornada',
    headline: journey.level.name,
    value: hasStreak ? String(journey.streak) : String(journey.points),
    valueLabel: hasStreak
      ? `${journey.streak === 1 ? 'cuidado' : 'cuidados'} do meu plano em sequência`
      : 'pontos de constância',
    footnote: journey.caresAttended > 0 ? `${cares(journey.caresAttended)} até aqui` : null,
  };
};

/**
 * Um card por marco **alcançado**.
 *
 * ⚠️ **Só os alcançados.** Um marco que ainda não chegou não é uma conquista, e oferecê-lo para
 * compartilhar transformaria a lista numa cobrança — exatamente o que a SPEC-043 recusa quando diz
 * que marco não alcançado é marco que ainda não chegou, nunca uma falha.
 */
export const milestoneMoments = (journey: JourneyView): readonly ShareMoment[] =>
  journey.milestones
    .filter((m) => m.reached)
    .map((m) => ({
      kind: 'milestone' as const,
      key: `milestone:${m.key}`,
      // O chip é interface, e interface fala **com** ela: o rótulo do marco vai como está.
      chip: m.label,
      headline: 'Marco alcançado',
      ...splitMilestone(firstPerson(m.label)),
      footnote: journey.caresAttended > 0 ? `${cares(journey.caresAttended)} até aqui` : null,
    }));

/**
 * Separa o **número** do resto do rótulo.
 *
 * ⚠️ **O `value` é o herói do card, e herói é curto.** Mandar o rótulo inteiro para lá punha
 * *"5 cuidados do meu plano"* no tamanho reservado a um número — e a 390px o card saía escrito
 * **"5 cuidad"**, cortado na borda. Com a divisão, o marco ganha o mesmo ritmo do card da jornada:
 * número grande, frase embaixo.
 *
 * Sem número no rótulo ("Primeiro cuidado"), o próprio rótulo é o herói e o card se vira com o
 * ajuste de tamanho que o desenho faz.
 */
const splitMilestone = (label: string): { value: string; valueLabel: string } => {
  const m = /^(\d+)\s+(.*)$/.exec(label);
  // O rótulo não repete "marco": o cabeçalho já disse, e repetir empurraria a frase para uma
  // terceira linha que o card não tem.
  return m?.[1] && m[2]
    ? { value: m[1], valueLabel: m[2] }
    : { value: label, valueLabel: 'um marco da minha jornada' };
};

/**
 * ⚠️ **O rótulo do marco é escrito para a TELA, e o card é escrito para OUTRAS PESSOAS.**
 *
 * Na Jornada, *"5 cuidados do seu plano"* fala com ela e está certo. No card, que sai da mão dela
 * para quem não é ela, *"seu"* passa a apontar para o leitor — e o card diria que a conquista é de
 * quem está lendo. Foi um defeito visto a 390px, com o marco escolhido no seletor.
 *
 * A troca é deliberadamente **estreita**, e a barreira não é esta função: é o teste que percorre
 * **todos** os marcos da régua e reprova qualquer segunda pessoa que sobreviva. Um marco novo escrito
 * com "sua rotina" quebra o teste em vez de vazar para o card.
 */
const firstPerson = (label: string): string => label.replace(/\bseu\b/g, 'meu').replace(/\bsua\b/g, 'minha');

/**
 * O cuidado que ela acabou de fazer — **o momento de orgulho**, e o mais frequente dos gatilhos.
 *
 * ⚠️ **Diz que ela fez, nunca o que aquilo fez com o cabelo dela.** "Hidratação feita" é fato dela;
 * "cabelo mais hidratado" seria alegação capilar (D-26/D-70) num card que sai do app. Barreira de
 * teste.
 */
export const careDoneMoment = (input: { careLabel: string; journey: JourneyView | null }): ShareMoment => ({
  kind: 'care_done',
  key: 'care_done',
  chip: 'Este cuidado',
  headline: 'Cuidado feito',
  value: input.careLabel,
  valueLabel: 'do meu plano, hoje',
  footnote: input.journey && input.journey.streak > 0 ? `${input.journey.streak} em sequência` : null,
});

/**
 * O ciclo dela, em **contagem**.
 *
 * ⚠️ **Sem denominador, sem porcentagem e sem a média de como ela se sentiu.** "12 de 14" convida a
 * calcular 86%, e percentual é recusa registrada em três SPECs (009/019/021); a média das respostas
 * dela é o número mais próximo de uma **nota** que o produto tem, e ele não vai para um card que sai
 * do app. Contagem é fato; o resto é avaliação.
 */
export const cycleMoment = (progress: Progress): ShareMoment => ({
  kind: 'cycle',
  key: 'cycle',
  chip: 'Meu ciclo',
  headline: 'Meu ciclo',
  value: String(progress.done),
  valueLabel: `${progress.done === 1 ? 'cuidado' : 'cuidados'} do meu plano neste ciclo`,
  footnote: progress.lifetimeDone > progress.done ? `${cares(progress.lifetimeDone)} no total` : null,
});
