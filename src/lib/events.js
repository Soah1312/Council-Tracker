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
  const eventRef = doc(db, 'events', eventId);
  await deleteDoc(eventRef);
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
      if (!e.startDate) return false;
      const eventStart = e.startDate.toMillis ? e.startDate.toMillis() : new Date(e.startDate).getTime();
      return eventStart >= filterStart;
    });
  }
  
  if (filters.endDate) {
    const filterEnd = new Date(filters.endDate).getTime();
    results = results.filter(e => {
      if (!e.endDate) return false;
      const eventEnd = e.endDate.toMillis ? e.endDate.toMillis() : new Date(e.endDate).getTime();
      return eventEnd <= filterEnd;
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
 * Updates status and notes for an event proposal.
 * If status becomes 'approved', sets the reportDueDate to event.endDate + 7 days.
 */
export async function updateEventStatus(eventId, status, reviewNotes = '') {
  const eventRef = doc(db, 'events', eventId);
  
  const updates = {
    status,
    reviewNotes: reviewNotes || null,
    reviewedAt: Timestamp.fromDate(new Date())
  };
  
  if (status === 'approved') {
    const dueDateJS = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days from approval
    updates.reportDueDate = Timestamp.fromDate(dueDateJS);
  }
  
  await updateDoc(eventRef, updates);
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


