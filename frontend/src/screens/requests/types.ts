/**
 * shared type contract for the multi-step "submit request" intake flow (UC-01).
 *
 * one source of truth for the form's value shape + its change handler, imported by
 * RequestsPage (the useForm owner) and every step component (Step1Personal,
 * Step2RequestType, Step4Summary) plus draft.ts (localStorage draft persistence).
 *
 * RequestFormValues mirrors the fields posted to `POST /api/requests`; keep it in
 * sync with the backend zod schema. all fields are strings except `consent` so the
 * controlled inputs can bind directly without per-field coercion.
 */
import type { ChangeEvent } from 'react'

// the intake form's field set (shape of the `useForm` values shared across all steps).
export interface RequestFormValues {
  firstName: string; lastName: string;
  idType: string; idNumber: string; idNote: string;
  phone: string; email: string;
  city: string; age: string; gender: string;
  category: string; description: string; urgency: string;
  deadline: string;
  preferredLanguage: string;
  consent: boolean;
}

// one handler the steps wire to every input/select/textarea onChange (passed down from useForm).
export type FormChangeHandler = (
  e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => void
