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
 * Env knobs: PROVIDER_VERSION / MIND_VERSION / MCP_VERSION / QVAC_VERSION (npm semver ranges),
 * NODE_VERSION, TARGET_PLATFORM / TARGET_ARCH (override host detection).
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  cpSync,
  chmodSync,
  writeFileSync,
  readFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const NODE_VERSION = process.env.NODE_VERSION ?? '20.18.1' // pin; match CI
// Pin the provider and core together so every platform receives the same catalog.
const PROVIDER_VERSION = process.env.PROVIDER_VERSION ?? '0.8.0'
const MIND_VERSION = process.env.MIND_VERSION ?? '0.8.1'
// 0.3.x picks its defaults from KALEIDO_NETWORK (set by mind.rs) and no longer
// installs the Spark/Liquid wallet packages (optional peers, unused here).
const MCP_VERSION = process.env.MCP_VERSION ?? '0.3.1'
// 0.19 removed the P2P provider behind phone pairing; the provider then runs
// desktop-only, and pairing is paused in the app until it returns.
const QVAC_VERSION = process.env.QVAC_VERSION ?? '0.21.0'

// @qvac/sdk (via @qvac/inference) hard-depends on EVERY inference engine, but
// the desktop agent only runs the LLM (llamacpp completion) — its provider
// config sets ragEnabled/memoryEnabled false and wires no embedding/STT/TTS
// plugin. Drop every engine it never loads. With the slim worker below, the
// worker's import graph only reaches llm-llamacpp and langdetect-text, and the
// Node-side `@qvac/sdk` entry reaches no engine at all (checked for 0.21.0).
// embed-llamacpp is included because embeddings/RAG are off on desktop; keep it
// by setting MIND_DROP_ENGINES to a custom list if you wire embeddings later.
const DROP_ENGINES = (
  process.env.MIND_DROP_ENGINES ??
  [
    'asr-ggml',
    'audiogen-ggml',
    'bci-whispercpp',
    'classification-ggml',
    'decoder-audio',
    'diffusion-cpp',
    'embed-llamacpp',
    'ggml-rpc-server',
    'ocr-ggml',
    'translation-nmtcpp',
    'tts-ggml',
    'vla-ggml',
  ].join(',')
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// Non-@qvac packages to drop too. bare-ffmpeg (~400 MB) is only used by the
// audio decode path (whisper/tts/decoder-audio's decoder) — the text agent
// never invokes it; decoder-audio's eagerly-imported constants.js needs no
// ffmpeg (verified). Override with MIND_DROP_PACKAGES.
const DROP_PACKAGES = (process.env.MIND_DROP_PACKAGES ?? 'bare-ffmpeg')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const here = dirname(fileURLToPath(import.meta.url))
const srcTauri = resolve(here, '..')
const out = join(srcTauri, 'resources', 'mind')

const isWin = process.platform === 'win32'

// On Windows npm is `npm.cmd`; execFile (no shell) can't resolve the .cmd
// extension (ENOENT) and Node 24's CVE-2024-27980 hardening refuses to spawn a
// .cmd/.bat without a shell (EINVAL). So on Windows we run npm.cmd through a
// shell. curl/tar are .exe and run shell-less as before.
const NPM = isWin ? 'npm.cmd' : 'npm'

// Under Git Bash, MSYS GNU tar shadows the System32 bsdtar on PATH — but GNU
// tar can't extract .zip (the Windows Node archive) and reads a `C:` drive
// prefix as a remote `host:path`. Point at System32's bsdtar (libarchive),
// which handles .zip and drive paths. On mac/linux plain `tar` is correct.
const TAR = isWin
  ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
  : 'tar'

// execFile — args are passed as an array, so nothing is interpolated into a
// command string. `shell` is opt-in (Windows .cmd only); every arg this script
// passes is a static constant (no untrusted input), so it stays safe even then.
const run = (cmd, args, cwd, { shell = false } = {}) => {
  console.log(`$ ${cmd} ${args.join(' ')}${cwd ? `   (in ${cwd})` : ''}`)
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell })
}

function reset() {
  const placeholder = existsSync(join(out, '.gitkeep'))
    ? readFileSync(join(out, '.gitkeep'), 'utf8')
    : ''
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  // Restore the tracked placeholder so the dir survives in git — Tauri's
  // build-time resource check needs resources/mind to exist in dev/CI.
  writeFileSync(join(out, '.gitkeep'), placeholder)
}

// npm matches --os against packages' `"os"` fields, which use Node's
// process.platform values — on Windows that's `win32`, NOT the `win` shorthand
// the tarball/Node-dist naming uses. Passing --os=win makes npm silently skip
// every win32-gated optional dep (bare-runtime-win32-x64 → "Could not load the
// Bare runtime binary" at model load), so normalize it here.
const npmOs = process.env.NPM_OS === 'win' ? 'win32' : process.env.NPM_OS
const npmCpu = process.env.NPM_CPU

// Install npm `deps` into `<out>/<name>` as a self-contained, prod-only tree.
// npm's default hoisted layout puts each dep's own files at
// `<name>/node_modules/<pkg>/…`, which is what main.rs probes for.
function installFromNpm(name, deps) {
  const dir = join(out, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name: `kaleido-bundle-${name}`,
        version: '0.0.0',
        private: true,
        dependencies: deps,
      },
      null,
      2
    ) + '\n'
  )
  // NPM_OS / NPM_CPU force npm to fetch the TARGET platform's prebuilt native
  // packages (e.g. the macOS runner is arm64 but also builds the x64 target).
  const npmArgs = ['install', '--omit=dev', '--no-audit', '--no-fund']
  if (npmOs) npmArgs.push(`--os=${npmOs}`)
  if (npmCpu) npmArgs.push(`--cpu=${npmCpu}`)
  run(NPM, npmArgs, dir, { shell: isWin })
}

// os/cpu-split optional deps fail SILENTLY when the platform filter mismatches
// (that's how the win32 Bare runtime went missing). For each such runtime the
// tree relies on, require the platform package outright — a loud build failure
// beats shipping a bundle that aborts at model load on users' machines.
function assertPlatformRuntimes(name) {
  const nm = join(out, name, 'node_modules')
  const os = npmOs ?? process.platform
  const cpu = npmCpu ?? process.arch
  for (const runtime of ['bare-runtime']) {
    if (!existsSync(join(nm, runtime))) continue // not in this tree at all
    const plat = join(nm, `${runtime}-${os}-${cpu}`)
    if (!existsSync(plat)) {
      throw new Error(
        `${name}: ${runtime} is installed but its platform package ` +
          `${runtime}-${os}-${cpu} is missing from node_modules — npm's ` +
          `--os/--cpu filter likely skipped it; the bundle would crash at runtime`
      )
    }
  }
}

// Delete the unused @qvac engines (DROP_ENGINES) and unused top-level native
// packages (DROP_PACKAGES) from an installed tree — ~4 GB the agent never loads.
function pruneEngines(name) {
  const nm = join(out, name, 'node_modules')
  if (!existsSync(nm)) return
  const qvac = join(nm, '@qvac')
  // 0.21 engines also ship per-platform native packages (`<engine>-<os>-<cpu>`).
  const installed = existsSync(qvac) ? readdirSync(qvac) : []
  for (const eng of DROP_ENGINES) {
    for (const dir of installed.filter(
      (d) => d === eng || d.startsWith(`${eng}-`)
    )) {
      rmSync(join(qvac, dir), { recursive: true, force: true })
      console.log(`  pruned @qvac/${dir}`)
    }
  }
  for (const pkg of DROP_PACKAGES) {
    const p = join(nm, pkg)
    if (existsSync(p)) {
      rmSync(p, { recursive: true, force: true })
      console.log(`  pruned ${pkg}`)
    }
  }
}

// @qvac/sdk's default Bare worker (dist/src/worker/index.js) statically imports
// ALL engine plugins from @qvac/inference, so it crashes (MODULE_NOT_FOUND →
// "worker failed to start / RPC timeout") once we prune engines. Replace it with
// a slim worker that registers ONLY the llamacpp-completion (LLM) plugin, via
// its own @qvac/inference subpath export rather than the full plugin set.
const SLIM_WORKER_SRC = `/**
 * Slim worker entry — registers ONLY the llamacpp-completion (LLM) plugin.
 * Generated by desktop-app/src-tauri/scripts/prepare-mind-bundle.mjs to match
 * the pruned engine set. Do not edit in place; re-run the bundle script.
 */
import { initializeWorker, ensureRPCSetup } from "./lifecycle.js";
import { getServerLogger } from "../logging/index.js";
import { registerPlugins } from "@qvac/inference/plugins";
import { llmPlugin } from "@qvac/inference/llamacpp-completion/plugin";
const { hasRPCConfig } = initializeWorker();
const logger = getServerLogger();
logger.info("🐻 Hello from Bare (slim LLM worker)");
registerPlugins([llmPlugin]);
if (hasRPCConfig) {
  ensureRPCSetup();
} else {
  logger.info("Running in direct mode - RPC setup will be lazy");
}
`

function writeSlimWorker(name) {
  const nm = join(out, name, 'node_modules')
  const workerDir = join(nm, '@qvac', 'sdk', 'dist', 'src', 'worker')
  const workerPath = join(workerDir, 'index.js')
  const required = [
    workerPath,
    join(workerDir, 'lifecycle.js'),
    join(nm, '@qvac', 'sdk', 'dist', 'src', 'logging', 'index.js'),
    join(nm, '@qvac', 'inference', 'dist', 'plugins', 'index.js'),
    join(
      nm,
      '@qvac',
      'inference',
      'dist',
      'plugins',
      'builtin',
      'llamacpp-completion',
      'plugin.js'
    ),
    join(nm, '@qvac', 'llm-llamacpp'),
  ]
  // Fail loudly if the SDK layout changed — better a broken build than shipping
  // a worker that crashes at model load on users' machines.
  const missing = required.filter((p) => !existsSync(p))
  if (missing.length) {
    throw new Error(
      `slim worker: @qvac/sdk layout changed, missing:\n  ${missing.join('\n  ')}\n— update prepare-mind-bundle.mjs`
    )
  }
  writeFileSync(workerPath, SLIM_WORKER_SRC)
  console.log('  wrote slim LLM-only worker (dist/src/worker/index.js)')
}

// Node runtime for the target platform (host by default).
function fetchNode() {
  const platMap = { darwin: 'darwin', linux: 'linux', win32: 'win' }
  const archMap = { x64: 'x64', arm64: 'arm64' }
  const platform = process.env.TARGET_PLATFORM ?? platMap[process.platform]
  const arch = process.env.TARGET_ARCH ?? archMap[process.arch]
  if (!platform || !arch)
    throw new Error(`unsupported target ${process.platform}/${process.arch}`)

  const isWin = platform === 'win'
  const ext = isWin ? 'zip' : 'tar.gz'
  const base = `node-v${NODE_VERSION}-${platform}-${arch}`
  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${base}.${ext}`
  const work = join(tmpdir(), `kaleido-node-${process.pid}`)
  mkdirSync(work, { recursive: true })
  const archive = join(work, `${base}.${ext}`)

  run('curl', ['-fSL', url, '-o', archive])
  // bsdtar (mac/linux/win10+) extracts both .tar.gz and .zip.
  run(TAR, ['-xf', archive, '-C', work])

  const binSrc = isWin
    ? join(work, base, 'node.exe')
    : join(work, base, 'bin', 'node')
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
  '@kaleidorg/mind': MIND_VERSION,
  '@qvac/sdk': QVAC_VERSION,
})
assertPlatformRuntimes('provider')
pruneEngines('provider')
// After pruning engines, the default worker would crash importing them — swap in
// a worker that registers only the LLM plugin we kept.
if (DROP_ENGINES.length) writeSlimWorker('provider')
installFromNpm('mcp', { 'kaleido-mcp': MCP_VERSION })
fetchNode()
console.log('\nDone. Verify size:  du -sh src-tauri/resources/mind')
console.log(
  'Then `tauri build` and confirm the agent runs in the packaged app.'
)
