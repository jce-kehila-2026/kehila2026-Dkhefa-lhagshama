import { Html, Head, Main, NextScript } from 'next/document'

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
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
