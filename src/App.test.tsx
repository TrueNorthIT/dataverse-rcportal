import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Outlet } from 'react-router-dom'
import { InteractionStatus } from '@azure/msal-browser'
import App from './App'

// MSAL drives the auth gate; a mutable stub lets each test pick the state.
const { msal } = vi.hoisted(() => ({
  msal: { inProgress: 'none', isAuthenticated: false },
}))
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ inProgress: msal.inProgress }),
  useIsAuthenticated: () => msal.isAuthenticated,
}))

// Keep the authenticated tree light — providers pass through, the shell renders
// its outlet, and the index page is a marker. Each is unit-tested on its own.
vi.mock('./components/LoginScreen', () => ({ LoginScreen: () => <div>Sign in here</div> }))
// Onboarding is unit-tested on its own; here it passes through to the app.
vi.mock('./components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('./context/SelectedCompanyContext', () => ({
  SelectedCompanyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('./components/common/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('./components/common/FeedbackDialog', () => ({
  FeedbackProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('./components/layout/AppShell', () => ({ AppShell: () => <Outlet /> }))
vi.mock('./components/layout/ScrollManager', () => ({ ScrollManager: () => null }))
vi.mock('./components/common/ScrollToTop', () => ({ ScrollToTop: () => null }))
vi.mock('./pages/DashboardPage', () => ({ DashboardPage: () => <div>Dashboard home</div> }))

describe('App auth gate', () => {
  beforeEach(() => {
    msal.inProgress = InteractionStatus.None
    msal.isAuthenticated = false
  })

  it('shows the branded loader while MSAL is mid-interaction', () => {
    msal.inProgress = InteractionStatus.Startup
    render(<App />)
    expect(screen.getByText('Signing you in…')).toBeInTheDocument()
  })

  it('shows the sign-in screen when not authenticated', () => {
    render(<App />)
    expect(screen.getByText('Sign in here')).toBeInTheDocument()
  })

  it('renders the routed app at the index route when authenticated', () => {
    msal.isAuthenticated = true
    render(<App />)
    expect(screen.getByText('Dashboard home')).toBeInTheDocument()
  })
})
