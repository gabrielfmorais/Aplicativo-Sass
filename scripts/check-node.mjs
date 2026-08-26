// Fails early when the running Node.js major/minor does not match .node-version.
// DECISION-REGISTER D-43: Node 22.23.x is pinned; upgrades must be intentional.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pinned = readFileSync(join(root, '.node-version'), 'utf8').trim(); // e.g. 22.23.2
const [pinMajor, pinMinor] = pinned.split('.').map(Number);
const current = process.versions.node;
const [curMajor, curMinor] = current.split('.').map(Number);

if (curMajor !== pinMajor || curMinor !== pinMinor) {
  console.error(
    `\n[check-node] Unsupported Node.js ${current}. This repository is pinned to ${pinMajor}.${pinMinor}.x (see .node-version = ${pinned}).\n` +
      `[check-node] Use a version manager (fnm/nvm/volta) or run commands through: npx -y -p node@${pinned} -- <command>\n` +
      `[check-node] Upgrading the Node major is an intentional change (DECISION-REGISTER D-43).\n`,
  );
  process.exit(1);
}
console.log(`[check-node] OK — Node ${current} matches pin ${pinned}`);
