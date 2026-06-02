import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { AppProvider } from '@/contexts/AppContext'
import { AuthProvider } from '@/contexts/AuthContext'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ToastContainer from '@/components/Toast'
import Modal from '@/components/Modal'
import '@/styles/globals.css'
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/utilities.css'
import '@/styles/components/badges.css'
import '@/styles/components/buttons.css'
import '@/styles/components/feedback.css'
import '@/styles/components/forms.css'
import '@/styles/components/misc.css'
import '@/styles/components/navigation.css'
import '@/styles/screens/account-disabled.css'
import '@/styles/screens/admin.css'
import '@/styles/screens/directory.css'
import '@/styles/screens/home.css'
import '@/styles/screens/login.css'
import '@/styles/screens/my-requests.css'
import '@/styles/screens/requests.css'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  // Admin routes render their own shell (sidebar) — hide the public chrome.
  const isAdmin = router.pathname.startsWith('/admin')

  return (
    <LanguageProvider>
      <AuthProvider>
        <AppProvider>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {!isAdmin && (
              <a href="#main-content" className="skip-link">
                Skip to content
              </a>
            )}
            {!isAdmin && <Navbar />}
            {/* key on route → a single calm page-enter on each navigation. */}
            <div id="main-content" className="page-enter" key={router.pathname} style={{ flex: 1 }}>
              <Component {...pageProps} />
            </div>
            {!isAdmin && <Footer />}
            <ToastContainer />
            <Modal />
          </div>
        </AppProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}
