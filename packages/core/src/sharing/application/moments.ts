import type { CycleView } from '../../care-tracking/index.ts';
import type { JourneyView } from '../../journey/index.ts';
import type { Progress } from '../../progress/index.ts';
import { isCycleEnded } from '../../progress/index.ts';
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
      chip: pickerLabel(m.label),
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
 * SPEC-068 — **o chip é um NOME, não a frase inteira do marco.**
 *
 * ⚠️ **Isto reverte uma decisão da SPEC-045**, que mandava o rótulo do marco *"como está"* porque o
 * chip é interface e interface fala **com** ela. A premissa continua certa; o que mudou é o tamanho
 * da lista, e foi **medido a 390px**: com sete momentos o seletor ocupava **quatro linhas** (~224px,
 * mais de um quarto da tela) só para escolher qual card — e os chips mais largos eram justamente os
 * marcos, **162px e 170px**, porque carregavam uma frase inteira.
 *
 * ⛔ **Nada se perde:** a frase completa continua **no card**, que é o que ela está escolhendo e está
 * logo acima; e os marcos seguem distinguíveis entre si (*Primeiro cuidado · 5 cuidados · 10
 * cuidados · 25 cuidados · 3 seguidos · 7 seguidos*).
 *
 * O corte é **estreito e degrada bem**: um marco novo escrito com outro final mantém o rótulo
 * inteiro no chip, em vez de virar um nome errado.
 */
const pickerLabel = (label: string): string => label.replace(/ do seu plano$/, '');

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
 * O Wash Day que ela acabou de registrar — o mesmo orgulho do cuidado concluído, mas do lugar onde
 * ela conta o ritual inteiro (produtos, técnica, finalização).
 *
 * ⚠️ **Diz que ela FEZ o Wash Day, nunca o que ele fez com o cabelo** (D-26/D-70). E **nada do que
 * ela registrou vira número no card:** quantos produtos ou técnicas ela marcou é contagem que lê
 * como "quanto mais, melhor" — o incentivo por quantidade que a D-103 proíbe. O herói é o cuidado; a
 * sequência é o contexto, como no cuidado concluído.
 *
 * ⚠️ **Só cuidado do plano.** Registro avulso (SPEC-052) chega aqui pela mesma tela, mas não vira
 * card: comemorar o que ela fez fora do cronograma é premiar por fazer mais (SPEC-052 OQ4). O gate
 * é na oferta (a Hoje não passa `onShare` para a avulsa), como já vale no cuidado concluído.
 */
export const washDayMoment = (input: { careLabel: string; journey: JourneyView | null }): ShareMoment => ({
  kind: 'wash_day',
  key: 'wash_day',
  chip: 'Meu Wash Day',
  headline: 'Wash Day feito',
  value: input.careLabel,
  valueLabel: 'o meu ritual de hoje',
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

/**
 * SPEC-068 (`F46`) — **o ciclo que acabou.**
 *
 * ⚠️ **É momento diferente do ciclo em andamento, e não uma variação de texto.** *"Meu ciclo"* no
 * meio do mês é um placar parcial; um ciclo que **fechou** é a conquista do mês inteiro, e é o que
 * a tela do Progresso já trata como outro estado (SPEC-021: o resumo só aparece encerrado, porque em
 * andamento ele repetia o cartão de cima).
 *
 * ⛔ **"Ciclo concluído" foi RECUSADO como manchete.** *Concluído* lê como *"cumpri tudo"*, e a
 * contagem não diz isso: ela diz quantos cuidados do plano ela atendeu, sem denominador (BR4). O app
 * já tem a palavra certa para o fato — **encerrado** é sobre o calendário, não sobre ela — e usar
 * outra no card criaria uma segunda verdade justo onde ela mostra o app para outras pessoas.
 *
 * ⚠️ **Mesma chave do ciclo em andamento, de propósito:** os dois são mutuamente exclusivos (o ciclo
 * está encerrado ou não está), então compartilham o lugar na lista — e se ele fechar enquanto ela
 * está na tela, a seleção dela sobrevive em vez de cair no primeiro (EC3).
 */
export const cycleClosedMoment = (progress: Progress): ShareMoment => ({
  kind: 'cycle_closed',
  key: 'cycle',
  chip: 'Meu ciclo',
  headline: 'Ciclo encerrado',
  value: String(progress.done),
  valueLabel: `${progress.done === 1 ? 'cuidado' : 'cuidados'} do meu plano neste ciclo`,
  footnote: progress.lifetimeDone > progress.done ? `${cares(progress.lifetimeDone)} no total` : null,
});

/**
 * SPEC-068 (`F46`) — **o quanto ela já andou**, o número que atravessa a troca de plano.
 *
 * ⚠️ **É o único card cujo herói sobrevive à reavaliação.** `lifetimeDone` conta execuções efetivas
 * de **todos** os planos (SPEC-014 FR7), então ele é a resposta para *"olha até onde eu cheguei"* —
 * enquanto o ciclo fala do mês e a jornada fala da sequência.
 *
 * ⚠️ **Aderência, não volume** (D-103): a avulsa **não entra** nesta contagem (SPEC-052), então o
 * número não sobe por ela fazer mais fora do cronograma. Ele sobe por ela manter o plano.
 *
 * ⛔ **Não existe quando ele empataria com o ciclo.** No primeiro ciclo `lifetimeDone === done`, e
 * oferecer os dois poria **dois cartões dizendo o mesmo número** lado a lado — o defeito que a
 * auditoria da SPEC-026 mediu na Hoje. Devolve `null`, e quem chama não oferece.
 */
export const progressMoment = (progress: Progress): ShareMoment | null =>
  progress.lifetimeDone > progress.done
    ? {
        kind: 'progress',
        key: 'progress',
        chip: 'Meu progresso',
        headline: 'Até aqui',
        value: String(progress.lifetimeDone),
        valueLabel: 'cuidados do meu plano desde o começo',
        // O ciclo corrente como contexto — contagem, nunca fração do total (BR4).
        footnote: progress.done > 0 ? `${progress.done} neste ciclo` : null,
      }
    : null;

/**
 * SPEC-068 (`F46`) — **os momentos que o Progresso oferece, decididos num lugar só.**
 *
 * ⚠️ **Esta escolha morava na tela** (`apps/mobile/src/app/index.tsx`, 900+ linhas e zero cobertura
 * de teste), e ela guarda três invariantes que ninguém veria quebrar ali: **exatamente um** card de
 * ciclo, **nunca os dois**, e **nenhum** quando ela ainda não atendeu cuidado neste ciclo. Aqui é
 * função pura, e cada uma das três tem teste.
 *
 * ⚠️ **EC4 mora aqui, e não no botão da tela.** Um card de ciclo com **zero** cuidado atendido não é
 * conquista, é cobrança de véspera — e a regra pertence a quem constrói o momento. Como consequência,
 * logo depois de uma reavaliação a Progresso ainda oferece o card de **até aqui**, que atravessa a
 * troca de plano (SPEC-014 FR7), sem oferecer um ciclo zerado junto.
 */
export const cycleMoments = (input: {
  progress: Progress;
  cycle: CycleView;
  today: string;
}): readonly ShareMoment[] => {
  const { progress } = input;
  const ended = isCycleEnded(input);
  const lifetime = progressMoment(progress);
  return [
    ...(progress.done > 0 ? [ended ? cycleClosedMoment(progress) : cycleMoment(progress)] : []),
    ...(lifetime ? [lifetime] : []),
  ];
};
