import { HeartHandshake, Globe, LayoutGrid, Utensils, Wrench, HeartPulse, GraduationCap, Sparkles, Laptop, Briefcase, Scale, Users, Home } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TNode, Lang } from '@/types'

export const PER_PAGE = 6

// Directory tabs: businesses, then the two organization types. 'ngo'
// (עמותות) and 'partner' (שותפים) both render the answers catalog, scoped by
// the server-side ?orgType= filter.
export const TAB_ORDER = ['business', 'ngo', 'partner']

// Lucide icon per business category / NGO area. `all` uses a neutral grid.
// Shared by the filter chips and the business-card banners.
export const BIZ_CAT_ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
  food: Utensils,
  services: Wrench,
  health: HeartPulse,
  education: GraduationCap,
  beauty: Sparkles,
  tech: Laptop,
}

export const NGO_AREA_ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
  education: GraduationCap,
  employment: Briefcase,
  legal: Scale,
  social: Users,
  housing: Home,
  health: HeartPulse,
  welfare: HeartHandshake,
  community: Users,
  youth: Sparkles,
  absorption: Globe,
}

// Browser autofill hints for the registration form. Presentation metadata
// only — lets the browser pre-fill name / phone / city sensibly.
export const REG_AUTOCOMPLETE: Record<string, string> = {
  business_name: 'organization',
  owner_name: 'name',
  phone: 'tel',
  city: 'address-level2',
  desc: 'off',
  category: 'off',
}

export const BIZ_CATS = ['all', 'food', 'services', 'health', 'education', 'beauty', 'tech']

// The language context is exported with a precise per-key shape, but this page
// indexes the table dynamically (and reads HE-only keys), so consume it through
// the intentionally-loose `TNode` view. `t` is the bilingual translation table.
export type LangCtx = { t: TNode; lang: Lang; isRTL: boolean }

// A translatable field arrives either as a plain string or a `{ he, en }` /
// `{ he: string[], en: string[] }` bilingual object.
export type Bilingual = string | { he?: TNode | string[]; en?: TNode | string[]; [k: string]: TNode | string[] | undefined } | null | undefined

// API record shapes are loose (server returns dynamic JSON); narrow at use-site.
export type DirRecord = Record<string, TNode>

// A notice may optionally be ACTIONABLE: when `action` is set the dialog shows
// a primary button (e.g. "Sign in") that runs `action.onConfirm`, plus a
// Cancel. Plain notices stay single-button (OK).
export type NoticeState = {
  message?: string
  variant?: 'danger' | string
  action?: { confirmLabel: string; onConfirm: () => void }
} | null
