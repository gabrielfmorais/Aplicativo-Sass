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
  perceived_porosity: 'absorbs_normally',
  routine_availability: 'moderate',
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
      perceivedPorosity: 'absorbs_normally',
      routineAvailability: 'moderate',
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
      perceivedPorosity: 'slow_to_wet',
      routineAvailability: 'varies',
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
      // SPEC-037 — o payload carrega as duas colunas novas. A asserção é `toEqual`, então uma
      // coluna esquecida no adapter reprova aqui em vez de virar `null` silencioso no banco.
      perceived_porosity: 'slow_to_wet',
      routine_availability: 'varies',
    });
  });
});

/**
 * SPEC-017 — o snapshot que gerou um plano, pelo id que o plano registrou. Sem `user_id` no filtro:
 * a RLS decide, e um id de outra pessoa devolve zero linhas, não o perfil dela.
 */
describe('hair profile adapter: snapshot por id (SPEC-017)', () => {
  it('lê o snapshot de origem e não filtra por usuária — quem decide isso é a RLS', async () => {
    const maybeSingle = jest.fn(async () => ({ data: row, error: null }));
    const eq = jest.fn(() => ({ maybeSingle }));
    const select = jest.fn(() => ({ eq }));
    const client = { from: jest.fn(() => ({ select })) } as unknown as SupabaseClient;

    const snapshot = await createHairProfileAdapter(client, () => 'user-1').getById('hp-1');
    expect(eq).toHaveBeenCalledWith('id', 'hp-1');
    expect(JSON.stringify(eq.mock.calls)).not.toMatch(/user_id/);
    expect(snapshot?.hairProfileId).toBe('hp-1');
  });

  it('um id que a RLS não deixa ver vira null, e a tela lê isso como "não dá para explicar"', async () => {
    const client = {
      from: jest.fn(() => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      })),
    } as unknown as SupabaseClient;
    await expect(createHairProfileAdapter(client, () => 'user-1').getById('hp-alheio')).resolves.toBeNull();
  });
});
