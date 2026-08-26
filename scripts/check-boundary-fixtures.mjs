// Negative fixtures: proves that architectural boundary rules actually FAIL when violated
// (SPEC-000 AC2–AC4). Each fixture is copied to the location where the rule applies, the tool is
// run, the expected rule id must be reported, and the fixture is removed again.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// node-linker=hoisted (.npmrc) guarantees these paths.
const pkgDir = (name) => join(root, 'node_modules', name);
const eslintBin = join(pkgDir('eslint'), 'bin', 'eslint.js');
const depcruiseBin = join(pkgDir('dependency-cruiser'), 'bin', 'dependency-cruise.mjs');
const fixtures = join(root, 'tooling', 'boundary-fixtures');

/** @type {{name:string, tool:'eslint'|'depcruise', src:string, dest:string, expect:string}[]} */
const CASES = [
  {
    name: 'core imports react',
    tool: 'eslint',
    src: 'core-imports-react.ts',
    dest: 'packages/core/src/shared/__fixture_react.ts',
    expect: 'no-restricted-imports',
  },
  {
    name: 'core imports supabase sdk',
    tool: 'eslint',
    src: 'core-imports-supabase.ts',
    dest: 'packages/core/src/shared/__fixture_supabase.ts',
    expect: 'no-restricted-imports',
  },
  {
    name: 'core imports node:fs',
    tool: 'eslint',
    src: 'core-imports-node-fs.ts',
    dest: 'packages/core/src/shared/__fixture_fs.ts',
    expect: 'no-restricted-imports',
  },
  {
    name: 'core reads ambient clock',
    tool: 'eslint',
    src: 'core-new-date.ts',
    dest: 'packages/core/src/schedule/__fixture_clock.ts',
    expect: 'no-restricted-syntax',
  },
  {
    name: 'core reads process.env',
    tool: 'eslint',
    src: 'core-reads-env.ts',
    dest: 'packages/core/src/shared/__fixture_env.ts',
    expect: 'no-restricted-globals',
  },
  {
    name: 'mobile feature imports supabase sdk',
    tool: 'eslint',
    src: 'feature-imports-supabase.ts',
    dest: 'apps/mobile/src/features/__fixture__/screen.ts',
    expect: 'no-restricted-imports',
  },
  {
    name: 'depcruise: core uses node built-in',
    tool: 'depcruise',
    src: 'core-imports-node-fs.ts',
    dest: 'packages/core/src/shared/__fixture_fs.ts',
    expect: 'core-no-node-builtins',
  },
  {
    name: 'depcruise: domain imports application',
    tool: 'depcruise',
    src: 'domain-imports-application',
    dest: 'packages/core/src/__fixture_ctx',
    expect: 'core-domain-not-to-application',
  },
];

let failures = 0;
for (const c of CASES) {
  const destAbs = join(root, c.dest);
  const createdApps = c.dest.startsWith('apps/') && !existsSync(join(root, 'apps'));
  try {
    mkdirSync(dirname(destAbs), { recursive: true });
    cpSync(join(fixtures, c.src), destAbs, { recursive: true });
    let output = '';
    if (c.tool === 'eslint') {
      const r = spawnSync(process.execPath, [eslintBin, '--no-ignore', '--format', 'json', c.dest], {
        cwd: root,
        encoding: 'utf8',
      });
      output = r.stdout;
      const ruleIds = [];
      try {
        for (const file of JSON.parse(output)) for (const m of file.messages) ruleIds.push(m.ruleId);
      } catch {
        /* fallthrough: no json => treated as missing */
      }
      report(c, ruleIds.includes(c.expect), ruleIds);
    } else {
      const r = spawnSync(
        process.execPath,
        [depcruiseBin, '--config', '.dependency-cruiser.cjs', '--output-type', 'json', 'packages'],
        { cwd: root, encoding: 'utf8' },
      );
      output = r.stdout;
      const ruleNames = [];
      try {
        for (const m of JSON.parse(output).summary.violations) ruleNames.push(m.rule.name);
      } catch {
        /* ignore */
      }
      report(c, ruleNames.includes(c.expect), ruleNames);
    }
  } finally {
    rmSync(destAbs, { recursive: true, force: true });
    // remove empty fixture dirs we created
    const fixtureDir = dirname(destAbs);
    if (fixtureDir.includes('__fixture__')) rmSync(fixtureDir, { recursive: true, force: true });
    if (createdApps) rmSync(join(root, 'apps'), { recursive: true, force: true });
  }
}

function report(c, ok, seen) {
  if (ok) {
    console.log(`  ✔ ${c.name} → ${c.tool} reported ${c.expect}`);
  } else {
    failures++;
    console.error(`  ✖ ${c.name} → expected ${c.tool} rule "${c.expect}", got: ${JSON.stringify(seen)}`);
  }
}

if (failures) {
  console.error(`\n[check-boundaries] ${failures} guardrail(s) did NOT fire. Boundaries are not enforced.`);
  process.exit(1);
}
console.log(`\n[check-boundaries] OK — all ${CASES.length} negative fixtures were rejected`);
