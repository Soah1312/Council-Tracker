/**
 * seedData.js
 * Seeds Firestore with clean 3-stage flow events.
 */

import { db } from './firebase';
import { collection, doc, writeBatch, Timestamp } from 'firebase/firestore';

const ts = (year, month, day, hour = 9, min = 0) =>
  Timestamp.fromDate(new Date(year, month - 1, day, hour, min));

const now = Timestamp.now();

const DUMMY_PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
const DUMMY_IMG_1 = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800';
const DUMMY_IMG_2 = 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800';

export const SEED_EVENTS = [
  {
    eventId: 'EVT-2026-001',
    councilId: 'gdsc',
    councilName: 'GDSC',
    eventName: 'NextJS Architecture & AI Workshop',
    category: 'workshop',
    status: 'closed',
    startDate: ts(2026, 7, 10, 9),
    endDate: ts(2026, 7, 10, 17),
    eventDescriptionUrl: DUMMY_PDF,
    doswPermissionLetterUrl: DUMMY_PDF,
    councilPermissionLetterUrl: DUMMY_PDF,
    venuePermissionLetterUrl: DUMMY_PDF,
    permissionsSubmittedAt: ts(2026, 7, 2, 10),
    venue: 'Seminar Hall 1',
    reportDueDate: ts(2026, 7, 15),
    reportPdfUrl: DUMMY_PDF,
    reportSubmittedAt: ts(2026, 7, 11, 14),
    reportImageUrls: [DUMMY_IMG_1, DUMMY_IMG_2],
    createdAt: ts(2026, 7, 1, 9)
  },
  {
    eventId: 'EVT-2026-002',
    councilId: 'ieee-wie',
    councilName: 'IEEE & WIE',
    eventName: 'IoT Hackathon 2026',
    category: 'competition',
    status: 'approved',
    startDate: ts(2026, 7, 20, 9),
    endDate: ts(2026, 7, 20, 18),
    eventDescriptionUrl: DUMMY_PDF,
    doswPermissionLetterUrl: DUMMY_PDF,
    councilPermissionLetterUrl: DUMMY_PDF,
    venuePermissionLetterUrl: DUMMY_PDF,
    permissionsSubmittedAt: ts(2026, 7, 12, 14),
    venue: 'Electronics Lab',
    reportDueDate: ts(2026, 7, 25),
    createdAt: ts(2026, 7, 5, 9)
  },
  {
    eventId: 'EVT-2026-003',
    councilId: 'csi',
    councilName: 'CSI',
    eventName: 'National Code Sprint',
    category: 'competition',
    status: 'permissions_submitted',
    startDate: ts(2026, 7, 28, 10),
    endDate: ts(2026, 7, 28, 18),
    eventDescriptionUrl: DUMMY_PDF,
    doswPermissionLetterUrl: DUMMY_PDF,
    councilPermissionLetterUrl: DUMMY_PDF,
    venuePermissionLetterUrl: DUMMY_PDF,
    permissionsSubmittedAt: ts(2026, 7, 14, 11),
    createdAt: ts(2026, 7, 6, 12)
  },
  {
    eventId: 'EVT-2026-004',
    councilId: 'acm',
    councilName: 'ACM',
    eventName: 'Quantum Computing Seminar',
    category: 'guest_lecture',
    status: 'proposal_approved',
    startDate: ts(2026, 8, 5, 11),
    endDate: ts(2026, 8, 5, 14),
    eventDescriptionUrl: DUMMY_PDF,
    createdAt: ts(2026, 7, 10, 15)
  },
  {
    eventId: 'EVT-2026-005',
    councilId: 'asme',
    councilName: 'ASME',
    eventName: 'Robo-Design Challenge',
    category: 'competition',
    status: 'submitted',
    startDate: ts(2026, 8, 12, 9),
    endDate: ts(2026, 8, 12, 17),
    eventDescriptionUrl: DUMMY_PDF,
    createdAt: ts(2026, 7, 14, 10)
  },
  {
    eventId: 'EVT-2026-006',
    councilId: 'nss',
    councilName: 'NSS',
    eventName: 'Blood Donation Camp',
    category: 'cultural',
    status: 'revision_needed',
    startDate: ts(2026, 8, 20, 9),
    endDate: ts(2026, 8, 20, 16),
    eventDescriptionUrl: DUMMY_PDF,
    reviewNotes: 'Please attach a detailed list of collaborating hospitals in the description PDF.',
    createdAt: ts(2026, 7, 12, 8)
  },
  {
    eventId: 'EVT-2026-007',
    councilId: 'tedx',
    councilName: 'TEDx',
    eventName: 'TEDxCRCE 2026: Infinite Horizons',
    category: 'cultural',
    status: 'permissions_revision_needed',
    startDate: ts(2026, 8, 30, 9),
    endDate: ts(2026, 8, 30, 19),
    eventDescriptionUrl: DUMMY_PDF,
    doswPermissionLetterUrl: DUMMY_PDF,
    councilPermissionLetterUrl: DUMMY_PDF,
    venuePermissionLetterUrl: DUMMY_PDF,
    permissionsSubmittedAt: ts(2026, 7, 14, 16),
    reviewNotes: 'The venue booking slip is missing the principal\'s signature. Please re-upload with correct signature.',
    createdAt: ts(2026, 7, 8, 11)
  },
  {
    eventId: 'EVT-2026-008',
    councilId: 'e-cell',
    councilName: 'E-Cell',
    eventName: 'E-Summit Startup Expo',
    category: 'competition',
    status: 'closed',
    startDate: ts(2026, 6, 15, 10),
    endDate: ts(2026, 6, 15, 18),
    eventDescriptionUrl: DUMMY_PDF,
    doswPermissionLetterUrl: DUMMY_PDF,
    councilPermissionLetterUrl: DUMMY_PDF,
    venuePermissionLetterUrl: DUMMY_PDF,
    permissionsSubmittedAt: ts(2026, 6, 8, 9),
    venue: 'Main Auditorium',
    reportDueDate: ts(2026, 6, 20),
    reportPdfUrl: DUMMY_PDF,
    reportSubmittedAt: ts(2026, 6, 16, 11),
    reportImageUrls: [DUMMY_IMG_1],
    createdAt: ts(2026, 6, 1, 9)
  },
  {
    eventId: 'EVT-2026-009',
    councilId: 'team-vaayushastra',
    councilName: 'Team Vaayushastra',
    eventName: 'Aero-Modeling Championship',
    category: 'competition',
    status: 'approved',
    startDate: ts(2026, 7, 15, 9),
    endDate: ts(2026, 7, 15, 17),
    eventDescriptionUrl: DUMMY_PDF,
    doswPermissionLetterUrl: DUMMY_PDF,
    councilPermissionLetterUrl: DUMMY_PDF,
    venuePermissionLetterUrl: DUMMY_PDF,
    permissionsSubmittedAt: ts(2026, 7, 8, 14),
    venue: 'Sports Ground',
    reportDueDate: ts(2026, 7, 24),
    createdAt: ts(2026, 7, 4, 10)
  }
];

export async function seedAllEvents() {
  console.log(`🌱 Starting batched seed: ${SEED_EVENTS.length} events...`);
  const eventsRef = collection(db, 'events');
  const batch = writeBatch(db);
  
  SEED_EVENTS.forEach((event) => {
    batch.set(doc(eventsRef, event.eventId), event);
  });

  try {
    await batch.commit();
    console.log(`\n🎉 Batched seed complete! ${SEED_EVENTS.length} events seeded in 1 write transaction.`);
    return { success: SEED_EVENTS.length, errors: 0 };
  } catch (err) {
    console.error('Batched seed error:', err);
    throw err;
  }
}
