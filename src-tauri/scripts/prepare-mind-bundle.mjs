#!/usr/bin/env node
/**
 * prepare-mind-bundle — stage the KaleidoMind agent for a PACKAGED build.
 *
 * Run this BEFORE `tauri build`. It produces `src-tauri/resources/mind/`:
 *   provider/   — @kaleidorg/mind-provider (+ @qvac/sdk), installed from npm
 *   mcp/        — kaleido-mcp, installed from npm
 *   node[.exe]  — a Node runtime for the TARGET platform
 *
 * Everything is pulled from the public npm registry — NO local sibling repos
 * are required, so this works in clean checkouts / CI / cloud builds. Each
 * package lands at `<name>/node_modules/<pkg>/dist/index.js` (npm's hoisted
 * layout); main.rs probes that path and points the sidecar env at it. In dev
 * none of this runs — the sidecar uses the sibling repos + system node.
 *
 * ⚠️  The provider drags in @qvac/sdk's native engines, so the tree is large.
 *   Measure it (`du -sh resources/mind`) and trim unused engines before relying
 *   on it for a shipped build. Confirm the model loads on each target.
 *
 * Env knobs: PROVIDER_VERSION / MCP_VERSION / QVAC_VERSION (npm semver ranges),
 * NODE_VERSION, TARGET_PLATFORM / TARGET_ARCH (override host detection).
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  chmodSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const NODE_VERSION = process.env.NODE_VERSION ?? '20.18.1' // pin; match CI
const PROVIDER_VERSION = process.env.PROVIDER_VERSION ?? '^0.6.0'
const MCP_VERSION = process.env.MCP_VERSION ?? '^0.2.0'
const QVAC_VERSION = process.env.QVAC_VERSION ?? '^0.13.5'

// @qvac/sdk hard-depends on EVERY inference engine (~4 GB), but the desktop
// text agent only uses the LLM (llamacpp completion) + embeddings. Drop the
// engines it never loads. The SDK loads engines per-registered-plugin (not on
// import), and the provider is written to tolerate missing STT/TTS plugins, so
// removing these is safe for the chat path. Override with MIND_DROP_ENGINES=""
// to keep everything, or a custom comma-separated list.
const DROP_ENGINES = (
  process.env.MIND_DROP_ENGINES ??
  [
    'translation-nmtcpp',
    'vla-ggml',
    'diffusion-cpp',
    'transcription-whispercpp',
    'tts-ggml',
    'ocr-onnx',
    'bci-whispercpp',
    'transcription-parakeet',
    'onnx',
    'classification-ggml',
  ].join(',')
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const here = dirname(fileURLToPath(import.meta.url))
const srcTauri = resolve(here, '..')
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
  // Restore the tracked placeholder so the dir survives in git — Tauri's
  // build-time resource check needs resources/mind to exist in dev/CI.
  writeFileSync(join(out, '.gitkeep'), '')
}

// Install npm `deps` into `<out>/<name>` as a self-contained, prod-only tree.
// npm's default hoisted layout puts each dep's own files at
// `<name>/node_modules/<pkg>/…`, which is what main.rs probes for.
function installFromNpm(name, deps) {
  const dir = join(out, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      { name: `kaleido-bundle-${name}`, version: '0.0.0', private: true, dependencies: deps },
      null,
      2
    ) + '\n'
  )
  // NPM_OS / NPM_CPU force npm to fetch the TARGET platform's prebuilt native
  // packages (e.g. the macOS runner is arm64 but also builds the x64 target).
  const npmArgs = ['install', '--omit=dev', '--no-audit', '--no-fund']
  if (process.env.NPM_OS) npmArgs.push(`--os=${process.env.NPM_OS}`)
  if (process.env.NPM_CPU) npmArgs.push(`--cpu=${process.env.NPM_CPU}`)
  run('npm', npmArgs, dir)
}

// Delete the unused @qvac inference engines from an installed tree (see
// DROP_ENGINES). Removes ~3 GB the text agent never loads.
function pruneEngines(name) {
  if (!DROP_ENGINES.length) return
  const qvac = join(out, name, 'node_modules', '@qvac')
  if (!existsSync(qvac)) return
  for (const eng of DROP_ENGINES) {
    const p = join(qvac, eng)
    if (existsSync(p)) {
      rmSync(p, { recursive: true, force: true })
      console.log(`  pruned @qvac/${eng}`)
    }
  }
}

// Node runtime for the target platform (host by default).
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

console.log(`Staging KaleidoMind bundle (from npm) → ${out}`)
reset()
installFromNpm('provider', {
  '@kaleidorg/mind-provider': PROVIDER_VERSION,
  '@qvac/sdk': QVAC_VERSION,
})
pruneEngines('provider')
installFromNpm('mcp', { 'kaleido-mcp': MCP_VERSION })
fetchNode()
console.log('\nDone. Verify size:  du -sh src-tauri/resources/mind')
console.log('Then `tauri build` and confirm the agent runs in the packaged app.')
