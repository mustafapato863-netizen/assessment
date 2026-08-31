import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://assessflow:assessflow_local_only@localhost:5432/assessflow',
};

const prismaCli = resolve('node_modules', 'prisma', 'build', 'index.js');
const result = spawnSync(process.execPath, [prismaCli, 'validate'], { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
