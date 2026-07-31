import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import UniversityAppPage from './pages/UniversityAppPage.tsx'
import CGIProjectsPage from './pages/CGIProjectsPage.tsx'
import HobbyProjectsPage from './pages/HobbyProjectsPage.tsx'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.tsx'

// Lazy-loaded so the 3D globe bundle is only fetched on /trips
const TripsPage = lazy(() => import('./pages/TripsPage.tsx'))
const TripsAdminPage = lazy(() => import('./pages/TripsAdminPage.tsx'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/university-app" element={<UniversityAppPage />} />
        <Route path="/cgi-projects" element={<CGIProjectsPage />} />
        <Route path="/hobby-projects" element={<HobbyProjectsPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route
          path="/trips"
          element={
            <Suspense fallback={<div className="min-h-screen bg-app-gradient" />}>
              <TripsPage />
            </Suspense>
          }
        />
        <Route
          path="/trips/admin"
          element={
            <Suspense fallback={<div className="min-h-screen bg-app-gradient" />}>
              <TripsAdminPage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
