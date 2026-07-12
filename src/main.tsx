import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  EventType,
  PublicClientApplication,
  type AuthenticationResult,
} from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { QueryClientProvider } from '@tanstack/react-query'
import { entraConfig } from './config/entra'
import { queryClient } from './lib/queryClient'
import { initClarity } from './lib/clarity'
import App from './App.tsx'
import './index.css'

// Start Microsoft Clarity as early as possible (no-op unless a project id is
// configured) so it captures the session from first paint, including sign-in.
initClarity()

const pca = new PublicClientApplication({
  auth: {
    clientId: entraConfig.clientId,
    authority: `https://${entraConfig.tenantId}.ciamlogin.com/${entraConfig.tenantId}`,
    knownAuthorities: [`${entraConfig.tenantId}.ciamlogin.com`],
    redirectUri: entraConfig.redirectUri,
    postLogoutRedirectUri: entraConfig.redirectUri,
  },
  // Session-scoped token cache. Tokens live only for the browser session, so a
  // customer returning the next day gets a clean sign-in instead of resurrecting
  // a stale account whose SPA refresh token has already expired (~24h cap) —
  // the source of the "nothing loads, iframe errors" report. Matches the rest of
  // the stack (tablemanager, case-portal). Within-session expiry is recovered by
  // useGetToken falling back to an interactive redirect.
  cache: { cacheLocation: 'sessionStorage' },
})

// MSAL doesn't auto-set an active account on login — without this,
// acquireTokenSilent fails after the redirect completes.
pca.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
    const account = (event.payload as AuthenticationResult).account
    if (account) pca.setActiveAccount(account)
  }
})

async function bootstrap() {
  await pca.initialize()
  await pca.handleRedirectPromise()
  if (!pca.getActiveAccount()) {
    const [first] = pca.getAllAccounts()
    if (first) pca.setActiveAccount(first)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MsalProvider instance={pca}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </MsalProvider>
    </StrictMode>,
  )
}

void bootstrap()
