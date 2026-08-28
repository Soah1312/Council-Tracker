/**
 * events.js - Firestore & Storage CRUD Data Layer Helpers
 */

import { 
  db,
  storage
} from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit, 
  updateDoc, 
  onSnapshot,
  Timestamp, 
  serverTimestamp 
} from 'firebase/firestore';

// Helper to convert inputs (JS Date, ISO string, or Timestamp) to Firestore Timestamp
const toTimestamp = (dateInput) => {
  if (!dateInput) return null;
  if (dateInput instanceof Timestamp) return dateInput;
  if (dateInput instanceof Date) return Timestamp.fromDate(dateInput);
  if (dateInput.toDate && typeof dateInput.toDate === 'function') return dateInput;
  if (typeof dateInput === 'string') {
    return Timestamp.fromDate(new Date(dateInput));
  }
  return dateInput;
};

/**
 * Generates a unique, auto-incrementing Event ID in the format: EVT-YYYY-NNN
 * Queries Firestore events created in the current year to determine the sequence.
 */
export async function generateEventId() {
  const currentYear = new Date().getFullYear();
  const prefix = `EVT-${currentYear}-`;
  
  // Query to find the highest eventId string for the current year
  // This query operates on a single field using string inequalities and orderBy, 
  // so it does NOT require a composite index.
  const q = query(
    collection(db, 'events'),
    where('eventId', '>=', `${prefix}000`),
    where('eventId', '<=', `${prefix}999`),
    orderBy('eventId', 'desc'),
    limit(1)
  );

  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return `${prefix}001`;
    }

    const latestEvent = querySnapshot.docs[0].data();
    const latestId = latestEvent.eventId;
    
    if (latestId && latestId.startsWith(prefix)) {
      const parts = latestId.split('-');
      if (parts.length === 3) {
        const sequenceNum = parseInt(parts[2], 10);
        if (!isNaN(sequenceNum)) {
          const nextSequence = String(sequenceNum + 1).padStart(3, '0');
          return `${prefix}${nextSequence}`;
        }
      }
    }
  } catch (err) {
    console.error('Error generating sequence ID, falling back to timestamp suffix:', err);
    // Safe fallback if permissions/queries fail
    return `${prefix}${Math.floor(100 + Math.random() * 900)}`;
  }
  
  return `${prefix}001`;
}

/**
 * Helper to check if an event is active on a specific calendar date.
 * Handles both standard single-range events and multi-session / split-date events.
 */
export function isEventActiveOnDate(event, targetDate) {
  if (!event || !targetDate) return false;
  const d = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);

  const parseDate = (f) => {
    if (!f) return null;
    if (f.toDate && typeof f.toDate === 'function') return f.toDate();
    if (typeof f.seconds === 'number') return new Date(f.seconds * 1000);
    const parsed = new Date(f);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  if (event.isMultiSession && Array.isArray(event.eventSessions) && event.eventSessions.length > 0) {
    return event.eventSessions.some(session => {
      const sStart = parseDate(session.startDate);
      const sEnd = parseDate(session.endDate) || sStart;
      if (!sStart) return false;

      const sStartDay = new Date(sStart.getFullYear(), sStart.getMonth(), sStart.getDate(), 0, 0, 0);
      const sEndDay = new Date(sEnd ? sEnd.getFullYear() : sStart.getFullYear(), sEnd ? sEnd.getMonth() : sStart.getMonth(), sEnd ? sEnd.getDate() : sStart.getDate(), 23, 59, 59);
      return d >= sStartDay && d <= sEndDay;
    });
  }

  const start = parseDate(event.startDate);
  const end = parseDate(event.endDate) || start;
  if (!start) return false;

  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
  return d >= startDay && d <= endDay;
}

/**
 * Computes the report due date: 10 days after the last date of the event in the calendar.
 * Falls back to event.reportDueDate if set, or current date if no date is found.
 */
export function getEventReportDueDate(event) {
  if (!event) return null;
  const parseDate = (f) => {
    if (!f) return null;
    if (f.toDate && typeof f.toDate === 'function') return f.toDate();
    if (typeof f.seconds === 'number') return new Date(f.seconds * 1000);
    const parsed = new Date(f);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  let lastEventDate = null;
  if (event.isMultiSession && Array.isArray(event.eventSessions) && event.eventSessions.length > 0) {
    const sessionEndDates = event.eventSessions
      .map(s => parseDate(s.endDate) || parseDate(s.startDate))
      .filter(Boolean);
    if (sessionEndDates.length > 0) {
      lastEventDate = new Date(Math.max(...sessionEndDates.map(d => d.getTime())));
    }
  }

  if (!lastEventDate) {
    lastEventDate = parseDate(event.endDate) || parseDate(event.startDate);
  }

  if (lastEventDate) {
    return new Date(lastEventDate.getTime() + 10 * 24 * 60 * 60 * 1000);
  }

  return parseDate(event.reportDueDate) || new Date();
}

/**
 * Appends an entry to the event's audit log.
 */
export async function addAuditLogEntry(eventId, eventType, performedBy, details = '', stage = 1) {
  if (!eventId) return;
  const eventRef = doc(db, 'events', eventId);
  const snap = await getDoc(eventRef);
  if (!snap.exists()) return;
  const currentData = snap.data();
  const currentLog = Array.isArray(currentData.auditLog) ? currentData.auditLog : [];

  const entry = {
    eventType, // 'submitted', 'resubmitted', 'document_uploaded', 'approved', 'revision_requested', 'rejected', 'reverted', 'closed'
    stage,
    performedBy: performedBy || { name: 'System', role: 'system' },
    timestamp: Timestamp.fromDate(new Date()),
    details: details || null
  };

  await updateDoc(eventRef, {
    auditLog: [...currentLog, entry]
  });
}

/**
 * Versioning helper. Appends an uploaded document entry to history.
 * Automatically computes version number and updates main URL field to maintain backwards compatibility.
 */
export async function addDocumentToHistory(eventId, url, type, uploadedBy, title = null) {
  if (!eventId || !url) return;
  const eventRef = doc(db, 'events', eventId);
  const snap = await getDoc(eventRef);
  if (!snap.exists()) return;
  const currentData = snap.data();
  const currentHistory = Array.isArray(currentData.documentHistory) ? currentData.documentHistory : [];

  // Filter history to find items of same type and title (if custom)
  const existingDocs = currentHistory.filter(docItem => {
    if (docItem.type !== type) return false;
    if (type === 'custom_clearance') {
      return docItem.title === title;
    }
    return true;
  });

  const nextVersion = existingDocs.length + 1;

  const newDocEntry = {
    url,
    type,
    version: nextVersion,
    uploadedAt: Timestamp.fromDate(new Date()),
    uploadedBy: uploadedBy || 'Council',
    title: title || null
  };

  const updatedHistory = [...currentHistory, newDocEntry];
  const updates = {
    documentHistory: updatedHistory
  };

  // Update corresponding legacy field for backwards compatibility
  if (type === 'proposal') {
    updates.eventDescriptionUrl = url;
  } else if (type === 'dosw_clearance') {
    updates.doswPermissionLetterUrl = url;
  } else if (type === 'report') {
    updates.reportPdfUrl = url;
  } else if (type === 'attendance_waiver') {
    updates.attendanceWaiverUrl = url;
  } else if (type === 'other_document') {
    updates.otherDocumentUrl = url;
  } else if (type === 'custom_clearance') {
    const customList = Array.isArray(currentData.customPermissionLetters) ? [...currentData.customPermissionLetters] : [];
    const existingIndex = customList.findIndex(item => item.title === title);
    if (existingIndex > -1) {
      customList[existingIndex] = { title, url };
    } else {
      customList.push({ title, url });
    }
    updates.customPermissionLetters = customList;
  }

  await updateDoc(eventRef, updates);
  return nextVersion;
}

/**
 * Creates or modifies an event proposal request in Firestore.
 * Sets status to 'submitted' / 'resubmitted' and creates/updates the document.
 */
export async function createEventRequest(data) {
  const eventId = data.eventId || await generateEventId();
  const eventRef = doc(db, 'events', eventId);
  const snap = await getDoc(eventRef);
  const isExisting = snap.exists();
  const existingData = isExisting ? snap.data() : {};

  let processedSessions = null;
  if (data.isMultiSession && Array.isArray(data.eventSessions) && data.eventSessions.length > 0) {
    processedSessions = data.eventSessions.map((s, idx) => ({
      sessionName: s.sessionName ? s.sessionName.trim() : `Session ${idx + 1}`,
      startDate: toTimestamp(s.startDate),
      endDate: toTimestamp(s.endDate),
      venue: s.venue ? s.venue.trim() : ''
    }));
  }

  let finalStartDate = toTimestamp(data.startDate);
  let finalEndDate = toTimestamp(data.endDate);

  if (processedSessions && processedSessions.length > 0) {
    const sorted = [...processedSessions].sort((a, b) => {
      const ta = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
      const tb = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
      return ta - tb;
    });
    finalStartDate = sorted[0].startDate;
    finalEndDate = sorted[sorted.length - 1].endDate;
  }

  const isTest = Boolean(
    data.isTestCouncil ||
    data.is_test ||
    (data.councilId || '').toLowerCase().includes('test') ||
    (data.councilName || '').toLowerCase().includes('test') ||
    (data.councilEmail || '').toLowerCase().includes('test')
  );

  // If status is revision_needed, we are resubmitting
  const wasRevisionRequested = existingData.status === 'revision_needed';
  const newStatus = wasRevisionRequested ? 'submitted' : (existingData.status || 'submitted');

  const finalData = {
    ...data,
    eventId,
    isTestCouncil: isTest,
    isMultiSession: Boolean(data.isMultiSession && processedSessions && processedSessions.length > 0),
    eventSessions: processedSessions,
    startDate: finalStartDate,
    endDate: finalEndDate,
    expectedFootfall: Number(data.expectedFootfall) || 0,
    prizeMoneyApplicable: Boolean(data.prizeMoneyApplicable),
    prizeMoneyAmount: data.prizeMoneyAmount ? Number(data.prizeMoneyAmount) : null,
    registrationFeeApplicable: Boolean(data.registrationFeeApplicable),
    registrationFeeAmount: data.registrationFeeAmount ? Number(data.registrationFeeAmount) : null,
    attendanceWaiverApplicable: Boolean(data.attendanceWaiverApplicable),
    guestApplicable: Boolean(data.guestApplicable),
    externalParticipantsApplicable: Boolean(data.externalParticipantsApplicable),
    externalParticipantsExpected: data.externalParticipantsExpected ? Number(data.externalParticipantsExpected) : null,
    venuePermissionApplicable: Boolean(data.venuePermissionApplicable),
    safetyArrangementNeeded: Boolean(data.safetyArrangementNeeded),
    status: newStatus,
    stage1Approvals: wasRevisionRequested ? {} : (existingData.stage1Approvals || {}), // Reset approvals on revision resubmission
    stage2Approvals: existingData.stage2Approvals || {},
    stage3Approvals: existingData.stage3Approvals || {},
    reviewHistory: existingData.reviewHistory || [],
    documentHistory: existingData.documentHistory || [],
    auditLog: existingData.auditLog || [],
    createdAt: existingData.createdAt || serverTimestamp()
  };

  await setDoc(eventRef, finalData);

  // Document versioning and audit log tracking
  const performer = { name: data.councilName, role: 'council' };
  const detailsStr = wasRevisionRequested ? 'Stage 1 Proposal resubmitted after revision request.' : 'Initial Stage 1 Proposal submitted.';
  const eventType = wasRevisionRequested ? 'resubmitted' : 'submitted';

  // Log the action
  await addAuditLogEntry(eventId, eventType, performer, detailsStr, 1);

  // If new proposal document URL is uploaded
  if (data.eventDescriptionUrl && data.eventDescriptionUrl !== existingData.eventDescriptionUrl) {
    await addDocumentToHistory(eventId, data.eventDescriptionUrl, 'proposal', `${data.councilName} (Council)`);
  }
  // If attendance waiver URL is uploaded
  if (data.attendanceWaiverUrl && data.attendanceWaiverUrl !== existingData.attendanceWaiverUrl) {
    await addDocumentToHistory(eventId, data.attendanceWaiverUrl, 'attendance_waiver', `${data.councilName} (Council)`);
  }

  return { id: eventId, ...finalData };
}

/**
 * Deletes an event proposal request from Firestore.
 */
export async function deleteEventRequest(eventId) {
  if (!eventId) return;
  const eventRef = doc(db, 'events', eventId);
  const snap = await getDoc(eventRef);
  
  if (snap.exists()) {
    const data = snap.data();
    const status = data.status;
    if (!['submitted', 'revision_needed', 'rejected'].includes(status)) {
      throw new Error('Deletion restricted: Proposal cannot be deleted once Stage 1 has been approved.');
    }
    await deleteDoc(eventRef);
  }
}

/**
 * Deletes a closed or rejected event from Firestore (Admin feature).
 */
export async function deleteArchivedEvent(eventId) {
  if (!eventId) return;
  const eventRef = doc(db, 'events', eventId);
  const snap = await getDoc(eventRef);
  
  if (snap.exists()) {
    const data = snap.data();
    if (!['closed', 'rejected'].includes(data.status)) {
      throw new Error('Deletion restricted: Only closed or rejected events can be deleted with this feature.');
    }
    await deleteDoc(eventRef);
  }
}



/**
 * Retrieves all events for a specific council.
 * Uses client-side sorting to bypass composite index constraints.
 */
export async function getEventsByCouncil(councilId) {
  const q = query(
    collection(db, 'events'),
    where('councilId', '==', councilId)
  );

  const querySnapshot = await getDocs(q);
  const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Client-side sort by createdAt descending
  return results.sort((a, b) => {
    const tA = a.createdAt?.seconds || 0;
    const tB = b.createdAt?.seconds || 0;
    return tB - tA;
  });
}

/**
 * Real-time subscription for events belonging to a specific council.
 */
export function subscribeToEventsByCouncil(councilId, callback) {
  const q = query(
    collection(db, 'events'),
    where('councilId', '==', councilId)
  );

  return onSnapshot(q, (querySnapshot) => {
    const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const sorted = results.sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });
    callback(sorted);
  }, (err) => {
    console.error('Error in subscribeToEventsByCouncil:', err);
  });
}

/**
 * Real-time subscription for all events in the system.
 */
export function subscribeToAllEvents(callback) {
  const q = collection(db, 'events');

  return onSnapshot(q, (querySnapshot) => {
    const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const sorted = results.sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });
    callback(sorted);
  }, (err) => {
    console.error('Error in subscribeToAllEvents:', err);
  });
}

/**
 * Retrieves all events matching optional status, councilId, and date range filters.
 * Filters multi-field queries client-side to ensure out-of-the-box operation without requiring composite indexes.
 */
export async function getAllEvents(filters = {}) {
  let q = collection(db, 'events');
  
  // Apply a single index filter in Firestore if possible
  if (filters.status && filters.status !== 'All') {
    q = query(q, where('status', '==', filters.status));
  } else if (filters.councilId) {
    q = query(q, where('councilId', '==', filters.councilId));
  }
  
  const querySnapshot = await getDocs(q);
  let results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Apply secondary filters client-side
  if (filters.status && filters.status !== 'All' && filters.councilId) {
    results = results.filter(e => e.councilId === filters.councilId);
  }
  
  if (filters.startDate) {
    const filterStart = new Date(filters.startDate).getTime();
    results = results.filter(e => {
      const start = e.startDate?.toDate ? e.startDate.toDate().getTime() : new Date(e.startDate).getTime();
      return start >= filterStart;
    });
  }
  
  if (filters.endDate) {
    const filterEnd = new Date(filters.endDate).getTime();
    results = results.filter(e => {
      const end = e.endDate?.toDate ? e.endDate.toDate().getTime() : new Date(e.endDate).getTime();
      return end <= filterEnd;
    });
  }
  
  // Sort by createdAt descending
  return results.sort((a, b) => {
    const tA = a.createdAt?.seconds || 0;
    const tB = b.createdAt?.seconds || 0;
    return tB - tA;
  });
}

/**
 * Updates status and notes for an event proposal with dual approval tracking.
 * Stage 1 or Stage 2 transitions to fully approved ONLY when both DOSW and StuCo approve.
 *
 * Returns the updated event data including a `_dualApprovalResult` field:
 *   - 'fully_approved' — both admins approved, status transitioned
 *   - 'partial' — only one admin approved so far, status unchanged
 *   - null — action was not an approval (rejection, revision, etc.)
 */
export async function updateEventStatus(eventId, actionStatus, reviewNotes = '', adminInfo = {}) {
  const eventRef = doc(db, 'events', eventId);
  const snap = await getDoc(eventRef);
  if (!snap.exists()) throw new Error('Event not found.');

  const currentData = snap.data();
  const role = adminInfo.role || 'super_admin';
  const adminName = adminInfo.name || (role === 'dosw' ? "Dean of Students' Welfare" : role === 'stuco' ? "Students' Council" : "Super Admin");

  const nowTs = Timestamp.fromDate(new Date());

  const currentHistory = Array.isArray(currentData.reviewHistory) ? currentData.reviewHistory : [];
  const currentStage1Approvals = currentData.stage1Approvals || {};
  const currentStage2Approvals = currentData.stage2Approvals || {};
  const currentStage3Approvals = currentData.stage3Approvals || {};

  const newHistoryEntry = {
    adminRole: role,
    adminName: adminName,
    status: actionStatus,
    notes: reviewNotes || null,
    timestamp: nowTs
  };

  const updates = {
    reviewNotes: reviewNotes || null,
    reviewedByRole: role,
    reviewedByName: adminName,
    reviewedAt: nowTs,
    reviewHistory: [...currentHistory, newHistoryEntry]
  };

  let dualApprovalResult = null;
  const performer = { name: adminName, role };

  if (actionStatus === 'proposal_approved') {
    const updatedStage1 = {
      ...currentStage1Approvals,
      [role]: { approved: true, timestamp: nowTs, adminName, notes: reviewNotes || null }
    };
    if (role === 'super_admin') {
      updatedStage1.dosw = { approved: true, timestamp: nowTs, adminName, notes: reviewNotes || null, viaSuperAdmin: true };
      updatedStage1.stuco = { approved: true, timestamp: nowTs, adminName, notes: reviewNotes || null, viaSuperAdmin: true };
    }
    updates.stage1Approvals = updatedStage1;

    const bothApproved = Boolean(updatedStage1.dosw?.approved && updatedStage1.stuco?.approved);
    if (bothApproved) {
      updates.status = 'proposal_approved';
      dualApprovalResult = 'fully_approved';
      await addAuditLogEntry(eventId, 'approved', performer, 'Stage 1 Proposal fully approved.', 1);
    } else {
      dualApprovalResult = 'partial';
      await addAuditLogEntry(eventId, 'approved', performer, `Stage 1 Proposal partially approved by ${role.toUpperCase()}.`, 1);
    }
  } else if (actionStatus === 'approved') {
    const updatedStage2 = {
      ...currentStage2Approvals,
      [role]: { approved: true, timestamp: nowTs, adminName, notes: reviewNotes || null }
    };
    if (role === 'super_admin') {
      updatedStage2.dosw = { approved: true, timestamp: nowTs, adminName, notes: reviewNotes || null, viaSuperAdmin: true };
      updatedStage2.stuco = { approved: true, timestamp: nowTs, adminName, notes: reviewNotes || null, viaSuperAdmin: true };
    }
    updates.stage2Approvals = updatedStage2;

    const bothApproved = Boolean(updatedStage2.dosw?.approved && updatedStage2.stuco?.approved);
    if (bothApproved) {
      updates.status = 'approved';
      // Calculate report due date: 10 days after the last date of the event chosen in calendar
      let lastEventDate = currentData.endDate?.toDate ? currentData.endDate.toDate() : (currentData.endDate ? new Date(currentData.endDate) : null);
      if (currentData.isMultiSession && Array.isArray(currentData.eventSessions) && currentData.eventSessions.length > 0) {
        const sessionEndDates = currentData.eventSessions
          .map(s => s.endDate?.toDate ? s.endDate.toDate() : (s.endDate ? new Date(s.endDate) : null))
          .filter(Boolean);
        if (sessionEndDates.length > 0) {
          lastEventDate = new Date(Math.max(...sessionEndDates.map(d => d.getTime())));
        }
      }
      const baseDate = lastEventDate || new Date();
      const dueDateJS = new Date(baseDate.getTime() + 10 * 24 * 60 * 60 * 1000);
      updates.reportDueDate = Timestamp.fromDate(dueDateJS);
      dualApprovalResult = 'fully_approved';
      await addAuditLogEntry(eventId, 'approved', performer, 'Stage 2 Clearance Documents fully approved.', 2);
    } else {
      dualApprovalResult = 'partial';
      await addAuditLogEntry(eventId, 'approved', performer, `Stage 2 Clearance Documents partially approved by ${role.toUpperCase()}.`, 2);
    }
  } else if (actionStatus === 'closed') {
    const updatedStage3 = {
      ...currentStage3Approvals,
      [role]: { approved: true, timestamp: nowTs, adminName, notes: reviewNotes || null }
    };
    if (role === 'super_admin') {
      updatedStage3.dosw = { approved: true, timestamp: nowTs, adminName, notes: reviewNotes || null, viaSuperAdmin: true };
      updatedStage3.stuco = { approved: true, timestamp: nowTs, adminName, notes: reviewNotes || null, viaSuperAdmin: true };
    }
    updates.stage3Approvals = updatedStage3;

    const bothApproved = Boolean(updatedStage3.dosw?.approved && updatedStage3.stuco?.approved);
    if (bothApproved) {
      updates.status = 'report_approved';
      dualApprovalResult = 'fully_approved';
      await addAuditLogEntry(eventId, 'approved', performer, 'Stage 3 Wrap-up Report approved.', 3);
    } else {
      dualApprovalResult = 'partial';
      await addAuditLogEntry(eventId, 'approved', performer, `Stage 3 Wrap-up Report partially approved by ${role.toUpperCase()}.`, 3);
    }
  } else if (actionStatus === 'revision_needed') {
    updates.status = 'revision_needed';
    updates.stage1Approvals = {};
    await addAuditLogEntry(eventId, 'revision_requested', performer, `Stage 1 Proposal revision requested: ${reviewNotes}`, 1);
  } else if (actionStatus === 'permissions_revision_needed') {
    updates.status = 'permissions_revision_needed';
    updates.stage2Approvals = {};
    await addAuditLogEntry(eventId, 'revision_requested', performer, `Stage 2 Clearance Documents revision requested: ${reviewNotes}`, 2);
  } else if (actionStatus === 'report_revision_needed') {
    updates.status = 'report_revision_needed';
    updates.stage3Approvals = {};
    await addAuditLogEntry(eventId, 'revision_requested', performer, `Stage 3 Report revision requested: ${reviewNotes}`, 3);
  } else if (actionStatus === 'rejected') {
    updates.status = 'rejected';
    await addAuditLogEntry(eventId, 'rejected', performer, `Proposal rejected: ${reviewNotes}`, getEventStageNum(currentData.status));
  } else if (actionStatus === 'submitted') {
    updates.status = 'submitted';
    const updatedStage1 = { ...currentStage1Approvals };
    delete updatedStage1[role];
    delete updatedStage1.super_admin;
    if (role === 'super_admin') {
      delete updatedStage1.dosw;
      delete updatedStage1.stuco;
    }
    updates.stage1Approvals = updatedStage1;
    await addAuditLogEntry(eventId, 'reverted', performer, `Stage 1 Approval reverted by ${role.toUpperCase()}.`, 1);
  } else if (actionStatus === 'permissions_submitted') {
    updates.status = 'permissions_submitted';
    const updatedStage2 = { ...currentStage2Approvals };
    delete updatedStage2[role];
    delete updatedStage2.super_admin;
    if (role === 'super_admin') {
      delete updatedStage2.dosw;
      delete updatedStage2.stuco;
    }
    updates.stage2Approvals = updatedStage2;
    await addAuditLogEntry(eventId, 'reverted', performer, `Stage 2 Approval reverted by ${role.toUpperCase()}.`, 2);
  } else if (actionStatus === 'report_submitted') {
    updates.status = 'report_submitted';
    const updatedStage3 = { ...currentStage3Approvals };
    delete updatedStage3[role];
    delete updatedStage3.super_admin;
    if (role === 'super_admin') {
      delete updatedStage3.dosw;
      delete updatedStage3.stuco;
    }
    updates.stage3Approvals = updatedStage3;
    await addAuditLogEntry(eventId, 'reverted', performer, `Stage 3 Approval reverted by ${role.toUpperCase()}.`, 3);
  } else {
    updates.status = actionStatus;
  }

  await updateDoc(eventRef, updates);
  return { ...currentData, ...updates, _dualApprovalResult: dualApprovalResult };
}

// Helper to determine stage number based on status
function getEventStageNum(status) {
  if (['permissions_submitted', 'permissions_revision_needed', 'approved'].includes(status)) return 2;
  if (['report_pending', 'report_submitted', 'report_revision_needed', 'report_approved', 'closed'].includes(status)) return 3;
  return 1;
}

/**
 * Submits the event report. Sets the status to 'report_submitted'.
 */
export async function submitReport(eventId, reportPdfUrl = null, reportImageUrls = []) {
  const eventRef = doc(db, 'events', eventId);
  const snap = await getDoc(eventRef);
  if (!snap.exists()) throw new Error('Event not found.');
  const eventData = snap.data();

  const wasRevisionRequested = eventData.status === 'report_revision_needed';
  const performer = { name: eventData.councilName, role: 'council' };
  const detailsStr = wasRevisionRequested 
    ? 'Stage 3 Report resubmitted after revision request.' 
    : 'Stage 3 Report submitted.';

  await updateDoc(eventRef, {
    reportPdfUrl,
    reportImageUrls: reportImageUrls || [],
    reportSubmittedAt: Timestamp.fromDate(new Date()),
    status: 'report_submitted',
    stage3Approvals: {}
  });

  await addAuditLogEntry(eventId, wasRevisionRequested ? 'resubmitted' : 'report_submitted', performer, detailsStr, 3);
  if (reportPdfUrl) {
    await addDocumentToHistory(eventId, reportPdfUrl, 'report', `${eventData.councilName} (Council)`);
  }
}

/**
 * Submits the event permission letters. Sets the status to 'permissions_submitted'.
 */
export async function submitPermissionLetters(eventId, urls) {
  const eventRef = doc(db, 'events', eventId);
  const snap = await getDoc(eventRef);
  if (!snap.exists()) throw new Error('Event not found.');
  const eventData = snap.data();

  const wasRevisionRequested = eventData.status === 'permissions_revision_needed';
  const performer = { name: eventData.councilName, role: 'council' };
  const detailsStr = wasRevisionRequested 
    ? 'Stage 2 clearance documents resubmitted after revision request.' 
    : 'Stage 2 clearance documents uploaded.';

  await updateDoc(eventRef, {
    doswPermissionLetterUrl: urls.doswPermissionLetterUrl || null,
    otherDocumentUrl: urls.otherDocumentUrl || null,
    customPermissionLetters: urls.customPermissionLetters || [],
    permissionsSubmittedAt: Timestamp.fromDate(new Date()),
    status: 'permissions_submitted',
    stage2Approvals: {}
  });

  await addAuditLogEntry(eventId, wasRevisionRequested ? 'resubmitted' : 'document_uploaded', performer, detailsStr, 2);

  const councilLabel = `${eventData.councilName} (Council)`;
  if (urls.doswPermissionLetterUrl) {
    await addDocumentToHistory(eventId, urls.doswPermissionLetterUrl, 'dosw_clearance', councilLabel);
  }
  if (urls.otherDocumentUrl) {
    await addDocumentToHistory(eventId, urls.otherDocumentUrl, 'other_document', councilLabel);
  }
  if (Array.isArray(urls.customPermissionLetters)) {
    for (const docItem of urls.customPermissionLetters) {
      if (docItem.url) {
        await addDocumentToHistory(eventId, docItem.url, 'custom_clearance', councilLabel, docItem.title);
      }
    }
  }
}

/**
 * Uploads a file to Cloudinary with fallback to Firebase Storage.
 */
export async function uploadToFirebaseStorage(file, folder) {
  const fileExt = file.name ? file.name.split('.').pop() : 'pdf';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const storageRef = ref(storage, `${folder}/${fileName}`);
  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
}

export async function uploadFile(file, folder) {
  if (!file) throw new Error('No file provided for upload.');

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    console.warn('Cloudinary environment variables missing. Falling back to Firebase Storage.');
    return await uploadToFirebaseStorage(file, folder);
  }

  // Use 'auto' endpoint to support images and raw files (PDFs) without raw unsigned preset restriction errors
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      console.warn('Cloudinary upload error:', data.error?.message, 'Falling back to Firebase Storage.');
      return await uploadToFirebaseStorage(file, folder);
    }

    if (!data.secure_url) {
      console.warn('Cloudinary response missing secure_url. Falling back to Firebase Storage.');
      return await uploadToFirebaseStorage(file, folder);
    }

    return data.secure_url;
  } catch (err) {
    console.error('Cloudinary upload exception:', err, 'Falling back to Firebase Storage.');
    try {
      return await uploadToFirebaseStorage(file, folder);
    } catch (fbErr) {
      console.error('Firebase Storage fallback failed:', fbErr);
      throw new Error(`File upload failed: ${err.message || fbErr.message}`);
    }
  }
}


// ─── BLOCKED DATES ────────────────────────────────────────────────────────────

/**
 * Real-time subscription for all admin-blocked date ranges.
 * Publicly readable — councils use this to see unavailable dates.
 */
export function subscribeToBlockedDates(callback) {
  const q = query(
    collection(db, 'blockedDates'),
    orderBy('startDate', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const results = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(results);
  }, (err) => {
    console.error('Error in subscribeToBlockedDates:', err);
  });
}

/**
 * Creates a new blocked date range in Firestore.
 * Only called from the admin panel (passcode-gated UI).
 */
export async function addBlockedDate({ startDate, endDate, reason }) {
  const ref = doc(collection(db, 'blockedDates'));
  await setDoc(ref, {
    startDate: toTimestamp(startDate),
    endDate: toTimestamp(endDate),
    reason: reason || 'Blocked by Administration',
    blockedBy: 'admin',
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Deletes a blocked date range document.
 */
export async function deleteBlockedDate(id) {
  await deleteDoc(doc(db, 'blockedDates', id));
}

/**
 * Updates public event details (poster, registration fees, coordinators).
 */
export async function updateEventDetails(eventId, details) {
  const eventRef = doc(db, 'events', eventId);
  const snap = await getDoc(eventRef);
  let oldStatus = '';
  let councilName = 'Council';
  if (snap.exists()) {
    const data = snap.data();
    oldStatus = data.status;
    councilName = data.councilName || 'Council';
  }

  await updateDoc(eventRef, details);

  if (details.status === 'closed' && oldStatus !== 'closed') {
    const performer = { name: councilName, role: 'council' };
    await addAuditLogEntry(eventId, 'closed', performer, 'Event closed and archived.', 3);
  }
}

/**
 * Formats a session name consistently (e.g. "Day 1", "Day 2: Workshop", etc.)
 */
export function formatSessionName(session, idx) {
  if (!session) return `Day ${idx + 1}`;
  const raw = (session.sessionName || '').trim();
  if (!raw) return `Day ${idx + 1}`;

  const lower = raw.toLowerCase();
  
  if (lower.includes('session') && lower.includes('day')) {
    const dayMatch = raw.match(/day\s*(\d+)/i);
    return dayMatch ? `Day ${dayMatch[1]}` : `Day ${idx + 1}`;
  }
  
  if (/^session\s*\d+$/i.test(raw)) {
    return `Day ${idx + 1}`;
  }

  if (/^day\s*\d+$/i.test(raw)) {
    return `Day ${idx + 1}`;
  }

  if (/^day\s*\d+/i.test(raw)) {
    return raw;
  }

  return `Day ${idx + 1}: ${raw}`;
}

/**
 * Formats a session date range intelligently (e.g. "Aug 13, 2026, 12:00 PM – 5:00 PM" if same day)
 */
export function formatSessionDateRange(startField, endField, formatEventDateFn) {
  if (!startField) return '';
  const startDate = startField.toDate ? startField.toDate() : new Date(startField);
  const endDate = endField ? (endField.toDate ? endField.toDate() : new Date(endField)) : null;

  if (isNaN(startDate.getTime())) return '';

  if (!endDate || isNaN(endDate.getTime())) {
    return formatEventDateFn ? formatEventDateFn(startField) : startDate.toLocaleString();
  }

  const isSameDay = startDate.getFullYear() === endDate.getFullYear() &&
                    startDate.getMonth() === endDate.getMonth() &&
                    startDate.getDate() === endDate.getDate();

  if (isSameDay && formatEventDateFn) {
    const formattedStart = formatEventDateFn(startDate);
    const formattedEndTime = formatEventDateFn(endDate, 'h:mm a');
    return `${formattedStart} – ${formattedEndTime}`;
  }

  if (formatEventDateFn) {
    return `${formatEventDateFn(startDate)} – ${formatEventDateFn(endDate)}`;
  }

  return `${startDate.toLocaleString()} – ${endDate.toLocaleString()}`;
}

/**
 * Resets an event status to target stage and clears all review history / feedback notes.
 */
export async function resetEventStageAndClearHistory(eventId, targetStatus = 'proposal_approved') {
  const eventRef = doc(db, 'events', eventId);
  await updateDoc(eventRef, {
    status: targetStatus,
    reviewNotes: null,
    reviewHistory: [],
    reviewedByRole: null,
    reviewedByName: null,
    reviewedAt: null
  });
}
