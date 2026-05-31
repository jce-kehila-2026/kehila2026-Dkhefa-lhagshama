// Type surface for the JS LanguageContext (LanguageContext.jsx has no types).
// Adding this removes the `useLanguage() as any` casts at call sites (F10).
// The `t` shape is inferred from the real translations table, so consumers get
// real key checking instead of `any`.
import type { ReactElement, ReactNode } from 'react';

export type Lang = 'he' | 'en';

/** Active-language translation table — shape inferred from data/translations.js. */
export type Translations = (typeof import('@/data/translations'))['default'][Lang];

export interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: Translations;
  isRTL: boolean;
  hydrated: boolean;
}

export function LanguageProvider(props: { children: ReactNode }): ReactElement;
export function useLanguage(): LanguageContextValue;
