import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import {
  fetchMyContact,
  registerMyContact,
  updateMyContact,
} from '../services/contactApi'
import type { Contact, EditableContactFields } from '../types/contact'

interface UseMyContactResult {
  contact: Contact | null
  loading: boolean
  saving: boolean
  error: string | null
  /** True once loaded and the user has no contact yet — offer to register. */
  needsRegistration: boolean
  refresh: () => void
  save: (patch: Partial<EditableContactFields>) => Promise<void>
  register: (names?: { firstname?: string; lastname?: string }) => Promise<void>
}

/**
 * Loads (and lets you edit) the signed-in user's own contact for the currently
 * selected company. Read is a React Query query (refetches on window focus and
 * on company switch); save/register are mutations that update the cache.
 */
export function useMyContact(): UseMyContactResult {
  const client = useDataverseClient()
  const { selectedCompanyId, reloadCompanies } = useSelectedCompany()
  const qc = useQueryClient()
  const key = ['myContact', selectedCompanyId ?? 'default']

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchMyContact(client),
  })

  const save = useMutation({
    mutationFn: (patch: Partial<EditableContactFields>) => {
      const id = query.data?.contactid
      if (!id) throw new Error('No contact to update')
      return updateMyContact(client, id, patch)
    },
    onSuccess: (updated) => qc.setQueryData(key, updated),
  })

  const register = useMutation({
    mutationFn: (names?: { firstname?: string; lastname?: string }) =>
      registerMyContact(client, names),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key })
      // The API may have auto-linked the new contact to a company by email
      // domain — refresh the company list so it appears without a reload.
      reloadCompanies()
    },
  })

  const err = query.error ?? save.error ?? register.error

  return {
    contact: query.data ?? null,
    loading: query.isLoading,
    saving: save.isPending || register.isPending,
    error: err instanceof Error ? err.message : null,
    needsRegistration: query.isSuccess && query.data === null,
    refresh: () => void query.refetch(),
    save: async (patch) => {
      await save.mutateAsync(patch)
    },
    register: async (names) => {
      await register.mutateAsync(names)
    },
  }
}
