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
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';

/**
 * Centralized list of all recognized Councils and Committees.
 * Fill in the `email` field for each council as you create accounts in Firebase Console.
 */
export const COUNCILS = [
  // Student Council / Main Bodies
  { id: 'stuco', name: "Students' Council CRCE", category: 'Main Council', email: 'frcrce.stuco@gmail.com', coordinator: 'Dr. Joseph Rodrigues' },

  // Professional Chapters
  { id: 'ieee-wie', name: 'IEEE & WIE', category: 'Professional Chapters', email: '', coordinator: 'Prof. Archana Lopes' },
  { id: 'csi', name: 'CSI CRCE', category: 'Professional Chapters', email: 'crce.csi@gmail.com', coordinator: 'Prof. Prajakta Dhamanskar' },
  { id: 'acm', name: 'ACM Student Chapter', category: 'Professional Chapters', email: 'acm.frcrce@gmail.com', coordinator: 'Prof. Sarika Davare' },
  { id: 'asme', name: 'ASME', category: 'Professional Chapters', email: 'crce.asme@gmail.com', coordinator: 'Dr. Dipali Bhise' },
  { id: 'e-cell', name: 'E-Cell CRCE', category: 'Professional Chapters', email: 'ecell.frcrce@gmail.com', coordinator: 'Dr. Prajakta Bhangale' },
  { id: 'fsai', name: 'FSAI', category: 'Professional Chapters', email: '', coordinator: 'Dr. Swapnali Makdey' },
  { id: 'finvest', name: 'FinVest Finance Council CRCE', category: 'Professional Chapters', email: 'finvest.crce@gmail.com', coordinator: '' },
  
  // Technical Teams
  { id: 'team-robix', name: 'Robix', category: 'Technical Teams', email: 'teamrobix25@gmail.com', coordinator: 'Dr. K. Sailakshmi Parvathi' },
  { id: 'team-abadha', name: 'Team Abadha CRCE', category: 'Technical Teams', email: 'teamabadha.crce@gmail.com', coordinator: 'Dr. V.B. Rao' },
  { id: 'team-cfr', name: 'CRCE Formula Racing Electric (Team CFR)', category: 'Technical Teams', email: 'teamcfr.fatheragnel@gmail.com', coordinator: 'Dr. Graham Koyeerath' },
  { id: 'team-vaayushastra', name: 'Team Vaayushastra', category: 'Technical Teams', email: 'vaayushastracrce@gmail.com', coordinator: 'Dr. Deepali Bhise' },
  { id: 'team-mavericks', name: 'Team Mavericks UAS', category: 'Technical Teams', email: 'mavericksuas@gmail.com', coordinator: 'Prof. Saurabh Kulkarni' },
  { id: 'crce-rocketry', name: 'CRCE Rocket Team', category: 'Technical Teams', email: 'crcerocketryteam@gmail.com', coordinator: '' },
  { id: 'project-cell', name: 'Project Cell', category: 'Technical Teams', email: 'projectcellcrce2024@gmail.com', coordinator: 'Prof. Vaibhav Godbole' },
  
  // Technical Student Clubs
  { id: 'codestorm', name: 'CodeStorm', category: 'Technical Student Clubs', email: 'codestorm.crce@gmail.com', coordinator: 'Dr. Roshni Padate' },
  { id: 'mozilla-codelabs', name: 'Mozilla & Codelabs', category: 'Technical Student Clubs', email: 'codestorm.crce@gmail.com', coordinator: 'Dr. Roshni Padate' },
  { id: 'gdg', name: 'GDG on Campus Fr. CRCE', category: 'Technical Student Clubs', email: 'gdgcrce@gmail.com', coordinator: 'Dr. Kalpana Deorukhkar' },
  { id: 'gda', name: 'GDA (GAME DEVELOPERS ASSOCIATION CRCE)', category: 'Technical Student Clubs', email: 'gda.crce2022@gmail.com', coordinator: 'Prof. Heenakausar Pendhari' },
  
  // Additional Societies & Clubs
  { id: 'nss', name: 'National Service Scheme (NSS)', category: 'Societies & Clubs', email: 'crce.nss@gmail.com', coordinator: 'Prof. Pradeep Singh' },
  { id: 'rotaract-club', name: 'Rotaract Club CRCE', category: 'Societies & Clubs', email: 'rotaractcrce@gmail.com', coordinator: 'Dr. Ketaki Joshi' },
  { id: 'tedx', name: 'TEDxCRCE', category: 'Societies & Clubs', email: 'tedxcrce26.27@gmail.com', coordinator: 'Prof. Savita Borole' }
];

/**
 * Centralized list of recognized Admin Accounts.
 */
export const ADMIN_ACCOUNTS = [
  {
    email: 'superadmin@gmail.com',
    role: 'super_admin',
    name: 'Super Administrator',
    badge: 'SUPER ADMIN',
    readOnly: false
  },
  {
    email: 'josephrodrigues@fragnel.edu.in',
    role: 'dosw',
    name: "Dean of Students' Welfare (DOSW)",
    badge: 'DOSW DEAN',
    readOnly: false
  },
  {
    email: 'frcrce.stuco@gmail.com',
    role: 'stuco',
    name: "Students' Council (StuCo)",
    badge: 'STUCO MAIN',
    readOnly: false
  },
  {
    email: 'principal.crce@fragnel.edu.in',
    role: 'principal',
    name: 'Principal CRCE',
    badge: 'PRINCIPAL',
    readOnly: true
  }
];

/**
 * Maps an admin email address to their role configuration object.
 */
export function getAdminRoleByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  return ADMIN_ACCOUNTS.find(a => a.email.toLowerCase() === cleanEmail) || null;
}

/**
 * Finds the exact council object mapped to an email address.
 * Falls back to matching council ID within email handle (e.g. crce.nss@gmail.com -> nss).
 */
export function getCouncilByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  
  // 1. Explicit email match
  const matched = COUNCILS.find(c => c.email && c.email.trim().toLowerCase() === cleanEmail);
  if (matched) return matched;

  // 2. Smart fallback: match council ID in email username (e.g. crce.nss@gmail.com -> nss)
  const username = cleanEmail.split('@')[0];
  const parts = username.split(/[._-]/);
  return COUNCILS.find(c => parts.includes(c.id) || parts.includes(c.id.replace(/-/g, ''))) || null;
}

/**
 * Authenticates a user with email and password via Firebase Auth.
 */
export async function loginWithEmail(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return userCredential.user;
}

/**
 * Registers a user with email and password via Firebase Auth.
 */
export async function registerWithEmail(email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
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
