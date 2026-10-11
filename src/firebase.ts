import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { AppStoreData } from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Ensure persistent login across browser restarts
setPersistence(auth, browserLocalPersistence).catch(() => {});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function loginWithGoogle(rememberLogin = true): Promise<User> {
  if (rememberLogin) {
    await setPersistence(auth, browserLocalPersistence);
  }
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logoutFirebase(): Promise<void> {
  localStorage.removeItem('bdi_saved_account');
  await signOut(auth);
}

export function subscribeAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Real-Time Listener for Multi-Device Sync (Android APK <-> Browser Web App)
export function subscribeRealtimeCloudSync(
  uid: string,
  onRemoteUpdate: (data: {
    backupLabel: string;
    updatedAtText: string;
    updatedAtMs: number;
    payload: AppStoreData;
  }) => void
): Unsubscribe {
  const cleanUid = uid.slice(0, 128);
  const path = `user_backups/${cleanUid}`;
  const docRef = doc(db, 'user_backups', cleanUid);

  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data?.payload) return;
      const updatedDate = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date();
      onRemoteUpdate({
        backupLabel: data.backupLabel || 'Real-time Sync BDI',
        updatedAtText: updatedDate.toLocaleTimeString('id-ID'),
        updatedAtMs: updatedDate.getTime(),
        payload: data.payload as AppStoreData,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// Save Cloud Backup adhering strictly to firebase-blueprint.json & firestore.rules
export async function saveBackupToFirestore(
  store: AppStoreData,
  label = 'Sinkronisasi Real-Time BDI Daily'
) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Silakan login dengan akun Google terlebih dahulu.');
  }

  const uid = user.uid.slice(0, 128);
  const path = `user_backups/${uid}`;
  const docRef = doc(db, 'user_backups', uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  const sanitizedLabel = (label || 'Backup BDI Daily').trim().slice(0, 160);
  const sanitizedEmail = (user.email || 'admin@bdi.id').trim().slice(0, 200);

  const payloadMap = {
    profiles: (store.profiles || ['Oktober', 'Belum Terkategori']).slice(0, 100),
    hadiths: store.hadiths.slice(0, 500),
    templates: store.templates.slice(0, 50),
    contacts: store.contacts.slice(0, 1000),
    projects: (store.projects || []).slice(0, 50),
    projectHistory: (store.projectHistory || []).slice(0, 150),
    schedule: store.schedule,
    gatewaySettings: store.gatewaySettings,
    externalSync: store.externalSync || {},
    deliveryLogs: store.deliveryLogs.slice(0, 150),
  };

  try {
    if (existingSnap && existingSnap.exists()) {
      const existingData = existingSnap.data();
      await setDoc(docRef, {
        ownerId: existingData.ownerId || uid,
        ownerEmail: sanitizedEmail,
        backupLabel: sanitizedLabel,
        hadithCount: Math.min(50000, store.hadiths.length),
        contactCount: Math.min(50000, store.contacts.length),
        templateCount: Math.min(1000, store.templates.length),
        payload: payloadMap,
        createdAt: existingData.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        ownerId: uid,
        ownerEmail: sanitizedEmail,
        backupLabel: sanitizedLabel,
        hadithCount: Math.min(50000, store.hadiths.length),
        contactCount: Math.min(50000, store.contacts.length),
        templateCount: Math.min(1000, store.templates.length),
        payload: payloadMap,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      existingSnap?.exists() ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function loadBackupFromFirestore(): Promise<{
  backupLabel: string;
  updatedAtText: string;
  hadithCount: number;
  contactCount: number;
  payload: AppStoreData;
} | null> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Silakan login dengan akun Google terlebih dahulu.');
  }

  const uid = user.uid.slice(0, 128);
  const path = `user_backups/${uid}`;
  const docRef = doc(db, 'user_backups', uid);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    const updatedDate = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date();
    return {
      backupLabel: data.backupLabel || 'Backup Cloud BDI',
      updatedAtText: updatedDate.toLocaleString('id-ID'),
      hadithCount: data.hadithCount || 0,
      contactCount: data.contactCount || 0,
      payload: data.payload as AppStoreData,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}
