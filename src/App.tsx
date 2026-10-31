import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { SiteLayout } from './components/SiteLayout'
import { HomePage } from './pages/HomePage'
import { ServicesPage, ServiceDetailPage } from './pages/ServicesPage'
import { WorkPage } from './pages/WorkPage'
import { ProcessPage } from './pages/ProcessPage'
import { AboutPage } from './pages/AboutPage'
import { StartProjectPage } from './pages/StartProjectPage'
import { ContactPage } from './pages/ContactPage'
import { PrivacyPage, TermsPage } from './pages/LegalPages'
import { CustomerProjectPage } from './pages/CustomerProjectPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { AdminApp } from './pages/admin/AdminApp'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="services/:slug" element={<ServiceDetailPage />} />
          <Route path="work" element={<WorkPage />} />
          <Route path="how-it-works" element={<ProcessPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="start" element={<StartProjectPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="p/:reference" element={<CustomerProjectPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  )
}
