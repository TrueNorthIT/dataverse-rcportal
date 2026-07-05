import { useState } from 'react'

/**
 * Inline "raise a ticket" form. Presentational — the parent supplies the
 * `create` call (auto-binding on the API sets the contact + account from the
 * verified token, so the form only collects content) and is told when a ticket
 * is created or the form is cancelled.
 */
export function RaiseCase({
  create,
  onCreated,
  onCancel,
}: {
  create: (input: { title: string; description?: string }) => Promise<unknown>
  onCreated: () => void | Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await create({ title: title.trim(), description: description.trim() || undefined })
      await onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to raise ticket')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-5 overflow-hidden rounded-2xl border border-rc-blue-light bg-white shadow-sm"
    >
      <div className="rc-gradient h-1 w-full" />
      <div className="space-y-4 p-5">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-rc-teal">Summary</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Brief summary of the issue"
            className="rc-input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-rc-teal">Details</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What's happening, and any impact?"
            className="rc-input resize-y"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="rounded-lg bg-rc-blue px-4 py-2 text-sm font-medium text-white hover:bg-rc-navy disabled:opacity-50 transition-colors"
          >
            {saving ? 'Submitting…' : 'Submit ticket'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-rc-blue-light px-4 py-2 text-sm font-medium text-rc-navy hover:bg-rc-blue-light transition-colors"
          >
            Cancel
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>
    </form>
  )
}
