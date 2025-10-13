import { configureStore, PreloadedState } from '@reduxjs/toolkit'
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'

// Import your store's root reducer
// Adjust this import based on your actual store structure
// import rootReducer, { RootState } from '@/store'

// This type will be properly typed when you add your actual reducers
type RootState = Record<string, unknown>

interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: PreloadedState<RootState>
  store?: ReturnType<typeof configureStore>
  initialRoute?: string
}

/**
 * Custom render function that includes Redux Provider and Router
 * Use this instead of @testing-library/react's render for components that need Redux or routing
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState = {},
    // Automatically create a store instance if no store was passed in
    store = configureStore({
      preloadedState,
      reducer: {
        // Add your reducers here
        // Example: wallet: walletReducer,
      },
    }),
    initialRoute = '/',
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
      </Provider>
    )
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) }
}

/**
 * Simple wrapper for components that only need routing (no Redux)
 */
export function renderWithRouter(
  ui: ReactElement,
  {
    initialRoute = '/',
    ...renderOptions
  }: { initialRoute?: string } & RenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react'
