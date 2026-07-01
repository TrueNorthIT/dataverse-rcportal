import { ContactProfile } from '../components/ContactProfile'
import { PageHeader } from '../components/common/PageHeader'

/** "My profile" — the signed-in customer's own contact (view + edit + register). */
export function ProfilePage() {
  return (
    <div>
      <PageHeader
        title="My profile"
        subtitle="View and update your contact details."
      />
      <ContactProfile />
    </div>
  )
}
