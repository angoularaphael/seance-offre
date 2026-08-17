import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

process.env.BASE_URL = process.env.BASE_URL || 'https://seance-offerte.boxingcenter.fr';

const require = createRequire(import.meta.url);
const cli = require.resolve('@playwright/test/cli');

const child = spawn(process.execPath, [cli, 'test'], {
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 1));
