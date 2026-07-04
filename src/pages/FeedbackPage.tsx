import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { createFeedback } from '../services/feedbackApi'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { StarRating } from '../components/common/StarRating'
import { useToast } from '../components/common/Toast'

/**
 * Portal feedback: a simple compose form (rating + message). Feedback is bound
 * to the caller's contact + account server-side, so we only send content.
 */
export function FeedbackPage() {
  const client = useDataverseClient()
  const toast = useToast()
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(0)

  const submit = useMutation({
    mutationFn: () =>
      createFeedback(client, {
        new_name: message.trim().slice(0, 60) || 'Portal feedback',
        new_message: message.trim(),
        new_rating: rating || undefined,
      }),
    onSuccess: () => {
      setMessage('')
      setRating(0)
      toast.show('Thanks — your feedback was sent')
    },
  })

  return (
    <div>
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
          </div>
        </form>
      </Card>
    </div>
  )
}
