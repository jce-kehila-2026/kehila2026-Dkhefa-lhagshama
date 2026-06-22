import { Phone, Mail, ExternalLink } from "lucide-react";

import { safeHref } from "@/lib/safeUrl";
import { formatDate } from "@/utils/helpers";
import type { Referral } from "@/types";

import { labelStyle } from "./shared";
import type { Translations } from "./shared";

// ── Referral panel (Note 8) ───────────────────────────────────
// When a request is `referred`, surface the partner + contact to the
// beneficiary as a timeline event. Partner name + optional note + contact
// come from `request.referral`; all copy via the lifecycle.referral keys.
export function ReferralPanel({ referral, t }: { referral: Referral; t: Translations }) {
  const rf = t.lifecycle.referral;
  const partner = referral.partnerName || "";
  // Render each contact channel as an actionable link (tel:/mailto:/external),
  // mirroring SuggestCard and the directory modal, so the beneficiary can tap to
  // call/email/open the partner directly. The website is gated through safeHref
  // (defense-in-depth over the server's http(s) validation); any value that
  // fails the guard falls back to inert plain text.
  const phone = referral.phone ? String(referral.phone) : "";
  const email = referral.email ? String(referral.email) : "";
  const website = referral.website ? safeHref(referral.website) : undefined;
  const websiteRaw = referral.website ? String(referral.website) : "";
  const hasContact = Boolean(phone || email || website || websiteRaw);

  return (
    <div className="referral-panel" role="group" aria-label={rf.timelineTitle(partner)}>
      <div className="referral-panel-head">
        <span className="referral-panel-dot" aria-hidden="true" />
        <div className="referral-panel-title">{rf.timelineTitle(partner)}</div>
      </div>
      {referral.referredAt && (
        <div className="referral-panel-time">{formatDate(referral.referredAt, t.lang)}</div>
      )}
      <p className="referral-panel-line">{rf.contactLine}</p>
      {referral.note && <p className="referral-panel-note">{referral.note}</p>}
      {hasContact && (
        <div className="referral-panel-contact">
          <div style={labelStyle}>{rf.contactLabel}</div>
          <ul className="referral-panel-contact-list">
            {phone && (
              <li>
                <a href={`tel:${phone}`} className="referral-panel-contact-link">
                  <Phone size={14} aria-hidden="true" /> {phone}
                </a>
              </li>
            )}
            {email && (
              <li>
                <a href={`mailto:${email}`} className="referral-panel-contact-link">
                  <Mail size={14} aria-hidden="true" /> {email}
                </a>
              </li>
            )}
            {website && (
              <li>
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="referral-panel-contact-link"
                >
                  <ExternalLink size={14} aria-hidden="true" /> {websiteRaw}
                </a>
              </li>
            )}
            {/* Plain-text fallback for a website value that failed the http(s) guard. */}
            {!website && websiteRaw && <li>{websiteRaw}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
