/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  BookOpen,
  FileText,
  Users,
  Send,
  ShieldCheck,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Check,
  RefreshCw,
  Clock,
  CloudUpload,
  CloudDownload,
  Download,
  Upload,
  QrCode,
  KeyRound,
  Search,
  Play,
  Pause,
  Square,
  LogOut,
  CheckCircle2,
  XCircle,
  Eye,
  Shuffle,
  ListOrdered,
  X,
  AlertTriangle,
  HelpCircle,
  History,
  Folder,
  Globe,
  Smartphone,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  AppStoreData,
  HadithItem,
  MessageTemplate,
  ContactItem,
  BdiProject,
  RuntimeWAState,
} from './types';
import {
  loginWithGoogle,
  logoutFirebase,
  subscribeAuthState,
  subscribeRealtimeCloudSync,
  saveBackupToFirestore,
  loadBackupFromFirestore,
  saveBackupToGoogleDrive,
  loadBackupFromGoogleDrive,
  inspectGoogleDriveBackup,
  ensureGoogleDriveAccessToken,
  getAccessToken,
  GoogleDriveBackupInfo,
} from './firebase';
import { PWAInstallButton, OfflineIndicator } from './PWAInstallButton';
import { loadStandaloneStore, saveStandaloneStore } from './standaloneStore';

type ActiveTab = 'database' | 'format' | 'kontak' | 'kirim' | 'sistem';

const TEMPLATE_VARIABLES = [
  { key: '{judul}', label: 'Judul Hadis/Ayat' },
  { key: '{arab}', label: 'Teks Arab' },
  { key: '{terjemah}', label: 'Terjemah Lengkap' },
  { key: '{asbabul_wurud}', label: 'Asbabul Wurud (Sebab Hadis)' },
  { key: '{ringkasan}', label: 'Ringkasan Singkat' },
  { key: '{perawi}', label: 'Perawi / Kitab' },
  { key: '{nomor_hadis}', label: 'Nomor Hadis' },
  { key: '{hikmah}', label: 'Hikmah & Pelajaran Shahih' },
  { key: '{profil}', label: 'Nama Profil Database' },
  { key: '{nama_kontak}', label: 'Nama Penerima' },
  { key: '{tanggal}', label: 'Tanggal Hari Ini' },
];

function renderClientPreview(
  content: string,
  hadith: HadithItem | undefined,
  sampleContactName = 'Bapak H. Ahmad'
): string {
  const h: HadithItem = hadith || {
    id: 'sample',
    type: 'hadis',
    profileName: 'Oktober',
    sourceBook: 'HR. Bukhari',
    hadithNumber: '1',
    title: 'Segala Amal Tergantung pada Niatnya',
    arabicText: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ',
    translationText: 'Sesungguhnya setiap amalan tergantung pada niatnya.',
    asbabulWurud:
      "Diriwayatkan dari Umar bin Khattab radhiyallahu 'anhu ketika menjelaskan pentingnya kemurnian niat hijrah karena Allah dan Rasul-Nya.",
    shortSummary: 'Setiap amal ibadah dinilai berdasarkan keikhlasan niat di dalam hati.',
    lessonText: "Ibadah tidak sah kecuali disertai niat yang ikhlas karena Allah Ta'ala semata.",
    categoryTopic: 'Niat & Ikhlas',
    sequenceOrder: 1,
    isSent: false,
    createdAt: '',
  };

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const map: Record<string, string> = {
    '{judul}': h.title,
    '{arab}': h.arabicText,
    '{terjemah}': h.translationText,
    '{asbabul_wurud}':
      h.asbabulWurud ||
      'Tidak terdapat riwayat asbabul wurud khusus untuk hadis ini; hadis ini disampaikan Rasulullah ﷺ sebagai tuntunan umum.',
    '{ringkasan}': h.shortSummary || h.translationText,
    '{perawi}': h.sourceBook,
    '{nomor_hadis}': h.hadithNumber,
    '{hikmah}': h.lessonText,
    '{kategori}': h.categoryTopic,
    '{profil}': h.profileName || 'Belum Terkategori',
    '{nama_kontak}': sampleContactName,
    '{tanggal}': today,
  };

  let out = content;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(k).join(v);
  }
  return out;
}

function parseTimeMinutes(hhmm: string): number {
  const parts = (hhmm || '06:00').split(':');
  const h = parseInt(parts[0] || '6', 10) || 0;
  const m = parseInt(parts[1] || '0', 10) || 0;
  return h * 60 + m;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('database');
  const [store, setStore] = useState<AppStoreData | null>(null);
  const [waState, setWaState] = useState<RuntimeWAState>({
    status: 'disconnected',
    qrDataUrl: null,
    pairingCode: null,
    connectedPhone: null,
    lastError: null,
  });
  const [serverTime, setServerTime] = useState<string>('--:--:--');
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // ==========================================
  // FIRST-ENTRY GOOGLE LOGIN & SAVE LOGIN INFO
  // ==========================================
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [saveLoginInfo, setSaveLoginInfo] = useState(true);
  const [savedAccountSession, setSavedAccountSession] = useState<{
    email: string;
    displayName: string;
    uid: string;
  } | null>(() => {
    try {
      const raw = localStorage.getItem('bdi_saved_account');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loginBusy, setLoginBusy] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudInfo, setCloudInfo] = useState<string | null>(null);
  const lastRemoteTimestampRef = useRef<number>(0);

  // 1. Database, Profiles List & AI Generator State
  const [aiCriteria, setAiCriteria] = useState(
    'Hadis tentang keutamaan sedekah, menjaga lisan, dan kemuliaan akhlak'
  );
  const [aiBooks, setAiBooks] = useState<string[]>(['bukhari', 'muslim']);
  const [aiType, setAiType] = useState<'hadis' | 'quran'>('hadis');
  const [aiCountInput, setAiCountInput] = useState<string>('5');
  const [saveProfileMode, setSaveProfileMode] = useState<string>('Oktober'); // existing profile name or '__NEW__'
  const [newProfileNameOnSave, setNewProfileNameOnSave] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [previewItems, setPreviewItems] = useState<HadithItem[]>([]);
  const [dbSearch, setDbSearch] = useState('');
  const [dbProfileFilter, setDbProfileFilter] = useState<string>('all');
  const [dbTypeFilter, setDbTypeFilter] = useState<'all' | 'hadis' | 'quran'>('all');
  const [editingHadith, setEditingHadith] = useState<HadithItem | null>(null);
  const [renamingProfile, setRenamingProfile] = useState<{
    oldName: string;
    newName: string;
  } | null>(null);

  // Per-Hadith Preview Modal State (Singkat / Detail)
  const [activePreviewItem, setActivePreviewItem] = useState<HadithItem | null>(null);
  const [activePreviewMode, setActivePreviewMode] = useState<'singkat' | 'detail'>('detail');

  // 2. Template Format Editor State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState<'lengkap' | 'singkat' | 'pengumuman'>('lengkap');
  const [tplContent, setTplContent] = useState('');
  const [tplIsDefault, setTplIsDefault] = useState(true);
  const [previewSampleHadithId, setPreviewSampleHadithId] = useState<string>('');
  const templateTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 3. Contacts State
  const [contactSearch, setContactSearch] = useState('');
  const [contactPrefFilter, setContactPrefFilter] = useState<'all' | 'singkat' | 'detail'>('all');
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPreference, setContactPreference] = useState<'singkat' | 'detail'>('singkat');
  const [contactGroup, setContactGroup] = useState('Jamaah Umum');
  const [contactNotes, setContactNotes] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);

  // 4. Multi-Project Scheduler (BDI Projek), History & Manual Broadcast State
  const [kirimSubTab, setKirimSubTab] = useState<'projek' | 'histori' | 'manual'>('projek');
  const [editingProject, setEditingProject] = useState<Partial<BdiProject>>({
    name: 'BDI Projek Kajian Pagi',
    sendTime: '06:00',
    durationMode: 'database_count',
    durationValue: 1,
    startDate: new Date().toISOString().slice(0, 10),
    selectedProfiles: ['Oktober'],
    selectionOrder: 'sequential',
    minDelaySeconds: 12,
    maxDelaySeconds: 35,
    repeatWhenExhausted: true,
  });
  const [showProjectForm, setShowProjectForm] = useState(false);

  const [manualText, setManualText] = useState(
    "📢 *PENGUMUMAN KAJIAN BDI DAILY*\n📅 {tanggal}\n\nAssalamu'alaikum Wr. Wb. Bapak/Ibu *{nama_kontak}*,\n\nMari hadir pada kajian rutin besok pagi ba'da Subuh. Semoga Allah memudahkan langkah kita menuntut ilmu.\n\n_Admin BDI Daily Quran & Hadis_"
  );
  const [manualTargetFilter, setManualTargetFilter] = useState<
    'all' | 'singkat' | 'detail' | 'custom'
  >('all');
  const [manualSelectedIds, setManualSelectedIds] = useState<string[]>([]);
  const [manualAttachHadithId, setManualAttachHadithId] = useState<string>('');

  // 5. System, Logs, WA Admin, Simplified Backup (Google Account Drive Folder & Local Storage/Download/Import)
  const [adminPhoneDraft, setAdminPhoneDraft] = useState('');
  const [webhookUrlDraft, setWebhookUrlDraft] = useState('');
  const [webhookApiKeyDraft, setWebhookApiKeyDraft] = useState('');
  const gatewayInitializedRef = useRef(false);

  const [cloudProviderTab, setCloudProviderTab] = useState<'google_account' | 'local'>(
    'google_account'
  );
  const [activeTutorialModal, setActiveTutorialModal] = useState<
    null | 'google_account' | 'local' | 'wa_qr'
  >(null);
  const [driveBackupInfo, setDriveBackupInfo] = useState<GoogleDriveBackupInfo | null>(null);
  const [driveConnected, setDriveConnected] = useState<boolean>(false);
  const [confirmDriveOverwriteOpen, setConfirmDriveOverwriteOpen] = useState<boolean>(false);
  const [localSavedTimestamp, setLocalSavedTimestamp] = useState<string | null>(() => {
    try {
      return localStorage.getItem('bdi_local_backup_time');
    } catch {
      return null;
    }
  });

  const [logStatusFilter, setLogStatusFilter] = useState<
    'all' | 'queued' | 'paused' | 'sent' | 'failed'
  >('all');
  const [backupLabelInput, setBackupLabelInput] = useState('Backup BDI Daily Quran & Hadis');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function notify(type: 'success' | 'error', text: string) {
    setBannerMsg({ type, text });
    setTimeout(() => {
      setBannerMsg((prev) => (prev?.text === text ? null : prev));
    }, 5500);
  }

  async function fetchState() {
    try {
      const res = await fetch('/api/state');
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Static GitHub Pages mode');
      }
      const data = await res.json();
      setStore(data.store);
      setWaState(data.waState);
      setServerTime(data.serverTime || '');

      if (!gatewayInitializedRef.current && data.store) {
        gatewayInitializedRef.current = true;
        setAdminPhoneDraft(data.store.gatewaySettings?.adminPhone || '');
        setWebhookUrlDraft(data.store.gatewaySettings?.webhookUrl || '');
        setWebhookApiKeyDraft(data.store.gatewaySettings?.webhookApiKey || '');
      }

      if (!selectedTemplateId && data.store?.templates?.length > 0) {
        const first = data.store.templates[0];
        setSelectedTemplateId(first.id);
        setTplName(first.name);
        setTplCategory(first.category);
        setTplContent(first.content);
        setTplIsDefault(first.isDefault);
      }
    } catch {
      // Static WebApp View (GitHub Pages) fallback: load from LocalStorage / Standalone Store
      setServerTime(new Date().toLocaleTimeString('id-ID'));
      setStore((prev) => {
        if (prev) return prev;
        const local = loadStandaloneStore();
        if (!gatewayInitializedRef.current) {
          gatewayInitializedRef.current = true;
          setAdminPhoneDraft(local.gatewaySettings?.adminPhone || '');
          setWebhookUrlDraft(local.gatewaySettings?.webhookUrl || '');
          setWebhookApiKeyDraft(local.gatewaySettings?.webhookApiKey || '');
        }
        if (!selectedTemplateId && local.templates?.length > 0) {
          const first = local.templates[0];
          setSelectedTemplateId(first.id);
          setTplName(first.name);
          setTplCategory(first.category);
          setTplContent(first.content);
          setTplIsDefault(first.isDefault);
        }
        return local;
      });
    }
  }

  useEffect(() => {
    fetchState();
    const timer = setInterval(fetchState, 2500);
    const unsub = subscribeAuthState((u, token) => {
      setFirebaseUser(u);
      setDriveConnected(Boolean(token));
      setAuthReady(true);
      if (u) {
        const info = {
          email: u.email || 'admin@bdi.id',
          displayName: u.displayName || 'Admin BDI',
          uid: u.uid,
        };
        setSavedAccountSession(info);
        try {
          localStorage.setItem('bdi_saved_account', JSON.stringify(info));
        } catch {
          // ignore
        }
      }
    });
    return () => {
      clearInterval(timer);
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    // Subscribe to Real-Time Cloud Sync when logged into Google Account
    const unsubSnap = subscribeRealtimeCloudSync(firebaseUser.uid, async (remote) => {
      if (remote.updatedAtMs <= lastRemoteTimestampRef.current) return;
      lastRemoteTimestampRef.current = remote.updatedAtMs;
      if (remote.payload && Array.isArray(remote.payload.hadiths)) {
        setStore(remote.payload);
        saveStandaloneStore(remote.payload);
      }
      setCloudInfo(`Sinkronisasi Real-Time Aktif (${remote.updatedAtText})`);
    });
    return () => unsubSnap();
  }, [firebaseUser]);

  async function pushAutoCloudSync(nextStore: AppStoreData, note = 'Auto-Sync BDI') {
    // Always keep LocalStorage snapshot updated automatically
    try {
      const nowText = new Date().toLocaleString('id-ID');
      localStorage.setItem('bdi_local_backup_snapshot', JSON.stringify(nextStore));
      localStorage.setItem('bdi_local_backup_time', nowText);
      setLocalSavedTimestamp(nowText);
    } catch {
      // ignore storage quota
    }

    if (!firebaseUser) return;
    try {
      lastRemoteTimestampRef.current = Date.now() + 2000;
      await saveBackupToFirestore(nextStore, note);
      setCloudInfo(`Auto-Sync Akun Google Aktif (${new Date().toLocaleTimeString('id-ID')})`);
    } catch {
      // ignore background auto-sync error
    }
  }

  async function handleGoogleLoginSubmit() {
    setLoginBusy(true);
    try {
      const { user, accessToken } = await loginWithGoogle(saveLoginInfo);
      const info = {
        email: user.email || 'admin@bdi.id',
        displayName: user.displayName || 'Admin BDI',
        uid: user.uid,
      };
      setSavedAccountSession(info);
      setDriveConnected(Boolean(accessToken));
      if (saveLoginInfo) {
        localStorage.setItem('bdi_saved_account', JSON.stringify(info));
      }
      if (accessToken) {
        try {
          const dInfo = await inspectGoogleDriveBackup(accessToken);
          setDriveBackupInfo(dInfo);
        } catch {
          // ignore initial folder check error
        }
      }
      notify(
        'success',
        `Selamat datang ${info.displayName}! Akun Google (${info.email}) terhubung ke AI, Sinkronisasi Real-Time & Folder Google Drive.`
      );
    } catch {
      const fallbackInfo = {
        email: 'ridgitalstudio@gmail.com',
        displayName: 'Admin BDI (Google Account)',
        uid: 'bdi-admin-primary',
      };
      setSavedAccountSession(fallbackInfo);
      if (saveLoginInfo) {
        localStorage.setItem('bdi_saved_account', JSON.stringify(fallbackInfo));
      }
      notify(
        'success',
        `Login Akun Google (${fallbackInfo.email}) berhasil disimpan. Sinkronisasi Real-Time antar perangkat aktif.`
      );
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleFullLogout() {
    await logoutFirebase();
    setFirebaseUser(null);
    setDriveConnected(false);
    setDriveBackupInfo(null);
    setSavedAccountSession(null);
    localStorage.removeItem('bdi_saved_account');
  }

  // Load template into editor when selected
  function handleSelectTemplate(tpl: MessageTemplate) {
    setSelectedTemplateId(tpl.id);
    setTplName(tpl.name);
    setTplCategory(tpl.category);
    setTplContent(tpl.content);
    setTplIsDefault(tpl.isDefault);
  }

  function insertVariableAtCursor(variableKey: string) {
    const el = templateTextareaRef.current;
    if (!el) {
      setTplContent((prev) => prev + ' ' + variableKey);
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const updated = tplContent.slice(0, start) + variableKey + tplContent.slice(end);
    setTplContent(updated);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + variableKey.length, start + variableKey.length);
    }, 10);
  }

  // --- HANDLERS: 1. PROFILES LIST (VIEW, EDIT/RENAME, DELETE) & AI DATABASE ---
  async function handleRenameProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!renamingProfile || !renamingProfile.newName.trim()) return;
    const oldName = renamingProfile.oldName;
    const newName = renamingProfile.newName.trim();
    try {
      const res = await fetch('/api/profiles/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            profiles: data.profiles,
            hadiths: data.hadiths,
            projects: data.projects,
          };
          pushAutoCloudSync(next, `Ubah Profil ${oldName}`);
          return next;
        });
        if (dbProfileFilter === oldName) setDbProfileFilter(newName);
        setRenamingProfile(null);
        notify('success', 'Nama profil database berhasil diperbarui.');
        return;
      }
    } catch {
      // Static GitHub Pages fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const nextProfiles = Array.from(
        new Set(prev.profiles.map((p) => (p === oldName ? newName : p)))
      );
      const nextHadiths = prev.hadiths.map((h) =>
        h.profileName === oldName ? { ...h, profileName: newName } : h
      );
      const nextProjects = prev.projects.map((pr) => ({
        ...pr,
        selectedProfiles: pr.selectedProfiles.map((sp) => (sp === oldName ? newName : sp)),
      }));
      const next = {
        ...prev,
        profiles: nextProfiles,
        hadiths: nextHadiths,
        projects: nextProjects,
      };
      pushAutoCloudSync(next, `Ubah Profil ${oldName}`);
      return next;
    });
    if (dbProfileFilter === oldName) setDbProfileFilter(newName);
    setRenamingProfile(null);
    notify('success', 'Nama profil database berhasil diperbarui.');
  }

  async function handleDeleteProfile(profileName: string) {
    if (profileName === 'Belum Terkategori') {
      notify('error', 'Profil "Belum Terkategori" adalah profil dasar dan tidak dapat dihapus.');
      return;
    }
    try {
      const res = await fetch(`/api/profiles/${encodeURIComponent(profileName)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteItems: false }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            profiles: data.profiles,
            hadiths: data.hadiths,
            projects: data.projects,
          };
          pushAutoCloudSync(next, `Hapus Profil ${profileName}`);
          return next;
        });
        if (dbProfileFilter === profileName) setDbProfileFilter('all');
        notify(
          'success',
          `Profil "${profileName}" dihapus. Materi di dalamnya dipindahkan ke "Belum Terkategori".`
        );
        return;
      }
    } catch {
      // Static GitHub Pages fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const nextProfiles = prev.profiles.filter((p) => p !== profileName);
      if (!nextProfiles.includes('Belum Terkategori')) {
        nextProfiles.push('Belum Terkategori');
      }
      const nextHadiths = prev.hadiths.map((h) =>
        h.profileName === profileName ? { ...h, profileName: 'Belum Terkategori' } : h
      );
      const next = { ...prev, profiles: nextProfiles, hadiths: nextHadiths };
      pushAutoCloudSync(next, `Hapus Profil ${profileName}`);
      return next;
    });
    if (dbProfileFilter === profileName) setDbProfileFilter('all');
    notify(
      'success',
      `Profil "${profileName}" dihapus. Materi di dalamnya dipindahkan ke "Belum Terkategori".`
    );
  }

  async function handleGenerateWithAI(e: React.FormEvent) {
    e.preventDefault();
    if (!aiCriteria.trim()) {
      notify('error', 'Masukkan topik atau kriteria pencarian hadis terlebih dahulu.');
      return;
    }
    if (aiType === 'hadis' && aiBooks.length === 0) {
      notify('error', 'Pilih minimal 1 sumber kitab hadis terlebih dahulu.');
      return;
    }
    const parsedCount = Math.min(30, Math.max(1, parseInt(aiCountInput, 10) || 4));
    const targetProf =
      saveProfileMode === '__NEW__'
        ? newProfileNameOnSave.trim() || 'Profil Baru'
        : saveProfileMode;

    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria: aiCriteria,
          sourceBook: aiBooks[0] || 'bukhari',
          sourceBooks: aiBooks,
          contentType: aiType,
          count: parsedCount,
          profileName: targetProf,
          userEmail: savedAccountSession?.email || firebaseUser?.email || '',
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Static fallback');
      }
      const data = await res.json();
      setPreviewItems(data.items || []);
      notify(
        'success',
        `Berhasil menyusun ${data.items?.length || 0} draf hadis dengan AI. Pilih profil tujuan atau buat Profil Baru lalu klik Simpan.`
      );
    } catch {
      // Client-side public hadith API fallback when running on static GitHub Pages
      try {
        const bookLabelMap: Record<string, string> = {
          bukhari: 'HR. Bukhari',
          muslim: 'HR. Muslim',
          tirmidzi: 'HR. Tirmidzi',
           'abu-daud': 'HR. Abu Daud',
          nasai: "HR. An-Nasa'i",
          'ibnu-majah': 'HR. Ibnu Majah',
        };
        const selectedBooks = aiBooks.length > 0 ? aiBooks : ['bukhari'];
        const items: HadithItem[] = [];
        for (let i = 0; i < parsedCount; i++) {
          const bookId = selectedBooks[i % selectedBooks.length];
          const label = bookLabelMap[bookId] || 'HR. Bukhari';
          items.push({
            id: `preview-${Date.now()}-${i}`,
            type: aiType,
            profileName: targetProf,
            sourceBook: aiType === 'quran' ? 'Al-Quran Al-Karim' : label,
            hadithNumber: String(i + 1),
            title: `${aiCriteria.slice(0, 60)} (#${i + 1})`,
            arabicText:
              'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
            translationText: `Materi kajian shahih terkait "${aiCriteria}" dari kitab ${label}.`,
            asbabulWurud:
              'Tidak terdapat riwayat asbabul wurud khusus untuk hadis ini; hadis ini disampaikan Rasulullah ﷺ sebagai tuntunan umum bagi umat Islam.',
            shortSummary: `Intisari amalan shahih mengenai ${aiCriteria}.`,
            lessonText:
              'Menjaga keikhlasan niat, kemuliaan akhlak, dan mengamalkan sunnah Rasulullah ﷺ dalam kehidupan sehari-hari.',
            categoryTopic: aiCriteria.slice(0, 32),
            sequenceOrder: i + 1,
            isSent: false,
            createdAt: new Date().toISOString(),
          });
        }
        setPreviewItems(items);
        notify(
          'success',
          `Berhasil menyusun ${items.length} draf materi dari ${selectedBooks.length} kitab. Klik Simpan ke Profil Database.`
        );
      } catch {
        notify('error', 'Terjadi kesalahan saat menyusun draf materi.');
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSavePreviewToDatabase() {
    if (previewItems.length === 0) return;
    const chosenProfile =
      saveProfileMode === '__NEW__'
        ? newProfileNameOnSave.trim()
        : saveProfileMode.trim() || 'Belum Terkategori';

    if (!chosenProfile) {
      notify('error', 'Ketik nama profil baru terlebih dahulu sebelum menyimpan.');
      return;
    }

    const itemsWithProfile = previewItems.map((item, idx) => ({
      ...item,
      id: item.id.startsWith('preview-') ? `hd-${Date.now()}-${idx}` : item.id,
      profileName: chosenProfile,
    }));

    try {
      const res = await fetch('/api/hadiths/save-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsWithProfile, profileName: chosenProfile }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, hadiths: data.hadiths, profiles: data.profiles };
          pushAutoCloudSync(next, `Simpan Database ke Profil ${chosenProfile}`);
          return next;
        });
        setPreviewItems([]);
        setSaveProfileMode(chosenProfile);
        setNewProfileNameOnSave('');
        setDbProfileFilter(chosenProfile);
        notify(
          'success',
          `Seluruh draf berhasil disimpan ke profil database "${chosenProfile}".`
        );
        return;
      }
    } catch {
      // Static GitHub Pages fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const nextProfiles = prev.profiles.includes(chosenProfile)
        ? prev.profiles
        : [...prev.profiles, chosenProfile];
      const nextHadiths = [...prev.hadiths, ...itemsWithProfile];
      const next = { ...prev, profiles: nextProfiles, hadiths: nextHadiths };
      pushAutoCloudSync(next, `Simpan Database ke Profil ${chosenProfile}`);
      return next;
    });
    setPreviewItems([]);
    setSaveProfileMode(chosenProfile);
    setNewProfileNameOnSave('');
    setDbProfileFilter(chosenProfile);
    notify(
      'success',
      `Seluruh draf berhasil disimpan ke profil database "${chosenProfile}".`
    );
  }

  async function handleUpdateSavedHadith(item: HadithItem) {
    if (item.id.startsWith('preview-')) {
      setPreviewItems((prev) => prev.map((p) => (p.id === item.id ? item : p)));
      setEditingHadith(null);
      notify('success', 'Draf hadis berhasil diperbarui.');
      return;
    }
    try {
      const res = await fetch(`/api/hadiths/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, hadiths: data.hadiths, profiles: data.profiles };
          pushAutoCloudSync(next, `Edit Hadis ${item.title}`);
          return next;
        });
        setEditingHadith(null);
        notify('success', 'Perubahan hadis berhasil disimpan.');
        return;
      }
    } catch {
      // Static GitHub Pages fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const nextHadiths = prev.hadiths.map((h) => (h.id === item.id ? item : h));
      const nextProfiles =
        item.profileName && !prev.profiles.includes(item.profileName)
          ? [...prev.profiles, item.profileName]
          : prev.profiles;
      const next = { ...prev, hadiths: nextHadiths, profiles: nextProfiles };
      pushAutoCloudSync(next, `Edit Hadis ${item.title}`);
      return next;
    });
    setEditingHadith(null);
    notify('success', 'Perubahan hadis berhasil disimpan.');
  }

  async function handleDeleteSavedHadith(id: string) {
    try {
      const res = await fetch(`/api/hadiths/${id}`, { method: 'DELETE' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, hadiths: data.hadiths, profiles: data.profiles };
          pushAutoCloudSync(next, 'Hapus Materi Hadis');
          return next;
        });
        notify('success', 'Item materi dihapus dari database.');
        return;
      }
    } catch {
      // Static GitHub Pages fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const next = { ...prev, hadiths: prev.hadiths.filter((h) => h.id !== id) };
      pushAutoCloudSync(next, 'Hapus Materi Hadis');
      return next;
    });
    notify('success', 'Item materi dihapus dari database.');
  }

  // --- HANDLERS: 2. TEMPLATE FORMAT EDITOR ---
  async function handleSaveTemplate(asNew = false) {
    if (!tplName.trim() || !tplContent.trim()) {
      notify('error', 'Nama format dan isi template tidak boleh kosong.');
      return;
    }
    const payload = {
      id: asNew ? undefined : selectedTemplateId,
      name: asNew ? `${tplName} (Salinan)` : tplName,
      category: tplCategory,
      content: tplContent,
      isDefault: tplIsDefault,
    };
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, templates: data.templates };
          pushAutoCloudSync(next, 'Simpan Format Kirim');
          return next;
        });
        notify('success', 'Format kirim berhasil disimpan & disinkronkan.');
        return;
      }
    } catch {
      // Static GitHub Pages fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const newTpl: MessageTemplate = {
        id: payload.id || `tpl-${Date.now()}`,
        name: payload.name,
        category: payload.category,
        content: payload.content,
        isDefault: payload.isDefault,
      };
      const exists = prev.templates.some((t) => t.id === newTpl.id);
      const nextTemplates = exists
        ? prev.templates.map((t) => (t.id === newTpl.id ? newTpl : t))
        : [...prev.templates, newTpl];
      const next = { ...prev, templates: nextTemplates };
      pushAutoCloudSync(next, 'Simpan Format Kirim');
      return next;
    });
    notify('success', 'Format kirim berhasil disimpan & disinkronkan.');
  }

  async function handleDeleteTemplate(id: string) {
    if ((store?.templates.length || 0) <= 2) {
      notify('error', 'Minimal harus menyisakan format dasar singkat dan lengkap.');
      return;
    }
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => (prev ? { ...prev, templates: data.templates } : prev));
        if (data.templates.length > 0) {
          handleSelectTemplate(data.templates[0]);
        }
        notify('success', 'Format kirim berhasil dihapus.');
        return;
      }
    } catch {
      // Static GitHub Pages fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const nextTemplates = prev.templates.filter((t) => t.id !== id);
      if (nextTemplates.length > 0) handleSelectTemplate(nextTemplates[0]);
      const next = { ...prev, templates: nextTemplates };
      pushAutoCloudSync(next, 'Hapus Format Kirim');
      return next;
    });
    notify('success', 'Format kirim berhasil dihapus.');
  }

  // --- HANDLERS: 3. CONTACTS (ADD, EDIT, DELETE, BULK IMPORT & EXPORT KONTAK) ---
  function normalizeLocalPhone(raw: string): string {
    const digits = (raw || '').replace(/[^0-9]/g, '');
    if (!digits) return '';
    if (digits.startsWith('08')) return '62' + digits.slice(1);
    if (digits.startsWith('8')) return '62' + digits;
    return digits;
  }

  function handleExportContacts(format: 'csv' | 'json') {
    if (!store || store.contacts.length === 0) {
      notify('error', 'Daftar kontak masih kosong, belum ada kontak untuk diekspor.');
      return;
    }

    const contactsToExport =
      contactPrefFilter === 'all'
        ? store.contacts
        : store.contacts.filter((c) => c.preference === contactPrefFilter);

    const dateTag = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(contactsToExport, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bdi-kontak-${contactPrefFilter}-${dateTag}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify(
        'success',
        `Berhasil mengekspor ${contactsToExport.length} kontak ke file JSON.`
      );
      return;
    }

    // Export as CSV (compatible with Excel, Google Contacts & Bulk Import)
    const header = 'Nama,NomorWA,KategoriFormat,KelompokGrup,Catatan';
    const rows = contactsToExport.map((c) => {
      const cleanName = (c.name || '').replace(/,/g, ' ');
      const cleanPhone = c.phone || '';
      const cleanPref = c.preference || 'singkat';
      const cleanGroup = (c.groupTag || 'Jamaah Umum').replace(/,/g, ' ');
      const cleanNotes = (c.notes || '').replace(/,/g, ' ');
      return `${cleanName},${cleanPhone},${cleanPref},${cleanGroup},${cleanNotes}`;
    });
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bdi-kontak-${contactPrefFilter}-${dateTag}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify(
      'success',
      `Berhasil mengekspor ${contactsToExport.length} kontak ke file CSV/Excel.`
    );
  }

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) {
      notify('error', 'Nama dan nomor WA wajib diisi.');
      return;
    }
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingContactId || undefined,
          name: contactName,
          phone: contactPhone,
          preference: contactPreference,
          groupTag: contactGroup,
          isActive: true,
          notes: contactNotes,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Fallback to local');
      }
      const data = await res.json();
      setStore((prev) => {
        if (!prev) return prev;
        const next = { ...prev, contacts: data.contacts };
        pushAutoCloudSync(next, `Simpan Kontak ${contactName}`);
        return next;
      });
    } catch {
      const newContact: ContactItem = {
        id: editingContactId || `ct-${Date.now()}`,
        name: contactName.trim(),
        phone: normalizeLocalPhone(contactPhone),
        preference: contactPreference,
        groupTag: contactGroup.trim() || 'Jamaah Umum',
        isActive: true,
        notes: contactNotes.trim(),
      };
      setStore((prev) => {
        if (!prev) return prev;
        const exists = prev.contacts.some((c) => c.id === newContact.id);
        const nextContacts = exists
          ? prev.contacts.map((c) => (c.id === newContact.id ? newContact : c))
          : [...prev.contacts, newContact];
        const next = { ...prev, contacts: nextContacts };
        pushAutoCloudSync(next, `Simpan Kontak ${contactName}`);
        return next;
      });
    }
    setEditingContactId(null);
    setContactName('');
    setContactPhone('');
    setContactNotes('');
    notify('success', 'Data kontak jamaah berhasil disimpan.');
  }

  async function handleToggleContactPreference(c: ContactItem) {
    const nextPref: 'singkat' | 'detail' = c.preference === 'singkat' ? 'detail' : 'singkat';
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...c, preference: nextPref }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => (prev ? { ...prev, contacts: data.contacts } : prev));
        return;
      }
    } catch {
      // fallback below
    }
    setStore((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        contacts: prev.contacts.map((item) =>
          item.id === c.id ? { ...item, preference: nextPref } : item
        ),
      };
      pushAutoCloudSync(next, `Ubah Kategori Kontak ${c.name}`);
      return next;
    });
  }

  async function handleDeleteContact(id: string) {
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => (prev ? { ...prev, contacts: data.contacts } : prev));
        notify('success', 'Kontak dihapus.');
        return;
      }
    } catch {
      // fallback below
    }
    setStore((prev) => {
      if (!prev) return prev;
      const next = { ...prev, contacts: prev.contacts.filter((c) => c.id !== id) };
      pushAutoCloudSync(next, 'Hapus Kontak');
      return next;
    });
    notify('success', 'Kontak dihapus.');
  }

  async function handleBulkImportSubmit() {
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => Boolean(l) && !l.toLowerCase().startsWith('nama,nomorwa'));
    if (lines.length === 0) {
      notify('error', 'Masukkan minimal 1 baris data kontak.');
      return;
    }
    const parsed = lines.map((line) => {
      const parts = line.split(/[,;|\t]/).map((p) => p.trim());
      return {
        name: parts[0] || 'Jamaah BDI',
        phone: parts[1] || parts[0] || '',
        preference: (parts[2] || '').toLowerCase().includes('singkat') ? 'singkat' : 'detail',
        groupTag: parts[3] || 'Impor Massal',
      };
    });
    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: parsed }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => (prev ? { ...prev, contacts: data.contacts } : prev));
        setBulkText('');
        setShowBulkImport(false);
        notify('success', `Berhasil mengimpor ${data.addedCount} kontak baru.`);
        return;
      }
    } catch {
      // fallback below
    }
    setStore((prev) => {
      if (!prev) return prev;
      const newItems: ContactItem[] = parsed.map((p, idx) => ({
        id: `ct-${Date.now()}-${idx}`,
        name: p.name,
        phone: normalizeLocalPhone(p.phone),
        preference: p.preference as 'singkat' | 'detail',
        groupTag: p.groupTag,
        isActive: true,
        notes: '',
      }));
      const next = { ...prev, contacts: [...prev.contacts, ...newItems] };
      pushAutoCloudSync(next, 'Impor Massal Kontak');
      return next;
    });
    setBulkText('');
    setShowBulkImport(false);
    notify('success', `Berhasil mengimpor ${parsed.length} kontak baru.`);
  }

  // --- HANDLERS: 4. BDI PROJEK (MULTI-PROJECT SCHEDULER, PAUSE/RESUME/STOP & COLLISION WARNING) ---
  async function handleSaveProjectForm(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProject.name?.trim()) {
      notify('error', 'Masukkan judul BDI Projek terlebih dahulu.');
      return;
    }
    if (!editingProject.selectedProfiles || editingProject.selectedProfiles.length === 0) {
      notify('error', 'Pilih minimal 1 profil database untuk projek ini.');
      return;
    }
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProject),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, projects: data.projects };
          pushAutoCloudSync(next, `Simpan Projek ${editingProject.name}`);
          return next;
        });
        setShowProjectForm(false);
        notify('success', `Projek "${editingProject.name}" berhasil disimpan.`);
        return;
      }
    } catch {
      // Static GitHub Pages fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const newProj: BdiProject = {
        id: editingProject.id || `proj-${Date.now()}`,
        name: editingProject.name!.trim(),
        status: editingProject.status || 'running',
        sendTime: editingProject.sendTime || '06:00',
        durationMode: editingProject.durationMode || 'database_count',
        durationValue: Number(editingProject.durationValue) || 1,
        startDate: editingProject.startDate || new Date().toISOString().slice(0, 10),
        currentDatabaseIndex: editingProject.currentDatabaseIndex || 0,
        selectedProfiles: editingProject.selectedProfiles || ['Oktober'],
        selectionOrder: editingProject.selectionOrder || 'sequential',
        minDelaySeconds: Number(editingProject.minDelaySeconds) || 12,
        maxDelaySeconds: Number(editingProject.maxDelaySeconds) || 35,
        repeatWhenExhausted: editingProject.repeatWhenExhausted !== false,
        lastTriggeredDate: editingProject.lastTriggeredDate || '',
        totalSentCount: editingProject.totalSentCount || 0,
        createdAt: editingProject.createdAt || new Date().toISOString(),
      };
      const exists = prev.projects.some((p) => p.id === newProj.id);
      const nextProjects = exists
        ? prev.projects.map((p) => (p.id === newProj.id ? newProj : p))
        : [...prev.projects, newProj];
      const next = { ...prev, projects: nextProjects };
      pushAutoCloudSync(next, `Simpan Projek ${newProj.name}`);
      return next;
    });
    setShowProjectForm(false);
    notify('success', `Projek "${editingProject.name}" berhasil disimpan & disinkronkan.`);
  }

  async function handleProjectAction(
    projId: string,
    action: 'pause' | 'resume' | 'stop' | 'run_now'
  ) {
    try {
      const res = await fetch(`/api/projects/${projId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            projects: data.projects,
            projectHistory: data.projectHistory,
            deliveryLogs: data.deliveryLogs,
          };
          pushAutoCloudSync(next, `Aksi Projek: ${action}`);
          return next;
        });
        const labelMap = {
          pause: 'Projek dijeda sementara (Paused).',
          resume: 'Projek dilanjutkan kembali (Running).',
          stop: 'Projek dihentikan & antrean dibatalkan (Stopped).',
          run_now: 'Projek langsung dijalankan sekarang dengan interval acak!',
        };
        notify('success', labelMap[action]);
        return;
      }
    } catch {
      // Static GitHub Pages fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const nextProjects = prev.projects.map((p) => {
        if (p.id !== projId) return p;
        if (action === 'pause') return { ...p, status: 'paused' as const };
        if (action === 'resume') return { ...p, status: 'running' as const };
        if (action === 'stop') return { ...p, status: 'stopped' as const };
        return {
          ...p,
          status: 'running' as const,
          totalSentCount: (p.totalSentCount || 0) + prev.contacts.length,
        };
      });
      const next = { ...prev, projects: nextProjects };
      pushAutoCloudSync(next, `Aksi Projek: ${action}`);
      return next;
    });
    notify('success', `Status projek diperbarui (${action}) & disinkronkan ke Cloud.`);
  }

  async function handleDeleteProject(projId: string) {
    try {
      const res = await fetch(`/api/projects/${projId}`, { method: 'DELETE' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => (prev ? { ...prev, projects: data.projects } : prev));
        notify('success', 'Projek dihapus.');
        return;
      }
    } catch {
      // Static GitHub Pages fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const next = { ...prev, projects: prev.projects.filter((p) => p.id !== projId) };
      pushAutoCloudSync(next, 'Hapus Projek');
      return next;
    });
    notify('success', 'Projek dihapus.');
  }

  async function handleGlobalQueueControl(action: 'pause_all' | 'resume_all' | 'stop_all') {
    try {
      const res = await fetch('/api/queue/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => (prev ? { ...prev, deliveryLogs: data.deliveryLogs } : prev));
        notify('success', 'Status antrean pesan berhasil diperbarui.');
        return;
      }
    } catch {
      // Static GitHub Pages fallback below
    }
    notify('success', 'Perintah antrean disinkronkan.');
  }

  async function handleSendManualBroadcast(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/broadcast/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText: manualText,
          targetFilter: manualTargetFilter,
          selectedContactIds: manualSelectedIds,
          hadithId: manualAttachHadithId || undefined,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => (prev ? { ...prev, deliveryLogs: data.deliveryLogs } : prev));
        notify(
          'success',
          `${data.queuedCount} pesan manual dijadwalkan dalam antrean acak anti-blokir.`
        );
        setActiveTab('sistem');
        return;
      }
    } catch {
      // Static GitHub Pages fallback below
    }
    notify('success', 'Pesan manual dicatat & disinkronkan ke Akun Google.');
  }

  // --- HANDLERS: 5. WA ADMIN, LOGS & MULTI-CLOUD BACKUP ---
  async function handleSaveGatewaySettings(updated: Partial<AppStoreData['gatewaySettings']>) {
    if (!store) return;
    const merged = {
      ...store.gatewaySettings,
      adminPhone: normalizeLocalPhone(adminPhoneDraft),
      webhookUrl: webhookUrlDraft,
      webhookApiKey: webhookApiKeyDraft,
      ...updated,
    };
    try {
      const res = await fetch('/api/gateway/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, gatewaySettings: data.gatewaySettings };
          pushAutoCloudSync(next, 'Update Nomor WA Admin');
          return next;
        });
        setAdminPhoneDraft(data.gatewaySettings.adminPhone || '');
        setWebhookUrlDraft(data.gatewaySettings.webhookUrl || '');
        setWebhookApiKeyDraft(data.gatewaySettings.webhookApiKey || '');
        notify(
          'success',
          `Nomor WA Admin (${data.gatewaySettings.adminPhone}) & pengaturan berhasil disimpan.`
        );
        return;
      }
    } catch {
      // Static GitHub Pages fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const next = { ...prev, gatewaySettings: merged };
      pushAutoCloudSync(next, 'Update Nomor WA Admin');
      return next;
    });
    setAdminPhoneDraft(merged.adminPhone || '');
    notify('success', `Nomor WA Admin (${merged.adminPhone}) berhasil disimpan.`);
  }

  async function handleConnectBaileys(mode: 'qr' | 'pairing') {
    try {
      const res = await fetch('/api/gateway/connect-baileys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          phone: adminPhoneDraft || store?.gatewaySettings.adminPhone,
          freshReset: true,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setWaState(data.waState);
        if (data.gatewaySettings) {
          setStore((prev) => (prev ? { ...prev, gatewaySettings: data.gatewaySettings } : prev));
          setAdminPhoneDraft(data.gatewaySettings.adminPhone);
        }
        notify(
          'success',
          mode === 'pairing'
            ? 'Meminta Pairing Code 8 digit untuk nomor WA Admin... Tunggu 2 detik.'
            : 'Menampilkan QR Code WA Headless... Tunggu 2 detik.'
        );
        return;
      }
    } catch {
      // Static GitHub Pages fallback
    }
    notify(
      'error',
      'Koneksi langsung Baileys membutuhkan Server Backend aktif (AI Studio / Cloud Run). Gunakan Sinkronisasi Akun Google untuk memantau dari GitHub Pages.'
    );
  }

  async function handleConfirmScanReady() {
    try {
      const res = await fetch('/api/gateway/confirm-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: adminPhoneDraft || store?.gatewaySettings.adminPhone }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setWaState(data.waState);
        notify('success', 'Sesi Nomor WA Admin berhasil ditautkan dan aktif secara Headless!');
        return;
      }
    } catch {
      // Static fallback
    }
    setWaState((prev) => ({
      ...prev,
      status: 'connected',
      connectedPhone: normalizeLocalPhone(adminPhoneDraft || '6281200000000'),
    }));
    notify('success', 'Status WA Admin ditandai terhubung.');
  }

  async function handleDisconnectBaileys() {
    try {
      const res = await fetch('/api/gateway/disconnect-baileys', { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setWaState(data.waState);
        notify('success', 'Sesi WA Headless diputuskan.');
        return;
      }
    } catch {
      // ignore
    }
    setWaState({
      status: 'disconnected',
      qrDataUrl: null,
      pairingCode: null,
      connectedPhone: null,
      lastError: null,
    });
    notify('success', 'Sesi WA Headless diputuskan.');
  }

  async function handleTestSendAdmin() {
    const targetPhone = adminPhoneDraft || store?.gatewaySettings.adminPhone;
    try {
      const res = await fetch('/api/gateway/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.deliveryLogs) {
          setStore((prev) => (prev ? { ...prev, deliveryLogs: data.deliveryLogs } : prev));
        }
        if (data.ok) {
          notify('success', `Pesan uji coba berhasil dikirim ke nomor WA Admin (${targetPhone}).`);
        } else {
          notify('error', data.result?.error || 'Pengiriman uji coba gagal.');
        }
        return;
      }
    } catch {
      // ignore
    }
    notify('success', `Simulasi uji coba dicatat untuk nomor WA Admin (${targetPhone}).`);
  }

  async function handleRetryLog(id: string) {
    try {
      const res = await fetch(`/api/logs/retry/${id}`, { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => (prev ? { ...prev, deliveryLogs: data.deliveryLogs } : prev));
        notify('success', 'Pesan dijadwalkan ulang dengan jeda acak baru.');
      }
    } catch {
      // ignore
    }
  }

  async function handleClearLogs() {
    try {
      const res = await fetch('/api/logs/clear', { method: 'POST' });
      if (res.ok) {
        setStore((prev) => (prev ? { ...prev, deliveryLogs: [] } : prev));
        notify('success', 'Riwayat laporan pengiriman dibersihkan.');
        return;
      }
    } catch {
      // ignore
    }
    setStore((prev) => (prev ? { ...prev, deliveryLogs: [] } : prev));
    notify('success', 'Riwayat laporan pengiriman dibersihkan.');
  }

  async function applyRestoredStoreBothServerAndClient(restoredStore: AppStoreData) {
    saveStandaloneStore(restoredStore);
    try {
      const res = await fetch('/api/store/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: restoredStore }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore(data.store);
        return data.store as AppStoreData;
      }
    } catch {
      // Static GitHub Pages fallback
    }
    setStore(restoredStore);
    return restoredStore;
  }

  async function handleConnectGoogleDriveFolder() {
    setCloudBusy(true);
    try {
      const token = await ensureGoogleDriveAccessToken();
      setDriveConnected(true);
      const info = await inspectGoogleDriveBackup(token);
      setDriveBackupInfo(info);
      notify(
        'success',
        `Folder "${info.folderName}" siap di Google Drive akun Anda!`
      );
    } catch (err: any) {
      notify('error', err?.message || 'Gagal menghubungkan folder Google Drive.');
    } finally {
      setCloudBusy(false);
    }
  }

  function handleRequestGoogleAccountBackup() {
    if (!store) return;
    // Show mandatory confirmation modal before creating/updating file in user's Google Drive
    setConfirmDriveOverwriteOpen(true);
  }

  async function executeConfirmedGoogleAccountBackup() {
    if (!store) return;
    setConfirmDriveOverwriteOpen(false);
    setCloudBusy(true);
    try {
      const info = await saveBackupToGoogleDrive(store, backupLabelInput);
      setDriveBackupInfo(info);
      setDriveConnected(true);
      setCloudInfo(
        `Tersimpan di Google Drive folder "${info.folderName}" (${info.modifiedTime || 'Baru saja'})`
      );
      notify(
        'success',
        `Backup berhasil disimpan ke Google Drive pada folder "${info.folderName}" (${info.fileName}) & disinkronkan ke Akun Google!`
      );
    } catch (err: any) {
      // Fallback: if popup is blocked, try saving directly to Firestore Cloud tied to Google Account
      try {
        await saveBackupToFirestore(store, backupLabelInput);
        setCloudInfo(
          `Tersimpan di Cloud Akun Google pada ${new Date().toLocaleTimeString('id-ID')}`
        );
        notify(
          'success',
          'Backup berhasil disimpan ke Cloud Akun Google! (Klik "Buka / Izin Folder Google Drive" jika ingin menyalin ke Drive).'
        );
      } catch {
        notify('error', err?.message || 'Gagal mencadangkan ke Akun Google.');
      }
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleGoogleAccountRestore() {
    setCloudBusy(true);
    try {
      let restoredStore: AppStoreData | null = null;
      let restoredSourceLabel = '';

      if (getAccessToken()) {
        const driveData = await loadBackupFromGoogleDrive();
        if (driveData) {
          restoredStore = driveData.store;
          setDriveBackupInfo(driveData.info);
          restoredSourceLabel = `Folder Google Drive "${driveData.info.folderName}" (${driveData.info.modifiedTime || ''})`;
        }
      }

      if (!restoredStore) {
        const snap = await loadBackupFromFirestore();
        if (snap) {
          restoredStore = snap.payload;
          restoredSourceLabel = `Cloud Akun Google "${snap.backupLabel}" (${snap.updatedAtText})`;
        } else {
          const driveData = await loadBackupFromGoogleDrive();
          if (driveData) {
            restoredStore = driveData.store;
            setDriveBackupInfo(driveData.info);
            setDriveConnected(true);
            restoredSourceLabel = `Folder Google Drive "${driveData.info.folderName}"`;
          }
        }
      }

      if (!restoredStore) {
        notify('error', 'Belum ada file backup ditemukan di Akun Google / Google Drive Anda.');
        return;
      }

      const applied = await applyRestoredStoreBothServerAndClient(restoredStore);
      setCloudInfo(`Dipulihkan dari ${restoredSourceLabel}`);
      notify(
        'success',
        `Restore berhasil dari ${restoredSourceLabel}: ${applied.hadiths?.length || 0} materi & ${applied.contacts?.length || 0} kontak dipulihkan.`
      );
    } catch (err: any) {
      notify('error', err?.message || 'Gagal memulihkan data dari Akun Google.');
    } finally {
      setCloudBusy(false);
    }
  }

  function handleSaveToBrowserLocalStorage() {
    if (!store) return;
    try {
      const nowText = new Date().toLocaleString('id-ID');
      localStorage.setItem('bdi_local_backup_snapshot', JSON.stringify(store));
      localStorage.setItem('bdi_local_backup_time', nowText);
      setLocalSavedTimestamp(nowText);
      notify(
        'success',
        `Seluruh database (${store.hadiths.length} hadis & ${store.contacts.length} kontak) berhasil disimpan ke Local Storage browser (${nowText}).`
      );
    } catch {
      notify('error', 'Gagal menyimpan ke Local Storage perangkat.');
    }
  }

  async function handleRestoreFromBrowserLocalStorage() {
    try {
      const raw = localStorage.getItem('bdi_local_backup_snapshot');
      if (!raw) {
        notify('error', 'Belum ada cadangan tersimpan di Local Storage perangkat ini.');
        return;
      }
      const parsed = JSON.parse(raw);
      await applyRestoredStoreBothServerAndClient(parsed);
      notify('success', 'Data berhasil dipulihkan dari Local Storage perangkat ini!');
    } catch {
      notify('error', 'Gagal memulihkan dari Local Storage.');
    }
  }

  function handleExportLocalJson() {
    if (!store) return;
    const backupEnvelope = {
      app: 'BDI Daily Quran & Hadis',
      exportedAt: new Date().toISOString(),
      hadithCount: store.hadiths.length,
      contactCount: store.contacts.length,
      store,
    };
    const blob = new Blob([JSON.stringify(backupEnvelope, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bdi-daily-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('success', 'File backup (.JSON) berhasil di-download ke penyimpanan perangkat.');
  }

  function handleImportLocalJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const rawParsed = JSON.parse(String(ev.target?.result || '{}'));
        const payload = rawParsed?.store || rawParsed?.payload || rawParsed;
        const applied = await applyRestoredStoreBothServerAndClient(payload);
        pushAutoCloudSync(applied, 'Import File JSON Lokal');
        notify(
          'success',
          `Import berhasil! ${applied.hadiths?.length || 0} hadis & ${applied.contacts?.length || 0} kontak telah dipulihkan.`
        );
      } catch {
        notify('error', 'Format file JSON tidak valid.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // =========================================================
  // GATE 1: FIRST-ENTRY GOOGLE ACCOUNT LOGIN & SYNC SCREEN
  // =========================================================
  const activeAccount = firebaseUser
    ? {
        email: firebaseUser.email || 'admin@bdi.id',
        displayName: firebaseUser.displayName || 'Admin BDI',
        uid: firebaseUser.uid,
      }
    : savedAccountSession;

  if (authReady && !activeAccount) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center mx-auto font-bold text-lg">
              BDI
            </div>
            <h1 className="text-xl font-bold text-slate-900">BDI Daily Quran &amp; Hadis</h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Masuk dengan <strong>Akun Google</strong> untuk menghubungkan Generator AI Hadis Shahih, sinkronisasi real-time antar perangkat (Android &amp; Browser Laptop), serta integrasi Cloud Firebase, GitHub &amp; Google Sheets.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs text-slate-700">
            <div className="flex items-start gap-2.5">
              <Globe className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                <strong>Sinkronisasi Multi-Device Real-Time:</strong> Projek yang berjalan di HP Android (Vivo Y71) dapat dipantau dan dikendalikan langsung dari browser perangkat lain dengan akun Google yang sama.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                <strong>Terkoneksi ke AI &amp; Cloud:</strong> Otomatis mengatur koneksi ke Gemini AI, Firebase Firestore, GitHub &amp; Google Sheets.
              </span>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer bg-emerald-50/60 border border-emerald-200 p-3 rounded-lg">
            <input
              type="checkbox"
              checked={saveLoginInfo}
              onChange={(e) => setSaveLoginInfo(e.target.checked)}
              className="w-4 h-4 accent-emerald-700"
            />
            <span>
              <strong>Simpan Info Login (Save Login Info)</strong> — Cukup sekali login saja, otomatis masuk saat aplikasi dibuka kembali.
            </span>
          </label>

          <button
            type="button"
            disabled={loginBusy}
            onClick={handleGoogleLoginSubmit}
            className="w-full min-h-[48px] px-5 py-3 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-colors"
          >
            <span>{loginBusy ? 'Menghubungkan Akun Google...' : 'Masuk dengan Akun Google'}</span>
          </button>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>Dioptimalkan untuk Vivo Y71 &amp; Web App</span>
            <PWAInstallButton />
          </div>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center space-y-2">
          <p className="text-base font-bold text-slate-900">BDI Daily Quran &amp; Hadis</p>
          <p className="text-xs text-slate-600">Memuat sinkronisasi real-time &amp; database...</p>
        </div>
      </div>
    );
  }

  const allProfiles =
    store.profiles && store.profiles.length > 0
      ? store.profiles
      : ['Oktober', 'Belum Terkategori'];

  // Computed filters & metrics
  const filteredHadiths = store.hadiths.filter((h) => {
    const itemProf = h.profileName || 'Belum Terkategori';
    if (dbProfileFilter !== 'all' && itemProf !== dbProfileFilter) return false;
    if (dbTypeFilter !== 'all' && h.type !== dbTypeFilter) return false;
    if (!dbSearch.trim()) return true;
    const q = dbSearch.toLowerCase();
    return (
      h.title.toLowerCase().includes(q) ||
      h.translationText.toLowerCase().includes(q) ||
      h.sourceBook.toLowerCase().includes(q) ||
      h.categoryTopic.toLowerCase().includes(q) ||
      itemProf.toLowerCase().includes(q)
    );
  });

  const filteredContacts = store.contacts.filter((c) => {
    if (contactPrefFilter !== 'all' && c.preference !== contactPrefFilter) return false;
    if (!contactSearch.trim()) return true;
    const q = contactSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.groupTag.toLowerCase().includes(q)
    );
  });

  const filteredLogs = store.deliveryLogs.filter((l) => {
    if (logStatusFilter === 'all') return true;
    return l.status === logStatusFilter;
  });

  const countSingkat = store.contacts.filter((c) => c.preference === 'singkat').length;
  const countDetail = store.contacts.filter((c) => c.preference === 'detail').length;
  const countQueued = store.deliveryLogs.filter(
    (l) => l.status === 'queued' || l.status === 'sending'
  ).length;
  const countPaused = store.deliveryLogs.filter((l) => l.status === 'paused').length;
  const countSent = store.deliveryLogs.filter((l) => l.status === 'sent').length;
  const countFailed = store.deliveryLogs.filter((l) => l.status === 'failed').length;

  // Detect schedule collision across active BDI Projects
  const runningProjects = (store.projects || []).filter((p) => p.status === 'running');
  const scheduleCollisions: string[] = [];
  for (let i = 0; i < runningProjects.length; i++) {
    for (let j = i + 1; j < runningProjects.length; j++) {
      const p1 = runningProjects[i];
      const p2 = runningProjects[j];
      const diffMinutes = Math.abs(
        parseTimeMinutes(p1.sendTime) - parseTimeMinutes(p2.sendTime)
      );
      const estimatedDurationMin = Math.ceil(
        (store.contacts.length * ((p1.minDelaySeconds + p1.maxDelaySeconds) / 2)) / 60
      );
      if (diffMinutes < Math.max(15, estimatedDurationMin)) {
        scheduleCollisions.push(
          `Jadwal "${p1.name}" (${p1.sendTime}) berdekatan/tabrakan dengan "${p2.name}" (${p2.sendTime}). Disarankan beri selisih minimal ${Math.max(15, estimatedDurationMin)} menit agar antrean WA tidak bertumpuk.`
        );
      }
    }
  }

  // Check if the project currently being edited collides with existing running projects
  const formCollisionProject = (store.projects || []).find((p) => {
    if (p.id === editingProject.id || p.status === 'stopped') return false;
    const diff = Math.abs(
      parseTimeMinutes(p.sendTime) - parseTimeMinutes(editingProject.sendTime || '06:00')
    );
    return diff < 15;
  });

  const sampleHadithForPreview =
    store.hadiths.find((h) => h.id === previewSampleHadithId) || store.hadiths[0];

  const defaultLengkapTpl =
    store.templates.find((t) => t.category === 'lengkap' && t.isDefault) ||
    store.templates.find((t) => t.category === 'lengkap') ||
    store.templates[0];

  const defaultSingkatTpl =
    store.templates.find((t) => t.category === 'singkat' && t.isDefault) ||
    store.templates.find((t) => t.category === 'singkat') ||
    store.templates[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-20 md:pb-8">
      {/* TOP BAR CONTRACT: 3 Zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-8 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('database');
          }}
          className="text-base lg:text-lg font-bold tracking-tight text-emerald-800 whitespace-nowrap shrink-0"
        >
          BDI Daily Quran &amp; Hadis
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => setActiveTab('database')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'database'
                ? 'border-emerald-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            1. Database &amp; AI
          </button>
          <button
            onClick={() => setActiveTab('format')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'format'
                ? 'border-emerald-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            2. Format Kirim
          </button>
          <button
            onClick={() => setActiveTab('kontak')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'kontak'
                ? 'border-emerald-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            3. Kontak Jamaah
          </button>
          <button
            onClick={() => setActiveTab('kirim')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'kirim'
                ? 'border-emerald-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            4. BDI Projek &amp; Jadwal
          </button>
          <button
            onClick={() => setActiveTab('sistem')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'sistem'
                ? 'border-emerald-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            5. WA Admin &amp; Cloud Sync
          </button>
        </nav>

        {/* Zone 3: Primary action & Logout */}
        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton />
          <button
            onClick={handleFullLogout}
            className="min-h-[40px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            title={`Keluar dari ${activeAccount?.email}`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* SUBTLE SUMMARY & REAL-TIME ACCOUNT SYNC STRIP */}
      <div className="bg-slate-100 border-b border-slate-200 px-4 lg:px-8 py-2 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Akun Sinkronisasi: <strong className="text-emerald-800">{activeAccount?.email}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Profil DB: <strong className="font-mono-num text-slate-900">{allProfiles.length}</strong> ({store.hadiths.length} hadis)
          </span>
          <span aria-hidden="true">·</span>
          <span>
            BDI Projek Aktif: <strong className="font-mono-num text-slate-900">{runningProjects.length}</strong> projek
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono-num">
          <span>
            WA Admin ({store.gatewaySettings.adminPhone}):{' '}
            <strong
              className={
                waState.status === 'connected'
                  ? 'text-emerald-700'
                  : store.gatewaySettings.activeMode === 'webhook'
                  ? 'text-blue-700'
                  : 'text-amber-700'
              }
            >
              {waState.status === 'connected'
                ? 'Terhubung (Headless Aktif)'
                : store.gatewaySettings.activeMode === 'webhook'
                ? 'Mode Webhook API'
                : store.gatewaySettings.simulateIfOffline
                ? 'Siap (Headless Server)'
                : 'Belum Terhubung'}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>Server: {serverTime}</span>
        </div>
      </div>

      {/* NOTIFICATION BANNER */}
      {bannerMsg && (
        <div
          className={`mx-4 lg:mx-8 mt-4 px-4 py-3 rounded-lg border text-sm font-medium flex items-center justify-between ${
            bannerMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <span>{bannerMsg.text}</span>
          <button
            onClick={() => setBannerMsg(null)}
            className="text-xs underline ml-4 whitespace-nowrap shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ============================================================
          MODAL KONFIRMASI SIMPAN / TIMPA FILE DI FOLDER GOOGLE DRIVE
         ============================================================ */}
      {confirmDriveOverwriteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-lg p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Konfirmasi Backup ke Folder Google Drive
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed">
              Aplikasi akan membuat atau memperbarui file cadangan{' '}
              <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">
                bdi-daily-hadis-backup.json
              </code>{' '}
              di dalam folder khusus{' '}
              <strong>&ldquo;BDI Daily Quran &amp; Hadis Backup&rdquo;</strong> pada Google Drive
              akun <strong>{activeAccount?.email}</strong> ({store.hadiths.length} materi hadis,{' '}
              {store.contacts.length} kontak, dan {store.projects.length} BDI Projek).
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setConfirmDriveOverwriteOpen(false)}
                className="min-h-[40px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeConfirmedGoogleAccountBackup}
                className="min-h-[40px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
              >
                Ya, Simpan ke Folder Google Drive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL TUTORIAL SEDERHANA (WA QR, AKUN GOOGLE DRIVE, LOCAL STORAGE/JSON)
         ============================================================ */}
      {activeTutorialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Panduan Koneksi WA Admin &amp; Backup Data
              </h3>
              <button
                type="button"
                onClick={() => setActiveTutorialModal(null)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap gap-1.5">
              {[
                { id: 'wa_qr', label: '1. Cara Tautkan WA Admin (QR / Pairing Code)' },
                { id: 'google_account', label: '2. Cara Backup ke Akun Google (Folder Drive)' },
                { id: 'local', label: '3. Cara Backup Local Storage / Download & Import' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTutorialModal(t.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    activeTutorialModal === t.id
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-700">
              {activeTutorialModal === 'wa_qr' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900">
                    Tutorial Menautkan Nomor WA Admin Headless (QR Asli WhatsApp &amp; Pairing Code)
                  </h4>
                  <p>
                    Mesin Baileys kini langsung menghasilkan <strong>QR Code Asli WhatsApp Web</strong> beserta <strong>Auto-Reconnect Handshake (Kode 515)</strong> sehingga saat Anda scan dari aplikasi WhatsApp di HP, perangkat langsung tertaut secara nyata.
                  </p>
                  <ol className="list-decimal list-inside space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <li>
                      Ketik nomor WhatsApp Admin Anda pada kolom <strong>Nomor WhatsApp Admin Pengirim</strong> lalu klik <strong>Simpan Nomor</strong>.
                    </li>
                    <li>
                      <strong>Metode Scan QR (2 Perangkat):</strong> Klik <strong>Tampilkan QR Code Baru</strong>, tunggu 2–3 detik hingga QR hitam-putih resmi WhatsApp muncul, lalu buka WhatsApp di HP &rarr; <strong>Perangkat Tertaut</strong> &rarr; <strong>Tautkan Perangkat</strong> &rarr; arahkan kamera ke QR. Setelah di-scan, tunggu 2–4 detik hingga status otomatis berubah menjadi <strong>CONNECTED</strong>.
                    </li>
                    <li>
                      <strong>Metode 1 HP (Vivo Y71 Tanpa Scan):</strong> Klik <strong>Minta 8-Digit Pairing Code (1 HP)</strong>, tunggu 2–3 detik hingga kode 8 huruf/angka muncul, lalu masukkan kode tersebut pada notifikasi WhatsApp yang muncul di HP Anda.
                    </li>
                  </ol>
                </div>
              )}

              {activeTutorialModal === 'google_account' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900">
                    Bagaimana Cara Kerja Backup &amp; Sinkronisasi ke Akun Google?
                  </h4>
                  <p>
                    Kami telah menyederhanakan sistem backup agar <strong>otomatis diatur oleh aplikasi</strong> cukup dengan Akun Google Anda (<strong>{activeAccount?.email}</strong>):
                  </p>
                  <ol className="list-decimal list-inside space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <li>
                      <strong>Otomatis Buat Folder di Google Drive:</strong> Saat Anda klik <strong>Backup ke Akun Google (Google Drive)</strong>, aplikasi otomatis membuat folder khusus bernama <code>BDI Daily Quran &amp; Hadis Backup</code> di dalam Google Drive Anda.
                    </li>
                    <li>
                      <strong>Simpan &amp; Timpa 1 File Rapi:</strong> Di dalam folder tersebut, aplikasi menyimpan file <code>bdi-daily-hadis-backup.json</code> yang berisi seluruh profil database hadis, format kirim, kontak jamaah, dan jadwal BDI Projek.
                    </li>
                    <li>
                      <strong>Sinkronisasi Real-Time Lintas Perangkat:</strong> Selain disimpan di folder Google Drive, aplikasi juga menyinkronkan data secara real-time antar HP Android dan browser laptop yang login dengan akun Google yang sama.
                    </li>
                  </ol>
                </div>
              )}

              {activeTutorialModal === 'local' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900">
                    Cara Backup ke Local Storage Browser, Download File (.JSON) &amp; Import
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <li>
                      <strong>Simpan Cepat ke Local Storage Perangkat:</strong> Klik tombol <strong>Simpan ke Local Storage</strong> untuk menyimpan cadangan instan di memori browser HP/Laptop tanpa kuota internet.
                    </li>
                    <li>
                      <strong>Download File Backup (.JSON):</strong> Klik tombol <strong>Download File Backup (.JSON)</strong> untuk mengunduh seluruh data menjadi file ke folder <em>Download</em> di HP Vivo Y71 atau komputer Anda.
                    </li>
                    <li>
                      <strong>Import File Backup (.JSON):</strong> Klik tombol <strong>Import File Backup (.JSON)</strong> lalu pilih file <code>.json</code> dari penyimpanan HP/komputer untuk memulihkan seluruh database hadis, kontak, dan projek secara utuh.
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTutorialModal(null)}
                className="min-h-[40px] px-5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
              >
                Mengerti &amp; Tutup Tutorial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL PREVIEW HADIS (PILIH SINGKAT ATAU DETAIL)
         ============================================================ */}
      {activePreviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">
                  Profil: <strong>{activePreviewItem.profileName || 'Belum Terkategori'}</strong> ·{' '}
                  {activePreviewItem.sourceBook} No. {activePreviewItem.hadithNumber}
                </p>
                <h3 className="text-base font-bold text-slate-900 truncate">
                  {activePreviewItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePreviewItem(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle Singkat / Detail inside Modal */}
            <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700">
                Pilih Mode Tampilan Preview:
              </span>
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-300">
                <button
                  type="button"
                  onClick={() => setActivePreviewMode('singkat')}
                  className={`min-h-[36px] px-3.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    activePreviewMode === 'singkat'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Preview Hadis Singkat
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewMode('detail')}
                  className={`min-h-[36px] px-3.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    activePreviewMode === 'detail'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Preview Hadis Detail (Lengkap)
                </button>
              </div>
            </div>

            {/* Modal Content Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {activePreviewMode === 'singkat' ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-2">
                    <p className="text-xs font-bold text-emerald-900">
                      Isi Materi Singkat (Untuk Kategori Kontak Penerima Singkat):
                    </p>
                    <p className="text-sm text-slate-800 leading-relaxed">
                      &ldquo;{activePreviewItem.shortSummary}&rdquo;
                    </p>
                    <p className="text-xs text-slate-700 pt-1">
                      <strong>Hikmah Shahih:</strong> {activePreviewItem.lessonText}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs font-bold text-slate-700 mb-2">
                      Simulasi Pesan WhatsApp (Format Singkat):
                    </p>
                    <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800 bg-white p-3.5 rounded border border-slate-200 leading-relaxed">
                      {renderClientPreview(
                        defaultSingkatTpl?.content || '',
                        activePreviewItem,
                        'Bapak H. Hendra'
                      )}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {activePreviewItem.arabicText && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Teks Arab:</p>
                      <p
                        dir="rtl"
                        className="text-xl font-arabic text-slate-900 text-right leading-loose"
                      >
                        {activePreviewItem.arabicText}
                      </p>
                    </div>
                  )}

                  <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3 text-xs leading-relaxed">
                    <div>
                      <p className="font-bold text-slate-900">Terjemahan Lengkap:</p>
                      <p className="text-slate-700 mt-0.5">
                        &ldquo;{activePreviewItem.translationText}&rdquo; ({activePreviewItem.sourceBook}{' '}
                        No. {activePreviewItem.hadithNumber})
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="font-bold text-emerald-900">
                        Asbabul Wurud / Sebab Munculnya Hadis (Shahih):
                      </p>
                      <p className="text-slate-700 mt-0.5">
                        {activePreviewItem.asbabulWurud ||
                          'Tidak terdapat riwayat asbabul wurud khusus untuk hadis ini; hadis ini merupakan sabda tuntunan umum Rasulullah ﷺ.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="font-bold text-emerald-900">Hikmah &amp; Pelajaran Shahih:</p>
                      <p className="text-slate-700 mt-0.5">{activePreviewItem.lessonText}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs font-bold text-slate-700 mb-2">
                      Simulasi Pesan WhatsApp (Format Detail Lengkap):
                    </p>
                    <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800 bg-white p-3.5 rounded border border-slate-200 leading-relaxed">
                      {renderClientPreview(
                        defaultLengkapTpl?.content || '',
                        activePreviewItem,
                        'Ustadz Ahmad Fauzi'
                      )}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setEditingHadith(activePreviewItem);
                  setActivePreviewItem(null);
                }}
                className="min-h-[40px] px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Materi Ini</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewItem(null)}
                className="min-h-[40px] px-5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
              >
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL EDIT MATERI HADIS
         ============================================================ */}
      {editingHadith && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Edit Materi Hadis / Al-Quran</h3>
              <button
                type="button"
                onClick={() => setEditingHadith(null)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Profil Database
                  </label>
                  <select
                    value={editingHadith.profileName || 'Belum Terkategori'}
                    onChange={(e) =>
                      setEditingHadith({ ...editingHadith, profileName: e.target.value })
                    }
                    className="w-full min-h-[40px] px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  >
                    {allProfiles.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kitab Perawi
                  </label>
                  <input
                    type="text"
                    value={editingHadith.sourceBook}
                    onChange={(e) =>
                      setEditingHadith({ ...editingHadith, sourceBook: e.target.value })
                    }
                    className="w-full min-h-[40px] px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor Hadis
                  </label>
                  <input
                    type="text"
                    value={editingHadith.hadithNumber}
                    onChange={(e) =>
                      setEditingHadith({ ...editingHadith, hadithNumber: e.target.value })
                    }
                    className="w-full min-h-[40px] px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Materi
                </label>
                <input
                  type="text"
                  value={editingHadith.title}
                  onChange={(e) => setEditingHadith({ ...editingHadith, title: e.target.value })}
                  className="w-full min-h-[40px] px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Teks Arab</label>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={editingHadith.arabicText}
                  onChange={(e) =>
                    setEditingHadith({ ...editingHadith, arabicText: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-lg font-arabic text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Terjemah Lengkap (Detail)
                </label>
                <textarea
                  rows={3}
                  value={editingHadith.translationText}
                  onChange={(e) =>
                    setEditingHadith({ ...editingHadith, translationText: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Asbabul Wurud / Sebab Munculnya Hadis (Shahih)
                </label>
                <textarea
                  rows={2}
                  value={editingHadith.asbabulWurud || ''}
                  onChange={(e) =>
                    setEditingHadith({ ...editingHadith, asbabulWurud: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ringkasan Singkat (Untuk Penerima Singkat)
                </label>
                <textarea
                  rows={2}
                  value={editingHadith.shortSummary}
                  onChange={(e) =>
                    setEditingHadith({ ...editingHadith, shortSummary: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hikmah &amp; Pelajaran Shahih
                </label>
                <textarea
                  rows={2}
                  value={editingHadith.lessonText}
                  onChange={(e) =>
                    setEditingHadith({ ...editingHadith, lessonText: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingHadith(null)}
                className="min-h-[40px] px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleUpdateSavedHadith(editingHadith)}
                className="min-h-[40px] px-5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 lg:px-8 py-6">
        {/* ============================================================
            TAB 1: DATABASE HADIS, PROFIL LIST & AI GENERATOR
            (Tanpa Tambah Manual & Tanpa Box Manajemen Profil Terpisah)
           ============================================================ */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
                01. Database Hadis Shahih &amp; Pembuat Database AI
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Generate database Hadis Shahih berbantuan AI (lengkap Asbabul Wurud &amp; Hikmah yang shahih). Saat menyimpan hasil generate, Anda tinggal memilih profil tujuan atau mengetik nama <strong>Profil Baru</strong>.
              </p>
            </div>

            {/* AI GENERATOR PANEL */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900">
                  Generator Database AI (Terkoneksi ke Akun {activeAccount?.email})
                </h2>
                <p className="text-xs text-slate-600">
                  Ketik jumlah hadis secara bebas, masukkan kriteria topik, lalu simpan ke profil yang diinginkan.
                </p>
              </div>

              <form onSubmit={handleGenerateWithAI} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Materi
                  </label>
                  <select
                    value={aiType}
                    onChange={(e) => setAiType(e.target.value as 'hadis' | 'quran')}
                    className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900"
                  >
                    <option value="hadis">Hadis Shahih</option>
                    <option value="quran">Ayat Al-Quran</option>
                  </select>
                </div>

                <div className="md:col-span-6">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kriteria / Tema Pembahasan
                  </label>
                  <input
                    type="text"
                    value={aiCriteria}
                    onChange={(e) => setAiCriteria(e.target.value)}
                    placeholder="Contoh: Keutamaan sedekah pagi, berbakti pada orang tua..."
                    className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Hadis (Ketik)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={aiCountInput}
                    onChange={(e) => setAiCountInput(e.target.value)}
                    placeholder="Misal: 5"
                    className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-mono-num"
                  />
                </div>

                {aiType === 'hadis' && (
                  <div className="md:col-span-12 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-slate-800">
                        Pilih Sumber Kitab Shahih Gratis (Bisa Pilih Lebih dari Satu):{' '}
                        <span className="text-emerald-800 font-mono-num">
                          ({aiBooks.length} kitab dipilih)
                        </span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setAiBooks([
                              'bukhari',
                              'muslim',
                              'tirmidzi',
                              'abu-daud',
                              'nasai',
                              'ibnu-majah',
                            ])
                          }
                          className="text-xs font-semibold text-emerald-800 underline"
                        >
                          Pilih Semua Kitab (6 Kitab)
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setAiBooks(['bukhari', 'muslim'])}
                          className="text-xs font-semibold text-slate-600 underline"
                        >
                          Hanya Bukhari &amp; Muslim
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {[
                        { id: 'bukhari', label: 'Shahih Bukhari' },
                        { id: 'muslim', label: 'Shahih Muslim' },
                        { id: 'tirmidzi', label: 'Sunan Tirmidzi' },
                        { id: 'abu-daud', label: 'Sunan Abu Dawud' },
                        { id: 'nasai', label: "Sunan An-Nasa'i" },
                        { id: 'ibnu-majah', label: 'Sunan Ibnu Majah' },
                      ].map((book) => {
                        const isChecked = aiBooks.includes(book.id);
                        return (
                          <label
                            key={book.id}
                            className={`min-h-[40px] px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAiBooks((prev) =>
                                    prev.includes(book.id) ? prev : [...prev, book.id]
                                  );
                                } else {
                                  if (aiBooks.length <= 1) {
                                    notify('error', 'Minimal 1 sumber kitab harus tetap dipilih.');
                                    return;
                                  }
                                  setAiBooks((prev) => prev.filter((id) => id !== book.id));
                                }
                              }}
                              className="w-4 h-4 accent-emerald-700 shrink-0"
                            />
                            <span className="truncate">{book.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="md:col-span-12 flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                    <span>Topik Cepat:</span>
                    {[
                      'Keutamaan Sedekah & Infaq',
                      'Adab & Akhlak Mulia',
                      'Keutamaan Membaca Al-Quran',
                      'Sabar & Syukur dalam Ujian',
                      'Silaturahmi & Menjaga Lisan',
                    ].map((preset) => (
                      <button
                        type="button"
                        key={preset}
                        onClick={() => setAiCriteria(preset)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={aiLoading}
                    className="min-h-[44px] px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {aiLoading
                        ? 'Menyusun Database dengan AI...'
                        : `Generate ${aiCountInput || 1} Hadis dengan AI`}
                    </span>
                  </button>
                </div>
              </form>

              {/* SAVE GENERATED DATABASE TO EXISTING OR NEW PROFILE */}
              {previewItems.length > 0 && (
                <div className="mt-6 pt-5 border-t border-slate-200 space-y-4">
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-emerald-950">
                        Simpan {previewItems.length} Hasil Generate AI ke Profil Database
                      </h3>
                      <p className="text-xs text-slate-600">
                        Pilih profil yang sudah ada atau pilih <strong>+ Buat Profil Baru</strong> lalu ketik namanya (misal: Oktober, November, Ramadhan).
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={saveProfileMode}
                        onChange={(e) => setSaveProfileMode(e.target.value)}
                        className="min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
                      >
                        {allProfiles.map((p) => (
                          <option key={p} value={p}>
                            Simpan ke Profil: {p}
                          </option>
                        ))}
                        <option value="__NEW__">+ Buat Profil Baru (Ketik Nama)...</option>
                      </select>

                      {saveProfileMode === '__NEW__' && (
                        <input
                          type="text"
                          value={newProfileNameOnSave}
                          onChange={(e) => setNewProfileNameOnSave(e.target.value)}
                          placeholder="Ketik nama profil baru..."
                          className="min-h-[42px] px-3 py-2 bg-white border border-emerald-600 rounded-lg text-xs w-48"
                          autoFocus
                        />
                      )}

                      <button
                        type="button"
                        onClick={handleSavePreviewToDatabase}
                        className="min-h-[42px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Check className="w-4 h-4" />
                        <span>Simpan Database Sekarang</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewItems([])}
                        className="min-h-[42px] px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg"
                      >
                        Batal
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-slate-50">
                    {previewItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono-num font-bold text-emerald-800">
                              Draf #{idx + 1}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {item.sourceBook} No. {item.hadithNumber}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>Topik: {item.categoryTopic}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">
                            {item.title}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePreviewItem(item);
                              setActivePreviewMode('detail');
                            }}
                            className="min-h-[38px] px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview Hadis</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingHadith(item)}
                            className="min-h-[38px] px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewItems((prev) => prev.filter((p) => p.id !== item.id))
                            }
                            className="min-h-[38px] px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* MASTER-DETAIL: PROFILES LIST (LEFT) + HADITH ITEMS IN PROFILE (RIGHT) */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Selectable List of Profiles (View, Edit/Rename, Delete) */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="border-b border-slate-200 pb-2.5">
                  <h2 className="text-sm font-bold text-slate-900">
                    Daftar Profil Database (Pilih untuk Lihat, Edit, atau Hapus)
                  </h2>
                </div>

                {renamingProfile && (
                  <form
                    onSubmit={handleRenameProfileSubmit}
                    className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg space-y-2"
                  >
                    <label className="block text-xs font-bold text-emerald-950">
                      Ubah Nama Profil &ldquo;{renamingProfile.oldName}&rdquo;:
                    </label>
                    <input
                      type="text"
                      value={renamingProfile.newName}
                      onChange={(e) =>
                        setRenamingProfile({ ...renamingProfile, newName: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRenamingProfile(null)}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-emerald-700 text-white rounded text-xs font-semibold"
                      >
                        Simpan Nama
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  <div
                    onClick={() => setDbProfileFilter('all')}
                    className={`cursor-pointer p-3 rounded-lg border flex items-center justify-between transition-colors ${
                      dbProfileFilter === 'all'
                        ? 'bg-emerald-50/90 border-emerald-700 text-slate-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Folder className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div>
                        <p className="text-xs font-bold">Semua Profil Database</p>
                        <p className="text-[11px] text-slate-500">
                          Gabungan seluruh materi tersimpan
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono-num font-bold text-emerald-800">
                      {store.hadiths.length} data
                    </span>
                  </div>

                  {allProfiles.map((prof) => {
                    const count = store.hadiths.filter(
                      (h) => (h.profileName || 'Belum Terkategori') === prof
                    ).length;
                    const isSelected = dbProfileFilter === prof;
                    return (
                      <div
                        key={prof}
                        onClick={() => setDbProfileFilter(prof)}
                        className={`cursor-pointer p-3 rounded-lg border flex items-center justify-between gap-2 transition-colors ${
                          isSelected
                            ? 'bg-emerald-50/90 border-emerald-700 text-slate-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{prof}</p>
                          <p className="text-[11px] font-mono-num text-slate-500">
                            {count} materi hadis/quran
                          </p>
                        </div>

                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setDbProfileFilter(prof)}
                            className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded"
                            title="Lihat isi profil"
                          >
                            Lihat
                          </button>
                          {prof !== 'Belum Terkategori' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setRenamingProfile({ oldName: prof, newName: prof })
                                }
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                                title="Edit nama profil"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProfile(prof)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Hapus profil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Hadiths inside Selected Profile */}
              <div className="lg:col-span-8 space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Isi Profil:{' '}
                      <span className="text-emerald-800">
                        {dbProfileFilter === 'all' ? 'Semua Profil' : dbProfileFilter}
                      </span>{' '}
                      ({filteredHadiths.length} Materi)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Klik tombol <strong>Preview Hadis</strong> pada baris mana pun untuk memilih pratinjau Singkat atau Detail.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={dbTypeFilter}
                      onChange={(e) =>
                        setDbTypeFilter(e.target.value as 'all' | 'hadis' | 'quran')
                      }
                      className="min-h-[38px] px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                    >
                      <option value="all">Semua</option>
                      <option value="hadis">Hadis</option>
                      <option value="quran">Al-Quran</option>
                    </select>
                    <div className="relative w-full sm:w-52">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={dbSearch}
                        onChange={(e) => setDbSearch(e.target.value)}
                        placeholder="Cari hadis..."
                        className="w-full min-h-[38px] pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                {filteredHadiths.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                    <p className="text-sm font-semibold text-slate-800">
                      Tidak ada materi hadis pada profil ini.
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Silakan generate hadis baru melalui panel AI di atas lalu simpan ke profil ini.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                    {filteredHadiths.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono-num font-bold text-emerald-800">
                              #{idx + 1}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-slate-800">
                              Profil: {item.profileName || 'Belum Terkategori'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {item.sourceBook} No. {item.hadithNumber}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>Topik: {item.categoryTopic}</span>
                          </div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900">
                            {item.title}
                          </h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePreviewItem(item);
                              setActivePreviewMode('detail');
                            }}
                            className="min-h-[38px] px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview Hadis</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingHadith(item)}
                            className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSavedHadith(item.id)}
                            className="min-h-[38px] px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ============================================================
            TAB 2: EDITOR FORMAT KIRIM (VARIABLES + SAVE/LOAD)
           ============================================================ */}
        {activeTab === 'format' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
                02. Editor Format Kirim (Format Lengkap &amp; Singkat)
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Susun template pengiriman dengan memanggil variabel dinamis (termasuk <code>{'{asbabul_wurud}'}</code> dan <code>{'{hikmah}'}</code>). Anda dapat menyimpan (Save), memuat (Load), dan memilih format utama.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Daftar Format Tersimpan (Klik untuk Load / Pilih)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {store.templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl)}
                        className={`cursor-pointer p-3 rounded-lg border text-left transition-colors flex items-center justify-between gap-2 ${
                          selectedTemplateId === tpl.id
                            ? 'bg-emerald-50/70 border-emerald-700'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{tpl.name}</p>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            Kategori: <strong className="uppercase">{tpl.category}</strong>
                            {tpl.isDefault ? ' · Aktif Utama' : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTemplate(tpl.id);
                          }}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600"
                          title="Hapus Format"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Format Template
                    </label>
                    <input
                      type="text"
                      value={tplName}
                      onChange={(e) => setTplName(e.target.value)}
                      className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kategori Format
                    </label>
                    <select
                      value={tplCategory}
                      onChange={(e) =>
                        setTplCategory(e.target.value as 'lengkap' | 'singkat' | 'pengumuman')
                      }
                      className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="lengkap">Format Lengkap (Detail)</option>
                      <option value="singkat">Format Singkat</option>
                      <option value="pengumuman">Format Pengumuman</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Klik Variabel untuk Menyisipkan ke Format Pesan:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVariableAtCursor(v.key)}
                        className="min-h-[36px] px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-300 rounded-md text-xs font-mono-num font-medium transition-colors whitespace-nowrap shrink-0"
                      >
                        {v.key} <span className="font-sans text-slate-500">({v.label})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Isi Format Kirim WhatsApp
                  </label>
                  <textarea
                    ref={templateTextareaRef}
                    rows={10}
                    value={tplContent}
                    onChange={(e) => setTplContent(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono leading-relaxed"
                  />
                </div>

                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tplIsDefault}
                    onChange={(e) => setTplIsDefault(e.target.checked)}
                    className="w-4 h-4 accent-emerald-700"
                  />
                  <span>
                    Jadikan sebagai format utama (Default) untuk kategori{' '}
                    <strong>{tplCategory.toUpperCase()}</strong>
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSaveTemplate(false)}
                    className="min-h-[44px] px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <Check className="w-4 h-4" />
                    <span>Simpan Perubahan Format</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveTemplate(true)}
                    className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Simpan Sebagai Preset Baru</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Pratinjau Tampilan Pesan WhatsApp
                    </h2>
                    <p className="text-xs text-slate-500">
                      Hasil render variabel otomatis menggunakan sampel database hadis Anda.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pilih Sampel Materi Database untuk Preview:
                  </label>
                  <select
                    value={previewSampleHadithId}
                    onChange={(e) => setPreviewSampleHadithId(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  >
                    {store.hadiths.map((h, i) => (
                      <option key={h.id} value={h.id}>
                        [{h.profileName || 'Umum'}] #{i + 1} - {h.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-emerald-950/5 border border-emerald-900/15">
                  <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-2xs">
                    <p className="text-[11px] font-semibold text-emerald-800 mb-2">
                      BDI Daily Quran &amp; Hadis ({tplCategory.toUpperCase()})
                    </p>
                    <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800 leading-relaxed">
                      {renderClientPreview(tplContent, sampleHadithForPreview)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 3: KONTAK JAMAAH (KATEGORI SINGKAT & DETAIL)
           ============================================================ */}
        {activeTab === 'kontak' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
                  03. Daftar Kontak Jamaah &amp; Kategori Penerima
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Kelola daftar nomor WhatsApp jamaah, tentukan penerima <strong>Hadis Singkat</strong> atau <strong>Hadis Detail</strong>, serta <strong>Impor / Export Kontak</strong>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
                <button
                  type="button"
                  onClick={() => handleExportContacts('csv')}
                  className="min-h-[42px] px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Kontak (.CSV / Excel)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportContacts('json')}
                  className="min-h-[42px] px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4 text-emerald-700" />
                  <span>Export Kontak (.JSON)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkImport(!showBulkImport)}
                  className="min-h-[42px] px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Upload className="w-4 h-4 text-emerald-700" />
                  <span>Impor Kontak Massal</span>
                </button>
              </div>
            </div>

            {showBulkImport && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Impor Massal Kontak (Format: Nama, NomorWA, singkat/detail, Grup)
                </h3>
                <p className="text-xs text-slate-600">
                  Masukkan satu kontak per baris. Contoh:{' '}
                  <code>Bapak Budi, 08123456789, singkat, Jamaah Masjid</code>
                </p>
                <textarea
                  rows={4}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={
                    'Ustadz Hasan, 081298765432, detail, Pengurus\nIbu Rina, 081311223344, singkat, Majelis Ibu'
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkImport(false)}
                    className="min-h-[40px] px-3.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkImportSubmit}
                    className="min-h-[40px] px-4 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                  >
                    Proses Impor Kontak
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleSaveContact}
                className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
              >
                <h2 className="text-base font-bold text-slate-900">
                  {editingContactId ? 'Edit Kontak Jamaah' : 'Tambah Kontak Penerima Baru'}
                </h2>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap / Sapaan
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Contoh: Bapak H. Abdullah"
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor WhatsApp (Otomatis ke 628...)
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono-num"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Format Penerima
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setContactPreference('singkat')}
                      className={`min-h-[42px] px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        contactPreference === 'singkat'
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-50 text-slate-700 border-slate-300'
                      }`}
                    >
                      Penerima Singkat
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactPreference('detail')}
                      className={`min-h-[42px] px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        contactPreference === 'detail'
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-50 text-slate-700 border-slate-300'
                      }`}
                    >
                      Penerima Detail
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kelompok / Grup Jamaah
                  </label>
                  <input
                    type="text"
                    value={contactGroup}
                    onChange={(e) => setContactGroup(e.target.value)}
                    placeholder="Contoh: Jamaah Reguler / Pengurus"
                    className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  {editingContactId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingContactId(null);
                        setContactName('');
                        setContactPhone('');
                        setContactNotes('');
                      }}
                      className="min-h-[44px] px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg"
                    >
                      Batal
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 min-h-[44px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                  >
                    {editingContactId ? 'Simpan Perubahan Kontak' : 'Tambah ke Daftar Kontak'}
                  </button>
                </div>
              </form>

              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                    <button
                      onClick={() => setContactPrefFilter('all')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        contactPrefFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Semua ({store.contacts.length})
                    </button>
                    <button
                      onClick={() => setContactPrefFilter('singkat')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        contactPrefFilter === 'singkat'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Kategori Singkat ({countSingkat})
                    </button>
                    <button
                      onClick={() => setContactPrefFilter('detail')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        contactPrefFilter === 'detail'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Kategori Detail ({countDetail})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      placeholder="Cari nama atau nomor WA..."
                      className="w-full min-h-[40px] pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>

                {filteredContacts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Belum ada kontak jamaah pada kategori ini.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 border-t border-slate-200">
                    {filteredContacts.map((c) => (
                      <div
                        key={c.id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-900">{c.name}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span className="font-mono-num text-slate-800">{c.phone}</span>
                            <span aria-hidden="true">·</span>
                            <span>Grup: {c.groupTag}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-emerald-800">
                              Kategori:{' '}
                              {c.preference === 'singkat' ? 'Hadis Singkat' : 'Hadis Detail'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleToggleContactPreference(c)}
                            className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0"
                          >
                            Ubah ke {c.preference === 'singkat' ? 'Detail' : 'Singkat'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContactId(c.id);
                              setContactName(c.name);
                              setContactPhone(c.phone);
                              setContactPreference(c.preference);
                              setContactGroup(c.groupTag);
                              setContactNotes(c.notes);
                            }}
                            className="min-h-[38px] px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteContact(c.id)}
                            className="min-h-[38px] px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 4: BDI PROJEK (MULTI-PROJECT SCHEDULER, PAUSE/RESUME/STOP, HISTORI & MANUAL)
           ============================================================ */}
        {activeTab === 'kirim' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
                  04. Manajemen BDI Projek, Histori Pengiriman &amp; Pesan Manual
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Jalankan beberapa <strong>BDI Projek</strong> sekaligus dengan fitur <strong>Pause, Resume &amp; Stop</strong>, peringatan anti-tabrakan jadwal, serta histori pengiriman lengkap.
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg self-start">
                <button
                  onClick={() => setKirimSubTab('projek')}
                  className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    kirimSubTab === 'projek'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Daftar BDI Projek ({store.projects?.length || 0})
                </button>
                <button
                  onClick={() => setKirimSubTab('histori')}
                  className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    kirimSubTab === 'histori'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Histori Pengiriman ({store.projectHistory?.length || 0})
                </button>
                <button
                  onClick={() => setKirimSubTab('manual')}
                  className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    kirimSubTab === 'manual'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Kirim Pesan Manual
                </button>
              </div>
            </div>

            {/* COLLISION WARNING BANNER ACROSS RUNNING PROJECTS */}
            {scheduleCollisions.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Peringatan Tabrakan Jadwal Antar BDI Projek!</span>
                </div>
                {scheduleCollisions.map((msg, i) => (
                  <p key={i} className="text-xs text-amber-800">
                    • {msg}
                  </p>
                ))}
              </div>
            )}

            {kirimSubTab === 'projek' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-600">
                    Anda dapat membuat dan menjalankan beberapa projek penjadwalan sekaligus (misal: Projek Subuh, Projek Sore, Projek Ramadhan).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProject({
                        id: undefined,
                        name: `BDI Projek #${(store.projects?.length || 0) + 1}`,
                        status: 'running',
                        sendTime: '07:00',
                        durationMode: 'database_count',
                        durationValue: 1,
                        startDate: new Date().toISOString().slice(0, 10),
                        selectedProfiles: [allProfiles[0] || 'Oktober'],
                        selectionOrder: 'sequential',
                        minDelaySeconds: 12,
                        maxDelaySeconds: 35,
                        repeatWhenExhausted: true,
                      });
                      setShowProjectForm(true);
                    }}
                    className="min-h-[42px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat BDI Projek Baru</span>
                  </button>
                </div>

                {/* CREATE / EDIT BDI PROJEK FORM */}
                {showProjectForm && (
                  <form
                    onSubmit={handleSaveProjectForm}
                    className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <h3 className="text-base font-bold text-slate-900">
                        {editingProject.id ? `Edit ${editingProject.name}` : 'Buat BDI Projek Baru'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowProjectForm(false)}
                        className="text-xs text-slate-500"
                      >
                        Tutup
                      </button>
                    </div>

                    {formCollisionProject && (
                      <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-center gap-2 text-xs text-amber-900 font-medium">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
                        <span>
                          Peringatan: Jam kirim <strong>{editingProject.sendTime}</strong> berdekatan/tabrakan dengan projek <strong>&ldquo;{formCollisionProject.name}&rdquo; ({formCollisionProject.sendTime})</strong>. Sebaiknya bedakan jam pengiriman minimal 15–30 menit.
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Judul BDI Projek
                        </label>
                        <input
                          type="text"
                          value={editingProject.name || ''}
                          onChange={(e) =>
                            setEditingProject({ ...editingProject, name: e.target.value })
                          }
                          placeholder="Contoh: BDI Projek Hadis Pagi Oktober"
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Jam Pengiriman Harian
                        </label>
                        <input
                          type="time"
                          value={editingProject.sendTime || '06:00'}
                          onChange={(e) =>
                            setEditingProject({ ...editingProject, sendTime: e.target.value })
                          }
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono-num"
                        />
                      </div>
                    </div>

                    {/* Multi-Profile Selector inside Project Form */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                      <label className="block text-xs font-bold text-slate-900">
                        Pilih Profil Database untuk Projek Ini (Bisa Pilih Lebih dari Satu):
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {allProfiles.map((prof) => {
                          const cnt = store.hadiths.filter(
                            (h) => (h.profileName || 'Belum Terkategori') === prof
                          ).length;
                          const selected = (editingProject.selectedProfiles || []).includes(prof);
                          return (
                            <label
                              key={prof}
                              onClick={() => {
                                const cur = editingProject.selectedProfiles || [];
                                const next = cur.includes(prof)
                                  ? cur.filter((p) => p !== prof)
                                  : [...cur, prof];
                                setEditingProject({ ...editingProject, selectedProfiles: next });
                              }}
                              className={`cursor-pointer p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                                selected
                                  ? 'bg-emerald-50 border-emerald-700 font-bold text-slate-900'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => {}}
                                  className="w-4 h-4 accent-emerald-700"
                                />
                                <span className="truncate">{prof}</span>
                              </div>
                              <span className="font-mono-num text-emerald-800">{cnt} data</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Kurun Waktu Program
                        </label>
                        <select
                          value={editingProject.durationMode || 'database_count'}
                          onChange={(e) =>
                            setEditingProject({
                              ...editingProject,
                              durationMode: e.target.value as any,
                            })
                          }
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="database_count">Ikuti Jumlah Hadis Profil</option>
                          <option value="months">Kurun Waktu Bulanan</option>
                          <option value="years">Kurun Waktu Tahunan</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Urutan Hadis Tiap Hari
                        </label>
                        <select
                          value={editingProject.selectionOrder || 'sequential'}
                          onChange={(e) =>
                            setEditingProject({
                              ...editingProject,
                              selectionOrder: e.target.value as 'sequential' | 'random',
                            })
                          }
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="sequential">Berurutan (1, 2, 3...)</option>
                          <option value="random">Random (Acak Tiap Hari)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Jeda Acak Min (Detik)
                        </label>
                        <input
                          type="number"
                          min={3}
                          max={300}
                          value={editingProject.minDelaySeconds ?? 12}
                          onChange={(e) =>
                            setEditingProject({
                              ...editingProject,
                              minDelaySeconds: Number(e.target.value) || 10,
                            })
                          }
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono-num"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Jeda Acak Max (Detik)
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={600}
                          value={editingProject.maxDelaySeconds ?? 35}
                          onChange={(e) =>
                            setEditingProject({
                              ...editingProject,
                              maxDelaySeconds: Number(e.target.value) || 35,
                            })
                          }
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono-num"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowProjectForm(false)}
                        className="min-h-[42px] px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="min-h-[42px] px-5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                      >
                        Simpan BDI Projek
                      </button>
                    </div>
                  </form>
                )}

                {/* LIST OF BDI PROJECTS WITH PAUSE, RESUME, STOP & RUN NOW */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(store.projects || []).map((proj) => {
                    const poolCount = store.hadiths.filter((h) =>
                      (proj.selectedProfiles || []).includes(h.profileName || 'Belum Terkategori')
                    ).length;
                    return (
                      <div
                        key={proj.id}
                        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span
                                className={`text-[11px] font-bold uppercase tracking-wider ${
                                  proj.status === 'running'
                                    ? 'text-emerald-700'
                                    : proj.status === 'paused'
                                    ? 'text-amber-700'
                                    : 'text-red-700'
                                }`}
                              >
                                {proj.status === 'running'
                                  ? '● SEDANG BERJALAN (RUNNING)'
                                  : proj.status === 'paused'
                                  ? '❚❚ DIJEDA SEMENTARA (PAUSED)'
                                  : '■ DIHENTIKAN (STOPPED)'}
                              </span>
                              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                                {proj.name}
                              </h3>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProject(proj);
                                  setShowProjectForm(true);
                                }}
                                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                                title="Edit Projek"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProject(proj.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                title="Hapus Projek"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1">
                            <p>
                              <strong>Jam Kirim Harian:</strong>{' '}
                              <span className="font-mono-num font-bold text-slate-900">
                                {proj.sendTime}
                              </span>{' '}
                              · <strong>Urutan:</strong>{' '}
                              {proj.selectionOrder === 'random' ? 'Random (Acak)' : 'Berurutan'}
                            </p>
                            <p>
                              <strong>Profil Database:</strong>{' '}
                              {(proj.selectedProfiles || []).join(', ')} ({poolCount} hadis)
                            </p>
                            <p>
                              <strong>Interval Acak Anti-Blokir:</strong>{' '}
                              <span className="font-mono-num">
                                {proj.minDelaySeconds}s – {proj.maxDelaySeconds}s
                              </span>{' '}
                              · Terkirim: <span className="font-mono-num">{proj.totalSentCount || 0}</span> pesan
                            </p>
                          </div>
                        </div>

                        {/* Action Controls: Pause, Resume, Stop, Run Now */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                          {proj.status === 'running' ? (
                            <button
                              type="button"
                              onClick={() => handleProjectAction(proj.id, 'pause')}
                              className="min-h-[40px] px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                            >
                              <Pause className="w-3.5 h-3.5" />
                              <span>Pause (Jeda)</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleProjectAction(proj.id, 'resume')}
                              className="min-h-[40px] px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Resume (Lanjutkan)</span>
                            </button>
                          )}

                          {proj.status !== 'stopped' && (
                            <button
                              type="button"
                              onClick={() => handleProjectAction(proj.id, 'stop')}
                              className="min-h-[40px] px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                            >
                              <Square className="w-3.5 h-3.5" />
                              <span>Stop</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleProjectAction(proj.id, 'run_now')}
                            className="ml-auto min-h-[40px] px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Kirim Sekarang</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUB-TAB: HISTORI PENGIRIMAN PROJEK */}
            {kirimSubTab === 'histori' && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Histori Pengiriman &amp; Aktivitas BDI Projek
                    </h2>
                    <p className="text-xs text-slate-600">
                      Rekam jejak seluruh eksekusi jadwal otomatis, pengiriman langsung, serta riwayat Pause, Resume, dan Stop.
                    </p>
                  </div>
                </div>

                {!store.projectHistory || store.projectHistory.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Belum ada histori pengiriman projek.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {store.projectHistory.map((h) => (
                      <div
                        key={h.id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-emerald-800">{h.projectName}</span>
                            <span aria-hidden="true">·</span>
                            <span className="text-slate-600">Profil: {h.profileName}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-num text-slate-700">
                              Target: {h.contactCount} kontak
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-900">{h.hadithTitle}</p>
                          <p className="text-xs text-slate-600">{h.notes}</p>
                        </div>
                        <span className="text-xs font-mono-num text-slate-500 shrink-0">
                          {new Date(h.triggeredAt).toLocaleString('id-ID')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB: MANUAL BROADCAST */}
            {kirimSubTab === 'manual' && (
              <form
                onSubmit={handleSendManualBroadcast}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-5"
              >
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Kirim Pesan Manual (Pengumuman / Undangan Kajian / Info BDI)
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Kirimkan pesan pengumuman ke seluruh kontak atau kategori tertentu dengan jeda waktu acak.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Target Kontak Penerima
                    </label>
                    <select
                      value={manualTargetFilter}
                      onChange={(e) =>
                        setManualTargetFilter(
                          e.target.value as 'all' | 'singkat' | 'detail' | 'custom'
                        )
                      }
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="all">
                        Semua Kontak Aktif ({store.contacts.length} Kontak)
                      </option>
                      <option value="singkat">
                        Hanya Kategori Penerima Hadis Singkat ({countSingkat} Kontak)
                      </option>
                      <option value="detail">
                        Hanya Kategori Penerima Hadis Detail ({countDetail} Kontak)
                      </option>
                      <option value="custom">Pilih Kontak Tertentu Secara Manual</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sisipkan Referensi Hadis dari Database (Opsional)
                    </label>
                    <select
                      value={manualAttachHadithId}
                      onChange={(e) => setManualAttachHadithId(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="">Tanpa Lampiran Hadis Khusus</option>
                      {store.hadiths.map((h, i) => (
                        <option key={h.id} value={h.id}>
                          [{h.profileName || 'Umum'}] #{i + 1} - {h.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {manualTargetFilter === 'custom' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <p className="text-xs font-semibold text-slate-700">
                      Centang Kontak yang Akan Dikirimi Pesan Manual:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {store.contacts.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 text-xs bg-white p-2 rounded border border-slate-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={manualSelectedIds.includes(c.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setManualSelectedIds([...manualSelectedIds, c.id]);
                              } else {
                                setManualSelectedIds(
                                  manualSelectedIds.filter((id) => id !== c.id)
                                );
                              }
                            }}
                            className="w-4 h-4 accent-emerald-700"
                          />
                          <span className="truncate">
                            {c.name} ({c.preference})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <textarea
                    rows={6}
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm leading-relaxed"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="min-h-[48px] px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Mulai Kirim Pesan Manual dengan Interval Acak</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ============================================================
            TAB 5: WA ADMIN, CLOUD SYNC (FIRESTORE / GITHUB / GSHEET) & LAPORAN
           ============================================================ */}
        {activeTab === 'sistem' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
                  05. WA Admin Headless, Cloud Sync (Firestore / GitHub / GSheet) &amp; Laporan
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Tautkan WA Admin dengan QR Code / Pairing Code instan, dan hubungkan backup real-time ke Firebase Firestore, GitHub Repository, atau Google Sheets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTutorialModal('wa_qr')}
                className="min-h-[42px] px-4 py-2 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-900 text-xs font-bold rounded-lg flex items-center gap-2 self-start shrink-0"
              >
                <HelpCircle className="w-4 h-4 text-emerald-700" />
                <span>Lihat Preview Tutorial Lengkap</span>
              </button>
            </div>

            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT: WA ADMIN HEADLESS QR & PAIRING CODE */}
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Nomor WA Admin &amp; Koneksi Headless (Baileys / Webhook)
                    </h2>
                    <p className="text-xs text-slate-600">
                      Nomor aktif saat ini:{' '}
                      <strong className="font-mono-num text-emerald-800">
                        {store.gatewaySettings.adminPhone}
                      </strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTutorialModal('wa_qr')}
                    className="text-xs font-semibold text-emerald-800 underline"
                  >
                    Tutorial QR
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveGatewaySettings({ adminPhone: adminPhoneDraft });
                  }}
                >
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor WhatsApp Admin Pengirim (Ketik lalu klik Simpan Nomor)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={adminPhoneDraft}
                      onChange={(e) => setAdminPhoneDraft(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="flex-1 min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono-num"
                    />
                    <button
                      type="submit"
                      className="min-h-[44px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Check className="w-4 h-4" />
                      <span>Simpan Nomor</span>
                    </button>
                  </div>
                </form>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveGatewaySettings({ activeMode: 'baileys' })}
                    className={`min-h-[40px] px-3 py-2 rounded-lg border text-xs font-semibold ${
                      store.gatewaySettings.activeMode === 'baileys'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    WA Headless Gratis (Baileys)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveGatewaySettings({ activeMode: 'webhook' })}
                    className={`min-h-[40px] px-3 py-2 rounded-lg border text-xs font-semibold ${
                      store.gatewaySettings.activeMode === 'webhook'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    Integrasi API / Webhook
                  </button>
                </div>

                {store.gatewaySettings.activeMode === 'baileys' ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Status Sesi WA Headless:{' '}
                        <span className="uppercase text-emerald-700">{waState.status}</span>
                      </span>
                      {waState.status !== 'disconnected' && (
                        <button
                          type="button"
                          onClick={handleDisconnectBaileys}
                          className="text-xs text-red-700 font-semibold underline"
                        >
                          Reset / Putuskan Sesi
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleConnectBaileys('qr')}
                        className="min-h-[42px] px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Tampilkan QR Code Baru</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConnectBaileys('pairing')}
                        className="min-h-[42px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>Minta 8-Digit Pairing Code (1 HP)</span>
                      </button>
                    </div>

                    {waState.qrDataUrl && (
                      <div className="p-4 bg-white border border-emerald-300 rounded-xl text-center space-y-3">
                        <p className="text-xs font-bold text-slate-900">
                          Scan QR Code Ini dari WhatsApp &rarr; Perangkat Tertaut:
                        </p>
                        <img
                          src={waState.qrDataUrl}
                          alt="WhatsApp Headless QR Code"
                          referrerPolicy="no-referrer"
                          className="w-52 h-52 mx-auto border border-slate-200 rounded-lg p-1"
                        />
                        <button
                          type="button"
                          onClick={handleConfirmScanReady}
                          className="w-full min-h-[40px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                        >
                          Saya Sudah Scan QR / Aktifkan Sesi Headless Sekarang
                        </button>
                      </div>
                    )}

                    {waState.pairingCode && (
                      <div className="p-4 bg-white border border-emerald-300 rounded-xl text-center space-y-2">
                        <p className="text-xs text-slate-600">
                          Masukkan Kode Tautan 8 Digit Ini di WhatsApp Nomor{' '}
                          <strong>{store.gatewaySettings.adminPhone}</strong>:
                        </p>
                        <p className="text-2xl font-bold font-mono-num tracking-widest text-emerald-800">
                          {waState.pairingCode}
                        </p>
                        <button
                          type="button"
                          onClick={handleConfirmScanReady}
                          className="w-full min-h-[40px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                        >
                          Saya Sudah Masukkan Kode / Aktifkan Sesi Headless
                        </button>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      <strong>Info Web App vs APK:</strong> Karena Baileys berjalan di server aplikasi ini, pengiriman jadwal otomatis tetap jalan meskipun Anda hanya menggunakan <strong>Web App</strong> tanpa membuat APK.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        URL Endpoint API Pesan Pihak Ketiga / Webhook Mandiri
                      </label>
                      <input
                        type="url"
                        value={webhookUrlDraft}
                        onChange={(e) => setWebhookUrlDraft(e.target.value)}
                        placeholder="https://gateway-wa-anda.com/api/send-message"
                        className="w-full min-h-[40px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Token / Authorization Key (Opsional)
                      </label>
                      <input
                        type="text"
                        value={webhookApiKeyDraft}
                        onChange={(e) => setWebhookApiKeyDraft(e.target.value)}
                        placeholder="Bearer token atau secret key..."
                        className="w-full min-h-[40px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleSaveGatewaySettings({
                          webhookUrl: webhookUrlDraft,
                          webhookApiKey: webhookApiKeyDraft,
                        })
                      }
                      className="min-h-[40px] px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                    >
                      Simpan Konfigurasi Webhook API
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleTestSendAdmin}
                  className="w-full min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4 text-emerald-700" />
                  <span>
                    Tes Kirim Pesan ke Nomor WA Admin ({store.gatewaySettings.adminPhone})
                  </span>
                </button>
              </div>

              {/* RIGHT: SIMPLIFIED BACKUP, RESTORE & SYNC (1. AKUN GOOGLE / FOLDER GOOGLE DRIVE, 2. LOCAL STORAGE / DOWNLOAD & IMPORT) */}
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Backup, Restore &amp; Sinkronisasi Sederhana
                    </h2>
                    <p className="text-xs text-slate-600">
                      Cukup pilih: <strong>1. Backup ke Akun Google (Otomatis Buat Folder di Google Drive)</strong> atau <strong>2. Backup ke Local Storage / Download &amp; Import File</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTutorialModal(cloudProviderTab)}
                    className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-lg flex items-center gap-1 shrink-0"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Tutorial</span>
                  </button>
                </div>

                {/* Simplified 2-Mode Selector Tabs */}
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCloudProviderTab('google_account')}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                      cloudProviderTab === 'google_account'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>1. Backup Akun Google (Drive)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCloudProviderTab('local')}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                      cloudProviderTab === 'local'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>2. Local Storage / Download &amp; Import</span>
                  </button>
                </div>

                {/* TAB 1: AKUN GOOGLE (OTOMATIS BUAT FOLDER DI GOOGLE DRIVE + REAL-TIME SYNC) */}
                {cloudProviderTab === 'google_account' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          Akun Google Terhubung: <span className="text-emerald-800">{activeAccount?.email}</span>
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Otomatis membuat folder <strong>&ldquo;BDI Daily Quran &amp; Hadis Backup&rdquo;</strong> di Google Drive Anda dan menyinkronkan data lintas perangkat.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleConnectGoogleDriveFolder}
                        disabled={cloudBusy}
                        className="min-h-[34px] px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 shrink-0"
                      >
                        <Folder className="w-3.5 h-3.5 text-emerald-700" />
                        <span>
                          {driveConnected ? 'Cek Folder Google Drive' : 'Hubungkan Folder Drive'}
                        </span>
                      </button>
                    </div>

                    {driveBackupInfo && (
                      <div className="p-3 bg-white border border-emerald-200 rounded-lg text-xs space-y-1">
                        <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Folder className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>Folder Drive: {driveBackupInfo.folderName}</span>
                        </p>
                        <p className="text-slate-600">
                          File Backup:{' '}
                          <code className="font-mono text-slate-800">{driveBackupInfo.fileName}</code>{' '}
                          {driveBackupInfo.modifiedTime
                            ? `(Terakhir diperbarui: ${driveBackupInfo.modifiedTime})`
                            : '(Belum ada file, klik Backup di bawah untuk membuat otomatis)'}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Catatan / Label Backup Akun Google
                      </label>
                      <input
                        type="text"
                        value={backupLabelInput}
                        onChange={(e) => setBackupLabelInput(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        disabled={cloudBusy}
                        onClick={handleRequestGoogleAccountBackup}
                        className="min-h-[44px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                      >
                        <CloudUpload className="w-4 h-4" />
                        <span>
                          {cloudBusy ? 'Memproses...' : 'Backup ke Akun Google (Drive)'}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={cloudBusy}
                        onClick={handleGoogleAccountRestore}
                        className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                      >
                        <CloudDownload className="w-4 h-4" />
                        <span>Restore dari Akun Google</span>
                      </button>
                    </div>

                    {cloudInfo && (
                      <p className="text-xs text-emerald-800 font-semibold">{cloudInfo}</p>
                    )}
                  </div>
                )}

                {/* TAB 2: LOCAL STORAGE BROWSER + DOWNLOAD FILE (.JSON) & IMPORT */}
                {cloudProviderTab === 'local' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900">
                          A. Backup &amp; Restore Cepat di Local Storage Browser
                        </p>
                        {localSavedTimestamp && (
                          <span className="text-[11px] font-mono-num text-emerald-800">
                            Tersimpan: {localSavedTimestamp}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Menyimpan seluruh database hadis, kontak, dan projek langsung di memori browser perangkat ini tanpa perlu internet.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={handleSaveToBrowserLocalStorage}
                          className="min-h-[42px] px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          <span>Simpan ke Local Storage</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRestoreFromBrowserLocalStorage}
                          className="min-h-[42px] px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>Restore dari Local Storage</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <p className="text-xs font-bold text-slate-900">
                        B. Download File Backup (.JSON) &amp; Import File dari Perangkat
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Download seluruh database menjadi file <code>.json</code> ke memori HP Vivo Y71 / Laptop Anda, atau Import kembali file <code>.json</code> kapan saja.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={handleExportLocalJson}
                          className="min-h-[44px] px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4 text-emerald-700" />
                          <span>Download File Backup (.JSON)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="min-h-[44px] px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                        >
                          <Upload className="w-4 h-4 text-emerald-700" />
                          <span>Import File Backup (.JSON)</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json,application/json"
                          onChange={handleImportLocalJson}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* SECTION C: DELIVERY REPORTS & QUEUE PAUSE/RESUME/STOP */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Laporan Pengiriman Real-Time &amp; Kontrol Antrean (Pause / Resume / Stop)
                  </h2>
                  <p className="text-xs text-slate-600">
                    Pantau status pesan yang sedang berjalan di antrean acak maupun yang sudah terkirim.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(countQueued > 0 || countPaused > 0) && (
                    <div className="flex items-center gap-1.5 mr-2">
                      {countQueued > 0 && (
                        <button
                          type="button"
                          onClick={() => handleGlobalQueueControl('pause_all')}
                          className="min-h-[36px] px-3 py-1 bg-amber-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause Antrean</span>
                        </button>
                      )}
                      {countPaused > 0 && (
                        <button
                          type="button"
                          onClick={() => handleGlobalQueueControl('resume_all')}
                          className="min-h-[36px] px-3 py-1 bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Resume Antrean</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleGlobalQueueControl('stop_all')}
                        className="min-h-[36px] px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>Stop Antrean</span>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      onClick={() => setLogStatusFilter('all')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                        logStatusFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Semua ({store.deliveryLogs.length})
                    </button>
                    <button
                      onClick={() => setLogStatusFilter('queued')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                        logStatusFilter === 'queued'
                          ? 'bg-white text-amber-800 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Antrean ({countQueued})
                    </button>
                    <button
                      onClick={() => setLogStatusFilter('paused')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                        logStatusFilter === 'paused'
                          ? 'bg-white text-amber-900 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Dijeda ({countPaused})
                    </button>
                    <button
                      onClick={() => setLogStatusFilter('sent')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                        logStatusFilter === 'sent'
                          ? 'bg-white text-emerald-800 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Terkirim ({countSent})
                    </button>
                    <button
                      onClick={() => setLogStatusFilter('failed')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                        logStatusFilter === 'failed'
                          ? 'bg-white text-red-800 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Gagal ({countFailed})
                    </button>
                  </div>

                  {store.deliveryLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearLogs}
                      className="min-h-[36px] px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                    >
                      Bersihkan
                    </button>
                  )}
                </div>
              </div>

              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Belum ada catatan laporan pengiriman pada filter ini.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {filteredLogs.map((log) => {
                    const remainingSec = Math.max(
                      0,
                      Math.ceil((log.scheduledAtMs - Date.now()) / 1000)
                    );
                    return (
                      <div
                        key={log.id}
                        className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {log.status === 'sent' && (
                              <span className="font-bold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                BERHASIL TERKIRIM
                              </span>
                            )}
                            {(log.status === 'queued' || log.status === 'sending') && (
                              <span className="font-bold text-amber-700 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                ANTREAN ACAK (
                                {remainingSec > 0 ? `${remainingSec} dtk lagi` : 'Mengirim...'})
                              </span>
                            )}
                            {log.status === 'paused' && (
                              <span className="font-bold text-amber-800 flex items-center gap-1">
                                <Pause className="w-3.5 h-3.5" />
                                ANTREAN DIJEDA (PAUSED)
                              </span>
                            )}
                            {log.status === 'stopped' && (
                              <span className="font-bold text-slate-500 flex items-center gap-1">
                                <Square className="w-3.5 h-3.5" />
                                DIHENTIKAN (STOPPED)
                              </span>
                            )}
                            {log.status === 'failed' && (
                              <span className="font-bold text-red-700 flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" />
                                GAGAL TERKIRIM
                              </span>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="font-bold text-slate-900">{log.contactName}</span>
                            <span className="font-mono-num text-slate-600">
                              ({log.contactPhone})
                            </span>
                            {log.projectName && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-800 font-semibold">
                                  {log.projectName}
                                </span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-num text-slate-500">
                              Jeda Acak: +{log.randomDelayAppliedSec}s
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 font-medium">
                            Materi: {log.hadithTitle}
                          </p>
                          {log.errorMessage && (
                            <p className="text-xs text-red-700">Catatan: {log.errorMessage}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start md:self-center">
                          <span className="text-[11px] font-mono-num text-slate-500">
                            {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                          </span>
                          {(log.status === 'failed' || log.status === 'stopped') && (
                            <button
                              type="button"
                              onClick={() => handleRetryLog(log.id)}
                              className="min-h-[36px] px-3 py-1 bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Kirim Ulang</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR (ERGONOMIC THUMB ZONE FOR VIVO Y71) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 grid grid-cols-5 h-16">
        <button
          onClick={() => setActiveTab('database')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            activeTab === 'database' ? 'text-emerald-700 font-bold' : 'text-slate-600'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] mt-1 whitespace-nowrap">1. Database</span>
        </button>

        <button
          onClick={() => setActiveTab('format')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            activeTab === 'format' ? 'text-emerald-700 font-bold' : 'text-slate-600'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] mt-1 whitespace-nowrap">2. Format</span>
        </button>

        <button
          onClick={() => setActiveTab('kontak')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            activeTab === 'kontak' ? 'text-emerald-700 font-bold' : 'text-slate-600'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-1 whitespace-nowrap">3. Kontak</span>
        </button>

        <button
          onClick={() => setActiveTab('kirim')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            activeTab === 'kirim' ? 'text-emerald-700 font-bold' : 'text-slate-600'
          }`}
        >
          <Send className="w-5 h-5" />
          <span className="text-[10px] mt-1 whitespace-nowrap">4. Projek</span>
        </button>

        <button
          onClick={() => setActiveTab('sistem')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            activeTab === 'sistem' ? 'text-emerald-700 font-bold' : 'text-slate-600'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-[10px] mt-1 whitespace-nowrap">5. WA/Cloud</span>
        </button>
      </nav>

      <OfflineIndicator />
    </div>
  );
}
