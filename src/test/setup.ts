import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Unmount React trees between tests so the DOM never leaks across cases.
afterEach(() => {
  cleanup()
})

// jsdom omits a handful of browser APIs the app's scroll/observer hooks and
// charts rely on. Stub them once here so every test has them.

// IntersectionObserver — used by useInView / lazy chart loading.
class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly scrollMargin = ''
  readonly thresholds = []
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

// ResizeObserver — used by recharts' ResponsiveContainer.
class MockResizeObserver implements ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
vi.stubGlobal('ResizeObserver', MockResizeObserver)

// matchMedia — used by responsive/scroll behaviour.
vi.stubGlobal(
  'matchMedia',
  vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
)

// scrollTo — used by ScrollToTop / ScrollManager.
vi.stubGlobal('scrollTo', vi.fn())
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
