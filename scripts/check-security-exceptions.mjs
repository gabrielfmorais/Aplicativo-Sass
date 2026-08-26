// Re-validates the premises behind every accepted audit exception (docs/security/AUDIT-EXCEPTIONS.md).
// FAIL CLOSED: any expired exception, mismatch with package.json#pnpm.auditConfig.ignoreGhsas, or change in
// dependency topology that is not explicitly accepted exits non-zero and demands human re-review.
// Inspects package.json files and Node resolution programmatically — no parsing of CLI output.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const rel = (p) => relative(root, p).split(sep).join('/');

const problems = [];
const notes = [];
const fail = (msg) => problems.push(msg);

const config = readJson(join(root, 'docs/security/audit-exceptions.json'));
const rootPkg = readJson(join(root, 'package.json'));
const ignored = new Set(rootPkg.pnpm?.auditConfig?.ignoreGhsas ?? []);
const today = new Date().toISOString().slice(0, 10); // tooling script; not subject to the core clock rule

// ---------------------------------------------------------------------------------------------
// 0. Consistency: every ignored GHSA has an exception entry and vice versa.
const declared = new Set(config.exceptions.map((e) => e.ghsa));
for (const g of ignored)
  if (!declared.has(g)) fail(`${g} is ignored in package.json but has no entry in audit-exceptions.json`);
for (const g of declared)
  if (!ignored.has(g))
    fail(`${g} is documented in audit-exceptions.json but not in package.json#pnpm.auditConfig.ignoreGhsas`);

// ---------------------------------------------------------------------------------------------
// Helpers over the installed tree (node-linker=hoisted; nested copies live under <pkg>/node_modules).
const pkgJsonAt = (dir) =>
  existsSync(join(dir, 'package.json')) ? readJson(join(dir, 'package.json')) : null;
const declaresDep = (pkg, name) =>
  Boolean(pkg?.dependencies?.[name] || pkg?.optionalDependencies?.[name] || pkg?.peerDependencies?.[name]);

/** Walk node_modules (skipping the pnpm store) and return every installed package dir. */
function installedPackages() {
  const out = [];
  const walk = (nm) => {
    if (!existsSync(nm)) return;
    for (const entry of readdirSync(nm)) {
      if (entry.startsWith('.')) continue; // .pnpm, .bin, .cache
      const p = join(nm, entry);
      if (entry.startsWith('@')) {
        for (const sub of readdirSync(p)) visit(join(p, sub));
      } else visit(p);
    }
  };
  const visit = (dir) => {
    let st;
    try {
      st = statSync(dir);
    } catch {
      return;
    }
    if (!st.isDirectory()) return;
    if (existsSync(join(dir, 'package.json'))) out.push(dir);
    walk(join(dir, 'node_modules'));
  };
  walk(join(root, 'node_modules'));
  return out;
}
const packages = installedPackages();

// ---------------------------------------------------------------------------------------------
for (const ex of config.exceptions) {
  const tag = `${ex.id} (${ex.ghsa}, ${ex.package})`;
  const p = ex.premises;

  // A. Not expired.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ex.expires)) fail(`${tag}: invalid expiry "${ex.expires}"`);
  else if (today > ex.expires)
    fail(`${tag}: EXPIRED on ${ex.expires} (today ${today}) — human re-validation required`);
  else notes.push(`${tag}: valid until ${ex.expires}`);

  // Installed copies of the vulnerable package.
  const copies = packages.filter((d) => pkgJsonAt(d)?.name === ex.package);
  if (copies.length === 0) {
    fail(
      `${tag}: ${ex.package} is no longer installed — the dependency chain disappeared; REMOVE the exception and its GHSA from package.json`,
    );
    continue;
  }
  for (const c of copies) {
    const v = pkgJsonAt(c).version;
    if (compareSemver(v, p.installedVersionMax) > 0)
      fail(
        `${tag}: ${ex.package}@${v} at ${rel(c)} is newer than the reviewed range (<=${p.installedVersionMax}); a patched release may exist — re-validate`,
      );
    else notes.push(`${tag}: ${ex.package}@${v} at ${rel(c)}`);
  }

  // B. The Metro resolved from @expo/cli must not declare the vulnerable package.
  try {
    const req = createRequire(join(root, 'node_modules/@expo/cli/package.json'));
    const metroPkgPath = req.resolve('metro/package.json');
    const metroPkg = readJson(metroPkgPath);
    if (declaresDep(metroPkg, p.expoCliMetroMustNotDeclare))
      fail(
        `${tag}: metro@${metroPkg.version} resolved from @expo/cli (${rel(metroPkgPath)}) DECLARES ${p.expoCliMetroMustNotDeclare} — the Expo execution path is now reachable; exception invalid`,
      );
    else
      notes.push(
        `${tag}: @expo/cli → metro@${metroPkg.version} (${rel(dirname(metroPkgPath))}) does not declare ${p.expoCliMetroMustNotDeclare}`,
      );
    // Also assert no source file under that Metro imports the package.
    const assets = join(dirname(metroPkgPath), 'src', 'Assets.js');
    if (existsSync(assets) && readFileSync(assets, 'utf8').includes(`'${p.expoCliMetroMustNotDeclare}'`))
      fail(`${tag}: Expo-path Metro src/Assets.js imports ${p.expoCliMetroMustNotDeclare}`);
    if (existsSync(assets) && readFileSync(assets, 'utf8').includes(`"${p.expoCliMetroMustNotDeclare}"`))
      fail(`${tag}: Expo-path Metro src/Assets.js imports ${p.expoCliMetroMustNotDeclare}`);
  } catch (e) {
    fail(
      `${tag}: cannot resolve metro from @expo/cli (${e.message}) — build architecture changed; re-validate`,
    );
  }

  // C. Every installed package that declares the vulnerable dependency must be an accepted dependent
  //    at the accepted location, reached through the accepted chain.
  const dependents = packages.filter((d) => declaresDep(pkgJsonAt(d), ex.package));
  const accepted = p.acceptedDependents;
  for (const d of dependents) {
    const pkg = pkgJsonAt(d);
    const match = accepted.find((a) => a.name === pkg.name && rel(d) === a.installedAt);
    if (!match) {
      fail(
        `${tag}: ${pkg.name}@${pkg.version} at ${rel(d)} declares ${ex.package} but is not an accepted dependent (accepted: ${accepted.map((a) => `${a.name}@${a.installedAt}`).join(', ')}) — topology changed; human review required`,
      );
      continue;
    }
    // Verify the accepted chain still exists link by link (each parent declares the next).
    const chain = [...match.reachedThrough];
    let ok = true;
    for (let i = 0; i < chain.length; i++) {
      const parentDir = resolvePackageDir(chain[i]);
      const next = i + 1 < chain.length ? chain[i + 1] : null;
      if (!parentDir) {
        ok = false;
        fail(`${tag}: chain link ${chain[i]} is not installed — chain changed`);
        break;
      }
      const parentPkg = pkgJsonAt(parentDir);
      if (next && !declaresDep(parentPkg, next)) {
        ok = false;
        fail(`${tag}: ${chain[i]}@${parentPkg.version} no longer declares ${next} — chain changed`);
        break;
      }
      if (!next && !(declaresDep(parentPkg, 'metro') || declaresDep(parentPkg, 'metro-config'))) {
        ok = false;
        fail(`${tag}: ${chain[i]}@${parentPkg.version} no longer leads to metro — chain changed`);
      }
    }
    if (ok)
      notes.push(
        `${tag}: accepted dependent ${pkg.name}@${pkg.version} at ${rel(d)} via ${chain.join(' → ')}`,
      );
  }
  if (dependents.length === 0)
    fail(`${tag}: ${ex.package} is installed but nothing declares it — unexpected topology; re-validate`);

  // D. The project must not run the bare React Native CLI (scripts in any workspace package.json).
  for (const wsPkg of workspacePackageJsons()) {
    for (const [name, cmd] of Object.entries(wsPkg.scripts ?? {})) {
      for (const forbidden of p.forbiddenScripts) {
        if (String(cmd).includes(forbidden))
          fail(
            `${tag}: script "${name}" in ${rel(wsPkg.__path)} runs "${forbidden}" — bare RN CLI path is now executed; exception invalid`,
          );
      }
    }
  }

  // E. No assets with extensions handled by the vulnerable parsers (tracked or untracked, outside node_modules).
  const exts = p.forbiddenAssetExtensions.map((e) => e.toLowerCase());
  const offending = trackedAndUntrackedFiles().filter((f) => exts.some((e) => f.toLowerCase().endsWith(e)));
  for (const f of offending)
    fail(`${tag}: asset ${f} has an extension handled by the vulnerable parsers — exception invalid`);
}

// ---------------------------------------------------------------------------------------------
function resolvePackageDir(name) {
  const hoisted = join(root, 'node_modules', ...name.split('/'));
  if (existsSync(join(hoisted, 'package.json'))) return hoisted;
  const found = packages.find((d) => pkgJsonAt(d)?.name === name);
  return found ?? null;
}
function workspacePackageJsons() {
  const out = [];
  for (const p of ['package.json', 'apps/mobile/package.json', 'packages/core/package.json']) {
    const abs = join(root, p);
    if (existsSync(abs)) out.push({ ...readJson(abs), __path: abs });
  }
  return out;
}
function trackedAndUntrackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter((l) => l && !l.startsWith('node_modules/'));
  } catch {
    return [];
  }
}
function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

// ---------------------------------------------------------------------------------------------
for (const n of notes) console.log('  · ' + n);
if (problems.length) {
  console.error(
    '\n[check-security-exceptions] FAIL — human review of docs/security/AUDIT-EXCEPTIONS.md required:',
  );
  for (const p of problems) console.error('  ✖ ' + p);
  process.exit(1);
}
console.log(
  `\n[check-security-exceptions] OK — ${config.exceptions.length} exception(s) valid; premises hold`,
);
