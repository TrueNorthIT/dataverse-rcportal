import type { FilterCondition } from '@truenorth-it/dataverse-client'

/**
 * A filter pill: a labelled key with an optional server-side filter.
 *
 * The `key` doubles as the list page's `?f=` query value, so the dashboard
 * charts, the list filter pills, and the filtered list all stay in lock-step —
 * a chart segment links to `/<area>?f=<key>` and lands on exactly that slice.
 * The `all` pill carries no filter (never counted / never filters).
 */
export interface Pill {
  key: string
  label: string
  filter?: FilterCondition | FilterCondition[]
}
