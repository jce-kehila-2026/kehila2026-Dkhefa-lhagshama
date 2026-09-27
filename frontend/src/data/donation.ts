/**
 * Bank-transfer details for the public /donate page — the ONE place to edit
 * them. Donors copy these into their own banking app; there is no payment
 * processor and no receipt flow.
 *
 * `value` is shown and copied verbatim (no reformatting), so paste numbers
 * exactly as the bank documents them. `note` is optional context shown beside
 * the value but NOT copied (e.g. the bank's name next to its code), because a
 * banking-app field wants the bare number. `ltr` isolates numbers so digits
 * never reorder inside the RTL layout. Order here is display order. The label
 * for each `key` lives under `t.donate.fields` in `i18n/overhaul.public.ts`.
 *
 * Source: Bank Hapoalim account-ownership confirmation, 18/05/2025.
 */
export type DonationFieldKey = 'accountName' | 'bank' | 'branch' | 'accountNumber'

export interface DonationField {
  key: DonationFieldKey
  value: string
  note?: { he: string; en: string }
  ltr?: boolean
}

export const BANK_DETAILS: DonationField[] = [
  { key: 'accountName', value: 'דחיפה להגשמה (ע"ר)' },
  { key: 'bank', value: '12', note: { he: 'בנק הפועלים', en: 'Bank Hapoalim' }, ltr: true },
  { key: 'branch', value: '748', note: { he: 'תלפיות', en: 'Talpiot' }, ltr: true },
  { key: 'accountNumber', value: '94999', ltr: true },
]
