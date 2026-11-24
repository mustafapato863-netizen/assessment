import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = resolve(__dirname, '..');
const migrationsDir = resolve(dbDir, 'prisma', 'migrations');
const prismaCmd = resolve(__dirname, 'prisma-command.mjs');

function runPrisma(args) {
  const res = spawnSync(process.execPath, [prismaCmd, ...args], {
    cwd: dbDir,
    stdio: 'inherit',
    env: process.env,
  });
  return res.status ?? 1;
}

const deployStatus = runPrisma(['migrate', 'deploy']);
if (deployStatus === 0) {
  process.exit(0);
}

console.log(
  '[init-fresh-db] Standard migrate deploy failed; reconciling fresh schema with db push...',
);
const pushStatus = runPrisma(['db', 'push', '--skip-generate']);
if (pushStatus !== 0) {
  process.exit(pushStatus);
}

const migrationFolders = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const folder of migrationFolders) {
  const status = runPrisma(['migrate', 'resolve', '--applied', folder]);
  if (status !== 0) {
    process.exit(status);
  }
}

console.log('[init-fresh-db] Schema pushed and triggers/migrations reconciled.');
