import type { DataverseClient } from '@truenorth-it/dataverse-client'

/** Where a detail record was resolved: the caller's own row, or the company's. */
export interface Detail<T> {
  record: T
  /** True when the record resolved at the `me` tier (the caller's own). */
  mine: boolean
}

/**
 * Fetch one record for a detail view, resolving which access tier it lives at.
 *
 * A record may be the caller's own (`me`) or belong to their company (`team`).
 * When the list already knows which tier it showed, pass `preferTier` to fetch
 * straight from it — no failed probe, no 404 noise. Without a hint (a deep link
 * or refresh) we try `defaultTier`, then fall back to the other tier.
 *
 * `defaultTier` is the only thing that differs per resource: cases/quotes are
 * personal, so they try `me` first; sites/projects are company-level, so they
 * try `team` first. Declaring it here keeps that decision in one place instead
 * of hand-copying the try/catch (with its easy-to-flip order) into every
 * service.
 */
export async function fetchDetail<T>(
  client: DataverseClient,
  table: string,
  id: string,
  select: string[],
  opts: { defaultTier: 'me' | 'team'; preferTier?: 'me' | 'team' },
): Promise<Detail<T>> {
  const get = async (tier: 'me' | 'team'): Promise<Detail<T>> => {
    const res = await client[tier].get<T>(table, id, { select })
    return { record: res.data, mine: tier === 'me' }
  }
  if (opts.preferTier) return get(opts.preferTier)
  try {
    return await get(opts.defaultTier)
  } catch {
    return await get(opts.defaultTier === 'me' ? 'team' : 'me')
  }
}
