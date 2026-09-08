import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';

const clientDir = resolve('generated', 'client');
const clientIndex = join(clientDir, 'index.js');
const engineDll = join(clientDir, 'query_engine-windows.dll.node');

function cleanTmpFiles() {
  if (existsSync(clientDir)) {
    try {
      const files = readdirSync(clientDir);
      for (const file of files) {
        if (file.includes('.tmp')) {
          try {
            unlinkSync(join(clientDir, file));
          } catch {}
        }
      }
    } catch {}
  }
}

cleanTmpFiles();

const prismaCli = resolve('node_modules', 'prisma', 'build', 'index.js');
const result = spawnSync(process.execPath, [prismaCli, 'generate'], {
  stdio: 'pipe',
  encoding: 'utf8',
});

if (result.status === 0) {
  process.stdout.write(result.stdout);
  cleanTmpFiles();
  process.exit(0);
}

// Check if failure was specifically the Windows DLL file lock on rename
const output = (result.stdout || '') + (result.stderr || '');
if (output.includes('query_engine-windows.dll.node') && output.includes('EPERM') && existsSync(clientIndex) && existsSync(engineDll)) {
  console.log('[Prisma Generate] Generated client and query engine already present (Windows DLL locked by active IDE process). Preserving existing generated client.');
  cleanTmpFiles();
  process.exit(0);
}

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
cleanTmpFiles();
process.exit(result.status ?? 1);
