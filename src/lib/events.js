/**
 * events.js - Firestore & Storage CRUD Data Layer Helpers
 */

import { 
  db 
} from './firebase';
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
 * Creates a new event proposal request in Firestore.
 * Sets status to 'submitted' and creates the document.
 */
export async function createEventRequest(data) {
  const eventId = data.eventId || await generateEventId();
  
  const finalData = {
    ...data,
    eventId,
    startDate: toTimestamp(data.startDate),
    endDate: toTimestamp(data.endDate),
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
    status: 'submitted',
    stage1Approvals: {},
    stage2Approvals: {},
    reviewHistory: [],
    createdAt: serverTimestamp()
  };

  // Use eventId as the document ID for clean URL structures and simple retrievals
  await setDoc(doc(db, 'events', eventId), finalData);
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

  if (actionStatus === 'proposal_approved') {
    // Stage 1 Approval
    const updatedStage1 = {
      ...currentStage1Approvals,
      [role]: { approved: true, timestamp: nowTs, adminName, notes: reviewNotes || null }
    };
    updates.stage1Approvals = updatedStage1;

    const doswApproved = updatedStage1.dosw?.approved || role === 'super_admin';
    const stucoApproved = updatedStage1.stuco?.approved || role === 'super_admin';

    if (doswApproved && stucoApproved) {
      updates.status = 'proposal_approved';
    } else {
      updates.status = 'submitted';
    }
  } else if (actionStatus === 'approved') {
    // Stage 2 Approval (Clearances Approved)
    const updatedStage2 = {
      ...currentStage2Approvals,
      [role]: { approved: true, timestamp: nowTs, adminName, notes: reviewNotes || null }
    };
    updates.stage2Approvals = updatedStage2;

    const doswApproved = updatedStage2.dosw?.approved || role === 'super_admin';
    const stucoApproved = updatedStage2.stuco?.approved || role === 'super_admin';

    if (doswApproved && stucoApproved) {
      updates.status = 'approved';
      const dueDateJS = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      updates.reportDueDate = Timestamp.fromDate(dueDateJS);
    } else {
      updates.status = 'permissions_submitted';
    }
  } else if (actionStatus === 'revision_needed') {
    updates.status = 'revision_needed';
    updates.stage1Approvals = {};
  } else if (actionStatus === 'permissions_revision_needed') {
    updates.status = 'permissions_revision_needed';
    updates.stage2Approvals = {};
  } else if (actionStatus === 'rejected') {
    updates.status = 'rejected';
  } else if (actionStatus === 'submitted') {
    updates.status = 'submitted';
    updates.stage1Approvals = {};
    updates.stage2Approvals = {};
  } else {
    updates.status = actionStatus;
  }

  await updateDoc(eventRef, updates);
  return { ...currentData, ...updates };
}

/**
 * Submits the event report. Sets the status to 'closed'.
 */
export async function submitReport(eventId, reportPdfUrl = null, reportImageUrls = []) {
  const eventRef = doc(db, 'events', eventId);
  
  await updateDoc(eventRef, {
    reportPdfUrl,
    reportImageUrls: reportImageUrls || [],
    reportSubmittedAt: Timestamp.fromDate(new Date()),
    status: 'closed'
  });
}

/**
 * Submits the event permission letters. Sets the status to 'permissions_submitted'.
 */
export async function submitPermissionLetters(eventId, urls) {
  const eventRef = doc(db, 'events', eventId);
  
  await updateDoc(eventRef, {
    doswPermissionLetterUrl: urls.doswPermissionLetterUrl || null,
    otherDocumentUrl: urls.otherDocumentUrl || null,
    customPermissionLetters: urls.customPermissionLetters || [],
    permissionsSubmittedAt: Timestamp.fromDate(new Date()),
    status: 'permissions_submitted'
  });
}

/**
 * Uploads a file to Cloudinary and returns its secure URL.
 * Automatically selects between auto (for images/etc.) and raw (for PDFs) resource types.
 */
export async function uploadFile(file, folder) {
  if (!file) throw new Error('No file provided for upload.');

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary environment variables VITE_CLOUDINARY_CLOUD_NAME or VITE_CLOUDINARY_UPLOAD_PRESET are missing.');
  }

  // Determine resource type: PDFs need raw to prevent image conversion
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const resourceType = isPdf ? 'raw' : 'auto';
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

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
      throw new Error(data.error?.message || `Cloudinary returned status ${response.status}`);
    }

    if (!data.secure_url) {
      throw new Error('Cloudinary response did not return a secure_url.');
    }

    return data.secure_url;
  } catch (err) {
    console.error('Cloudinary upload failure:', err);
    throw new Error(`File upload failed: ${err.message}`);
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
  await updateDoc(eventRef, details);
}
