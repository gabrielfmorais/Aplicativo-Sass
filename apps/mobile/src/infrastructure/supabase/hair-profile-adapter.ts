import type { HairProfilePort } from '@app/core';
import { HAIR_PROFILE_COLUMNS, InfrastructureError, hairProfileFromRow } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'hair_profiles';
const fail = (code: string, e: { message: string }) => new InfrastructureError(code, e.message);

/**
 * Direct table access (SPEC-002 §11): ownership and immutability are enforced by RLS + grants in
 * Postgres — the client never decides authorization. Snapshots are append-only; "current" is the
 * most recent (created_at desc, id desc). No version numbering (D-64).
 *
 * The row → snapshot contract lives in @app/core so this adapter and the `generate-plan` Edge
 * Function read the table exactly the same way.
 */
export const createHairProfileAdapter = (client: SupabaseClient, userId: () => string): HairProfilePort => ({
  async getCurrent() {
    const { data, error } = await client
      .from(TABLE)
      .select(HAIR_PROFILE_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw fail('hair_profile.read_failed', error);
    return data ? hairProfileFromRow(data) : null;
  },
  /**
   * SPEC-017 — o snapshot que gerou um plano, pelo id que o plano registrou.
   *
   * Sem `user_id` no filtro: a RLS de `hair_profiles` decide. Um id de outra pessoa devolve zero
   * linhas, e `maybeSingle` transforma isso em `null` — que a tela lê como "não dá para explicar" e
   * responde não mostrando nada (FR4, fail closed).
   */
  async getById(hairProfileId) {
    const { data, error } = await client
      .from(TABLE)
      .select(HAIR_PROFILE_COLUMNS)
      .eq('id', hairProfileId)
      .maybeSingle();
    if (error) throw fail('hair_profile.read_failed', error);
    return data ? hairProfileFromRow(data) : null;
  },
  async save(input) {
    const { data, error } = await client
      .from(TABLE)
      .insert({
        user_id: userId(),
        hair_pattern: input.hairPattern,
        strand_thickness: input.strandThickness,
        scalp_tendency: input.scalpTendency,
        wash_frequency: input.washFrequency,
        chemical_treatments: input.chemicalTreatments,
        heat_usage: input.heatUsage,
        current_concerns: input.currentConcerns,
        primary_goal: input.primaryGoal,
        // SPEC-037 (F35). Sempre presentes numa avaliação nova — `HairProfileInput` as exige, e é a
        // linha antiga, que já existe e é imutável, que carrega `null`.
        perceived_porosity: input.perceivedPorosity,
        routine_availability: input.routineAvailability,
      })
      .select(HAIR_PROFILE_COLUMNS)
      .single();
    if (error) throw fail('hair_profile.save_failed', error);
    return hairProfileFromRow(data);
  },
});
