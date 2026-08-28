import type { CareGuides } from '../domain/care-guide.ts';

/**
 * Source of every guide below. Stated once, referenced by each entry.
 *
 * D-26 forbids engineering from inventing production hair-care rules; **D-70** applies the D-67
 * precedent to text, so this content ships as `candidate`: development and internal beta only,
 * PUBLIC RELEASE still blocked until a domain reviewer signs it off (OQ-REL).
 */
const RATIONALE = 'hipótese de engenharia — requer revisão especializada (D-26/D-70, OQ-REL)';

/**
 * pt-BR care guides, V1 (SPEC-007).
 *
 * Deliberate constraints, enforced by tests (§17 AC4 / BR3): the text is **procedural and
 * cosmetic**. No brand, no commercial product, no chemical dosage, no promised result, and no
 * diagnostic or medical language — this is an "avaliação capilar", never a diagnosis. Where a
 * timing matters, the text defers to the packaging of the user's own product instead of a number
 * engineering made up.
 */
export const CARE_GUIDES_V1: CareGuides = {
  hydration: {
    careTypeCode: 'hydration',
    whatItIs: 'Repõe a água que o fio perde no dia a dia. É o cuidado que devolve maciez e movimento.',
    steps: [
      'Lave o cabelo como de costume e retire o excesso de água com a toalha.',
      'Separe o cabelo em mechas e aplique a máscara de hidratação do comprimento às pontas.',
      'Evite a raiz e o couro cabeludo.',
      'Deixe agir pelo tempo indicado na embalagem do seu produto.',
      'Enxágue bem, até a água sair limpa.',
    ],
    durationMin: 20,
    commonMistakes: [
      'Aplicar na raiz — o cabelo fica pesado e volta a ficar oleoso mais rápido.',
      'Enxaguar antes do tempo indicado na embalagem.',
      'Aplicar no cabelo encharcado — o excesso de água dilui a máscara.',
    ],
    validationStatus: 'candidate',
    rationaleSource: RATIONALE,
  },

  nutrition: {
    careTypeCode: 'nutrition',
    whatItIs: 'Repõe os óleos naturais do fio. É o cuidado que devolve brilho e ajuda a controlar o frizz.',
    steps: [
      'Lave o cabelo e retire bem o excesso de água.',
      'Aplique a máscara de nutrição do meio às pontas, mecha por mecha.',
      'Deixe agir pelo tempo indicado na embalagem do seu produto.',
      'Enxágue bem.',
    ],
    durationMin: 20,
    commonMistakes: [
      'Repetir a nutrição em dias seguidos — o excesso de óleo deixa o fio pesado e sem volume.',
      'Aplicar na raiz.',
      'Enxaguar pela metade e deixar resíduo no fio.',
    ],
    validationStatus: 'candidate',
    rationaleSource: RATIONALE,
  },

  reconstruction: {
    careTypeCode: 'reconstruction',
    whatItIs:
      'Repõe a massa que o fio perde com química, calor e atrito. É o cuidado mais forte do cronograma, por isso entra com menos frequência.',
    steps: [
      'Lave o cabelo e retire bem o excesso de água.',
      'Aplique a máscara de reconstrução em mechas finas, do comprimento às pontas.',
      'Respeite o tempo da embalagem — aqui, deixar agindo mais tempo não melhora o resultado.',
      'Enxágue bem.',
      'Se a embalagem do seu produto indicar, finalize com hidratação ou nutrição.',
    ],
    durationMin: 25,
    commonMistakes: [
      'Deixar agir além do tempo indicado na embalagem.',
      'Fazer reconstrução com mais frequência do que o cronograma pede — o fio fica rígido e quebra com mais facilidade.',
      'Pular a hidratação ou a nutrição seguinte quando a embalagem indicar.',
    ],
    validationStatus: 'candidate',
    rationaleSource: RATIONALE,
  },
};
