import { useMemo } from 'react'
import { createClient, type Company, type DataverseClient } from '@truenorth-it/dataverse-client'
import { apiOrigin, dataverseScope } from '../config/entra'
import { useGetToken } from '../lib/getToken'
import { useSelectedCompany } from '../context/SelectedCompanyContext'

/**
 * One authenticated, company-scoped client per company the caller belongs to
 * (each bound to that company's contact via `contactId`). Used to roll up the
 * dashboard across all companies: every call stays security-trimmed to its own
 * company, and summing the results composes the totals. Cheap — `createClient`
 * just builds an object — and memoised on the company list + token getter.
 */
export function useCompanyClients(): { company: Company; client: DataverseClient }[] {
  const getToken = useGetToken()
  const { companies } = useSelectedCompany()
  return useMemo(
    () =>
      companies.map((company) => ({
        company,
        client: createClient({
          baseUrl: apiOrigin,
          scope: dataverseScope,
          getToken,
          contactId: company.contactid,
        }),
      })),
    [companies, getToken],
  )
}
