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
 *   VITE_NOTIFY_EMAIL_4        → Recipient 4 (Principal) email address
 */

import emailjs from '@emailjs/browser';
import { COUNCILS } from './auth';
import { auth } from './firebase';


const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

const RECIPIENTS = [
  import.meta.env.VITE_NOTIFY_EMAIL_1,
  import.meta.env.VITE_NOTIFY_EMAIL_2,
  import.meta.env.VITE_NOTIFY_EMAIL_3,
  import.meta.env.VITE_NOTIFY_EMAIL_4,
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

function getBaseUrl() {
  if (import.meta.env.VITE_APP_URL) {
    return import.meta.env.VITE_APP_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost')) {
    return window.location.origin;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://crce-councils.vercel.app';
}

// Deduplication lock map to prevent duplicate emails triggered within short intervals
const recentDispatches = new Set();

/**
 * Core dispatcher — sends a single email notification covering configured recipients.
 * Implements deduplication to ensure rapid consecutive triggers for the same event stage are ignored.
 *
 * @param {Object} params  - Template variables forwarded to EmailJS
 */
async function dispatch(params) {
  // Check if action is performed by or targeting test@gmail.com
  const currentUserEmail = auth.currentUser?.email?.toLowerCase() || '';
  const councilEmail = (params.council_email || params.councilEmail || '').toLowerCase();
  const toEmail = (params.to_email || '').toLowerCase();

  if (
    currentUserEmail === 'test@gmail.com' ||
    councilEmail === 'test@gmail.com' ||
    toEmail.includes('test@gmail.com')
  ) {
    console.log(`[EmailJS] Action performed by or for test account (test@gmail.com) — skipping email dispatch.`);
    return;
  }

  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn('[EmailJS] Missing configuration — skipping email notification.');
    return;
  }

  const toEmailString = params.to_email || RECIPIENTS.join(', ');
  if (!toEmailString) {
    console.warn('[EmailJS] No recipient addresses configured.');
    return;
  }

  // Create a unique key for deduplication (Event ID + Stage + Recipient)
  const lockKey = `${params.event_id || ''}:${params.stage_label || ''}:${toEmailString}:${params.subject || ''}`;
  if (recentDispatches.has(lockKey)) {
    console.warn(`[EmailJS] Duplicate notification dispatch prevented for key: ${lockKey}`);
    return;
  }

  // Lock key for 5 seconds
  recentDispatches.add(lockKey);
  setTimeout(() => recentDispatches.delete(lockKey), 5000);

  const defaultAdminUrl = `${getBaseUrl()}/admin`;
  const defaultPortalUrl = `${getBaseUrl()}/portal`;

  const action_url = params.action_url || params.portal_url || params.admin_url || defaultAdminUrl;
  const admin_url = params.admin_url || defaultAdminUrl;
  const portal_url = params.portal_url || defaultPortalUrl;
  const button_text = params.button_text || (params.portal_url ? 'OPEN COUNCIL PORTAL →' : 'OPEN ADMIN PANEL →');

  const targetTemplateId = params.template_id || import.meta.env.VITE_EMAILJS_COUNCIL_TEMPLATE_ID || TEMPLATE_ID;

  try {
    await emailjs.send(
      SERVICE_ID,
      targetTemplateId,
      { ...params, action_url, button_text, admin_url, portal_url, to_email: toEmailString },
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
    council_email:  event.councilEmail || '',
    start_date:     formatDate(event.startDate),
    end_date:       formatDate(event.endDate),
    extra_notes:    'Please log into the admin panel to review and respond.',
    admin_url:      `${getBaseUrl()}/admin`,
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
    council_email:  event.councilEmail || '',
    start_date:     formatDate(event.startDate),
    end_date:       formatDate(event.endDate),
    extra_notes:    'The proposal is active again for review. You may now update and resubmit your proposal.',
    admin_url:      `${getBaseUrl()}/admin`,
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
    council_email:  event.councilEmail || '',
    start_date:     formatDate(event.startDate),
    end_date:       formatDate(event.endDate),
    extra_notes:    'Please log into the admin panel to review the updated proposal.',
    admin_url:      `${getBaseUrl()}/admin`,
  });
}

/**
 * Stage 2 — Council uploads clearance/permission documents.
 */
export async function notifyPermissionsSubmitted(event, councilName) {
  await dispatch({
    subject:        `[Stage 2] Documents Uploaded: ${event.eventName}`,
    stage_label:    'Stage 2 — Documents Submitted',
    action_type:    'The council has uploaded clearance and permission documents for review.',
    event_id:       event.eventId,
    event_name:     event.eventName,
    council_name:   councilName,
    council_email:  event.councilEmail || '',
    start_date:     formatDate(event.startDate),
    end_date:       formatDate(event.endDate),
    extra_notes:    'Please log into the admin panel to verify the uploaded documents.',
    admin_url:      `${getBaseUrl()}/admin`,
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
    council_email:  event.councilEmail || '',
    start_date:     formatDate(event.startDate),
    end_date:       formatDate(event.endDate),
    extra_notes:    'Please log into the admin panel to review the report and close the event.',
    admin_url:      `${getBaseUrl()}/admin`,
  });
}

/**
 * Admin Review Action — Sends email directly to the respective council (and admin recipients)
 * whenever admin approves, rejects, requests revision, or reopens an event proposal/clearance.
 */
export async function notifyCouncilStatusUpdate(event, statusType, reviewNotes = '') {
  // Use the council's logged-in email stored on the event document,
  // falling back to the COUNCILS registry for older events
  const councilEmail = event.councilEmail
    || (COUNCILS.find(c => c.id === event.councilId)?.email)
    || '';

  // Send status update email ONLY to the council (admins do not need copies of their own actions)
  const recipientList = [councilEmail].filter(Boolean);
  const uniqueRecipients = [...new Set(recipientList)].join(', ');

  let stageLabel = 'Status Updated';
  let actionType = `Your event request status has been updated to ${statusType.replace(/_/g, ' ')}.`;
  let subject = `[Status Update] ${event.eventName}: ${statusType.replace(/_/g, ' ').toUpperCase()}`;

  switch (statusType) {
    case 'proposal_approved':
      stageLabel = 'Stage 1 — Proposal Accepted';
      actionType = 'Your event proposal has been accepted by the administration. You may now proceed to Stage 2: Upload your clearance and permission documents.';
      subject = `[Stage 1 Accepted] Proposal Approved: ${event.eventName}`;
      break;
    case 'revision_needed':
      stageLabel = 'Stage 1 — Revision Requested';
      actionType = 'The administration requested revisions on your event proposal. Please review comments and update.';
      subject = `[Action Required] Proposal Revision Needed: ${event.eventName}`;
      break;
    case 'rejected':
      stageLabel = 'Stage 1 / 2 — Request Rejected';
      actionType = 'Your event request has been rejected by administration. See review notes below.';
      subject = `[Status Update] Event Request Rejected: ${event.eventName}`;
      break;
    case 'approved':
      stageLabel = 'Stage 2 — Fully Approved';
      actionType = 'All documents have been verified and your event is fully approved! You may now conduct the event.';
      subject = `[Stage 2 Approved] Event Fully Approved: ${event.eventName}`;
      break;
    case 'permissions_revision_needed':
      stageLabel = 'Stage 2 — Document Revision Needed';
      actionType = 'Revisions have been requested on your uploaded documents. Please re-upload the corrected files.';
      subject = `[Action Required] Document Revisions Needed: ${event.eventName}`;
      break;
    case 'submitted':
      stageLabel = 'Stage 1 — Proposal Re-opened';
      actionType = 'Your event proposal has been re-opened by administration for re-evaluation.';
      subject = `[Status Update] Proposal Re-opened: ${event.eventName}`;
      break;
    default:
      break;
  }

  await dispatch({
    to_email:       uniqueRecipients,
    subject:        subject,
    stage_label:    stageLabel,
    action_type:    actionType,
    event_id:       event.eventId || event.id,
    event_name:     event.eventName,
    council_name:   event.councilName,
    start_date:     formatDate(event.startDate),
    end_date:       formatDate(event.endDate),
    extra_notes:    reviewNotes ? `Admin Review Notes: ${reviewNotes}` : 'No additional notes provided.',
    portal_url:     `${getBaseUrl()}/portal`,
    admin_url:      `${getBaseUrl()}/admin`,
    template_id:    import.meta.env.VITE_EMAILJS_COUNCIL_TEMPLATE_ID || TEMPLATE_ID,
  });
}

