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

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  // Admin routes render their own shell (sidebar) — hide the public chrome.
  const isAdmin = router.pathname.startsWith('/admin')

  return (
    <LanguageProvider>
      <AuthProvider>
        <AppProvider>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {!isAdmin && <Navbar />}
            <div style={{ flex: 1 }}>
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
