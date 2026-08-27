import type { SupabaseClient } from '@supabase/supabase-js';

import { createHairProfileAdapter } from '@/infrastructure/supabase/hair-profile-adapter';

const row = {
  id: 'hp-1',
  created_at: '2026-08-27T10:00:00Z',
  hair_pattern: 'curly',
  strand_thickness: 'medium',
  scalp_tendency: 'balanced',
  wash_frequency: 'twice_weekly',
  chemical_treatments: ['coloring'],
  heat_usage: 'one_to_two_weekly',
  current_concerns: ['frizz', 'dryness'],
  primary_goal: 'definition_and_frizz_control',
};

/** Minimal chainable fake of the PostgREST query builder used by the adapter. */
const makeClient = () => {
  let insertPayload: Record<string, unknown> | undefined;
  const builder: Record<string, unknown> = {
    select: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    maybeSingle: jest.fn(async () => ({ data: row, error: null })),
    insert: jest.fn((p: Record<string, unknown>) => {
      insertPayload = p;
      return builder;
    }),
    single: jest.fn(async () => ({ data: row, error: null })),
  };
  const client = { from: jest.fn(() => builder) } as unknown as SupabaseClient;
  return { client, getInsertPayload: () => insertPayload };
};

describe('hair-profile adapter (SPEC-002 §11)', () => {
  it('maps a row to a camelCase snapshot with a stable id', async () => {
    const { client } = makeClient();
    const adapter = createHairProfileAdapter(client, () => 'user-1');
    const snap = await adapter.getCurrent();
    expect(snap).toEqual({
      hairProfileId: 'hp-1',
      createdAt: '2026-08-27T10:00:00Z',
      hairPattern: 'curly',
      strandThickness: 'medium',
      scalpTendency: 'balanced',
      washFrequency: 'twice_weekly',
      chemicalTreatments: ['coloring'],
      heatUsage: 'one_to_two_weekly',
      currentConcerns: ['frizz', 'dryness'],
      primaryGoal: 'definition_and_frizz_control',
    });
  });

  it('insert payload uses snake_case columns and the caller user_id', async () => {
    const { client, getInsertPayload } = makeClient();
    const adapter = createHairProfileAdapter(client, () => 'user-1');
    await adapter.save({
      hairPattern: 'curly',
      strandThickness: 'medium',
      scalpTendency: 'balanced',
      washFrequency: 'twice_weekly',
      chemicalTreatments: ['coloring'],
      heatUsage: 'one_to_two_weekly',
      currentConcerns: ['frizz', 'dryness'],
      primaryGoal: 'definition_and_frizz_control',
    });
    expect(getInsertPayload()).toEqual({
      user_id: 'user-1',
      hair_pattern: 'curly',
      strand_thickness: 'medium',
      scalp_tendency: 'balanced',
      wash_frequency: 'twice_weekly',
      chemical_treatments: ['coloring'],
      heat_usage: 'one_to_two_weekly',
      current_concerns: ['frizz', 'dryness'],
      primary_goal: 'definition_and_frizz_control',
    });
  });
});
