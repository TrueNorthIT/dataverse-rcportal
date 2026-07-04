/**
 * Contact — the signed-in user's own record and colleagues. Record shape comes
 * from the generated schema types (`dataverse.generated.ts`, run
 * `npm run generate:types`).
 */
import type { Contact } from './dataverse.generated'

export type { Contact }

/** Fields the portal lets the signed-in user edit on their own record. */
export type EditableContactFields = Pick<
  Contact,
  | 'firstname'
  | 'lastname'
  | 'telephone1'
  | 'mobilephone'
  | 'jobtitle'
  | 'address1_line1'
  | 'address1_city'
  | 'address1_postalcode'
  | 'address1_country'
  | 'donotbulkemail'
>
