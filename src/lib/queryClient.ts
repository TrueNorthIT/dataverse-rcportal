import { QueryClient } from '@tanstack/react-query'

/**
 * Shared React Query client.
 *
 * `refetchOnWindowFocus` + `staleTime: 0` mean data refreshes whenever you come
 * back to the tab — so if a record is edited in Dataverse, switching back to
 * the portal shows the change without a manual reload. `retry: 1` keeps a
 * flaky request from failing on the first blip.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 0,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
})
