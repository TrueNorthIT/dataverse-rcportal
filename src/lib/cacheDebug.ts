import { useSyncExternalStore } from 'react'

/**
 * Lightweight API-call observer feeding the per-tile cache debug badges
 * (see components/debug/CacheBadge). Wraps `window.fetch` once at bootstrap
 * and records every call to the API origin: path, status, the server
 * response-cache result (X-Cache header), and timing.
 *
 * Recording is always on (a few KB, nothing leaves the browser); *rendering*
 * is gated to the debug user by CacheBadge. When the SDK's `onResponse` hook
 * ships (@truenorth-it/dataverse-client >= 1.10.0) this wrapper can be
 * replaced by passing `recordCall` to `createClient` — the store and hooks
 * below stay identical.
 */

export interface ApiCall {
  /** Pathname + query string, e.g. "/api/v2/rc/team/aggregate/case?aggregate=count". */
  url: string
  method: string
  /** HTTP status; 0 when the fetch itself failed (network error). */
  status: number
  /** Server response-cache result, or null when the cache is off / header absent. */
  cache: 'HIT' | 'MISS' | null
  durationMs: number
  receivedAt: number
}

const MAX_CALLS = 300

const calls: ApiCall[] = []
const listeners = new Set<() => void>()
let version = 0

export function recordCall(call: ApiCall): void {
  calls.push(call)
  if (calls.length > MAX_CALLS) calls.splice(0, calls.length - MAX_CALLS)
  version++
  for (const l of listeners) l()
}

let installed = false

/** Wrap window.fetch to record calls to `apiOrigin`. Idempotent. */
export function installCacheDebug(apiOrigin: string): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const urlStr =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!urlStr.startsWith(apiOrigin)) return realFetch(input, init)

    const started = performance.now()
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
    const u = new URL(urlStr)
    try {
      const res = await realFetch(input, init)
      const xCache = res.headers.get('x-cache')
      recordCall({
        url: u.pathname + u.search,
        method,
        status: res.status,
        cache: xCache === 'HIT' || xCache === 'MISS' ? xCache : null,
        durationMs: Math.round(performance.now() - started),
        receivedAt: Date.now(),
      })
      return res
    } catch (err) {
      recordCall({
        url: u.pathname + u.search,
        method,
        status: 0,
        cache: null,
        durationMs: Math.round(performance.now() - started),
        receivedAt: Date.now(),
      })
      throw err
    }
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export interface ApiDebugStats {
  /** Most recent matching call, if any. */
  last: ApiCall | undefined
  /** Matching calls seen this session. */
  count: number
  hits: number
  misses: number
}

/**
 * Live stats for the calls matching `match` (a substring of the URL, or a
 * predicate over it). Re-renders whenever any API call is recorded.
 */
export function useApiDebug(match: string | ((url: string) => boolean)): ApiDebugStats {
  useSyncExternalStore(subscribe, () => version, () => version)
  const test = typeof match === 'string' ? (u: string) => u.includes(match) : match
  let last: ApiCall | undefined
  let count = 0
  let hits = 0
  let misses = 0
  for (const call of calls) {
    if (!test(call.url)) continue
    count++
    if (call.cache === 'HIT') hits++
    if (call.cache === 'MISS') misses++
    last = call // calls[] is append-ordered, so the final match is the latest
  }
  return { last, count, hits, misses }
}

/** Tests only — reset recorded calls (the fetch wrapper stays installed). */
export function _resetCacheDebug(): void {
  calls.length = 0
  version++
  for (const l of listeners) l()
}
