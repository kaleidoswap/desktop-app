import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { toast } from 'react-toastify'

import {
  ORDER_CHANNEL_PATH,
  TRADE_MARKET_MAKER_PATH,
} from '../../../app/router/paths'
import { SwapButton } from '../../../components/Trade/SwapButton'
import { channelOrderPrefill } from '../../trade/market-maker/channelUtils'
import { Component as OrderChannel } from '..'

const api = vi.hoisted(() => {
  const query = (data: unknown) =>
    vi.fn(() =>
      Object.assign(Promise.resolve({ data }), {
        unwrap: () => Promise.resolve(data),
      })
    )
  const info = query({
    assets: [
      {
        asset_id: 'asset',
        max_channel_amount: 200000,
        min_channel_amount: 100,
        name: 'Test USD',
        precision: 2,
        ticker: 'USDT',
      },
    ],
    lsp_connection_url: 'maker@localhost:9735',
    options: {},
  })
  return {
    address: query({}),
    createOrder: vi.fn(),
    info,
    network: query({ network: 'Signet' }),
    node: query({}),
    peers: query({ peers: [{ pubkey: 'maker' }] }),
    quote: vi.fn(
      ({ to_asset }: { to_asset: { amount: number; asset_id: string } }) =>
        Promise.resolve({
          data: {
            from_asset: { amount: 123 },
            rfq_id: String(to_asset.amount),
            to_asset,
          },
        })
    ),
    unused: vi.fn(),
  }
})
vi.mock('../../../app/store/hooks', () => ({
  useAppDispatch: () => api.unused,
  useAppSelector: () => ({ default_maker_url: 'https://maker.test' }),
}))
vi.mock('../../../slices/makerApi/makerApi.slice', () => ({
  makerApi: {
    endpoints: {
      create_order: { useLazyQuery: () => [api.createOrder, {}] },
      estimate_fees: { useLazyQuery: () => [api.unused] },
      getQuote: { useLazyQuery: () => [api.quote] },
      get_info: { useLazyQuery: () => [api.info] },
      get_order: { useLazyQuery: () => [api.unused] },
    },
  },
}))
vi.mock('../../../slices/nodeApi/nodeApi.slice', () => ({
  nodeApi: {
    endpoints: {
      address: { useLazyQuery: () => [api.address] },
      connectPeer: { useMutation: () => [api.unused] },
      listPeers: { useLazyQuery: () => [api.peers] },
      networkInfo: { useLazyQuery: () => [api.network] },
      nodeInfo: { useLazyQuery: () => [api.node] },
    },
  },
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// Exercise the trade button, production route state and full order wizard with a connected LSP.
function FirstTrade() {
  const navigate = useNavigate()
  const state = channelOrderPrefill(
    {
      from: '900',
      fromAsset: 'BTC',
      rfq_id: 'first',
      to: '1,234.50',
      toAsset: 'USDT',
    },
    null,
    [],
    { base_asset_id: 'BTC', quote_asset_id: 'asset' }
  )
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        navigate(ORDER_CHANNEL_PATH, { state })
      }}
    >
      <SwapButton
        errorMessage={null}
        hasChannels={false}
        hasTradablePairs
        hasValidQuote
        isPriceLoading={false}
        isSwapInProgress={false}
        isToAmountLoading={false}
        missingChannelAsset={{
          asset: 'USDT',
          assetId: 'asset',
          isFromAsset: false,
        }}
        wsConnected
      />
    </form>
  )
}

describe('the first RGB channel from a trade', () => {
  it('keeps the allocation editable and requotes the displayed outgoing amount', async () => {
    const onError = vi.spyOn(toast, 'error')
    render(
      <MemoryRouter initialEntries={[TRADE_MARKET_MAKER_PATH]}>
        <Routes>
          <Route element={<FirstTrade />} path={TRADE_MARKET_MAKER_PATH} />
          <Route element={<OrderChannel />} path={ORDER_CHANNEL_PATH} />
        </Routes>
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button'))
    await screen.findByText('asset', {}, { timeout: 8000 })
    expect(screen.getByText('765.5 USDT')).toBeVisible()
    await waitFor(
      () =>
        expect(api.quote).toHaveBeenCalledWith(
          expect.objectContaining({
            to_asset: expect.objectContaining({ amount: 123450 }),
          })
        ),
      { timeout: 2000 }
    )
    await screen.findByText('Current Price Quote')
    const slider = screen.getAllByRole('slider')[1]
    const outgoing = screen
      .getAllByRole('spinbutton')
      .find((input) => (input as HTMLInputElement).value === '1234.5')!
    expect(outgoing).toBeVisible()
    fireEvent.change(outgoing, { target: { value: '1500' } })
    expect(screen.queryByText('Current Price Quote')).not.toBeInTheDocument()
    expect(slider).toHaveValue('1500')
    expect(screen.getByText('500 USDT')).toBeVisible()
    fireEvent.change(slider, { target: { value: '1600' } })
    expect(outgoing).toHaveValue(1600)
    expect(screen.getByText('400 USDT')).toBeVisible()

    // The previous RFQ must never create an order for the old amount.
    fireEvent.click(
      screen.getByRole('button', { name: 'orderChannel.step2.nextButton' })
    )
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        'orderChannel.toasts.waitForQuote',
        expect.any(Object)
      )
    )
    expect(api.createOrder).not.toHaveBeenCalled()
    fireEvent.change(screen.getByDisplayValue('2000'), {
      target: { value: '700' },
    })
    expect(outgoing).toHaveValue(700)
    expect(slider).toHaveValue('700')
    expect(screen.getByText('0 USDT', { selector: 'div.mt-1' })).toBeVisible()
    await waitFor(
      () =>
        expect(api.quote).toHaveBeenLastCalledWith(
          expect.objectContaining({
            to_asset: expect.objectContaining({ amount: 70000 }),
          })
        ),
      { timeout: 2000 }
    )
    expect(api.createOrder).not.toHaveBeenCalled()
  }, 15000)
})
