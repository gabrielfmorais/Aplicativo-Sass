import { createClient } from '@supabase/supabase-js';

import { secureSessionStorage } from './secure-session-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set (see .env.example)');
}

/** Single Supabase client (anon key + user JWT only — never service role). SPEC-001 FR4. */
export const supabase = createClient(url, anonKey, {
  auth: {
    storage: secureSessionStorage,
    storageKey: 'sb-session',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
