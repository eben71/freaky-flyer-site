#!/usr/bin/env node
import { accessSync, constants, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const uploadScript = path.join(rootDir, 'public/admin/upload.php');
const appConfigPath = path.join(rootDir, 'config/app_config.php');
const downloadRoot = path.join(rootDir, 'public/downloads');
const archiveDir = path.join(downloadRoot, 'archived');

const checks = [];

function sizeToBytes(value) {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)([KMG]?)$/i);
  if (!match) return NaN;
  const number = Number(match[1]);
  const unit = match[2].toUpperCase();
  const factor = unit === 'G' ? 1024 ** 3 : unit === 'M' ? 1024 ** 2 : unit === 'K' ? 1024 : 1;
  return number * factor;
}

function runCheck(name, fn) {
  try {
    const detail = fn();
    checks.push({ name, status: 'PASS', detail });
  } catch (error) {
    checks.push({ name, status: 'FAIL', detail: error.message });
  }
}

function phpEval(code) {
  return execSync(`php -r ${JSON.stringify(code)}`, { stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim();
}

runCheck('PHP binary is available', () => execSync('php -v', { stdio: ['ignore', 'pipe', 'pipe'] }).toString().split('\n')[0]);

runCheck('Upload script exists', () => {
  if (!existsSync(uploadScript)) throw new Error(`Missing ${path.relative(rootDir, uploadScript)}`);
  return path.relative(rootDir, uploadScript);
});

runCheck('Upload script syntax is valid', () => execSync(`php -l ${JSON.stringify(uploadScript)}`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim());


runCheck('Admin config avoids PHP 7+ only dirname signature', () => {
  const configText = readFileSync(path.join(rootDir, 'public/admin/config.php'), 'utf8');
  if (configText.includes('dirname(__DIR__, 2)')) {
    throw new Error('Found dirname(__DIR__, 2) in public/admin/config.php. This breaks on older PHP versions that only accept one dirname parameter.');
  }
  return 'No dirname(__DIR__, 2) usage detected in public/admin/config.php';
});

runCheck('fileinfo extension is enabled (required for MIME detection)', () => {
  const loaded = phpEval('echo extension_loaded("fileinfo") ? "yes" : "no";');
  if (loaded !== 'yes') {
    throw new Error('PHP extension "fileinfo" is not loaded. upload.php calls new finfo(...), which can trigger a 500 fatal error when missing.');
  }
  return 'fileinfo=enabled';
});

runCheck('Configured upload root exists and is writable', () => {
  const config = readFileSync(appConfigPath, 'utf8');
  if (!config.includes("'root' => dirname(__DIR__) . '/public/downloads'")) {
    return 'Upload root differs from default; verify path manually in config/app_config.php';
  }

  if (!existsSync(downloadRoot)) {
    throw new Error(`Directory does not exist: ${path.relative(rootDir, downloadRoot)}`);
  }

  accessSync(downloadRoot, constants.W_OK);
  return `${path.relative(rootDir, downloadRoot)} is writable for this user`;
});

runCheck('Archived upload directory can be written', () => {
  if (!existsSync(archiveDir)) {
    return `${path.relative(rootDir, archiveDir)} will be created on first upload if parent permissions allow it`;
  }

  accessSync(archiveDir, constants.W_OK);
  return `${path.relative(rootDir, archiveDir)} is writable for this user`;
});

runCheck('PHP upload size limits are compatible with 10 MB app limit', () => {
  const uploadMax = phpEval('echo ini_get("upload_max_filesize");');
  const postMax = phpEval('echo ini_get("post_max_size");');

  const requiredBytes = 10 * 1024 * 1024;
  const uploadMaxBytes = sizeToBytes(uploadMax);
  const postMaxBytes = sizeToBytes(postMax);

  if (uploadMaxBytes < requiredBytes || postMaxBytes < requiredBytes) {
    throw new Error(
      `upload_max_filesize=${uploadMax}, post_max_size=${postMax}. Both must be at least 10M to match the app upload limit.`
    );
  }

  return `upload_max_filesize=${uploadMax}, post_max_size=${postMax}`;
});

const failed = checks.filter((check) => check.status === 'FAIL');
const passed = checks.filter((check) => check.status === 'PASS');

for (const check of checks) {
  const icon = check.status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${check.name}`);
  console.log(`   ${check.detail}`);
}

if (failed.length > 0) {
  console.log(`\nSummary: ${failed.length} failing check(s), ${passed.length} passing check(s).`);
  process.exitCode = 1;
} else {
  console.log(`\nSummary: all ${passed.length} checks passed.`);
}
