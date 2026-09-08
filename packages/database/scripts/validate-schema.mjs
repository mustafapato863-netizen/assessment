import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    try {
      process.loadEnvFile('../../.env');
    } catch {}
  }
}

const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://postgres:123456@localhost:5432/asses_db',
};

const prismaCli = resolve('node_modules', 'prisma', 'build', 'index.js');
const result = spawnSync(process.execPath, [prismaCli, 'validate'], { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
