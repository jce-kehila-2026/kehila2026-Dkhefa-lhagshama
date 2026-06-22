import type { LucideIcon } from 'lucide-react'
import {
  CheckCircle2,
  PlayCircle,
  RotateCcw,
  XCircle,
  Undo2,
} from 'lucide-react'
import type { Translations } from '@/contexts/LanguageContext'
import { ADMIN_TRANSITIONS } from './types'
import type { PendingTransition, RequestDetail, TransitionKind } from './types'

type LifecycleActions = Translations['lifecycle']['actions']

// Confirm copy + success/error toasts per transition kind, all bilingual.
export function buildTransitionCopy(
  lc: { actions: LifecycleActions },
): Record<
  TransitionKind,
  { confirm: string; success: string; error: string; variant: 'default' | 'danger' }
> {
  return {
    start:    { confirm: lc.actions.startConfirm,    success: lc.actions.startSuccess,    error: lc.actions.startError,    variant: 'default' },
    close:    { confirm: lc.actions.closeConfirm,    success: lc.actions.closeSuccess,    error: lc.actions.closeError,    variant: 'default' },
    reopen:   { confirm: lc.actions.reopenConfirm,   success: lc.actions.reopenSuccess,   error: lc.actions.reopenError,   variant: 'default' },
    reject:   { confirm: lc.actions.rejectConfirm,   success: lc.actions.rejectSuccess,   error: lc.actions.rejectError,   variant: 'danger'  },
    sendBack: { confirm: lc.actions.sendBackConfirm, success: lc.actions.sendBackSuccess, error: lc.actions.sendBackError, variant: 'default' },
    archive:  { confirm: lc.actions.archiveConfirm,  success: lc.actions.archiveSuccess,  error: lc.actions.archiveError,  variant: 'default' },
  }
}

export interface TransitionControl {
  key: TransitionKind
  label: string
  Icon: LucideIcon
  pt: PendingTransition
  danger?: boolean
}

// Map the request's current status to the legal admin transition controls
// (Note 6). Each control carries its label, icon, the pending-transition it
// triggers, and whether it's destructive.
export function buildTransitionControls(
  request: RequestDetail | null,
  lc: { actions: LifecycleActions },
): TransitionControl[] {
  const current = request?.status || ''
  const allowed = ADMIN_TRANSITIONS[current] || []
  const controls: TransitionControl[] = []
  // Start handling moves a pending request to in_progress so the rest of the
  // lifecycle (volunteer Mark Done, chat links, mutual-consent close) becomes
  // reachable — assigning a volunteer alone leaves the request in pending.
  if (current === 'pending' && allowed.includes('in_progress')) {
    controls.push({ key: 'start', label: lc.actions.start, Icon: PlayCircle, pt: { kind: 'start', to: 'in_progress' } })
  }
  // Close is offered from awaiting_review AND in_progress (admin one-step
  // close, e.g. to resolve a one-sided consent-close handshake — req 25).
  if ((current === 'awaiting_review' || current === 'in_progress') && allowed.includes('closed')) {
    controls.push({ key: 'close', label: lc.actions.close, Icon: CheckCircle2, pt: { kind: 'close', to: 'closed' } })
  }
  if (current === 'awaiting_review' && allowed.includes('in_progress')) {
    controls.push({ key: 'sendBack', label: lc.actions.sendBack, Icon: Undo2, pt: { kind: 'sendBack', to: 'in_progress' } })
  }
  if (current === 'closed' && allowed.includes('in_progress')) {
    controls.push({ key: 'reopen', label: lc.actions.reopen, Icon: RotateCcw, pt: { kind: 'reopen', to: 'in_progress' } })
  }
  if (allowed.includes('rejected')) {
    controls.push({ key: 'reject', label: lc.actions.reject, Icon: XCircle, pt: { kind: 'reject', to: 'rejected' }, danger: true })
  }
  return controls
}
