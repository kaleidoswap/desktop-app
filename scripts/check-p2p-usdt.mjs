// Read-only interoperability smoke: published contract IDs and proxy wire version.
// Run with Node 22: node scripts/check-p2p-usdt.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const listings = JSON.parse(
  await readFile(
    new URL('../src/constants/rgb-asset-listings.json', import.meta.url),
    'utf8'
  )
)
const usdt = (chain) =>
  listings[chain].find((asset) => asset.ticker === 'USDT').asset_id
async function json(url, options = {}) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    ...options,
  })
  assert.ok(response.ok, `${url} returned HTTP ${response.status}`)
  return response.json()
}

const [faucet, signer, maintainer, proxy] = await Promise.all([
  json('https://faucet.mutinynet.kaleidoswap.com/api/info'),
  json(
    'https://github.com/UTEXO-Protocol/enclave-signer/releases/download/prod-mainnet-v0.1.0/release-manifest.json'
  ),
  json(
    'https://api.github.com/repos/UTEXO-Protocol/rgb-lib-wasm/issues/comments/7102964005'
  ),
  json('https://proxy-v1.kaleidoswap.com/json-rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'server.info',
      params: {},
    }),
  }),
])
assert.equal(faucet.network, 'SignetCustom')
const testAsset = faucet.assets.find((a) => a.asset_id === usdt('SignetCustom'))
assert.deepEqual(
  [testAsset?.rail, testAsset?.schema, testAsset?.precision],
  ['onchain', 'BFA', 6]
)
assert.ok(maintainer.body.includes(usdt('Signet')))
assert.equal(signer.bitcoin_network, 'bitcoin')
assert.equal(signer.evm_chain_id, 42161)
assert.equal(signer.roles.mint.rgb_asset_id, usdt('Mainnet'))
assert.equal(signer.roles.burn.rgb_asset_id, usdt('Mainnet'))
assert.equal(proxy.result?.protocol_version, '1.0')
console.log(
  'USDT contracts match on Mutinynet, Signet and Mainnet. The RGB proxy reports protocol 1.0.'
)
