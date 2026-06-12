import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext'
import { AppProvider } from '@/contexts/AppContext'
import { AuthProvider } from '@/contexts/AuthContext'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ToastContainer from '@/components/feedback/Toast'
import Modal from '@/components/feedback/Modal'
import '@/styles/globals.css'
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/utilities.css'
import '@/styles/components/badges.css'
import '@/styles/components/buttons.css'
import '@/styles/components/feedback.css'
import '@/styles/components/forms.css'
import '@/styles/components/menu.css'
import '@/styles/components/misc.css'
import '@/styles/components/navigation.css'
import '@/styles/screens/account-disabled.css'
import '@/styles/screens/admin.css'
import '@/styles/screens/admin-insights.css'
import '@/styles/screens/chat.css'
import '@/styles/screens/directory.css'
import '@/styles/screens/home.css'
import '@/styles/screens/login.css'
import '@/styles/screens/my-requests.css'
import '@/styles/screens/requests.css'
import '@/styles/screens/volunteer.css'
import '@/styles/screens/volunteer-app.css'

// Lives below LanguageProvider (App itself renders the provider, so it cannot
// call useLanguage) — keeps the a11y skip link translated in the HE UI.
function SkipLink() {
  const { t } = useLanguage()
  return (
    <a href="#main-content" className="skip-link">
      {t.common.skipToContent}
    </a>
  )
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  // Admin and volunteer-hub routes render their own shell (sidebar) — hide the
  // public chrome (skip link, Navbar, Footer) for both.
  const hideChrome =
    router.pathname.startsWith('/admin') ||
    router.pathname.startsWith('/volunteer-hub')

  return (
    <LanguageProvider>
      <AuthProvider>
        <AppProvider>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {!hideChrome && <SkipLink />}
            {!hideChrome && <Navbar />}
            {/* key on route → a single calm page-enter on each navigation. */}
            <div id="main-content" className="page-enter" key={router.pathname} style={{ flex: 1 }}>
              <Component {...pageProps} />
            </div>
            {!hideChrome && <Footer />}
            <ToastContainer />
            <Modal />
          </div>
        </AppProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}
