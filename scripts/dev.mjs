import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findAvailablePort } from './dev-ports.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
if (existsSync('.env')) process.loadEnvFile('.env');

try {
  const auto = process.env.DEV_AUTO_PORT !== 'false' && !process.argv.includes('--strict-ports');
  const preferredApi = process.env.PORT || '3001';
  const preferredWeb = process.env.WEB_PORT || '5174';
  const apiPort = await findAvailablePort(preferredApi, { auto });
  const webPort = await findAvailablePort(preferredWeb, { auto, exclude: [apiPort] });
  if (apiPort !== Number(preferredApi))
    console.info(`API port ${preferredApi} unavailable; using ${apiPort}.`);
  if (webPort !== Number(preferredWeb))
    console.info(`Web port ${preferredWeb} unavailable; using ${webPort}.`);
  console.info(`Starting AssessFlow: http://localhost:${webPort}`);
  console.info(`API: http://localhost:${apiPort} (health: /health)`);

  if (!process.env.npm_execpath) throw new Error('Run this launcher with pnpm dev.');
  const child = spawn(
    process.execPath,
    [
      process.env.npm_execpath,
      '--parallel',
      '--filter',
      '@assessflow/api',
      '--filter',
      '@assessflow/web',
      '--filter',
      '@assessflow/worker',
      'dev',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: String(apiPort),
        WEB_PORT: String(webPort),
        DEV_AUTO_PORT: String(auto),
        DEV_API_TARGET: `http://localhost:${apiPort}`,
        VITE_API_URL: '/api/v1/assessflow',
      },
    },
  );
  child.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        });
      } else child.kill(signal);
    });
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
