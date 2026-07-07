import { useEffect, useState } from 'react'
import { useMyContact } from '../hooks/useMyContact'
import { useRegistrableCompanies } from '../hooks/useRegistrableCompanies'
import type { EditableContactFields } from '../types/contact'

/** Text fields the form edits, in display order (donotbulkemail is a toggle). */
const FIELDS: { key: Exclude<keyof EditableContactFields, 'donotbulkemail'>; label: string }[] = [
  { key: 'firstname', label: 'First name' },
  { key: 'lastname', label: 'Last name' },
  { key: 'telephone1', label: 'Business phone' },
  { key: 'mobilephone', label: 'Mobile phone' },
  { key: 'jobtitle', label: 'Job title' },
  { key: 'address1_line1', label: 'Address' },
  { key: 'address1_city', label: 'City' },
  { key: 'address1_postalcode', label: 'Postcode' },
  { key: 'address1_country', label: 'Country' },
]

/**
 * The signed-in customer's own profile: identity header, an inline edit form for
 * their contact fields, and the marketing-email preference. Self-registers a
 * contact when the account has none yet.
 */
export function ContactProfile() {
  const { contact, loading, saving, error, needsRegistration, save, register } =
    useMyContact()

  // Local draft of the editable fields; seeded from the loaded contact.
  const [form, setForm] = useState<Partial<EditableContactFields>>({})

  useEffect(() => {
    if (contact) {
      setForm({
        firstname: contact.firstname ?? '',
        lastname: contact.lastname ?? '',
        telephone1: contact.telephone1 ?? '',
        mobilephone: contact.mobilephone ?? '',
        jobtitle: contact.jobtitle ?? '',
        address1_line1: contact.address1_line1 ?? '',
        address1_city: contact.address1_city ?? '',
        address1_postalcode: contact.address1_postalcode ?? '',
        address1_country: contact.address1_country ?? '',
      })
    }
  }, [contact])

  if (loading) {
    return <Centered>Loading your details…</Centered>
  }

  // Authenticated but no contact yet — offer self-registration, with a company
  // picker when the user's email domain matches known companies.
  if (needsRegistration) {
    return <RegistrationPrompt saving={saving} error={error} register={register} />
  }

  if (!contact) {
    return (
      <Centered>
        <div className="text-center">
          <p className="text-red-600">{error ?? 'Could not load your contact.'}</p>
        </div>
      </Centered>
    )
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // The SDK PATCHes only what we send; the hook refreshes state from the response.
    try {
      await save(form)
    } catch {
      /* error already surfaced via the hook's `error` */
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-2xl border border-rc-blue-light bg-white shadow-sm">
        {/* Signature blue → teal accent, echoing the logo rules. */}
        <div className="rc-gradient h-1 w-full" />
        <div className="p-6">
        {/* Read-only identity block */}
        <div className="mb-6 border-b border-rc-blue-light pb-4">
          <h1 className="text-2xl font-normal tracking-tight text-rc-navy">
            {contact.fullname || 'Your profile'}
          </h1>
          {contact.emailaddress1 && (
            <p className="text-sm text-rc-teal">{contact.emailaddress1}</p>
          )}
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map(({ key, label }) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-rc-teal">{label}</span>
              <input
                type="text"
                value={form[key] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="rounded-lg border border-rc-blue-light px-3 py-2 text-sm text-rc-navy focus:border-rc-blue focus:ring-2 focus:ring-rc-blue/30 focus:outline-none"
              />
            </label>
          ))}

          <div className="sm:col-span-2 mt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-rc-blue px-4 py-2 text-sm font-medium text-white hover:bg-rc-navy disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </form>
        </div>
      </div>

      <CommunicationPrefs
        optedOut={contact.donotbulkemail === true}
        saving={saving}
        onChange={(receive) => void save({ donotbulkemail: !receive }).catch(() => {})}
      />
    </div>
  )
}

/**
 * The no-contact-yet prompt. Looks up the companies whose email domains match
 * the signed-in user (the API's domain auto-linking): none → plain register,
 * one → register with a "you'll join X" note, several → pick before creating
 * (the API rejects a no-choice registration with 409 in that case).
 */
function RegistrationPrompt({
  saving,
  error,
  register,
}: {
  saving: boolean
  error: string | null
  register: (
    names?: { firstname?: string; lastname?: string },
    companyId?: string,
  ) => Promise<void>
}) {
  const { companies, mustChoose, loading } = useRegistrableCompanies(true)
  const [companyId, setCompanyId] = useState<string | undefined>(undefined)

  if (loading) {
    return <Centered>Checking which companies match your email…</Centered>
  }

  const single = companies.length === 1 ? companies[0] : undefined
  const chosen = companies.find((c) => c.companyId === companyId)

  return (
    <Centered>
      <div className="w-full max-w-md text-center">
        <p className="text-rc-navy">You don't have a contact record yet.</p>

        {single && (
          <p className="mt-2 text-sm text-rc-teal">
            Your email matches <span className="font-medium">{single.name ?? 'a known company'}</span> —
            registering will add you to it.
          </p>
        )}

        {mustChoose && (
          <fieldset className="mt-4 text-left">
            <legend className="text-sm text-rc-teal">
              Your email matches more than one company. Choose which one to join:
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {companies.map((c) => (
                <label
                  key={c.companyId}
                  className={
                    'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm text-rc-navy transition-colors ' +
                    (companyId === c.companyId
                      ? 'border-rc-blue bg-rc-blue/5'
                      : 'border-rc-blue-light hover:border-rc-blue')
                  }
                >
                  <input
                    type="radio"
                    name="register-company"
                    value={c.companyId}
                    checked={companyId === c.companyId}
                    onChange={() => setCompanyId(c.companyId)}
                    className="accent-rc-blue"
                  />
                  {c.name ?? c.companyId}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <button
          type="button"
          disabled={saving || (mustChoose && !chosen)}
          onClick={() => void register(undefined, mustChoose ? companyId : undefined)}
          className="mt-4 rounded-lg bg-rc-blue px-4 py-2 text-sm font-medium text-white hover:bg-rc-navy disabled:opacity-50 transition-colors"
        >
          {saving
            ? 'Creating…'
            : mustChoose && chosen
              ? `Join ${chosen.name ?? 'company'}`
              : 'Create my contact'}
        </button>
        {mustChoose && !chosen && (
          <p className="mt-2 text-xs text-rc-teal">Select a company to continue.</p>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Centered>
  )
}

/** Communication preferences card — the marketing-email opt-in toggle. */
function CommunicationPrefs({
  optedOut,
  saving,
  onChange,
}: {
  optedOut: boolean
  saving: boolean
  onChange: (receive: boolean) => void
}) {
  const receiving = !optedOut
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-rc-blue-light bg-white shadow-sm">
      <div className="p-6">
        <h2 className="text-sm font-bold text-rc-navy">Communication preferences</h2>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-rc-navy">Marketing emails</div>
            <div className="text-xs text-rc-teal">
              {receiving
                ? 'You’re receiving occasional product news and offers.'
                : 'You’ve opted out of marketing emails.'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={receiving}
            aria-label="Receive marketing emails"
            disabled={saving}
            onClick={() => onChange(!receiving)}
            className={
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ' +
              (receiving ? 'bg-rc-blue' : 'bg-rc-blue-light')
            }
          >
            <span
              className={
                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ' +
                (receiving ? 'translate-x-5' : 'translate-x-0.5')
              }
            />
          </button>
        </div>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 text-rc-navy">
      {children}
    </div>
  )
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm text-red-600">{children}</p>
}
