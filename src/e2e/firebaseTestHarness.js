import { auth, db } from '@/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

export async function createTestUser({ email, password, displayName }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;
  await setDoc(doc(db, 'users', uid), {
    uid,
    email,
    fullName: displayName || email,
    status: 'active',
    ownerUid: uid,
    createdAt: new Date().toISOString(),
    createdBy: uid,
    updatedAt: new Date().toISOString(),
    updatedBy: uid,
  }, { merge: true });
  return { uid, email };
}

export async function loginTestUser({ email, password }) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return { uid: credential.user.uid, email: credential.user.email };
}

export async function logoutTestUser() {
  await signOut(auth);
}

export async function createOwnedCompany({ companyId, ownerUid, ownerEmail, name }) {
  const now = new Date().toISOString();
  await setDoc(doc(db, 'companies', companyId), {
    name,
    ownerUid,
    status: 'active',
    createdAt: now,
    createdBy: ownerUid,
    updatedAt: now,
    updatedBy: ownerUid,
  });
  await setDoc(doc(db, 'companyMembers', `${companyId}_${ownerUid}`), {
    companyId,
    userUid: ownerUid,
    userEmail: ownerEmail,
    role: 'owner',
    status: 'active',
    createdAt: now,
    createdBy: ownerUid,
    updatedAt: now,
    updatedBy: ownerUid,
  });
  return { id: companyId, name };
}

export async function addCompanyMember({ companyId, userUid, userEmail, role = 'viewer', actorUid }) {
  const now = new Date().toISOString();
  await setDoc(doc(db, 'companyMembers', `${companyId}_${userUid}`), {
    companyId,
    userUid,
    userEmail,
    role,
    status: 'active',
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });
}

export async function createAnalyzableDocument({ documentId, companyId, ownerUid, title = 'factura-e2e.pdf' }) {
  const now = new Date().toISOString();
  await setDoc(doc(db, 'documents', documentId), {
    companyId,
    ownerUid,
    title,
    contentType: 'application/pdf',
    fileSize: 100,
    fileType: 'pdf',
    status: 'pending',
    storagePath: `companies/${companyId}/documents/${documentId}/${title}`,
    createdAt: now,
    createdBy: ownerUid,
    updatedAt: now,
    updatedBy: ownerUid,
  });
}

export async function readDocument(documentId) {
  const snap = await getDoc(doc(db, 'documents', documentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function newCollectionDocId(collectionName) {
  return doc(collection(db, collectionName)).id;
}

export function serverNow() {
  return serverTimestamp();
}
