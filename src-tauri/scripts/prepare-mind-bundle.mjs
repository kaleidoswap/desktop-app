#!/usr/bin/env node
/**
 * prepare-mind-bundle — stage the KaleidoMind agent for a PACKAGED build.
 *
 * Run this BEFORE `tauri build`. It produces `src-tauri/resources/mind/`:
 *   provider/   — @kaleidorg/mind-provider, prod-pruned (the model sidecar)
 *   mcp/        — kaleido-mcp, prod-pruned (the tool server)
 *   node[.exe]  — a Node runtime for the TARGET platform
 *
 * `bundle.resources` in tauri.conf.json ships `resources/mind`, and the Rust
 * setup hook (main.rs) points KALEIDO_MIND_PROVIDER_DIR / KALEIDO_MCP_PATH /
 * KALEIDO_NODE_BIN at it. In dev none of this runs — the sidecar uses the
 * sibling repos + system node.
 *
 * ⚠️  SCAFFOLD — must be validated with a real per-platform `tauri build`:
 *   - The provider drags in @qvac/sdk's NATIVE modules; confirm the pruned tree
 *     still loads the model on each target (the .node binaries are
 *     platform-specific, so build on/for each platform).
 *   - Confirm the bundled Node version is compatible with @qvac/sdk.
 *   - Measure the result (`du -sh resources/mind`) — if it's too large,
 *     esbuild-bundle the provider/mcp JS first and keep only native modules.
 *
 * Env knobs: NODE_VERSION (default below), MIND_REPO / MCP_REPO (sibling paths),
 * TARGET_PLATFORM / TARGET_ARCH (override host detection for cross-builds).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, cpSync, chmodSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const NODE_VERSION = process.env.NODE_VERSION ?? '20.18.1' // pin; match CI

const here = dirname(fileURLToPath(import.meta.url))
const srcTauri = resolve(here, '..')
const repoRoot = resolve(srcTauri, '..', '..') // …/Kaleidoswap
const mindRepo = process.env.MIND_REPO ?? join(repoRoot, 'kaleido-mind')
const mcpRepo = process.env.MCP_REPO ?? join(repoRoot, 'kaleido-mcp')
const out = join(srcTauri, 'resources', 'mind')

// execFile (no shell) — args are passed as an array, so nothing is interpolated
// into a command string. Safe by construction.
const run = (cmd, args, cwd) => {
  console.log(`$ ${cmd} ${args.join(' ')}${cwd ? `   (in ${cwd})` : ''}`)
  execFileSync(cmd, args, { cwd, stdio: 'inherit' })
}

function reset() {
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
}

// 1. Provider — pnpm workspace member → `pnpm deploy --prod` gives a flat,
//    prod-only tree (incl. the @kaleidorg/mind workspace dep + @qvac/sdk).
function pruneProvider() {
  if (!existsSync(mindRepo)) throw new Error(`kaleido-mind not found at ${mindRepo}`)
  run('pnpm', ['--filter', '@kaleidorg/mind-provider', 'run', 'build'], mindRepo)
  run(
    'pnpm',
    ['--filter', '@kaleidorg/mind-provider', 'deploy', '--prod', join(out, 'provider')],
    mindRepo
  )
}

// 2. MCP — standalone npm package → copy the built tree + a prod-only install.
function pruneMcp() {
  if (!existsSync(mcpRepo)) throw new Error(`kaleido-mcp not found at ${mcpRepo}`)
  run('npm', ['run', 'build'], mcpRepo)
  const dst = join(out, 'mcp')
  mkdirSync(dst, { recursive: true })
  for (const f of ['dist', 'package.json']) {
    cpSync(join(mcpRepo, f), join(dst, f), { recursive: true })
  }
  // The MCP checkout may have a lockfile generated before a local dependency
  // bump. The packaged app consumes the manifest and freshly built dist, so
  // resolve production dependencies from package.json instead of copying a
  // potentially stale external lockfile into the bundle.
  run('npm', ['install', '--omit=dev', '--ignore-scripts', '--no-package-lock'], dst)
}

// 3. Node runtime for the target platform (host by default).
function fetchNode() {
  const platMap = { darwin: 'darwin', linux: 'linux', win32: 'win' }
  const archMap = { x64: 'x64', arm64: 'arm64' }
  const platform = process.env.TARGET_PLATFORM ?? platMap[process.platform]
  const arch = process.env.TARGET_ARCH ?? archMap[process.arch]
  if (!platform || !arch) throw new Error(`unsupported target ${process.platform}/${process.arch}`)

  const isWin = platform === 'win'
  const ext = isWin ? 'zip' : 'tar.gz'
  const base = `node-v${NODE_VERSION}-${platform}-${arch}`
  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${base}.${ext}`
  const work = join(tmpdir(), `kaleido-node-${process.pid}`)
  mkdirSync(work, { recursive: true })
  const archive = join(work, `${base}.${ext}`)

  run('curl', ['-fSL', url, '-o', archive])
  // bsdtar (mac/linux/win10+) extracts both .tar.gz and .zip.
  run('tar', ['-xf', archive, '-C', work])

  const binSrc = isWin ? join(work, base, 'node.exe') : join(work, base, 'bin', 'node')
  const binDst = join(out, isWin ? 'node.exe' : 'node')
  cpSync(binSrc, binDst)
  if (!isWin) chmodSync(binDst, 0o755)
  rmSync(work, { recursive: true, force: true })
  console.log(`node ${NODE_VERSION} ${platform}/${arch} → ${binDst}`)
}

console.log(`Staging KaleidoMind bundle → ${out}`)
reset()
pruneProvider()
pruneMcp()
fetchNode()
console.log('\nDone. Verify size:  du -sh src-tauri/resources/mind')
console.log('Then `tauri build` and confirm the agent runs in the packaged app.')
