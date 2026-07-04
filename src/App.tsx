import { InteractionStatus } from '@azure/msal-browser'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginScreen } from './components/LoginScreen'
import { AppShell } from './components/layout/AppShell'
import { SelectedCompanyProvider } from './context/SelectedCompanyContext'
import { DashboardPage } from './pages/DashboardPage'
import { ProfilePage } from './pages/ProfilePage'
import { CompanyPage } from './pages/CompanyPage'
import { QuotesPage } from './pages/QuotesPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { SitesPage } from './pages/SitesPage'
import { CasesPage } from './pages/CasesPage'
import { CaseDetailPage } from './pages/CaseDetailPage'
import { AiPage } from './pages/AiPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { KnowledgeBasePage } from './pages/KnowledgeBasePage'
import { ArticleDetailPage } from './pages/ArticleDetailPage'
import { BrandLoader } from './components/common/BrandLoader'
import { ScrollManager } from './components/layout/ScrollManager'
import { ScrollToTop } from './components/common/ScrollToTop'
import { ToastProvider } from './components/common/Toast'

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
    <SelectedCompanyProvider>
      <ToastProvider>
      <BrowserRouter>
        <ScrollManager />
        <ScrollToTop />
        <Routes>
          <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="company" element={<CompanyPage />} />
          <Route path="quotes" element={<QuotesPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="sites" element={<SitesPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/:id" element={<CaseDetailPage />} />
          <Route path="ai" element={<AiPage />} />
          <Route path="knowledge" element={<KnowledgeBasePage />} />
          <Route path="knowledge/:id" element={<ArticleDetailPage />} />
          <Route path="feedback" element={<FeedbackPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </BrowserRouter>
      </ToastProvider>
    </SelectedCompanyProvider>
  )
}

export default App
