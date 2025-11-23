import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const phpHost = process.env.ADMIN_DEV_PHP_HOST || '127.0.0.1';
const phpPort = process.env.ADMIN_DEV_PHP_PORT || '9400';
const adminProxyTarget = `http://${phpHost}:${phpPort}`;

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];

const astroBin =
  process.platform === 'win32'
    ? resolve(rootDir, 'node_modules', '.bin', 'astro.cmd')
    : resolve(rootDir, 'node_modules', '.bin', 'astro');

if (!existsSync(astroBin)) {
  console.error(
    '[dev-admin] Unable to locate the Astro CLI. Run "pnpm install" first.'
  );
  process.exit(1);
}

function terminateChildren(signal = 'SIGTERM') {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

function handleError(prefix, error) {
  if (error.code === 'ENOENT') {
    console.error(
      `[dev-admin] ${prefix}: "${error.path}" is not available on your PATH.`
    );
    console.error(
      '[dev-admin] Ensure PHP 8.1+ is installed and accessible before running `pnpm dev`.'
    );
  } else {
    console.error(`[dev-admin] ${prefix}: ${error.message}`);
  }
  terminateChildren();
  process.exit(1);
}

process.on('SIGINT', () => terminateChildren('SIGINT'));
process.on('SIGTERM', () => terminateChildren('SIGTERM'));

const phpProcess = spawn('php', ['-S', `${phpHost}:${phpPort}`, '-t', 'public'], {
  cwd: rootDir,
  stdio: 'inherit',
});
children.push(phpProcess);

phpProcess.on('error', (error) =>
  handleError('Failed to start the PHP dev server', error)
);

const astroProcess = spawn(astroBin, ['dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    ADMIN_DEV_PROXY_TARGET: adminProxyTarget,
  },
});
children.push(astroProcess);

astroProcess.on('error', (error) =>
  handleError('Failed to start the Astro dev server', error)
);

phpProcess.on('exit', (code, signal) => {
  if (!astroProcess.killed) {
    astroProcess.kill('SIGTERM');
  }
  if (signal) {
    process.exit(0);
  }
  process.exit(code ?? 0);
});

astroProcess.on('exit', (code, signal) => {
  if (!phpProcess.killed) {
    phpProcess.kill('SIGTERM');
  }
  if (signal) {
    process.exit(0);
  }
  process.exit(code ?? 0);
});
