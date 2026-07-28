import { describe, expect, it } from 'vitest'

import rustSource from '../../../../src-tauri/src/nwc.rs?raw'
import uiSource from '../index.tsx?raw'

function sourceSection(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start)
  const endAt = source.indexOf(end, startAt + start.length)

  expect(startAt, `missing source marker: ${start}`).toBeGreaterThanOrEqual(0)
  expect(endAt, `missing source marker: ${end}`).toBeGreaterThan(startAt)
  return source.slice(startAt, endAt)
}

function quotedMethods(source: string): string[] {
  return [...source.matchAll(/['"](rln_[a-z_]+|[a-z_]+)['"]/g)].map(
    ([, method]) => method
  )
}

function rlnMethods(source: string): string[] {
  return [
    ...new Set(
      quotedMethods(source).filter((method) => method.startsWith('rln_'))
    ),
  ]
}

const EXPECTED_RLN_METHODS = [
  'rln_node_info',
  'rln_list_assets',
  'rln_asset_balance',
  'rln_rgb_invoice',
  'rln_ln_invoice',
  'rln_decode_rgb_invoice',
  'rln_send_asset',
  'rln_list_channels',
  'rln_get_address',
  'rln_decode_ln_invoice',
  'rln_send_btc',
  'rln_btc_balance',
  'rln_list_transfers',
  'rln_list_transactions',
  'rln_list_payments',
  'rln_list_swaps',
  'rln_invoice_status',
  'rln_get_payment',
  'rln_refresh_transfers',
  'rln_list_unspents',
  'rln_estimate_fee',
].sort()

const EXPECTED_DEFAULT_METHODS = [
  'get_info',
  'get_balance',
  'lookup_invoice',
  'list_transactions',
  'rln_node_info',
  'rln_list_assets',
  'rln_asset_balance',
  'rln_decode_rgb_invoice',
  'rln_list_channels',
  'rln_decode_ln_invoice',
  'rln_btc_balance',
  'rln_list_transfers',
  'rln_list_transactions',
  'rln_list_payments',
  'rln_list_swaps',
  'rln_invoice_status',
  'rln_get_payment',
  'rln_list_unspents',
  'rln_estimate_fee',
].sort()

describe('NWC method contract', () => {
  it('keeps Rust dispatch, advertised methods, and UI selections identical', () => {
    const advertised = rlnMethods(
      sourceSection(
        rustSource,
        'pub const RLN_METHODS',
        '/// How long to poll RLN'
      )
    ).sort()
    const dispatched = rlnMethods(
      sourceSection(
        rustSource,
        'async fn dispatch_rln(',
        '// ---------------------------------------------------------------------------\n// RLN HTTP bridge'
      )
    ).sort()
    const selectable = rlnMethods(
      sourceSection(uiSource, 'const ALL_METHODS', 'const DEFAULT_METHODS')
    ).sort()

    expect(advertised).toEqual(EXPECTED_RLN_METHODS)
    expect(dispatched).toEqual(EXPECTED_RLN_METHODS)
    expect(selectable).toEqual(EXPECTED_RLN_METHODS)
  })

  it('defaults only read permissions and never defaults a spend or write', () => {
    const selectable = quotedMethods(
      sourceSection(uiSource, 'const ALL_METHODS', 'const DEFAULT_METHODS')
    )
    const defaults = quotedMethods(
      sourceSection(uiSource, 'const DEFAULT_METHODS', 'const SATS_PER_BTC')
    ).sort()

    expect(defaults).toEqual(EXPECTED_DEFAULT_METHODS)
    expect(defaults.every((method) => selectable.includes(method))).toBe(true)
    expect(defaults).not.toEqual(
      expect.arrayContaining([
        'make_invoice',
        'pay_invoice',
        'pay_keysend',
        'rln_get_address',
        'rln_rgb_invoice',
        'rln_ln_invoice',
        'rln_send_asset',
        'rln_send_btc',
        'rln_refresh_transfers',
      ])
    )
  })

  it('labels RGB spending as unlimited by the sats budget', () => {
    const sendAssetPermission = sourceSection(
      uiSource,
      "id: 'rln_send_asset'",
      "id: 'rln_list_channels'"
    )

    expect(sendAssetPermission).toContain('unlimitedAsset: true')
    expect(sendAssetPermission).toContain(
      'sats budget does not cap asset quantity'
    )
  })
})
