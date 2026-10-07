import { describe, expect, it } from 'vitest'

import { ALL_METHODS, PRESETS, capabilitiesOf } from '../permissions'

const spending = ALL_METHODS.filter((m) => m.capability === 'spend').map(
  (m) => m.id
)

describe('NWC permission presets', () => {
  it('view only never includes receive or spend methods', () => {
    const caps = capabilitiesOf(PRESETS.view)
    expect(caps).toEqual({ receive: false, spend: false, view: true })
  })

  it('view & receive can create invoices but not spend', () => {
    expect(PRESETS.receive).toContain('make_invoice')
    expect(PRESETS.receive.some((m) => spending.includes(m))).toBe(false)
  })

  it('full wallet keeps the previous default (everything but keysend)', () => {
    expect(PRESETS.full).toContain('pay_invoice')
    expect(PRESETS.full).toContain('rln_send_asset')
    expect(PRESETS.full).not.toContain('pay_keysend')
    expect(PRESETS.full).toHaveLength(ALL_METHODS.length - 1)
  })

  it('ignores unknown method ids', () => {
    expect(capabilitiesOf(['made_up'])).toEqual({
      receive: false,
      spend: false,
      view: false,
    })
  })
})
