import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Tier } from '../../hooks/useTierList'
import { useList, type UseListConfig } from '../../hooks/useList'
import { PageHeader } from './PageHeader'
import { CardButton } from './Card'
import { TierToggle } from './TierToggle'
import { FilterPills } from './FilterPills'
import { SortMenu } from './SortMenu'
import { ListStates, LoadMore } from './ListStates'

type ListScreenProps<T> = UseListConfig<T> & {
  /** Screen heading. */
  title: string
  /** Subtitle per tier — an object, or a function of the current tier. */
  subtitle: { me: string; team: string } | ((tier: Tier) => string)
  /** Route the rows link into, e.g. '/projects' -> '/projects/<id>'. */
  basePath: string
  /** Stable id for a row (React key + detail route + prev/next nav). */
  getId: (item: T) => string
  /** Row body inside the tappable card. */
  renderRow: (item: T) => ReactNode
  /** Empty-state copy — a string, or a function of the active filter. */
  emptyMessage: string | ((filter: string) => string)
}

/**
 * A complete list screen: header + My/Company toggle + filter/sort pills +
 * loading/empty/error states + tappable rows + infinite scroll. Give it a
 * table, columns, pills, sorts, and a row renderer — the whole "one SDK call ->
 * one screen" flow is handled. See ProjectsPage/QuotesPage/SitesPage for how
 * little a real page needs.
 *
 * Rows deep-link to `${basePath}/${getId(item)}` and hand the detail view the
 * sibling `ids` (for prev/next), the `from` URL (for back), and the `tier`.
 */
export function ListScreen<T>(props: ListScreenProps<T>) {
  const { title, subtitle, basePath, getId, renderRow, emptyMessage, ...config } = props
  const list = useList<T>(config)
  const navigate = useNavigate()
  const location = useLocation()

  const ids = list.items.map(getId)
  const sub = typeof subtitle === 'function' ? subtitle(list.tier) : subtitle[list.tier]
  const empty = typeof emptyMessage === 'function' ? emptyMessage(list.filter) : emptyMessage

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={sub}
        actions={<TierToggle tier={list.tier} onChange={list.setTier} />}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <FilterPills
          options={list.pills.map((p) => ({ key: p.key, label: p.label }))}
          value={list.filter}
          onChange={list.setFilter}
          disabledKeys={list.disabledKeys}
        />
        <SortMenu options={config.sorts} value={list.activeSort.key} onChange={list.setSort} />
      </div>

      <ListStates
        loading={list.loading}
        error={list.error}
        isEmpty={list.items.length === 0}
        emptyMessage={empty}
      >
        <div className="space-y-3 rc-land-list">
          {list.items.map((item) => (
            <CardButton
              key={getId(item)}
              onClick={() =>
                navigate(`${basePath}/${getId(item)}`, {
                  state: { ids, from: location.pathname + location.search, tier: list.tier },
                })
              }
            >
              {renderRow(item)}
            </CardButton>
          ))}
        </div>
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </ListStates>
    </div>
  )
}
