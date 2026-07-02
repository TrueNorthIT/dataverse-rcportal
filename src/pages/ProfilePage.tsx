import { ContactProfile } from '../components/ContactProfile'
import { PageHeader } from '../components/common/PageHeader'
import { useMyCompany } from '../hooks/useMyCompany'
import { useSelectedCompany } from '../context/SelectedCompanyContext'

/**
 * "My profile" — the signed-in customer's own contact for the company they're
 * currently viewing. A person can be a contact under more than one company
 * (each with its own contact record), so we name the company here to make it
 * unambiguous which profile is being edited.
 */
export function ProfilePage() {
  const { account } = useMyCompany()
  const { hasMultiple } = useSelectedCompany()
  const company = account?.name

  return (
    <div>
      <PageHeader
        title="My profile"
        subtitle={
          company
            ? `Your contact details at ${company}`
            : 'View and update your contact details.'
        }
      />
      {hasMultiple && company && (
        <div className="mb-5 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white/90 backdrop-blur-sm">
          You have a separate profile for each company. This is your profile at{' '}
          <span className="font-semibold text-white">{company}</span> — switch company
          in the header to edit another.
        </div>
      )}
      <ContactProfile />
    </div>
  )
}
