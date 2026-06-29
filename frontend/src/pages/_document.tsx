/**
 * Custom Next.js (Pages Router) document. Renders the outer <html>/<body> shell
 * once per server render and is the only place we can set markup before React
 * hydrates and before LanguageContext mounts. Responsibilities: (1) set the
 * initial lang/dir for this bilingual HE/EN app, (2) run a tiny inline script
 * that reads the saved 'pff-lang' preference pre-paint to avoid an RTL->LTR
 * flash, (3) preconnect/load the brand fonts and preload the logo.
 * Invariant: the static default (he/rtl) must mirror DEFAULT_LANG in LanguageContext.
 */
import { Html, Head, Main, NextScript } from 'next/document'

// document shell; runs server-side per render, never re-renders on client navigation
export default function Document() {
  // Default to Hebrew RTL on first render. LanguageContext updates lang/dir at runtime.
  return (
    <Html lang="he" dir="rtl">
      <Head>
        {/* No-flash language sync: the <Html> default is he/rtl, but a returning
            English user's saved preference only applies in a post-mount effect
            (LanguageContext), causing a visible RTL->LTR reflow on every load.
            Read the saved 'pff-lang' before first paint and correct lang/dir to
            match. Mirrors DEFAULT_LANG='he' (rtl) when no preference is stored. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var l=localStorage.getItem('pff-lang');if(l!=='he'&&l!=='en')l='he';var e=document.documentElement;e.lang=l;e.dir=l==='he'?'rtl':'ltr';}catch(e){}})();",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700;900&family=Noto+Sans+Hebrew:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="preload" as="image" href="/logo.jpg" />
        {/* Favicon / browser-tab icon — the NPO logo (square-cropped from logo.jpg into public/). */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
