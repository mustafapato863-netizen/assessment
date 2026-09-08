import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = resolve(__dirname, '..');

let prismaCli;
try {
  const req = createRequire(import.meta.url);
  prismaCli = req.resolve('prisma/build/index.js');
} catch {
  const candidates = [
    resolve(dbDir, 'node_modules', 'prisma', 'build', 'index.js'),
    resolve(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js'),
    resolve(dbDir, '..', '..', 'node_modules', 'prisma', 'build', 'index.js'),
  ];
  prismaCli = candidates.find((path) => existsSync(path)) ?? candidates[0];
}

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    try {
      process.loadEnvFile(resolve(__dirname, '..', '..', '.env'));
    } catch {}
  }
}

const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://postgres:123456@localhost:5432/asses_db',
};

const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  env,
  stdio: 'inherit',
  cwd: dbDir,
});
process.exit(result.status ?? 1);
