/**
 * auth.js
 * ───────
 * Firebase Authentication & Council Mapping Helper Module.
 */

import { auth } from './firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged 
} from 'firebase/auth';

/**
 * Centralized list of all recognized Councils and Committees.
 * Fill in the `email` field for each council as you create accounts in Firebase Console.
 */
export const COUNCILS = [
  // Student Council / Main Bodies
  { id: 'stuco', name: "Students' Council CRCE", category: 'Main Council', email: 'frcrce.stuco@gmail.com', coordinator: 'Dr. Swapnali Makdey' },

  // Professional Chapters
  { id: 'ieee-wie', name: 'IEEE & WIE', category: 'Professional Chapters', email: '', coordinator: 'Prof. Archana Lopes' },
  { id: 'csi', name: 'CSI', category: 'Professional Chapters', email: '', coordinator: 'Prof. Prajakta Dhamanskar' },
  { id: 'acm', name: 'ACM', category: 'Professional Chapters', email: '', coordinator: 'Prof. Sarika Davare' },
  { id: 'asme', name: 'ASME', category: 'Professional Chapters', email: '', coordinator: 'Dr. Dipali Bhise' },
  { id: 'e-cell', name: 'E-Cell', category: 'Professional Chapters', email: '', coordinator: 'Dr. Prajakta Bhangale' },
  { id: 'fsai', name: 'FSAI', category: 'Professional Chapters', email: '', coordinator: 'Dr. Swapnali Makdey' },
  
  // Technical Teams
  { id: 'team-robix', name: 'Team Robix', category: 'Technical Teams', email: '', coordinator: 'Dr. K. Sailakshmi Parvathi' },
  { id: 'team-abadha', name: 'Team Abadha', category: 'Technical Teams', email: '', coordinator: 'Dr. V.B. Rao' },
  { id: 'team-cfr', name: 'Team CFR', category: 'Technical Teams', email: '', coordinator: 'Dr. Graham Koyeerath' },
  { id: 'team-vaayushastra', name: 'Team Vaayushastra', category: 'Technical Teams', email: '', coordinator: 'Dr. Deepali Bhise' },
  { id: 'team-mavericks', name: 'Team Mavericks', category: 'Technical Teams', email: '', coordinator: 'Prof. Saurabh Kulkarni' },
  { id: 'project-cell', name: 'Project Cell', category: 'Technical Teams', email: '', coordinator: 'Prof. Vaibhav Godbole' },
  
  // Technical Student Clubs
  { id: 'mozilla-codelabs', name: 'Mozilla & Codelabs', category: 'Technical Student Clubs', email: '', coordinator: 'Dr. Roshni Padate' },
  { id: 'gdsc', name: 'GDSC', category: 'Technical Student Clubs', email: '', coordinator: 'Dr. Kalpana Deorukhkar' },
  { id: 'gda', name: 'GDA', category: 'Technical Student Clubs', email: '', coordinator: 'Prof. Heenakausar Pendhari' },
  
  // Additional Societies
  { id: 'nss', name: 'NSS', category: 'Societies & Clubs', email: '', coordinator: 'Prof. Pradeep Singh' },
  { id: 'rotaract-club', name: 'Rotaract Club', category: 'Societies & Clubs', email: '', coordinator: 'Dr. Ketaki Joshi' },
  { id: 'tedx', name: 'TEDx', category: 'Societies & Clubs', email: '', coordinator: 'Prof. Savita Borole' }
];

/**
 * Finds the exact council object mapped to an email address.
 * Returns null if the email is not explicitly assigned to any council.
 */
export function getCouncilByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  return COUNCILS.find(c => c.email && c.email.trim().toLowerCase() === cleanEmail) || null;
}

/**
 * Authenticates a user with email and password via Firebase Auth.
 */
export async function loginWithEmail(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return userCredential.user;
}

/**
 * Signs out the current user.
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Sends a password reset email to the given address via Firebase Auth.
 */
export async function sendPasswordReset(email) {
  if (!email || !email.trim()) {
    throw new Error('Please enter a valid email address to reset password.');
  }
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Listens to Firebase Auth state changes.
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
