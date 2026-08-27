import type { HairProfileInput, HairProfilePort, HairProfileSnapshot } from '@app/core';
import { InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'hair_profiles';
const COLUMNS =
  'id, created_at, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal';
const fail = (code: string, e: { message: string }) => new InfrastructureError(code, e.message);

type Row = {
  id: string;
  created_at: string;
  hair_pattern: string;
  strand_thickness: string;
  scalp_tendency: string;
  wash_frequency: string;
  chemical_treatments: string[];
  heat_usage: string;
  current_concerns: string[];
  primary_goal: string;
};

const toSnapshot = (r: Row): HairProfileSnapshot => ({
  hairProfileId: r.id,
  createdAt: r.created_at,
  hairPattern: r.hair_pattern as HairProfileInput['hairPattern'],
  strandThickness: r.strand_thickness as HairProfileInput['strandThickness'],
  scalpTendency: r.scalp_tendency as HairProfileInput['scalpTendency'],
  washFrequency: r.wash_frequency as HairProfileInput['washFrequency'],
  chemicalTreatments: r.chemical_treatments as HairProfileInput['chemicalTreatments'],
  heatUsage: r.heat_usage as HairProfileInput['heatUsage'],
  currentConcerns: r.current_concerns as HairProfileInput['currentConcerns'],
  primaryGoal: r.primary_goal as HairProfileInput['primaryGoal'],
});

/**
 * Direct table access (SPEC-002 §11): ownership and immutability are enforced by RLS + grants in
 * Postgres — the client never decides authorization. Snapshots are append-only; "current" is the
 * most recent (created_at desc, id desc). No version numbering (D-64).
 */
export const createHairProfileAdapter = (client: SupabaseClient, userId: () => string): HairProfilePort => ({
  async getCurrent() {
    const { data, error } = await client
      .from(TABLE)
      .select(COLUMNS)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw fail('hair_profile.read_failed', error);
    return data ? toSnapshot(data as Row) : null;
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
      })
      .select(COLUMNS)
      .single();
    if (error) throw fail('hair_profile.save_failed', error);
    return toSnapshot(data as Row);
  },
});
