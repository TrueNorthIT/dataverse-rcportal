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
        className="flex min-w-0 items-center gap-1 text-sm font-medium text-white/90 hover:underline"
      >
        <Icon name="chevronRight" className="h-4 w-4 shrink-0 rotate-180" />
        <span className="truncate">{label}</span>
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
  subtitle,
  trailing,
  children,
}: {
  icon: IconName
  title: string
  /** Optional one-line summary under the title, for a richer header. */
  subtitle?: string
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
            <div className="min-w-0">
              <h1 className="text-2xl font-normal tracking-tight text-rc-navy">{title}</h1>
              {subtitle && <p className="mt-1 text-sm leading-relaxed text-rc-teal">{subtitle}</p>}
            </div>
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
 *
 * A 404 gets special treatment: rather than the raw "Record … does not belong
 * to your team", it renders a friendly, guided state (`<DetailUnavailable>`) —
 * because the usual cause is switching company while viewing a record the new
 * company can't see. Pass `onBack`/`backLabel`/`companyName` to make that state
 * actionable.
 */
export function DetailStates({
  loading,
  error,
  onBack,
  backLabel,
  companyName,
  skeleton,
  children,
}: {
  loading: boolean
  error: string | null
  /** Back-to-list handler — the primary action on the not-available state. */
  onBack?: () => void
  /** Section label for the back action, e.g. "Quotes". */
  backLabel?: string
  /** The company currently in scope, named in the not-available guidance. */
  companyName?: string | null
  /** Placeholder while loading; defaults to <DetailSkeleton>. */
  skeleton?: React.ReactNode
  children: React.ReactNode
}) {
  if (loading) return <>{skeleton ?? <DetailSkeleton />}</>
  if (error) {
    // The API answers a record the current company can't see with a 404 whose
    // message is "… not found or does not belong to you/your team". Guide the
    // user (usually a mid-view company switch) instead of surfacing that.
    if (/not found|does not belong/i.test(error)) {
      return <DetailUnavailable companyName={companyName} onBack={onBack} backLabel={backLabel} />
    }
    return <p className="text-sm text-red-200">{error}</p>
  }
  return <>{children}</>
}

/**
 * Friendly stand-in when a detail record isn't visible to the company currently
 * in scope — typically after switching company mid-view. Explains why and offers
 * the way back, rather than surfacing the raw "does not belong to your team".
 */
function DetailUnavailable({
  companyName,
  onBack,
  backLabel,
}: {
  companyName?: string | null
  onBack?: () => void
  backLabel?: string
}) {
  return (
    <Card className="overflow-hidden">
      <div className="rc-gradient h-1 w-full" />
      <div className="flex flex-col items-center px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rc-blue-light text-rc-blue">
          <Icon name="building" className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-medium text-rc-navy">
          {companyName ? `Not available for ${companyName}` : 'This record isn’t available'}
        </h2>
        <p className="mt-1 max-w-sm text-sm text-rc-teal">
          {companyName
            ? `This record belongs to a different company. If you’ve just switched to ${companyName}, switch back with the company menu above — or head back to the list.`
            : 'It may belong to a different company you can switch to, or it no longer exists. Try the company menu above, or head back to the list.'}
        </p>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-rc-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rc-navy"
          >
            <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
            Back to {backLabel ?? 'the list'}
          </button>
        )}
      </div>
    </Card>
  )
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
