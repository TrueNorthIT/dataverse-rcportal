/**
 * Shape of a Dataverse `contact` record as this portal uses it.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PROVISIONAL — these fields are the standard Dataverse `contact` columns.
 * Once the `rcportal` scope is provisioned, regenerate the real, exact shape
 * from the published schema instead of trusting this file:
 *
 *   contact-admin tables get contact --url "$API_URL" --scope rcportal --json
 *
 * (or the SDK's `generateTableTypes` codegen against `client.schema("contact")`).
 * Keep whatever the schema returns as the source of truth.
 * ─────────────────────────────────────────────────────────────────────────
 */
export interface Contact {
  contactid: string // Primary key (GUID), read-only.
  fullname?: string // Computed from first/last name, read-only.
  firstname?: string
  lastname?: string
  emailaddress1?: string // Primary email — sourced from the sign-in token, read-only here.
  telephone1?: string // Business phone.
  mobilephone?: string
  jobtitle?: string
  address1_line1?: string
  address1_city?: string
  address1_postalcode?: string
  address1_country?: string
  /** Marketing-email opt-out (Dataverse "Do not allow Bulk Emails"). true = opted out. */
  donotbulkemail?: boolean
  createdon?: string // ISO 8601, read-only.
  modifiedon?: string // ISO 8601, read-only.
}

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
>
