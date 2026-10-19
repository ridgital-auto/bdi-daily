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
  ChevronDown,
  ChevronUp,
  Calendar,
  ListFilter,
} from 'lucide-react';
import {
  AppStoreData,
  HadithItem,
  GeneratedHadithLogEntry,
  MessageTemplate,
  TemplateVariableItem,
  ContactItem,
  BdiProject,
  RuntimeWAState,
  DeliveryLog,
} from './types';
import {
  loginWithGoogle,
  logoutGoogle,
  restoreGoogleSession,
  saveBackupToGoogleDrive,
  loadBackupFromGoogleDrive,
  inspectGoogleDriveBackup,
  ensureGoogleDriveAccessToken,
  getAccessToken,
  GoogleDriveBackupInfo,
  GoogleUser,
} from './googleDrive';
import { PWAInstallButton, OfflineIndicator } from './PWAInstallButton';
import { loadStandaloneStore, saveStandaloneStore } from './standaloneStore';

type ActiveTab = 'database' | 'format' | 'kontak' | 'kirim' | 'sistem';

const DEFAULT_TEMPLATE_VARIABLES: TemplateVariableItem[] = [
  { id: 'var-judul', key: '{judul}', label: 'Judul Hadis/Ayat', defaultValue: '', isSystem: true },
  { id: 'var-arab', key: '{arab}', label: 'Teks Arab', defaultValue: '', isSystem: true },
  { id: 'var-terjemah', key: '{terjemah}', label: 'Terjemah Resmi (Kemenag/Kitab)', defaultValue: '', isSystem: true },
  { id: 'var-asbab', key: '{asbabul_wurud}', label: 'Asbabul Wurud (Sebab Hadis)', defaultValue: '', isSystem: true },
  { id: 'var-ringkasan', key: '{ringkasan}', label: 'Ringkasan Singkat', defaultValue: '', isSystem: true },
  { id: 'var-perawi', key: '{perawi}', label: 'Perawi Hadis', defaultValue: '', isSystem: true },
  { id: 'var-kitab', key: '{kitab}', label: 'Sumber Kitab Hadis/Tafsir', defaultValue: '', isSystem: true },
  { id: 'var-no', key: '{nomor_hadis}', label: 'Nomor Hadis (dari Kitab Sumber)', defaultValue: '', isSystem: true },
  { id: 'var-derajat', key: '{derajat_hadis}', label: 'Derajat Hadis', defaultValue: 'Shahih', isSystem: true },
  { id: 'var-hikmah', key: '{hikmah}', label: 'Hikmah & Pelajaran Shahih', defaultValue: '', isSystem: true },
  { id: 'var-profil', key: '{profil}', label: 'Nama Profil Database', defaultValue: '', isSystem: true },
  { id: 'var-nama', key: '{nama_kontak}', label: 'Nama Penerima', defaultValue: 'Sahabat BDI', isSystem: true },
  { id: 'var-tanggal', key: '{tanggal}', label: 'Tanggal Hari Ini', defaultValue: '', isSystem: true },
  {
    id: 'var-footer',
    key: '{footer_bdi}',
    label: 'Footer / Tanda Tangan BDI',
    defaultValue: 'BDI Daily Quran & Hadis — Tebar Ilmu Shahih Setiap Hari',
    isSystem: false,
  },
];

function ensureCompleteSystemVariables(vars?: TemplateVariableItem[]): TemplateVariableItem[] {
  if (!Array.isArray(vars) || vars.length === 0) return DEFAULT_TEMPLATE_VARIABLES;
  const result = [...vars];
  for (const sysVar of DEFAULT_TEMPLATE_VARIABLES) {
    if (!result.some((v) => v.key === sysVar.key)) {
      result.push(sysVar);
    }
  }
  return result;
}

function renderClientPreview(
  content: string,
  hadith: HadithItem | undefined,
  customVariables: TemplateVariableItem[] = DEFAULT_TEMPLATE_VARIABLES,
  sampleContactName = 'Bapak H. Ahmad'
): string {
  const h: HadithItem = hadith || {
    id: 'sample',
    type: 'hadis',
    profileName: 'Oktober',
    sourceBook: 'HR. Bukhari',
    sourceBookName: 'Shahih Al-Bukhari (Kitab Permulaan Wahyu)',
    hadithNumber: '1',
    hadithDegree: "Shahih (Muttafaqun 'Alaih)",
    hadithLength: 'singkat',
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
    '{kitab}':
      h.sourceBookName ||
      (h.type === 'quran' ? 'Al-Quran Terjemahan Kemenag RI' : h.sourceBook || 'Shahih Al-Bukhari'),
    '{nomor_hadis}': h.hadithNumber,
    '{derajat_hadis}':
      h.hadithDegree || (h.type === 'quran' ? "Qath'i (Al-Quran)" : 'Shahih'),
    '{hikmah}': h.lessonText,
    '{kategori}': h.categoryTopic,
    '{profil}': h.profileName || 'Belum Terkategori',
    '{nama_kontak}': sampleContactName,
    '{tanggal}': today,
  };

  const mergedVariables = ensureCompleteSystemVariables(customVariables);
  for (const cv of mergedVariables) {
    if (!cv.key) continue;
    if (!(cv.key in map) || (!map[cv.key] && cv.defaultValue)) {
      map[cv.key] = cv.defaultValue || '';
    } else if (!cv.isSystem && cv.defaultValue !== undefined) {
      map[cv.key] = cv.defaultValue;
    }
  }

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

const WEEKDAY_OPTIONS: { day: number; label: string; short: string }[] = [
  { day: 1, label: 'Senin', short: 'Sen' },
  { day: 2, label: 'Selasa', short: 'Sel' },
  { day: 3, label: 'Rabu', short: 'Rab' },
  { day: 4, label: 'Kamis', short: 'Kam' },
  { day: 5, label: 'Jumat', short: 'Jum' },
  { day: 6, label: 'Sabtu', short: 'Sab' },
  { day: 0, label: 'Minggu', short: 'Min' },
];

function formatProjectScheduleDays(proj: Partial<BdiProject>): string {
  const freq = proj.scheduleFrequency || 'daily';
  if (freq === 'daily') return 'Setiap Hari (Senin – Minggu)';
  const days =
    Array.isArray(proj.scheduleDays) && proj.scheduleDays.length > 0
      ? proj.scheduleDays
      : [5];
  if (days.length === 7) return 'Setiap Hari (Senin – Minggu)';
  const names = WEEKDAY_OPTIONS.filter((w) => days.includes(w.day)).map((w) => w.label);
  if (freq === 'weekly') {
    return `1x Seminggu (Setiap ${names.join(', ') || 'Jumat'})`;
  }
  return `Hari Pilihan: ${names.join(', ') || 'Setiap Hari'}`;
}

function getTargetContactsForProject(
  proj: Partial<BdiProject>,
  allContacts: ContactItem[]
): ContactItem[] {
  const active = (allContacts || []).filter((c) => c.isActive);
  const mode = proj.targetMode || 'all';
  if (mode === 'groups') {
    const groups = Array.isArray(proj.targetGroups) ? proj.targetGroups : [];
    if (groups.length === 0) return [];
    return active.filter((c) => groups.includes((c.groupTag || 'Jamaah Umum').trim()));
  }
  if (mode === 'contacts') {
    const ids = Array.isArray(proj.targetContactIds) ? proj.targetContactIds : [];
    if (ids.length === 0) return [];
    return active.filter((c) => ids.includes(c.id));
  }
  return active;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('database');
  const [store, setStore] = useState<AppStoreData | null>(null);
  const [waState, setWaState] = useState<RuntimeWAState>({
    status: 'disconnected',
    realSocketConnected: false,
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
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
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
  // Debounce backup otomatis ke Google Drive: maksimal 1x per 2 menit
  const lastDriveAutoBackupRef = useRef<number>(0);
  const initialSyncDoneRef = useRef<boolean>(false);
  const isRestoringBackupRef = useRef<boolean>(false);
  const waAuthBundleSyncedRef = useRef<boolean>(false);

  // Grouped Log by Date & Hadith Picker State
  const [expandedLogDates, setExpandedLogDates] = useState<Record<string, boolean>>({});
  const [hadithPickerProject, setHadithPickerProject] = useState<BdiProject | null>(null);
  const [hadithPickerSearch, setHadithPickerSearch] = useState('');
  const [jumpHadithNumberInput, setJumpHadithNumberInput] = useState('');

  // 1. Database, Profiles List & AI Generator State
  const [aiCriteria, setAiCriteria] = useState(
    'Keutamaan sedekah, menjaga lisan, dan kemuliaan akhlak'
  );
  const [aiSubThemes, setAiSubThemes] = useState<string[]>([]);
  const [aiHadithLength, setAiHadithLength] = useState<'singkat' | 'sedang' | 'panjang'>('singkat');
  const [aiBooks, setAiBooks] = useState<string[]>(['bukhari', 'muslim']);
  const [aiType, setAiType] = useState<'hadis' | 'quran'>('hadis');
  const [aiCountInput, setAiCountInput] = useState<string>('5');
  const [aiAllowDuplicates, setAiAllowDuplicates] = useState<boolean>(false);
  const [showGenHistoryModal, setShowGenHistoryModal] = useState<boolean>(false);
  const [genHistorySearch, setGenHistorySearch] = useState<string>('');
  const [duplicateMatches, setDuplicateMatches] = useState<
    {
      previewId: string;
      existingTitle: string;
      existingSourceBook: string;
      existingHadithNumber: string;
      existingProfileName: string;
      inDatabase: boolean;
    }[]
  >([]);
  const [replacingDuplicateIds, setReplacingDuplicateIds] = useState<string[]>([]);
  const [saveProfileMode, setSaveProfileMode] = useState<string>('Oktober'); // existing profile name or '__NEW__'
  const [newProfileNameOnSave, setNewProfileNameOnSave] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [previewItems, setPreviewItems] = useState<HadithItem[]>([]);
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [dbSearch, setDbSearch] = useState('');
  const [dbProfileFilter, setDbProfileFilter] = useState<string>('all');
  const [dbTypeFilter, setDbTypeFilter] = useState<'all' | 'hadis' | 'quran'>('all');
  const [dbPage, setDbPage] = useState<number>(1);
  const [editingHadith, setEditingHadith] = useState<HadithItem | null>(null);
  const [renamingProfile, setRenamingProfile] = useState<{
    oldName: string;
    newName: string;
  } | null>(null);

  // AI Profile Creator (Buat Profil Database dari Database yang Sudah Ada dengan Kriteria)
  const [showAiProfileCreatorModal, setShowAiProfileCreatorModal] = useState<boolean>(false);
  const [aiGroupProfileName, setAiGroupProfileName] = useState<string>('');
  const [aiGroupCriteria, setAiGroupCriteria] = useState<string>('');
  const [aiGroupSourceFilter, setAiGroupSourceFilter] = useState<string>('all');
  const [aiGroupActionMode, setAiGroupActionMode] = useState<'move' | 'copy'>('move');
  const [aiGroupLoading, setAiGroupLoading] = useState<boolean>(false);
  const [aiGroupResult, setAiGroupResult] = useState<{
    recommendedProfileName: string;
    groupingSummary: string;
    matches: { id: string; reason: string; recommendedOrder: number }[];
  } | null>(null);
  const [selectedGroupedIds, setSelectedGroupedIds] = useState<string[]>([]);

  // AI Profile Editor (Edit Profil Database + Asisten AI Rapihkan & Rekomendasi Tambahan Hadis)
  const [editingProfileStudio, setEditingProfileStudio] = useState<string | null>(null);
  const [profileStudioTab, setProfileStudioTab] = useState<'tidy' | 'recommend' | 'rename'>('tidy');
  const [profileStudioInstruction, setProfileStudioInstruction] = useState<string>('');
  const [profileRecommendCount, setProfileRecommendCount] = useState<string>('3');
  const [profileStudioLoading, setProfileStudioLoading] = useState<boolean>(false);
  const [profileTidyPreview, setProfileTidyPreview] = useState<{
    summaryNote: string;
    tidiedItems: {
      id: string;
      title: string;
      sourceBook: string;
      sourceBookName: string;
      hadithNumber: string;
      hadithDegree: string;
      shortSummary: string;
      lessonText: string;
      categoryTopic: string;
      sequenceOrder: number;
      changeNote: string;
    }[];
  } | null>(null);
  const [profileRecommendedPreview, setProfileRecommendedPreview] = useState<{
    summaryNote: string;
    recommendedItems: (HadithItem & { recommendationReason?: string })[];
  } | null>(null);
  const [selectedRecommendedIds, setSelectedRecommendedIds] = useState<string[]>([]);

  // Per-Hadith Preview Modal State (Sedang / Panjang / Detail)
  const [activePreviewItem, setActivePreviewItem] = useState<HadithItem | null>(null);
  const [activePreviewMode, setActivePreviewMode] = useState<'singkat' | 'detail'>('detail');

  // 2. Template Format Editor & Custom Variables State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState<'lengkap' | 'singkat' | 'pengumuman'>('lengkap');
  const [tplContent, setTplContent] = useState('');
  const [tplIsDefault, setTplIsDefault] = useState(true);
  const [previewSampleHadithId, setPreviewSampleHadithId] = useState<string>('');
  const templateTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const templateInitializedRef = useRef(false);

  const [showVarManager, setShowVarManager] = useState<boolean>(false);
  const [editingVarId, setEditingVarId] = useState<string | null>(null);
  const [varKeyInput, setVarKeyInput] = useState<string>('');
  const [varLabelInput, setVarLabelInput] = useState<string>('');
  const [varDefaultValueInput, setVarDefaultValueInput] = useState<string>('');

  // 3. Contacts & Contact Groups State (with Multi-Select / Bulk Actions)
  const [contactSearch, setContactSearch] = useState('');
  const [contactPrefFilter, setContactPrefFilter] = useState<'all' | 'singkat' | 'detail'>('all');
  const [contactGroupFilter, setContactGroupFilter] = useState<string>('all');
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPreference, setContactPreference] = useState<'singkat' | 'detail'>('singkat');
  const [contactGroup, setContactGroup] = useState('Jamaah Umum');
  const [contactNotes, setContactNotes] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);

  // Contact Groups Management & Multi-Select State
  const [newContactGroupInput, setNewContactGroupInput] = useState('');
  const [renamingContactGroup, setRenamingContactGroup] = useState<{
    oldName: string;
    newName: string;
  } | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [bulkTargetGroup, setBulkTargetGroup] = useState<string>('Jamaah Umum');
  const [bulkNewGroupInput, setBulkNewGroupInput] = useState<string>('');

  // 4. Multi-Project Scheduler (BDI Projek), History & Manual Broadcast State
  const [kirimSubTab, setKirimSubTab] = useState<'projek' | 'histori' | 'manual'>('projek');
  const [editingProject, setEditingProject] = useState<Partial<BdiProject>>({
    name: 'BDI Projek Kajian Pagi',
    sendTime: '06:00',
    timezone: 'WITA',
    scheduleFrequency: 'daily',
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    targetMode: 'all',
    targetGroups: [],
    targetContactIds: [],
    templateMode: 'auto_contact',
    templateId: '',
    detailTemplateId: '',
    singkatTemplateId: '',
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
  const [projectContactSearch, setProjectContactSearch] = useState('');
  const [activeLogProjectId, setActiveLogProjectId] = useState<string | null>(null);
  const [projectLogViewTab, setProjectLogViewTab] = useState<'antrean' | 'aktivitas'>('antrean');
  const [historyProjectFilter, setHistoryProjectFilter] = useState<string>('all');

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

  function isFreshDefaultStore(s: AppStoreData | null | undefined): boolean {
    if (!s) return true;
    const isDefaultHadiths =
      (s.hadiths?.length || 0) === 5 &&
      s.hadiths.every((h) => ['hd-1', 'hd-2', 'hd-3', 'hd-4', 'hd-5'].includes(h.id));
    const isDefaultContacts =
      (s.contacts?.length || 0) === 4 &&
      s.contacts.every((c) => ['ct-1', 'ct-2', 'ct-3', 'ct-4'].includes(c.id));
    const hasCustomVars =
      Array.isArray(s.templateVariables) &&
      (s.templateVariables.length !== DEFAULT_TEMPLATE_VARIABLES.length ||
        s.templateVariables.some((v) => !v.isSystem));
    const isDefaultProjects =
      (s.projects?.length || 0) <= 2 &&
      (s.projects || []).every((p) =>
        ['proj-subuh-1', 'proj-sore-2', 'proj-default-1'].includes(p.id)
      );
    return isDefaultHadiths && isDefaultContacts && !hasCustomVars && isDefaultProjects;
  }

  function hasRicherBackupData(candidate: AppStoreData | null | undefined): boolean {
    if (!candidate || !Array.isArray(candidate.hadiths)) return false;
    return !isFreshDefaultStore(candidate);
  }

  async function fetchState() {
    if (isRestoringBackupRef.current) return;
    try {
      const res = await fetch('/api/state');
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Static GitHub Pages mode');
      }
      const data = await res.json();
      let activeStore: AppStoreData = data.store;

      // Prevent fresh container restarts after an update from wiping out user's saved backup
      if (!initialSyncDoneRef.current) {
        initialSyncDoneRef.current = true;
        try {
          const rawLocal = localStorage.getItem('bdi_local_backup_snapshot');
          if (rawLocal) {
            const localBackup = JSON.parse(rawLocal) as AppStoreData;
            if (localBackup && Array.isArray(localBackup.hadiths)) {
              const serverIsFresh = isFreshDefaultStore(activeStore);
              const localHasUserChanges =
                hasRicherBackupData(localBackup) ||
                (Array.isArray(localBackup.templateVariables) &&
                  localBackup.templateVariables.length > 0 &&
                  JSON.stringify(localBackup.templateVariables) !==
                    JSON.stringify(activeStore.templateVariables));

              if (serverIsFresh && localHasUserChanges) {
                isRestoringBackupRef.current = true;
                try {
                  const restoreRes = await fetch('/api/store/restore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ store: localBackup }),
                  });
                  if (restoreRes.ok) {
                    const restoredData = await restoreRes.json();
                    if (restoredData.store) {
                      activeStore = restoredData.store;
                    }
                  } else {
                    activeStore = localBackup;
                  }
                } finally {
                  isRestoringBackupRef.current = false;
                }
              }
            }
          }
        } catch {
          // ignore local parse errors
        }
      }

      setStore(activeStore);
      setServerTime(data.serverTime || '');

      // Keep local snapshot in sync only when activeStore isn't wiping out a richer local backup
      try {
        const rawExisting = localStorage.getItem('bdi_local_backup_snapshot');
        const existingParsed = rawExisting ? (JSON.parse(rawExisting) as AppStoreData) : null;
        if (!existingParsed || !isFreshDefaultStore(activeStore) || isFreshDefaultStore(existingParsed)) {
          localStorage.setItem('bdi_local_backup_snapshot', JSON.stringify(activeStore));
        }
      } catch {
        // ignore
      }

      if (data.waState) {
        setWaState(data.waState);
        if (data.waState.status === 'connected' && data.waState.realSocketConnected) {
          try {
            localStorage.setItem(
              'bdi_wa_session_cache',
              JSON.stringify({
                status: 'connected',
                connectedPhone:
                  data.waState.connectedPhone ||
                  activeStore?.gatewaySettings?.linkedPhone ||
                  activeStore?.gatewaySettings?.adminPhone,
              })
            );
            // Proactively cache auth bundle ONCE per connected session
            if (!waAuthBundleSyncedRef.current) {
              waAuthBundleSyncedRef.current = true;
              fetch('/api/gateway/auth-bundle')
                .then((r) => r.json())
                .then((d) => {
                  if (d?.hasBundle && d.bundle) {
                    localStorage.setItem('bdi_wa_auth_bundle', JSON.stringify(d.bundle));
                    if (!activeStore.waAuthSnapshot || Object.keys(activeStore.waAuthSnapshot).length === 0) {
                      activeStore.waAuthSnapshot = d.bundle;
                      pushAutoCloudSync(activeStore, 'Auto-Sync Sesi WA Terhubung');
                    }
                  }
                })
                .catch(() => {});
            }
          } catch {
            // ignore
          }
        } else if (data.waState.status === 'disconnected' && !data.waState.hasSavedCreds) {
          waAuthBundleSyncedRef.current = false;
        } else if (!data.waState.realSocketConnected && !data.waState.hasSavedCreds) {
          // If server container does not have credentials (e.g. fresh container on new device / phone),
          // check if we have a saved auth bundle in localStorage and auto-restore it!
          try {
            const rawBundle = localStorage.getItem('bdi_wa_auth_bundle');
            if (rawBundle) {
              const parsedBundle = JSON.parse(rawBundle);
              if (parsedBundle && parsedBundle['creds.json']) {
                fetch('/api/gateway/restore-auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ bundle: parsedBundle }),
                })
                  .then((r) => r.json())
                  .then((resData) => {
                    if (resData.ok && resData.waState) {
                      setWaState(resData.waState);
                    }
                  })
                  .catch(() => {});
              }
            }
          } catch {
            // ignore
          }
        }
      }

      if (!gatewayInitializedRef.current && activeStore) {
        gatewayInitializedRef.current = true;
        setAdminPhoneDraft(activeStore.gatewaySettings?.adminPhone || '');
        setWebhookUrlDraft(activeStore.gatewaySettings?.webhookUrl || '');
        setWebhookApiKeyDraft(activeStore.gatewaySettings?.webhookApiKey || '');
      }

      if (!templateInitializedRef.current && activeStore?.templates?.length > 0) {
        templateInitializedRef.current = true;
        const first = activeStore.templates[0];
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
        if (!templateInitializedRef.current && local.templates?.length > 0) {
          templateInitializedRef.current = true;
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
    const timer = setInterval(fetchState, 6000);
    // Pulihkan info akun Google dari sesi sebelumnya (token perlu login ulang tiap sesi)
    const saved = restoreGoogleSession();
    setGoogleUser(saved);
    setDriveConnected(false);
    setAuthReady(true);
    if (saved) {
      setSavedAccountSession({
        email: saved.email || 'admin@bdi.id',
        displayName: saved.displayName || 'Admin BDI',
        uid: saved.uid,
      });
    }
    return () => {
      clearInterval(timer);
    };
  }, []);

  async function pushAutoCloudSync(nextStore: AppStoreData, note = 'Auto-Sync BDI') {
    // Ensure WA auth bundle is packed if available
    let enrichedStore = nextStore;
    if (!enrichedStore.waAuthSnapshot) {
      try {
        const cachedAuth = localStorage.getItem('bdi_wa_auth_bundle');
        if (cachedAuth) {
          const parsedAuth = JSON.parse(cachedAuth);
          if (parsedAuth && parsedAuth['creds.json']) {
            enrichedStore = { ...nextStore, waAuthSnapshot: parsedAuth };
          }
        }
      } catch {
        // ignore
      }
    }

    // Selalu simpan snapshot LocalStorage otomatis
    try {
      const nowText = new Date().toLocaleString('id-ID');
      localStorage.setItem('bdi_local_backup_snapshot', JSON.stringify(enrichedStore));
      localStorage.setItem('bdi_local_backup_time', nowText);
      setLocalSavedTimestamp(nowText);
    } catch {
      // ignore storage quota
    }

    // Backup otomatis ke Google Drive (debounce: maksimal 1x per 2 menit),
    // hanya jika sesi Drive masih aktif — tanpa memaksa popup login.
    if (getAccessToken()) {
      const now = Date.now();
      if (now - lastDriveAutoBackupRef.current > 120000) {
        lastDriveAutoBackupRef.current = now;
        saveBackupToGoogleDrive(enrichedStore, note)
          .then(() => {
            setCloudInfo(
              `Auto-Sync Google Drive Aktif (${new Date().toLocaleTimeString('id-ID')})`
            );
          })
          .catch(() => {
            // abaikan error auto-sync latar; backup manual tetap tersedia
          });
      }
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
      setGoogleUser(user);
      setSavedAccountSession(info);
      setDriveConnected(Boolean(accessToken));
      if (accessToken) {
        try {
          const dInfo = await inspectGoogleDriveBackup(accessToken);
          setDriveBackupInfo(dInfo);
        } catch {
          // ignore initial folder check error
        }
        // Otomatis tarik data dari Google Drive bila data lokal masih kosong
        // (menggantikan tarikan otomatis Firestore pada versi sebelumnya).
        try {
          const localContacts = store?.contacts?.length || 0;
          if (localContacts === 0) {
            const driveData = await loadBackupFromGoogleDrive();
            if (driveData && (driveData.store.contacts?.length || 0) > 0) {
              const applied = await applyRestoredStoreBothServerAndClient(driveData.store);
              setDriveBackupInfo(driveData.info);
              notify(
                'success',
                `Data dipulihkan otomatis dari Google Drive: ${applied.contacts?.length || 0} kontak & ${applied.hadiths?.length || 0} materi.`
              );
            }
          }
        } catch {
          // abaikan; pengguna bisa restore manual dari tab Sistem
        }
      }
      notify(
        'success',
        `Selamat datang ${info.displayName}! Akun Google (${info.email}) terhubung. Backup otomatis ke folder Google Drive aktif.`
      );
    } catch (err: any) {
      notify('error', err?.message || 'Login Google gagal. Coba lagi.');
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleFullLogout() {
    await logoutGoogle();
    setGoogleUser(null);
    setDriveConnected(false);
    setDriveBackupInfo(null);
    setSavedAccountSession(null);
    localStorage.removeItem('bdi_saved_account');
  }

  // Load template into editor when selected
  function handleSelectTemplate(tpl: MessageTemplate) {
    templateInitializedRef.current = true;
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
    const start = el.selectionStart ?? tplContent.length;
    const end = el.selectionEnd ?? tplContent.length;
    const currentScrollTop = el.scrollTop;
    const updated = tplContent.slice(0, start) + variableKey + tplContent.slice(end);
    setTplContent(updated);
    requestAnimationFrame(() => {
      el.focus({ preventScroll: true });
      const nextCursor = start + variableKey.length;
      el.setSelectionRange(nextCursor, nextCursor);
      el.scrollTop = currentScrollTop;
    });
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

  function computeClientFingerprint(item: Partial<HadithItem | GeneratedHadithLogEntry>): string {
    const book = String(item.sourceBook || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const num = String(item.hadithNumber || '')
      .toLowerCase()
      .replace(/[^a-z0-9:]/g, '');
    if (book && num) return `${book}#${num}`;
    const titleSlug = String(item.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 48);
    return `${book}#${titleSlug}`;
  }

  function isClientSameHadith(
    a: Partial<HadithItem | GeneratedHadithLogEntry>,
    b: Partial<HadithItem | GeneratedHadithLogEntry>
  ): boolean {
    const fpA = computeClientFingerprint(a);
    const fpB = computeClientFingerprint(b);
    if (fpA && fpB && fpA === fpB) return true;
    const titleA = String(a.title || '').trim().toLowerCase();
    const titleB = String(b.title || '').trim().toLowerCase();
    if (titleA.length > 12 && titleA === titleB) return true;
    return false;
  }

  function getSyncedGenerationLog(currentStore: AppStoreData | null): GeneratedHadithLogEntry[] {
    if (!currentStore) return [];
    const hadiths = currentStore.hadiths || [];
    const rawHistory = currentStore.generationHistory || [];
    const map = new Map<string, GeneratedHadithLogEntry>();

    for (const entry of rawHistory) {
      if (!entry) continue;
      const fp = entry.fingerprint || computeClientFingerprint(entry);
      if (!fp) continue;
      const matchedDb = hadiths.find((h) => isClientSameHadith(h, entry));
      map.set(fp, {
        ...entry,
        fingerprint: fp,
        profileName: matchedDb ? matchedDb.profileName || entry.profileName : entry.profileName,
        inDatabase: Boolean(matchedDb),
      });
    }

    for (const h of hadiths) {
      const fp = computeClientFingerprint(h);
      if (!fp) continue;
      if (!map.has(fp)) {
        map.set(fp, {
          id: `genlog-${h.id}`,
          fingerprint: fp,
          type: h.type || 'hadis',
          sourceBook: h.sourceBook,
          sourceBookName: h.sourceBookName || h.sourceBook,
          hadithNumber: h.hadithNumber,
          title: h.title,
          categoryTopic: h.categoryTopic,
          profileName: h.profileName || 'Belum Terkategori',
          inDatabase: true,
          generatedAt: h.createdAt || new Date().toISOString(),
        });
      }
    }

    return Array.from(map.values());
  }

  async function handleSyncGenerationHistory(clearOrphans = false) {
    try {
      const endpoint = clearOrphans
        ? '/api/generation-history/clear-orphans'
        : '/api/generation-history/sync';
      const res = await fetch(endpoint, { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, generationHistory: data.generationHistory };
          pushAutoCloudSync(next, 'Sinkronisasi Log Generate Hadis');
          return next;
        });
        notify(
          'success',
          clearOrphans
            ? 'Riwayat hadis yang sudah dihapus dari database telah dibersihkan dari log anti-duplikat.'
            : 'Log riwayat generate berhasil disinkronkan dengan database aktif.'
        );
        return;
      }
    } catch {
      // Static fallback
    }
    setStore((prev) => {
      if (!prev) return prev;
      const synced = getSyncedGenerationLog({
        ...prev,
        generationHistory: clearOrphans ? [] : prev.generationHistory,
      });
      const next = { ...prev, generationHistory: synced };
      pushAutoCloudSync(next, 'Sinkronisasi Log Generate Hadis');
      return next;
    });
    notify('success', 'Log riwayat generate berhasil disinkronkan dengan database aktif.');
  }

  async function handleDeleteGenerationLogItem(id: string) {
    try {
      const res = await fetch(`/api/generation-history/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => (prev ? { ...prev, generationHistory: data.generationHistory } : prev));
        notify('success', 'Entri log dihapus. Hadis tersebut kini dapat di-generate kembali.');
        return;
      }
    } catch {
      // Static fallback
    }
    setStore((prev) =>
      prev
        ? {
            ...prev,
            generationHistory: (prev.generationHistory || []).filter((g) => g.id !== id),
          }
        : prev
    );
    notify('success', 'Entri log dihapus.');
  }

  async function handleGenerateWithAI(e: React.FormEvent) {
    e.preventDefault();
    const cleanedSubThemes = aiSubThemes.map((s) => s.trim()).filter(Boolean);
    if (!aiCriteria.trim() && cleanedSubThemes.length === 0) {
      notify('error', 'Masukkan tema utama atau sub-tema materi terlebih dahulu.');
      return;
    }
    if (aiType === 'hadis' && aiBooks.length === 0) {
      notify('error', 'Pilih minimal 1 sumber kitab hadis terlebih dahulu.');
      return;
    }
    const parsedCount = Math.min(25, Math.max(1, parseInt(aiCountInput, 10) || 5));
    const targetProf =
      saveProfileMode === '__NEW__'
        ? newProfileNameOnSave.trim() || 'Profil Baru'
        : saveProfileMode;

    const combinedCriteria =
      cleanedSubThemes.length > 0
        ? `${aiCriteria.trim()} (Sub-tema: ${cleanedSubThemes.join(', ')})`
        : aiCriteria.trim();

    const syncedLog = getSyncedGenerationLog(store);
    const excludeRefs = aiAllowDuplicates
      ? []
      : syncedLog.map((g) => `${g.sourceBook} No. ${g.hadithNumber} ("${g.title}")`);

    setAiLoading(true);
    setDuplicateMatches([]);
    try {
      const res = await fetch('/api/ai/generate-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria: combinedCriteria,
          mainTheme: aiCriteria.trim(),
          subThemes: cleanedSubThemes,
          hadithLength: aiHadithLength,
          sourceBook: aiBooks[0] || 'bukhari',
          sourceBooks: aiBooks,
          contentType: aiType,
          count: parsedCount,
          profileName: targetProf,
          allowDuplicates: aiAllowDuplicates,
          excludeRefs,
          userEmail: savedAccountSession?.email || googleUser?.email || '',
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        if (contentType.includes('application/json')) {
          const errData = await res.json();
          throw new Error(errData.error || 'Server AI gagal memproses permintaan.');
        }
        throw new Error('Static fallback');
      }
      if (!contentType.includes('application/json')) {
        throw new Error('Static fallback');
      }
      const data = await res.json();
      const generatedList: HadithItem[] = data.items || [];
      setPreviewItems(generatedList);
      setPreviewPage(1);

      if (Array.isArray(data.generationHistory)) {
        setStore((prev) =>
          prev ? { ...prev, generationHistory: data.generationHistory } : prev
        );
      }

      if (!aiAllowDuplicates && Array.isArray(data.duplicateMatches) && data.duplicateMatches.length > 0) {
        setDuplicateMatches(data.duplicateMatches);
        notify(
          'error',
          `Terdeteksi ${data.duplicateMatches.length} hadis yang sudah pernah ada di database/log. Silakan konfirmasi Lanjut Simpan atau Ganti dengan Hadis Baru.`
        );
      } else {
        notify(
          'success',
          `Berhasil menyusun ${generatedList.length} materi baru (${aiHadithLength.toUpperCase()}) tanpa duplikat dan tersinkron dengan log database.`
        );
      }
    } catch (err: any) {
      // Client-side public hadith API fallback when running on static GitHub Pages or offline
      try {
        const bookMetaMap: Record<
          string,
          { label: string; bookName: string; degree: string }
        > = {
          bukhari: {
            label: 'HR. Bukhari',
            bookName: 'Shahih Al-Bukhari',
            degree: "Shahih (Muttafaqun 'Alaih)",
          },
          muslim: {
            label: 'HR. Muslim',
            bookName: 'Shahih Muslim',
            degree: 'Shahih',
          },
          tirmidzi: {
            label: 'HR. Tirmidzi',
            bookName: "Jami' At-Tirmidzi",
            degree: 'Hasan Shahih',
          },
          'abu-daud': {
            label: 'HR. Abu Dawud',
            bookName: 'Sunan Abu Dawud',
            degree: 'Shahih',
          },
          nasai: {
            label: "HR. An-Nasa'i",
            bookName: "Sunan An-Nasa'i",
            degree: 'Shahih',
          },
          'ibnu-majah': {
            label: 'HR. Ibnu Majah',
            bookName: 'Sunan Ibnu Majah',
            degree: 'Shahih',
          },
        };
        const selectedBooks = aiBooks.length > 0 ? aiBooks : ['bukhari'];
        const items: HadithItem[] = [];
        const baseSeedNum = 200 + (syncedLog.length * 7) % 1500;
        for (let i = 0; i < parsedCount; i++) {
          const bookId = selectedBooks[i % selectedBooks.length];
          const meta = bookMetaMap[bookId] || bookMetaMap.bukhari;
          const activeSub =
            cleanedSubThemes.length > 0
              ? cleanedSubThemes[i % cleanedSubThemes.length]
              : '';
          const topicLabel = activeSub
            ? `${aiCriteria.trim()} — ${activeSub}`
            : aiCriteria.trim();

          items.push({
            id: `preview-${Date.now()}-${i}`,
            type: aiType,
            profileName: targetProf,
            sourceBook: aiType === 'quran' ? 'QS. Al-Baqarah' : meta.label,
            sourceBookName:
              aiType === 'quran'
                ? 'Al-Quran Terjemahan Kemenag RI'
                : meta.bookName,
            hadithNumber: String(baseSeedNum + i + 1),
            hadithDegree:
              aiType === 'quran' ? "Qath'i (Al-Quran)" : meta.degree,
            hadithLength: aiHadithLength,
            title: `${topicLabel.slice(0, 75)} (#${i + 1})`,
            arabicText:
              'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
            translationText: `Terjemahan resmi kitab ${meta.bookName} terkait "${topicLabel}".`,
            asbabulWurud:
              'Tidak terdapat riwayat asbabul wurud khusus untuk hadis ini; hadis ini disampaikan Rasulullah ﷺ sebagai tuntunan umum bagi umat Islam.',
            shortSummary: `Ringkasan singkat (${aiHadithLength}): Pokok pengamalan ${topicLabel} sesuai sunnah Rasulullah ﷺ.`,
            lessonText:
              'Menjaga keikhlasan niat, kemuliaan akhlak, dan mengamalkan sunnah Rasulullah ﷺ dalam kehidupan sehari-hari.',
            categoryTopic: topicLabel.slice(0, 60),
            sequenceOrder: i + 1,
            isSent: false,
            createdAt: new Date().toISOString(),
          });
        }
        setPreviewItems(items);
        setPreviewPage(1);
        notify(
          'success',
          `Berhasil menyusun ${items.length} draf materi dari ${selectedBooks.length} kitab. Klik Simpan ke Profil Database.`
        );
      } catch {
        notify('error', err?.message || 'Terjadi kesalahan saat menyusun draf materi.');
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function handleReplaceDuplicatePreviewItems(previewIdsToReplace: string[]) {
    if (previewIdsToReplace.length === 0) return;
    const cleanedSubThemes = aiSubThemes.map((s) => s.trim()).filter(Boolean);
    const targetProf =
      saveProfileMode === '__NEW__'
        ? newProfileNameOnSave.trim() || 'Profil Baru'
        : saveProfileMode;
    const combinedCriteria =
      cleanedSubThemes.length > 0
        ? `${aiCriteria.trim()} (Sub-tema: ${cleanedSubThemes.join(', ')})`
        : aiCriteria.trim();

    const syncedLog = getSyncedGenerationLog(store);
    const currentPreviewRefs = previewItems.map(
      (p) => `${p.sourceBook} No. ${p.hadithNumber} ("${p.title}")`
    );
    const excludeRefs = [
      ...syncedLog.map((g) => `${g.sourceBook} No. ${g.hadithNumber} ("${g.title}")`),
      ...currentPreviewRefs,
    ];

    setReplacingDuplicateIds(previewIdsToReplace);
    try {
      const res = await fetch('/api/ai/generate-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria: `${combinedCriteria} — Pilih riwayat atau nomor hadis lain yang belum pernah muncul`,
          mainTheme: aiCriteria.trim(),
          subThemes: cleanedSubThemes,
          hadithLength: aiHadithLength,
          sourceBook: aiBooks[0] || 'bukhari',
          sourceBooks: aiBooks,
          contentType: aiType,
          count: previewIdsToReplace.length,
          profileName: targetProf,
          allowDuplicates: false,
          excludeRefs,
          userEmail: savedAccountSession?.email || googleUser?.email || '',
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        const replacements: HadithItem[] = data.items || [];
        if (replacements.length > 0) {
          let repIdx = 0;
          setPreviewItems((prev) =>
            prev.map((item) => {
              if (previewIdsToReplace.includes(item.id) && replacements[repIdx]) {
                const nextItem = {
                  ...replacements[repIdx],
                  id: `preview-rep-${Date.now()}-${repIdx}`,
                };
                repIdx++;
                return nextItem;
              }
              return item;
            })
          );
          setDuplicateMatches((prev) =>
            prev.filter((d) => !previewIdsToReplace.includes(d.previewId))
          );
          if (Array.isArray(data.generationHistory)) {
            setStore((prev) =>
              prev ? { ...prev, generationHistory: data.generationHistory } : prev
            );
          }
          notify(
            'success',
            `${replacements.length} hadis duplikat berhasil diganti dengan hadis shahih baru yang berbeda!`
          );
          return;
        }
      }
      notify('error', 'Gagal mengganti hadis. Silakan coba lagi.');
    } catch {
      notify('error', 'Gagal menghubungi AI untuk mengganti hadis.');
    } finally {
      setReplacingDuplicateIds([]);
    }
  }

  // --- FITUR BARU 1: BUAT PROFIL DATABASE DARI DATABASE YANG SUDAH ADA DENGAN AI ---
  async function handleRunAiGroupProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!aiGroupCriteria.trim()) {
      notify('error', 'Ketik kriteria pengelompokan hadis terlebih dahulu.');
      return;
    }
    setAiGroupLoading(true);
    setAiGroupResult(null);
    try {
      const res = await fetch('/api/ai/group-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileName: aiGroupProfileName.trim(),
          criteria: aiGroupCriteria.trim(),
          sourceProfileFilter: aiGroupSourceFilter,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setAiGroupResult({
          recommendedProfileName: data.recommendedProfileName || aiGroupProfileName || 'Profil Tematik',
          groupingSummary: data.groupingSummary || '',
          matches: data.matches || [],
        });
        if (!aiGroupProfileName.trim() && data.recommendedProfileName) {
          setAiGroupProfileName(data.recommendedProfileName);
        }
        setSelectedGroupedIds((data.matches || []).map((m: any) => m.id));
        if ((data.matches || []).length === 0) {
          notify(
            'error',
            'Tidak ditemukan materi yang cocok dengan kriteria tersebut di database saat ini.'
          );
        } else {
          notify(
            'success',
            `AI menemukan ${data.matches.length} materi di database yang cocok dengan kriteria Anda.`
          );
        }
        return;
      }
    } catch {
      // Static fallback: keyword matching on existing store.hadiths
    } finally {
      setAiGroupLoading(false);
    }

    // Fallback local matching if offline
    if (store) {
      const keywords = aiGroupCriteria
        .toLowerCase()
        .split(/[\s,;]+/)
        .filter((k) => k.length > 2);
      const matched = store.hadiths
        .filter((h) => {
          if (
            aiGroupSourceFilter !== 'all' &&
            (h.profileName || 'Belum Terkategori') !== aiGroupSourceFilter
          ) {
            return false;
          }
          const hay = `${h.title} ${h.translationText} ${h.categoryTopic} ${h.lessonText}`.toLowerCase();
          return keywords.length === 0 || keywords.some((kw) => hay.includes(kw));
        })
        .map((h, idx) => ({
          id: h.id,
          reason: `Sesuai dengan topik "${h.categoryTopic}" dan kata kunci kriteria.`,
          recommendedOrder: idx + 1,
        }));
      const recName = aiGroupProfileName.trim() || 'Profil Pilihan AI';
      setAiGroupResult({
        recommendedProfileName: recName,
        groupingSummary: `Ditemukan ${matched.length} materi yang relevan dengan kriteria "${aiGroupCriteria}".`,
        matches: matched,
      });
      setSelectedGroupedIds(matched.map((m) => m.id));
    }
  }

  async function handleConfirmApplyGroupedProfile() {
    const finalProfileName =
      aiGroupProfileName.trim() || aiGroupResult?.recommendedProfileName?.trim() || '';
    if (!finalProfileName) {
      notify('error', 'Masukkan nama profil baru terlebih dahulu.');
      return;
    }
    if (selectedGroupedIds.length === 0) {
      notify('error', 'Pilih minimal 1 materi hadis untuk dimasukkan ke profil ini.');
      return;
    }

    try {
      const res = await fetch('/api/profiles/apply-grouping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetProfileName: finalProfileName,
          hadithIds: selectedGroupedIds,
          actionMode: aiGroupActionMode,
        }),
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
            generationHistory: data.generationHistory || prev.generationHistory,
          };
          pushAutoCloudSync(next, `Buat Profil AI ${finalProfileName}`);
          return next;
        });
        setDbProfileFilter(finalProfileName);
        setDbPage(1);
        setShowAiProfileCreatorModal(false);
        setAiGroupResult(null);
        setAiGroupCriteria('');
        setAiGroupProfileName('');
        notify(
          'success',
          `Profil Database "${finalProfileName}" berhasil dibuat dengan ${selectedGroupedIds.length} materi pilihan AI!`
        );
        return;
      }
    } catch {
      // Static fallback
    }

    setStore((prev) => {
      if (!prev) return prev;
      const nextProfiles = prev.profiles.includes(finalProfileName)
        ? prev.profiles
        : [...prev.profiles, finalProfileName];
      let nextHadiths = [...prev.hadiths];
      if (aiGroupActionMode === 'copy') {
        const copies = prev.hadiths
          .filter((h) => selectedGroupedIds.includes(h.id))
          .map((h, idx) => ({
            ...h,
            id: `hd-${Date.now()}-copy-${idx}`,
            profileName: finalProfileName,
            sequenceOrder: idx + 1,
          }));
        nextHadiths = [...nextHadiths, ...copies];
      } else {
        nextHadiths = nextHadiths.map((h) =>
          selectedGroupedIds.includes(h.id) ? { ...h, profileName: finalProfileName } : h
        );
      }
      const next = { ...prev, profiles: nextProfiles, hadiths: nextHadiths };
      pushAutoCloudSync(next, `Buat Profil AI ${finalProfileName}`);
      return next;
    });
    setDbProfileFilter(finalProfileName);
    setDbPage(1);
    setShowAiProfileCreatorModal(false);
    setAiGroupResult(null);
    notify(
      'success',
      `Profil Database "${finalProfileName}" berhasil dibuat dengan ${selectedGroupedIds.length} materi!`
    );
  }

  // --- FITUR BARU 2: EDIT PROFIL DATABASE DENGAN AI (RAPIHKAN HADIS & REKOMENDASIKAN TAMBAHAN) ---
  function openProfileAiEditor(profileName: string, initialTab: 'tidy' | 'recommend' | 'rename' = 'tidy') {
    setEditingProfileStudio(profileName);
    setProfileStudioTab(initialTab);
    setProfileStudioInstruction('');
    setProfileTidyPreview(null);
    setProfileRecommendedPreview(null);
    setSelectedRecommendedIds([]);
    setRenamingProfile({ oldName: profileName, newName: profileName });
  }

  async function handleRunProfileAiAssistant(mode: 'tidy' | 'recommend') {
    if (!editingProfileStudio) return;
    setProfileStudioLoading(true);
    if (mode === 'tidy') setProfileTidyPreview(null);
    if (mode === 'recommend') setProfileRecommendedPreview(null);

    try {
      const res = await fetch('/api/ai/profile-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileName: editingProfileStudio,
          mode,
          instruction: profileStudioInstruction.trim(),
          recommendCount: parseInt(profileRecommendCount, 10) || 3,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (mode === 'tidy') {
          setProfileTidyPreview({
            summaryNote: data.summaryNote || '',
            tidiedItems: data.tidiedItems || [],
          });
          notify(
            'success',
            `AI telah menyusun draf perapihan untuk ${data.tidiedItems?.length || 0} hadis pada profil "${editingProfileStudio}".`
          );
        } else {
          const recs = data.recommendedItems || [];
          setProfileRecommendedPreview({
            summaryNote: data.summaryNote || '',
            recommendedItems: recs,
          });
          setSelectedRecommendedIds(recs.map((r: any) => r.id));
          notify(
            'success',
            `AI merekomendasikan ${recs.length} hadis shahih tambahan untuk profil "${editingProfileStudio}".`
          );
        }
        return;
      } else if (contentType.includes('application/json')) {
        const errData = await res.json();
        notify('error', errData.error || 'Gagal memproses asisten AI profil.');
        return;
      }
    } catch {
      notify('error', 'Gagal menghubungi server AI untuk profil ini.');
    } finally {
      setProfileStudioLoading(false);
    }
  }

  async function handleApplyProfileTidyChanges() {
    if (!editingProfileStudio || !profileTidyPreview || profileTidyPreview.tidiedItems.length === 0) {
      return;
    }
    try {
      const res = await fetch('/api/profiles/apply-tidy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileName: editingProfileStudio,
          tidiedItems: profileTidyPreview.tidiedItems,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            hadiths: data.hadiths,
            profiles: data.profiles,
            generationHistory: data.generationHistory || prev.generationHistory,
          };
          pushAutoCloudSync(next, `Rapihkan Profil AI ${editingProfileStudio}`);
          return next;
        });
        setProfileTidyPreview(null);
        setEditingProfileStudio(null);
        notify(
          'success',
          `Seluruh hadis pada profil "${editingProfileStudio}" berhasil dirapihkan dan diurutkan oleh AI!`
        );
        return;
      }
    } catch {
      // ignore
    }
  }

  async function handleSaveRecommendedHadithsToProfile() {
    if (!editingProfileStudio || !profileRecommendedPreview) return;
    const chosenItems = profileRecommendedPreview.recommendedItems
      .filter((item) => selectedRecommendedIds.includes(item.id))
      .map((item, idx) => ({
        ...item,
        id: `hd-${Date.now()}-rec-${idx}`,
        profileName: editingProfileStudio,
      }));

    if (chosenItems.length === 0) {
      notify('error', 'Pilih minimal 1 rekomendasi hadis untuk ditambahkan ke profil.');
      return;
    }

    try {
      const res = await fetch('/api/hadiths/save-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: chosenItems,
          profileName: editingProfileStudio,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            hadiths: data.hadiths,
            profiles: data.profiles,
            generationHistory: data.generationHistory || prev.generationHistory,
          };
          pushAutoCloudSync(next, `Tambah Rekomendasi AI ke Profil ${editingProfileStudio}`);
          return next;
        });
        setDbProfileFilter(editingProfileStudio);
        setProfileRecommendedPreview(null);
        setEditingProfileStudio(null);
        notify(
          'success',
          `${chosenItems.length} hadis rekomendasi AI berhasil ditambahkan ke profil "${editingProfileStudio}"!`
        );
        return;
      }
    } catch {
      // ignore
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
          const next = {
            ...prev,
            hadiths: data.hadiths,
            profiles: data.profiles,
            generationHistory: data.generationHistory || prev.generationHistory,
          };
          pushAutoCloudSync(next, `Simpan Database ke Profil ${chosenProfile}`);
          return next;
        });
        setPreviewItems([]);
        setDuplicateMatches([]);
        setSaveProfileMode(chosenProfile);
        setNewProfileNameOnSave('');
        setDbProfileFilter(chosenProfile);
        notify(
          'success',
          `Seluruh draf berhasil disimpan ke profil database "${chosenProfile}" & disinkronkan dengan log.`
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
    setDuplicateMatches([]);
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
          const next = {
            ...prev,
            hadiths: data.hadiths,
            profiles: data.profiles,
            generationHistory: data.generationHistory || prev.generationHistory,
          };
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
          const next = {
            ...prev,
            hadiths: data.hadiths,
            profiles: data.profiles,
            generationHistory: data.generationHistory || prev.generationHistory,
          };
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
        if (asNew && Array.isArray(data.templates) && data.templates.length > 0) {
          const newest = data.templates[data.templates.length - 1];
          setSelectedTemplateId(newest.id);
          setTplName(newest.name);
        }
        notify('success', 'Format kirim berhasil disimpan & disinkronkan.');
        return;
      }
    } catch {
      // Static GitHub Pages fallback below
    }

    const newId = payload.id || `tpl-${Date.now()}`;
    setStore((prev) => {
      if (!prev) return prev;
      const newTpl: MessageTemplate = {
        id: newId,
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
    if (asNew) {
      setSelectedTemplateId(newId);
      setTplName(payload.name);
    }
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
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, templates: data.templates };
          pushAutoCloudSync(next, 'Hapus Format Kirim');
          return next;
        });
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

  async function handleSaveTemplateVariable(e: React.FormEvent) {
    e.preventDefault();
    const rawKey = varKeyInput.trim();
    const rawLabel = varLabelInput.trim();
    if (!rawKey || !rawLabel) {
      notify('error', 'Kode variabel (contoh: {salam}) dan nama label wajib diisi.');
      return;
    }
    const cleanSlug = rawKey
      .replace(/^\{+|\}+$/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    if (!cleanSlug) {
      notify('error', 'Kode variabel hanya boleh berisi huruf, angka, atau garis bawah (_).');
      return;
    }
    const formattedKey = `{${cleanSlug}}`;

    try {
      const res = await fetch('/api/template-variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingVarId || undefined,
          key: formattedKey,
          label: rawLabel,
          defaultValue: varDefaultValueInput,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, templateVariables: data.templateVariables };
          pushAutoCloudSync(next, `Simpan Variabel ${formattedKey}`);
          return next;
        });
        setEditingVarId(null);
        setVarKeyInput('');
        setVarLabelInput('');
        setVarDefaultValueInput('');
        notify('success', `Variabel ${formattedKey} (${rawLabel}) berhasil disimpan.`);
        return;
      }
    } catch {
      // Static fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const currentList =
        prev.templateVariables && prev.templateVariables.length > 0
          ? [...prev.templateVariables]
          : [...DEFAULT_TEMPLATE_VARIABLES];
      const existingIdx = currentList.findIndex(
        (v) => v.id === editingVarId || v.key === formattedKey
      );
      const newVar: TemplateVariableItem = {
        id: existingIdx >= 0 ? currentList[existingIdx].id : editingVarId || `var-${Date.now()}`,
        key: formattedKey,
        label: rawLabel,
        defaultValue: varDefaultValueInput,
        isSystem: existingIdx >= 0 ? currentList[existingIdx].isSystem : false,
      };
      if (existingIdx >= 0) {
        currentList[existingIdx] = newVar;
      } else {
        currentList.push(newVar);
      }
      const next = { ...prev, templateVariables: currentList };
      pushAutoCloudSync(next, `Simpan Variabel ${formattedKey}`);
      return next;
    });
    setEditingVarId(null);
    setVarKeyInput('');
    setVarLabelInput('');
    setVarDefaultValueInput('');
    notify('success', `Variabel ${formattedKey} (${rawLabel}) berhasil disimpan.`);
  }

  async function handleDeleteTemplateVariable(variable: TemplateVariableItem) {
    try {
      const res = await fetch(`/api/template-variables/${variable.id}`, { method: 'DELETE' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, templateVariables: data.templateVariables };
          pushAutoCloudSync(next, `Hapus Variabel ${variable.key}`);
          return next;
        });
        if (editingVarId === variable.id) {
          setEditingVarId(null);
          setVarKeyInput('');
          setVarLabelInput('');
          setVarDefaultValueInput('');
        }
        notify('success', `Variabel ${variable.key} dihapus.`);
        return;
      }
    } catch {
      // Static fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const currentList =
        prev.templateVariables && prev.templateVariables.length > 0
          ? prev.templateVariables
          : DEFAULT_TEMPLATE_VARIABLES;
      const nextList = currentList.filter((v) => v.id !== variable.id);
      const next = { ...prev, templateVariables: nextList };
      pushAutoCloudSync(next, `Hapus Variabel ${variable.key}`);
      return next;
    });
    if (editingVarId === variable.id) {
      setEditingVarId(null);
      setVarKeyInput('');
      setVarLabelInput('');
      setVarDefaultValueInput('');
    }
    notify('success', `Variabel ${variable.key} dihapus.`);
  }

  async function handleResetTemplateVariables() {
    try {
      const res = await fetch('/api/template-variables/reset', { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, templateVariables: data.templateVariables };
          pushAutoCloudSync(next, 'Reset Variabel Format');
          return next;
        });
        notify('success', 'Daftar variabel dikembalikan ke pengaturan awal.');
        return;
      }
    } catch {
      // Static fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const next = { ...prev, templateVariables: [...DEFAULT_TEMPLATE_VARIABLES] };
      pushAutoCloudSync(next, 'Reset Variabel Format');
      return next;
    });
    notify('success', 'Daftar variabel dikembalikan ke pengaturan awal.');
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
        const next = {
          ...prev,
          contacts: data.contacts,
          contactGroups: data.contactGroups || prev.contactGroups,
        };
        pushAutoCloudSync(next, `Simpan Kontak ${contactName}`);
        return next;
      });
    } catch {
      const cleanGroup = contactGroup.trim() || 'Jamaah Umum';
      const newContact: ContactItem = {
        id: editingContactId || `ct-${Date.now()}`,
        name: contactName.trim(),
        phone: normalizeLocalPhone(contactPhone),
        preference: contactPreference,
        groupTag: cleanGroup,
        isActive: true,
        notes: contactNotes.trim(),
      };
      setStore((prev) => {
        if (!prev) return prev;
        const exists = prev.contacts.some((c) => c.id === newContact.id);
        const nextContacts = exists
          ? prev.contacts.map((c) => (c.id === newContact.id ? newContact : c))
          : [...prev.contacts, newContact];
        const nextGroups = Array.from(
          new Set([...(prev.contactGroups || ['Jamaah Umum']), cleanGroup])
        );
        const next = { ...prev, contacts: nextContacts, contactGroups: nextGroups };
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

  async function handleAddContactGroup(e: React.FormEvent) {
    e.preventDefault();
    const grpName = newContactGroupInput.trim();
    if (!grpName) {
      notify('error', 'Ketik nama grup kontak baru terlebih dahulu.');
      return;
    }
    try {
      const res = await fetch('/api/contact-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: grpName }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, contactGroups: data.contactGroups };
          pushAutoCloudSync(next, `Tambah Grup Kontak ${grpName}`);
          return next;
        });
        setNewContactGroupInput('');
        setContactGroup(grpName);
        setBulkTargetGroup(grpName);
        notify('success', `Grup kontak "${grpName}" berhasil ditambahkan!`);
        return;
      }
    } catch {
      // Static fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const existing = prev.contactGroups || ['Jamaah Umum'];
      const nextGroups = existing.includes(grpName) ? existing : [...existing, grpName];
      const next = { ...prev, contactGroups: nextGroups };
      pushAutoCloudSync(next, `Tambah Grup Kontak ${grpName}`);
      return next;
    });
    setNewContactGroupInput('');
    setContactGroup(grpName);
    setBulkTargetGroup(grpName);
    notify('success', `Grup kontak "${grpName}" berhasil ditambahkan!`);
  }

  async function handleRenameContactGroupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!renamingContactGroup || !renamingContactGroup.newName.trim()) return;
    const oldName = renamingContactGroup.oldName;
    const newName = renamingContactGroup.newName.trim();
    try {
      const res = await fetch('/api/contact-groups/rename', {
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
            contacts: data.contacts,
            contactGroups: data.contactGroups,
            projects: data.projects || prev.projects,
          };
          pushAutoCloudSync(next, `Ubah Grup Kontak ${oldName} -> ${newName}`);
          return next;
        });
        if (contactGroupFilter === oldName) setContactGroupFilter(newName);
        if (contactGroup === oldName) setContactGroup(newName);
        setRenamingContactGroup(null);
        notify('success', `Nama grup "${oldName}" berhasil diubah menjadi "${newName}".`);
        return;
      }
    } catch {
      // Static fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const nextContacts = prev.contacts.map((c) =>
        (c.groupTag || 'Jamaah Umum').trim() === oldName ? { ...c, groupTag: newName } : c
      );
      const nextGroups = Array.from(
        new Set(
          (prev.contactGroups || ['Jamaah Umum']).map((g) => (g === oldName ? newName : g))
        )
      );
      const next = { ...prev, contacts: nextContacts, contactGroups: nextGroups };
      pushAutoCloudSync(next, `Ubah Grup Kontak ${oldName} -> ${newName}`);
      return next;
    });
    if (contactGroupFilter === oldName) setContactGroupFilter(newName);
    if (contactGroup === oldName) setContactGroup(newName);
    setRenamingContactGroup(null);
    notify('success', `Nama grup "${oldName}" berhasil diubah menjadi "${newName}".`);
  }

  async function handleDeleteContactGroup(groupName: string) {
    if (groupName === 'Jamaah Umum') {
      notify('error', 'Grup "Jamaah Umum" adalah grup dasar dan tidak dapat dihapus.');
      return;
    }
    try {
      const res = await fetch(`/api/contact-groups/${encodeURIComponent(groupName)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fallbackGroup: 'Jamaah Umum', deleteContacts: false }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            contacts: data.contacts,
            contactGroups: data.contactGroups,
          };
          pushAutoCloudSync(next, `Hapus Grup Kontak ${groupName}`);
          return next;
        });
        if (contactGroupFilter === groupName) setContactGroupFilter('all');
        notify(
          'success',
          `Grup "${groupName}" dihapus. Kontak di dalamnya dipindahkan ke "Jamaah Umum".`
        );
        return;
      }
    } catch {
      // Static fallback below
    }

    setStore((prev) => {
      if (!prev) return prev;
      const nextContacts = prev.contacts.map((c) =>
        (c.groupTag || 'Jamaah Umum').trim() === groupName
          ? { ...c, groupTag: 'Jamaah Umum' }
          : c
      );
      const nextGroups = (prev.contactGroups || []).filter((g) => g !== groupName);
      const next = { ...prev, contacts: nextContacts, contactGroups: nextGroups };
      pushAutoCloudSync(next, `Hapus Grup Kontak ${groupName}`);
      return next;
    });
    if (contactGroupFilter === groupName) setContactGroupFilter('all');
    notify(
      'success',
      `Grup "${groupName}" dihapus. Kontak di dalamnya dipindahkan ke "Jamaah Umum".`
    );
  }

  async function handleBulkContactAction(
    action: 'move_group' | 'change_preference' | 'delete' | 'toggle_active',
    options?: {
      targetGroup?: string;
      targetPreference?: 'singkat' | 'detail';
      targetActive?: boolean;
    }
  ) {
    if (selectedContactIds.length === 0) {
      notify('error', 'Centang minimal 1 kontak jamaah terlebih dahulu.');
      return;
    }
    const targetGroup =
      options?.targetGroup === '__NEW__'
        ? bulkNewGroupInput.trim()
        : options?.targetGroup || bulkTargetGroup;

    if (action === 'move_group' && !targetGroup) {
      notify('error', 'Pilih atau ketik nama grup tujuan terlebih dahulu.');
      return;
    }

    try {
      const res = await fetch('/api/contacts/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactIds: selectedContactIds,
          action,
          targetGroup,
          targetPreference: options?.targetPreference,
          targetActive: options?.targetActive,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            contacts: data.contacts,
            contactGroups: data.contactGroups || prev.contactGroups,
          };
          pushAutoCloudSync(next, `Aksi Massal Kontak (${action})`);
          return next;
        });
        const count = selectedContactIds.length;
        if (action === 'delete') {
          setSelectedContactIds([]);
          notify('success', `${count} kontak terpilih berhasil dihapus.`);
        } else if (action === 'move_group') {
          setBulkNewGroupInput('');
          setBulkTargetGroup(targetGroup);
          notify('success', `${count} kontak berhasil dipindahkan ke grup "${targetGroup}"!`);
        } else if (action === 'change_preference') {
          notify(
            'success',
            `${count} kontak berhasil diubah kategorinya ke Hadis ${
              options?.targetPreference === 'singkat' ? 'Singkat' : 'Detail'
            }.`
          );
        } else if (action === 'toggle_active') {
          notify(
            'success',
            `Status aktif ${count} kontak berhasil diperbarui.`
          );
        }
        return;
      }
    } catch {
      // Static fallback below
    }

    const idSet = new Set(selectedContactIds);
    setStore((prev) => {
      if (!prev) return prev;
      let nextContacts = [...prev.contacts];
      let nextGroups = [...(prev.contactGroups || ['Jamaah Umum'])];
      if (action === 'move_group' && targetGroup) {
        nextContacts = nextContacts.map((c) =>
          idSet.has(c.id) ? { ...c, groupTag: targetGroup } : c
        );
        if (!nextGroups.includes(targetGroup)) nextGroups.push(targetGroup);
      } else if (action === 'change_preference' && options?.targetPreference) {
        nextContacts = nextContacts.map((c) =>
          idSet.has(c.id) ? { ...c, preference: options.targetPreference! } : c
        );
      } else if (action === 'toggle_active') {
        nextContacts = nextContacts.map((c) =>
          idSet.has(c.id) ? { ...c, isActive: Boolean(options?.targetActive) } : c
        );
      } else if (action === 'delete') {
        nextContacts = nextContacts.filter((c) => !idSet.has(c.id));
      }
      const next = { ...prev, contacts: nextContacts, contactGroups: nextGroups };
      pushAutoCloudSync(next, `Aksi Massal Kontak (${action})`);
      return next;
    });

    const count = selectedContactIds.length;
    if (action === 'delete') {
      setSelectedContactIds([]);
      notify('success', `${count} kontak terpilih berhasil dihapus.`);
    } else if (action === 'move_group') {
      setBulkNewGroupInput('');
      setBulkTargetGroup(targetGroup);
      notify('success', `${count} kontak berhasil dipindahkan ke grup "${targetGroup}"!`);
    } else if (action === 'change_preference') {
      notify(
        'success',
        `${count} kontak berhasil diubah kategorinya ke Hadis ${
          options?.targetPreference === 'singkat' ? 'Singkat' : 'Detail'
        }.`
      );
    }
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
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, contacts: data.contacts };
          pushAutoCloudSync(next, `Ubah Kategori Kontak ${c.name}`);
          return next;
        });
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
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, contacts: data.contacts };
          pushAutoCloudSync(next, 'Hapus Kontak');
          return next;
        });
        setSelectedContactIds((prev) => prev.filter((item) => item !== id));
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
    setSelectedContactIds((prev) => prev.filter((item) => item !== id));
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
        setStore((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            contacts: data.contacts,
            contactGroups: data.contactGroups || prev.contactGroups,
          };
          pushAutoCloudSync(next, 'Impor Massal Kontak');
          return next;
        });
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
    const freq = editingProject.scheduleFrequency || 'daily';
    const normalizedDays =
      freq === 'daily'
        ? [0, 1, 2, 3, 4, 5, 6]
        : Array.isArray(editingProject.scheduleDays) && editingProject.scheduleDays.length > 0
        ? editingProject.scheduleDays
        : [];
    if (freq !== 'daily' && normalizedDays.length === 0) {
      notify('error', 'Centang minimal 1 hari pengiriman untuk jadwal projek ini.');
      return;
    }
    const targetMode: 'all' | 'groups' | 'contacts' =
      editingProject.targetMode === 'groups' || editingProject.targetMode === 'contacts'
        ? editingProject.targetMode
        : 'all';
    const targetGroups = Array.isArray(editingProject.targetGroups)
      ? editingProject.targetGroups
      : [];
    const targetContactIds = Array.isArray(editingProject.targetContactIds)
      ? editingProject.targetContactIds
      : [];

    if (targetMode === 'groups' && targetGroups.length === 0) {
      notify('error', 'Pilih minimal 1 grup kontak untuk projek ini.');
      return;
    }
    if (targetMode === 'contacts' && targetContactIds.length === 0) {
      notify('error', 'Centang minimal 1 kontak penerima untuk projek ini.');
      return;
    }

    const templateMode: 'auto_contact' | 'single_template' =
      editingProject.templateMode === 'single_template' ? 'single_template' : 'auto_contact';
    const templateId =
      editingProject.templateId || store?.templates?.[0]?.id || 'tpl-lengkap-default';
    const detailTemplateId =
      editingProject.detailTemplateId ||
      store?.templates.find((t) => t.category === 'lengkap' && t.isDefault)?.id ||
      store?.templates.find((t) => t.category === 'lengkap')?.id ||
      store?.templates?.[0]?.id ||
      'tpl-lengkap-default';
    const singkatTemplateId =
      editingProject.singkatTemplateId ||
      store?.templates.find((t) => t.category === 'singkat' && t.isDefault)?.id ||
      store?.templates.find((t) => t.category === 'singkat')?.id ||
      store?.templates?.[1]?.id ||
      'tpl-singkat-default';

    const projectPayload = {
      ...editingProject,
      scheduleFrequency: freq,
      scheduleDays: normalizedDays,
      targetMode,
      targetGroups,
      targetContactIds,
      templateMode,
      templateId,
      detailTemplateId,
      singkatTemplateId,
    };
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectPayload),
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
        timezone: editingProject.timezone || 'WITA',
        scheduleFrequency: freq,
        scheduleDays: normalizedDays,
        targetMode,
        targetGroups,
        targetContactIds,
        templateMode,
        templateId,
        detailTemplateId,
        singkatTemplateId,
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
    action:
      | 'pause'
      | 'resume'
      | 'stop'
      | 'run_now'
      | 'next_hadith'
      | 'prev_hadith'
      | 'set_hadith',
    options?: { hadithId?: string; targetIndex?: number; forceResendAll?: boolean }
  ) {
    try {
      const res = await fetch(`/api/projects/${projId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...options }),
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
        const labelMap: Record<string, string> = {
          pause: 'Projek dijeda sementara (Paused).',
          resume: 'Projek dilanjutkan kembali (Running).',
          stop: 'Projek dihentikan & antrean dibatalkan (Stopped).',
          run_now: 'Projek langsung dijalankan sekarang dengan interval acak!',
          next_hadith: 'Materi selanjutnya berhasil dipilih.',
          prev_hadith: 'Materi sebelumnya berhasil dipilih.',
          set_hadith: 'Materi hadis berhasil disetel.',
        };
        if (data.message) {
          notify(data.allAlreadySentToday ? 'error' : 'success', data.message);
        } else {
          notify('success', labelMap[action] || 'Aksi berhasil diproses.');
        }
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
        if (action === 'next_hadith') {
          const pool = prev.hadiths.filter((h) =>
            !p.selectedProfiles || p.selectedProfiles.length === 0 || p.selectedProfiles.includes(h.profileName || 'Belum Terkategori')
          );
          const poolLen = pool.length > 0 ? pool.length : prev.hadiths.length;
          return { ...p, currentDatabaseIndex: ((p.currentDatabaseIndex || 0) + 1) % poolLen };
        }
        if (action === 'prev_hadith') {
          const pool = prev.hadiths.filter((h) =>
            !p.selectedProfiles || p.selectedProfiles.length === 0 || p.selectedProfiles.includes(h.profileName || 'Belum Terkategori')
          );
          const poolLen = pool.length > 0 ? pool.length : prev.hadiths.length;
          return { ...p, currentDatabaseIndex: ((p.currentDatabaseIndex || 0) - 1 + poolLen) % poolLen };
        }
        if (action === 'set_hadith' && options?.targetIndex !== undefined) {
          return { ...p, currentDatabaseIndex: options.targetIndex };
        }
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
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, projects: data.projects };
          pushAutoCloudSync(next, 'Hapus Projek');
          return next;
        });
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
    const targetPhone = normalizeLocalPhone(
      adminPhoneDraft || store?.gatewaySettings.adminPhone || '6281200000000'
    );
    try {
      const res = await fetch('/api/gateway/confirm-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.waState) setWaState(data.waState);
        if (data.gatewaySettings) {
          setStore((prev) => {
            if (!prev) return prev;
            const next = { ...prev, gatewaySettings: data.gatewaySettings };
            pushAutoCloudSync(next, 'Cek Sesi WA Admin');
            return next;
          });
        }
        if (data.ok && data.waState?.realSocketConnected) {
          notify(
            'success',
            `Sesi WhatsApp (${data.waState.connectedPhone || targetPhone}) terverifikasi TERHUBUNG NYATA dan siap mengirim pesan!`
          );
        } else {
          notify(
            'error',
            data.error ||
              'Sesi WhatsApp belum terdeteksi tertaut di server ini. Silakan scan QR Code atau masukkan 8-Digit Pairing Code di aplikasi WhatsApp Anda hingga status otomatis berubah menjadi TERHUBUNG.'
          );
        }
        return;
      }
    } catch {
      // Static fallback
    }
    notify(
      'error',
      'Tidak dapat memverifikasi sesi soket WhatsApp. Pastikan Anda telah memasukkan 8-Digit Pairing Code atau Scan QR di WhatsApp.'
    );
  }

  async function handleDisconnectBaileys() {
    try {
      localStorage.removeItem('bdi_wa_session_cache');
      localStorage.removeItem('bdi_wa_auth_bundle');
    } catch {
      // ignore
    }
    try {
      const res = await fetch('/api/gateway/disconnect-baileys', { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setWaState(data.waState);
        setStore((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            gatewaySettings: {
              ...prev.gatewaySettings,
              sessionLinked: false,
              linkedPhone: undefined,
            },
            waAuthSnapshot: undefined,
          };
          pushAutoCloudSync(next, 'Putuskan Sesi WA Admin');
          return next;
        });
        notify('success', 'Sesi WA Headless diputuskan.');
        return;
      }
    } catch {
      // ignore
    }
    setWaState({
      status: 'disconnected',
      realSocketConnected: false,
      qrDataUrl: null,
      pairingCode: null,
      connectedPhone: null,
      lastError: null,
    });
    notify('success', 'Sesi WA Headless diputuskan.');
  }

  async function handleReconnectBaileys() {
    try {
      // If client has cached auth bundle and server has no credentials, restore it first
      const rawBundle = localStorage.getItem('bdi_wa_auth_bundle');
      if (rawBundle && (!waState.hasSavedCreds || !waState.realSocketConnected)) {
        try {
          const parsed = JSON.parse(rawBundle);
          if (parsed && parsed['creds.json']) {
            await fetch('/api/gateway/restore-auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bundle: parsed }),
            });
          }
        } catch {
          // ignore
        }
      }

      const res = await fetch('/api/gateway/reconnect', { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.waState) setWaState(data.waState);
        notify(
          'success',
          'Permintaan menyambungkan ulang sesi WhatsApp telah dikirim ke server. Tunggu beberapa detik...'
        );
        return;
      }
    } catch {
      // ignore
    }
    notify('error', 'Gagal menghubungi server untuk menyambungkan ulang sesi WhatsApp.');
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
          if (data.result?.gatewayUsed === 'simulation') {
            notify(
              'error',
              `PERHATIAN: Pesan hanya tercatat dalam MODE SIMULASI (TIDAK dikirim ke WhatsApp asli). Matikan Mode Simulasi dan tautkan WA Anda dengan 8-Digit Pairing Code / Scan QR!`
            );
          } else {
            notify(
              'success',
              `BERHASIL TERKIRIM NYATA ke WhatsApp (${targetPhone}) melalui ${
                data.result?.gatewayUsed === 'webhook' ? 'Webhook API' : 'Soket WhatsApp Baileys'
              }! Silakan cek aplikasi WhatsApp Anda.`
            );
          }
        } else {
          notify(
            'error',
            data.result?.error ||
              'Gagal mengirim pesan ke WhatsApp. Sesi WA di server ini belum tertaut — silakan tautkan via 8-Digit Pairing Code (1 HP) atau Scan QR.'
          );
        }
        return;
      }
    } catch {
      // ignore
    }
    notify(
      'error',
      'Server backend WhatsApp tidak terjangkau dari halaman statis ini. Buka URL aplikasi utama untuk mengirim pesan WhatsApp.'
    );
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

  async function handleDeleteSingleLog(logId: string) {
    try {
      const res = await fetch(`/api/logs/${logId}`, { method: 'DELETE' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            deliveryLogs: data.deliveryLogs,
            projects: data.projects || prev.projects,
          };
          pushAutoCloudSync(next, 'Hapus Log Pesan');
          return next;
        });
        notify('success', 'Log pesan berhasil dihapus.');
        return;
      }
    } catch {
      // fallback
    }
    setStore((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        deliveryLogs: prev.deliveryLogs.filter((l) => l.id !== logId),
      };
      pushAutoCloudSync(next, 'Hapus Log Pesan');
      return next;
    });
    notify('success', 'Log pesan dihapus.');
  }

  async function handleClearProjectLogs(
    projId: string,
    scope: 'messages' | 'history' | 'all' = 'messages',
    targetDate?: string
  ) {
    const label = targetDate
      ? `log tanggal ${targetDate}`
      : scope === 'history'
      ? 'riwayat eksekusi projek'
      : scope === 'all'
      ? 'seluruh log & riwayat projek'
      : 'semua log pesan projek';

    try {
      const res = await fetch(`/api/projects/${projId}/logs/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, targetDate }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            deliveryLogs: data.deliveryLogs,
            projectHistory: data.projectHistory || prev.projectHistory,
            projects: data.projects || prev.projects,
          };
          pushAutoCloudSync(next, `Hapus Log Projek (${scope})`);
          return next;
        });
        notify('success', `Berhasil menghapus ${label}.`);
        return;
      }
    } catch {
      // fallback
    }

    setStore((prev) => {
      if (!prev) return prev;
      let nextLogs = prev.deliveryLogs;
      let nextHistory = prev.projectHistory || [];

      if (scope === 'messages' || scope === 'all') {
        if (targetDate) {
          nextLogs = nextLogs.filter(
            (l) => !(l.projectId === projId && l.timestamp && l.timestamp.slice(0, 10) === targetDate)
          );
        } else {
          nextLogs = nextLogs.filter((l) => l.projectId !== projId);
        }
      }

      if (scope === 'history' || scope === 'all') {
        if (targetDate) {
          nextHistory = nextHistory.filter(
            (h) => !(h.projectId === projId && h.triggeredAt && h.triggeredAt.slice(0, 10) === targetDate)
          );
        } else {
          nextHistory = nextHistory.filter((h) => h.projectId !== projId);
        }
      }

      const next = {
        ...prev,
        deliveryLogs: nextLogs,
        projectHistory: nextHistory,
      };
      pushAutoCloudSync(next, `Hapus Log Projek (${scope})`);
      return next;
    });
    notify('success', `Berhasil menghapus ${label}.`);
  }

  async function handleDeleteSingleProjectHistory(projId: string, histId: string) {
    try {
      const res = await fetch(`/api/projects/${projId}/history/${histId}`, { method: 'DELETE' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStore((prev) => {
          if (!prev) return prev;
          const next = { ...prev, projectHistory: data.projectHistory };
          pushAutoCloudSync(next, 'Hapus Riwayat Projek');
          return next;
        });
        notify('success', 'Riwayat aktivitas projek dihapus.');
        return;
      }
    } catch {
      // fallback
    }
    setStore((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        projectHistory: (prev.projectHistory || []).filter((h) => h.id !== histId),
      };
      pushAutoCloudSync(next, 'Hapus Riwayat Projek');
      return next;
    });
    notify('success', 'Riwayat aktivitas projek dihapus.');
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
      const info = await saveBackupToGoogleDrive(store, backupLabelInput, { force: true });
      setDriveBackupInfo(info);
      setDriveConnected(true);
      setCloudInfo(
        `Tersimpan di Google Drive folder "${info.folderName}" (${info.modifiedTime || 'Baru saja'})`
      );
      notify(
        'success',
        `Backup berhasil disimpan ke Google Drive pada folder "${info.folderName}" (${info.fileName}).`
      );
    } catch (err: any) {
      notify('error', err?.message || 'Gagal mencadangkan ke Google Drive.');
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleRestoreContactsFromDrive() {
    setCloudBusy(true);
    try {
      const driveData = await loadBackupFromGoogleDrive();
      const count = driveData?.store.contacts?.length || 0;
      if (driveData && count > 0) {
        const applied = await applyRestoredStoreBothServerAndClient(driveData.store);
        setDriveBackupInfo(driveData.info);
        setDriveConnected(true);
        notify(
          'success',
          `${applied.contacts?.length || 0} kontak dipulihkan dari Google Drive.`
        );
      } else {
        notify('error', 'Tidak ada kontak di backup Google Drive.');
      }
    } catch (err: any) {
      notify('error', err?.message || 'Gagal menarik kontak dari Google Drive.');
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleGoogleAccountRestore() {
    setCloudBusy(true);
    try {
      let restoredStore: AppStoreData | null = null;
      let restoredSourceLabel = '';

      const driveData = await loadBackupFromGoogleDrive();
      if (driveData) {
        restoredStore = driveData.store;
        setDriveBackupInfo(driveData.info);
        setDriveConnected(true);
        restoredSourceLabel = `Folder Google Drive "${driveData.info.folderName}" (${driveData.info.modifiedTime || ''})`;
      }

      if (!restoredStore) {
        notify('error', 'Belum ada file backup ditemukan di Google Drive Anda.');
        return;
      }

      const applied = await applyRestoredStoreBothServerAndClient(restoredStore);
      setCloudInfo(`Dipulihkan dari ${restoredSourceLabel}`);
      notify(
        'success',
        `Restore berhasil dari ${restoredSourceLabel}: ${applied.hadiths?.length || 0} materi & ${applied.contacts?.length || 0} kontak dipulihkan.`
      );
    } catch (err: any) {
      notify('error', err?.message || 'Gagal memulihkan data dari Google Drive.');
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
  const activeAccount = googleUser
    ? {
        email: googleUser.email || 'admin@bdi.id',
        displayName: googleUser.displayName || 'Admin BDI',
        uid: googleUser.uid,
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
              Masuk dengan <strong>Akun Google</strong> untuk menghubungkan Generator AI Hadis Shahih serta backup &amp; sinkronisasi otomatis via Google Drive.
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
                <strong>Terkoneksi ke AI &amp; Cloud:</strong> Otomatis mengatur koneksi ke Gemini AI &amp; backup Google Drive.
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
          <p className="text-xs text-slate-600">Memuat backup Google Drive &amp; database...</p>
        </div>
      </div>
    );
  }

  const allProfiles =
    store.profiles && store.profiles.length > 0
      ? store.profiles
      : ['Oktober', 'Belum Terkategori'];

  const allContactGroups: string[] = Array.from(
    new Set([
      'Jamaah Umum',
      ...(store.contactGroups || []).map((g) => String(g || '').trim()).filter(Boolean),
      ...(store.contacts || []).map((c) => (c.groupTag || 'Jamaah Umum').trim()).filter(Boolean),
    ])
  );

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
      (h.sourceBookName || '').toLowerCase().includes(q) ||
      (h.hadithDegree || '').toLowerCase().includes(q) ||
      h.categoryTopic.toLowerCase().includes(q) ||
      itemProf.toLowerCase().includes(q)
    );
  });

  const HADITHS_PER_PAGE = 5;
  const totalPreviewPages = Math.max(1, Math.ceil(previewItems.length / HADITHS_PER_PAGE));
  const safePreviewPage = Math.min(previewPage, totalPreviewPages);
  const paginatedPreviewItems = previewItems.slice(
    (safePreviewPage - 1) * HADITHS_PER_PAGE,
    safePreviewPage * HADITHS_PER_PAGE
  );

  const totalDbPages = Math.max(1, Math.ceil(filteredHadiths.length / HADITHS_PER_PAGE));
  const safeDbPage = Math.min(dbPage, totalDbPages);
  const paginatedDbHadiths = filteredHadiths.slice(
    (safeDbPage - 1) * HADITHS_PER_PAGE,
    safeDbPage * HADITHS_PER_PAGE
  );

  const filteredContacts = store.contacts.filter((c) => {
    const grp = (c.groupTag || 'Jamaah Umum').trim();
    if (contactGroupFilter !== 'all' && grp !== contactGroupFilter) return false;
    if (contactPrefFilter !== 'all' && c.preference !== contactPrefFilter) return false;
    if (!contactSearch.trim()) return true;
    const q = contactSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      grp.toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
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
                (waState.status === 'connected' || waState.hasSavedCreds || store?.gatewaySettings?.sessionLinked) && waState.status !== 'disconnected'
                  ? 'text-emerald-700'
                  : store?.gatewaySettings?.activeMode === 'webhook'
                  ? 'text-blue-700'
                  : waState.status === 'connecting'
                  ? 'text-amber-700'
                  : 'text-red-700'
              }
            >
              {(waState.status === 'connected' || waState.hasSavedCreds || store?.gatewaySettings?.sessionLinked) && waState.status !== 'disconnected'
                ? `● Terhubung (${waState.connectedPhone || store?.gatewaySettings?.linkedPhone || store?.gatewaySettings?.adminPhone || 'WA Server'})`
                : store?.gatewaySettings?.activeMode === 'webhook'
                ? '● Mode Webhook API'
                : waState.status === 'connecting'
                ? '○ Menyambungkan ke WA...'
                : '✕ Belum Tertaut (Perlu Pairing/QR)'}
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
          MODAL PILIH NO HADIS / LOMPAT HADIS TERTENTU UNTUK PROJEK
         ============================================================ */}
      {hadithPickerProject && (() => {
        const proj = hadithPickerProject;
        const candidatePool = store.hadiths.filter((h) =>
          !proj.selectedProfiles ||
          proj.selectedProfiles.length === 0 ||
          proj.selectedProfiles.includes(h.profileName || 'Belum Terkategori')
        );
        const pool = candidatePool.length > 0 ? candidatePool : store.hadiths;
        const filteredHadiths = pool.filter((h, idx) => {
          if (!hadithPickerSearch.trim()) return true;
          const q = hadithPickerSearch.toLowerCase();
          const noStr = String(idx + 1);
          return (
            noStr.includes(q) ||
            h.title.toLowerCase().includes(q) ||
            (h.sourceBook || '').toLowerCase().includes(q) ||
            (h.hadithNumber || '').toLowerCase().includes(q) ||
            (h.profileName || '').toLowerCase().includes(q)
          );
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-700" />
                    <span>Pilih No Hadis: {proj.name}</span>
                  </h3>
                  <p className="text-xs text-slate-600">
                    Pilih hadis spesifik dalam database untuk dijadikan materi berikutnya atau langsung dikirim sekarang.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHadithPickerProject(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search & Direct Number Jump */}
              <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={hadithPickerSearch}
                    onChange={(e) => setHadithPickerSearch(e.target.value)}
                    placeholder="Cari judul hadis, nomor, atau perawi..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">Lompat ke No:</span>
                  <input
                    type="number"
                    min={1}
                    max={pool.length}
                    value={jumpHadithNumberInput}
                    onChange={(e) => setJumpHadithNumberInput(e.target.value)}
                    placeholder="1"
                    className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-center"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const num = parseInt(jumpHadithNumberInput, 10);
                      if (!isNaN(num) && num >= 1 && num <= pool.length) {
                        handleProjectAction(proj.id, 'set_hadith', { targetIndex: num - 1 });
                        setHadithPickerProject(null);
                      } else {
                        notify('error', `Nomor hadis harus antara 1 sampai ${pool.length}.`);
                      }
                    }}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shrink-0"
                  >
                    Terapkan
                  </button>
                </div>
              </div>

              {/* List of Hadiths */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-3 space-y-1">
                {filteredHadiths.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Tidak ada hadis yang cocok dengan kata kunci pencarian.
                  </div>
                ) : (
                  filteredHadiths.map((hadith) => {
                    const actualIndex = pool.findIndex((h) => h.id === hadith.id);
                    const isActive = (proj.currentDatabaseIndex || 0) === actualIndex;

                    return (
                      <div
                        key={hadith.id}
                        className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isActive
                            ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-600/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono-num font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                              No. {actualIndex + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              {hadith.title}
                            </span>
                            {isActive && (
                              <span className="text-[10px] font-bold bg-emerald-700 text-white px-2 py-0.5 rounded-full">
                                ✓ Aktif Terpilih
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {hadith.sourceBook || 'Hadis'} No. {hadith.hadithNumber || '-'} · Profil: {hadith.profileName || 'Umum'}
                          </p>
                          {hadith.shortSummary && (
                            <p className="text-xs text-slate-600 line-clamp-2 italic">
                              &ldquo;{hadith.shortSummary}&rdquo;
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              handleProjectAction(proj.id, 'set_hadith', { hadithId: hadith.id, targetIndex: actualIndex });
                              setHadithPickerProject(null);
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 shadow-xs"
                          >
                            Pilih Urutan Ini
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleProjectAction(proj.id, 'run_now', { hadithId: hadith.id, forceResendAll: false });
                              setHadithPickerProject(null);
                            }}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>Kirim Ini Sekarang</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
                <span>Total Database Tersedia: <strong>{pool.length}</strong> materi</span>
                <button
                  type="button"
                  onClick={() => setHadithPickerProject(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                      <strong>Backup Otomatis Google Drive:</strong> Seluruh database tersimpan aman di folder Google Drive akun Anda dan otomatis diperbarui maksimal 1x per 2 menit saat ada perubahan data.
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
          MODAL PREVIEW HADIS (UNTUK MENAMPILKAN HADIS SEDANG & PANJANG / DETAIL)
         ============================================================ */}
      {activePreviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                  <span>
                    Profil: <strong>{activePreviewItem.profileName || 'Belum Terkategori'}</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Perawi: <strong>{activePreviewItem.sourceBook}</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Kitab:{' '}
                    <strong>
                      {activePreviewItem.sourceBookName || activePreviewItem.sourceBook}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num font-bold text-emerald-800">
                    No. {activePreviewItem.hadithNumber}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-semibold rounded">
                    Derajat: {activePreviewItem.hadithDegree || 'Shahih'}
                  </span>
                </div>
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
                Tampilan Lengkap Hadis ({(activePreviewItem.hadithLength || 'sedang').toUpperCase()}):
              </span>
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-300">
                <button
                  type="button"
                  onClick={() => setActivePreviewMode('detail')}
                  className={`min-h-[36px] px-3.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    activePreviewMode === 'detail'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tampilan Lengkap (Sedang / Panjang)
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreviewMode('singkat')}
                  className={`min-h-[36px] px-3.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    activePreviewMode === 'singkat'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Simulasi Format Singkat
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
                      &ldquo;{activePreviewItem.shortSummary || activePreviewItem.translationText}&rdquo;
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
                        ensureCompleteSystemVariables(store.templateVariables),
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
                      <p className="font-bold text-slate-900">
                        Terjemahan Resmi ({activePreviewItem.sourceBookName || activePreviewItem.sourceBook}):
                      </p>
                      <p className="text-slate-700 mt-0.5">
                        &ldquo;{activePreviewItem.translationText}&rdquo;
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Perawi: <strong>{activePreviewItem.sourceBook}</strong> · Kitab Sumber:{' '}
                        <strong>
                          {activePreviewItem.sourceBookName || activePreviewItem.sourceBook}
                        </strong>{' '}
                        · No. Hadis: <strong>{activePreviewItem.hadithNumber}</strong> · Derajat:{' '}
                        <strong className="text-emerald-800">
                          {activePreviewItem.hadithDegree || 'Shahih'}
                        </strong>
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
                        ensureCompleteSystemVariables(store.templateVariables),
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
                    Perawi ({'{perawi}'})
                  </label>
                  <input
                    type="text"
                    value={editingHadith.sourceBook}
                    onChange={(e) =>
                      setEditingHadith({ ...editingHadith, sourceBook: e.target.value })
                    }
                    placeholder="Contoh: HR. Bukhari"
                    className="w-full min-h-[40px] px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sumber Kitab ({'{kitab}'})
                  </label>
                  <input
                    type="text"
                    value={editingHadith.sourceBookName || ''}
                    onChange={(e) =>
                      setEditingHadith({ ...editingHadith, sourceBookName: e.target.value })
                    }
                    placeholder="Contoh: Shahih Al-Bukhari"
                    className="w-full min-h-[40px] px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor Hadis Kitab ({'{nomor_hadis}'})
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
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Derajat Hadis ({'{derajat_hadis}'})
                  </label>
                  <input
                    type="text"
                    value={editingHadith.hadithDegree || 'Shahih'}
                    onChange={(e) =>
                      setEditingHadith({ ...editingHadith, hadithDegree: e.target.value })
                    }
                    placeholder="Contoh: Shahih / Hasan Shahih"
                    className="w-full min-h-[40px] px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Panjang Hadis
                  </label>
                  <select
                    value={editingHadith.hadithLength || 'singkat'}
                    onChange={(e) =>
                      setEditingHadith({
                        ...editingHadith,
                        hadithLength: e.target.value as 'singkat' | 'sedang' | 'panjang',
                      })
                    }
                    className="w-full min-h-[40px] px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="singkat">Singkat (Tampil Langsung)</option>
                    <option value="sedang">Sedang (Ada Tombol Preview)</option>
                    <option value="panjang">Panjang (Ada Tombol Preview)</option>
                  </select>
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
                  Terjemah Resmi Sumber Kitab / Kemenag
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
                  Ringkasan Singkat (Ditampilkan pada Daftar Utama)
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

      {/* ============================================================
          MODAL LOG HADIS TER-GENERATE & SINKRONISASI DATABASE
         ============================================================ */}
      {showGenHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Log Hadis Ter-Generate &amp; Sinkronisasi Anti-Duplikat
                </h3>
                <p className="text-xs text-slate-600">
                  Seluruh hadis/ayat yang pernah di-generate dicatat otomatis dan disinkronkan dengan database agar AI tidak mengulang hadis yang sama.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGenHistoryModal(false)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={genHistorySearch}
                  onChange={(e) => setGenHistorySearch(e.target.value)}
                  placeholder="Cari perawi, nomor hadis, atau judul di log..."
                  className="w-full min-h-[38px] pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSyncGenerationHistory(false)}
                  className="min-h-[38px] px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-semibold rounded-lg flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sinkronkan dengan Database</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSyncGenerationHistory(true)}
                  className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                  title="Hapus dari log untuk hadis yang sudah tidak ada di database aktif"
                >
                  Reset Log ke Isi Database Saat Ini
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-2.5 flex-1">
              {(() => {
                const fullLog = getSyncedGenerationLog(store);
                const filteredLog = fullLog.filter((g) => {
                  if (!genHistorySearch.trim()) return true;
                  const q = genHistorySearch.toLowerCase();
                  return (
                    g.title.toLowerCase().includes(q) ||
                    g.sourceBook.toLowerCase().includes(q) ||
                    g.hadithNumber.toLowerCase().includes(q) ||
                    (g.profileName || '').toLowerCase().includes(q)
                  );
                });

                if (filteredLog.length === 0) {
                  return (
                    <div className="text-center py-8 text-xs text-slate-500">
                      Belum ada riwayat log hadis yang cocok.
                    </div>
                  );
                }

                return filteredLog.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-bold text-slate-900">{entry.sourceBook}</span>
                        <span className="font-mono-num font-bold text-emerald-800">
                          No. {entry.hadithNumber}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600">
                          Profil: <strong>{entry.profileName || 'Belum Terkategori'}</strong>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            entry.inDatabase
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {entry.inDatabase
                            ? 'Tersimpan di Database Aktif'
                            : 'Riwayat Pernah Di-generate'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 truncate">{entry.title}</p>
                    </div>

                    {!entry.inDatabase && (
                      <button
                        type="button"
                        onClick={() => handleDeleteGenerationLogItem(entry.id)}
                        className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-red-50 hover:text-red-700 text-slate-700 rounded text-[11px] font-semibold shrink-0 self-start sm:self-center"
                      >
                        Izinkan Generate Ulang
                      </button>
                    )}
                  </div>
                ));
              })()}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
              <span>
                Total tercatat di log anti-duplikat:{' '}
                <strong>{getSyncedGenerationLog(store).length} hadis/ayat</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowGenHistoryModal(false)}
                className="min-h-[38px] px-4 py-1.5 bg-slate-900 text-white font-semibold rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL BUAT PROFIL DATABASE DENGAN AI (PENGELOMPOKAN DARI DATABASE)
         ============================================================ */}
      {showAiProfileCreatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                  <span>Buat Profil Database dengan Bantuan AI (Dari Database Tersimpan)</span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  AI akan menyeleksi dan mengelompokkan hadis/ayat dari database yang sudah Anda miliki sesuai kriteria yang Anda ketik.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAiProfileCreatorModal(false)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <form onSubmit={handleRunAiGroupProfile} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Profil Database Baru (Opsional, AI bisa beri saran)
                    </label>
                    <input
                      type="text"
                      value={aiGroupProfileName}
                      onChange={(e) => setAiGroupProfileName(e.target.value)}
                      placeholder="Contoh: Kajian Akhlak & Sedekah Pilihan"
                      className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sumber Materi Database yang Dianalisis
                    </label>
                    <select
                      value={aiGroupSourceFilter}
                      onChange={(e) => setAiGroupSourceFilter(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                    >
                      <option value="all">
                        Seluruh Database Tersimpan ({store.hadiths.length} materi)
                      </option>
                      {allProfiles.map((p) => (
                        <option key={p} value={p}>
                          Hanya dari Profil: {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ketik Kriteria Pengelompokan untuk AI
                  </label>
                  <textarea
                    rows={2}
                    value={aiGroupCriteria}
                    onChange={(e) => setAiGroupCriteria(e.target.value)}
                    placeholder="Contoh: Kelompokkan semua hadis yang berkaitan dengan keutamaan ilmu, adab kepada sesama muslim, sedekah, atau hadis yang singkat untuk kajian pagi..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-xs text-slate-700">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="groupActionMode"
                        checked={aiGroupActionMode === 'move'}
                        onChange={() => setAiGroupActionMode('move')}
                        className="accent-emerald-700"
                      />
                      <span>Pindahkan hadis terpilih ke profil baru</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="groupActionMode"
                        checked={aiGroupActionMode === 'copy'}
                        onChange={() => setAiGroupActionMode('copy')}
                        className="accent-emerald-700"
                      />
                      <span>Salin (tetap simpan di profil asal)</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={aiGroupLoading}
                    className="min-h-[40px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {aiGroupLoading
                        ? 'AI Sedang Mengelompokkan Database...'
                        : 'Analisis & Kelompokkan dengan AI'}
                    </span>
                  </button>
                </div>
              </form>

              {aiGroupResult && (
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1">
                    <p className="text-xs font-bold text-emerald-950">
                      Hasil Kurasi AI — Rekomendasi Profil: &ldquo;
                      {aiGroupProfileName || aiGroupResult.recommendedProfileName}&rdquo;
                    </p>
                    <p className="text-xs text-slate-700">{aiGroupResult.groupingSummary}</p>
                  </div>

                  {aiGroupResult.matches.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">
                          Pilih materi yang akan dimasukkan ({selectedGroupedIds.length} dipilih):
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedGroupedIds(aiGroupResult.matches.map((m) => m.id))
                            }
                            className="text-emerald-800 font-semibold underline"
                          >
                            Pilih Semua
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedGroupedIds([])}
                            className="text-slate-500 underline"
                          >
                            Kosongkan
                          </button>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                        {aiGroupResult.matches.map((m, idx) => {
                          const hItem = store.hadiths.find((h) => h.id === m.id);
                          if (!hItem) return null;
                          const checked = selectedGroupedIds.includes(m.id);
                          return (
                            <label
                              key={m.id}
                              className="p-3 flex items-start gap-2.5 cursor-pointer hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedGroupedIds((prev) => [...prev, m.id]);
                                  } else {
                                    setSelectedGroupedIds((prev) =>
                                      prev.filter((id) => id !== m.id)
                                    );
                                  }
                                }}
                                className="w-4 h-4 accent-emerald-700 mt-0.5 shrink-0"
                              />
                              <div className="text-xs space-y-0.5 min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono-num font-bold text-emerald-800">
                                    Urutan #{m.recommendedOrder || idx + 1}
                                  </span>
                                  <span className="font-bold text-slate-900">{hItem.title}</span>
                                  <span className="text-slate-500">
                                    ({hItem.sourceBook} No. {hItem.hadithNumber} · Profil Asal:{' '}
                                    {hItem.profileName})
                                  </span>
                                </div>
                                <p className="text-[11px] text-emerald-800">
                                  <strong>Alasan AI:</strong> {m.reason}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAiProfileCreatorModal(false)}
                className="min-h-[40px] px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Batal
              </button>
              {aiGroupResult && aiGroupResult.matches.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmApplyGroupedProfile}
                  className="min-h-[40px] px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    Simpan Profil &ldquo;
                    {aiGroupProfileName || aiGroupResult.recommendedProfileName}&rdquo; (
                    {selectedGroupedIds.length} Hadis)
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL EDIT PROFIL DATABASE & ASISTEN AI (RAPIHKAN + REKOMENDASI HADIS)
         ============================================================ */}
      {editingProfileStudio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                  <span>Edit Profil Database &amp; Asisten AI: &ldquo;{editingProfileStudio}&rdquo;</span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Gunakan bantuan AI untuk merapihkan struktur/urutan hadis di profil ini, merekomendasikan tambahan hadis shahih, atau mengubah nama profil.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProfileStudio(null)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-navigation inside Edit Profile Modal */}
            <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setProfileStudioTab('tidy')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  profileStudioTab === 'tidy'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                1. AI Rapihkan Hadis &amp; Urutan Profil
              </button>
              <button
                type="button"
                onClick={() => setProfileStudioTab('recommend')}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  profileStudioTab === 'recommend'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                2. AI Rekomendasikan Tambahan Hadis
              </button>
              {editingProfileStudio !== 'Belum Terkategori' && (
                <button
                  type="button"
                  onClick={() => setProfileStudioTab('rename')}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    profileStudioTab === 'rename'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  3. Ubah Nama Profil
                </button>
              )}
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {profileStudioTab === 'tidy' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                    <label className="block text-xs font-semibold text-slate-800">
                      Instruksi Perapihan AI untuk Profil &ldquo;{editingProfileStudio}&rdquo; (Opsional):
                    </label>
                    <input
                      type="text"
                      value={profileStudioInstruction}
                      onChange={(e) => setProfileStudioInstruction(e.target.value)}
                      placeholder="Contoh: Seragamkan gaya bahasa ringkasan, lengkapi nama kitab & derajat hadis, dan urutkan dari tema niat ke amal..."
                      className="w-full min-h-[40px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500">
                        Jumlah materi di profil ini:{' '}
                        <strong>
                          {
                            store.hadiths.filter(
                              (h) => (h.profileName || 'Belum Terkategori') === editingProfileStudio
                            ).length
                          }{' '}
                          hadis/ayat
                        </strong>
                      </span>
                      <button
                        type="button"
                        disabled={profileStudioLoading}
                        onClick={() => handleRunProfileAiAssistant('tidy')}
                        className="min-h-[38px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {profileStudioLoading
                            ? 'AI Sedang Merapihkan...'
                            : 'Rapihkan Hadis Profil Ini dengan AI'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {profileTidyPreview && (
                    <div className="space-y-3">
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950">
                        <strong>Catatan Editor AI:</strong> {profileTidyPreview.summaryNote}
                      </div>
                      <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                        {profileTidyPreview.tidiedItems.map((tItem) => (
                          <div key={tItem.id} className="p-3 space-y-1 text-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono-num font-bold text-emerald-800">
                                Urutan #{tItem.sequenceOrder}
                              </span>
                              <span className="font-bold text-slate-900">{tItem.title}</span>
                              <span className="text-slate-600">
                                ({tItem.sourceBook} · {tItem.sourceBookName} No. {tItem.hadithNumber} ·{' '}
                                {tItem.hadithDegree})
                              </span>
                            </div>
                            <p className="text-slate-700">&ldquo;{tItem.shortSummary}&rdquo;</p>
                            <p className="text-[11px] text-emerald-800">
                              <strong>Perbaikan AI:</strong> {tItem.changeNote}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {profileStudioTab === 'recommend' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Fokus / Kriteria Rekomendasi Tambahan Hadis (Opsional):
                        </label>
                        <input
                          type="text"
                          value={profileStudioInstruction}
                          onChange={(e) => setProfileStudioInstruction(e.target.value)}
                          placeholder={`Contoh: Tambahkan hadis shahih pelengkap yang belum ada di profil ${editingProfileStudio}...`}
                          className="w-full min-h-[40px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Jumlah Rekomendasi
                        </label>
                        <select
                          value={profileRecommendCount}
                          onChange={(e) => setProfileRecommendCount(e.target.value)}
                          className="w-full min-h-[40px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                        >
                          <option value="2">2 Hadis</option>
                          <option value="3">3 Hadis</option>
                          <option value="5">5 Hadis</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        AI otomatis mengecek isi profil &amp; log agar tidak merekomendasikan hadis yang kembar.
                      </span>
                      <button
                        type="button"
                        disabled={profileStudioLoading}
                        onClick={() => handleRunProfileAiAssistant('recommend')}
                        className="min-h-[38px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {profileStudioLoading
                            ? 'Mencari Rekomendasi Shahih...'
                            : 'Minta Rekomendasi Tambahan Hadis AI'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {profileRecommendedPreview && (
                    <div className="space-y-3">
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950">
                        <strong>Rekomendasi Kurator AI:</strong>{' '}
                        {profileRecommendedPreview.summaryNote}
                      </div>

                      <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                        {profileRecommendedPreview.recommendedItems.map((rItem) => {
                          const isChecked = selectedRecommendedIds.includes(rItem.id);
                          return (
                            <label
                              key={rItem.id}
                              className="p-3 flex items-start gap-2.5 cursor-pointer hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedRecommendedIds((prev) => [...prev, rItem.id]);
                                  } else {
                                    setSelectedRecommendedIds((prev) =>
                                      prev.filter((id) => id !== rItem.id)
                                    );
                                  }
                                }}
                                className="w-4 h-4 accent-emerald-700 mt-0.5 shrink-0"
                              />
                              <div className="text-xs space-y-1 min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-bold text-slate-900">{rItem.title}</span>
                                  <span className="text-slate-600">
                                    ({rItem.sourceBook} · Kitab: {rItem.sourceBookName} · No.{' '}
                                    {rItem.hadithNumber} · Derajat: {rItem.hadithDegree})
                                  </span>
                                </div>
                                <p className="text-slate-700">&ldquo;{rItem.translationText}&rdquo;</p>
                                {rItem.recommendationReason && (
                                  <p className="text-[11px] text-emerald-800">
                                    <strong>Alasan Rekomendasi:</strong> {rItem.recommendationReason}
                                  </p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {profileStudioTab === 'rename' && renamingProfile && (
                <form onSubmit={handleRenameProfileSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Baru untuk Profil &ldquo;{renamingProfile.oldName}&rdquo;:
                    </label>
                    <input
                      type="text"
                      value={renamingProfile.newName}
                      onChange={(e) =>
                        setRenamingProfile({ ...renamingProfile, newName: e.target.value })
                      }
                      className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                  >
                    Simpan Nama Profil Baru
                  </button>
                </form>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingProfileStudio(null)}
                className="min-h-[40px] px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Tutup
              </button>
              {profileStudioTab === 'tidy' &&
                profileTidyPreview &&
                profileTidyPreview.tidiedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyProfileTidyChanges}
                    className="min-h-[40px] px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Terapkan Hasil Perapihan AI ({profileTidyPreview.tidiedItems.length} Hadis)</span>
                  </button>
                )}
              {profileStudioTab === 'recommend' &&
                profileRecommendedPreview &&
                selectedRecommendedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveRecommendedHadithsToProfile}
                    className="min-h-[40px] px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      Tambahkan {selectedRecommendedIds.length} Hadis Rekomendasi ke Profil &ldquo;
                      {editingProfileStudio}&rdquo;
                    </span>
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 lg:px-8 py-6">
        {/* ============================================================
            TAB 1: DATABASE HADIS, PROFIL LIST & AI GENERATOR
           ============================================================ */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
                  01. Database Hadis Shahih &amp; Pembuat Database AI
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Dilengkapi <strong>Log Anti-Duplikat Tersinkronisasi</strong>, <strong>Pembuat Profil AI dari Kriteria Database</strong>, serta <strong>Asisten AI Perapihan &amp; Rekomendasi Profil</strong>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowGenHistoryModal(true)}
                  className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    Log Hadis Ter-Generate ({getSyncedGenerationLog(store).length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiGroupResult(null);
                    setShowAiProfileCreatorModal(true);
                  }}
                  className="min-h-[40px] px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>+ Buat Profil Database dengan AI</span>
                </button>
              </div>
            </div>

            {/* AI GENERATOR PANEL */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Generator Database AI (Terkoneksi ke Akun {activeAccount?.email})
                  </h2>
                  <p className="text-xs text-slate-600">
                    Pilih jenis materi, tema utama (klik tombol <strong>+ Sub-Tema</strong> di sampingnya untuk menambah rincian sub-tema berulang kali), jumlah hadis, serta ukuran panjang hadis.
                  </p>
                </div>

                {/* Anti-Duplicate Toggle & Sync Status */}
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={aiAllowDuplicates}
                    onChange={(e) => setAiAllowDuplicates(e.target.checked)}
                    className="w-4 h-4 accent-emerald-700"
                  />
                  <span>
                    Izinkan Generate Hadis yang Sama (Abaikan Filter Anti-Duplikat)
                  </span>
                </label>
              </div>

              <form onSubmit={handleGenerateWithAI} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  {/* a. Jenis Materi */}
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      a. Jenis Materi
                    </label>
                    <select
                      value={aiType}
                      onChange={(e) => setAiType(e.target.value as 'hadis' | 'quran')}
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900"
                    >
                      <option value="hadis">Hadis Shahih (Kitab 9 Imam)</option>
                      <option value="quran">Ayat Al-Quran (Terjemah Kemenag RI)</option>
                    </select>
                  </div>

                  {/* b. Tema + Tombol Tambah Sub-Tema */}
                  <div className="md:col-span-5 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      b. Tema Utama &amp; Sub-Tema
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={aiCriteria}
                        onChange={(e) => setAiCriteria(e.target.value)}
                        placeholder="Contoh: Keutamaan Sedekah & Akhlak Mulia..."
                        className="flex-1 min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setAiSubThemes((prev) => [...prev, ''])}
                        className="min-h-[44px] px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
                        title="Tambah kotak input Sub-Tema di bawahnya"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Sub-Tema</span>
                      </button>
                    </div>

                    {/* Dynamic Sub-Theme Textboxes */}
                    {aiSubThemes.length > 0 && (
                      <div className="space-y-2 pt-1 pl-3 border-l-2 border-emerald-300">
                        {aiSubThemes.map((subVal, sIdx) => (
                          <div key={sIdx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={subVal}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAiSubThemes((prev) =>
                                  prev.map((item, i) => (i === sIdx ? val : item))
                                );
                              }}
                              placeholder={`Sub-Tema #${sIdx + 1} (contoh: Sedekah kepada kerabat / menjaga lisan)...`}
                              className="flex-1 min-h-[38px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => setAiSubThemes((prev) => [...prev, ''])}
                              className="min-h-[38px] px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0"
                              title="Tambah Sub-Tema lagi"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setAiSubThemes((prev) => prev.filter((_, i) => i !== sIdx))
                              }
                              className="min-h-[38px] px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold shrink-0"
                              title="Hapus Sub-Tema ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* c. Jumlah Hadis */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      c. Jumlah Hadis
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={25}
                      value={aiCountInput}
                      onChange={(e) => setAiCountInput(e.target.value)}
                      placeholder="Misal: 5"
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-mono-num"
                    />
                  </div>

                  {/* d. Panjang Hadis (Singkat, Sedang, Panjang) */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      d. Panjang Hadis
                    </label>
                    <select
                      value={aiHadithLength}
                      onChange={(e) =>
                        setAiHadithLength(e.target.value as 'singkat' | 'sedang' | 'panjang')
                      }
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 font-semibold"
                    >
                      <option value="singkat">Singkat</option>
                      <option value="sedang">Sedang</option>
                      <option value="panjang">Panjang</option>
                    </select>
                  </div>
                </div>

                {aiType === 'hadis' && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-slate-800">
                        Pilih Kitab Sumber Hadis Resmi (Terjemahan Kitab Baku &amp; Nomor Hadis Asli):{' '}
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
                        { id: 'tirmidzi', label: 'Jami\' Tirmidzi' },
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

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                    <span>Tema Cepat:</span>
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
                        ? 'Menyusun Database Terverifikasi...'
                        : `Generate ${aiCountInput || 1} Materi (${aiHadithLength.toUpperCase()})`}
                    </span>
                  </button>
                </div>
              </form>

              {/* SAVE GENERATED DATABASE TO EXISTING OR NEW PROFILE (PAGINATED 5 PER PAGE) */}
              {previewItems.length > 0 && (
                <div className="mt-6 pt-5 border-t border-slate-200 space-y-4">
                  {/* DUPLICATE CONFIRMATION BANNER (LANJUT ATAU GANTI) */}
                  {!aiAllowDuplicates && duplicateMatches.length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-xs font-bold text-amber-950">
                              Konfirmasi Duplikat Ditemukan ({duplicateMatches.length} Hadis Sudah Ada di Database / Log)
                            </h4>
                            <p className="text-xs text-amber-900 mt-0.5">
                              Beberapa hadis yang di-generate terdeteksi sama dengan yang sudah ada di database/log. Apakah Anda ingin <strong>Ganti Otomatis dengan Hadis Baru</strong> atau <strong>Tetap Lanjut Gunakan</strong>?
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={replacingDuplicateIds.length > 0}
                            onClick={() =>
                              handleReplaceDuplicatePreviewItems(
                                duplicateMatches.map((d) => d.previewId)
                              )
                            }
                            className="min-h-[38px] px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>
                              {replacingDuplicateIds.length > 0
                                ? 'Mengganti Hadis...'
                                : `Ganti Semua Duplikat (${duplicateMatches.length})`}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDuplicateMatches([])}
                            className="min-h-[38px] px-3.5 py-1.5 bg-white border border-amber-400 hover:bg-amber-100 text-amber-950 text-xs font-semibold rounded-lg"
                          >
                            Tetap Lanjut Gunakan
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-emerald-950">
                        Simpan {previewItems.length} Hasil Generate ke Profil Database (Halaman{' '}
                        {safePreviewPage} dari {totalPreviewPages})
                      </h3>
                      <p className="text-xs text-slate-600">
                        Tampilan ringkas otomatis dimunculkan langsung. Tombol <strong>Preview Hadis</strong> muncul khusus untuk materi berukuran <strong>Sedang</strong> dan <strong>Panjang</strong>.
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
                        <span>Simpan Semua ({previewItems.length}) ke Profil</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPreviewItems([]);
                          setDuplicateMatches([]);
                          setPreviewPage(1);
                        }}
                        className="min-h-[42px] px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg"
                      >
                        Batal
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-slate-50">
                    {paginatedPreviewItems.map((item, idx) => {
                      const globalIdx = (safePreviewPage - 1) * HADITHS_PER_PAGE + idx + 1;
                      const itemLen = item.hadithLength || 'singkat';
                      const showPreviewButton = itemLen === 'sedang' || itemLen === 'panjang';
                      const dupInfo = duplicateMatches.find((d) => d.previewId === item.id);
                      const isReplacingThis = replacingDuplicateIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                            dupInfo ? 'bg-amber-50/70' : ''
                          }`}
                        >
                          <div className="min-w-0 space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                              <span className="font-mono-num font-bold text-emerald-800">
                                Draf #{globalIdx}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-slate-900">
                                {item.sourceBook}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>
                                Kitab: <strong>{item.sourceBookName || item.sourceBook}</strong>
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-num font-bold text-slate-900">
                                No. {item.hadithNumber}
                              </span>
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-semibold rounded text-[11px]">
                                Derajat: {item.hadithDegree || 'Shahih'}
                              </span>
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-800 font-semibold rounded text-[11px] uppercase">
                                {itemLen}
                              </span>
                              {dupInfo && (
                                <span className="px-2 py-0.5 bg-amber-200 text-amber-950 font-bold rounded text-[11px]">
                                  Sudah Ada di {dupInfo.existingProfileName} ({dupInfo.existingSourceBook} No. {dupInfo.existingHadithNumber})
                                </span>
                              )}
                            </div>

                            <p className="text-sm font-bold text-slate-900">{item.title}</p>

                            {/* Tampilan Hadis Singkat Langsung Muncul */}
                            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                              {itemLen === 'singkat' && item.arabicText && (
                                <p
                                  dir="rtl"
                                  className="text-base font-arabic text-slate-900 text-right leading-relaxed"
                                >
                                  {item.arabicText}
                                </p>
                              )}
                              <p className="text-xs text-slate-800 leading-relaxed">
                                &ldquo;
                                {itemLen === 'singkat'
                                  ? item.translationText || item.shortSummary
                                  : item.shortSummary || item.translationText.slice(0, 180) + '...'}
                                &rdquo;
                              </p>
                              <p className="text-[11px] text-slate-500">
                                <strong>Tema:</strong> {item.categoryTopic} ·{' '}
                                <strong>Hikmah Singkat:</strong> {item.lessonText}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
                            {dupInfo && (
                              <button
                                type="button"
                                disabled={isReplacingThis}
                                onClick={() => handleReplaceDuplicatePreviewItems([item.id])}
                                className="min-h-[38px] px-3 py-1.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>{isReplacingThis ? 'Mengganti...' : 'Ganti Hadis'}</span>
                              </button>
                            )}
                            {showPreviewButton && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePreviewItem(item);
                                  setActivePreviewMode('detail');
                                }}
                                className="min-h-[38px] px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview ({itemLen})</span>
                              </button>
                            )}
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
                              onClick={() => {
                                setPreviewItems((prev) => prev.filter((p) => p.id !== item.id));
                                setDuplicateMatches((prev) =>
                                  prev.filter((d) => d.previewId !== item.id)
                                );
                              }}
                              className="min-h-[38px] px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Navigasi Halaman Hasil Generate (5 per halaman) */}
                  {totalPreviewPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <p className="text-xs text-slate-600 font-mono-num">
                        Menampilkan {(safePreviewPage - 1) * HADITHS_PER_PAGE + 1}–
                        {Math.min(safePreviewPage * HADITHS_PER_PAGE, previewItems.length)} dari{' '}
                        {previewItems.length} hadis (Maks. 5 hadis / halaman)
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={safePreviewPage <= 1}
                          onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                          className="min-h-[36px] px-3 py-1.5 bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg"
                        >
                          &larr; Sebelumnya
                        </button>
                        {Array.from({ length: totalPreviewPages }, (_, i) => i + 1).map((pNum) => (
                          <button
                            key={pNum}
                            type="button"
                            onClick={() => setPreviewPage(pNum)}
                            className={`min-h-[36px] min-w-[36px] px-2.5 py-1.5 text-xs font-mono-num font-bold rounded-lg border ${
                              pNum === safePreviewPage
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {pNum}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={safePreviewPage >= totalPreviewPages}
                          onClick={() =>
                            setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))
                          }
                          className="min-h-[36px] px-3 py-1.5 bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg"
                        >
                          Hadis Selanjutnya &rarr;
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* MASTER-DETAIL: PROFILES LIST (LEFT) + HADITH ITEMS IN PROFILE (RIGHT) */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Selectable List of Profiles (View, AI Edit/Tidy/Recommend, Rename, Delete) */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="border-b border-slate-200 pb-2.5 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    Daftar Profil Database
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setAiGroupResult(null);
                      setShowAiProfileCreatorModal(true);
                    }}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>+ Buat Profil AI</span>
                  </button>
                </div>

                {renamingProfile && !editingProfileStudio && (
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
                    onClick={() => {
                      setDbProfileFilter('all');
                      setDbPage(1);
                    }}
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
                        onClick={() => {
                          setDbProfileFilter(prof);
                          setDbPage(1);
                        }}
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
                            onClick={() => openProfileAiEditor(prof, 'tidy')}
                            className="px-2 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded flex items-center gap-1"
                            title="Edit Profil dengan AI (Rapihkan Hadis & Rekomendasi Tambahan)"
                          >
                            <Sparkles className="w-3 h-3 text-emerald-700" />
                            <span>Edit AI</span>
                          </button>
                          {prof !== 'Belum Terkategori' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setRenamingProfile({ oldName: prof, newName: prof })
                                }
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                                title="Ubah nama profil"
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

              {/* Right Column: Hadiths inside Selected Profile (5 per page with navigation) */}
              <div className="lg:col-span-8 space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Isi Profil:{' '}
                        <span className="text-emerald-800">
                          {dbProfileFilter === 'all' ? 'Semua Profil' : dbProfileFilter}
                        </span>{' '}
                        ({filteredHadiths.length} Materi · Halaman {safeDbPage}/{totalDbPages})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Menampilkan 5 hadis per halaman. Tampilan singkat muncul langsung; tombol <strong>Preview</strong> tampil khusus untuk hadis <strong>Sedang</strong> dan <strong>Panjang</strong>.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={dbTypeFilter}
                        onChange={(e) => {
                          setDbTypeFilter(e.target.value as 'all' | 'hadis' | 'quran');
                          setDbPage(1);
                        }}
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
                          onChange={(e) => {
                            setDbSearch(e.target.value);
                            setDbPage(1);
                          }}
                          placeholder="Cari hadis / kitab / nomor..."
                          className="w-full min-h-[38px] pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick AI Profile Actions Bar when a specific profile is selected */}
                  {dbProfileFilter !== 'all' && (
                    <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-600">
                        Asisten AI Profil <strong>{dbProfileFilter}</strong>:
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openProfileAiEditor(dbProfileFilter, 'tidy')}
                          className="min-h-[34px] px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                          <span>AI Rapihkan Hadis Sesuai Profil</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openProfileAiEditor(dbProfileFilter, 'recommend')}
                          className="min-h-[34px] px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-700" />
                          <span>AI Rekomendasikan Tambahan Hadis</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {filteredHadiths.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                    <p className="text-sm font-semibold text-slate-800">
                      Tidak ada materi hadis pada profil ini.
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Silakan generate hadis baru atau klik tombol <strong>AI Rekomendasikan Tambahan Hadis</strong> untuk mengisi profil ini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
                      {paginatedDbHadiths.map((item, idx) => {
                        const globalIdx = (safeDbPage - 1) * HADITHS_PER_PAGE + idx + 1;
                        const estimatedLen: 'singkat' | 'sedang' | 'panjang' =
                          item.hadithLength ||
                          ((item.translationText || '').length + (item.arabicText || '').length * 0.5 >
                          240
                            ? 'sedang'
                            : 'singkat');
                        const showPreviewBtn =
                          estimatedLen === 'sedang' || estimatedLen === 'panjang';

                        return (
                          <div
                            key={item.id}
                            className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                          >
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                <span className="font-mono-num font-bold text-emerald-800">
                                  #{globalIdx}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-slate-800">
                                  Profil: {item.profileName || 'Belum Terkategori'}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-slate-900">
                                  {item.sourceBook}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  Kitab:{' '}
                                  <strong>
                                    {item.sourceBookName ||
                                      (item.type === 'quran'
                                        ? 'Al-Quran Terjemahan Kemenag RI'
                                        : item.sourceBook)}
                                  </strong>
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono-num font-bold text-slate-900">
                                  No. {item.hadithNumber}
                                </span>
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-semibold rounded text-[11px]">
                                  Derajat:{' '}
                                  {item.hadithDegree ||
                                    (item.type === 'quran' ? "Qath'i (Al-Quran)" : 'Shahih')}
                                </span>
                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 font-semibold rounded text-[11px] uppercase">
                                  {estimatedLen}
                                </span>
                              </div>

                              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                                {item.title}
                              </h3>

                              {/* Tampilan Hadis Singkat Langsung Muncul di Daftar */}
                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                                {estimatedLen === 'singkat' && item.arabicText && (
                                  <p
                                    dir="rtl"
                                    className="text-base font-arabic text-slate-900 text-right leading-relaxed"
                                  >
                                    {item.arabicText}
                                  </p>
                                )}
                                <p className="text-xs text-slate-800 leading-relaxed">
                                  &ldquo;
                                  {estimatedLen === 'singkat'
                                    ? item.translationText || item.shortSummary
                                    : item.shortSummary || item.translationText}
                                  &rdquo;
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  <strong>Topik:</strong> {item.categoryTopic} ·{' '}
                                  <strong>Hikmah:</strong> {item.lessonText}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
                              {showPreviewBtn && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePreviewItem(item);
                                    setActivePreviewMode('detail');
                                  }}
                                  className="min-h-[38px] px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Preview ({estimatedLen})</span>
                                </button>
                              )}
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
                        );
                      })}
                    </div>

                    {/* Navigasi Halaman Database Tersimpan (5 hadis per halaman) */}
                    {totalDbPages > 1 && (
                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-slate-600 font-mono-num">
                          Menampilkan {(safeDbPage - 1) * HADITHS_PER_PAGE + 1}–
                          {Math.min(safeDbPage * HADITHS_PER_PAGE, filteredHadiths.length)} dari{' '}
                          {filteredHadiths.length} materi (5 hadis / halaman)
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={safeDbPage <= 1}
                            onClick={() => setDbPage((p) => Math.max(1, p - 1))}
                            className="min-h-[36px] px-3 py-1.5 bg-slate-50 border border-slate-300 disabled:opacity-40 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg"
                          >
                            &larr; Sebelumnya
                          </button>
                          {Array.from({ length: totalDbPages }, (_, i) => i + 1).map((pNum) => (
                            <button
                              key={pNum}
                              type="button"
                              onClick={() => setDbPage(pNum)}
                              className={`min-h-[36px] min-w-[36px] px-2.5 py-1.5 text-xs font-mono-num font-bold rounded-lg border ${
                                pNum === safeDbPage
                                  ? 'bg-emerald-700 text-white border-emerald-700'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              {pNum}
                            </button>
                          ))}
                          <button
                            type="button"
                            disabled={safeDbPage >= totalDbPages}
                            onClick={() => setDbPage((p) => Math.min(totalDbPages, p + 1))}
                            className="min-h-[36px] px-3 py-1.5 bg-slate-50 border border-slate-300 disabled:opacity-40 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg"
                          >
                            Hadis Selanjutnya &rarr;
                          </button>
                        </div>
                      </div>
                    )}
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

                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Klik Variabel untuk Menyisipkan ke Format Pesan:
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowVarManager(!showVarManager)}
                      className="min-h-[34px] px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>
                        {showVarManager
                          ? 'Tutup Kelola Variabel'
                          : '+ Tambah / Edit / Hapus Variabel'}
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {ensureCompleteSystemVariables(store.templateVariables).map((v) => (
                      <div
                        key={v.id || v.key}
                        className="inline-flex items-center bg-slate-100 hover:bg-emerald-50 border border-slate-300 rounded-md overflow-hidden transition-colors"
                      >
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => insertVariableAtCursor(v.key)}
                          className="min-h-[36px] px-2.5 py-1 text-xs font-mono-num font-medium hover:text-emerald-800 whitespace-nowrap"
                          title={
                            v.defaultValue
                              ? `Klik untuk sisipkan ${v.key} (Isi: ${v.defaultValue})`
                              : `Klik untuk sisipkan ${v.key}`
                          }
                        >
                          {v.key} <span className="font-sans text-slate-500">({v.label})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowVarManager(true);
                            setEditingVarId(v.id);
                            setVarKeyInput(v.key);
                            setVarLabelInput(v.label);
                            setVarDefaultValueInput(v.defaultValue || '');
                          }}
                          className="min-h-[36px] px-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-100/60 border-l border-slate-200"
                          title={`Edit variabel ${v.key}`}
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplateVariable(v)}
                          className="min-h-[36px] px-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 border-l border-slate-200"
                          title={`Hapus variabel ${v.key}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* PANEL TAMBAH, EDIT & HAPUS VARIABEL */}
                  {showVarManager && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-bold text-slate-900">
                            {editingVarId
                              ? `Edit Variabel (${varKeyInput})`
                              : 'Tambah Variabel Format Baru'}
                          </h3>
                          <p className="text-[11px] text-slate-600">
                            Buat variabel kustom (misal: <code>{'{salam}'}</code>,{' '}
                            <code>{'{masjid}'}</code>, <code>{'{donasi}'}</code>) beserta teks isinya, atau ubah label variabel yang ada.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetTemplateVariables}
                          className="min-h-[32px] px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-md text-[11px] font-semibold"
                        >
                          Reset Variabel Default
                        </button>
                      </div>

                      <form
                        onSubmit={handleSaveTemplateVariable}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                      >
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Kode Variabel
                          </label>
                          <input
                            type="text"
                            value={varKeyInput}
                            onChange={(e) => setVarKeyInput(e.target.value)}
                            placeholder="{salam}"
                            className="w-full min-h-[38px] px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Nama / Label Variabel
                          </label>
                          <input
                            type="text"
                            value={varLabelInput}
                            onChange={(e) => setVarLabelInput(e.target.value)}
                            placeholder="Contoh: Salam Pembuka"
                            className="w-full min-h-[38px] px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Isi Teks Variabel (Nilai Otomatis Saat Dikirim)
                          </label>
                          <input
                            type="text"
                            value={varDefaultValueInput}
                            onChange={(e) => setVarDefaultValueInput(e.target.value)}
                            placeholder="Contoh: Assalamu'alaikum Warahmatullahi Wabarakatuh"
                            className="w-full min-h-[38px] px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <div className="sm:col-span-12 flex flex-wrap items-center justify-end gap-2 pt-1">
                          {editingVarId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingVarId(null);
                                setVarKeyInput('');
                                setVarLabelInput('');
                                setVarDefaultValueInput('');
                              }}
                              className="min-h-[36px] px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg"
                            >
                              Batal Edit
                            </button>
                          )}
                          <button
                            type="submit"
                            className="min-h-[36px] px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>
                              {editingVarId ? 'Simpan Perubahan Variabel' : 'Tambah Variabel'}
                            </span>
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
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
                      {renderClientPreview(
                        tplContent,
                        sampleHadithForPreview,
                        store.templateVariables && store.templateVariables.length > 0
                          ? store.templateVariables
                          : DEFAULT_TEMPLATE_VARIABLES
                      )}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 3: KONTAK JAMAAH (TAMBAH GRUP, MULTI-SELECT / CENTANG KONTAK, PINDAH GRUP & HAPUS)
           ============================================================ */}
        {activeTab === 'kontak' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
                  03. Daftar Kontak Jamaah, Manajemen Grup &amp; Aksi Massal
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Kelola daftar nomor WhatsApp jamaah, buat &amp; kelola <strong>Grup Kontak</strong>, centang banyak kontak sekaligus (<strong>Multi-Select</strong>) untuk pindah grup, ubah kategori, atau hapus.
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
              {/* LEFT COLUMN: TAMBAH/EDIT KONTAK + MANAJEMEN GRUP KONTAK */}
              <div className="lg:col-span-4 space-y-5">
                <form
                  onSubmit={handleSaveContact}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
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

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Kelompok / Grup Jamaah
                    </label>
                    <select
                      value={
                        allContactGroups.includes(contactGroup) ? contactGroup : '__CUSTOM__'
                      }
                      onChange={(e) => {
                        if (e.target.value === '__CUSTOM__') {
                          setContactGroup('');
                        } else {
                          setContactGroup(e.target.value);
                        }
                      }}
                      className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      {allContactGroups.map((grp) => (
                        <option key={grp} value={grp}>
                          Grup: {grp}
                        </option>
                      ))}
                      <option value="__CUSTOM__">+ Ketik Nama Grup Baru Manual...</option>
                    </select>
                    {!allContactGroups.includes(contactGroup) && (
                      <input
                        type="text"
                        value={contactGroup}
                        onChange={(e) => setContactGroup(e.target.value)}
                        placeholder="Ketik nama grup baru (contoh: Jamaah Subuh)..."
                        className="w-full min-h-[40px] px-3 py-2 bg-white border border-emerald-500 rounded-lg text-xs"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Catatan Kontak (Opsional)
                    </label>
                    <input
                      type="text"
                      value={contactNotes}
                      onChange={(e) => setContactNotes(e.target.value)}
                      placeholder="Contoh: Pengurus DKM / Donatur"
                      className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
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

                {/* PANEL KELOLA & TAMBAH GRUP KONTAK */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
                  <div className="border-b border-slate-200 pb-2.5 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Kelola &amp; Tambah Grup Kontak
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Buat grup baru untuk mengelompokkan jamaah atau klik grup untuk memfilter daftar.
                      </p>
                    </div>
                    <span className="text-xs font-mono-num font-bold text-emerald-800">
                      {allContactGroups.length} grup
                    </span>
                  </div>

                  <form onSubmit={handleAddContactGroup} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newContactGroupInput}
                      onChange={(e) => setNewContactGroupInput(e.target.value)}
                      placeholder="Nama grup baru (misal: Kajian Ahad)..."
                      className="flex-1 min-h-[40px] px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                    <button
                      type="submit"
                      className="min-h-[40px] px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Grup</span>
                    </button>
                  </form>

                  {renamingContactGroup && (
                    <form
                      onSubmit={handleRenameContactGroupSubmit}
                      className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg space-y-2"
                    >
                      <label className="block text-xs font-bold text-emerald-950">
                        Ubah Nama Grup &ldquo;{renamingContactGroup.oldName}&rdquo;:
                      </label>
                      <input
                        type="text"
                        value={renamingContactGroup.newName}
                        onChange={(e) =>
                          setRenamingContactGroup({
                            ...renamingContactGroup,
                            newName: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRenamingContactGroup(null)}
                          className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1 bg-emerald-700 text-white rounded text-xs font-semibold"
                        >
                          Simpan Nama Grup
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    <div
                      onClick={() => setContactGroupFilter('all')}
                      className={`cursor-pointer p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors ${
                        contactGroupFilter === 'all'
                          ? 'bg-emerald-50/90 border-emerald-700 font-bold text-slate-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>Semua Grup Kontak</span>
                      <span className="font-mono-num text-emerald-800">
                        {store.contacts.length} kontak
                      </span>
                    </div>

                    {allContactGroups.map((grp) => {
                      const count = store.contacts.filter(
                        (c) => (c.groupTag || 'Jamaah Umum').trim() === grp
                      ).length;
                      const isSelected = contactGroupFilter === grp;
                      return (
                        <div
                          key={grp}
                          onClick={() => setContactGroupFilter(grp)}
                          className={`cursor-pointer p-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs transition-colors ${
                            isSelected
                              ? 'bg-emerald-50/90 border-emerald-700 font-bold text-slate-900'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 truncate">
                            <span className="truncate">{grp}</span>
                            <span className="ml-2 text-[11px] font-mono-num text-slate-500">
                              ({count} kontak)
                            </span>
                          </div>
                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setRenamingContactGroup({ oldName: grp, newName: grp })
                              }
                              className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded"
                              title="Ubah nama grup"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {grp !== 'Jamaah Umum' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteContactGroup(grp)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Hapus grup (kontak dipindah ke Jamaah Umum)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: DAFTAR KONTAK DENGAN MULTI-SELECT (CENTANG BANYAK) & AKSI MASSAL */}
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                    <button
                      type="button"
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
                      type="button"
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
                      type="button"
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

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <select
                      value={contactGroupFilter}
                      onChange={(e) => setContactGroupFilter(e.target.value)}
                      className="min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      <option value="all">Semua Grup ({allContactGroups.length})</option>
                      {allContactGroups.map((g) => (
                        <option key={g} value={g}>
                          Grup: {g}
                        </option>
                      ))}
                    </select>

                    <div className="relative flex-1 sm:w-56">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        placeholder="Cari nama, WA, atau grup..."
                        className="w-full min-h-[40px] pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* SELECT ALL BAR + MULTI-SELECT BULK ACTION TOOLBAR */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          filteredContacts.length > 0 &&
                          filteredContacts.every((c) => selectedContactIds.includes(c.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            const visibleIds = filteredContacts.map((c) => c.id);
                            setSelectedContactIds((prev) =>
                              Array.from(new Set([...prev, ...visibleIds]))
                            );
                          } else {
                            const visibleSet = new Set(filteredContacts.map((c) => c.id));
                            setSelectedContactIds((prev) =>
                              prev.filter((id) => !visibleSet.has(id))
                            );
                          }
                        }}
                        className="w-4 h-4 accent-emerald-700"
                      />
                      <span>
                        Pilih Semua di Daftar Ini ({filteredContacts.length} kontak tampil)
                      </span>
                    </label>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono-num font-bold text-emerald-800">
                        {selectedContactIds.length} kontak dicentang
                      </span>
                      {selectedContactIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedContactIds([])}
                          className="text-slate-500 hover:text-slate-900 underline"
                        >
                          Batal Pilih Semua
                        </button>
                      )}
                    </div>
                  </div>

                  {/* TOOLBAR AKSI MASSAL SAAT ADA KONTAK YANG DICENTANG */}
                  {selectedContactIds.length > 0 && (
                    <div className="pt-3 border-t border-slate-200 space-y-2.5">
                      <p className="text-[11px] font-bold text-emerald-950">
                        Aksi Massal untuk {selectedContactIds.length} Kontak Terpilih:
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Pindah ke Grup Pilihan */}
                        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-300">
                          <select
                            value={bulkTargetGroup}
                            onChange={(e) => setBulkTargetGroup(e.target.value)}
                            className="min-h-[34px] px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-800"
                          >
                            {allContactGroups.map((g) => (
                              <option key={g} value={g}>
                                Pindah ke Grup: {g}
                              </option>
                            ))}
                            <option value="__NEW__">+ Pindah ke Grup Baru...</option>
                          </select>

                          {bulkTargetGroup === '__NEW__' && (
                            <input
                              type="text"
                              value={bulkNewGroupInput}
                              onChange={(e) => setBulkNewGroupInput(e.target.value)}
                              placeholder="Nama grup baru..."
                              className="min-h-[34px] px-2.5 py-1 bg-white border border-emerald-500 rounded text-xs w-36"
                            />
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              handleBulkContactAction('move_group', {
                                targetGroup: bulkTargetGroup,
                              })
                            }
                            className="min-h-[34px] px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded"
                          >
                            Pindahkan Grup
                          </button>
                        </div>

                        {/* Ubah Kategori Singkat / Detail */}
                        <button
                          type="button"
                          onClick={() =>
                            handleBulkContactAction('change_preference', {
                              targetPreference: 'singkat',
                            })
                          }
                          className="min-h-[36px] px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg"
                        >
                          Jadikan Kategori Singkat
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleBulkContactAction('change_preference', {
                              targetPreference: 'detail',
                            })
                          }
                          className="min-h-[36px] px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg"
                        >
                          Jadikan Kategori Detail
                        </button>

                        {/* Hapus Kontak Terpilih */}
                        <button
                          type="button"
                          onClick={() => handleBulkContactAction('delete')}
                          className="min-h-[36px] px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Terpilih ({selectedContactIds.length})</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {filteredContacts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 space-y-3">
                    <p>Belum ada kontak jamaah pada filter/grup ini.</p>
                    <button
                      type="button"
                      onClick={handleRestoreContactsFromDrive}
                      disabled={cloudBusy}
                      className="min-h-[36px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg"
                    >
                      {cloudBusy ? 'Menarik...' : 'Tarik Kontak dari Google Drive'}
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 border-t border-slate-200">
                    {filteredContacts.map((c) => {
                      const isChecked = selectedContactIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedContactIds((prev) =>
                              isChecked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            );
                          }}
                          className={`cursor-pointer py-3.5 px-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors rounded-lg ${
                            isChecked ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 w-4 h-4 accent-emerald-700 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-slate-900">{c.name}</p>
                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-800 rounded text-[11px] font-semibold">
                                  Grup: {c.groupTag || 'Jamaah Umum'}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    c.preference === 'singkat'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-slate-900 text-white'
                                  }`}
                                >
                                  {c.preference === 'singkat' ? 'Hadis Singkat' : 'Hadis Detail'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                                <span className="font-mono-num text-slate-800 font-semibold">
                                  {c.phone}
                                </span>
                                {c.notes && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>Catatan: {c.notes}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div
                            className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleContactPreference(c)}
                              className="min-h-[36px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0"
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
                                setContactGroup(c.groupTag || 'Jamaah Umum');
                                setContactNotes(c.notes || '');
                              }}
                              className="min-h-[36px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteContact(c.id)}
                              className="min-h-[36px] px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
                  Jalankan beberapa <strong>BDI Projek</strong> sekaligus dengan fitur <strong>Pause, Resume &amp; Stop</strong>, pilihan <strong>Format Pengiriman</strong>, serta histori pengiriman lengkap.
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
                        timezone: 'WITA',
                        scheduleFrequency: 'daily',
                        scheduleDays: [0, 1, 2, 3, 4, 5, 6],
                        targetMode: 'all',
                        targetGroups: [],
                        targetContactIds: [],
                        templateMode: 'auto_contact',
                        templateId: store.templates[0]?.id || '',
                        detailTemplateId: defaultLengkapTpl?.id || store.templates[0]?.id || '',
                        singkatTemplateId: defaultSingkatTpl?.id || store.templates[1]?.id || '',
                        durationMode: 'database_count',
                        durationValue: 1,
                        startDate: new Date().toISOString().slice(0, 10),
                        selectedProfiles: [allProfiles[0] || 'Oktober'],
                        selectionOrder: 'sequential',
                        minDelaySeconds: 12,
                        maxDelaySeconds: 35,
                        repeatWhenExhausted: true,
                      });
                      setProjectContactSearch('');
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

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                          Jam Pengiriman
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
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Zona Waktu (Default WITA)
                        </label>
                        <select
                          value={editingProject.timezone || 'WITA'}
                          onChange={(e) =>
                            setEditingProject({
                              ...editingProject,
                              timezone: e.target.value as 'WIB' | 'WITA' | 'WIT',
                            })
                          }
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
                        >
                          <option value="WITA">WITA (UTC+8 — Default)</option>
                          <option value="WIB">WIB (UTC+7)</option>
                          <option value="WIT">WIT (UTC+9)</option>
                        </select>
                      </div>
                    </div>

                    {/* SCHEDULE FREQUENCY & DAY OF WEEK CHECKBOXES */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-900">
                            Pola &amp; Hari Pengiriman (Tiap Hari / Mingguan / Custom Hari):
                          </label>
                          <p className="text-[11px] text-slate-600">
                            Pilih apakah projek dikirim setiap hari, sekali seminggu, atau centang hari apa saja yang diinginkan.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProject({
                                ...editingProject,
                                scheduleFrequency: 'daily',
                                scheduleDays: [0, 1, 2, 3, 4, 5, 6],
                              })
                            }
                            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              (editingProject.scheduleFrequency || 'daily') === 'daily'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            Setiap Hari
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProject({
                                ...editingProject,
                                scheduleFrequency: 'weekly',
                                scheduleDays:
                                  editingProject.scheduleDays &&
                                  editingProject.scheduleDays.length === 1
                                    ? editingProject.scheduleDays
                                    : [5], // Default Jumat
                              })
                            }
                            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              editingProject.scheduleFrequency === 'weekly'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            1x Seminggu
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProject({
                                ...editingProject,
                                scheduleFrequency: 'custom_days',
                                scheduleDays:
                                  editingProject.scheduleDays &&
                                  editingProject.scheduleDays.length > 0 &&
                                  editingProject.scheduleDays.length < 7
                                    ? editingProject.scheduleDays
                                    : [1, 3, 5], // Default Senin, Rabu, Jumat
                              })
                            }
                            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              editingProject.scheduleFrequency === 'custom_days'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            Custom (Centang Hari)
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                        {WEEKDAY_OPTIONS.map((w) => {
                          const freq = editingProject.scheduleFrequency || 'daily';
                          const currentDays =
                            freq === 'daily'
                              ? [0, 1, 2, 3, 4, 5, 6]
                              : Array.isArray(editingProject.scheduleDays)
                              ? editingProject.scheduleDays
                              : [5];
                          const isChecked = currentDays.includes(w.day);

                          return (
                            <label
                              key={w.day}
                              onClick={() => {
                                if (freq === 'weekly') {
                                  setEditingProject({
                                    ...editingProject,
                                    scheduleFrequency: 'weekly',
                                    scheduleDays: [w.day],
                                  });
                                  return;
                                }
                                const nextDays = isChecked
                                  ? currentDays.filter((d) => d !== w.day)
                                  : [...currentDays, w.day];
                                const nextFreq =
                                  nextDays.length === 7 ? 'daily' : 'custom_days';
                                setEditingProject({
                                  ...editingProject,
                                  scheduleFrequency: nextFreq,
                                  scheduleDays: nextDays,
                                });
                              }}
                              className={`cursor-pointer min-h-[40px] px-2.5 py-2 rounded-lg border flex items-center gap-2 text-xs transition-colors ${
                                isChecked
                                  ? 'bg-emerald-50 border-emerald-700 font-bold text-emerald-950'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="w-4 h-4 accent-emerald-700 shrink-0"
                              />
                              <span className="truncate">{w.label}</span>
                            </label>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 pt-1">
                        <span>
                          Jadwal Aktif:{' '}
                          <strong className="text-emerald-800">
                            {formatProjectScheduleDays(editingProject)}
                          </strong>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProject({
                                ...editingProject,
                                scheduleFrequency: 'custom_days',
                                scheduleDays: [1, 2, 3, 4, 5],
                              })
                            }
                            className="text-emerald-800 hover:underline font-semibold"
                          >
                            Senin–Jumat
                          </button>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProject({
                                ...editingProject,
                                scheduleFrequency: 'custom_days',
                                scheduleDays: [6, 0],
                              })
                            }
                            className="text-emerald-800 hover:underline font-semibold"
                          >
                            Sabtu–Minggu
                          </button>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProject({
                                ...editingProject,
                                scheduleFrequency: 'daily',
                                scheduleDays: [0, 1, 2, 3, 4, 5, 6],
                              })
                            }
                            className="text-emerald-800 hover:underline font-semibold"
                          >
                            Pilih Semua Hari
                          </button>
                        </div>
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

                    {/* PILIHAN FORMAT PENGIRIMAN UNTUK PROJEK INI */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-900">
                            Pilih Format Pengiriman Pesan untuk Projek Ini:
                          </label>
                          <p className="text-[11px] text-slate-600">
                            Tentukan apakah memakai 1 format khusus untuk semua penerima di projek ini, atau otomatis menyesuaikan kategori Singkat/Detail tiap kontak.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProject({
                                ...editingProject,
                                templateMode: 'auto_contact',
                                detailTemplateId:
                                  editingProject.detailTemplateId ||
                                  defaultLengkapTpl?.id ||
                                  store.templates[0]?.id ||
                                  '',
                                singkatTemplateId:
                                  editingProject.singkatTemplateId ||
                                  defaultSingkatTpl?.id ||
                                  store.templates[1]?.id ||
                                  '',
                              })
                            }
                            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              (editingProject.templateMode || 'auto_contact') === 'auto_contact'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            Otomatis Sesuai Kategori Kontak (Singkat &amp; Detail)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProject({
                                ...editingProject,
                                templateMode: 'single_template',
                                templateId:
                                  editingProject.templateId ||
                                  defaultLengkapTpl?.id ||
                                  store.templates[0]?.id ||
                                  '',
                              })
                            }
                            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              editingProject.templateMode === 'single_template'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            Pakai 1 Format Pilihan untuk Semua Penerima
                          </button>
                        </div>
                      </div>

                      {editingProject.templateMode === 'single_template' ? (
                        <div className="space-y-2 pt-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            Pilih Format Template yang Akan Dikirim:
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {store.templates.map((tpl) => {
                              const isChosen =
                                (editingProject.templateId || store.templates[0]?.id) === tpl.id;
                              return (
                                <label
                                  key={tpl.id}
                                  onClick={() =>
                                    setEditingProject({
                                      ...editingProject,
                                      templateMode: 'single_template',
                                      templateId: tpl.id,
                                    })
                                  }
                                  className={`cursor-pointer p-3 rounded-lg border flex flex-col justify-between gap-1 text-xs transition-colors ${
                                    isChosen
                                      ? 'bg-emerald-50 border-emerald-700 font-bold text-slate-900'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name="projSingleTemplate"
                                      checked={isChosen}
                                      onChange={() => {}}
                                      className="w-4 h-4 accent-emerald-700 shrink-0"
                                    />
                                    <span className="truncate">{tpl.name}</span>
                                  </div>
                                  <span className="text-[11px] font-normal text-slate-500 pl-6">
                                    Kategori: <strong className="uppercase">{tpl.category}</strong>
                                    {tpl.isDefault ? ' · Default' : ''}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Format untuk Kontak Kategori <strong>DETAIL / LENGKAP</strong>:
                            </label>
                            <select
                              value={
                                editingProject.detailTemplateId ||
                                defaultLengkapTpl?.id ||
                                store.templates[0]?.id ||
                                ''
                              }
                              onChange={(e) =>
                                setEditingProject({
                                  ...editingProject,
                                  detailTemplateId: e.target.value,
                                })
                              }
                              className="w-full min-h-[40px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                            >
                              {store.templates.map((tpl) => (
                                <option key={tpl.id} value={tpl.id}>
                                  {tpl.name} ({tpl.category.toUpperCase()})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Format untuk Kontak Kategori <strong>SINGKAT</strong>:
                            </label>
                            <select
                              value={
                                editingProject.singkatTemplateId ||
                                defaultSingkatTpl?.id ||
                                store.templates[1]?.id ||
                                ''
                              }
                              onChange={(e) =>
                                setEditingProject({
                                  ...editingProject,
                                  singkatTemplateId: e.target.value,
                                })
                              }
                              className="w-full min-h-[40px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                            >
                              {store.templates.map((tpl) => (
                                <option key={tpl.id} value={tpl.id}>
                                  {tpl.name} ({tpl.category.toUpperCase()})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* TARGET KONTAK PENERIMA PROJEK (SEMUA KONTAK / GRUP KONTAK / KONTAK SATUAN) */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-900">
                            Target Kontak Penerima Projek Ini (Semua / Grup Kontak / Kontak Satuan):
                          </label>
                          <p className="text-[11px] text-slate-600">
                            Pilih apakah pesan projek ini dikirim ke semua jamaah, berdasarkan grup kontak, atau pilih kontak satuan.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProject({
                                ...editingProject,
                                targetMode: 'all',
                              })
                            }
                            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              (editingProject.targetMode || 'all') === 'all'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            Semua Kontak ({store.contacts.filter((c) => c.isActive).length})
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProject({
                                ...editingProject,
                                targetMode: 'groups',
                                targetGroups:
                                  editingProject.targetGroups &&
                                  editingProject.targetGroups.length > 0
                                    ? editingProject.targetGroups
                                    : allContactGroups.length > 0
                                    ? [allContactGroups[0]]
                                    : [],
                              })
                            }
                            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              editingProject.targetMode === 'groups'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            Grup Kontak ({allContactGroups.length} grup)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProject({
                                ...editingProject,
                                targetMode: 'contacts',
                                targetContactIds:
                                  editingProject.targetContactIds &&
                                  editingProject.targetContactIds.length > 0
                                    ? editingProject.targetContactIds
                                    : store.contacts[0]
                                    ? [store.contacts[0].id]
                                    : [],
                              })
                            }
                            className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              editingProject.targetMode === 'contacts'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            Kontak Satuan
                          </button>
                        </div>
                      </div>

                      {editingProject.targetMode === 'groups' && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span>Centang satu atau beberapa grup kontak jamaah:</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingProject({
                                    ...editingProject,
                                    targetGroups: [...allContactGroups],
                                  })
                                }
                                className="text-emerald-800 hover:underline font-semibold"
                              >
                                Pilih Semua Grup
                              </button>
                              <span>·</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingProject({
                                    ...editingProject,
                                    targetGroups: [],
                                  })
                                }
                                className="text-slate-600 hover:underline"
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {allContactGroups.map((grp) => {
                              const grpCount = store.contacts.filter(
                                (c) =>
                                  c.isActive && (c.groupTag || 'Jamaah Umum').trim() === grp
                              ).length;
                              const isSelected = (editingProject.targetGroups || []).includes(grp);
                              return (
                                <label
                                  key={grp}
                                  onClick={() => {
                                    const cur = editingProject.targetGroups || [];
                                    const next = isSelected
                                      ? cur.filter((g) => g !== grp)
                                      : [...cur, grp];
                                    setEditingProject({
                                      ...editingProject,
                                      targetGroups: next,
                                    });
                                  }}
                                  className={`cursor-pointer p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                                    isSelected
                                      ? 'bg-emerald-50 border-emerald-700 font-bold text-slate-900'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {}}
                                      className="w-4 h-4 accent-emerald-700 shrink-0"
                                    />
                                    <span className="truncate">{grp}</span>
                                  </div>
                                  <span className="font-mono-num text-emerald-800">
                                    {grpCount} kontak
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {editingProject.targetMode === 'contacts' && (
                        <div className="space-y-2.5 pt-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <input
                              type="text"
                              value={projectContactSearch}
                              onChange={(e) => setProjectContactSearch(e.target.value)}
                              placeholder="Cari nama, nomor WA, atau grup kontak..."
                              className="w-full sm:w-72 min-h-[36px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                            />
                            <div className="flex items-center gap-2 text-[11px]">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingProject({
                                    ...editingProject,
                                    targetContactIds: store.contacts
                                      .filter((c) => c.isActive)
                                      .map((c) => c.id),
                                  })
                                }
                                className="text-emerald-800 hover:underline font-semibold"
                              >
                                Pilih Semua ({store.contacts.filter((c) => c.isActive).length})
                              </button>
                              <span>·</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingProject({
                                    ...editingProject,
                                    targetContactIds: [],
                                  })
                                }
                                className="text-slate-600 hover:underline"
                              >
                                Hapus Pilihan
                              </button>
                            </div>
                          </div>

                          <div className="max-h-52 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
                            {store.contacts
                              .filter((c) => c.isActive)
                              .filter((c) => {
                                if (!projectContactSearch.trim()) return true;
                                const q = projectContactSearch.toLowerCase();
                                return (
                                  c.name.toLowerCase().includes(q) ||
                                  c.phone.toLowerCase().includes(q) ||
                                  (c.groupTag || '').toLowerCase().includes(q)
                                );
                              })
                              .map((c) => {
                                const isChecked = (
                                  editingProject.targetContactIds || []
                                ).includes(c.id);
                                return (
                                  <label
                                    key={c.id}
                                    onClick={() => {
                                      const cur = editingProject.targetContactIds || [];
                                      const next = isChecked
                                        ? cur.filter((id) => id !== c.id)
                                        : [...cur, c.id];
                                      setEditingProject({
                                        ...editingProject,
                                        targetContactIds: next,
                                      });
                                    }}
                                    className={`cursor-pointer p-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                                      isChecked
                                        ? 'bg-emerald-50 border-emerald-700 font-bold text-slate-900'
                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}}
                                        className="w-4 h-4 accent-emerald-700 shrink-0"
                                      />
                                      <div className="truncate">
                                        <p className="truncate">{c.name}</p>
                                        <p className="text-[11px] font-normal text-slate-500 font-mono-num">
                                          {c.phone} · {c.groupTag || 'Jamaah Umum'}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                                      {c.preference === 'singkat' ? 'Singkat' : 'Detail'}
                                    </span>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/80 flex items-center justify-between">
                        <span>
                          Total Penerima Aktif untuk Projek Ini:{' '}
                          <strong className="font-mono-num text-emerald-800">
                            {getTargetContactsForProject(editingProject, store.contacts).length}{' '}
                            kontak
                          </strong>
                        </span>
                        <span className="text-slate-500">
                          {editingProject.targetMode === 'groups'
                            ? `Grup: ${(editingProject.targetGroups || []).join(', ') || '-'}`
                            : editingProject.targetMode === 'contacts'
                            ? `${(editingProject.targetContactIds || []).length} kontak satuan dipilih`
                            : 'Semua kontak jamaah aktif'}
                        </span>
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

                {/* LIST OF BDI PROJECTS WITH PAUSE, RESUME, STOP, RUN NOW & PER-PROJECT LOG MENU */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(store.projects || []).map((proj) => {
                    const projectHadithPool = store.hadiths.filter((h) =>
                      (proj.selectedProfiles || []).includes(h.profileName || 'Belum Terkategori')
                    );
                    const poolCount = projectHadithPool.length;
                    const sentHadithInPool = projectHadithPool.filter((h) => h.isSent).length;
                    const currentStep =
                      proj.selectionOrder === 'sequential'
                        ? Math.min(poolCount, proj.currentDatabaseIndex || 0)
                        : sentHadithInPool;
                    const progressPercent =
                      poolCount > 0 ? Math.min(100, Math.round((currentStep / poolCount) * 100)) : 0;

                    const projLogs = (store.deliveryLogs || []).filter(
                      (l) => l.projectId === proj.id || l.projectName === proj.name
                    );
                    const projHistory = (store.projectHistory || []).filter(
                      (h) => h.projectId === proj.id || h.projectName === proj.name
                    );
                    const projQueued = projLogs.filter(
                      (l) => l.status === 'queued' || l.status === 'sending'
                    ).length;
                    const projPaused = projLogs.filter((l) => l.status === 'paused').length;
                    const projSent = projLogs.filter((l) => l.status === 'sent').length;
                    const projFailed = projLogs.filter((l) => l.status === 'failed').length;
                    const isLogOpen = activeLogProjectId === proj.id;
                    const effectivePool =
                      projectHadithPool.length > 0 ? projectHadithPool : store.hadiths;
                    const activeHadithIndex = Math.min(
                      Math.max(0, effectivePool.length - 1),
                      Math.max(0, proj.currentDatabaseIndex || 0)
                    );
                    const activeHadithItem = effectivePool[activeHadithIndex];
                    const activeRunHadithItem =
                      (proj.activeRun?.hadithId
                        ? store.hadiths.find((h) => h.id === proj.activeRun?.hadithId)
                        : null) || activeHadithItem;

                    return (
                      <div
                        key={proj.id}
                        className={`bg-white border border-slate-200 rounded-xl p-5 space-y-4 flex flex-col justify-between ${
                          isLogOpen ? 'md:col-span-2 ring-1 ring-emerald-700/30' : ''
                        }`}
                      >
                        <div className="space-y-3">
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
                                  setEditingProject({
                                    ...proj,
                                    scheduleFrequency: proj.scheduleFrequency || 'daily',
                                    scheduleDays:
                                      Array.isArray(proj.scheduleDays) &&
                                      proj.scheduleDays.length > 0
                                        ? proj.scheduleDays
                                        : [0, 1, 2, 3, 4, 5, 6],
                                    targetMode: proj.targetMode || 'all',
                                    targetGroups: Array.isArray(proj.targetGroups)
                                      ? proj.targetGroups
                                      : [],
                                    targetContactIds: Array.isArray(proj.targetContactIds)
                                      ? proj.targetContactIds
                                      : [],
                                    templateMode: proj.templateMode || 'auto_contact',
                                    templateId:
                                      proj.templateId || store.templates[0]?.id || '',
                                    detailTemplateId:
                                      proj.detailTemplateId ||
                                      defaultLengkapTpl?.id ||
                                      store.templates[0]?.id ||
                                      '',
                                    singkatTemplateId:
                                      proj.singkatTemplateId ||
                                      defaultSingkatTpl?.id ||
                                      store.templates[1]?.id ||
                                      '',
                                  });
                                  setProjectContactSearch('');
                                  setShowProjectForm(true);
                                }}
                                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                                title="Edit Projek"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearProjectLogs(proj.id, 'all')}
                                className="px-2.5 py-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 text-xs font-semibold transition-colors"
                                title="Hapus / Bersihkan Seluruh Log Pengiriman Projek Ini"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>Hapus Log</span>
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

                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1.5">
                            <p>
                              <strong>Jam Kirim:</strong>{' '}
                              <span className="font-mono-num font-bold text-slate-900">
                                {proj.sendTime} {proj.timezone || 'WITA'}
                              </span>{' '}
                              · <strong>Urutan:</strong>{' '}
                              {proj.selectionOrder === 'random' ? 'Random (Acak)' : 'Berurutan'}
                            </p>
                            <p>
                              <strong>Jadwal Hari:</strong>{' '}
                              <span className="font-semibold text-emerald-800">
                                {formatProjectScheduleDays(proj)}
                              </span>
                            </p>
                            <p>
                              <strong>Format Kirim:</strong>{' '}
                              <span className="font-semibold text-slate-900">
                                {proj.templateMode === 'single_template'
                                  ? `1 Format (${
                                      store.templates.find((t) => t.id === proj.templateId)?.name ||
                                      store.templates[0]?.name ||
                                      'Default'
                                    })`
                                  : `Otomatis Kategori Kontak (${
                                      store.templates.find((t) => t.id === proj.detailTemplateId)
                                        ?.name ||
                                      defaultLengkapTpl?.name ||
                                      'Lengkap'
                                    } / ${
                                      store.templates.find((t) => t.id === proj.singkatTemplateId)
                                        ?.name ||
                                      defaultSingkatTpl?.name ||
                                      'Singkat'
                                    })`}
                              </span>
                            </p>
                            <p>
                              <strong>Target Kontak:</strong>{' '}
                              <span className="font-semibold text-slate-900">
                                {proj.targetMode === 'groups'
                                  ? `Grup Kontak (${(proj.targetGroups || []).join(', ') || 'Semua'})`
                                  : proj.targetMode === 'contacts'
                                  ? `Kontak Satuan (${getTargetContactsForProject(proj, store.contacts).length} orang dipilih)`
                                  : `Semua Kontak Aktif (${getTargetContactsForProject(proj, store.contacts).length} orang)`}
                              </span>
                            </p>
                            <p>
                              <strong>Profil Database:</strong>{' '}
                              {(proj.selectedProfiles || []).join(', ')} ({poolCount} materi)
                            </p>
                            <p>
                              <strong>Interval Acak Anti-Blokir:</strong>{' '}
                              <span className="font-mono-num">
                                {proj.minDelaySeconds}s – {proj.maxDelaySeconds}s
                              </span>{' '}
                              · Total Terkirim:{' '}
                              <span className="font-mono-num font-bold text-slate-900">
                                {proj.totalSentCount || 0}
                              </span>{' '}
                              pesan
                            </p>

                            {/* Panel Kontrol Materi Hadis Terjadwal: Selanjutnya, Sebelumnya, & Pilih No Hadis */}
                            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/90 rounded-xl space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] font-bold text-emerald-950 uppercase tracking-wide flex items-center gap-1">
                                      <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                                      <span>Materi Hadis Aktif:</span>
                                    </span>
                                    <span className="bg-emerald-700 text-white font-mono-num font-bold px-1.5 py-0.5 rounded text-[10px]">
                                      No. {activeHadithIndex + 1} dari {effectivePool.length}
                                    </span>
                                    {activeHadithItem?.hadithDegree && (
                                      <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold px-1.5 py-0.5 rounded text-[10px]">
                                        {activeHadithItem.hadithDegree}
                                      </span>
                                    )}
                                    {proj.selectionOrder === 'random' && (
                                      <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded font-medium">
                                        Mode Acak
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5 flex-wrap">
                                    <span>
                                      {activeHadithItem
                                        ? `“${activeHadithItem.title}”`
                                        : 'Belum ada hadis dalam database'}
                                    </span>
                                    {activeHadithItem?.sourceBook && (
                                      <span className="text-[11px] font-normal text-slate-600">
                                        ({activeHadithItem.sourceBook}
                                        {activeHadithItem.hadithNumber ? ` No. ${activeHadithItem.hadithNumber}` : ''})
                                      </span>
                                    )}
                                  </h4>
                                </div>

                                {/* Tombol Selanjutnya, Sebelumnya & Pilih No Hadis */}
                                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleProjectAction(proj.id, 'prev_hadith')}
                                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1 transition-colors"
                                    title="Pilih hadis sebelumnya dalam urutan database"
                                  >
                                    <span>⏮ Sebelumnya</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleProjectAction(proj.id, 'next_hadith')}
                                    className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1 transition-colors"
                                    title="Lompat ke hadis selanjutnya dalam urutan"
                                  >
                                    <span>Selanjutnya ⏭</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setHadithPickerProject(proj);
                                      setHadithPickerSearch('');
                                      setJumpHadithNumberInput(String(activeHadithIndex + 1));
                                    }}
                                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1 transition-colors"
                                    title="Pilih langsung hadis nomor berapa yang ingin dikirim"
                                  >
                                    <ListFilter className="w-3.5 h-3.5" />
                                    <span>Pilih No Hadis</span>
                                  </button>
                                </div>
                              </div>

                              {/* TAMPILAN LANGSUNG ISI HADIS (ARAB & TERJEMAHAN) */}
                              {activeHadithItem ? (
                                <div className="space-y-2 pt-2 border-t border-emerald-200/90">
                                  {/* Teks Arab Langsung */}
                                  {activeHadithItem.arabicText && (
                                    <div className="p-3 bg-white rounded-lg border border-emerald-200 shadow-2xs space-y-1">
                                      <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-950 pb-1 border-b border-emerald-100">
                                        <span className="flex items-center gap-1">
                                          <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                                          <span>Teks Arab Hadis:</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">
                                          {activeHadithItem.sourceBook}{' '}
                                          {activeHadithItem.hadithNumber ? `No. ${activeHadithItem.hadithNumber}` : ''}
                                        </span>
                                      </div>
                                      <p
                                        dir="rtl"
                                        className="text-right text-base sm:text-lg leading-loose text-slate-900 font-serif tracking-wide select-text py-1"
                                        style={{ fontFamily: "'Traditional Arabic', 'Scheherazade New', 'Amiri', 'Lateef', serif" }}
                                      >
                                        {activeHadithItem.arabicText}
                                      </p>
                                    </div>
                                  )}

                                  {/* Terjemahan / Isi Hadis Langsung */}
                                  {activeHadithItem.translationText && (
                                    <div className="p-3 bg-white rounded-lg border border-emerald-200 shadow-2xs space-y-1">
                                      <div className="text-[11px] font-semibold text-emerald-950 pb-1 border-b border-emerald-100 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-700 inline-block"></span>
                                        <span>Terjemahan / Isi Hadis:</span>
                                      </div>
                                      <p className="text-xs sm:text-sm text-slate-800 leading-relaxed italic select-text">
                                        &ldquo;{activeHadithItem.translationText}&rdquo;
                                      </p>
                                    </div>
                                  )}

                                  {/* Intisari & Pelajaran (jika ada) */}
                                  {(activeHadithItem.shortSummary || activeHadithItem.lessonText) && (
                                    <div className="p-2.5 bg-emerald-100/70 rounded-lg text-xs text-emerald-950 border border-emerald-200/80 space-y-1">
                                      {activeHadithItem.shortSummary && (
                                        <p className="leading-relaxed">
                                          <strong>Intisari:</strong> {activeHadithItem.shortSummary}
                                        </p>
                                      )}
                                      {activeHadithItem.lessonText && (
                                        <p className="leading-relaxed">
                                          <strong>Pelajaran/Faedah:</strong> {activeHadithItem.lessonText}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>

                            {/* Progress Bar Materi & Ringkasan Status Log Projek */}
                            <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-slate-700">
                                  Progres Materi Database:{' '}
                                  <strong className="font-mono-num text-slate-900">
                                    {currentStep} / {poolCount}
                                  </strong>{' '}
                                  ({progressPercent}%)
                                </span>
                                <span className="font-mono-num text-slate-600">
                                  Antrean: <strong>{projQueued}</strong> · Terkirim:{' '}
                                  <strong className="text-emerald-700">{projSent}</strong> · Gagal:{' '}
                                  <strong className="text-red-700">{projFailed}</strong>
                                </span>
                              </div>
                              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-600 transition-all duration-300"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>

                            {/* Active Run Banner (Cross-refresh Anti-Dobel & Realtime Server Queue) */}
                            {proj.activeRun && proj.activeRun.status !== 'completed' && (
                              <div
                                className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                                  proj.status === 'paused' || proj.activeRun.status === 'paused'
                                    ? 'bg-amber-50/95 border-amber-300'
                                    : 'bg-emerald-50/90 border-emerald-300'
                                }`}
                              >
                                <div
                                  className={`flex items-center justify-between font-bold ${
                                    proj.status === 'paused' || proj.activeRun.status === 'paused'
                                      ? 'text-amber-950'
                                      : 'text-emerald-950'
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5 truncate">
                                    {proj.status === 'paused' || proj.activeRun.status === 'paused' ? (
                                      <span className="inline-flex items-center justify-center w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                                    ) : (
                                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                                      </span>
                                    )}
                                    <span className="truncate">
                                      {proj.status === 'paused' || proj.activeRun.status === 'paused'
                                        ? `Dijeda (Paused): \u201c${activeRunHadithItem?.title || proj.activeRun.hadithTitle}\u201d`
                                        : `Sedang Mengirim: \u201c${activeRunHadithItem?.title || proj.activeRun.hadithTitle}\u201d`}
                                    </span>
                                  </span>
                                  <span
                                    className={`font-mono-num text-[11px] px-2 py-0.5 rounded shrink-0 font-bold ${
                                      proj.status === 'paused' || proj.activeRun.status === 'paused'
                                        ? 'bg-amber-200 text-amber-900'
                                        : 'bg-emerald-200/90 text-emerald-900'
                                    }`}
                                  >
                                    {proj.activeRun.sentContactIds?.length || 0} /{' '}
                                    {proj.activeRun.totalContacts} Selesai
                                  </span>
                                </div>
                                <p
                                  className={`text-[11px] leading-relaxed ${
                                    proj.status === 'paused' || proj.activeRun.status === 'paused'
                                      ? 'text-amber-900 font-medium'
                                      : 'text-emerald-800'
                                  }`}
                                >
                                  {proj.status === 'paused' || proj.activeRun.status === 'paused'
                                    ? `Pengiriman sedang dijeda sementara (${projPaused} antrean kontak dibekukan). Klik tombol "Resume" di bawah kapan pun Anda siap melanjutkan.`
                                    : 'Pengiriman sedang berjalan di server dengan jeda acak. Halaman aman di-refresh atau dibuka dari perangkat lain tanpa resiko dobel kirim (Proteksi Anti-Dobel).'}
                                </p>

                                {/* PREVIEW LANGSUNG ISI HADIS YANG SEDANG DIKIRIM */}
                                {activeRunHadithItem && (
                                  <div className="p-3 bg-white/95 rounded-lg border border-emerald-300/90 shadow-2xs space-y-2 text-slate-800">
                                    <div className="flex items-center justify-between gap-2 border-b border-emerald-100 pb-1.5 flex-wrap">
                                      <div className="flex items-center gap-1.5 font-bold text-emerald-950 text-xs">
                                        <BookOpen className="w-4 h-4 text-emerald-700 shrink-0" />
                                        <span>Isi Hadis Sedang Dikirim Langsung:</span>
                                        <span className="text-slate-900 font-extrabold">&ldquo;{activeRunHadithItem.title}&rdquo;</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-[11px] text-slate-600 flex-wrap">
                                        <span className="font-semibold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                          {activeRunHadithItem.sourceBook || 'Hadis Shahih'}
                                          {activeRunHadithItem.hadithNumber ? ` No. ${activeRunHadithItem.hadithNumber}` : ''}
                                        </span>
                                        {activeRunHadithItem.hadithDegree && (
                                          <span className="bg-emerald-700 text-white font-semibold px-2 py-0.5 rounded text-[10px]">
                                            {activeRunHadithItem.hadithDegree}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Teks Arab Asli */}
                                    {activeRunHadithItem.arabicText && (
                                      <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200/70">
                                        <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block"></span>
                                          <span>Teks Arab Hadis:</span>
                                        </div>
                                        <p
                                          dir="rtl"
                                          className="text-right text-base sm:text-lg leading-loose text-slate-900 font-serif tracking-wide select-text py-1"
                                          style={{ fontFamily: "'Traditional Arabic', 'Scheherazade New', 'Amiri', 'Lateef', serif" }}
                                        >
                                          {activeRunHadithItem.arabicText}
                                        </p>
                                      </div>
                                    )}

                                    {/* Terjemahan / Isi Hadis */}
                                    {activeRunHadithItem.translationText && (
                                      <div className="p-3 bg-slate-50/90 rounded-lg border border-slate-200">
                                        <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block"></span>
                                          <span>Terjemahan / Isi Hadis:</span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-800 leading-relaxed italic select-text">
                                          &ldquo;{activeRunHadithItem.translationText}&rdquo;
                                        </p>
                                      </div>
                                    )}

                                    {/* Intisari & Pelajaran */}
                                    {(activeRunHadithItem.shortSummary || activeRunHadithItem.lessonText) && (
                                      <div className="p-2.5 bg-amber-50/90 rounded-lg text-xs text-amber-950 border border-amber-200 space-y-0.5">
                                        {activeRunHadithItem.shortSummary && (
                                          <p className="leading-relaxed">
                                            <strong>Intisari:</strong> {activeRunHadithItem.shortSummary}
                                          </p>
                                        )}
                                        {activeRunHadithItem.lessonText && (
                                          <p className="leading-relaxed">
                                            <strong>Pelajaran/Faedah:</strong> {activeRunHadithItem.lessonText}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {proj.lastTriggeredDate && (
                              <div className="p-2 bg-slate-100/90 border border-slate-200 rounded-lg text-[11px] text-slate-700 flex flex-wrap items-center justify-between gap-1">
                                <span>
                                  <strong>Jadwal Terakhir:</strong> {proj.lastTriggeredDate} · Proteksi Anti-Dobel Aktif
                                </span>
                                <span className="font-mono-num text-slate-500">
                                  {projQueued > 0
                                    ? `${projQueued} pesan tersisa dalam antrean`
                                    : 'Semua kontak hari ini telah terlayani'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Controls: Pause, Resume, Stop, Log Projek, Hapus Log, Run Now */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                          {proj.status === 'running' ? (
                            <button
                              type="button"
                              onClick={() => handleProjectAction(proj.id, 'pause')}
                              className="min-h-[40px] px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                            >
                              <Pause className="w-3.5 h-3.5" />
                              <span>Pause</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleProjectAction(proj.id, 'resume')}
                              className="min-h-[40px] px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Resume</span>
                            </button>
                          )}

                          {proj.status !== 'stopped' && (
                            <button
                              type="button"
                              onClick={() => handleProjectAction(proj.id, 'stop')}
                              className="min-h-[40px] px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                            >
                              <Square className="w-3.5 h-3.5" />
                              <span>Stop</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setActiveLogProjectId(isLogOpen ? null : proj.id)
                            }
                            className={`min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 border transition-colors ${
                              isLogOpen
                                ? 'bg-emerald-50 border-emerald-700 text-emerald-900'
                                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                            }`}
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>
                              {isLogOpen
                                ? 'Tutup Log Projek'
                                : `Log & Progres (${projLogs.length + projHistory.length})`}
                            </span>
                          </button>

                          {/* Tombol Hapus Log Langsung di Baris Kontrol Projek */}
                          {projLogs.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleClearProjectLogs(proj.id, 'messages')}
                              className="min-h-[40px] px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                              title="Hapus semua log pesan untuk projek ini"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Hapus Log ({projLogs.length})</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleProjectAction(proj.id, 'run_now')}
                            className="ml-auto min-h-[40px] px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                            title={`Kirim Hadis No. ${activeHadithIndex + 1} sekarang`}
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>
                              {projQueued > 0
                                ? `Kirim Sekarang (${projQueued} Antre)`
                                : `Kirim Hadis No. ${activeHadithIndex + 1} Sekarang`}
                            </span>
                          </button>
                        </div>

                        {/* DEDICATED PER-PROJECT LOG & PROGRESS DRAWER */}
                        {isLogOpen && (
                          <div className="pt-4 border-t border-slate-200 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-950/5 border border-emerald-900/15 p-3 rounded-xl">
                              <div>
                                <h4 className="text-xs font-bold text-slate-900">
                                  Menu Log &amp; Pantauan Progres: {proj.name}
                                </h4>
                                <p className="text-[11px] text-slate-600">
                                  Log dikelompokkan berdasarkan tanggal. Klik tanggal untuk menampilkan atau menyembunyikan detail riwayat.
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                                  <button
                                    type="button"
                                    onClick={() => setProjectLogViewTab('antrean')}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                                      projectLogViewTab === 'antrean'
                                        ? 'bg-emerald-700 text-white'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    Log Pesan Kontak ({projLogs.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setProjectLogViewTab('aktivitas')}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                                      projectLogViewTab === 'aktivitas'
                                        ? 'bg-emerald-700 text-white'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    Riwayat Eksekusi ({projHistory.length})
                                  </button>
                                </div>

                                {projectLogViewTab === 'antrean' && projLogs.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleClearProjectLogs(proj.id, 'messages')}
                                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                                    title="Hapus semua log pesan untuk projek ini"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Hapus Semua Log</span>
                                  </button>
                                )}

                                {projectLogViewTab === 'aktivitas' && projHistory.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleClearProjectLogs(proj.id, 'history')}
                                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                                    title="Hapus riwayat eksekusi projek ini"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Hapus Riwayat</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Statistik Ringkas Progres Projek */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-[11px] text-amber-800 font-semibold">
                                  Sedang Antre / Kirim
                                </p>
                                <p className="text-sm font-bold font-mono-num text-amber-900">
                                  {projQueued} kontak
                                </p>
                              </div>
                              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                                <p className="text-[11px] text-slate-600 font-semibold">
                                  Dijeda (Paused)
                                </p>
                                <p className="text-sm font-bold font-mono-num text-slate-800">
                                  {projPaused} kontak
                                </p>
                              </div>
                              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                                <p className="text-[11px] text-emerald-800 font-semibold">
                                  Berhasil Terkirim
                                </p>
                                <p className="text-sm font-bold font-mono-num text-emerald-900">
                                  {projSent} pesan
                                </p>
                              </div>
                              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-[11px] text-red-800 font-semibold">
                                  Gagal / Dihentikan
                                </p>
                                <p className="text-sm font-bold font-mono-num text-red-900">
                                  {projFailed} pesan
                                </p>
                              </div>
                            </div>

                            {/* =========================================================
                                LOG PESAN KONTAK: DIKELOMPOKKAN BERDASARKAN TANGGAL (ACCORDION)
                               ========================================================= */}
                            {projectLogViewTab === 'antrean' ? (
                              projLogs.length === 0 ? (
                                <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                                  Belum ada log pengiriman pesan WA untuk projek <strong>{proj.name}</strong>. Klik tombol <strong>&ldquo;Kirim Sekarang&rdquo;</strong> atau tunggu jam jadwal aktif untuk melihat progres pengiriman per kontak.
                                </div>
                              ) : (
                                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                                  {(() => {
                                    const map: Record<string, { dateStr: string; displayDate: string; logs: DeliveryLog[] }> = {};
                                    projLogs.forEach((log) => {
                                      const rawDate = log.timestamp ? log.timestamp.slice(0, 10) : 'Tanpa Tanggal';
                                      if (!map[rawDate]) {
                                        let displayDate = rawDate;
                                        try {
                                          const [y, m, d] = rawDate.split('-');
                                          if (y && m && d) {
                                            const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
                                            displayDate = dateObj.toLocaleDateString('id-ID', {
                                              weekday: 'long',
                                              day: 'numeric',
                                              month: 'long',
                                              year: 'numeric',
                                            });
                                          }
                                        } catch {
                                          displayDate = rawDate;
                                        }
                                        map[rawDate] = { dateStr: rawDate, displayDate, logs: [] };
                                      }
                                      map[rawDate].logs.push(log);
                                    });
                                    const groups = Object.values(map).sort((a, b) => b.dateStr.localeCompare(a.dateStr));

                                    return groups.map((group, groupIdx) => {
                                      const dateKey = `${proj.id}-${group.dateStr}`;
                                      const isDateOpen = expandedLogDates[dateKey] ?? (groupIdx === 0);
                                      const sentCount = group.logs.filter((l) => l.status === 'sent').length;
                                      const failedCount = group.logs.filter((l) => l.status === 'failed' || l.status === 'stopped').length;
                                      const queuedCount = group.logs.filter((l) => l.status === 'queued' || l.status === 'sending').length;

                                      return (
                                        <div
                                          key={group.dateStr}
                                          className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs"
                                        >
                                          {/* Header Grup Tanggal (Klik untuk Tampilkan / Sembunyikan) */}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setExpandedLogDates((prev) => ({
                                                ...prev,
                                                [dateKey]: !isDateOpen,
                                              }));
                                            }}
                                            className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/90 transition-colors text-left"
                                          >
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <Calendar className="w-4 h-4 text-emerald-700" />
                                              <span className="text-xs font-bold text-slate-800">
                                                {group.displayDate}
                                              </span>
                                              <span className="text-[11px] font-mono-num bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-600 font-semibold">
                                                {group.logs.length} pesan
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                              <div className="text-[11px] font-mono-num text-slate-600 hidden sm:flex items-center gap-1.5">
                                                <span className="text-emerald-700 font-semibold">✓ {sentCount} Sukses</span>
                                                {failedCount > 0 && <span className="text-red-700 font-semibold">· ✕ {failedCount} Gagal</span>}
                                                {queuedCount > 0 && <span className="text-amber-700 font-semibold">· ⏳ {queuedCount} Antre</span>}
                                              </div>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleClearProjectLogs(proj.id, 'messages', group.dateStr);
                                                }}
                                                className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded transition-colors"
                                                title={`Hapus seluruh log tanggal ${group.displayDate}`}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                              {isDateOpen ? (
                                                <ChevronUp className="w-4 h-4 text-slate-500" />
                                              ) : (
                                                <ChevronDown className="w-4 h-4 text-slate-500" />
                                              )}
                                            </div>
                                          </button>

                                          {/* Konten Log Pesan Dalam Tanggal Ini */}
                                          {isDateOpen && (
                                            <div className="divide-y divide-slate-100 px-3 py-1 bg-white max-h-72 overflow-y-auto">
                                              {group.logs.map((log) => {
                                                const remSec = Math.max(0, Math.ceil((log.scheduledAtMs - Date.now()) / 1000));
                                                return (
                                                  <div
                                                    key={log.id}
                                                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                                  >
                                                    <div className="space-y-0.5">
                                                      <div className="flex flex-wrap items-center gap-1.5">
                                                        {log.status === 'sent' && (
                                                          <span className="font-bold text-emerald-700">✓ TERKIRIM</span>
                                                        )}
                                                        {(log.status === 'queued' || log.status === 'sending') && (
                                                          <span className="font-bold text-amber-700">
                                                            ⏳ ANTREAN ({remSec > 0 ? `${remSec}s` : 'Mengirim...'})
                                                          </span>
                                                        )}
                                                        {log.status === 'paused' && (
                                                          <span className="font-bold text-amber-800">❚❚ DIJEDA</span>
                                                        )}
                                                        {log.status === 'stopped' && (
                                                          <span className="font-bold text-slate-500">■ DIHENTIKAN</span>
                                                        )}
                                                        {log.status === 'failed' && (
                                                          <span className="font-bold text-red-700">✕ GAGAL</span>
                                                        )}
                                                        <span>·</span>
                                                        <span className="font-bold text-slate-900">{log.contactName}</span>
                                                        <span className="font-mono-num text-slate-500">({log.contactPhone})</span>
                                                        <span>·</span>
                                                        <span className="font-mono-num text-slate-500">Jeda +{log.randomDelayAppliedSec}s</span>
                                                      </div>
                                                      <p className="text-slate-600">
                                                        Materi: <strong>{log.hadithTitle}</strong>
                                                      </p>
                                                      {log.errorMessage && <p className="text-red-600">{log.errorMessage}</p>}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                      <span className="text-[11px] font-mono-num text-slate-400">
                                                        {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                                                      </span>
                                                      {(log.status === 'failed' || log.status === 'stopped') && (
                                                        <button
                                                          type="button"
                                                          onClick={() => handleRetryLog(log.id)}
                                                          className="px-2.5 py-1 bg-emerald-700 text-white text-[11px] font-semibold rounded-md"
                                                        >
                                                          Kirim Ulang
                                                        </button>
                                                      )}
                                                      <button
                                                        type="button"
                                                        onClick={() => handleDeleteSingleLog(log.id)}
                                                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Hapus baris log ini"
                                                      >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                      </button>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              )
                            ) : projHistory.length === 0 ? (
                              <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                                Belum ada riwayat aktivitas untuk projek ini.
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                                {(() => {
                                  const map: Record<string, { dateStr: string; displayDate: string; items: typeof projHistory }> = {};
                                  projHistory.forEach((h) => {
                                    const rawDate = h.triggeredAt ? h.triggeredAt.slice(0, 10) : 'Tanpa Tanggal';
                                    if (!map[rawDate]) {
                                      let displayDate = rawDate;
                                      try {
                                        const [y, m, d] = rawDate.split('-');
                                        if (y && m && d) {
                                          const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
                                          displayDate = dateObj.toLocaleDateString('id-ID', {
                                            weekday: 'long',
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric',
                                          });
                                        }
                                      } catch {
                                        displayDate = rawDate;
                                      }
                                      map[rawDate] = { dateStr: rawDate, displayDate, items: [] };
                                    }
                                    map[rawDate].items.push(h);
                                  });
                                  const groups = Object.values(map).sort((a, b) => b.dateStr.localeCompare(a.dateStr));

                                  return groups.map((group, groupIdx) => {
                                    const dateKey = `hist-${proj.id}-${group.dateStr}`;
                                    const isDateOpen = expandedLogDates[dateKey] ?? (groupIdx === 0);

                                    return (
                                      <div
                                        key={group.dateStr}
                                        className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setExpandedLogDates((prev) => ({
                                              ...prev,
                                              [dateKey]: !isDateOpen,
                                            }));
                                          }}
                                          className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/90 transition-colors text-left"
                                        >
                                          <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-emerald-700" />
                                            <span className="text-xs font-bold text-slate-800">
                                              {group.displayDate}
                                            </span>
                                            <span className="text-[11px] font-mono-num bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-600 font-semibold">
                                              {group.items.length} riwayat
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleClearProjectLogs(proj.id, 'history', group.dateStr);
                                              }}
                                              className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded transition-colors"
                                              title={`Hapus riwayat eksekusi tanggal ${group.displayDate}`}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                            {isDateOpen ? (
                                              <ChevronUp className="w-4 h-4 text-slate-500" />
                                            ) : (
                                              <ChevronDown className="w-4 h-4 text-slate-500" />
                                            )}
                                          </div>
                                        </button>

                                        {isDateOpen && (
                                          <div className="divide-y divide-slate-100 px-3 py-1 bg-white max-h-72 overflow-y-auto">
                                            {group.items.map((h) => (
                                              <div
                                                key={h.id}
                                                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                              >
                                                <div className="space-y-0.5">
                                                  <p className="font-bold text-slate-900">{h.hadithTitle}</p>
                                                  <p className="text-slate-600">
                                                    {h.notes} · Target:{' '}
                                                    <strong className="font-mono-num">
                                                      {h.contactCount} kontak
                                                    </strong>
                                                  </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                  <span className="text-[11px] font-mono-num text-slate-500">
                                                    {new Date(h.triggeredAt).toLocaleString('id-ID')}
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteSingleProjectHistory(proj.id, h.id)}
                                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Hapus baris riwayat ini"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUB-TAB: HISTORI PENGIRIMAN PROJEK */}
            {kirimSubTab === 'histori' && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Histori Pengiriman &amp; Aktivitas Per BDI Projek
                    </h2>
                    <p className="text-xs text-slate-600">
                      Rekam jejak seluruh eksekusi jadwal otomatis, pengiriman langsung, serta riwayat Pause, Resume, dan Stop.
                    </p>
                  </div>
                  <select
                    value={historyProjectFilter}
                    onChange={(e) => setHistoryProjectFilter(e.target.value)}
                    className="min-h-[38px] px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                  >
                    <option value="all">Semua BDI Projek</option>
                    {(store.projects || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        Filter: {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {!store.projectHistory || store.projectHistory.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Belum ada histori pengiriman projek.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {store.projectHistory
                      .filter(
                        (h) =>
                          historyProjectFilter === 'all' || h.projectId === historyProjectFilter
                      )
                      .map((h) => (
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
            TAB 5: WA ADMIN, BACKUP GOOGLE DRIVE & LAPORAN
           ============================================================ */}
        {activeTab === 'sistem' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-slate-900">
                  05. WA Admin Headless, Backup Google Drive &amp; Laporan
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Tautkan WA Admin dengan QR Code / Pairing Code instan, dan backup otomatis ke Google Drive.
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
                        Status Soket WA Asli:{' '}
                        <span
                          className={`uppercase ${
                            waState.status === 'connected' && waState.realSocketConnected
                              ? 'text-emerald-700'
                              : waState.status === 'connecting' || waState.status === 'qr_ready'
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }`}
                        >
                          {waState.status === 'connected' && waState.realSocketConnected
                            ? `TERHUBUNG NYATA (${waState.connectedPhone || store.gatewaySettings.linkedPhone || store.gatewaySettings.adminPhone})`
                            : waState.hasSavedCreds || store.gatewaySettings.sessionLinked
                            ? `TERHUBUNG & STANDBY (${waState.connectedPhone || store.gatewaySettings.linkedPhone || store.gatewaySettings.adminPhone})`
                            : waState.status === 'qr_ready'
                            ? 'MENUNGGU SCAN QR / INPUT PAIRING CODE'
                            : waState.status === 'connecting'
                            ? 'MENYAMBUNGKAN SOKET WHATSAPP...'
                            : 'BELUM TERTAUT DI SERVER INI (DISCONNECTED)'}
                        </span>
                      </span>
                      {(waState.status !== 'disconnected' || store.gatewaySettings.sessionLinked) && (
                        <button
                          type="button"
                          onClick={handleDisconnectBaileys}
                          className="text-xs text-red-700 font-semibold underline"
                        >
                          Reset / Putuskan Sesi
                        </button>
                      )}
                    </div>

                    {waState.realSocketConnected || waState.hasSavedCreds || store.gatewaySettings.sessionLinked ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center justify-between gap-2">
                        <span>
                          <strong>Soket WhatsApp Aktif &amp; Terverifikasi:</strong> Nomor WA Admin (
                          <span className="font-mono-num font-bold">
                            {waState.connectedPhone || store.gatewaySettings.linkedPhone || store.gatewaySettings.adminPhone}
                          </span>
                          ) tersimpan di server. Pesan otomatis dikirim sesuai jadwal meskipun HP/komputer dimatikan.
                        </span>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-950 space-y-1.5">
                        <p className="font-bold flex items-center gap-1.5 text-amber-900">
                          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>Penautan Sesi WhatsApp Web:</span>
                        </p>
                        <p className="leading-relaxed">
                          Masukkan nomor WA Admin di atas lalu klik tombol <strong>&ldquo;Minta 8-Digit Pairing Code (1 HP)&rdquo;</strong> untuk memasukkan kode di aplikasi WhatsApp Anda, atau scan QR Code jika menggunakan 2 perangkat.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleConnectBaileys('pairing')}
                        className="min-h-[42px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>Minta 8-Digit Pairing Code (Praktis dari HP)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConnectBaileys('qr')}
                        className="min-h-[42px] px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>
                          {waState.status === 'connected' && waState.realSocketConnected
                            ? 'Ganti Perangkat / Scan QR Baru'
                            : 'Tampilkan QR Code Baru'}
                        </span>
                      </button>
                      {(!waState.realSocketConnected || waState.status !== 'connected') && (
                        <button
                          type="button"
                          onClick={handleReconnectBaileys}
                          className="min-h-[42px] px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs"
                          title="Sambungkan kembali sesi WA tersimpan tanpa scan ulang"
                        >
                          <RefreshCw className="w-4 h-4 text-emerald-700" />
                          <span>Sambungkan Ulang Sesi WA (Auto-Reconnect)</span>
                        </button>
                      )}
                    </div>

                    <div className="p-3 bg-slate-100/80 border border-slate-200 rounded-lg text-[11px] text-slate-700 space-y-1">
                      <p className="font-semibold text-slate-900 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Sinkronisasi Sesi WA Lintas Perangkat (PC &amp; HP):</span>
                      </p>
                      <p className="leading-relaxed">
                        Sesi WhatsApp Anda otomatis tersimpan dalam data Cloud Sync &amp; Backup. Jika Anda membuka link Share App di HP atau perangkat lain dengan login Akun Google yang sama, server akan otomatis menyambungkan sesi WhatsApp Anda kembali tanpa perlu scan ulang. Jika sesi sempat tertidur saat server idle, cukup klik <strong>&ldquo;Sambungkan Ulang Sesi WA&rdquo;</strong>.
                      </p>
                    </div>

                    {waState.lastError && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                        Info Koneksi: {waState.lastError}
                      </div>
                    )}

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
                        <p className="text-[11px] text-slate-600">
                          Setelah Anda scan di HP, tunggu 2–4 detik hingga status di atas otomatis berubah menjadi <strong>TERHUBUNG NYATA</strong>.
                        </p>
                        <button
                          type="button"
                          onClick={handleConfirmScanReady}
                          className="w-full min-h-[40px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg"
                        >
                          Cek Status Verifikasi Koneksi WhatsApp
                        </button>
                      </div>
                    )}

                    {waState.pairingCode && (
                      <div className="p-4 bg-white border border-emerald-300 rounded-xl text-center space-y-2">
                        <p className="text-xs text-slate-600">
                          Buka WhatsApp di HP Anda &rarr; <strong>Perangkat Tertaut</strong> &rarr; <strong>Tautkan dengan Nomor Telepon</strong>, lalu masukkan kode 8 digit ini untuk nomor{' '}
                          <strong>{store.gatewaySettings.adminPhone}</strong>:
                        </p>
                        <p className="text-2xl font-bold font-mono-num tracking-widest text-emerald-800">
                          {waState.pairingCode}
                        </p>
                        <p className="text-[11px] text-slate-600">
                          Begitu kode dimasukkan di WhatsApp HP Anda, status akan otomatis berubah menjadi <strong>TERHUBUNG NYATA</strong>.
                        </p>
                        <button
                          type="button"
                          onClick={handleConfirmScanReady}
                          className="w-full min-h-[40px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg"
                        >
                          Cek Status Verifikasi Koneksi WhatsApp
                        </button>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      <strong>Catatan Penting:</strong> Aplikasi kini telah mematikan <em>Mode Simulasi Palsu</em>. Jika WA belum tertaut, tes kirim akan jujur menampilkan status <strong>GAGAL</strong> beserta alasannya, dan baru berstatus <strong>BERHASIL TERKIRIM</strong> jika pesan benar-benar dikirim oleh soket WhatsApp.
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
                                {log.gatewayUsed === 'simulation'
                                  ? 'TERCATAT (SIMULASI)'
                                  : 'BERHASIL TERKIRIM (WA ASLI)'}
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
