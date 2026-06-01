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
  | 'volunteerInvite'
  | 'heroMontageA'
  | 'heroMontageB'
  | 'heroMontageC'
  | 'story1'
  | 'story2'
  | 'story3'
  | 'story4';

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
  heroMontageA: {
    src: u('photo-1582213782179-e0d53f98f2ca'),
    alt: {
      he: 'מתנדבים מסדרים תרומות ומסייעים לחברי הקהילה',
      en: 'Volunteers sorting donations and supporting community members',
    },
    ratio: '4 / 5',
  },
  heroMontageB: {
    src: u('photo-1573497019940-1c28c88b4f3e'),
    alt: {
      he: 'אשה מחייכת ומלאת ביטחון מבני הקהילה',
      en: 'A confident, smiling woman from the community',
    },
    ratio: '1 / 1',
  },
  heroMontageC: {
    src: u('photo-1531206715517-5c0ba140b2b8'),
    alt: {
      he: 'צעירים לומדים ועובדים יחד סביב שולחן',
      en: 'Young people studying and working together around a table',
    },
    ratio: '4 / 3',
  },
  story1: {
    src: u('photo-1607746882042-944635dfe10e'),
    alt: {
      he: 'דיוקן של סטודנט צעיר ומחייך',
      en: 'Portrait of a young, smiling student',
    },
    ratio: '4 / 5',
  },
  story2: {
    src: u('photo-1494790108377-be9c29b29330'),
    alt: {
      he: 'דיוקן של אם מחייכת מבני הקהילה',
      en: 'Portrait of a smiling mother from the community',
    },
    ratio: '4 / 5',
  },
  story3: {
    src: u('photo-1542178243-bc20204b769f'),
    alt: {
      he: 'דיוקן של בעל עסק מחייך',
      en: 'Portrait of a smiling business owner',
    },
    ratio: '4 / 5',
  },
  story4: {
    src: u('photo-1438761681033-6461ffad8d80'),
    alt: {
      he: 'דיוקן של בוגרת תכנית ליווי מחייכת',
      en: 'Portrait of a smiling program graduate',
    },
    ratio: '4 / 5',
  },
};

export function getAssetSlot(key: AssetSlotKey): AssetSlot {
  return assetManifest[key];
}
