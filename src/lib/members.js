/**
 * members.js - Data Layer for Managing Council Members in Firestore
 */

import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  query, 
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';

/**
 * Adds a new council member to Firestore.
 */
export async function addCouncilMember({ councilId, councilName, name, designation, contactNumber }) {
  const memberRef = doc(collection(db, 'councilMembers'));
  const normalizedCouncilId = (councilId || '').trim().toLowerCase();
  const memberData = {
    id: memberRef.id,
    councilId: normalizedCouncilId,
    councilName: councilName || '',
    name: name.trim(),
    designation: designation.trim(),
    contactNumber: contactNumber.trim(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(memberRef, memberData);
  return memberData;
}

/**
 * Updates an existing council member record.
 */
export async function updateCouncilMember(memberId, { name, designation, contactNumber }) {
  const memberRef = doc(db, 'councilMembers', memberId);
  await updateDoc(memberRef, {
    name: name.trim(),
    designation: designation.trim(),
    contactNumber: contactNumber.trim(),
    updatedAt: Timestamp.now(),
  });
}

/**
 * Deletes a council member record.
 */
export async function deleteCouncilMember(memberId) {
  if (!memberId) return;
  const memberRef = doc(db, 'councilMembers', memberId);
  await deleteDoc(memberRef);
}

/**
 * Subscribes to real-time council member updates for a specific council.
 */
export function subscribeToCouncilMembers(councilId, callback) {
  if (!councilId) {
    callback([]);
    return () => {};
  }

  const normalizedId = String(councilId).trim().toLowerCase();
  const q = query(collection(db, 'councilMembers'));

  return onSnapshot(q, (snapshot) => {
    const allMembers = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    const members = allMembers.filter(m => {
      const mId = String(m.councilId || '').trim().toLowerCase();
      return mId === normalizedId;
    });

    members.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    callback(members);
  }, (err) => {
    console.error('Error subscribing to council members:', err);
    callback([]);
  });
}

/**
 * Subscribes to all council members across all councils for the Admin Panel.
 */
export function subscribeToAllCouncilMembers(callback) {
  const q = query(collection(db, 'councilMembers'));

  return onSnapshot(q, (snapshot) => {
    const members = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    members.sort((a, b) => a.councilName.localeCompare(b.councilName));
    callback(members);
  }, (err) => {
    console.error('Error subscribing to all council members:', err);
    callback([]);
  });
}
