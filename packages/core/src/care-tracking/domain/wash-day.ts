// Pelo índice público do outro contexto, nunca pelo caminho interno dele (ADR-006).
import type { Product } from '../../hair-profile/index.ts';
import { z } from 'zod';

/**
 * SPEC-024 (F25) — o que ela realmente fez num cuidado.
 *
 * > **"Wash Day é estrutural. Não é uma tela de anotação, e tratá-la como tal inviabiliza metade do
 * > Premium."** — Blueprint §9
 *
 * **Vocabulário fechado, e é a decisão inteira da SPEC.** Texto livre é fácil de escrever e não se
 * compara nem se agrega: `P5`, `P6`, `P7` e `P8` leem *técnica × produto × resultado*, e nenhum
 * deles consegue ler um parágrafo. A razão de privacidade e a de produto são, aqui, a mesma.
 *
 * ⚠️ **Cada valor nomeia o que ela FAZ, nunca o que aquilo PROVOCA.** "Umectação" é um procedimento;
 * "selar as cutículas" seria afirmação capilar e jogaria a capability inteira no gate de domínio
 * (D-26/D-70). Acrescentar um valor é mudança de produto, não detalhe de implementação — e a lista
 * daqui espelha o `CHECK` de `public.wash_day_techniques`: duas listas para o mesmo enum é o preço
 * de validar nos dois lados da fronteira (P07), e a de lá é a que importa.
 */
export const WASH_DAY_TECHNIQUES = [
  'pre_wash_oil',
  'scalp_massage',
  'double_cleanse',
  'co_wash',
  'left_on_longer',
  'cold_rinse',
  'detangled_with_fingers',
  'wide_tooth_comb',
  'air_dried',
  'blow_dried',
  'heat_protectant',
  'scrunched',
  'diffuser',
  'protective_style',
] as const;

export const WashDayTechniqueSchema = z.enum(WASH_DAY_TECHNIQUES);

export type WashDayTechnique = z.infer<typeof WashDayTechniqueSchema>;

/**
 * O registro de uma execução, como a tela o lê.
 *
 * `washDayId` nulo significa **nunca aberto** — não "vazio". A diferença importa uma vez: um
 * registro aberto e desmarcado até o fim é uma resposta dela (EC4), e o app não pode tratá-lo como
 * ausência nem cobrar preenchimento.
 *
 * Não há campo de resultado aqui de propósito: *como ficou* é o check-in (SPEC-006), ancorado na
 * **mesma** execução. Duplicar criaria duas verdades sobre a mesma coisa (NG5).
 */
export type WashDayRecord = {
  readonly washDayId: string | null;
  /**
   * Os produtos marcados, **com nome**, e não só os ids.
   *
   * BR3/AC4: um produto arquivado continua aparecendo no registro antigo — o uso aconteceu. Se a
   * tela montasse os chips só a partir da prateleira ativa, o vidro que ela usou e depois tirou de
   * casa sumiria do próprio registro dela, sem aviso: a linha da junção continuaria no banco, e a
   * tela mostraria "não marcado". Por isso o registro se descreve sozinho em vez de depender da
   * prateleira de hoje.
   */
  readonly products: readonly Product[];
  readonly techniques: readonly WashDayTechnique[];
};
