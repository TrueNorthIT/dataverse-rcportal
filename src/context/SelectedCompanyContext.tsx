import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useMsal } from '@azure/msal-react'
import { createClient, type Company } from '@truenorth-it/dataverse-client'
import { apiOrigin, dataverseScope } from '../config/entra'
import { useGetToken } from '../lib/getToken'

/**
 * Multi-company selection.
 *
 * A person can act as more than one company — several Dataverse contacts (one
 * per company) in the classic model, or one contact linked to several companies
 * in the associated-accounts model. Most users have exactly one, in which case
 * this is a no-op. When they have more, this context holds which company the app
 * is acting as; `useDataverseClient()` reads `selectedCompanyId` and sends it as
 * the `X-Company-Id` header on every request. The choice is persisted per
 * signed-in account so it survives reloads.
 */
interface SelectedCompanyValue {
  /** All companies linked to the caller's email (usually one). */
  companies: Company[]
  /** True when the caller belongs to more than one company. */
  hasMultiple: boolean
  /** The companyId the app is currently acting as, or undefined for the default. */
  selectedCompanyId: string | undefined
  /** The company the app is currently acting as, if resolved. */
  currentCompany: Company | undefined
  /** True when the dashboard should roll up across every company (aggregates
   * only — lists/detail still act as the selected company). */
  allCompanies: boolean
  /** Switch to a company (pass its companyId), or undefined to use the default. */
  selectCompany: (companyId: string | undefined) => void
  /** Roll the dashboard up across all of the caller's companies. */
  selectAllCompanies: () => void
  /** True while the company list is still loading. */
  loading: boolean
}

/** Sentinel persisted in localStorage for the all-companies roll-up. */
const ALL = 'ALL'

const SelectedCompanyContext = createContext<SelectedCompanyValue | undefined>(undefined)

/** localStorage key for the selected companyId, scoped per signed-in account. */
function storageKey(accountId: string | undefined): string {
  return `rcportal.selectedCompanyId.${accountId ?? 'anon'}`
}

/**
 * localStorage key caching the caller's companies. Reading it at first paint
 * lets the header switcher and dashboard scope toggle render immediately on a
 * return visit, rather than popping in once `me.companies()` resolves — which
 * shoved the whole page down (a large layout shift / CLS).
 */
function companiesKey(accountId: string | undefined): string {
  return `rcportal.companies.${accountId ?? 'anon'}`
}

/** Best-effort read of the cached companies (empty on a first-ever visit). */
function readCachedCompanies(accountId: string | undefined): Company[] {
  try {
    const raw = localStorage.getItem(companiesKey(accountId))
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? (parsed as Company[]) : []
  } catch {
    return []
  }
}

export function SelectedCompanyProvider({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal()
  const getToken = useGetToken()
  const accountId = (instance.getActiveAccount() ?? accounts[0])?.homeAccountId

  const [companies, setCompanies] = useState<Company[]>(() => readCachedCompanies(accountId))
  const [loading, setLoading] = useState(true)
  const stored = (() => {
    try {
      return localStorage.getItem(storageKey(accountId)) ?? undefined
    } catch {
      return undefined
    }
  })()
  const [allCompanies, setAllCompanies] = useState<boolean>(stored === ALL)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(
    stored && stored !== ALL ? stored : undefined,
  )

  // A base client (no company override) is enough to list companies — the
  // endpoint keys off the token email, not X-Contact-Id.
  const baseClient = useMemo(
    () => createClient({ baseUrl: apiOrigin, scope: dataverseScope, getToken }),
    [getToken],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    baseClient.me
      .companies()
      .then(({ companies }) => {
        if (cancelled) return
        setCompanies(companies)
        // Cache for first-paint on the next visit (see readCachedCompanies).
        try {
          localStorage.setItem(companiesKey(accountId), JSON.stringify(companies))
        } catch {
          // Persistence is best-effort — ignore storage failures.
        }
        // Drop a persisted selection that is no longer one of the caller's
        // companies (e.g. access revoked) — fall back to the default.
        setSelectedCompanyId((current) =>
          current && companies.some((c) => c.companyId === current) ? current : undefined,
        )
      })
      .catch(() => {
        if (!cancelled) setCompanies([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [baseClient, accountId])

  const selectCompany = useMemo(
    () => (companyId: string | undefined) => {
      setAllCompanies(false)
      setSelectedCompanyId(companyId)
      try {
        const key = storageKey(accountId)
        if (companyId) localStorage.setItem(key, companyId)
        else localStorage.removeItem(key)
      } catch {
        // Persistence is best-effort — ignore storage failures.
      }
    },
    [accountId],
  )

  // Roll the dashboard up across all companies. Leaves selectedCompanyId as-is
  // so lists/detail still act as the last-picked company; only the dashboard
  // reads `allCompanies` and fans out.
  const selectAllCompanies = useMemo(
    () => () => {
      setAllCompanies(true)
      try {
        localStorage.setItem(storageKey(accountId), ALL)
      } catch {
        // best-effort
      }
    },
    [accountId],
  )

  const value = useMemo<SelectedCompanyValue>(() => {
    const currentCompany =
      companies.find((c) => c.companyId === selectedCompanyId) ??
      companies.find((c) => c.isDefault) ??
      companies[0]
    return {
      companies,
      hasMultiple: companies.length > 1,
      selectedCompanyId,
      currentCompany,
      allCompanies,
      selectCompany,
      selectAllCompanies,
      loading,
    }
  }, [companies, selectedCompanyId, allCompanies, selectCompany, selectAllCompanies, loading])

  return (
    <SelectedCompanyContext.Provider value={value}>
      {children}
    </SelectedCompanyContext.Provider>
  )
}

/** Access the selected-company state. Must be used within SelectedCompanyProvider. */
export function useSelectedCompany(): SelectedCompanyValue {
  const ctx = useContext(SelectedCompanyContext)
  if (!ctx) {
    throw new Error('useSelectedCompany must be used within a SelectedCompanyProvider')
  }
  return ctx
}
