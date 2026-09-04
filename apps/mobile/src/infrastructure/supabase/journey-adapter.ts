import type { JourneyFactKind, JourneyPoint, JourneyPort } from '@app/core';
import { InfrastructureError, localDateFromString } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const fail = (code: string, e: { message: string }) => new InfrastructureError(code, e.message);

/**
 * SPEC-043 §7 — leitura sob RLS; concessão só por RPC.
 *
 * O cliente **não tem `INSERT`, `UPDATE` nem `DELETE`**: quem concede é o servidor, a partir dos
 * fatos canônicos que ele mesmo lê. Não há parâmetro para "quantos pontos" nem para "qual fato" —
 * um cliente adulterado não consegue inventar consistência que ela não teve, e também não consegue
 * apagar a que teve.
 */
export const createJourneyAdapter = (client: SupabaseClient): JourneyPort => ({
  async list(): Promise<readonly JourneyPoint[]> {
    const { data, error } = await client
      .from('journey_points')
      .select('fact_kind, points, rules_version, awarded_on')
      .order('awarded_on', { ascending: false });
    if (error) throw fail('journey.read_failed', error);
    return (
      data as { fact_kind: JourneyFactKind; points: number; rules_version: string; awarded_on: string }[]
    ).map((r) => ({
      factKind: r.fact_kind,
      points: r.points,
      rulesVersion: r.rules_version,
      awardedOn: localDateFromString(r.awarded_on),
    }));
  },

  async award(timeZone: string): Promise<number> {
    const { data, error } = await client.rpc('award_journey_points', { p_timezone: timeZone });
    if (error) throw fail('journey.award_failed', error);
    return typeof data === 'number' ? data : 0;
  },
});
