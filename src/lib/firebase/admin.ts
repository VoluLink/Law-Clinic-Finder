import 'server-only';

import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import { firebaseConfig } from '@/lib/firebase/env';

let database: Firestore | undefined;

export function firebaseAdminApp() {
  if (getApps().length > 0) return getApp();
  const config = firebaseConfig();
  return initializeApp({
    credential: applicationDefault(),
    projectId: config.projectId,
    storageBucket: config.storageBucket,
  });
}

export const firebaseAdminAuth = () => getAuth(firebaseAdminApp());
export function firebaseFirestore(): Firestore {
  if (database) return database;
  const config = firebaseConfig();
  database = getFirestore(firebaseAdminApp(), config.databaseId);
  return database;
}
export const firebaseStorage = () => getStorage(firebaseAdminApp());
