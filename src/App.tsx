import { InteractionStatus } from '@azure/msal-browser'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginScreen } from './components/LoginScreen'
import { OnboardingGate } from './components/OnboardingGate'
import { AppShell } from './components/layout/AppShell'
import { SelectedCompanyProvider } from './context/SelectedCompanyContext'
import { DashboardPage } from './pages/DashboardPage'
import { ProfilePage } from './pages/ProfilePage'
import { CompanyPage } from './pages/CompanyPage'
import { QuotesPage } from './pages/QuotesPage'
import { QuoteDetailPage } from './pages/QuoteDetailPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { SitesPage } from './pages/SitesPage'
import { SiteDetailPage } from './pages/SiteDetailPage'
import { CasesPage } from './pages/CasesPage'
import { CaseDetailPage } from './pages/CaseDetailPage'
import { ColleagueDetailPage } from './pages/ColleagueDetailPage'
import { AiPage } from './pages/AiPage'
import { KnowledgeBasePage } from './pages/KnowledgeBasePage'
import { ArticleDetailPage } from './pages/ArticleDetailPage'
import { BrandLoader } from './components/common/BrandLoader'
import { ScrollManager } from './components/layout/ScrollManager'
import { ScrollToTop } from './components/common/ScrollToTop'
import { ToastProvider } from './components/common/Toast'
import { FeedbackProvider } from './components/common/FeedbackDialog'

/**
 * Auth gate + routing. While MSAL is mid-interaction we show a loading state;
 * unauthenticated users get the sign-in screen; authenticated users get the
 * routed app inside the branded shell.
 */
function App() {
  const { inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const isLoading = inProgress !== InteractionStatus.None

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-rc-canvas">
        <BrandLoader label="Signing you in…" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return (
    <OnboardingGate>
    <SelectedCompanyProvider>
      <ToastProvider>
      <FeedbackProvider>
      <BrowserRouter>
        <ScrollManager />
        <ScrollToTop />
        <Routes>
          <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="company" element={<CompanyPage />} />
          <Route path="company/:id" element={<ColleagueDetailPage />} />
          <Route path="quotes" element={<QuotesPage />} />
          <Route path="quotes/:id" element={<QuoteDetailPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="sites" element={<SitesPage />} />
          <Route path="sites/:id" element={<SiteDetailPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/:id" element={<CaseDetailPage />} />
          <Route path="ai" element={<AiPage />} />
          <Route path="knowledge" element={<KnowledgeBasePage />} />
          <Route path="knowledge/:id" element={<ArticleDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </BrowserRouter>
      </FeedbackProvider>
      </ToastProvider>
    </SelectedCompanyProvider>
    </OnboardingGate>
  )
}

export default App
