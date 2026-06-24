/**
 * ErrorBoundary — the app-wide safety net for React RENDER errors (audit HIGH).
 *
 * BIG PICTURE
 * -----------
 * Screens already handle *API* errors well (try/catch -> an `error` UI state).
 * But nothing caught an exception thrown DURING RENDER — e.g. a malformed API
 * row that breaks a `.map`, an unexpected `undefined` field, or a date-parse
 * throw. In React an uncaught render error unmounts the WHOLE tree, so the user
 * saw a blank white page with no recovery. For a live, data-driven, bilingual
 * demo that is the single biggest resiliency gap.
 *
 * HOW IT WORKS
 * ------------
 * React only lets a CLASS component catch render errors (via
 * getDerivedStateFromError / componentDidCatch) — there is no hook equivalent.
 * So this is a class that, on catching, renders a calm translatable fallback
 * (`<ErrorFallback>`, a function component that may use `useLanguage` because the
 * boundary is mounted INSIDE LanguageProvider). It wraps only the active page in
 * _app.tsx, so the shared chrome (navbar/footer) stays usable and the user can
 * navigate away. `resetKey` (the route path) clears a caught error on navigation
 * so moving to another page recovers without a manual reload.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { useLanguage } from '@/contexts/LanguageContext';
import styles from './ErrorBoundary.module.css';

// The translatable fallback. Separate function component so it can use the
// language hook — the class itself cannot. Rendered only when an error is caught.
function ErrorFallback() {
  const { t } = useLanguage();
  return (
    <div className={styles.wrap} role="alert">
      <h1 className={styles.title}>{t.common.errorTitle}</h1>
      <p className={styles.body}>{t.common.errorBody}</p>
      {/* Full reload is the simplest reliable recovery: it rebuilds the tree and
          re-runs every data fetch from a clean state. */}
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
        {t.common.errorRetry}
      </button>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** When this changes (we pass the route path), a previously-caught error is
   *  cleared so navigating to a new page recovers automatically. */
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  /** the resetKey we last rendered with, so we can detect a navigation. */
  lastResetKey?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, lastResetKey: props.resetKey };
  }

  // React calls this after a descendant throws during render — flip to the
  // fallback on the next render.
  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  // Clear the error when the route (resetKey) changes, so a navigation away from
  // the broken page recovers without a manual reload. Runs before render.
  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.lastResetKey) {
      return { hasError: false, lastResetKey: props.resetKey };
    }
    return null;
  }

  // Side-effect-only: log the real error for debugging (it never reaches the UI).
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] render error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) return <ErrorFallback />;
    return this.props.children;
  }
}

export default ErrorBoundary;
