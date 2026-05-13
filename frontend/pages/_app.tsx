import type { AppProps } from 'next/app'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { AppProvider } from '@/contexts/AppContext'
import { AuthProvider } from '@/contexts/AuthContext'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ToastContainer from '@/components/Toast'
import Modal from '@/components/Modal'
import '@/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppProvider>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <div style={{ flex: 1 }}>
              <Component {...pageProps} />
            </div>
            <Footer />
            <ToastContainer />
            <Modal />
          </div>
        </AppProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}
