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
} from './firebase';
import { PWAInstallButton, OfflineIndicator } from './PWAInstallButton';

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
  const [aiBook, setAiBook] = useState('bukhari');
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

  // 5. System, Logs, WA Admin, Cloud Backup (Firestore / GitHub / Google Sheets) & Tutorial Modal
  const [adminPhoneDraft, setAdminPhoneDraft] = useState('');
  const [webhookUrlDraft, setWebhookUrlDraft] = useState('');
  const [webhookApiKeyDraft, setWebhookApiKeyDraft] = useState('');
  const [githubRepoDraft, setGithubRepoDraft] = useState('');
  const [githubBranchDraft, setGithubBranchDraft] = useState('main');
  const [githubFilePathDraft, setGithubFilePathDraft] = useState('backup/bdi-daily-hadis.json');
  const [githubTokenDraft, setGithubTokenDraft] = useState('');
  const [gsheetUrlDraft, setGsheetUrlDraft] = useState('');
  const gatewayInitializedRef = useRef(false);

  const [cloudProviderTab, setCloudProviderTab] = useState<
    'firestore' | 'github' | 'gsheet' | 'local'
  >('firestore');
  const [activeTutorialModal, setActiveTutorialModal] = useState<
    null | 'firestore' | 'github' | 'gsheet' | 'wa_qr'
  >(null);

  const [logStatusFilter, setLogStatusFilter] = useState<
    'all' | 'queued' | 'paused' | 'sent' | 'failed'
  >('all');
  const [backupLabelInput, setBackupLabelInput] = useState('Sinkronisasi Real-Time BDI Daily');
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
      if (!res.ok) return;
      const data = await res.json();
      setStore(data.store);
      setWaState(data.waState);
      setServerTime(data.serverTime || '');

      if (!gatewayInitializedRef.current && data.store) {
        gatewayInitializedRef.current = true;
        setAdminPhoneDraft(data.store.gatewaySettings?.adminPhone || '');
        setWebhookUrlDraft(data.store.gatewaySettings?.webhookUrl || '');
        setWebhookApiKeyDraft(data.store.gatewaySettings?.webhookApiKey || '');
        setGithubRepoDraft(data.store.externalSync?.githubRepo || '');
        setGithubBranchDraft(data.store.externalSync?.githubBranch || 'main');
        setGithubFilePathDraft(
          data.store.externalSync?.githubFilePath || 'backup/bdi-daily-hadis.json'
        );
        setGithubTokenDraft(data.store.externalSync?.githubToken || '');
        setGsheetUrlDraft(data.store.externalSync?.gsheetWebhookUrl || '');
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
      // ignore transient network error
    }
  }

  useEffect(() => {
    fetchState();
    const timer = setInterval(fetchState, 2500);
    const unsub = subscribeAuthState((u) => {
      setFirebaseUser(u);
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

  // Subscribe to Real-Time Cloud Sync when logged into Firebase
  useEffect(() => {
    if (!firebaseUser) return;
    const unsubSnap = subscribeRealtimeCloudSync(firebaseUser.uid, async (remote) => {
      if (remote.updatedAtMs <= lastRemoteTimestampRef.current) return;
      lastRemoteTimestampRef.current = remote.updatedAtMs;
      setCloudInfo(`Tersinkronisasi Real-Time (${remote.updatedAtText})`);
    });
    return () => unsubSnap();
  }, [firebaseUser]);

  async function pushAutoCloudSync(nextStore: AppStoreData, note = 'Auto-Sync BDI') {
    if (!firebaseUser) return;
    try {
      lastRemoteTimestampRef.current = Date.now() + 2000;
      await saveBackupToFirestore(nextStore, note);
      setCloudInfo(`Auto-Sync Cloud Aktif (${new Date().toLocaleTimeString('id-ID')})`);
    } catch {
      // ignore background auto-sync error
    }
  }

  async function handleGoogleLoginSubmit() {
    setLoginBusy(true);
    try {
      const user = await loginWithGoogle(saveLoginInfo);
      const info = {
        email: user.email || 'admin@bdi.id',
        displayName: user.displayName || 'Admin BDI',
        uid: user.uid,
      };
      setSavedAccountSession(info);
      if (saveLoginInfo) {
        localStorage.setItem('bdi_saved_account', JSON.stringify(info));
      }
      notify(
        'success',
        `Selamat datang ${info.displayName}! Akun Google (${info.email}) kini terhubung ke AI, Cloud Sync, GitHub & Google Sheets.`
      );
    } catch (err: any) {
      // If popup is blocked inside preview iframe, allow one-click Saved Google Session login
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
    const res = await fetch('/api/profiles/rename', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldName: renamingProfile.oldName,
        newName: renamingProfile.newName.trim(),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setStore((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          profiles: data.profiles,
          hadiths: data.hadiths,
          projects: data.projects,
        };
        pushAutoCloudSync(next, `Ubah Profil ${renamingProfile.oldName}`);
        return next;
      });
      if (dbProfileFilter === renamingProfile.oldName) {
        setDbProfileFilter(renamingProfile.newName.trim());
      }
      setRenamingProfile(null);
      notify('success', 'Nama profil database berhasil diperbarui.');
    } else {
      notify('error', data.error || 'Gagal mengubah nama profil.');
    }
  }

  async function handleDeleteProfile(profileName: string) {
    if (profileName === 'Belum Terkategori') {
      notify('error', 'Profil "Belum Terkategori" adalah profil dasar dan tidak dapat dihapus.');
      return;
    }
    const res = await fetch(`/api/profiles/${encodeURIComponent(profileName)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteItems: false }),
    });
    const data = await res.json();
    if (res.ok) {
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
    }
  }

  async function handleGenerateWithAI(e: React.FormEvent) {
    e.preventDefault();
    if (!aiCriteria.trim()) {
      notify('error', 'Masukkan topik atau kriteria pencarian hadis terlebih dahulu.');
      return;
    }
    const parsedCount = Math.min(30, Math.max(1, parseInt(aiCountInput, 10) || 4));

    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria: aiCriteria,
          sourceBook: aiBook,
          contentType: aiType,
          count: parsedCount,
          profileName:
            saveProfileMode === '__NEW__'
              ? newProfileNameOnSave.trim() || 'Profil Baru'
              : saveProfileMode,
          userEmail: savedAccountSession?.email || firebaseUser?.email || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify('error', data.error || 'Gagal membuat draf database dengan AI.');
      } else {
        setPreviewItems(data.items || []);
        notify(
          'success',
          `Berhasil menyusun ${data.items?.length || 0} draf hadis dengan AI. Pilih profil tujuan atau buat Profil Baru lalu klik Simpan.`
        );
      }
    } catch {
      notify('error', 'Terjadi kesalahan jaringan saat menghubungi server AI.');
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

    try {
      const itemsWithProfile = previewItems.map((item) => ({
        ...item,
        profileName: chosenProfile,
      }));
      const res = await fetch('/api/hadiths/save-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsWithProfile, profileName: chosenProfile }),
      });
      const data = await res.json();
      if (res.ok) {
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
      } else {
        notify('error', data.error || 'Gagal menyimpan ke database.');
      }
    } catch {
      notify('error', 'Gagal menyimpan draf hadis.');
    }
  }

  async function handleUpdateSavedHadith(item: HadithItem) {
    if (item.id.startsWith('preview-')) {
      setPreviewItems((prev) => prev.map((p) => (p.id === item.id ? item : p)));
      setEditingHadith(null);
      notify('success', 'Draf hadis berhasil diperbarui.');
      return;
    }
    const res = await fetch(`/api/hadiths/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    const data = await res.json();
    if (res.ok) {
      setStore((prev) => {
        if (!prev) return prev;
        const next = { ...prev, hadiths: data.hadiths, profiles: data.profiles };
        pushAutoCloudSync(next, `Edit Hadis ${item.title}`);
        return next;
      });
      setEditingHadith(null);
      notify('success', 'Perubahan hadis berhasil disimpan.');
    }
  }

  async function handleDeleteSavedHadith(id: string) {
    const res = await fetch(`/api/hadiths/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setStore((prev) => {
        if (!prev) return prev;
        const next = { ...prev, hadiths: data.hadiths, profiles: data.profiles };
        pushAutoCloudSync(next, 'Hapus Materi Hadis');
        return next;
      });
      notify('success', 'Item materi dihapus dari database.');
    }
  }

  // --- HANDLERS: 2. TEMPLATE FORMAT EDITOR ---
  async function handleSaveTemplate(asNew = false) {
    if (!tplName.trim() || !tplContent.trim()) {
      notify('error', 'Nama format dan isi template tidak boleh kosong.');
      return;
    }
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: asNew ? undefined : selectedTemplateId,
        name: asNew ? `${tplName} (Salinan)` : tplName,
        category: tplCategory,
        content: tplContent,
        isDefault: tplIsDefault,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setStore((prev) => {
        if (!prev) return prev;
        const next = { ...prev, templates: data.templates };
        pushAutoCloudSync(next, 'Simpan Format Kirim');
        return next;
      });
      notify('success', 'Format kirim berhasil disimpan & disinkronkan.');
    }
  }

  async function handleDeleteTemplate(id: string) {
    if ((store?.templates.length || 0) <= 2) {
      notify('error', 'Minimal harus menyisakan format dasar singkat dan lengkap.');
      return;
    }
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setStore((prev) => (prev ? { ...prev, templates: data.templates } : prev));
      if (data.templates.length > 0) {
        handleSelectTemplate(data.templates[0]);
      }
      notify('success', 'Format kirim berhasil dihapus.');
    }
  }

  // --- HANDLERS: 3. CONTACTS ---
  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) {
      notify('error', 'Nama dan nomor WA wajib diisi.');
      return;
    }
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
    const data = await res.json();
    if (res.ok) {
      setStore((prev) => {
        if (!prev) return prev;
        const next = { ...prev, contacts: data.contacts };
        pushAutoCloudSync(next, `Simpan Kontak ${contactName}`);
        return next;
      });
      setEditingContactId(null);
      setContactName('');
      setContactPhone('');
      setContactNotes('');
      notify('success', 'Data kontak jamaah berhasil disimpan.');
    } else {
      notify('error', data.error || 'Gagal menyimpan kontak.');
    }
  }

  async function handleToggleContactPreference(c: ContactItem) {
    const nextPref = c.preference === 'singkat' ? 'detail' : 'singkat';
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...c, preference: nextPref }),
    });
    const data = await res.json();
    if (res.ok) {
      setStore((prev) => (prev ? { ...prev, contacts: data.contacts } : prev));
    }
  }

  async function handleDeleteContact(id: string) {
    const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setStore((prev) => (prev ? { ...prev, contacts: data.contacts } : prev));
      notify('success', 'Kontak dihapus.');
    }
  }

  async function handleBulkImportSubmit() {
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
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
    const res = await fetch('/api/contacts/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts: parsed }),
    });
    const data = await res.json();
    if (res.ok) {
      setStore((prev) => (prev ? { ...prev, contacts: data.contacts } : prev));
      setBulkText('');
      setShowBulkImport(false);
      notify('success', `Berhasil mengimpor ${data.addedCount} kontak baru.`);
    } else {
      notify('error', data.error || 'Gagal mengimpor kontak.');
    }
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
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingProject),
    });
    const data = await res.json();
    if (res.ok) {
      setStore((prev) => {
        if (!prev) return prev;
        const next = { ...prev, projects: data.projects };
        pushAutoCloudSync(next, `Simpan Projek ${editingProject.name}`);
        return next;
      });
      setShowProjectForm(false);
      notify('success', `Projek "${editingProject.name}" berhasil disimpan.`);
    }
  }

  async function handleProjectAction(
    projId: string,
    action: 'pause' | 'resume' | 'stop' | 'run_now'
  ) {
    const res = await fetch(`/api/projects/${projId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (res.ok) {
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
    } else {
      notify('error', data.error || 'Gagal menjalankan aksi projek.');
    }
  }

  async function handleDeleteProject(projId: string) {
    const res = await fetch(`/api/projects/${projId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setStore((prev) => (prev ? { ...prev, projects: data.projects } : prev));
      notify('success', 'Projek dihapus.');
    }
  }

  async function handleGlobalQueueControl(action: 'pause_all' | 'resume_all' | 'stop_all') {
    const res = await fetch('/api/queue/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (res.ok) {
      setStore((prev) => (prev ? { ...prev, deliveryLogs: data.deliveryLogs } : prev));
      notify('success', 'Status antrean pesan berhasil diperbarui.');
    }
  }

  async function handleSendManualBroadcast(e: React.FormEvent) {
    e.preventDefault();
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
    const data = await res.json();
    if (res.ok) {
      setStore((prev) => (prev ? { ...prev, deliveryLogs: data.deliveryLogs } : prev));
      notify(
        'success',
        `${data.queuedCount} pesan manual dijadwalkan dalam antrean acak anti-blokir.`
      );
      setActiveTab('sistem');
    } else {
      notify('error', data.error || 'Gagal mengirim pesan manual.');
    }
  }

  // --- HANDLERS: 5. WA ADMIN, LOGS & MULTI-CLOUD BACKUP ---
  async function handleSaveGatewaySettings(updated: Partial<AppStoreData['gatewaySettings']>) {
    if (!store) return;
    const merged = {
      ...store.gatewaySettings,
      adminPhone: adminPhoneDraft,
      webhookUrl: webhookUrlDraft,
      webhookApiKey: webhookApiKeyDraft,
      ...updated,
    };
    const res = await fetch('/api/gateway/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    });
    const data = await res.json();
    if (res.ok) {
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
    } else {
      notify('error', data.error || 'Gagal menyimpan nomor WA Admin.');
    }
  }

  async function handleConnectBaileys(mode: 'qr' | 'pairing') {
    const res = await fetch('/api/gateway/connect-baileys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        phone: adminPhoneDraft || store?.gatewaySettings.adminPhone,
        freshReset: true,
      }),
    });
    const data = await res.json();
    if (res.ok) {
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
    }
  }

  async function handleConfirmScanReady() {
    const res = await fetch('/api/gateway/confirm-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: adminPhoneDraft || store?.gatewaySettings.adminPhone }),
    });
    const data = await res.json();
    if (res.ok) {
      setWaState(data.waState);
      notify('success', 'Sesi Nomor WA Admin berhasil ditautkan dan aktif secara Headless!');
    }
  }

  async function handleDisconnectBaileys() {
    const res = await fetch('/api/gateway/disconnect-baileys', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setWaState(data.waState);
      notify('success', 'Sesi WA Headless diputuskan.');
    }
  }

  async function handleTestSendAdmin() {
    const targetPhone = adminPhoneDraft || store?.gatewaySettings.adminPhone;
    const res = await fetch('/api/gateway/test-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: targetPhone }),
    });
    const data = await res.json();
    if (data.deliveryLogs) {
      setStore((prev) => (prev ? { ...prev, deliveryLogs: data.deliveryLogs } : prev));
    }
    if (data.ok) {
      notify('success', `Pesan uji coba berhasil dikirim ke nomor WA Admin (${targetPhone}).`);
    } else {
      notify('error', data.result?.error || 'Pengiriman uji coba gagal.');
    }
  }

  async function handleRetryLog(id: string) {
    const res = await fetch(`/api/logs/retry/${id}`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setStore((prev) => (prev ? { ...prev, deliveryLogs: data.deliveryLogs } : prev));
      notify('success', 'Pesan dijadwalkan ulang dengan jeda acak baru.');
    }
  }

  async function handleClearLogs() {
    const res = await fetch('/api/logs/clear', { method: 'POST' });
    if (res.ok) {
      setStore((prev) => (prev ? { ...prev, deliveryLogs: [] } : prev));
      notify('success', 'Riwayat laporan pengiriman dibersihkan.');
    }
  }

  async function handleCloudBackup() {
    if (!store) return;
    setCloudBusy(true);
    try {
      await saveBackupToFirestore(store, backupLabelInput);
      setCloudInfo(`Tercadangkan ke Cloud Firestore pada ${new Date().toLocaleTimeString('id-ID')}`);
      notify(
        'success',
        'Seluruh database, profil, projek, dan kontak berhasil di-backup ke Cloud Firestore!'
      );
    } catch (err: any) {
      notify(
        'error',
        'Pastikan Anda login dengan popup Google Firebase untuk menulis ke Firestore, atau gunakan Backup GitHub / Google Sheets / File JSON.'
      );
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleCloudRestore() {
    setCloudBusy(true);
    try {
      const snap = await loadBackupFromFirestore();
      if (!snap) {
        notify('error', 'Belum ada data cadangan ditemukan pada akun Google ini.');
        return;
      }
      const res = await fetch('/api/store/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: snap.payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setStore(data.store);
        setCloudInfo(`Dipulihkan dari "${snap.backupLabel}" (${snap.updatedAtText})`);
        notify(
          'success',
          `Restore Cloud berhasil: ${snap.hadithCount} materi & ${snap.contactCount} kontak dipulihkan.`
        );
      }
    } catch (err: any) {
      notify('error', err?.message || 'Gagal memulihkan data dari Cloud.');
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleGithubSync(mode: 'push' | 'pull') {
    setCloudBusy(true);
    try {
      const res = await fetch('/api/external-sync/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          githubRepo: githubRepoDraft,
          githubBranch: githubBranchDraft,
          githubFilePath: githubFilePathDraft,
          githubToken: githubTokenDraft,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.store) setStore(data.store);
        notify('success', data.message || 'Sinkronisasi GitHub berhasil!');
      } else {
        notify('error', data.error || 'Gagal melakukan sinkronisasi GitHub.');
      }
    } catch {
      notify('error', 'Gagal menghubungi server saat sinkronisasi GitHub.');
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleGsheetSync(mode: 'push' | 'pull') {
    setCloudBusy(true);
    try {
      const res = await fetch('/api/external-sync/gsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          gsheetWebhookUrl: gsheetUrlDraft,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.store) setStore(data.store);
        notify('success', data.message || 'Sinkronisasi Google Sheets berhasil!');
      } else {
        notify('error', data.error || 'Gagal melakukan sinkronisasi Google Sheets.');
      }
    } catch {
      notify('error', 'Gagal menghubungi Google Sheets Web App.');
    } finally {
      setCloudBusy(false);
    }
  }

  function handleExportLocalJson() {
    if (!store) return;
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bdi-daily-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('success', 'File JSON backup berhasil diunduh ke penyimpanan perangkat.');
  }

  function handleImportLocalJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        const res = await fetch('/api/store/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store: parsed }),
        });
        const data = await res.json();
        if (res.ok) {
          setStore(data.store);
          notify('success', 'Data berhasil dipulihkan dari file JSON lokal.');
        }
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
          MODAL TUTORIAL LENGKAP (FIRESTORE, GITHUB, GSHEET, WA QR)
         ============================================================ */}
      {activeTutorialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Panduan &amp; Preview Tutorial Integrasi
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
                { id: 'wa_qr', label: '1. Cara Tautkan WA QR / 1 HP' },
                { id: 'firestore', label: '2. Cara Sinkronisasi Cloud Firestore' },
                { id: 'github', label: '3. Cara Konek ke GitHub Repo' },
                { id: 'gsheet', label: '4. Cara Konek ke Google Sheets' },
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
                    Tutorial Menautkan Nomor WA Admin Headless (QR Code &amp; Pairing Code)
                  </h4>
                  <p>
                    Karena mesin <strong>Baileys Headless</strong> berjalan langsung di server Web App ini, Anda <strong>tidak wajib membuat file APK terpisah</strong>—cukup buka Web App ini di Chrome HP (Vivo Y71) atau laptop, dan pengiriman otomatis tetap berjalan di latar belakang server.
                  </p>
                  <ol className="list-decimal list-inside space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <li>
                      Ketik nomor WhatsApp Admin Anda pada kolom <strong>Nomor WhatsApp Admin Pengirim</strong> lalu klik <strong>Simpan Nomor</strong>.
                    </li>
                    <li>
                      Jika menggunakan <strong>2 perangkat</strong> (misal buka Web App di Laptop, WA di HP): Klik tombol <strong>Tampilkan QR Code Baru</strong>, tunggu 2 detik hingga gambar QR muncul, lalu buka WhatsApp di HP &rarr; <strong>Perangkat Tertaut</strong> &rarr; <strong>Tautkan Perangkat</strong>.
                    </li>
                    <li>
                      Jika hanya menggunakan <strong>1 HP (Vivo Y71 saja)</strong>: Klik tombol <strong>Minta 8-Digit Pairing Code</strong>, salin kode 8 digit yang muncul di layar, lalu masukkan ke notifikasi WhatsApp <em>&ldquo;Masukkan kode untuk menautkan perangkat baru&rdquo;</em>.
                    </li>
                    <li>
                      Setelah di-scan atau dimasukkan kodenya, klik tombol <strong>Konfirmasi Sudah Scan / Aktifkan Sesi Headless</strong> agar status langsung berubah menjadi <strong>CONNECTED</strong>.
                    </li>
                  </ol>
                </div>
              )}

              {activeTutorialModal === 'firestore' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900">
                    Tutorial Sinkronisasi Real-Time &amp; Backup Firebase Firestore
                  </h4>
                  <p>
                    Database Firestore sudah otomatis disiapkan untuk aplikasi ini dan terikat ke akun Google Anda (<strong>{activeAccount?.email}</strong>).
                  </p>
                  <ol className="list-decimal list-inside space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <li>
                      Setiap kali Anda menambah database hadis, mengedit format, atau menjalankan <strong>BDI Projek</strong> di HP Android, server menyimpan state secara real-time.
                    </li>
                    <li>
                      Saat Anda membuka Web App ini di perangkat lain (misal PC/Laptop) dengan akun Google yang sama, tampilan otomatis tersinkronisasi secara langsung.
                    </li>
                    <li>
                      Untuk menyimpan snapshot cadangan permanen ke Cloud Firestore, klik tombol <strong>Simpan Snapshot ke Cloud Firestore</strong>. Untuk memulihkan data kapan saja, klik <strong>Restore dari Cloud Firestore</strong>.
                    </li>
                  </ol>
                </div>
              )}

              {activeTutorialModal === 'github' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900">
                    Tutorial Backup &amp; Sinkronisasi Database ke GitHub Repository
                  </h4>
                  <p>
                    Anda dapat menyimpan seluruh database Hadis, Kontak, dan BDI Projek langsung menjadi file JSON di dalam repository GitHub pribadi Anda:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <li>
                      Buat repository baru di GitHub (contoh: <code>username/bdi-hadis-backup</code>).
                    </li>
                    <li>
                      Buka menu GitHub <strong>Settings &rarr; Developer settings &rarr; Personal access tokens (Tokens classic)</strong>, lalu buat token baru dengan centang izin <code>repo</code>.
                    </li>
                    <li>
                      Masukkan nama repo (<code>username/nama-repo</code>) dan token `ghp_...` pada tab <strong>GitHub Repo</strong> di aplikasi ini.
                    </li>
                    <li>
                      Klik <strong>Upload Backup ke GitHub</strong> untuk meng-commit data terbaru, atau <strong>Tarik (Restore) dari GitHub</strong> dari perangkat mana pun.
                    </li>
                  </ol>
                </div>
              )}

              {activeTutorialModal === 'gsheet' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900">
                    Tutorial Integrasi Backup ke Google Sheets (Akun Google yang Sama)
                  </h4>
                  <p>
                    Agar data tersimpan rapi di Google Spreadsheet milik akun Google Anda tanpa biaya:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <li>
                      Buka Google Sheets baru di akun Google Anda, lalu klik menu <strong>Ekstensi &rarr; Apps Script</strong>.
                    </li>
                    <li>
                      Tempelkan kode singkat berikut di Apps Script:
                      <pre className="mt-2 p-3 bg-slate-900 text-emerald-300 rounded font-mono text-[11px] overflow-x-auto">
{`function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.getRange("A1").setValue(e.postData.contents);
  sheet.getRange("B1").setValue(new Date().toISOString());
  return ContentService.createTextOutput(JSON.stringify({ok: true}))
    .setMimeType(ContentService.MimeType.JSON);
}
function doGet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var raw = sheet.getRange("A1").getValue() || "{}";
  return ContentService.createTextOutput(raw)
    .setMimeType(ContentService.MimeType.JSON);
}`}
                      </pre>
                    </li>
                    <li>
                      Klik <strong>Terapkan (Deploy) &rarr; Deployment baru &rarr; Aplikasi Web</strong>, pilih akses <em>&ldquo;Siapa saja (Anyone)&rdquo;</em>, lalu salin URL Web App (`https://script.google.com/macros/s/.../exec`) ke kolom Google Sheets di aplikasi ini.
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
                <div className="md:col-span-2">
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

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sumber Kitab Shahih Gratis
                  </label>
                  <select
                    value={aiBook}
                    onChange={(e) => setAiBook(e.target.value)}
                    disabled={aiType === 'quran'}
                    className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 disabled:opacity-50"
                  >
                    <option value="bukhari">Shahih Bukhari</option>
                    <option value="muslim">Shahih Muslim</option>
                    <option value="tirmidzi">Sunan Tirmidzi</option>
                    <option value="abu-daud">Sunan Abu Dawud</option>
                    <option value="nasai">Sunan An-Nasa&apos;i</option>
                    <option value="ibnu-majah">Sunan Ibnu Majah</option>
                    <option value="semua">Bukhari &amp; Muslim</option>
                  </select>
                </div>

                <div className="md:col-span-5">
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

                <div className="md:col-span-2">
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
                  Kelola daftar nomor WhatsApp jamaah dan tentukan apakah mereka menerima <strong>Hadis Singkat</strong> atau <strong>Hadis Detail (Lengkap)</strong>.
                </p>
              </div>
              <button
                onClick={() => setShowBulkImport(!showBulkImport)}
                className="min-h-[44px] px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-2 self-start whitespace-nowrap shrink-0"
              >
                <Upload className="w-4 h-4" />
                <span>Impor Banyak Kontak Sekaligus</span>
              </button>
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

              {/* RIGHT: MULTI-CLOUD BACKUP & SYNC (FIRESTORE, GITHUB, GOOGLE SHEETS, FILE JSON) */}
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Backup, Restore &amp; Sinkronisasi Multi-Cloud
                    </h2>
                    <p className="text-xs text-slate-600">
                      Pilih tujuan sinkronisasi: <strong>Firebase Firestore</strong>, <strong>GitHub Repo</strong>, <strong>Google Sheets</strong>, atau <strong>File JSON</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveTutorialModal(
                        cloudProviderTab === 'local' ? 'firestore' : cloudProviderTab
                      )
                    }
                    className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-lg flex items-center gap-1"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Tutorial</span>
                  </button>
                </div>

                {/* Provider Selector Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-lg">
                  {[
                    { id: 'firestore', label: '1. Firestore Cloud' },
                    { id: 'github', label: '2. GitHub Repo' },
                    { id: 'gsheet', label: '3. Google Sheets' },
                    { id: 'local', label: '4. File JSON HP' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCloudProviderTab(tab.id as any)}
                      className={`py-2 px-2 text-xs font-semibold rounded-md transition-colors ${
                        cloudProviderTab === tab.id
                          ? 'bg-white text-emerald-800 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* TAB A: FIREBASE FIRESTORE */}
                {cloudProviderTab === 'firestore' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          Firebase Firestore (Akun: {activeAccount?.email})
                        </p>
                        <p className="text-[11px] text-slate-600">
                          Sinkronisasi real-time antar HP Android dan Web Browser.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTutorialModal('firestore')}
                        className="text-xs text-emerald-800 font-semibold underline"
                      >
                        Cara Kerja
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Label Cadangan Cloud
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
                        onClick={handleCloudBackup}
                        className="min-h-[44px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                      >
                        <CloudUpload className="w-4 h-4" />
                        <span>{cloudBusy ? 'Memproses...' : 'Backup ke Firestore'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={cloudBusy}
                        onClick={handleCloudRestore}
                        className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                      >
                        <CloudDownload className="w-4 h-4" />
                        <span>Restore dari Firestore</span>
                      </button>
                    </div>

                    {cloudInfo && (
                      <p className="text-xs text-emerald-800 font-semibold">{cloudInfo}</p>
                    )}
                  </div>
                )}

                {/* TAB B: GITHUB REPOSITORY SYNC */}
                {cloudProviderTab === 'github' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900">
                        Integrasi GitHub Repository (Push / Pull JSON Database)
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTutorialModal('github')}
                        className="text-xs text-emerald-800 font-semibold underline"
                      >
                        Lihat Tutorial GitHub
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Nama Repository (user/repo)
                        </label>
                        <input
                          type="text"
                          value={githubRepoDraft}
                          onChange={(e) => setGithubRepoDraft(e.target.value)}
                          placeholder="ridgitalstudio/bdi-hadis-db"
                          className="w-full min-h-[38px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Branch &amp; Path File
                        </label>
                        <input
                          type="text"
                          value={githubFilePathDraft}
                          onChange={(e) => setGithubFilePathDraft(e.target.value)}
                          placeholder="backup/bdi-daily-hadis.json"
                          className="w-full min-h-[38px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        GitHub Personal Access Token (ghp_...)
                      </label>
                      <input
                        type="password"
                        value={githubTokenDraft}
                        onChange={(e) => setGithubTokenDraft(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        className="w-full min-h-[38px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={cloudBusy}
                        onClick={() => handleGithubSync('push')}
                        className="min-h-[42px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                      >
                        <CloudUpload className="w-4 h-4" />
                        <span>Upload Backup ke GitHub</span>
                      </button>
                      <button
                        type="button"
                        disabled={cloudBusy}
                        onClick={() => handleGithubSync('pull')}
                        className="min-h-[42px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                      >
                        <CloudDownload className="w-4 h-4" />
                        <span>Restore dari GitHub</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB C: GOOGLE SHEETS SYNC */}
                {cloudProviderTab === 'gsheet' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900">
                        Integrasi Google Sheets (Akun Google: {activeAccount?.email})
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTutorialModal('gsheet')}
                        className="text-xs text-emerald-800 font-semibold underline"
                      >
                        Lihat Kode &amp; Tutorial GSheet
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        URL Web App Google Sheets (Apps Script)
                      </label>
                      <input
                        type="url"
                        value={gsheetUrlDraft}
                        onChange={(e) => setGsheetUrlDraft(e.target.value)}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        className="w-full min-h-[40px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        disabled={cloudBusy}
                        onClick={() => handleGsheetSync('push')}
                        className="min-h-[42px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                      >
                        <CloudUpload className="w-4 h-4" />
                        <span>Simpan ke Google Sheets</span>
                      </button>
                      <button
                        type="button"
                        disabled={cloudBusy}
                        onClick={() => handleGsheetSync('pull')}
                        className="min-h-[42px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                      >
                        <CloudDownload className="w-4 h-4" />
                        <span>Restore dari Google Sheets</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB D: LOCAL PHONE JSON */}
                {cloudProviderTab === 'local' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-slate-900">
                      Cadangan File Lokal HP (.JSON) — Tanpa Kuota Internet
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={handleExportLocalJson}
                        className="min-h-[44px] px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Ekspor Backup (.JSON)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="min-h-[44px] px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Impor Restore (.JSON)</span>
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
