// services/accessRequestService.ts
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { adminCreateAccount } from './authService';
import { notifyAdminOfNewRequest, notifyUserOfApproval } from './emailService';

export interface AccessRequest {
  id: string;
  email: string;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export const submitAccessRequest = async (email: string, purpose: string): Promise<void> => {
  const cleanEmail = email.toLowerCase().trim();
  const cleanPurpose = purpose.trim();
  await addDoc(collection(db, 'accessRequests'), {
    email: cleanEmail,
    purpose: cleanPurpose,
    status: 'pending',
    createdAt: serverTimestamp()
  });
  // Best-effort: the request is already saved above regardless of whether email is configured.
  notifyAdminOfNewRequest(cleanEmail, cleanPurpose).catch((e) =>
    console.warn('Could not email admin about new access request (is EmailJS configured?):', e)
  );
};

export const listPendingAccessRequests = async (): Promise<AccessRequest[]> => {
  const q = query(
    collection(db, 'accessRequests'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      email: data.email,
      purpose: data.purpose,
      status: data.status,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? ''
    };
  });
};

const generateTempPassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
};

// Creates the account, marks the request approved, and emails the new user
// their temp password. Returns the temp password so the admin panel can also
// display it as a fallback in case the email doesn't go through.
export const approveAccessRequest = async (request: AccessRequest): Promise<string> => {
  const tempPassword = generateTempPassword();
  await adminCreateAccount(request.email, tempPassword);
  await updateDoc(doc(db, 'accessRequests', request.id), {
    status: 'approved',
    reviewedAt: serverTimestamp()
  });
  notifyUserOfApproval(request.email, tempPassword).catch((e) =>
    console.warn('Could not email new user their temp password (is EmailJS configured?):', e)
  );
  return tempPassword;
};

export const rejectAccessRequest = async (requestId: string): Promise<void> => {
  await updateDoc(doc(db, 'accessRequests', requestId), {
    status: 'rejected',
    reviewedAt: serverTimestamp()
  });
};
