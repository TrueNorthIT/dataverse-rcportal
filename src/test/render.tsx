import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/** A React Query client tuned for tests: no retries, no caching between tests. */
export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

interface RenderOptions {
  /** Initial URL (may include a query string). Defaults to `/`. */
  route?: string
  /**
   * Route pattern to mount `ui` under, e.g. `/projects/:id`. Set this when the
   * component reads `useParams()` so the params resolve from `route`.
   */
  path?: string
  /**
   * `location.state` for the initial entry — how detail pages receive prev/next
   * `ids`, the `from` back-target, and the resolved `tier`.
   */
  state?: unknown
  /** Reuse a specific query client (e.g. to inspect its cache). */
  queryClient?: QueryClient
}

/** Build a MemoryRouter entry, attaching `location.state` when provided. */
function toEntry(route: string, state: unknown) {
  if (state === undefined) return route
  const [pathname, search] = route.split('?')
  return { pathname, search: search ? `?${search}` : '', state }
}

/**
 * Render a component with the providers every screen needs — a fresh React
 * Query client and a router. Pass `path` + `route` to exercise route params:
 *
 * ```tsx
 * renderWithProviders(<ProjectDetailPage />, {
 *   path: '/projects/:id',
 *   route: '/projects/p1',
 * })
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path, state, queryClient = testQueryClient() }: RenderOptions = {},
) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[toEntry(route, state)]}>
        {path ? (
          <Routes>
            <Route path={path} element={children} />
          </Routes>
        ) : (
          children
        )}
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { ...render(ui, { wrapper: Wrapper }), queryClient }
}

/** Provider wrapper for `renderHook` — React Query + router, no route params. */
export function hookWrapper(queryClient: QueryClient = testQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}
