import { useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DataverseClient } from '@truenorth-it/dataverse-client'
import { accountToUser, entraConfig } from '../config/entra'
import { clarityEvent, clarityUpgrade } from '../lib/clarity'
import { fetchClaimableCompanies, registerMyContact } from '../services/contactApi'
import { Icon } from './common/Icon'

/**
 * First-run "join" screen, shown by `OnboardingGate` when a signed-in user has
 * no Dataverse contact yet. They enter their name and pick which companies they
 * work with — the picker only offers companies on their own email domain (the
 * API returns them and re-verifies the choice server-side). Joining provisions
 * their contact (one per chosen company) and, on success, invalidates `whoami`
 * so the gate lets them into the app with their companies loaded.
 *
 * When nothing matches their domain the picker is skipped: they can still create
 * their account, and an administrator connects them to a company afterwards.
 */
export function JoinScreen({ client }: { client: DataverseClient }) {
  const qc = useQueryClient()
  const claimable = useQuery({
    queryKey: ['claimable-companies'],
    queryFn: () => fetchClaimableCompanies(client),
  })
  const companies = claimable.data?.companies ?? []
  const requireDomainMatch = claimable.data?.requireDomainMatch ?? false

  // We already signed the user in, so pre-fill their name from the token
  // (given_name/family_name, falling back to the display name) — they only
  // confirm it rather than retype it.
  const { instance, accounts } = useMsal()
  const user = accountToUser(instance.getActiveAccount() ?? accounts[0])
  const [firstname, setFirstname] = useState(() => user?.firstName ?? '')
  const [lastname, setLastname] = useState(() => user?.lastName ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const join = useMutation({
    mutationFn: () =>
      registerMyContact(client, {
        firstname: firstname.trim() || undefined,
        lastname: lastname.trim() || undefined,
        accountIds: [...selected],
      }),
    // The gate keys off whoami; once a contact exists it drops us into the app
    // and SelectedCompanyProvider (which mounts only past the gate) loads the
    // freshly-linked companies. No reload needed.
    onSuccess: () => {
      // First-run onboarding — keep this session's recording.
      clarityEvent('registered')
      clarityUpgrade('registered')
      void qc.invalidateQueries({ queryKey: ['whoami'] })
    },
  })

  const error = join.error instanceof Error ? join.error.message : null
  // Blocked: nothing matches the caller's domain and the scope requires a match.
  const blocked = !claimable.isLoading && companies.length === 0 && requireDomainMatch
  const canJoin = !join.isPending && !blocked && (companies.length === 0 || selected.size > 0)

  // Signed in as the wrong account? Let them re-pick without leaving the app.
  const signInAgain = () =>
    void instance.loginRedirect({ scopes: [entraConfig.apiScope], prompt: 'select_account' })

  return (
    <div className="rc-hero relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="relative z-10 w-full max-w-lg">
        <img
          src="/brand/Redcentric_logo_white_no-strapline.png"
          alt="Redcentric"
          className="mx-auto h-9 w-auto"
        />
        <h1 className="mt-8 text-center text-3xl font-light tracking-tight text-white">
          Welcome to the Redcentric Customer Hub
        </h1>
        <p className="mx-auto mt-3 max-w-md text-center text-sm text-white/80">
          We couldn’t find your details yet. Confirm your name and choose the
          companies you work with to get started.
        </p>
        {user?.email && (
          <p className="mt-2 text-center text-xs text-white/60">
            Signed in as <span className="font-medium text-white/90">{user.email}</span>
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            join.mutate()
          }}
          className="mt-8 overflow-hidden rounded-2xl border border-rc-blue-light bg-white shadow-sm"
        >
          <div className="rc-gradient h-1 w-full" />
          <div className="space-y-5 p-6">
            {blocked ? (
              <BlockedNotice />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="First name" value={firstname} onChange={setFirstname} autoFocus />
                  <Field label="Last name" value={lastname} onChange={setLastname} />
                </div>

                <CompanyPicker
                  loading={claimable.isLoading}
                  companies={companies}
                  selected={selected}
                  onToggle={toggle}
                />

                {error && (
                  <p className="flex items-start gap-1.5 text-sm text-red-600">
                    <Icon name="x" className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!canJoin}
                  className="w-full rounded-lg bg-rc-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rc-navy disabled:opacity-50"
                >
                  {join.isPending ? 'Setting up your account…' : 'Join'}
                </button>
              </>
            )}
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-white/60">
          {!blocked && <p>You can only join companies on your own email domain.</p>}
          <p className="mt-1">
            Not you?{' '}
            <button type="button" onClick={signInAgain} className="font-medium text-white/90 underline hover:text-white">
              Sign in with a different account
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Shown when the caller's email domain matches no company and the scope only
 * admits people from a company it looks after (`requireDomainMatch`).
 */
function BlockedNotice() {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rc-blue-light text-rc-blue">
        <Icon name="lock" className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-lg font-medium text-rc-navy">We can’t sign you up</h2>
      <p className="mt-1 max-w-sm text-sm text-rc-teal">
        You’re not a member of any trusted domain for the companies we look after.
        If you think this is wrong, contact your administrator.
      </p>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-rc-teal">{label}</span>
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-rc-blue-light px-3 py-2 text-sm text-rc-navy focus:border-rc-blue focus:ring-2 focus:ring-rc-blue/30 focus:outline-none"
      />
    </label>
  )
}

/**
 * The company multi-select. Skipped (with a friendly note) when no company
 * matches the caller's email domain — they can still create their account and
 * be connected by an administrator later.
 */
function CompanyPicker({
  loading,
  companies,
  selected,
  onToggle,
}: {
  loading: boolean
  companies: { accountId: string; name: string; city?: string; websiteurl?: string }[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="rc-skeleton h-24 w-full rounded-lg" aria-busy="true" aria-label="Finding your companies" />
    )
  }

  if (companies.length === 0) {
    return (
      <div className="rounded-lg border border-rc-blue-light bg-rc-canvas p-4 text-sm text-rc-teal">
        We couldn’t match any companies to your email domain yet. Create your
        account and an administrator will connect you to your company.
      </div>
    )
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-medium text-rc-teal">
        Which companies do you work with?
      </legend>
      {companies.map((c) => {
        const checked = selected.has(c.accountId)
        return (
          <label
            key={c.accountId}
            className={
              'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ' +
              (checked ? 'border-rc-blue bg-rc-blue-light/40' : 'border-rc-blue-light hover:bg-rc-canvas')
            }
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(c.accountId)}
              className="h-4 w-4 rounded border-rc-blue-light text-rc-blue focus:ring-rc-blue/30"
            />
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rc-blue-light text-rc-blue">
              <Icon name="building" className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-rc-navy">{c.name}</span>
              {c.city && <span className="block truncate text-xs text-rc-teal">{c.city}</span>}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
