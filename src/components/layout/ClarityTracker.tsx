import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { accountToUser } from '../../config/entra'
import { clarityIdentify, clarityTrackPage } from '../../lib/clarity'

/**
 * Bridges the app's auth + routing into Microsoft Clarity: on each navigation
 * it (re-)identifies the signed-in user and tags the route on the session
 * timeline. Renders nothing, and is a no-op when Clarity isn't configured (the
 * lib calls guard on `window.clarity`), so it's always safe to mount.
 *
 * Re-identifying per route is intentional — Clarity recommends it for SPAs so
 * the user id sticks to every virtual page view in a session.
 */
export function ClarityTracker() {
  const { instance } = useMsal()
  const { pathname } = useLocation()

  useEffect(() => {
    clarityIdentify(accountToUser(instance.getActiveAccount() ?? undefined))
    clarityTrackPage(pathname)
  }, [instance, pathname])

  return null
}
