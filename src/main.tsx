import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  EventType,
  PublicClientApplication,
  type AuthenticationResult,
} from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { entraConfig } from './config/entra'
import App from './App.tsx'
import './index.css'

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
        <App />
      </MsalProvider>
    </StrictMode>,
  )
}

void bootstrap()
