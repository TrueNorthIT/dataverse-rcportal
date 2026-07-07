import { apiOrigin, dataverseScope } from '../config/entra'

/** A company the signed-in user can register with (their email domain matches). */
export interface RegistrableCompany {
  /** Account id — pass as `companyId` when registering to join this company. */
  companyId: string
  name: string | null
}

/** Response from GET /me/register/companies. */
export interface RegistrableCompaniesResponse {
  domain: string | null
  companies: RegistrableCompany[]
  /** True when more than one company matches — registration then requires a pick. */
  mustChoose: boolean
}

/**
 * List the companies the signed-in user can register with — the accounts
 * whose email-domain list contains the token email's domain. Empty when the
 * scope has no domain auto-linking or nothing matches (registration then
 * proceeds without a company).
 *
 * Raw fetch rather than the SDK: the portal pins @truenorth-it/dataverse-client
 * ^1.7.0, which predates `client.me.registrableCompanies()`. Switch to the SDK
 * method once 1.8.0 is published.
 */
export async function fetchRegistrableCompanies(
  getToken: () => Promise<string>,
): Promise<RegistrableCompaniesResponse> {
  const token = await getToken()
  const res = await fetch(`${apiOrigin}/api/v2/${dataverseScope}/me/register/companies`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(body?.message ?? `Could not load your companies (${res.status})`)
  }
  return res.json() as Promise<RegistrableCompaniesResponse>
}
