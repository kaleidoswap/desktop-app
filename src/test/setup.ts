import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation((query) => ({
    // deprecated
addEventListener: vi.fn(),
    
addListener: vi.fn(),
    
dispatchEvent: vi.fn(),
    
matches: false, 
    
media: query, 
    
onchange: null,
    
removeEventListener: vi.fn(),
    // deprecated
removeListener: vi.fn(),
  })),
  writable: true,
})

// Mock Tauri API
vi.mock('@tauri-apps/api', () => ({
  event: {
    emit: vi.fn(),
    listen: vi.fn(),
    once: vi.fn(),
  },
  invoke: vi.fn(),
}))

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: vi.fn(),
  confirm: vi.fn(),
  message: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  readDir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  readText: vi.fn(),
  writeText: vi.fn(),
}))
