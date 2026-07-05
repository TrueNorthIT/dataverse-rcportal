/**
 * Shared chrome for the read-only detail pages (quote / project / site /
 * colleague). Mirrors the case-detail look — gradient-topped card, meta grid,
 * back link + prev/next stepper — with light iconography for a bit of funk.
 */
import { Card } from '../common/Card'
import { Icon } from '../common/Icon'
import type { IconName } from '../common/Icon'

/** Back link + optional prev/next stepper, sat on the header gradient. */
export function DetailNav({
  label,
  prevId,
  nextId,
  onPrev,
  onNext,
  onBack,
}: {
  label: string
  prevId?: string
  nextId?: string
  onPrev: () => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium text-white/90 hover:underline"
      >
        <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
        {label}
      </button>
      {(prevId || nextId) && (
        <div className="flex items-center gap-2">
          <NavArrow label="Previous" dir="prev" disabled={!prevId} onClick={onPrev} />
          <NavArrow label="Next" dir="next" disabled={!nextId} onClick={onNext} />
        </div>
      )}
    </div>
  )
}

function NavArrow({
  label,
  dir,
  disabled,
  onClick,
}: {
  label: string
  dir: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={
        'flex h-8 w-8 items-center justify-center rounded-lg border text-white transition-colors ' +
        (disabled ? 'cursor-not-allowed border-white/15 text-white/30' : 'border-white/30 hover:bg-white/10')
      }
    >
      <Icon name="chevronRight" className={`h-[18px] w-[18px] ${dir === 'prev' ? 'rotate-180' : ''}`} />
    </button>
  )
}

/** Gradient-topped detail card header: area glyph, title, optional trailing node. */
export function DetailHeader({
  icon,
  title,
  trailing,
  children,
}: {
  icon: IconName
  title: string
  trailing?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div className="rc-gradient h-1 w-full" />
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rc-blue-light text-rc-blue">
              <Icon name={icon} className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-normal tracking-tight text-rc-navy">{title}</h1>
          </div>
          {trailing}
        </div>
        {children}
      </div>
    </Card>
  )
}

/** Responsive grid of labelled meta values. */
export function MetaGrid({ children }: { children: React.ReactNode }) {
  return <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">{children}</dl>
}

/** A single icon + label + value meta cell. Hidden when value is empty. */
export function MetaItem({
  icon,
  label,
  value,
}: {
  icon: IconName
  label: string
  value?: string | number | null
}) {
  const text = value === 0 ? '0' : value
  if (text === null || text === undefined || text === '') return null
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-rc-teal">
        <Icon name={icon} className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-rc-navy">{text}</dd>
    </div>
  )
}

/** Section heading for a sub-list, with an icon and optional count. */
export function SectionTitle({
  icon,
  children,
  count,
}: {
  icon: IconName
  children: React.ReactNode
  count?: number
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-xl font-light tracking-tight text-white">
      <Icon name={icon} className="h-5 w-5" />
      {children}
      {count !== undefined && <span className="text-base text-white/70">({count})</span>}
    </h2>
  )
}

/**
 * Loading / error / content for a detail page — the detail-page sibling of
 * `<ListStates>`. Shows a skeleton while the record loads, the error message on
 * failure, otherwise the resolved content. Keeps the same triad out of every
 * detail page.
 */
export function DetailStates({
  loading,
  error,
  skeleton,
  children,
}: {
  loading: boolean
  error: string | null
  /** Placeholder while loading; defaults to <DetailSkeleton>. */
  skeleton?: React.ReactNode
  children: React.ReactNode
}) {
  if (loading) return <>{skeleton ?? <DetailSkeleton />}</>
  if (error) return <p className="text-sm text-red-200">{error}</p>
  return <>{children}</>
}

/** Shimmer placeholder for a detail card while it loads. */
export function DetailSkeleton() {
  return (
    <Card className="overflow-hidden" aria-busy="true" aria-label="Loading">
      <div className="rc-gradient h-1 w-full" />
      <div className="p-6">
        <div className="flex items-start gap-3">
          <div className="rc-skeleton h-10 w-10 rounded-xl" />
          <div className="rc-skeleton h-7 w-1/2 rounded" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ ['--rc-delay' as string]: `${i * 0.08}s` }} className="space-y-1.5">
              <div className="rc-skeleton h-3 w-2/3 rounded" />
              <div className="rc-skeleton h-4 w-4/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
