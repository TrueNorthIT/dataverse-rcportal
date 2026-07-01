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
 * The signed-in customer's own company (`account`, TEAM tier).
 *
 * Use `team`, not `me`: on the account table `team` = "your own account" (the
 * one you belong to via parentcustomerid_account), whereas `me` = "accounts you
 * are the *primary contact* of" — which is empty for any colleague who isn't the
 * named primary contact, giving a blank company. `team` returns the caller's
 * account for everyone. (See the join semantics in dataverse-rcportal-terraform.)
 * Used by the shell header and the Company screen.
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
        const res = await client.team.list<Account>('account', {
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
