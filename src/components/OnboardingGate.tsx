import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@truenorth-it/dataverse-client'
import { apiOrigin, dataverseScope } from '../config/entra'
import { useGetToken } from '../lib/getToken'
import { fetchWhoami } from '../services/contactApi'
import { BrandLoader } from './common/BrandLoader'
import { JoinScreen } from './JoinScreen'

/**
 * Onboarding gate for signed-in users.
 *
 * Every access tier needs a Dataverse contact, so a brand-new user (authenticated
 * but not yet a contact) can't use the app. Before the routed app loads we call
 * `whoami` — which is tolerant, returning `dataverseContact: null` rather than a
 * 404 — and show the join screen when there's no contact.
 *
 * Deliberately sits *outside* `SelectedCompanyProvider`: the provider (and its
 * company list) only mounts once the gate passes, so a fresh joiner's companies
 * load correctly the moment `whoami` reports a contact (see `JoinScreen`).
 *
 * A whoami error is not fatal — we fall through to the app, which surfaces its
 * own errors, rather than trapping the user on a blank gate.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const getToken = useGetToken()
  const client = useMemo(
    () => createClient({ baseUrl: apiOrigin, scope: dataverseScope, getToken }),
    [getToken],
  )

  const whoami = useQuery({ queryKey: ['whoami'], queryFn: () => fetchWhoami(client) })

  if (whoami.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-rc-canvas">
        <BrandLoader label="Getting things ready…" />
      </div>
    )
  }

  if (whoami.isSuccess && !whoami.data.dataverseContact) {
    return <JoinScreen client={client} />
  }

  return <>{children}</>
}
