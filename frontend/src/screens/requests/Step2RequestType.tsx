/**
 * Step2RequestType — step 2 of the 4-step UC-01 "submit request" wizard.
 *
 * Presentational/controlled: the parent request-form screen owns all state and
 * passes values/errors/handlers down; this file only renders the category picker
 * + the request detail fields (description, urgency, deadline, preferred language).
 * Category tiles come from the admin-managed taxonomy (categories/labelFor); the
 * local CAT_STYLE map only adds per-slug icon/color, falling back to a neutral
 * DEFAULT so new admin categories still render. preferredLanguage feeds the
 * volunteer matcher (WS-6). Bilingual via useLanguage; RTL-safe through shared CSS.
 */
import { GraduationCap, Briefcase, Scale, Users, AlertTriangle, Sparkles, Home, HeartPulse, HeartHandshake, Globe, HandHeart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Reveal from '@/components/motion/Reveal'
import SuggestCard from '@/components/SuggestCard'
import { FormGroup, Label, Input, Select, Textarea, FormRow } from '@/components/forms/FormElements'
import HelpTooltip from '@/components/feedback/HelpTooltip'
import { useLanguage } from '@/contexts/LanguageContext'
import type { Suggestion, Category, Lang } from '@/types'
import type { RequestFormValues, FormChangeHandler } from './types'
import styles from './Step2RequestType.module.css'

// ── Constants ──────────────────────────────────────────────────
// Category LIST comes from the admin-managed taxonomy (useCategories); only
// the per-tile icon/color treatment stays local, keyed by the well-known slug
// ids. Any id without an entry gets the neutral DEFAULT treatment so a brand
// new admin category still renders a coherent tile.
const CAT_STYLE: Record<string, { Icon: LucideIcon; bg: string; color: string }> = {
  education:  { Icon: GraduationCap, bg:'#EBF3FF', color:'#1A5EA0' },
  employment: { Icon: Briefcase,     bg:'#E8F5EC', color:'#15803D' },
  legal:      { Icon: Scale,         bg:'#FBF0C8', color:'#7C5F00' },
  social:     { Icon: Users,         bg:'#F5EBF8', color:'#6D28D9' },
  housing:    { Icon: Home,          bg:'#EBF3FF', color:'#1A5EA0' },
  health:     { Icon: HeartPulse,    bg:'#E8F5EC', color:'#15803D' },
  welfare:    { Icon: HeartHandshake,bg:'var(--ember-soft)', color:'var(--ember)' },
  community:  { Icon: Users,         bg:'#F5EBF8', color:'#6D28D9' },
  youth:      { Icon: Sparkles,      bg:'#FBF0C8', color:'#7C5F00' },
  absorption: { Icon: Globe,         bg:'#EBF3FF', color:'#1A5EA0' },
}
const DEFAULT_CAT_STYLE = { Icon: HandHeart, bg: 'var(--ember-soft)', color: 'var(--ember)' }

interface Step2RequestTypeProps {
  values: RequestFormValues
  errors: Record<string, string>
  handleChange: FormChangeHandler
  setValue: (name: string, value: string | boolean) => void
  catsLoading: boolean
  categories: Category[]
  labelFor: (id: string | null | undefined, lang?: Lang) => string
  refreshCats: () => Promise<void>
  orgSuggestions: Suggestion[]
  orgSuggestionsDismissed: boolean
  setOrgSuggestionsDismissed: (v: boolean) => void
  navigate: (to: string) => void
  NextArrow: LucideIcon
}

// controlled step-2 renderer. key props: values/errors (parent-owned form state),
// setValue (tile selection) + handleChange (inputs), categories/labelFor/catsLoading
// (taxonomy), orgSuggestions (matching community orgs for the chosen category).
export default function Step2RequestType({
  values,
  errors,
  handleChange,
  setValue,
  catsLoading,
  categories,
  labelFor,
  refreshCats,
  orgSuggestions,
  orgSuggestionsDismissed,
  setOrgSuggestionsDismissed,
  navigate,
  NextArrow,
}: Step2RequestTypeProps) {
  const { t, lang } = useLanguage()
  const rq = t.request
  const s2 = t.stream2

  return (
    <div className="req-step" key="step2">
      <span className="eyebrow req-step-eyebrow">
        {lang === 'he' ? `שלב 2 מתוך 4` : `Step 2 of 4`}
      </span>
      <h2 className="req-step-title">{rq.step2.title}</h2>
      <p className="req-step-intro">{rq.step2.subtitle}</p>
      <div
        id="category"
        className={`choice-grid ${styles.categoryGrid}`}
        role="radiogroup"
        aria-label={rq.step2.title}
        aria-invalid={!!errors.category}
        aria-describedby={errors.category ? 'category-error' : undefined}
        tabIndex={errors.category ? -1 : undefined}
      >
        {catsLoading
          ? // Brief skeleton tiles while the taxonomy loads — same grid
            // cell footprint as a tile, so there is no layout jump.
            [0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`skeleton ${styles.skeletonTile}`}
                aria-hidden="true"
              />
            ))
          : categories.map(({ id }) => {
              const { Icon, bg, color } = CAT_STYLE[id] ?? DEFAULT_CAT_STYLE
              // Labels come from the category doc (labelFor); the legacy
              // static map only still contributes the optional hint line.
              const hint = (rq.step2.cats as Record<string, { label?: string; hint?: string }>)[id]?.hint
              const selected = values.category === id
              return (
                <button
                  key={id}
                  type="button"
                  className="choice-tile"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setValue('category', id)}
                >
                  <span className="choice-tile-icon" aria-hidden="true" style={{ background:bg, color }}>
                    <Icon size={20} />
                  </span>
                  <span className={styles.tileLabel}>
                    <span className="choice-tile-title">{labelFor(id)}</span>
                    {hint && <span className="choice-tile-hint">{hint}</span>}
                  </span>
                </button>
              )
            })}
      </div>
      {errors.category && <div id="category-error" role="alert" className={`form-error ${styles.categoryError}`}>{errors.category}</div>}

      {/* Taxonomy failed to load (backend down / unseeded): without
          tiles step 2 is a dead end, so surface the failure + a retry
          (useCategories never caches failures, so retry refetches). */}
      {!catsLoading && categories.length === 0 && (
        <div className={`form-banner form-banner-info ${styles.banner}`} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span className={styles.bannerText}>{rq.step2.catsLoadError}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => refreshCats()}>
            {rq.step2.catsRetry}
          </button>
        </div>
      )}

      {/* Matching organizations helper — community answers in the chosen category */}
      {!orgSuggestionsDismissed && orgSuggestions.length > 0 && (
        <Reveal>
          <SuggestCard
            items={orgSuggestions}
            lang={lang}
            heading={rq.step2.suggestHeading}
            subtitle={rq.step2.suggestSubtitle}
            openLabel={t.myRequests.suggest.open}
            callLabel={t.directory.modal.call}
            emailLabel={t.directory.modal.email}
            directoryLabel={t.myRequests.suggest.directory}
            dismissLabel={t.myRequests.suggest.dismiss}
            onDismiss={() => setOrgSuggestionsDismissed(true)}
          />
        </Reveal>
      )}

      {/* Link to the full directory, pre-filtered by the chosen category —
          gated on orgSuggestions.length > 0 so it only renders when the
          category actually has at least one matching organization
          (suggestions query both org types). This stops the CTA from
          promising "all organizations that can help" and then landing the
          beneficiary on an empty directory for categories with no orgs
          (e.g. absorption/youth in the current dataset). No `tab` param:
          DirectoryPage picks whichever org tab holds the category. */}
      {values.category && orgSuggestions.length > 0 && (
        <button
          type="button"
          className={`btn btn-ghost btn-sm ${styles.seeAllBtn}`}
          onClick={() => navigate(`/directory?category=${encodeURIComponent(values.category)}`)}
        >
          {rq.step2.seeAllOrgs} · {labelFor(values.category)}
          <NextArrow size={14} aria-hidden="true" />
        </button>
      )}

      <FormGroup>
        <Label htmlFor="description" required>{rq.step2.description}</Label>
        <Textarea id="description" name="description" value={values.description}
          onChange={handleChange} placeholder={rq.step2.descPH}
          rows={4} aria-invalid={!!errors.description} error={errors.description} />
      </FormGroup>
      <FormRow>
        <FormGroup>
          <Label htmlFor="urgency">{rq.step2.urgency}</Label>
          <Select id="urgency" name="urgency" value={values.urgency} onChange={handleChange}>
            <option value="low">{rq.step2.urgencyLow}</option>
            <option value="medium">{rq.step2.urgencyMed}</option>
            <option value="high">{rq.step2.urgencyHigh}</option>
          </Select>
        </FormGroup>
        {/* #68 — deadline picker */}
        <FormGroup>
          <span className={styles.labelWithTip}>
            <Label htmlFor="deadline">{s2.deadline.label}</Label>
            <HelpTooltip text={s2.deadline.tip} label={s2.deadline.tipLabel} />
          </span>
          <Input
            id="deadline" name="deadline" type="date"
            value={values.deadline || ''}
            onChange={handleChange}
            min={new Date().toISOString().split('T')[0]}
            hint={s2.deadline.hint}
          />
        </FormGroup>
        {/* WS-6 — preferred language; drives the volunteer matcher */}
        <FormGroup>
          <span className={styles.labelWithTip}>
            <Label htmlFor="preferredLanguage">{rq.step2.prefLang}</Label>
            <HelpTooltip text={rq.step2.prefLangHint} label={rq.step2.prefLang} />
          </span>
          <Select
            id="preferredLanguage"
            name="preferredLanguage"
            value={values.preferredLanguage}
            onChange={handleChange}
          >
            <option value="">{rq.step2.prefLangNone}</option>
            <option value="he">{rq.step2.prefLangHe}</option>
            <option value="am">{rq.step2.prefLangAm}</option>
            <option value="en">{rq.step2.prefLangEn}</option>
          </Select>
        </FormGroup>
      </FormRow>
    </div>
  )
}
