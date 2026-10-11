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
export const db = getFirestore(
  app,
  (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-ecd18365-cd78-45d3-8f5b-ea40811a4d65'
);
export const auth = getAuth(app);

// Configure Google Auth Provider with Google Drive File Scope for automatic folder & backup management
export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const googleProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => googleProvider.addScope(scope));

// In-memory cache for Google OAuth access token (never stored in localStorage per security guidelines)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

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

export async function loginWithGoogle(
  rememberLogin = true
): Promise<{ user: User; accessToken: string | null }> {
  try {
    isSigningIn = true;
    if (rememberLogin) {
      await setPersistence(auth, browserLocalPersistence);
    }
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function ensureGoogleDriveAccessToken(): Promise<string> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  const result = await loginWithGoogle(true);
  if (!result.accessToken) {
    throw new Error('Izin akses Google Drive belum diberikan. Silakan klik tombol Hubungkan Google Drive.');
  }
  return result.accessToken;
}

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export async function logoutFirebase(): Promise<void> {
  localStorage.removeItem('bdi_saved_account');
  cachedAccessToken = null;
  await signOut(auth);
}

export function subscribeAuthState(callback: (user: User | null, token: string | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    if (!user && !isSigningIn) {
      cachedAccessToken = null;
    }
    callback(user, cachedAccessToken);
  });
}

// ==========================================
// GOOGLE DRIVE FOLDER & BACKUP HELPERS
// ==========================================

const DRIVE_FOLDER_NAME = 'BDI Daily Quran & Hadis Backup';
const DRIVE_BACKUP_FILENAME = 'bdi-daily-hadis-backup.json';

export interface GoogleDriveBackupInfo {
  folderId: string;
  folderName: string;
  folderLink: string;
  fileId: string | null;
  fileName: string;
  modifiedTime: string | null;
}

export async function getOrCreateGoogleDriveFolder(token: string): Promise<{
  folderId: string;
  folderName: string;
  folderLink: string;
}> {
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${DRIVE_FOLDER_NAME}' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&spaces=drive`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (searchRes.status === 401 || searchRes.status === 403) {
    cachedAccessToken = null;
    throw new Error('Sesi token Google Drive berakhir. Silakan klik lagi untuk menyegarkan izin Google Drive.');
  }

  if (!searchRes.ok) {
    throw new Error(`Gagal memeriksa folder Google Drive (HTTP ${searchRes.status})`);
  }

  const searchData = await searchRes.json();
  if (Array.isArray(searchData.files) && searchData.files.length > 0) {
    const f = searchData.files[0];
    return {
      folderId: f.id,
      folderName: f.name,
      folderLink: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`,
    };
  }

  // Create new folder automatically in user's Google Drive
  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );

  if (!createRes.ok) {
    throw new Error(`Gagal membuat folder di Google Drive (HTTP ${createRes.status})`);
  }

  const created = await createRes.json();
  return {
    folderId: created.id,
    folderName: created.name || DRIVE_FOLDER_NAME,
    folderLink: created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
  };
}

export async function inspectGoogleDriveBackup(token: string): Promise<GoogleDriveBackupInfo> {
  const folder = await getOrCreateGoogleDriveFolder(token);
  const fileQuery = encodeURIComponent(
    `'${folder.folderId}' in parents and name='${DRIVE_BACKUP_FILENAME}' and trashed=false`
  );
  const fileRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${fileQuery}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!fileRes.ok) {
    return {
      ...folder,
      fileId: null,
      fileName: DRIVE_BACKUP_FILENAME,
      modifiedTime: null,
    };
  }

  const fileData = await fileRes.json();
  const existingFile = Array.isArray(fileData.files) && fileData.files.length > 0 ? fileData.files[0] : null;
  return {
    ...folder,
    fileId: existingFile ? existingFile.id : null,
    fileName: DRIVE_BACKUP_FILENAME,
    modifiedTime: existingFile?.modifiedTime
      ? new Date(existingFile.modifiedTime).toLocaleString('id-ID')
      : null,
  };
}

export async function saveBackupToGoogleDrive(
  store: AppStoreData,
  label = 'Backup BDI Daily Quran & Hadis'
): Promise<GoogleDriveBackupInfo> {
  const token = await ensureGoogleDriveAccessToken();
  const info = await inspectGoogleDriveBackup(token);

  const backupEnvelope = {
    app: 'BDI Daily Quran & Hadis',
    version: '2.0',
    backupLabel: label,
    exportedAt: new Date().toISOString(),
    ownerEmail: auth.currentUser?.email || 'admin@bdi.id',
    hadithCount: store.hadiths.length,
    contactCount: store.contacts.length,
    store,
  };

  const fileContent = JSON.stringify(backupEnvelope, null, 2);
  const metadata = info.fileId
    ? { name: DRIVE_BACKUP_FILENAME, mimeType: 'application/json' }
    : { name: DRIVE_BACKUP_FILENAME, mimeType: 'application/json', parents: [info.folderId] };

  const boundary = 'bdi_drive_backup_boundary_' + Date.now();
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${fileContent}\r\n` +
    `--${boundary}--`;

  const uploadUrl = info.fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${info.fileId}?uploadType=multipart&fields=id,name,modifiedTime`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime`;

  const uploadRes = await fetch(uploadUrl, {
    method: info.fileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Gagal mengunggah backup ke Google Drive: ${errText.slice(0, 120)}`);
  }

  const uploaded = await uploadRes.json();

  // Also keep Firestore real-time mirror updated seamlessly for cross-device live sync
  try {
    await saveBackupToFirestore(store, label);
  } catch {
    // non-fatal if Firestore mirror fails
  }

  return {
    folderId: info.folderId,
    folderName: info.folderName,
    folderLink: info.folderLink,
    fileId: uploaded.id,
    fileName: uploaded.name || DRIVE_BACKUP_FILENAME,
    modifiedTime: uploaded.modifiedTime
      ? new Date(uploaded.modifiedTime).toLocaleString('id-ID')
      : new Date().toLocaleString('id-ID'),
  };
}

export async function loadBackupFromGoogleDrive(): Promise<{
  info: GoogleDriveBackupInfo;
  store: AppStoreData;
  backupLabel: string;
} | null> {
  const token = await ensureGoogleDriveAccessToken();
  const info = await inspectGoogleDriveBackup(token);

  if (!info.fileId) {
    return null;
  }

  const downloadRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${info.fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!downloadRes.ok) {
    throw new Error(`Gagal mengunduh file backup dari Google Drive (HTTP ${downloadRes.status})`);
  }

  const parsed = await downloadRes.json();
  const payload = (parsed?.store || parsed?.payload || parsed) as AppStoreData;
  if (!payload || !Array.isArray(payload.hadiths)) {
    throw new Error('Format file backup di Google Drive tidak valid.');
  }

  return {
    info,
    store: payload,
    backupLabel: parsed?.backupLabel || 'Backup Google Drive BDI',
  };
}

// ==========================================
// REAL-TIME SYNC & FIRESTORE MIRROR
// ==========================================

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
