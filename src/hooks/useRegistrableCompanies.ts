import { useQuery } from '@tanstack/react-query'
import { useGetToken } from '../lib/getToken'
import {
  fetchRegistrableCompanies,
  type RegistrableCompany,
} from '../services/registrationApi'

interface UseRegistrableCompaniesResult {
  /** Companies whose email-domain list matches the signed-in user's domain. */
  companies: RegistrableCompany[]
  /** True when more than one matches — registration then requires a pick. */
  mustChoose: boolean
  loading: boolean
}

/**
 * The companies the signed-in user can register with, for the pre-registration
 * picker. Only fetched while registration is actually on offer (`enabled` —
 * i.e. the user has no contact yet). Errors degrade to an empty list: the
 * lookup is a convenience and must never block registration itself.
 */
export function useRegistrableCompanies(enabled: boolean): UseRegistrableCompaniesResult {
  const getToken = useGetToken()

  const query = useQuery({
    queryKey: ['registrableCompanies'],
    queryFn: () => fetchRegistrableCompanies(getToken),
    enabled,
    staleTime: 60_000,
    retry: false,
  })

  return {
    companies: query.data?.companies ?? [],
    mustChoose: query.data?.mustChoose ?? false,
    loading: enabled && query.isLoading,
  }
}
