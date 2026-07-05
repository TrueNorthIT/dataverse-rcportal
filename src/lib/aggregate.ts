import type { AggregateOptions, DataverseClient } from '@truenorth-it/dataverse-client'

type Tier = 'me' | 'team'

/** Pull the first numeric value out of an aggregate row, whatever it's keyed as. */
export function firstNumber(row: Record<string, unknown> | undefined): number | null {
  if (!row) return null
  const n = Object.values(row).find((v) => typeof v === 'number')
  return typeof n === 'number' ? n : null
}

/**
 * Count rows across one or more company-scoped clients and sum the result. Each
 * client is authenticated + security-trimmed to its own company, so summing
 * composes an all-companies roll-up without any special server support. Pass a
 * single client for the normal (one-company) case. Returns null only if every
 * client errored, so a flaky company doesn't blank the whole tile.
 */
export async function fanCount(
  clients: DataverseClient[],
  tier: Tier,
  table: string,
  options: AggregateOptions,
): Promise<number | null> {
  const results = await Promise.all(
    clients.map((c) =>
      c[tier]
        .aggregate(table, options)
        .then((r) => firstNumber(r.data[0] as Record<string, unknown> | undefined))
        .catch(() => null),
    ),
  )
  const nums = results.filter((n): n is number => typeof n === 'number')
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null
}
