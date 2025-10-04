import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import UniversityAppPage from './pages/UniversityAppPage.tsx'
import CGIProjectsPage from './pages/CGIProjectsPage.tsx'
import HobbyProjectsPage from './pages/HobbyProjectsPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/university-app" element={<UniversityAppPage />} />
        <Route path="/cgi-projects" element={<CGIProjectsPage />} />
        <Route path="/hobby-projects" element={<HobbyProjectsPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
