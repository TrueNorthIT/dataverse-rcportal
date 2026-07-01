/**
 * Branded loading indicator — five equalizer bars bouncing in the Redcentric
 * blue→teal palette, with a staggered delay so they ripple. Subtle, modern,
 * a little funky; respects prefers-reduced-motion (bars hold still).
 */
const BARS = [
  { color: 'var(--color-rc-blue)', delay: '0s' },
  { color: 'var(--color-rc-teal)', delay: '0.12s' },
  { color: 'var(--color-rc-lime)', delay: '0.24s' },
  { color: 'var(--color-rc-teal)', delay: '0.36s' },
  { color: 'var(--color-rc-blue)', delay: '0.48s' },
]

export function BrandLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
      <div className="flex h-10 items-end gap-1.5">
        {BARS.map((b, i) => (
          <span
            key={i}
            className="rc-bar inline-block w-2 rounded-full"
            style={{ height: '100%', backgroundColor: b.color, animationDelay: b.delay }}
          />
        ))}
      </div>
      {label && <span className="text-sm font-medium text-rc-teal">{label}</span>}
    </div>
  )
}
