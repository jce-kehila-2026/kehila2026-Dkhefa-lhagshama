import type { ChangeEvent } from 'react'

// The intake form's field set (shape of `useForm` values for this page).
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

export type FormChangeHandler = (
  e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => void
