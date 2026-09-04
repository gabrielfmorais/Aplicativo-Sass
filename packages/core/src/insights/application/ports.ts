import type { InsightFact } from '../domain/insights.ts';

/**
 * SPEC-047 (P2) — a leitura do histórico dela, para observar repetições.
 *
 * ⚠️ **Só leitura, e só dela.** Esta camada não escreve nada e não agrega com terceiros: opera
 * sobre o histórico pessoal dela, sob RLS. Nada sai, nada vira benchmark contra outras pessoas
 * (Blueprint §12).
 */
export interface InsightsPort {
  /** Os cuidados atendidos, com a avaliação dela e os produtos que ela marcou. */
  facts(): Promise<readonly InsightFact[]>;
}
