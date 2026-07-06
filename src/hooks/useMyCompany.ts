import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
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
 * named primary contact. `team` returns the caller's account for everyone.
 *
 * Keyed on the selected company so it refetches on switch (keeping the previous
 * value until the new one lands), and refreshes on window focus.
 */
export function useMyCompany(): UseMyCompanyResult {
  const client = useDataverseClient()
  const { selectedCompanyId } = useSelectedCompany()

  const query = useQuery({
    queryKey: ['myCompany', selectedCompanyId ?? 'default'],
    queryFn: async () => {
      const res = await client.team.list<Account>('account', { select: ACCOUNT_SELECT, top: 1 })
      return res.data[0] ?? null
    },
    placeholderData: keepPreviousData,
  })

  return {
    account: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  }
}
