import { createContext, useCallback, useContext, useRef, useState } from 'react'

/**
 * Lightweight toast notifications. Wrap the app in <ToastProvider> and call
 * `useToast().show('message')` — a brief confirmation pops top-right and
 * auto-dismisses. Non-blocking; reusable for any "saved / sent" acknowledgement.
 */
interface ToastItem {
  id: number
  message: string
}

const ToastContext = createContext<{ show: (message: string) => void }>({ show: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const show = useCallback(
    (message: string) => {
      const id = (nextId.current += 1)
      setToasts((t) => [...t, { id, message }])
      setTimeout(() => dismiss(id), 3200)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[60] flex flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className="rc-fade-up pointer-events-auto flex items-center gap-2 rounded-xl border border-rc-blue-light bg-white px-4 py-3 text-left text-sm font-medium text-rc-navy shadow-lg"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rc-green-light text-rc-green">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
