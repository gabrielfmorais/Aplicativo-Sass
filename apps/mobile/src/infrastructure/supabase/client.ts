import { createClient } from '@supabase/supabase-js';

import { createClockSkewRetryFetch } from './clock-skew-retry';
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
  /**
   * ⚠️ Uma única tentativa a mais quando o servidor diz que o token **ainda não vale** — o `401`
   * intermitente do primeiro segundo depois do login, cuja causa raiz está medida em
   * `./clock-skew-retry.ts`. Não é retry de `401` em geral.
   */
  global: { fetch: createClockSkewRetryFetch(fetch) },
});
