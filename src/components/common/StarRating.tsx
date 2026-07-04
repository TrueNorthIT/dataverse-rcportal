/**
 * 1–5 star rating. Interactive when `onChange` is given (feedback form), or a
 * compact read-only display otherwise (feedback list).
 */
export function StarRating({
  value,
  onChange,
  size = 22,
}: {
  value: number
  onChange?: (v: number) => void
  size?: number
}) {
  const stars = [1, 2, 3, 4, 5]
  const readOnly = !onChange

  return (
    <div className="inline-flex items-center gap-0.5" role={readOnly ? 'img' : 'radiogroup'} aria-label={`${value} out of 5`}>
      {stars.map((n) => {
        const filled = n <= value
        const star = (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={filled ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        )
        const cls = filled ? 'text-amber-400' : 'text-rc-blue-light'
        if (readOnly) return <span key={n} className={cls}>{star}</span>
        return (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            onClick={() => onChange(n === value ? 0 : n)}
            className={`${cls} transition-transform hover:scale-110`}
          >
            {star}
          </button>
        )
      })}
    </div>
  )
}
