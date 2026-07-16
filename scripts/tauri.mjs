#!/usr/bin/env node
/**
 * Tauri CLI 包装：开发模式自动合并独立 identifier，避免与已安装的正式版 ccMesh 冲突。
 * 用法与官方 CLI 一致：
 *   node scripts/tauri.mjs dev
 *   node scripts/tauri.mjs build
 *   node scripts/tauri.mjs --help
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const devConfigPath = resolve(projectRoot, 'src-tauri/tauri.dev.conf.json');
const tauriCli = resolve(
  projectRoot,
  'node_modules/@tauri-apps/cli/tauri.js',
);

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('-')) ?? '';
const hasConfigFlag = args.some(
  (arg) => arg === '-c' || arg === '--config' || arg.startsWith('--config='),
);

// 仅在 dev 子命令且未显式传 --config 时注入开发配置
const finalArgs =
  command === 'dev' && !hasConfigFlag
    ? ['dev', '--config', devConfigPath, ...args.filter((arg) => arg !== 'dev')]
    : args;

const child = spawn(process.execPath, [tauriCli, ...finalArgs], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('启动 Tauri CLI 失败:', error.message);
  process.exit(1);
});
