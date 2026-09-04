import type { JourneyPoint } from '../domain/journey.ts';

/**
 * SPEC-043 §7 — a Jornada.
 *
 * **Leitura direto da tabela sob RLS; concessão só por RPC.** O cliente **não tem `INSERT`**: quem
 * concede é o servidor, a partir dos fatos canônicos que ele mesmo lê. Não existe parâmetro para
 * "quantos pontos" nem para "qual fato" — um cliente adulterado não consegue inventar consistência
 * que ela não teve.
 */
export interface JourneyPort {
  /** Os pontos dela, como foram concedidos — com a régua de cada um. */
  list(): Promise<readonly JourneyPoint[]>;
  /**
   * Concede o que ainda não foi concedido e devolve quantos entraram agora.
   *
   * Idempotente **pelo id do fato**: chamar de novo não repontua nada. É a mesma disciplina do
   * `client_execution_id` da SPEC-005, com a diferença de que aqui a chave é o próprio fato.
   */
  award(timeZone: string): Promise<number>;
}
