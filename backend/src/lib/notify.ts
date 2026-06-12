/**
 * User notifications (req 27) — email channel.
 *
 * Sends transactional email via the SendGrid REST API using the global `fetch`
 * (no extra dependency). Gated behind env vars; when unconfigured it LOGS a
 * redacted kind-only line instead of sending (full payload only with the
 * explicit dev opt-in NODE_ENV=development or NOTIFY_DEBUG=1), so the flow is
 * observable in dev/CI without credentials and "really sends" once keys are set.
 *
 * Required env to actually send:
 *   SENDGRID_API_KEY   — SendGrid API key
 *   NOTIFY_FROM_EMAIL  — verified sender address
 * Optional:
 *   NOTIFY_REPLY_TO    — reply-to address
 *
 * SMS is a documented future extension point (e.g. Twilio) — add a channel here.
 */
import { auth as firebaseAuth, db } from '@/lib/firebaseAdmin';

export type NotifyKind = 'reply' | 'accepted' | 'closed';

interface NotifyArgs {
  to: string;
  subject: string;
  text: string;
  /** Notification kind, used only for PII-free skip logging. */
  kind?: NotifyKind;
}

/** Low-level email send. Never throws — logs and returns false on failure. */
export async function notifyUser({ to, subject, text, kind }: NotifyArgs): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL;

  if (!apiKey || !from) {
    // Fail-closed default: nothing in the deploy path sets NODE_ENV, so the
    // PII-free redacted line is what runs unless a dev explicitly opts in to
    // the full payload (NODE_ENV=development or NOTIFY_DEBUG=1). Never log
    // recipient email or message body (beneficiary PII) by default.
    if (process.env.NODE_ENV === 'development' || process.env.NOTIFY_DEBUG === '1') {
      // Dev opt-in: no provider configured — log so the flow is observable.
      // eslint-disable-next-line no-console
      console.log(`[notify:log] (no SENDGRID_API_KEY/NOTIFY_FROM_EMAIL) → ${to}: ${subject}\n${text}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[notify:skipped] kind=${kind ?? 'unknown'} (sendgrid unconfigured)`);
    }
    return false;
  }

  try {
    const body = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      ...(process.env.NOTIFY_REPLY_TO ? { reply_to: { email: process.env.NOTIFY_REPLY_TO } } : {}),
      subject,
      content: [{ type: 'text/plain', value: text }],
    };
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[notify] SendGrid responded ${res.status} for ${to}`);
      return false;
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[notify] send failed:', err);
    return false;
  }
}

/** Resolve a beneficiary's email: request snapshot → users doc → Auth record. */
async function resolveBeneficiaryEmail(
  beneficiaryId: string | undefined,
  requestEmail: string | undefined,
): Promise<string | null> {
  if (requestEmail && requestEmail.includes('@')) return requestEmail;
  if (!beneficiaryId) return null;
  try {
    const userSnap = await db().collection('users').doc(beneficiaryId).get();
    const email = userSnap.data()?.email as string | undefined;
    if (email && email.includes('@')) return email;
  } catch {
    /* fall through to Auth */
  }
  try {
    const rec = await firebaseAuth().getUser(beneficiaryId);
    return rec.email ?? null;
  } catch {
    return null;
  }
}

const MESSAGES: Record<NotifyKind, { subject: string; text: (id: string) => string }> = {
  reply: {
    subject: 'עדכון בבקשה שלך · Update on your request',
    text: (id) =>
      `מתנדב/ת השיב/ה לך בצ׳אט של הבקשה. היכנס/י לאתר כדי להגיב.\n\n` +
      `A volunteer replied in your request chat. Sign in to view and respond.\n\nRequest: ${id}`,
  },
  accepted: {
    subject: 'מתנדב קיבל את הבקשה שלך · A volunteer accepted your request',
    text: (id) =>
      `מתנדב/ת קיבל/ה את הבקשה שלך והחל/ה לטפל בה.\n\n` +
      `A volunteer has accepted your request and started working on it.\n\nRequest: ${id}`,
  },
  closed: {
    subject: 'הבקשה שלך נסגרה · Your request was closed',
    text: (id) =>
      `הבקשה שלך נסגרה. תודה שפנית אלינו!\n\n` +
      `Your request has been closed. Thank you for reaching out!\n\nRequest: ${id}`,
  },
};

/**
 * Notify the beneficiary of a request about an event. Fire-and-forget: resolves
 * the email, composes a bilingual message, and sends (or logs). Never throws.
 */
export async function notifyBeneficiaryOfRequest(
  requestId: string,
  kind: NotifyKind,
): Promise<void> {
  try {
    const snap = await db().collection('requests').doc(requestId).get();
    if (!snap.exists) return;
    const data = snap.data() ?? {};
    const to = await resolveBeneficiaryEmail(
      data.beneficiaryId as string | undefined,
      data.email as string | undefined,
    );
    if (!to) {
      // eslint-disable-next-line no-console
      console.log(`[notify] no beneficiary email for request ${requestId} (${kind}) — skipped`);
      return;
    }
    const m = MESSAGES[kind];
    await notifyUser({ to, subject: m.subject, text: m.text(requestId), kind });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[notify] notifyBeneficiaryOfRequest failed:', err);
  }
}
