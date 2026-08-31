// ESLint flat config — architectural boundary enforcement (ADR-001, SPEC-000 §7).
// Defence in depth: the same rules are mirrored in .dependency-cruiser.cjs.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** Patterns that must never be imported from packages/core (runtime independence, D-48). */
const CORE_FORBIDDEN_IMPORTS = [
  { group: ['react', 'react/*', 'react-dom', 'react-dom/*'], message: 'core is framework-free (ADR-001).' },
  {
    group: ['react-native', 'react-native/*', 'react-native-*'],
    message: 'core must not depend on React Native.',
  },
  { group: ['expo', 'expo-*', 'expo/*', '@expo/*'], message: 'core must not depend on Expo.' },
  { group: ['@supabase/*'], message: 'core must not depend on the Supabase SDK (ADR-004).' },
  {
    group: [
      'node:*',
      'fs',
      'path',
      'os',
      'crypto',
      'child_process',
      'http',
      'https',
      'net',
      'url',
      'util',
      'stream',
      'buffer',
      'process',
      'worker_threads',
    ],
    message: 'core must not use Node-only built-ins; it runs on Hermes, Node and Deno (SPEC-000 BR1).',
  },
  {
    group: ['@app/core/*/domain/*', '@app/core/*/application/*'],
    message: 'import a context only through its public index.',
  },
];

/** Forbid reading the ambient clock outside the SystemClock adapter (ADR-008). */
const NO_AMBIENT_CLOCK = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message:
      '`new Date()` is forbidden here. Inject a Clock (ADR-008); only SystemClock may read the ambient time.',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message:
      '`Date.now()` is forbidden here. Inject a Clock (ADR-008); only SystemClock may read the ambient time.',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      'supabase/functions/**', // Deno code is checked by `deno check`/`deno lint`
      'tooling/boundary-fixtures/**', // negative fixtures are linted by scripts/check-boundary-fixtures.mjs
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Repo tooling scripts run on Node (never shipped).
    files: [
      'scripts/**/*.mjs',
      '*.cjs',
      '*.mjs',
      'apps/*/*.config.js',
      'apps/*/babel.config.js',
      'apps/*/metro.config.js',
    ],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        // Node 22 ships both as globals; scripts/check-remote-schema.mjs uses them.
        fetch: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off', // CommonJS config files (Metro, Jest)
    },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // ---- packages/core: runtime-independent domain + application -------------------------------
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: CORE_FORBIDDEN_IMPORTS }],
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'core must not read environment variables or process state.' },
        { name: 'require', message: 'core is ESM only.' },
        { name: 'fetch', message: 'core must not perform network calls; use a port.' },
        { name: 'XMLHttpRequest', message: 'core must not perform network calls; use a port.' },
        { name: 'localStorage', message: 'core must not access storage; use a port.' },
        { name: 'window', message: 'core must not touch the host environment.' },
        { name: 'document', message: 'core must not touch the host environment.' },
      ],
      'no-restricted-syntax': ['error', ...NO_AMBIENT_CLOCK],
    },
  },
  {
    // The single place allowed to read the ambient clock.
    files: ['packages/core/src/shared/time/system-clock.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // Domain layer must not import the application layer of any context.
    files: ['packages/core/src/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...CORE_FORBIDDEN_IMPORTS,
            {
              group: ['../application', '../application/*', '../../*/application/*', '**/application/**'],
              message: 'domain must not depend on application (ADR-001).',
            },
          ],
        },
      ],
    },
  },

  // ---- apps/mobile: presentation must not know Supabase or core internals --------------------
  {
    files: ['apps/mobile/src/features/**/*.{ts,tsx}', 'apps/mobile/src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*'],
              message: 'presentation never imports the Supabase SDK; go through application hooks (ADR-001).',
            },
            {
              group: ['@app/core/*/domain/*', '@app/core/*/application/*'],
              message: 'import a context only through its public index.',
            },
          ],
        },
      ],
      'no-restricted-syntax': ['error', ...NO_AMBIENT_CLOCK],
    },
  },
  {
    files: ['apps/mobile/src/infrastructure/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/**', '**/app/**'],
              message: 'infrastructure must not depend on presentation (ADR-001).',
            },
          ],
        },
      ],
      'no-restricted-syntax': ['error', ...NO_AMBIENT_CLOCK],
    },
  },
  {
    files: ['apps/mobile/src/infrastructure/clock/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
