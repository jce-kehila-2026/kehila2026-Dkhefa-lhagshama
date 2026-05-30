/**
 * AssetImage (#79).
 *
 * A lazy, layout-stable image bound to an asset "slot" from
 * `src/assets/manifest.ts`. While the bytes load it shows a shimmering skeleton
 * (respecting `prefers-reduced-motion`); if a slot has no artwork — or the load
 * fails — it shows a calm tinted placeholder with the brand mark. Alt text is
 * pulled bilingually from the manifest.
 *
 * Usage:
 *   <AssetImage slot="hero" />
 *   <AssetImage slot="authAside" rounded="50%" />
 */
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { getAssetSlot } from '../assets/manifest'

// Inject the shimmer keyframes + reduced-motion guard once per session.
const STYLE_ID = 'asset-image-styles'
function ensureStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = `
    @keyframes assetImageShimmer {
      0%   { background-position: -160% 0; }
      100% { background-position: 160% 0; }
    }
    .asset-image-shell {
      position: relative;
      overflow: hidden;
      background: var(--sky-2, #E8EFF6);
    }
    .asset-image-skeleton {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        100deg,
        rgba(255,255,255,0) 20%,
        rgba(255,255,255,0.55) 50%,
        rgba(255,255,255,0) 80%
      ), var(--sky-2, #E8EFF6);
      background-size: 200% 100%;
      animation: assetImageShimmer 1.4s ease-in-out infinite;
    }
    .asset-image-img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity .45s ease;
    }
    .asset-image-img.is-loaded { opacity: 1; }
    .asset-image-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--ember, #B9694E);
      background:
        radial-gradient(120% 120% at 80% 0%, rgba(185,105,78,0.10), transparent 60%),
        var(--sky-2, #E8EFF6);
    }
    @media (prefers-reduced-motion: reduce) {
      .asset-image-skeleton { animation: none; }
      .asset-image-img { transition: none; }
    }
  `
  document.head.appendChild(el)
}

export default function AssetImage({
  slot,
  rounded = 'var(--radius, 12px)',
  ratio,
  className = '',
  style = {},
  border,
  shadow,
  priority = false,
}) {
  const { lang } = useLanguage()
  const asset = getAssetSlot(slot)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => { ensureStyles() }, [])

  // If the image is already cached, the load event may not fire — sync it.
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true)
    }
  }, [asset?.src])

  if (!asset) {
    // Unknown slot key — fail loud in dev, render nothing in prod.
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'production') console.warn(`[AssetImage] unknown slot "${slot}"`)
    return null
  }

  const altText = asset.alt?.[lang] ?? asset.alt?.en ?? ''
  const aspect = ratio ?? asset.ratio ?? '16 / 9'
  const hasArt = Boolean(asset.src) && !failed

  return (
    <div
      className={`asset-image-shell ${className}`}
      style={{
        aspectRatio: aspect,
        borderRadius: rounded,
        border: border || undefined,
        boxShadow: shadow || undefined,
        ...style,
      }}
    >
      {/* Skeleton while real artwork is loading */}
      {hasArt && !loaded && <div className="asset-image-skeleton" aria-hidden="true" />}

      {hasArt ? (
        <img
          ref={imgRef}
          src={asset.src}
          alt={altText}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className={`asset-image-img${loaded ? ' is-loaded' : ''}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        // Graceful placeholder for slots with no artwork (or failed loads).
        <div className="asset-image-placeholder" role="img" aria-label={altText}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 16.5 8 11l4 4 3-3 6 6M3 5h18v14H3z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.55"
            />
            <circle cx="9" cy="8.5" r="1.6" fill="currentColor" opacity="0.55" />
          </svg>
        </div>
      )}
    </div>
  )
}
