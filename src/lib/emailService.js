/**
 * emailService.js
 * ───────────────
 * Handles all outbound email notifications via EmailJS.
 *
 * SETUP REQUIRED (see guide in README / admin console):
 *   VITE_EMAILJS_SERVICE_ID    → Your EmailJS Service ID
 *   VITE_EMAILJS_TEMPLATE_ID   → Your unified notification template ID
 *   VITE_EMAILJS_PUBLIC_KEY    → Your EmailJS public key
 *   VITE_NOTIFY_EMAIL_1        → Recipient 1 email address
 *   VITE_NOTIFY_EMAIL_2        → Recipient 2 email address
 *   VITE_NOTIFY_EMAIL_3        → Recipient 3 email address
 */

import emailjs from '@emailjs/browser';

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

const RECIPIENTS = [
  import.meta.env.VITE_NOTIFY_EMAIL_1,
  import.meta.env.VITE_NOTIFY_EMAIL_2,
  import.meta.env.VITE_NOTIFY_EMAIL_3,
].filter(Boolean); // drop undefined/empty entries

/**
 * Formats a Firestore Timestamp or ISO string to a readable date.
 */
function formatDate(value) {
  if (!value) return 'N/A';
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

// Deduplication lock map to prevent duplicate emails triggered within short intervals
const recentDispatches = new Set();

/**
 * Core dispatcher — sends a single email notification covering all configured recipients.
 * Implements deduplication to ensure rapid consecutive triggers for the same event stage are ignored.
 *
 * @param {Object} params  - Template variables forwarded to EmailJS
 */
async function dispatch(params) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn('[EmailJS] Missing configuration — skipping email notification.');
    return;
  }
  if (RECIPIENTS.length === 0) {
    console.warn('[EmailJS] No recipient addresses configured.');
    return;
  }

  // Create a unique key for deduplication (Event ID + Stage)
  const lockKey = `${params.event_id || ''}:${params.stage_label || ''}:${params.subject || ''}`;
  if (recentDispatches.has(lockKey)) {
    console.warn(`[EmailJS] Duplicate notification dispatch prevented for key: ${lockKey}`);
    return;
  }

  // Lock key for 5 seconds
  recentDispatches.add(lockKey);
  setTimeout(() => recentDispatches.delete(lockKey), 5000);

  // Join all configured recipients into a single comma-separated string
  // so EmailJS handles delivery in ONE single API call instead of multiple loops.
  const toEmailString = RECIPIENTS.join(', ');

  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      { ...params, to_email: toEmailString },
      { publicKey: PUBLIC_KEY }
    );
    console.log(`[EmailJS] Notification successfully sent to ${toEmailString} for ${params.event_id}`);
  } catch (err) {
    console.error(`[EmailJS] Failed to send email notification:`, err);
  }
}

// ─────────────────────────────────────────────
// Public notification helpers
// ─────────────────────────────────────────────

/**
 * Stage 1 — Council submits initial event proposal.
 */
export async function notifyProposalSubmitted(event, councilName) {
  await dispatch({
    subject:        `[Stage 1] New Event Proposal: ${event.eventName}`,
    stage_label:    'Stage 1 — Proposal Submitted',
    action_type:    'New event proposal has been submitted and awaits admin review.',
    event_id:       event.eventId,
    event_name:     event.eventName,
    council_name:   councilName,
    start_date:     formatDate(event.startDate),
    end_date:       formatDate(event.endDate),
    extra_notes:    'Please log into the admin panel to review and respond.',
    admin_url:      `${window.location.origin}/admin`,
  });
}

/**
 * Stage 1 — Admin re-opens a previously rejected proposal.
 */
export async function notifyProposalReopened(event, councilName) {
  await dispatch({
    subject:        `[Stage 1] Proposal Re-opened: ${event.eventName}`,
    stage_label:    'Stage 1 — Proposal Re-opened',
    action_type:    'A previously rejected proposal has been re-opened by administration.',
    event_id:       event.eventId,
    event_name:     event.eventName,
    council_name:   councilName,
    start_date:     formatDate(event.startDate),
    end_date:       formatDate(event.endDate),
    extra_notes:    'The proposal is active again for review and clearance uploads.',
    admin_url:      `${window.location.origin}/admin`,
  });
}

/**
 * Stage 1 — Council re-submits a revised proposal after admin requested changes.
 */
export async function notifyProposalResubmitted(event, councilName) {
  await dispatch({
    subject:        `[Stage 1] Revised Proposal Resubmitted: ${event.eventName}`,
    stage_label:    'Stage 1 — Proposal Resubmitted (Revised)',
    action_type:    'A revised event proposal has been resubmitted following a revision request.',
    event_id:       event.eventId,
    event_name:     event.eventName,
    council_name:   councilName,
    start_date:     formatDate(event.startDate),
    end_date:       formatDate(event.endDate),
    extra_notes:    'Please log into the admin panel to review the updated proposal.',
    admin_url:      `${window.location.origin}/admin`,
  });
}

/**
 * Stage 2 — Council uploads clearance/permission letters.
 */
export async function notifyPermissionsSubmitted(event, councilName) {
  await dispatch({
    subject:        `[Stage 2] Clearance Documents Uploaded: ${event.eventName}`,
    stage_label:    'Stage 2 — Permission Letters Submitted',
    action_type:    'The council has uploaded permission/clearance documents for review.',
    event_id:       event.eventId,
    event_name:     event.eventName,
    council_name:   councilName,
    start_date:     formatDate(event.startDate),
    end_date:       formatDate(event.endDate),
    extra_notes:    'Please log into the admin panel to verify the uploaded documents.',
    admin_url:      `${window.location.origin}/admin`,
  });
}

/**
 * Stage 3 — Council submits post-event report.
 */
export async function notifyReportSubmitted(event, councilName) {
  await dispatch({
    subject:        `[Stage 3] Post-Event Report Filed: ${event.eventName}`,
    stage_label:    'Stage 3 — Post-Event Report Submitted',
    action_type:    'The post-event report has been submitted. The event is ready to be closed.',
    event_id:       event.eventId,
    event_name:     event.eventName,
    council_name:   councilName,
    start_date:     formatDate(event.startDate),
    end_date:       formatDate(event.endDate),
    extra_notes:    'Please log into the admin panel to review the report and close the event.',
    admin_url:      `${window.location.origin}/admin`,
  });
}
