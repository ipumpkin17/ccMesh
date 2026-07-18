#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const VERSION_RE = /^\d+\.\d+\.\d+-\d+$/

function run(command, args, options = {}) {
  const result = execFileSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  })
  return typeof result === 'string' ? result.trim() : ''
}

function fail(message) {
  console.error(`\n发布已取消：${message}`)
  process.exit(1)
}

function getCurrentVersion() {
  return JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')).version
}

function ensureCleanWorktree() {
  if (run('git', ['status', '--porcelain'])) {
    fail('工作区存在未提交改动，请先提交、暂存或清理后再运行')
  }
}

function ensureMasterReady() {
  if (run('git', ['branch', '--show-current']) !== 'master') {
    fail('请切换到 master 分支后再发布')
  }

  console.log('获取远端状态...')
  run('git', ['fetch', 'origin'], { stdio: 'inherit' })
  try {
    run('git', ['merge-base', '--is-ancestor', 'origin/master', 'HEAD'])
  } catch {
    fail('本地 master 未包含 origin/master，请先同步远端提交')
  }
}

function ensureTagAvailable(tag) {
  if (run('git', ['tag', '--list', tag]) || run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`])) {
    fail(`tag ${tag} 已存在，版本 tag 不可复用`)
  }
}

async function confirm(rl, question) {
  return (await rl.question(`${question} [y/N] `)).trim().toLowerCase() === 'y'
}

async function main() {
  try {
    run('git', ['rev-parse', '--is-inside-work-tree'])
  } catch {
    fail('当前目录不是 Git 仓库')
  }

  ensureCleanWorktree()
  ensureMasterReady()

  const currentVersion = getCurrentVersion()
  const rl = createInterface({ input, output })

  try {
    console.log(`当前版本：${currentVersion}`)
    const version = (await rl.question('输入发布版本号（例如 0.2.1-8）：')).trim()
    if (!VERSION_RE.test(version)) {
      fail('版本号必须为扩展版本格式 x.y.z-N，例如 0.2.1-8')
    }

    const tag = `v${version}`
    ensureTagAvailable(tag)
    const releaseCommit = run('git', ['log', '-1', '--oneline'])
    console.log(`\n发布提交：${releaseCommit}`)
    console.log(`目标版本：${version}`)
    console.log(`Git tag：${tag}`)

    if (!(await confirm(rl, '继续同步版本、提交并推送？'))) {
      console.log('已取消，未修改文件')
      return
    }

    run('pnpm', ['version:sync', version], { stdio: 'inherit' })
    run('cargo', ['check', '--manifest-path', 'src-tauri/Cargo.toml', '--message-format=short'], {
      stdio: 'inherit',
    })
    run('git', ['diff', '--check'], { stdio: 'inherit' })

    run('git', ['add', 'package.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock', 'src-tauri/tauri.conf.json'])
    run('git', ['diff', '--cached', '--check'], { stdio: 'inherit' })

    if (!(await confirm(rl, `确认创建 release(app): 发布 ${version} 并推送 ${tag}？`))) {
      console.log('已取消，版本文件已暂存，未创建提交')
      return
    }

    run('git', ['commit', '-m', `release(app): 发布 ${version}`], { stdio: 'inherit' })
    run('git', ['tag', '-a', tag, '-m', `发布 ${tag}`], { stdio: 'inherit' })
    run('git', ['push', '--atomic', 'origin', 'master', tag], { stdio: 'inherit' })

    console.log(`\n已推送 ${tag}`)
    console.log('Release 工作流已触发。三平台构建完成后，到 GitHub Releases 发布 Draft Release')
  } finally {
    rl.close()
  }
}

main().catch((error) => fail(error.message))
