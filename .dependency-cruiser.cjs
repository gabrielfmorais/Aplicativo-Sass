/** @type {import('dependency-cruiser').IConfiguration} */
// Dependency rule enforcement (ADR-001). Mirrors eslint.config.mjs as defence in depth.
module.exports = {
  forbidden: [
    {
      name: 'core-no-frameworks',
      severity: 'error',
      comment: 'packages/core is runtime-independent (ADR-001, D-48).',
      from: { path: '^packages/core/src' },
      to: { path: '^node_modules/(react|react-dom|react-native|expo|@expo|@supabase)([/-]|$)' },
    },
    {
      name: 'core-no-node-builtins',
      severity: 'error',
      comment: 'core runs on Hermes, Node and Deno; Node built-ins are forbidden (SPEC-000 BR1).',
      from: { path: '^packages/core/src' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'core-domain-not-to-application',
      severity: 'error',
      comment: 'domain must not depend on application (ADR-001).',
      from: { path: '^packages/core/src/[^/]+/domain/' },
      to: { path: '^packages/core/src/[^/]+/application/' },
    },
    {
      name: 'core-context-isolation',
      severity: 'error',
      comment: 'a context may import another context only through its public index (ADR-006).',
      from: { path: '^packages/core/src/([^/]+)/' },
      to: {
        path: '^packages/core/src/(?!shared/)[^/]+/(domain|application)/',
        pathNot: '^packages/core/src/$1/',
      },
    },
    {
      name: 'mobile-presentation-no-supabase',
      severity: 'error',
      comment: 'presentation never imports the Supabase SDK (ADR-001).',
      from: { path: '^apps/mobile/src/(features|app)/' },
      to: { path: '^node_modules/@supabase/' },
    },
    {
      name: 'mobile-presentation-no-core-internals',
      severity: 'error',
      from: { path: '^apps/mobile/src/(features|app)/' },
      to: { path: '^packages/core/src/[^/]+/(domain|application)/' },
    },
    {
      name: 'mobile-infrastructure-not-to-presentation',
      severity: 'error',
      comment: 'infrastructure must not depend on presentation (ADR-001).',
      from: { path: '^apps/mobile/src/infrastructure/' },
      to: { path: '^apps/mobile/src/(features|app)/' },
    },
    {
      name: 'mobile-app-routes-only-features',
      severity: 'error',
      comment: 'expo-router files only compose feature screens.',
      from: { path: '^apps/mobile/src/app/' },
      to: { path: '^apps/mobile/src/infrastructure/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: '(^|/)(node_modules|dist|build|coverage|\\.expo|android|ios)/|tooling/boundary-fixtures',
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
