/** Screen title row with an optional right-hand action/toggle slot. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-light tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-white/80">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
