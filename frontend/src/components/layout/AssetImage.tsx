/**
 * AssetImage (#79).
 *
 * A lazy, layout-stable image bound to an asset "slot" from
 * `src/assets/manifest.ts`. While the bytes load it shows a shimmering skeleton
 * (respecting `prefers-reduced-motion`); if a slot has no artwork (or the load
 * fails) it shows a calm tinted placeholder with the brand mark. Alt text is
 * pulled bilingually from the manifest. Used across the marketing/auth/hub pages
 * wherever a manifest-backed image goes.
 *
 * Usage:
 *   <AssetImage slot="heroBackground" />
 *   <AssetImage slot="authAside" rounded="50%" />
 */
import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { getAssetSlot } from '@/assets/manifest'
import type { AssetSlotKey } from '@/assets/manifest'

// Inject the shimmer keyframes + reduced-motion guard once per session.
// Self-contained CSS (rather than a global stylesheet) keeps the component
// drop-in; SSR-safe via the `document === undefined` guard, idempotent via STYLE_ID.
const STYLE_ID = 'asset-image-styles'
function ensureStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = `
    @keyframes assetImagePulse {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.5; }
    }
    .asset-image-shell {
      position: relative;
      overflow: hidden;
      background: var(--sky-2, #E8EFF6);
    }
    .asset-image-skeleton {
      position: absolute;
      inset: 0;
      background: var(--sky-2, #E8EFF6);
      animation: assetImagePulse 1.4s ease-in-out infinite;
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
      background: var(--sky-2, #E8EFF6);
    }
    @media (prefers-reduced-motion: reduce) {
      .asset-image-skeleton { animation: none; }
      .asset-image-img { transition: none; }
    }
  `
  document.head.appendChild(el)
}

interface AssetImageProps {
  /** Asset slot key from the manifest. */
  slot: AssetSlotKey
  rounded?: string
  /** css aspect-ratio override; falls back to the manifest ratio, then 16/9. */
  ratio?: string
  className?: string
  style?: CSSProperties
  border?: string
  shadow?: string
  /** above-the-fold (e.g. hero): eager-loads, no skeleton, no fade-in. */
  priority?: boolean
}

// renders a manifest-bound image inside a fixed-aspect shell. state: `loaded`
// drives the fade-in, `failed` falls back to the placeholder. returns null for
// an unknown slot key (warns in dev).
export default function AssetImage({
  slot,
  rounded = 'var(--radius, 12px)',
  ratio,
  className = '',
  style = {},
  border,
  shadow,
  priority = false,
}: AssetImageProps) {
  const { lang } = useLanguage()
  const asset = getAssetSlot(slot)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => { ensureStyles() }, [])

  // if the image is already cached the browser may not fire `load`, leaving the
  // fade-in stuck; re-sync `loaded` from the img's complete/naturalWidth state.
  // re-runs when the slot's src changes.
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true)
    }
  }, [asset?.src])

  if (!asset) {
    // unknown slot key: warn in dev, render nothing in prod.
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
      {/* Skeleton while real artwork is loading (skipped for priority/hero,
          which renders visible immediately to avoid a flash). */}
      {hasArt && !loaded && !priority && <div className="asset-image-skeleton" aria-hidden="true" />}

      {hasArt ? (
        <img
          ref={imgRef}
          src={asset.src}
          alt={altText}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          // Priority (above-the-fold, e.g. the hero) images render visible
          // immediately. Their eager load can fire its `load` event before React
          // attaches `onLoad`, leaving `loaded` stuck false → the image paints
          // then hides (opacity:0). Forcing `is-loaded` for priority avoids that
          // flash-then-disappear; non-priority images keep the fade-in on load.
          className={`asset-image-img${loaded || priority ? ' is-loaded' : ''}`}
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
