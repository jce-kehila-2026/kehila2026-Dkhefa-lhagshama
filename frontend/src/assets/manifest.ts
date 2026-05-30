/**
 * Asset manifest (#79).
 *
 * A typed, central map of every image "slot" the marketing/auth surfaces use.
 * Components reference a slot by key via <AssetImage slot="hero" /> instead of
 * hard-coding paths, so swapping artwork (or wiring real photography later) is
 * a one-line change here.
 *
 * `src` may be a local web path under `frontend/public/` (e.g. '/photos/hero.jpg')
 * or a remote URL on a host allow-listed in `next.config.js`. When a slot has no
 * artwork yet, leave `src` undefined and <AssetImage> renders a graceful tinted
 * placeholder instead of a broken image.
 *
 * The remote defaults below are verified Unsplash photos (HTTP 200 confirmed)
 * so the flagship ships with real community imagery for the demo. Replace each
 * `src` with the NGO's own /public/photos/* file before production launch; the
 * alt text stays as-is.
 */

export interface AssetSlot {
  /** Local /public path or an allow-listed remote URL; undefined = placeholder. */
  src?: string;
  /** Bilingual alt text. Falls back to `en` when a locale is missing. */
  alt: { he: string; en: string };
  /** Intrinsic aspect ratio "w / h" — reserves space to avoid layout shift. */
  ratio?: string;
}

export type AssetSlotKey =
  | 'logo'
  | 'hero'
  | 'authAside'
  | 'communityImpact'
  | 'volunteerInvite';

// Unsplash delivery URL helper. Verified IDs (HTTP 200) chosen for warm,
// community-centred imagery that matches the brand's editorial palette.
const u = (id: string, w = 1400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const assetManifest: Record<AssetSlotKey, AssetSlot> = {
  logo: {
    src: '/logo.jpg',
    alt: { he: 'דחיפה להגשמה', en: 'Push for Fulfillment' },
    ratio: '1 / 1',
  },
  hero: {
    src: u('photo-1582213782179-e0d53f98f2ca'),
    alt: {
      he: 'מתנדבים מסדרים ומחלקים תרומות במרכז קהילתי',
      en: 'Volunteers sorting and handing out donations at a community centre',
    },
    ratio: '4 / 5',
  },
  authAside: {
    src: '/logo.jpg',
    alt: { he: 'דחיפה להגשמה', en: 'Push for Fulfillment' },
    ratio: '1 / 1',
  },
  communityImpact: {
    src: u('photo-1521737711867-e3b97375f902'),
    alt: {
      he: 'חברי קהילה עובדים יחד סביב שולחן משותף',
      en: 'Community members working together around a shared table',
    },
    ratio: '4 / 3',
  },
  volunteerInvite: {
    src: u('photo-1517486808906-6ca8b3f04846'),
    alt: {
      he: 'קבוצת צעירים מחייכים יושבים יחד בחוץ',
      en: 'A group of young people smiling together outdoors',
    },
    ratio: '16 / 9',
  },
};

export function getAssetSlot(key: AssetSlotKey): AssetSlot {
  return assetManifest[key];
}
