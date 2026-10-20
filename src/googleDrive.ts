import { AppStoreData } from './types';

// ============================================================================
// Google Drive backup — TANPA Firebase.
// Login memakai Google Identity Services (GIS) dengan SATU OAuth Client ID
// bersama (identifier publik, aman dipasang di kode client-side), pola yang
// sama dengan aplikasi LinkHub & Puskesdoc. Origin GitHub Pages
// (ridgital-auto.github.io) sudah diotorisasi untuk client ID ini.
// ============================================================================

const GOOGLE_CLIENT_ID =
  '909196579559-egqlen997lr6a1jp9nrt0dagqvslksa9.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
// openid+email+profile: agar bisa membaca email & nama pengguna untuk label akun
const LOGIN_SCOPE = `${DRIVE_SCOPE} openid email profile`;

const ACCOUNT_KEY = 'bdi_saved_account';

export interface GoogleUser {
  email: string;
  displayName: string;
  uid: string;
  picture?: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

// Token akses OAuth hanya disimpan di memori (tidak di localStorage,
// sesuai pedoman keamanan). Setelah browser di-restart, pengguna login ulang
// untuk menyegarkan token; info akun dipulihkan dari localStorage.
let cachedAccessToken: string | null = null;
let cachedUser: GoogleUser | null = null;
let gisReady: Promise<void> | null = null;

function ensureGis(): Promise<void> {
  if (!gisReady) {
    gisReady = new Promise<void>((resolve, reject) => {
      let tries = 0;
      const timer = setInterval(() => {
        if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
          clearInterval(timer);
          resolve();
        } else if (++tries > 100) {
          clearInterval(timer);
          reject(new Error('Gagal memuat login Google. Periksa koneksi internet.'));
        }
      }, 100);
    });
  }
  return gisReady;
}

function persistAccount(user: GoogleUser | null) {
  try {
    if (user) {
      localStorage.setItem(
        ACCOUNT_KEY,
        JSON.stringify({ email: user.email, displayName: user.displayName, uid: user.uid })
      );
    } else {
      localStorage.removeItem(ACCOUNT_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

/** Pulihkan info akun dari localStorage saat aplikasi dibuka (token tetap perlu login ulang). */
export function restoreGoogleSession(): GoogleUser | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const info = JSON.parse(raw);
    if (!info || !info.email) return null;
    cachedUser = {
      email: info.email,
      displayName: info.displayName || info.email,
      uid: info.uid || info.email,
    };
    return cachedUser;
  } catch {
    return null;
  }
}

export function getGoogleUser(): GoogleUser | null {
  return cachedUser;
}

export async function loginWithGoogle(
  persistSession = true
): Promise<{ user: GoogleUser; accessToken: string | null }> {
  await ensureGis();
  const accessToken = await new Promise<string>((resolve, reject) => {
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: LOGIN_SCOPE,
        callback: (resp: any) => {
          if (resp && resp.access_token) resolve(resp.access_token);
          else reject(new Error('Login Google dibatalkan.'));
        },
      });
      client.requestAccessToken({ prompt: 'select_account consent' });
    } catch (e: any) {
      reject(new Error(e?.message || 'Gagal membuka login Google.'));
    }
  });

  cachedAccessToken = accessToken;

  let me: any = null;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) me = await res.json();
  } catch {
    me = null;
  }

  cachedUser = {
    email: me?.email || '',
    displayName: me?.name || me?.email || 'Admin BDI',
    uid: me?.email || me?.sub || 'google-user',
    picture: me?.picture,
  };
  if (persistSession) persistAccount(cachedUser);
  return { user: cachedUser, accessToken };
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

export async function logoutGoogle(): Promise<void> {
  if (cachedAccessToken) {
    fetch(`https://oauth2.googleapis.com/revoke?token=${cachedAccessToken}`, {
      method: 'POST',
    }).catch(() => {});
  }
  cachedAccessToken = null;
  cachedUser = null;
  persistAccount(null);
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
  label = 'Backup BDI Daily Quran & Hadis',
  opts: { force?: boolean } = {}
): Promise<GoogleDriveBackupInfo> {
  const token = await ensureGoogleDriveAccessToken();
  const info = await inspectGoogleDriveBackup(token);

  // Pengaman: jangan timpa backup Drive yang lebih kaya dengan data lokal yang kosong.
  // (Pernah kejadian: sesi baru dengan data lokal kosong menimpa backup berisi 48 kontak.)
  if (!opts.force && info.fileId) {
    try {
      const checkRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${info.fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (checkRes.ok) {
        const parsed = await checkRes.json();
        const remoteContacts = (parsed?.store?.contacts || parsed?.payload?.contacts || []).length;
        const localContacts = store.contacts?.length || 0;
        if (localContacts === 0 && remoteContacts > 0) {
          throw new Error(
            `Backup otomatis dibatalkan: data lokal kosong, backup Google Drive yang ada (${remoteContacts} kontak) dipertahankan.`
          );
        }
      }
    } catch (e: any) {
      if (e?.message?.startsWith('Backup otomatis dibatalkan')) throw e;
      // abaikan error pemeriksaan; lanjutkan upload
    }
  }

  const backupEnvelope = {
    app: 'BDI Daily Quran & Hadis',
    version: '2.0',
    backupLabel: label,
    exportedAt: new Date().toISOString(),
    ownerEmail: cachedUser?.email || 'admin@bdi.id',
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
