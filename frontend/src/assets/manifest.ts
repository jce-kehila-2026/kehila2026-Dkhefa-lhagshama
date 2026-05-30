/**
 * Asset manifest (#79).
 *
 * A typed, central map of every image "slot" the marketing/auth surfaces use.
 * Components reference a slot by key via <AssetImage slot="hero" /> instead of
 * hard-coding paths, so swapping artwork (or wiring real photography later) is
 * a one-line change here.
 *
 * Files live under `frontend/public/` and are referenced by absolute web path.
 * `src` may be undefined for a slot that has no artwork yet — <AssetImage>
 * then renders a graceful tinted placeholder instead of a broken image.
 */

export interface AssetSlot {
  /** Web path under /public, or undefined when no artwork is wired yet. */
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

export const assetManifest: Record<AssetSlotKey, AssetSlot> = {
  logo: {
    src: '/logo.jpg',
    alt: { he: 'דחיפה להגשמה', en: 'Push for Fulfillment' },
    ratio: '1 / 1',
  },
  hero: {
    src: '/logo.jpg',
    alt: {
      he: 'עמותת דחיפה להגשמה — קהילה תומכת',
      en: 'Push for Fulfillment — a supportive community',
    },
    ratio: '1 / 1',
  },
  authAside: {
    src: '/logo.jpg',
    alt: { he: 'דחיפה להגשמה', en: 'Push for Fulfillment' },
    ratio: '1 / 1',
  },
  communityImpact: {
    // No dedicated photo yet — renders a tinted placeholder.
    src: undefined,
    alt: {
      he: 'חברי הקהילה האתיופית-ישראלית',
      en: 'Members of the Ethiopian-Israeli community',
    },
    ratio: '16 / 9',
  },
  volunteerInvite: {
    src: undefined,
    alt: {
      he: 'מתנדבים בפעולה',
      en: 'Volunteers in action',
    },
    ratio: '16 / 9',
  },
};

export function getAssetSlot(key: AssetSlotKey): AssetSlot {
  return assetManifest[key];
}
