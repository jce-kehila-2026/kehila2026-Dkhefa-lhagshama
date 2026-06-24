/*
 * Custom Next.js App root — wraps every page (Pages Router). Responsibilities:
 *  - imports all global CSS exactly once (tokens/base/utilities + per-component + per-screen),
 *    so order here is the cascade order for the whole app.
 *  - mounts the app-wide context stack (Language → Auth → App) that every page reads from.
 *  - renders the shared chrome (skip link, Navbar, Footer, Toast, Modal) around the active page,
 *    except on /admin and /volunteer-hub which provide their own sidebar shell.
 * Invariant: providers must wrap the page tree, and SkipLink must sit below LanguageProvider
 * (it calls useLanguage). Nothing here is route-specific beyond the hideChrome decision.
 */
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext'
import { AppProvider } from '@/contexts/AppContext'
import { AuthProvider } from '@/contexts/AuthContext'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ToastContainer from '@/components/feedback/Toast'
import Modal from '@/components/feedback/Modal'
import ErrorBoundary from '@/components/feedback/ErrorBoundary'
import styles from './_app.module.css'
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
          <div className={styles.shell}>
            {!hideChrome && <SkipLink />}
            {!hideChrome && <Navbar />}
            {/* key on route → a single calm page-enter on each navigation. */}
            <div id="main-content" className={`page-enter ${styles.main}`} key={router.pathname}>
              {/* Catch any render throw in a page so it shows a calm, translatable
                  fallback (and keeps the navbar/footer usable) instead of a blank
                  white screen. resetKey=route clears the error on navigation. */}
              <ErrorBoundary resetKey={router.pathname}>
                <Component {...pageProps} />
              </ErrorBoundary>
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
