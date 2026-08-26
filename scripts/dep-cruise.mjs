// Runs dependency-cruiser over the workspace roots that exist (packages/, apps/).
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(root, 'node_modules', 'dependency-cruiser', 'bin', 'dependency-cruise.mjs'); // node-linker=hoisted

const targets = ['packages', 'apps'].filter((d) => existsSync(join(root, d)));
const result = spawnSync(process.execPath, [bin, '--config', '.dependency-cruiser.cjs', ...targets], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
