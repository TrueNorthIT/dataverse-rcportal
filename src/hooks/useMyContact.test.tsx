import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { hookWrapper } from '../test/render'
import { makeClient, paginated, single, type MockClient } from '../test/dataverse'
import type { Contact } from '../types/contact'
import { useMyContact } from './useMyContact'

// The hook reads its client + selected company from these modules; mocking them
// lets a test drive exactly what the contact API returns.
const client: MockClient = makeClient()
vi.mock('../lib/client', () => ({ useDataverseClient: () => client }))

const selected = { selectedContactId: undefined as string | undefined }
vi.mock('../context/SelectedCompanyContext', () => ({
  useSelectedCompany: () => selected,
}))

const contact: Contact = {
  contactid: 'c-1',
  fullname: 'Ada Lovelace',
  firstname: 'Ada',
  lastname: 'Lovelace',
  emailaddress1: 'ada@example.com',
}

describe('useMyContact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selected.selectedContactId = undefined
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in the loading state before the query resolves', () => {
    client.me.list.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useMyContact(), { wrapper: hookWrapper() })

    expect(result.current.loading).toBe(true)
    expect(result.current.contact).toBeNull()
    expect(result.current.needsRegistration).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('loads and exposes the signed-in user\'s own contact', async () => {
    client.me.list.mockResolvedValue(paginated<Contact>([contact]))

    const { result } = renderHook(() => useMyContact(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.contact).toEqual(contact)
    expect(result.current.needsRegistration).toBe(false)
    expect(result.current.error).toBeNull()
    expect(client.me.list).toHaveBeenCalledWith(
      'contact',
      expect.objectContaining({ top: 1 }),
    )
  })

  it('flags needsRegistration when the user has no contact yet', async () => {
    client.me.list.mockResolvedValue(paginated<Contact>([]))

    const { result } = renderHook(() => useMyContact(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.contact).toBeNull()
    expect(result.current.needsRegistration).toBe(true)
  })

  it('surfaces the error message when the read fails', async () => {
    client.me.list.mockRejectedValue(new Error('read boom'))

    const { result } = renderHook(() => useMyContact(), { wrapper: hookWrapper() })

    await waitFor(() => expect(result.current.error).toBe('read boom'))
    expect(result.current.contact).toBeNull()
    expect(result.current.needsRegistration).toBe(false)
  })

  it('refresh() refetches the contact', async () => {
    client.me.list.mockResolvedValue(paginated<Contact>([contact]))

    const { result } = renderHook(() => useMyContact(), { wrapper: hookWrapper() })
    await waitFor(() => expect(result.current.contact).toEqual(contact))

    const updated = { ...contact, jobtitle: 'Countess' }
    client.me.list.mockResolvedValue(paginated<Contact>([updated]))

    act(() => result.current.refresh())

    await waitFor(() => expect(result.current.contact).toEqual(updated))
    expect(client.me.list).toHaveBeenCalledTimes(2)
  })

  it('save() patches the contact and writes the result into the cache', async () => {
    client.me.list.mockResolvedValue(paginated<Contact>([contact]))
    const saved = { ...contact, jobtitle: 'Analyst' }
    client.me.update.mockResolvedValue(single<Contact>(saved))

    const { result } = renderHook(() => useMyContact(), { wrapper: hookWrapper() })
    await waitFor(() => expect(result.current.contact).toEqual(contact))

    await act(async () => {
      await result.current.save({ jobtitle: 'Analyst' })
    })

    expect(client.me.update).toHaveBeenCalledWith('contact', 'c-1', { jobtitle: 'Analyst' })
    // onSuccess writes the updated row straight into the cache — no refetch.
    await waitFor(() => expect(result.current.contact).toEqual(saved))
    expect(result.current.saving).toBe(false)
  })

  it('save() rejects (and surfaces an error) when there is no contact to update', async () => {
    client.me.list.mockResolvedValue(paginated<Contact>([]))

    const { result } = renderHook(() => useMyContact(), { wrapper: hookWrapper() })
    await waitFor(() => expect(result.current.needsRegistration).toBe(true))

    await expect(
      act(async () => {
        await result.current.save({ jobtitle: 'Nope' })
      }),
    ).rejects.toThrow('No contact to update')

    expect(client.me.update).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.error).toBe('No contact to update'))
  })

  it('register() self-provisions a contact and invalidates the query so it refetches', async () => {
    client.me.list.mockResolvedValue(paginated<Contact>([]))
    client.me.register.mockResolvedValue(single<Contact>(contact))

    const { result } = renderHook(() => useMyContact(), { wrapper: hookWrapper() })
    await waitFor(() => expect(result.current.needsRegistration).toBe(true))

    // After registration the list returns the freshly created contact.
    client.me.list.mockResolvedValue(paginated<Contact>([contact]))

    await act(async () => {
      await result.current.register({ firstname: 'Ada', lastname: 'Lovelace' })
    })

    expect(client.me.register).toHaveBeenCalledWith({ firstname: 'Ada', lastname: 'Lovelace' })
    await waitFor(() => expect(result.current.contact).toEqual(contact))
    expect(result.current.needsRegistration).toBe(false)
  })

  it('register() with no names still calls through', async () => {
    client.me.list.mockResolvedValue(paginated<Contact>([]))
    client.me.register.mockResolvedValue(single<Contact>(contact))

    const { result } = renderHook(() => useMyContact(), { wrapper: hookWrapper() })
    await waitFor(() => expect(result.current.needsRegistration).toBe(true))

    await act(async () => {
      await result.current.register()
    })

    expect(client.me.register).toHaveBeenCalledWith(undefined)
  })

  it('surfaces a register() failure as the error message', async () => {
    client.me.list.mockResolvedValue(paginated<Contact>([]))
    client.me.register.mockRejectedValue(new Error('403 forbidden'))

    const { result } = renderHook(() => useMyContact(), { wrapper: hookWrapper() })
    await waitFor(() => expect(result.current.needsRegistration).toBe(true))

    await expect(
      act(async () => {
        await result.current.register()
      }),
    ).rejects.toThrow('403 forbidden')

    await waitFor(() => expect(result.current.error).toBe('403 forbidden'))
  })

  it('reports saving=true while a save mutation is in flight', async () => {
    client.me.list.mockResolvedValue(paginated<Contact>([contact]))
    let resolveUpdate: (v: ReturnType<typeof single<Contact>>) => void = () => {}
    client.me.update.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve
      }),
    )

    const { result } = renderHook(() => useMyContact(), { wrapper: hookWrapper() })
    await waitFor(() => expect(result.current.contact).toEqual(contact))

    let savePromise: Promise<void> = Promise.resolve()
    act(() => {
      savePromise = result.current.save({ jobtitle: 'Analyst' })
    })

    await waitFor(() => expect(result.current.saving).toBe(true))

    await act(async () => {
      resolveUpdate(single<Contact>({ ...contact, jobtitle: 'Analyst' }))
      await savePromise
    })

    await waitFor(() => expect(result.current.saving).toBe(false))
  })

  it('keys the query on the selected contact id', async () => {
    selected.selectedContactId = 'other-co'
    client.me.list.mockResolvedValue(paginated<Contact>([contact]))

    const qc = (await import('../test/render')).testQueryClient()
    const { result } = renderHook(() => useMyContact(), { wrapper: hookWrapper(qc) })

    await waitFor(() => expect(result.current.contact).toEqual(contact))
    expect(qc.getQueryData(['myContact', 'other-co'])).toEqual(contact)
  })
})
