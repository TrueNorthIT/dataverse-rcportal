import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  EventType,
  PublicClientApplication,
  type AuthenticationResult,
} from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { QueryClientProvider } from '@tanstack/react-query'
import { apiOrigin, entraConfig } from './config/entra'
import { queryClient } from './lib/queryClient'
import { initClarity } from './lib/clarity'
import { installCacheDebug } from './lib/cacheDebug'
import App from './App.tsx'
import './index.css'

// Start Microsoft Clarity as early as possible (no-op unless a project id is
// configured) so it captures the session from first paint, including sign-in.
initClarity()

// Record every API call (path, X-Cache, timing) for the per-tile cache debug
// badges. Recording is local-only; the badges render solely for the debug
// user (see components/debug/CacheBadge).
installCacheDebug(apiOrigin)

const pca = new PublicClientApplication({
  auth: {
    clientId: entraConfig.clientId,
    authority: `https://${entraConfig.tenantId}.ciamlogin.com/${entraConfig.tenantId}`,
    knownAuthorities: [`${entraConfig.tenantId}.ciamlogin.com`],
    redirectUri: entraConfig.redirectUri,
    postLogoutRedirectUri: entraConfig.redirectUri,
  },
  cache: { cacheLocation: 'localStorage' },
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
