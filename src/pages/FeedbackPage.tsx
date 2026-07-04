import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useTierList } from '../hooks/useTierList'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_SELECT,
  categoryLabel,
  createFeedback,
} from '../services/feedbackApi'
import type { Feedback } from '../types/feedback'
import { formatDate, relativeFromNow } from '../lib/format'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { StarRating } from '../components/common/StarRating'
import { ListStates } from '../components/common/ListStates'

/**
 * Portal feedback: a compose form (message + category + rating) plus the
 * caller's own recent submissions. Feedback is bound to the caller's contact +
 * account server-side, so we only send content fields.
 */
export function FeedbackPage() {
  const client = useDataverseClient()
  const queryClient = useQueryClient()

  const [message, setMessage] = useState('')
  const [category, setCategory] = useState<number | undefined>()
  const [rating, setRating] = useState(0)

  const { items, loading, error } = useTierList<Feedback>(
    'portalfeedback',
    { select: FEEDBACK_SELECT, orderBy: { field: 'createdon', direction: 'desc' }, top: 25 },
    'me',
  )

  const submit = useMutation({
    mutationFn: () => {
      const label = categoryLabel(category) ?? 'Feedback'
      const summary = `${label}: ${message.trim().slice(0, 60)}`
      return createFeedback(client, {
        new_name: summary,
        new_message: message.trim(),
        new_category: category,
        new_rating: rating || undefined,
      })
    },
    onSuccess: () => {
      setMessage('')
      setCategory(undefined)
      setRating(0)
      queryClient.invalidateQueries({ queryKey: ['list', 'portalfeedback'] })
    },
  })

  return (
    <div className="space-y-8">
      <PageHeader title="Feedback" subtitle="Tell us how the portal is working for you" />

      <Card className="overflow-hidden">
        <div className="rc-gradient h-1 w-full" />
        <form
          className="space-y-5 p-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (message.trim()) submit.mutate()
          }}
        >
          <div>
            <span className="text-xs font-medium text-rc-teal">Category</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {FEEDBACK_CATEGORIES.map((c) => {
                const active = c.value === category
                return (
                  <button
                    key={c.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(active ? undefined : c.value)}
                    className={
                      'rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150 active:scale-95 ' +
                      (active
                        ? 'rc-gradient text-white shadow-sm'
                        : 'border border-rc-blue-light bg-white text-rc-teal hover:border-rc-blue hover:text-rc-navy')
                    }
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-rc-teal">How would you rate your experience?</span>
            <div className="mt-1">
              <StarRating value={rating} onChange={setRating} />
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-rc-teal">Your feedback</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              required
              placeholder="What's working well, what could be better?"
              className="rc-input resize-y"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!message.trim() || submit.isPending}
              className="rounded-lg bg-rc-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rc-navy disabled:opacity-50"
            >
              {submit.isPending ? 'Sending…' : 'Send feedback'}
            </button>
            {submit.isError && <span className="text-sm text-red-600">Couldn’t send — please try again.</span>}
            {submit.isSuccess && <span className="text-sm text-rc-green">Thanks — your feedback was sent.</span>}
          </div>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-xl font-light tracking-tight text-white">Your recent feedback</h2>
        <ListStates
          loading={loading}
          error={error}
          isEmpty={items.length === 0}
          emptyMessage="You haven't sent any feedback yet."
        >
          <div className="space-y-3 rc-land-list">
            {items.map((f) => (
              <Card key={f.new_portalfeedbackid} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {f.new_category != null && (
                      <span className="inline-flex items-center rounded-full bg-rc-blue-light px-2.5 py-0.5 text-xs font-medium text-rc-navy">
                        {categoryLabel(f.new_category) ?? 'Feedback'}
                      </span>
                    )}
                    {f.new_message && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-rc-navy">{f.new_message}</p>
                    )}
                    <div className="mt-1 text-xs text-rc-teal" title={formatDate(f.createdon)}>
                      Sent {relativeFromNow(f.createdon)}
                    </div>
                  </div>
                  {f.new_rating ? (
                    <div className="shrink-0">
                      <StarRating value={f.new_rating} size={14} />
                    </div>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </ListStates>
      </div>
    </div>
  )
}
