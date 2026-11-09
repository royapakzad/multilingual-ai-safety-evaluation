// services/orgService.ts
//
// Partner organizations ↔ Otari workspaces.
//
// Each partner (an NGO, regulator, UN agency…) gets its own Otari workspace and key, created by
// the lab admin in the Otari dashboard; the key is stored server-side as OTARI_KEY_<ORG_ID>.
// This collection only records WHICH org each evaluator belongs to:
//
//   orgMemberships/{lowercased email} = { orgId: "unesco", orgName: "UNESCO", updatedAt }
//
// Firestore rules (FIREBASE_SETUP.md) let only the admin write it and let each user read only
// their own entry — so an evaluator cannot move themselves into another org's budget. It is
// deliberately NOT a field on users/{uid}, which users can write themselves.

import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase.config';

export interface OrgMembership {
  email: string;
  orgId: string;
  orgName: string;
  updatedAt: string;
}

const COLLECTION = 'orgMemberships';

/** "UNESCO Bangkok" → "unesco_bangkok"; must match the OTARI_KEY_<ORG_ID> env var (uppercased). */
export const normalizeOrgId = (raw: string) => raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const otariEnvVarForOrg = (orgId: string) => `OTARI_KEY_${orgId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

export const listOrgMemberships = async (): Promise<OrgMembership[]> => {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs
    .map(d => ({ email: d.id, ...(d.data() as Omit<OrgMembership, 'email'>) }))
    .sort((a, b) => a.orgId.localeCompare(b.orgId) || a.email.localeCompare(b.email));
};

export const setOrgMembership = async (email: string, orgName: string): Promise<OrgMembership> => {
  const normalizedEmail = email.trim().toLowerCase();
  const orgId = normalizeOrgId(orgName);
  if (!normalizedEmail.includes('@')) throw new Error('Enter a valid email address.');
  if (!orgId) throw new Error('Enter an organization name.');
  const membership = { orgId, orgName: orgName.trim(), updatedAt: new Date().toISOString() };
  await setDoc(doc(db, COLLECTION, normalizedEmail), membership);
  return { email: normalizedEmail, ...membership };
};

export const removeOrgMembership = async (email: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, email.trim().toLowerCase()));
};
