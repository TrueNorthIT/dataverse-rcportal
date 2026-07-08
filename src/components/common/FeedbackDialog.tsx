import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useDataverseClient } from '../../lib/client'
import { clarityEvent, claritySetTag } from '../../lib/clarity'
import { createFeedback } from '../../services/feedbackApi'
import { StarRating } from './StarRating'
import { useToast } from './Toast'

/**
 * Portal feedback as a modal dialog (not a page). Wrap the app in
 * <FeedbackProvider> and call `useFeedback().open()` from anywhere (e.g. the
 * Help menu). Submitting sends the feedback, shows a toast, and closes — you
 * stay on whatever page you were on.
 */
const FeedbackContext = createContext<{ open: () => void }>({ open: () => {} })

export function useFeedback() {
  return useContext(FeedbackContext)
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  return (
    <FeedbackContext.Provider value={{ open }}>
      {children}
      {isOpen && <FeedbackDialog onClose={() => setIsOpen(false)} />}
    </FeedbackContext.Provider>
  )
}

function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const client = useDataverseClient()
  const toast = useToast()
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = useMutation({
    mutationFn: () =>
      createFeedback(client, {
        new_name: message.trim().slice(0, 60) || 'Portal feedback',
        new_message: message.trim(),
        new_rating: rating || undefined,
      }),
    onSuccess: () => {
      clarityEvent('feedback-sent')
      // Tagging the score lets the dashboard filter straight to unhappy
      // sessions ("feedback-rating ≤ 2") and watch what went wrong.
      if (rating) claritySetTag('feedback-rating', String(rating))
      toast.show('Thanks — your feedback was sent')
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-rc-navy/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Send feedback"
        className="rc-fade-up relative w-full max-w-lg overflow-hidden rounded-2xl border border-rc-blue-light bg-white shadow-xl"
      >
        <div className="rc-gradient h-1 w-full" />
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 className="text-xl font-light tracking-tight text-rc-navy">Feedback</h2>
            <p className="mt-0.5 text-sm text-rc-teal">Tell us how the portal is working for you</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-lg p-1.5 text-rc-teal transition-colors hover:bg-rc-blue-light/40 hover:text-rc-navy"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
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
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              required
              placeholder="What's working well, what could be better?"
              className="rc-input resize-y"
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            {submit.isError && (
              <span className="mr-auto text-sm text-red-600">Couldn’t send — please try again.</span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-rc-blue-light px-4 py-2 text-sm font-medium text-rc-navy transition-colors hover:bg-rc-blue-light/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!message.trim() || submit.isPending}
              className="rounded-lg bg-rc-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rc-navy disabled:opacity-50"
            >
              {submit.isPending ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
