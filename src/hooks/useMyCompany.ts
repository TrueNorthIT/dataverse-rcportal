import { useEffect, useState } from 'react'
import { useDataverseClient } from '../lib/client'
import { ACCOUNT_SELECT } from '../services/accountApi'
import type { Account } from '../types/account'

interface UseMyCompanyResult {
  account: Account | null
  loading: boolean
  error: string | null
}

/**
 * The signed-in customer's own company (`account`, me tier).
 *
 * `me` on `account` returns the account the caller is the primary contact of —
 * at most one row. Used by the shell header to show the company name and by the
 * Company screen. Cheap and cached at the component that mounts it.
 */
export function useMyCompany(): UseMyCompanyResult {
  const client = useDataverseClient()
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await client.me.list<Account>('account', {
          select: ACCOUNT_SELECT,
          top: 1,
        })
        if (!cancelled) setAccount(res.data[0] ?? null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load your company')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [client])

  return { account, loading, error }
}
