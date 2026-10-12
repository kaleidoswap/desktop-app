import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { UseMindResult } from '../../../hooks/useMind'
import { ModelsManager } from '../models'

const model = (id: string) => ({
  displayName: id,
  family: 'qwen',
  hfFile: `${id}.gguf`,
  hfRepo: `owner/${id}`,
  id,
  quant: 'Q4',
  ramHintGb: 4,
  sizeBytes: 2 * 1024 ** 3,
})

function renderModels(overrides: Record<string, unknown> = {}) {
  const mind = {
    catalog: [model('a'), model('b')],
    catalogError: null,
    catalogLoading: false,
    deleteModel: vi.fn().mockResolvedValue(undefined),
    downloads: {},
    hardware: null,
    installed: [model('a'), model('b')],
    loading: null,
    refresh: vi.fn(),
    startProvider: vi.fn().mockResolvedValue(undefined),
    starting: false,
    status: { on: false },
    stopProvider: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as UseMindResult
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={{ chat: {}, mind }} />}>
          <Route element={<ModelsManager />} index />
        </Route>
      </Routes>
    </MemoryRouter>
  )
  return mind
}

describe('ModelsManager start/stop', () => {
  it('starts a model', async () => {
    const mind = renderModels()
    fireEvent.click(screen.getAllByRole('button', { name: /Start/ })[0])
    await waitFor(() => expect(mind.startProvider).toHaveBeenCalledWith('a'))
    expect(mind.stopProvider).not.toHaveBeenCalled()
  })

  it('shows the failure when a start is rejected', async () => {
    renderModels({
      startProvider: vi.fn().mockRejectedValue(new Error('model failed')),
    })
    fireEvent.click(screen.getAllByRole('button', { name: /Start/ })[0])
    expect(await screen.findByRole('alert')).toHaveTextContent('model failed')
  })

  it('stops the running model', async () => {
    const mind = renderModels({
      status: { activeModelId: 'a', on: true },
    })
    fireEvent.click(screen.getByRole('button', { name: /Stop/ }))
    await waitFor(() => expect(mind.stopProvider).toHaveBeenCalledOnce())
  })

  it('switches models by stopping the running one first', async () => {
    const calls: string[] = []
    const mind = renderModels({
      startProvider: vi.fn(async () => void calls.push('start')),
      status: { activeModelId: 'a', on: true },
      stopProvider: vi.fn(async () => void calls.push('stop')),
    })
    fireEvent.click(screen.getByRole('button', { name: /Switch/ }))
    await waitFor(() => expect(mind.startProvider).toHaveBeenCalledWith('b'))
    expect(calls).toEqual(['stop', 'start'])
  })
})
