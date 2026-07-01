import { useCallback, useEffect, useState } from 'react'
import { useDataverseClient } from '../lib/client'
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
  refresh: () => Promise<void>
  save: (patch: Partial<EditableContactFields>) => Promise<void>
  register: (names?: { firstname?: string; lastname?: string }) => Promise<void>
}

/**
 * Loads (and lets you edit) the signed-in user's own contact record.
 *
 * Owns the full lifecycle a screen needs: loading, error, empty
 * (needsRegistration), saving, and refresh. Components stay presentational —
 * they read this state and call save/register/refresh.
 */
export function useMyContact(): UseMyContactResult {
  const client = useDataverseClient()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsRegistration, setNeedsRegistration] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchMyContact(client)
      setContact(result)
      setNeedsRegistration(result === null)
    } catch (err) {
      // ApiError carries `.status` and `.message` from the API response.
      setError(err instanceof Error ? err.message : 'Failed to load your contact')
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(
    async (patch: Partial<EditableContactFields>) => {
      if (!contact) return
      setSaving(true)
      setError(null)
      try {
        const updated = await updateMyContact(client, contact.contactid, patch)
        setContact(updated)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save changes')
        throw err
      } finally {
        setSaving(false)
      }
    },
    [client, contact],
  )

  const register = useCallback(
    async (names?: { firstname?: string; lastname?: string }) => {
      setSaving(true)
      setError(null)
      try {
        await registerMyContact(client, names)
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create your contact')
        throw err
      } finally {
        setSaving(false)
      }
    },
    [client, refresh],
  )

  return {
    contact,
    loading,
    saving,
    error,
    needsRegistration,
    refresh,
    save,
    register,
  }
}
