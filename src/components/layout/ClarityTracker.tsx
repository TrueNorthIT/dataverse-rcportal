import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { accountToUser } from '../../config/entra'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'
import { claritySetTag, clarityIdentify, clarityTrackPage } from '../../lib/clarity'
import { DEPLOY_ENV } from '../../env'

/**
 * Bridges the app's auth + routing into Microsoft Clarity: on each navigation
 * it (re-)identifies the signed-in user and tags the route on the session
 * timeline; it also tags the session with the deployment environment and the
 * company the user is acting as, so the dashboard can be sliced by customer
 * and demo/preview noise filtered out. Renders nothing, and is a no-op when
 * Clarity isn't configured (the lib calls guard on `window.clarity`), so it's
 * always safe to mount.
 *
 * Re-identifying per route is intentional — Clarity recommends it for SPAs so
 * the user id sticks to every virtual page view in a session.
 */
export function ClarityTracker() {
  const { instance } = useMsal()
  const { pathname } = useLocation()
  const { currentCompany } = useSelectedCompany()

  useEffect(() => {
    clarityIdentify(accountToUser(instance.getActiveAccount() ?? undefined))
    clarityTrackPage(pathname)
  }, [instance, pathname])

  useEffect(() => {
    claritySetTag('env', DEPLOY_ENV)
    if (currentCompany?.companyName) claritySetTag('company', currentCompany.companyName)
  }, [currentCompany])

  return null
}
