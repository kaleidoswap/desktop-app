import { describe, expect, it } from 'vitest'

import {
  checkForm,
  emptyForm,
  issueRequest,
  splitSupply,
  tickerOk,
  type IssueForm,
} from '../issue'

const form = (f: Partial<IssueForm>): IssueForm => ({
  ...emptyForm(f.kind ?? 'NIA'),
  name: 'Demo Dollar',
  supply: '1000',
  ticker: 'USDX',
  ...f,
})

describe('issuance', () => {
  it('splits the supply into coins, remainder on the first', () => {
    expect(splitSupply(1000, 3)).toEqual([334, 333, 333])
    expect(splitSupply(2, 5)).toEqual([2])
    expect(splitSupply(100, 99)).toHaveLength(20)
  })

  it('takes only RGB-style tickers', () => {
    expect(tickerOk('USDX')).toBe(true)
    expect(tickerOk('A1')).toBe(true)
    for (const bad of ['', 'usd', '1USD', 'TOOLONGXX', 'US D']) {
      expect(tickerOk(bad)).toBe(false)
    }
  })

  it('says what is missing before anything is issued', () => {
    expect(checkForm(form({ ticker: '' }))).toBe('ticker')
    expect(checkForm(form({ name: ' ' }))).toBe('name')
    expect(checkForm(form({ supply: '0' }))).toBe('supply')
    expect(checkForm(form({ precision: 8, supply: '99999999999' }))).toBe(
      'too_big'
    )
    expect(checkForm(form({ kind: 'UDA', mediaPath: null }))).toBe('media')
    expect(checkForm(form({}))).toBeNull()
  })

  it('a collectible needs no ticker, an inflatable token caps what can be minted later', () => {
    expect(checkForm(form({ kind: 'CFA', ticker: '' }))).toBeNull()
    const ifa = issueRequest(form({ inflation: '500', kind: 'IFA', parts: 2 }))
    expect(ifa.path).toBe('/api/rln/issueassetifa')
    expect(ifa.body).toMatchObject({
      amounts: [50000, 50000],
      inflation_amounts: [50000],
      precision: 2,
      ticker: 'USDX',
    })
  })

  it('builds the request for each kind', () => {
    expect(issueRequest(form({ parts: 1 }))).toEqual({
      body: {
        amounts: [100000],
        name: 'Demo Dollar',
        precision: 2,
        ticker: 'USDX',
      },
      path: '/api/rln/issueassetnia',
    })
    const cfa = issueRequest(
      form({
        details: 'A picture',
        kind: 'CFA',
        mediaPath: '/tmp/a.png',
        parts: 1,
      })
    )
    expect(cfa).toEqual({
      body: {
        amounts: [100000],
        details: 'A picture',
        file_path: '/tmp/a.png',
        name: 'Demo Dollar',
        precision: 2,
      },
      path: '/api/rln/issueassetcfa',
    })
    const uda = issueRequest(form({ kind: 'UDA', mediaPath: '/tmp/a.png' }))
    expect(uda.path).toBe('/api/rln/issueassetuda')
    expect(uda.body).toMatchObject({
      media_file_path: '/tmp/a.png',
      precision: 0,
    })
  })
})
