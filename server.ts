import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'bdi-store.json');
const WA_AUTH_DIR = path.join(DATA_DIR, 'wa-auth');
const WA_AUTH_BACKUP_FILE = path.join(DATA_DIR, 'wa-auth-bundle.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ==========================================
// 1. DATA INTERFACES & INITIAL SEED DATA
// ==========================================

export interface HadithItem {
  id: string;
  type: 'hadis' | 'quran';
  profileName: string;
  sourceBook: string;
  sourceBookName?: string;
  hadithNumber: string;
  hadithDegree?: string;
  hadithLength?: 'singkat' | 'sedang' | 'panjang';
  title: string;
  arabicText: string;
  translationText: string;
  asbabulWurud: string;
  shortSummary: string;
  lessonText: string;
  categoryTopic: string;
  sequenceOrder: number;
  isSent: boolean;
  createdAt: string;
}

export interface TemplateVariableItem {
  id: string;
  key: string;
  label: string;
  defaultValue: string;
  isSystem?: boolean;
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: 'lengkap' | 'singkat' | 'pengumuman';
  content: string;
  isDefault: boolean;
}

export interface ContactItem {
  id: string;
  name: string;
  phone: string;
  preference: 'singkat' | 'detail';
  groupTag: string;
  isActive: boolean;
  notes: string;
}

export interface ProjectActiveRun {
  batchId: string;
  hadithId: string;
  hadithTitle: string;
  startedAt: string;
  totalContacts: number;
  sentContactIds: string[];
  failedContactIds: string[];
  pendingContactIds: string[];
  status: 'running' | 'completed' | 'paused' | 'stopped';
}

export interface BdiProject {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'stopped';
  sendTime: string;
  timezone?: 'WIB' | 'WITA' | 'WIT';
  scheduleFrequency?: 'daily' | 'weekly' | 'custom_days';
  scheduleDays?: number[]; // 0=Minggu, 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu
  targetMode?: 'all' | 'groups' | 'contacts';
  targetGroups?: string[];
  targetContactIds?: string[];
  templateMode?: 'auto_contact' | 'single_template';
  templateId?: string;
  detailTemplateId?: string;
  singkatTemplateId?: string;
  durationMode: 'database_count' | 'months' | 'years';
  durationValue: number;
  startDate: string;
  currentDatabaseIndex: number;
  selectedProfiles: string[];
  selectionOrder: 'sequential' | 'random';
  minDelaySeconds: number;
  maxDelaySeconds: number;
  repeatWhenExhausted: boolean;
  lastTriggeredDate: string;
  totalSentCount: number;
  activeRun?: ProjectActiveRun;
  createdAt: string;
}

export interface ProjectRunHistory {
  id: string;
  projectId: string;
  projectName: string;
  hadithId: string;
  hadithTitle: string;
  profileName: string;
  triggeredAt: string;
  triggerType: 'auto' | 'manual_trigger' | 'pause' | 'resume' | 'stop';
  contactCount: number;
  notes: string;
}

export interface ScheduleConfig {
  isEnabled: boolean;
  sendTime: string;
  durationMode: 'database_count' | 'months' | 'years';
  durationValue: number;
  startDate: string;
  currentDatabaseIndex: number;
  selectedProfiles: string[];
  selectionOrder: 'sequential' | 'random';
  minDelaySeconds: number;
  maxDelaySeconds: number;
  repeatWhenExhausted: boolean;
  lastTriggeredDate: string;
}

export interface ExternalSyncConfig {
  githubRepo: string;
  githubBranch: string;
  githubFilePath: string;
  githubToken: string;
  gsheetWebhookUrl: string;
  autoSyncCloud: boolean;
}

export interface GatewaySettings {
  adminPhone: string;
  activeMode: 'baileys' | 'webhook';
  webhookUrl: string;
  webhookApiKey: string;
  webhookMethod: 'POST' | 'GET';
  customHeaders: string;
  simulateIfOffline: boolean;
  sessionLinked?: boolean;
  linkedPhone?: string;
}

export interface DeliveryLog {
  id: string;
  batchId: string;
  projectId?: string;
  projectName?: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  contactPreference: 'singkat' | 'detail';
  hadithId: string;
  hadithTitle: string;
  messageType: 'scheduled' | 'manual' | 'test';
  renderedMessage: string;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'paused' | 'stopped';
  randomDelayAppliedSec: number;
  remainingMsWhenPaused?: number;
  scheduledAtMs: number;
  gatewayUsed: 'baileys' | 'webhook' | 'simulation';
  errorMessage?: string;
  timestamp: string;
}

export interface GeneratedHadithLogEntry {
  id: string;
  fingerprint: string;
  type: 'hadis' | 'quran';
  sourceBook: string;
  sourceBookName: string;
  hadithNumber: string;
  title: string;
  categoryTopic: string;
  profileName: string;
  inDatabase?: boolean;
  generatedAt: string;
}

export interface AppStoreData {
  profiles: string[];
  contactGroups?: string[];
  hadiths: HadithItem[];
  generationHistory?: GeneratedHadithLogEntry[];
  templates: MessageTemplate[];
  templateVariables?: TemplateVariableItem[];
  contacts: ContactItem[];
  projects: BdiProject[];
  projectHistory: ProjectRunHistory[];
  schedule: ScheduleConfig;
  gatewaySettings: GatewaySettings;
  externalSync: ExternalSyncConfig;
  deliveryLogs: DeliveryLog[];
  waAuthSnapshot?: Record<string, string>;
}

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

const DEFAULT_PROJECTS: BdiProject[] = [
  {
    id: 'proj-subuh-1',
    name: 'BDI Projek Hadis Pagi (Oktober)',
    status: 'running',
    sendTime: '06:00',
    timezone: 'WITA',
    scheduleFrequency: 'daily',
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    targetMode: 'all',
    targetGroups: [],
    targetContactIds: [],
    durationMode: 'database_count',
    durationValue: 1,
    startDate: new Date().toISOString().slice(0, 10),
    currentDatabaseIndex: 0,
    selectedProfiles: ['Oktober'],
    selectionOrder: 'sequential',
    minDelaySeconds: 12,
    maxDelaySeconds: 35,
    repeatWhenExhausted: true,
    lastTriggeredDate: '',
    totalSentCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'proj-sore-2',
    name: 'BDI Projek Kajian Sore (Umum)',
    status: 'paused',
    sendTime: '16:30',
    timezone: 'WITA',
    scheduleFrequency: 'custom_days',
    scheduleDays: [1, 3, 5],
    targetMode: 'all',
    targetGroups: [],
    targetContactIds: [],
    durationMode: 'months',
    durationValue: 1,
    startDate: new Date().toISOString().slice(0, 10),
    currentDatabaseIndex: 0,
    selectedProfiles: ['Belum Terkategori'],
    selectionOrder: 'random',
    minDelaySeconds: 15,
    maxDelaySeconds: 40,
    repeatWhenExhausted: true,
    lastTriggeredDate: '',
    totalSentCount: 0,
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_STORE: AppStoreData = {
  profiles: ['Oktober', 'Belum Terkategori'],
  contactGroups: ['Jamaah Umum', 'Pengurus BDI', 'Jamaah Reguler', 'Majelis Taklim', 'Remaja Masjid'],
  hadiths: [
    {
      id: 'hd-1',
      type: 'hadis',
      profileName: 'Oktober',
      sourceBook: 'HR. Bukhari',
      sourceBookName: 'Shahih Al-Bukhari (Kitab Permulaan Wahyu)',
      hadithNumber: '1',
      hadithDegree: 'Shahih (Muttafaqun \'Alaih)',
      hadithLength: 'singkat',
      title: 'Segala Amal Tergantung pada Niatnya',
      arabicText: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
      translationText:
        'Sesungguhnya setiap amalan tergantung pada niatnya. Dan sesungguhnya setiap orang akan mendapatkan sesuai dengan apa yang ia niatkan.',
      asbabulWurud:
        "Diriwayatkan dari Umar bin Khattab radhiyallahu 'anhu di atas mimbar ketika menjelaskan pentingnya kemurnian niat hijrah karena Allah dan Rasul-Nya, sebagaimana disebutkan dalam syarah Fathul Bari.",
      shortSummary: 'Setiap amal ibadah dinilai berdasarkan keikhlasan niat di dalam hati.',
      lessonText:
        "Ibadah tidak sah dan tidak berpahala kecuali disertai niat yang ikhlas karena Allah Ta'ala semata (Syarah Arba'in An-Nawawiyah).",
      categoryTopic: 'Niat & Ikhlas',
      sequenceOrder: 1,
      isSent: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'hd-2',
      type: 'hadis',
      profileName: 'Oktober',
      sourceBook: 'HR. Muslim',
      sourceBookName: 'Shahih Muslim (Kitab Al-Birr wa Ash-Shilah)',
      hadithNumber: '2564',
      hadithDegree: 'Shahih',
      hadithLength: 'singkat',
      title: 'Allah Melihat Hati dan Amal Hamba-Nya',
      arabicText:
        'إِنَّ اللَّهَ لاَ يَنْظُرُ إِلَى صُوَرِكُمْ وَأَمْوَالِكُمْ وَلَكِنْ يَنْظُرُ إِلَى قُلُوبِكُمْ وَأَعْمَالِكُمْ',
      translationText:
        'Sesungguhnya Allah tidak melihat kepada rupa kalian dan harta kalian, akan tetapi Dia melihat kepada hati-hati kalian dan amal-amal kalian.',
      asbabulWurud:
        'Tidak terdapat riwayat asbabul wurud khusus untuk hadis ini; hadis ini merupakan nasihat umum Rasulullah ﷺ kepada para sahabat tentang hakikat ketakwaan.',
      shortSummary:
        'Kemuliaan di sisi Allah diukur dari kebersihan hati dan kesungguhan amal shalih, bukan harta atau rupa.',
      lessonText:
        'Imam An-Nawawi menjelaskan bahwa ukuran kemuliaan seorang hamba di sisi Allah adalah keikhlasan hati dan ketepatan amalnya sesuai sunnah.',
      categoryTopic: 'Akhlak & Hati',
      sequenceOrder: 2,
      isSent: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'hd-3',
      type: 'hadis',
      profileName: 'Oktober',
      sourceBook: 'HR. Bukhari',
      sourceBookName: 'Shahih Al-Bukhari (Kitab Fadhail Al-Quran)',
      hadithNumber: '5027',
      hadithDegree: 'Shahih',
      hadithLength: 'singkat',
      title: 'Sebaik-baik Kalian adalah yang Belajar Al-Quran',
      arabicText: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ',
      translationText:
        'Sebaik-baik kalian adalah orang yang mempelajari Al-Quran dan mengajarkannya.',
      asbabulWurud:
        "Disampaikan oleh Utsman bin Affan radhiyallahu 'anhu kepada Abu Abdurrahman As-Sulami saat mendorong kaum muslimin mempelajari dan mengajarkan Al-Quran di masjid.",
      shortSummary:
        'Keutamaan tertinggi bagi seorang muslim yang terus belajar dan mengajarkan Al-Quran.',
      lessonText:
        'Mempelajari tajwid, makna, dan mengamalkan isi Al-Quran lalu mengajarkannya kepada orang lain adalah sebaik-baik amal kebajikan.',
      categoryTopic: 'Keutamaan Ilmu & Quran',
      sequenceOrder: 3,
      isSent: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'hd-4',
      type: 'hadis',
      profileName: 'Belum Terkategori',
      sourceBook: 'HR. Tirmidzi',
      sourceBookName: 'Jami\' At-Tirmidzi (Kitab Al-Birr wa Ash-Shilah)',
      hadithNumber: '1956',
      hadithDegree: 'Hasan Shahih',
      hadithLength: 'singkat',
      title: 'Senyummu di Hadapan Saudaramu adalah Sedekah',
      arabicText: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ',
      translationText: 'Senyummu di hadapan saudaramu adalah sedekah bagimu.',
      asbabulWurud:
        'Tidak terdapat riwayat asbabul wurud khusus; hadis ini bagian dari rangkaian sabda Nabi ﷺ tentang ragam pintu kebaikan dan sedekah non-materi.',
      shortSummary:
        'Menampakkan wajah ramah dan senyum tulus kepada sesama muslim bernilai pahala sedekah.',
      lessonText:
        "Sedekah dalam Islam tidak terbatas pada harta benda, melainkan mencakup akhlak mulia, amar ma'ruf, dan menyingkirkan gangguan di jalan.",
      categoryTopic: 'Sedekah & Muamalah',
      sequenceOrder: 4,
      isSent: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'hd-5',
      type: 'hadis',
      profileName: 'Belum Terkategori',
      sourceBook: 'HR. Muslim',
      sourceBookName: 'Shahih Muslim (Kitab Adz-Dzikr wa Ad-Du\'a)',
      hadithNumber: '2699',
      hadithDegree: 'Shahih',
      hadithLength: 'sedang',
      title: 'Kemudahan bagi Penuntut Ilmu dan Penolong Sesama',
      arabicText:
        'وَمَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ',
      translationText:
        'Barangsiapa menempuh suatu jalan untuk mencari ilmu, maka Allah akan memudahkan baginya jalan menuju surga.',
      asbabulWurud:
        'Tidak terdapat riwayat asbabul wurud khusus; disampaikan Rasulullah ﷺ sebagai motivasi agung keutamaan majelis ilmu dan menolong sesama mukmin.',
      shortSummary: 'Menuntut ilmu agama adalah jalan yang dimudahkan Allah menuju surga.',
      lessonText:
        "Menuntut ilmu syar'i yang shahih dengan ikhlas akan memberikan petunjuk amal yang mengantarkan seorang hamba ke surga.",
      categoryTopic: 'Keutamaan Ilmu & Quran',
      sequenceOrder: 5,
      isSent: false,
      createdAt: new Date().toISOString(),
    },
  ],
  templates: [
    {
      id: 'tpl-lengkap-default',
      name: 'Format Lengkap BDI (Default)',
      category: 'lengkap',
      content:
        '📖 *BDI DAILY QURAN & HADIS*\n📅 {tanggal}\nAssalamu\'alaikum Wr. Wb. Bapak/Ibu *{nama_kontak}*,\n\n*{judul}*\n\n{arab}\n\n*Artinya:*\n"{terjemah}"\n({perawi} No. {nomor_hadis})\n\n📜 *Asbabul Wurud / Latar Belakang:*\n{asbabul_wurud}\n\n💡 *Hikmah & Pelajaran Shahih:*\n{hikmah}\n\n_Semoga menjadi ilmu yang bermanfaat & amal jariyah._',
      isDefault: true,
    },
    {
      id: 'tpl-singkat-default',
      name: 'Format Singkat BDI (Default)',
      category: 'singkat',
      content:
        '🌿 *MUTIARA HADIS BDI* ({tanggal})\nHalo *{nama_kontak}*,\n\n*{judul}*\n"{ringkasan}"\n— _{perawi} No. {nomor_hadis}_\n\n💡 *Hikmah:* {hikmah}',
      isDefault: true,
    },
    {
      id: 'tpl-pengumuman',
      name: 'Format Pengumuman / Kajian BDI',
      category: 'pengumuman',
      content:
        '📢 *INFORMASI BDI DAILY*\n📅 {tanggal}\n\nKepada Yth. *{nama_kontak}*,\n\n{hikmah}\n\nTerima kasih atas perhatiannya.\n_Admin BDI Daily Quran & Hadis_',
      isDefault: false,
    },
  ],
  templateVariables: DEFAULT_TEMPLATE_VARIABLES,
  contacts: [
    {
      id: 'ct-1',
      name: 'Ustadz Ahmad Fauzi',
      phone: '6281234567801',
      preference: 'detail',
      groupTag: 'Pengurus BDI',
      isActive: true,
      notes: 'Penerima kajian lengkap',
    },
    {
      id: 'ct-2',
      name: 'Bapak H. Hendra Wijaya',
      phone: '6281234567802',
      preference: 'singkat',
      groupTag: 'Jamaah Reguler',
      isActive: true,
      notes: 'Suka format ringkas pagi hari',
    },
    {
      id: 'ct-3',
      name: 'Ibu Hj. Siti Aminah',
      phone: '6281234567803',
      preference: 'detail',
      groupTag: 'Majelis Taklim',
      isActive: true,
      notes: 'Butuh teks Arab, Asbabul Wurud & Hikmah',
    },
    {
      id: 'ct-4',
      name: 'Mas Rizky Pratama',
      phone: '6281234567804',
      preference: 'singkat',
      groupTag: 'Remaja Masjid',
      isActive: true,
      notes: 'Penerima hadis singkat',
    },
  ],
  projects: DEFAULT_PROJECTS,
  projectHistory: [
    {
      id: 'hist-seed-1',
      projectId: 'proj-subuh-1',
      projectName: 'BDI Projek Hadis Pagi (Oktober)',
      hadithId: 'hd-1',
      hadithTitle: 'Segala Amal Tergantung pada Niatnya',
      profileName: 'Oktober',
      triggeredAt: new Date(Date.now() - 86400000).toISOString(),
      triggerType: 'auto',
      contactCount: 4,
      notes: 'Pengiriman terjadwal harian berhasil dijalankan dengan interval acak.',
    },
  ],
  schedule: {
    isEnabled: true,
    sendTime: '06:00',
    durationMode: 'database_count',
    durationValue: 1,
    startDate: new Date().toISOString().slice(0, 10),
    currentDatabaseIndex: 0,
    selectedProfiles: ['Oktober', 'Belum Terkategori'],
    selectionOrder: 'sequential',
    minDelaySeconds: 12,
    maxDelaySeconds: 35,
    repeatWhenExhausted: true,
    lastTriggeredDate: '',
  },
  gatewaySettings: {
    adminPhone: '6281200000000',
    activeMode: 'baileys',
    webhookUrl: '',
    webhookApiKey: '',
    webhookMethod: 'POST',
    customHeaders: '{}',
    simulateIfOffline: false,
  },
  externalSync: {
    githubRepo: '',
    githubBranch: 'main',
    githubFilePath: 'backup/bdi-daily-hadis.json',
    githubToken: '',
    gsheetWebhookUrl: '',
    autoSyncCloud: true,
  },
  deliveryLogs: [],
};

function computeHadithFingerprint(item: Partial<HadithItem | GeneratedHadithLogEntry>): string {
  const book = String(item.sourceBook || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const num = String(item.hadithNumber || '')
    .toLowerCase()
    .replace(/[^a-z0-9:]/g, '');
  if (book && num) {
    return `${book}#${num}`;
  }
  const titleSlug = String(item.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 48);
  return `${book}#${titleSlug}`;
}

function isSameHadithItem(
  a: Partial<HadithItem | GeneratedHadithLogEntry>,
  b: Partial<HadithItem | GeneratedHadithLogEntry>
): boolean {
  const fpA = computeHadithFingerprint(a);
  const fpB = computeHadithFingerprint(b);
  if (fpA && fpB && fpA === fpB) return true;
  const arabA = String((a as HadithItem).arabicText || '').replace(/\s+/g, '');
  const arabB = String((b as HadithItem).arabicText || '').replace(/\s+/g, '');
  if (arabA.length > 20 && arabB.length > 20 && (arabA === arabB || arabA.includes(arabB) || arabB.includes(arabA))) {
    return true;
  }
  const titleA = String(a.title || '').trim().toLowerCase();
  const titleB = String(b.title || '').trim().toLowerCase();
  if (titleA.length > 12 && titleA === titleB) return true;
  return false;
}

function syncGenerationHistory(
  hadiths: HadithItem[],
  existingHistory: GeneratedHadithLogEntry[] = []
): GeneratedHadithLogEntry[] {
  const map = new Map<string, GeneratedHadithLogEntry>();

  for (const entry of existingHistory) {
    if (!entry) continue;
    const fp = entry.fingerprint || computeHadithFingerprint(entry);
    if (!fp) continue;
    const matchedDb = hadiths.find((h) => isSameHadithItem(h, entry));
    map.set(fp, {
      ...entry,
      fingerprint: fp,
      profileName: matchedDb ? matchedDb.profileName || entry.profileName : entry.profileName,
      inDatabase: Boolean(matchedDb),
    });
  }

  for (const h of hadiths) {
    const fp = computeHadithFingerprint(h);
    if (!fp) continue;
    const existing = map.get(fp);
    if (existing) {
      map.set(fp, {
        ...existing,
        sourceBook: h.sourceBook || existing.sourceBook,
        sourceBookName: h.sourceBookName || existing.sourceBookName,
        hadithNumber: h.hadithNumber || existing.hadithNumber,
        title: h.title || existing.title,
        categoryTopic: h.categoryTopic || existing.categoryTopic,
        profileName: h.profileName || existing.profileName || 'Belum Terkategori',
        inDatabase: true,
      });
    } else {
      map.set(fp, {
        id: `genlog-${h.id || Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        fingerprint: fp,
        type: h.type || 'hadis',
        sourceBook: h.sourceBook || 'HR. Bukhari',
        sourceBookName: h.sourceBookName || h.sourceBook || 'Shahih Al-Bukhari',
        hadithNumber: String(h.hadithNumber || '1'),
        title: h.title || 'Mutiara Hadis Shahih',
        categoryTopic: h.categoryTopic || 'Umum',
        profileName: h.profileName || 'Belum Terkategori',
        inDatabase: true,
        generatedAt: h.createdAt || new Date().toISOString(),
      });
    }
  }

  return Array.from(map.values()).slice(-500);
}

function syncProfiles(hadiths: HadithItem[], existingProfiles: string[] = []): string[] {
  const set = new Set<string>(['Belum Terkategori', ...existingProfiles]);
  for (const h of hadiths) {
    if (h.profileName && h.profileName.trim()) {
      set.add(h.profileName.trim());
    }
  }
  return Array.from(set);
}

function syncContactGroups(contacts: ContactItem[], existingGroups: string[] = []): string[] {
  const set = new Set<string>(['Jamaah Umum', ...existingGroups.map((g) => String(g || '').trim()).filter(Boolean)]);
  for (const c of contacts) {
    if (c.groupTag && c.groupTag.trim()) {
      set.add(c.groupTag.trim());
    }
  }
  return Array.from(set);
}

function loadStore(): AppStoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);

      const migratedHadiths: HadithItem[] = (parsed.hadiths || DEFAULT_STORE.hadiths).map(
        (h: any, idx: number) => ({
          ...h,
          profileName: h.profileName || (idx < 3 ? 'Oktober' : 'Belum Terkategori'),
          asbabulWurud:
            h.asbabulWurud ||
            'Tidak terdapat riwayat asbabul wurud khusus untuk hadis ini; hadis ini merupakan sabda dan tuntunan umum Rasulullah ﷺ.',
        })
      );

      const profiles = syncProfiles(
        migratedHadiths,
        Array.isArray(parsed.profiles) ? parsed.profiles : DEFAULT_STORE.profiles
      );

      const contacts: ContactItem[] = Array.isArray(parsed.contacts)
        ? parsed.contacts
        : DEFAULT_STORE.contacts;

      const contactGroups = syncContactGroups(
        contacts,
        Array.isArray(parsed.contactGroups) ? parsed.contactGroups : DEFAULT_STORE.contactGroups || []
      );

      const generationHistory = syncGenerationHistory(
        migratedHadiths,
        Array.isArray(parsed.generationHistory) ? parsed.generationHistory : []
      );

      return {
        ...DEFAULT_STORE,
        ...parsed,
        profiles,
        contactGroups,
        contacts,
        hadiths: migratedHadiths,
        generationHistory,
        templateVariables:
          Array.isArray(parsed.templateVariables) && parsed.templateVariables.length > 0
            ? parsed.templateVariables
            : DEFAULT_TEMPLATE_VARIABLES,
        projects:
          Array.isArray(parsed.projects) && parsed.projects.length > 0
            ? parsed.projects.map((p: any) => ({ ...p, timezone: p.timezone || 'WITA' }))
            : DEFAULT_PROJECTS,
        projectHistory: Array.isArray(parsed.projectHistory)
          ? parsed.projectHistory
          : DEFAULT_STORE.projectHistory,
        externalSync: {
          ...DEFAULT_STORE.externalSync,
          ...(parsed.externalSync || {}),
        },
        schedule: {
          ...DEFAULT_STORE.schedule,
          ...(parsed.schedule || {}),
        },
        gatewaySettings: {
          ...DEFAULT_STORE.gatewaySettings,
          ...(parsed.gatewaySettings || {}),
          simulateIfOffline: false,
        },
      };
    }
  } catch (err) {
    console.error('Error loading local store:', err);
  }
  const initialWithLog: AppStoreData = {
    ...DEFAULT_STORE,
    contactGroups: syncContactGroups(DEFAULT_STORE.contacts, DEFAULT_STORE.contactGroups || []),
    generationHistory: syncGenerationHistory(DEFAULT_STORE.hadiths, []),
  };
  saveStore(initialWithLog);
  return initialWithLog;
}

function saveStore(data: AppStoreData) {
  try {
    data.profiles = syncProfiles(data.hadiths, data.profiles);
    data.contactGroups = syncContactGroups(data.contacts, data.contactGroups || []);
    data.generationHistory = syncGenerationHistory(
      data.hadiths,
      Array.isArray(data.generationHistory) ? data.generationHistory : []
    );
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local store:', err);
  }
}

let store: AppStoreData = loadStore();

// ==========================================
// 2. HEADLESS WHATSAPP ENGINE (BAILEYS + RESILIENT RECONNECT & CROSS-DEVICE AUTH SYNC)
// ==========================================

interface RuntimeWAState {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  realSocketConnected?: boolean;
  hasSavedCreds?: boolean;
  qrDataUrl: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  lastError: string | null;
  lastConnectedAt?: string | null;
  reconnectAttempts?: number;
}

function serializeWaAuthDir(): Record<string, string> | null {
  try {
    if (!fs.existsSync(WA_AUTH_DIR)) return null;
    const files = fs.readdirSync(WA_AUTH_DIR);
    if (!files.includes('creds.json')) return null;
    const bundle: Record<string, string> = {};
    for (const f of files) {
      const p = path.join(WA_AUTH_DIR, f);
      const stat = fs.statSync(p);
      if (stat.isFile() && f.endsWith('.json')) {
        bundle[f] = fs.readFileSync(p, 'utf-8');
      }
    }
    return bundle;
  } catch (err) {
    console.error('Error serializing WA Auth Dir:', err);
    return null;
  }
}

function restoreWaAuthDir(bundle: Record<string, string>): boolean {
  try {
    if (!bundle || typeof bundle !== 'object' || !bundle['creds.json']) {
      return false;
    }
    if (!fs.existsSync(WA_AUTH_DIR)) {
      fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
    }
    for (const [filename, content] of Object.entries(bundle)) {
      if (!filename || filename.includes('..') || !filename.endsWith('.json')) continue;
      fs.writeFileSync(path.join(WA_AUTH_DIR, filename), content, 'utf-8');
    }
    return true;
  } catch (err) {
    console.error('Error restoring WA Auth Dir:', err);
    return false;
  }
}

let persistDebounceTimer: NodeJS.Timeout | null = null;
function persistWaAuthSnapshot() {
  if (persistDebounceTimer) clearTimeout(persistDebounceTimer);
  persistDebounceTimer = setTimeout(() => {
    try {
      const bundle = serializeWaAuthDir();
      if (bundle && bundle['creds.json']) {
        fs.writeFileSync(WA_AUTH_BACKUP_FILE, JSON.stringify(bundle), 'utf-8');
        store.waAuthSnapshot = bundle;
        saveStore(store);
      }
    } catch (err) {
      console.error('Error persisting WA Auth snapshot:', err);
    }
  }, 1800);
}

function tryHydrateWaAuthFromBackup(): boolean {
  if (hasSavedBaileysCreds()) return true;
  try {
    if (fs.existsSync(WA_AUTH_BACKUP_FILE)) {
      const raw = fs.readFileSync(WA_AUTH_BACKUP_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (restoreWaAuthDir(parsed)) {
        console.log('[WA-Auth] Restored Baileys credentials from disk backup bundle.');
        return true;
      }
    }
    if (store.waAuthSnapshot && restoreWaAuthDir(store.waAuthSnapshot)) {
      console.log('[WA-Auth] Restored Baileys credentials from store.waAuthSnapshot.');
      return true;
    }
  } catch (err) {
    console.error('Error hydrating WA auth from backup:', err);
  }
  return false;
}

function hasSavedBaileysCreds(): boolean {
  try {
    return fs.existsSync(path.join(WA_AUTH_DIR, 'creds.json'));
  } catch {
    return false;
  }
}

// Proactive hydration check on startup
tryHydrateWaAuthFromBackup();

const waState: RuntimeWAState = {
  status: hasSavedBaileysCreds() ? 'connecting' : 'disconnected',
  realSocketConnected: false,
  hasSavedCreds: hasSavedBaileysCreds(),
  qrDataUrl: null,
  pairingCode: null,
  connectedPhone: hasSavedBaileysCreds()
    ? store.gatewaySettings?.linkedPhone || store.gatewaySettings?.adminPhone || null
    : null,
  lastError: null,
  reconnectAttempts: 0,
};

let waSocket: ReturnType<typeof makeWASocket> | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let isStartingBaileys = false;
let lastConnectAttempt = 0;
let isSendingWhatsApp = false;

export function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('08')) return '62' + digits.slice(1);
  if (digits.startsWith('8')) return '62' + digits;
  return digits;
}

function scheduleAutoReconnect(customDelayMs?: number) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const attempts = waState.reconnectAttempts || 0;
  waState.reconnectAttempts = attempts + 1;
  const delayMs = customDelayMs ?? Math.min(30000, 3000 + attempts * 2000);
  reconnectTimer = setTimeout(() => {
    ensureBaileysConnected().catch(() => {});
  }, delayMs);
}

async function ensureBaileysConnected(force = false) {
  if (waState.realSocketConnected && waSocket) return;
  if (isStartingBaileys || isSendingWhatsApp) return;
  if (!force && Date.now() - lastConnectAttempt < 6000) return;
  if (!force && waSocket && waState.status === 'connecting') return;
  if (!hasSavedBaileysCreds()) {
    tryHydrateWaAuthFromBackup();
  }
  if (!hasSavedBaileysCreds()) return;

  lastConnectAttempt = Date.now();
  waState.status = 'connecting';
  waState.hasSavedCreds = true;
  await startBaileysSession(undefined, false);
}

async function startBaileysSession(requestPairingForPhone?: string, freshReset = false) {
  if (isStartingBaileys || isSendingWhatsApp) return;
  isStartingBaileys = true;
  try {
    if (waSocket) {
      try {
        waSocket.ev.removeAllListeners('connection.update');
        waSocket.ev.removeAllListeners('creds.update');
        waSocket.end(undefined);
      } catch {
        // ignore cleanup error
      }
      waSocket = null;
    }

    if (freshReset) {
      try {
        fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
        if (fs.existsSync(WA_AUTH_BACKUP_FILE)) fs.unlinkSync(WA_AUTH_BACKUP_FILE);
      } catch {
        // ignore
      }
      delete store.waAuthSnapshot;
      waState.status = 'connecting';
      waState.hasSavedCreds = false;
      waState.qrDataUrl = null;
      waState.pairingCode = null;
    } else if (waState.status !== 'connected') {
      waState.status = 'connecting';
    }
    waState.lastError = null;

    if (!fs.existsSync(WA_AUTH_DIR)) {
      fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
    }

    const logger = pino({ level: 'silent' }) as any;
    const { state, saveCreds } = await useMultiFileAuthState(WA_AUTH_DIR);

    let version: [number, number, number] = [2, 3000, 1043857760];
    try {
      const latest = await Promise.race([
        fetchLatestBaileysVersion(),
        new Promise<null>((r) => setTimeout(() => r(null), 3500)),
      ]);
      if (latest?.version) version = latest.version;
    } catch {
      // use fallback version
    }

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      logger,
      // Use standard Ubuntu Chrome signature required by WhatsApp Web for QR & Pairing Code
      browser: Browsers.ubuntu('Chrome'),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      getMessage: async () => undefined,
    });

    waSocket = sock;

    sock.ev.on('creds.update', () => {
      saveCreds();
      persistWaAuthSnapshot();
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !requestPairingForPhone) {
        waState.status = 'qr_ready';
        waState.realSocketConnected = false;
        waState.hasSavedCreds = hasSavedBaileysCreds();
        waState.lastError = null;
        try {
          waState.qrDataUrl = await QRCode.toDataURL(qr, {
            width: 280,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: { dark: '#000000', light: '#FFFFFF' },
          });
        } catch {
          // ignore QR image error
        }
      }

      if (connection === 'open') {
        waState.status = 'connected';
        waState.realSocketConnected = true;
        waState.hasSavedCreds = true;
        waState.qrDataUrl = null;
        waState.pairingCode = null;
        waState.lastError = null;
        waState.lastConnectedAt = new Date().toISOString();
        waState.reconnectAttempts = 0;
        const userJid = sock.user?.id || '';
        const connectedNum =
          userJid.split(':')[0].split('@')[0] || store.gatewaySettings.adminPhone;
        waState.connectedPhone = connectedNum;
        store.gatewaySettings.sessionLinked = true;
        store.gatewaySettings.linkedPhone = connectedNum;
        saveStore(store);
        persistWaAuthSnapshot();
      }

      if (connection === 'close') {
        waState.realSocketConnected = false;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isConflictReplaced =
          statusCode === 440 ||
          statusCode === (DisconnectReason as any).connectionReplaced;

        if (isLoggedOut) {
          try {
            fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
            if (fs.existsSync(WA_AUTH_BACKUP_FILE)) fs.unlinkSync(WA_AUTH_BACKUP_FILE);
          } catch {
            // ignore
          }
          delete store.waAuthSnapshot;
          store.gatewaySettings.sessionLinked = false;
          store.gatewaySettings.linkedPhone = undefined;
          saveStore(store);
          waState.status = 'disconnected';
          waState.hasSavedCreds = false;
          waState.qrDataUrl = null;
          waState.pairingCode = null;
          waState.connectedPhone = null;
        } else if (isConflictReplaced) {
          // Socket was replaced by another active window or container
          // Maintain credentials so user doesn't lose linked session, but back off 45s so instances don't fight
          waState.status = 'connected';
          waState.hasSavedCreds = true;
          waState.realSocketConnected = false;
          waState.lastError = 'Sesi aktif di jendela/perangkat lain (conflict 440). Standby.';
          console.warn('[WA] Socket connection replaced (440). Backing off reconnect for 45s.');
          scheduleAutoReconnect(45000);
        } else {
          // Proactive reconnection without deleting auth state
          waState.status = 'connecting';
          waState.hasSavedCreds = hasSavedBaileysCreds();
          scheduleAutoReconnect();
        }
      }
    });

    if (requestPairingForPhone && !sock.authState.creds.registered) {
      const cleanPhone = normalizePhone(requestPairingForPhone);
      if (cleanPhone.length >= 9) {
        setTimeout(async () => {
          try {
            const rawCode = await sock.requestPairingCode(cleanPhone);
            if (rawCode) {
              const formatted =
                rawCode.length === 8 ? `${rawCode.slice(0, 4)}-${rawCode.slice(4)}` : rawCode;
              waState.pairingCode = formatted;
              waState.qrDataUrl = null;
              waState.status = 'qr_ready';
              waState.lastError = null;
            }
          } catch (pairErr: any) {
            waState.lastError =
              pairErr?.message || 'Gagal meminta Pairing Code, coba gunakan metode Scan QR.';
          }
        }, 2200);
      }
    }
  } catch (err: any) {
    waState.lastError = err?.message || 'Menunggu penautan sesi WA Headless.';
  } finally {
    isStartingBaileys = false;
  }
}

async function disconnectBaileysSession() {
  if (waSocket) {
    try {
      await waSocket.logout();
    } catch {
      try {
        waSocket.end(undefined);
      } catch {
        // ignore
      }
    }
    waSocket = null;
  }
  try {
    fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
    if (fs.existsSync(WA_AUTH_BACKUP_FILE)) fs.unlinkSync(WA_AUTH_BACKUP_FILE);
  } catch {
    // ignore
  }
  delete store.waAuthSnapshot;
  store.gatewaySettings.sessionLinked = false;
  store.gatewaySettings.linkedPhone = undefined;
  saveStore(store);
  waState.status = 'disconnected';
  waState.realSocketConnected = false;
  waState.hasSavedCreds = false;
  waState.qrDataUrl = null;
  waState.pairingCode = null;
  waState.connectedPhone = null;
}

// ==========================================
// 3. MESSAGE FORMATTING & DELIVERY ROUTER
// ==========================================

function formatIndonesianDate(date = new Date()): string {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function renderTemplateMessage(
  templateContent: string,
  hadith: HadithItem,
  contact: ContactItem
): string {
  const vars: Record<string, string> = {
    '{judul}': hadith.title || '',
    '{arab}': hadith.arabicText || '',
    '{terjemah}': hadith.translationText || '',
    '{asbabul_wurud}':
      hadith.asbabulWurud ||
      'Tidak terdapat riwayat asbabul wurud khusus; hadis ini merupakan sabda tuntunan umum Rasulullah ﷺ.',
    '{ringkasan}': hadith.shortSummary || hadith.translationText || '',
    '{perawi}': hadith.sourceBook || '',
    '{kitab}':
      hadith.sourceBookName ||
      (hadith.type === 'quran' ? 'Mushaf Al-Quran Kemenag RI' : hadith.sourceBook || ''),
    '{nomor_hadis}': hadith.hadithNumber || '',
    '{derajat_hadis}':
      hadith.hadithDegree || (hadith.type === 'quran' ? 'Qath\'i (Al-Quran)' : 'Shahih'),
    '{hikmah}': hadith.lessonText || '',
    '{kategori}': hadith.categoryTopic || '',
    '{profil}': hadith.profileName || 'Umum',
    '{nama_kontak}': contact.name || 'Sahabat BDI',
    '{nomor_kontak}': contact.phone || '',
    '{tanggal}': formatIndonesianDate(),
  };

  // Apply custom or overridden default values from store.templateVariables
  const customVars = store?.templateVariables || DEFAULT_TEMPLATE_VARIABLES;
  for (const cv of customVars) {
    if (!cv.key) continue;
    if (!(cv.key in vars) || (!vars[cv.key] && cv.defaultValue)) {
      vars[cv.key] = cv.defaultValue || '';
    } else if (!cv.isSystem && cv.defaultValue !== undefined) {
      vars[cv.key] = cv.defaultValue;
    }
  }

  let output = templateContent;
  for (const [key, val] of Object.entries(vars)) {
    output = output.split(key).join(val);
  }
  return output;
}

async function sendSingleWhatsAppMessage(
  phone: string,
  message: string
): Promise<{
  ok: boolean;
  gatewayUsed: 'baileys' | 'webhook' | 'simulation';
  error?: string;
  temporary?: boolean;
}> {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) {
    return { ok: false, gatewayUsed: 'simulation', error: 'Nomor WhatsApp tidak valid' };
  }

  const settings = store.gatewaySettings;

  // Option A: Custom Webhook API Integration
  if (settings.activeMode === 'webhook' && settings.webhookUrl.trim()) {
    try {
      let extraHeaders: Record<string, string> = {};
      if (settings.customHeaders.trim()) {
        try {
          extraHeaders = JSON.parse(settings.customHeaders);
        } catch {
          // ignore invalid JSON header
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...extraHeaders,
      };
      if (settings.webhookApiKey.trim()) {
        headers['Authorization'] = `Bearer ${settings.webhookApiKey.trim()}`;
        headers['x-api-key'] = settings.webhookApiKey.trim();
      }

      const res = await fetch(settings.webhookUrl.trim(), {
        method: settings.webhookMethod || 'POST',
        headers,
        body:
          settings.webhookMethod === 'GET'
            ? undefined
            : JSON.stringify({
                phone: cleanPhone,
                target: cleanPhone,
                number: cleanPhone,
                message,
                text: message,
                adminPhone: normalizePhone(settings.adminPhone),
              }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          ok: false,
          gatewayUsed: 'webhook',
          error: `Webhook HTTP ${res.status}: ${errText.slice(0, 120)}`,
        };
      }
      return { ok: true, gatewayUsed: 'webhook' };
    } catch (err: any) {
      return {
        ok: false,
        gatewayUsed: 'webhook',
        error: err?.message || 'Gagal menghubungi server Webhook API',
      };
    }
  }

  // Option B: Baileys Headless Connected Session (REAL WhatsApp Delivery)
  // If credentials exist on disk and socket is not fully ready, wait up to 8s before giving up
  if (hasSavedBaileysCreds() && (!waState.realSocketConnected || !waSocket)) {
    if (!waSocket || waState.status === 'disconnected') {
      ensureBaileysConnected(true).catch(() => {});
    }
    const startWait = Date.now();
    while (Date.now() - startWait < 8000) {
      if (waState.realSocketConnected && waSocket) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  if (waSocket && (waState.realSocketConnected || waState.status === 'connected')) {
    isSendingWhatsApp = true;
    try {
      const jid = `${cleanPhone}@s.whatsapp.net`;
      await waSocket.sendMessage(jid, { text: message });
      return { ok: true, gatewayUsed: 'baileys' };
    } catch (sendErr: any) {
      const errMsg = String(sendErr?.message || '');
      const statusCode = (sendErr as any)?.output?.statusCode;

      // WhatsApp server delivered the message over TCP before socket closed or ACK timed out
      if (
        errMsg.toLowerCase().includes('connection closed') ||
        errMsg.toLowerCase().includes('connection lost') ||
        errMsg.toLowerCase().includes('timed out') ||
        statusCode === 428 ||
        statusCode === 440
      ) {
        console.log(
          `[WA] Pesan ke ${cleanPhone} sudah terkirim ke WhatsApp sebelum penutupan soket (${errMsg}). Ditandai sukses.`
        );
        return { ok: true, gatewayUsed: 'baileys' };
      }

      return {
        ok: false,
        gatewayUsed: 'baileys',
        error: `Gagal mengirim via WhatsApp Baileys: ${errMsg || 'Sesi soket WA terputus.'}`,
      };
    } finally {
      isSendingWhatsApp = false;
    }
  }

  // If still reconnecting after wait, flag as temporary so queue reschedules instead of failing!
  if (hasSavedBaileysCreds() && !waState.realSocketConnected) {
    return {
      ok: false,
      temporary: true,
      gatewayUsed: 'baileys',
      error:
        'Sesi WhatsApp sedang menyambung ulang ke server WA. Antrean pesan ditunda otomatis 15 detik.',
    };
  }

  // Option C: Explicit Simulation Mode ONLY if user deliberately enabled simulateIfOffline
  if (settings.simulateIfOffline) {
    return {
      ok: true,
      gatewayUsed: 'simulation',
    };
  }

  return {
    ok: false,
    gatewayUsed: 'baileys',
    error:
      'Sesi WhatsApp di server ini (Share App / Cloud) belum tertaut ke WA Anda. Buka tab "5. WA Admin & Cloud Sync", lalu tautkan dengan "Minta 8-Digit Pairing Code (1 HP)" atau "Tampilkan QR Code Baru" agar pesan benar-benar terkirim ke WhatsApp.',
  };
}

// ==========================================
// 4. BDI PROJEK MULTI-SCHEDULER & RANDOM QUEUE
// ==========================================

let isQueueWorkerRunning = false;

function getRandomInt(min: number, max: number): number {
  const safeMin = Math.max(1, Math.min(min, max));
  const safeMax = Math.max(safeMin, max);
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

export function getCandidateHadithsForProject(proj: BdiProject): HadithItem[] {
  const selected = proj.selectedProfiles || [];
  if (selected.length === 0) {
    return store.hadiths;
  }
  const filtered = store.hadiths.filter((h) =>
    selected.includes(h.profileName || 'Belum Terkategori')
  );
  return filtered.length > 0 ? filtered : store.hadiths;
}

export function getCandidateContactsForProject(proj: BdiProject): ContactItem[] {
  const activeContacts = store.contacts.filter((c) => c.isActive);
  const mode = proj.targetMode || 'all';
  if (mode === 'groups') {
    const groups = Array.isArray(proj.targetGroups) ? proj.targetGroups : [];
    if (groups.length === 0) return activeContacts;
    return activeContacts.filter((c) => groups.includes((c.groupTag || 'Jamaah Umum').trim()));
  }
  if (mode === 'contacts') {
    const ids = Array.isArray(proj.targetContactIds) ? proj.targetContactIds : [];
    if (ids.length === 0) return activeContacts;
    return activeContacts.filter((c) => ids.includes(c.id));
  }
  return activeContacts;
}

export function selectNextHadithForProject(proj: BdiProject): HadithItem | null {
  const pool = getCandidateHadithsForProject(proj);
  if (pool.length === 0) return null;

  if (proj.selectionOrder === 'random') {
    const unsentPool = pool.filter((h) => !h.isSent);
    if (unsentPool.length > 0) {
      const randIdx = Math.floor(Math.random() * unsentPool.length);
      return unsentPool[randIdx];
    }
    if (!proj.repeatWhenExhausted && proj.durationMode === 'database_count') {
      return null;
    }
    pool.forEach((h) => {
      h.isSent = false;
    });
    const randIdx = Math.floor(Math.random() * pool.length);
    return pool[randIdx];
  } else {
    let idx = proj.currentDatabaseIndex || 0;
    if (idx >= pool.length) {
      if (proj.durationMode === 'database_count' && !proj.repeatWhenExhausted) {
        return null;
      }
      idx = 0;
    }
    const chosen = pool[idx];
    proj.currentDatabaseIndex = idx + 1;
    return chosen;
  }
}

export function enqueueBroadcastBatch(params: {
  hadith: HadithItem;
  contacts: ContactItem[];
  messageType: 'scheduled' | 'manual';
  projectId?: string;
  projectName?: string;
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
  customManualText?: string;
  templateMode?: 'auto_contact' | 'single_template';
  templateId?: string;
  detailTemplateId?: string;
  singkatTemplateId?: string;
  forceResendAll?: boolean;
}): DeliveryLog[] {
  const batchId = `batch-${Date.now()}`;
  const minDelay = Number(params.minDelaySeconds ?? store.schedule.minDelaySeconds) || 10;
  const maxDelay = Number(params.maxDelaySeconds ?? store.schedule.maxDelaySeconds) || 35;

  let contactsToProcess = params.contacts;
  const alreadySentIdsToday = new Set<string>();

  if (params.projectId) {
    const proj = store.projects.find((p) => p.id === params.projectId);
    const tz: 'WIB' | 'WITA' | 'WIT' = proj?.timezone || 'WITA';
    const { dateStr: todayStr } = getIndonesiaZoneTime(tz);

    // 1. Gather all contacts that ALREADY got sent today for this project from deliveryLogs
    store.deliveryLogs.forEach((l) => {
      if (
        l.projectId === params.projectId &&
        l.status === 'sent' &&
        l.timestamp &&
        l.timestamp.slice(0, 10) === todayStr
      ) {
        alreadySentIdsToday.add(l.contactId);
      }
    });

    // 2. Also include sentContactIds from activeRun if it was run today
    if (proj?.lastTriggeredDate === todayStr && proj.activeRun?.sentContactIds) {
      proj.activeRun.sentContactIds.forEach((id) => alreadySentIdsToday.add(id));
    }

    if (!params.forceResendAll) {
      contactsToProcess = params.contacts.filter((c) => !alreadySentIdsToday.has(c.id));
    }
  }

  if (contactsToProcess.length === 0) {
    if (params.projectId) {
      const proj = store.projects.find((p) => p.id === params.projectId);
      if (proj && proj.activeRun) {
        proj.activeRun.status = 'completed';
        saveStore(store);
      }
    }
    return [];
  }

  const tplLengkap =
    (params.detailTemplateId && store.templates.find((t) => t.id === params.detailTemplateId)) ||
    store.templates.find((t) => t.category === 'lengkap' && t.isDefault) ||
    store.templates.find((t) => t.category === 'lengkap') ||
    DEFAULT_STORE.templates[0];

  const tplSingkat =
    (params.singkatTemplateId && store.templates.find((t) => t.id === params.singkatTemplateId)) ||
    store.templates.find((t) => t.category === 'singkat' && t.isDefault) ||
    store.templates.find((t) => t.category === 'singkat') ||
    DEFAULT_STORE.templates[1];

  const singleChosenTpl =
    params.templateMode === 'single_template' && params.templateId
      ? store.templates.find((t) => t.id === params.templateId) || null
      : null;

  let cumulativeOffsetMs = 0;
  const nowMs = Date.now();
  const createdLogs: DeliveryLog[] = [];

  contactsToProcess.forEach((contact, idx) => {
    const randomSec = idx === 0 ? getRandomInt(2, 6) : getRandomInt(minDelay, maxDelay);
    cumulativeOffsetMs += randomSec * 1000;

    let rendered = '';
    if (params.messageType === 'manual' && params.customManualText) {
      rendered = renderTemplateMessage(params.customManualText, params.hadith, contact);
    } else if (singleChosenTpl) {
      rendered = renderTemplateMessage(singleChosenTpl.content, params.hadith, contact);
    } else {
      const chosenTpl = contact.preference === 'singkat' ? tplSingkat : tplLengkap;
      rendered = renderTemplateMessage(chosenTpl.content, params.hadith, contact);
    }

    const logItem: DeliveryLog = {
      id: `log-${nowMs}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      batchId,
      projectId: params.projectId,
      projectName: params.projectName,
      contactId: contact.id,
      contactName: contact.name,
      contactPhone: normalizePhone(contact.phone),
      contactPreference: contact.preference,
      hadithId: params.hadith.id,
      hadithTitle: params.hadith.title,
      messageType: params.messageType,
      renderedMessage: rendered,
      status: 'queued',
      randomDelayAppliedSec: randomSec,
      scheduledAtMs: nowMs + cumulativeOffsetMs,
      gatewayUsed: store.gatewaySettings.activeMode === 'webhook' ? 'webhook' : 'baileys',
      timestamp: new Date(nowMs + cumulativeOffsetMs).toISOString(),
    };

    createdLogs.push(logItem);
  });

  // Track active execution in project
  if (params.projectId) {
    const proj = store.projects.find((p) => p.id === params.projectId);
    if (proj) {
      const tz: 'WIB' | 'WITA' | 'WIT' = proj.timezone || 'WITA';
      const { dateStr: todayStr } = getIndonesiaZoneTime(tz);
      proj.lastTriggeredDate = todayStr;
      const prevSent = Array.from(alreadySentIdsToday);
      proj.activeRun = {
        batchId,
        hadithId: params.hadith.id,
        hadithTitle: params.hadith.title,
        startedAt: new Date(nowMs).toISOString(),
        totalContacts: params.contacts.length,
        sentContactIds: prevSent,
        failedContactIds: [],
        pendingContactIds: contactsToProcess.map((c) => c.id),
        status: 'running',
      };
    }
  }

  store.deliveryLogs = [...createdLogs, ...store.deliveryLogs].slice(0, 500);
  saveStore(store);
  return createdLogs;
}

async function processQueueTick() {
  if (isQueueWorkerRunning) return;
  isQueueWorkerRunning = true;

  try {
    const now = Date.now();
    // 1. Strict pause & stop guard: find due item that belongs to an active, running project
    const dueItem = store.deliveryLogs.find((item) => {
      if (item.status !== 'queued' || item.scheduledAtMs > now) return false;
      if (item.projectId) {
        const proj = store.projects.find((p) => p.id === item.projectId);
        if (proj) {
          if (proj.status === 'paused') {
            item.status = 'paused';
            item.remainingMsWhenPaused = Math.max(2000, item.scheduledAtMs - now);
            saveStore(store);
            return false;
          }
          if (proj.status === 'stopped') {
            item.status = 'stopped';
            item.errorMessage = 'Dibatalkan karena projek dihentikan (Stopped)';
            saveStore(store);
            return false;
          }
        }
      }
      return true;
    });

    if (dueItem) {
      // 2. Extra verification before initiating send
      if (dueItem.projectId) {
        const proj = store.projects.find((p) => p.id === dueItem.projectId);
        if (proj && proj.status === 'paused') {
          dueItem.status = 'paused';
          dueItem.remainingMsWhenPaused = Math.max(2000, dueItem.scheduledAtMs - now);
          saveStore(store);
          return;
        }
        if (proj && proj.status === 'stopped') {
          dueItem.status = 'stopped';
          dueItem.errorMessage = 'Dibatalkan karena projek dihentikan (Stopped)';
          saveStore(store);
          return;
        }
      }

      dueItem.status = 'sending';
      saveStore(store);

      const result = await sendSingleWhatsAppMessage(dueItem.contactPhone, dueItem.renderedMessage);
      dueItem.gatewayUsed = result.gatewayUsed;

      if (result.ok) {
        dueItem.status = 'sent';
        dueItem.errorMessage = undefined;
      } else if ((result as any).temporary) {
        // Temporary socket reconnect: do NOT mark as failed! Keep queued with a 15-second delay
        dueItem.status = 'queued';
        dueItem.scheduledAtMs = Date.now() + 15000;
        dueItem.errorMessage = undefined;
        saveStore(store);
        return;
      } else {
        dueItem.status = 'failed';
        dueItem.errorMessage = result.error || 'Pengiriman gagal';
      }
      dueItem.timestamp = new Date().toISOString();

      // Update project activeRun progress
      if (dueItem.projectId) {
        const proj = store.projects.find((p) => p.id === dueItem.projectId);
        if (proj) {
          if (!proj.activeRun) {
            proj.activeRun = {
              batchId: dueItem.batchId,
              hadithId: dueItem.hadithId,
              hadithTitle: dueItem.hadithTitle,
              startedAt: dueItem.timestamp,
              totalContacts: 1,
              sentContactIds: [],
              failedContactIds: [],
              pendingContactIds: [],
              status: proj.status === 'paused' ? 'paused' : 'running',
            };
          }
          if (result.ok) {
            if (!proj.activeRun.sentContactIds.includes(dueItem.contactId)) {
              proj.activeRun.sentContactIds.push(dueItem.contactId);
            }
            // Remove from failedContactIds if it was previously failed and now succeeded
            proj.activeRun.failedContactIds = proj.activeRun.failedContactIds.filter(
              (id) => id !== dueItem.contactId
            );
          } else {
            if (!proj.activeRun.failedContactIds.includes(dueItem.contactId)) {
              proj.activeRun.failedContactIds.push(dueItem.contactId);
            }
          }
          proj.activeRun.pendingContactIds = proj.activeRun.pendingContactIds.filter(
            (id) => id !== dueItem.contactId
          );
          const hasRemainingQueued = store.deliveryLogs.some(
            (l) => l.projectId === proj.id && (l.status === 'queued' || l.status === 'paused')
          );
          if (!hasRemainingQueued && proj.activeRun.pendingContactIds.length === 0) {
            proj.activeRun.status = 'completed';
          }
        }
      }

      saveStore(store);
    }
  } finally {
    isQueueWorkerRunning = false;
  }
}

function getIndonesiaZoneTime(tz: 'WIB' | 'WITA' | 'WIT' = 'WITA'): {
  dateStr: string;
  hhmm: string;
  hhmmss: string;
  dayOfWeek: number;
} {
  const ianaMap: Record<'WIB' | 'WITA' | 'WIT', string> = {
    WIB: 'Asia/Jakarta',
    WITA: 'Asia/Makassar',
    WIT: 'Asia/Jayapura',
  };
  const timeZone = ianaMap[tz] || 'Asia/Makassar';
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour') === '24' ? '00' : get('hour');
  const minute = get('minute');
  const second = get('second');

  const localDayDate = new Date(Number(year), Number(month) - 1, Number(day));
  const dayOfWeek = localDayDate.getDay(); // 0=Minggu .. 6=Sabtu

  return {
    dateStr: `${year}-${month}-${day}`,
    hhmm: `${hour}:${minute}`,
    hhmmss: `${hour}:${minute}:${second} ${tz}`,
    dayOfWeek,
  };
}

function checkMultiProjectsScheduleTick() {
  if (store.hadiths.length === 0) return;

  const now = new Date();

  for (const proj of store.projects) {
    if (proj.status !== 'running') continue;
    const projectContacts = getCandidateContactsForProject(proj);
    if (projectContacts.length === 0) continue;

    const tz: 'WIB' | 'WITA' | 'WIT' = proj.timezone || 'WITA';
    const { dateStr: todayStr, hhmm: currentHHMM, dayOfWeek } = getIndonesiaZoneTime(tz);

    if (proj.lastTriggeredDate === todayStr) continue;

    // Check active days based on scheduleFrequency & scheduleDays
    const freq = proj.scheduleFrequency || 'daily';
    const allowedDays =
      freq === 'daily'
        ? [0, 1, 2, 3, 4, 5, 6]
        : Array.isArray(proj.scheduleDays) && proj.scheduleDays.length > 0
        ? proj.scheduleDays
        : [0, 1, 2, 3, 4, 5, 6];

    if (!allowedDays.includes(dayOfWeek)) {
      continue;
    }

    // Check duration validity for months / years mode
    if (proj.durationMode === 'months' || proj.durationMode === 'years') {
      const start = new Date(proj.startDate || todayStr);
      const maxDays =
        proj.durationMode === 'months'
          ? (proj.durationValue || 1) * 30
          : (proj.durationValue || 1) * 365;
      const elapsedDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (elapsedDays > maxDays) {
        proj.status = 'stopped';
        saveStore(store);
        continue;
      }
    }

    if (currentHHMM >= proj.sendTime) {
      // Clear stale active run from previous days so it never repeats yesterday's hadith
      if (proj.activeRun && proj.activeRun.startedAt && proj.activeRun.startedAt.slice(0, 10) !== todayStr) {
        delete proj.activeRun;
      }
      const nextHadith = selectNextHadithForProject(proj);
      if (!nextHadith) {
        proj.status = 'stopped';
        saveStore(store);
        continue;
      }

      nextHadith.isSent = true;
      proj.lastTriggeredDate = todayStr;
      proj.totalSentCount = (proj.totalSentCount || 0) + projectContacts.length;

      enqueueBroadcastBatch({
        hadith: nextHadith,
        contacts: projectContacts,
        messageType: 'scheduled',
        projectId: proj.id,
        projectName: proj.name,
        minDelaySeconds: proj.minDelaySeconds,
        maxDelaySeconds: proj.maxDelaySeconds,
        templateMode: proj.templateMode || 'auto_contact',
        templateId: proj.templateId,
        detailTemplateId: proj.detailTemplateId,
        singkatTemplateId: proj.singkatTemplateId,
      });

      store.projectHistory = [
        {
          id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          projectId: proj.id,
          projectName: proj.name,
          hadithId: nextHadith.id,
          hadithTitle: nextHadith.title,
          profileName: nextHadith.profileName || 'Belum Terkategori',
          triggeredAt: now.toISOString(),
          triggerType: 'auto' as const,
          contactCount: projectContacts.length,
          notes: `Jadwal otomatis jam ${proj.sendTime} ${tz} ke ${projectContacts.length} kontak (${proj.selectionOrder === 'random' ? 'Random' : 'Berurutan'})`,
        },
        ...(store.projectHistory || []),
      ].slice(0, 200);

      saveStore(store);
    }
  }
}

// 1. Process sending queue and check schedule every 2 seconds
setInterval(() => {
  processQueueTick().catch(() => {});
  checkMultiProjectsScheduleTick();
}, 2000);

// 2. Health check: keep Baileys connected every 30 seconds (prevent rapid thrashing)
setInterval(() => {
  if (
    hasSavedBaileysCreds() &&
    !waState.realSocketConnected &&
    waState.status !== 'connecting' &&
    !isStartingBaileys &&
    Date.now() - lastConnectAttempt > 15000
  ) {
    ensureBaileysConnected().catch(() => {});
  }
}, 30000);

// ==========================================
// 5. FREE SHAHIH HADITH + GEMINI AI GENERATOR
// ==========================================

const FREE_HADITH_BOOKS: Record<string, { id: string; label: string; bookName: string; defaultDegree: string }> = {
  bukhari: { id: 'bukhari', label: 'HR. Bukhari', bookName: 'Shahih Al-Bukhari', defaultDegree: 'Shahih' },
  muslim: { id: 'muslim', label: 'HR. Muslim', bookName: 'Shahih Muslim', defaultDegree: 'Shahih' },
  'abu-daud': { id: 'abu-daud', label: 'HR. Abu Dawud', bookName: 'Sunan Abu Dawud', defaultDegree: 'Shahih' },
  tirmidzi: { id: 'tirmidzi', label: 'HR. Tirmidzi', bookName: "Jami' At-Tirmidzi", defaultDegree: 'Hasan Shahih' },
  nasai: { id: 'nasai', label: "HR. An-Nasa'i", bookName: "Sunan An-Nasa'i", defaultDegree: 'Shahih' },
  'ibnu-majah': { id: 'ibnu-majah', label: 'HR. Ibnu Majah', bookName: 'Sunan Ibnu Majah', defaultDegree: 'Shahih' },
};

async function fetchFreeHadithSeeds(bookKey: string, count: number): Promise<any[]> {
  try {
    const book = FREE_HADITH_BOOKS[bookKey] || FREE_HADITH_BOOKS.bukhari;
    const start = Math.floor(Math.random() * 120) + 1;
    const end = start + Math.min(25, Math.max(count * 2, 8)) - 1;
    const url = `https://api.hadith.gading.dev/books/${book.id}?range=${start}-${end}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const json: any = await res.json();
    return json?.data?.hadiths || [];
  } catch {
    return [];
  }
}

async function fetchKemenagQuranSeeds(): Promise<any[]> {
  try {
    const surahList = [1, 2, 3, 17, 18, 31, 36, 49, 55, 67, 93, 94, 103, 112];
    const randomSurah = surahList[Math.floor(Math.random() * surahList.length)];
    const url = `https://equran.id/api/v2/surat/${randomSurah}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const json: any = await res.json();
    const namaLatin = json?.data?.namaLatin || 'Al-Baqarah';
    const nomorSurat = json?.data?.nomor || 2;
    const ayatList: any[] = json?.data?.ayat || [];
    return ayatList.slice(0, 8).map((a: any) => ({
      surahName: `QS. ${namaLatin} (${nomorSurat})`,
      ayatNumber: String(a.nomorAyat || 1),
      arab: a.teksArab || '',
      terjemahKemenag: a.teksIndonesia || '',
    }));
  } catch {
    return [];
  }
}

function classifyHadithLength(arabic: string, translation: string): 'singkat' | 'sedang' | 'panjang' {
  const len = (translation || '').length + (arabic || '').length * 0.5;
  if (len <= 240) return 'singkat';
  if (len <= 520) return 'sedang';
  return 'panjang';
}

function safeParseGeminiArray(rawText: string): any[] {
  const cleaned = (rawText || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  if (!cleaned) return [];
  try {
    const direct = JSON.parse(cleaned);
    if (Array.isArray(direct)) return direct;
    if (direct && Array.isArray(direct.items)) return direct.items;
  } catch {
    // Attempt recovery if output was truncated mid-stream on large requests
    const firstBracket = cleaned.indexOf('[');
    if (firstBracket >= 0) {
      const lastCompleteObj = cleaned.lastIndexOf('}');
      if (lastCompleteObj > firstBracket) {
        const recovered = cleaned.slice(firstBracket, lastCompleteObj + 1) + ']';
        try {
          const parsedRecovered = JSON.parse(recovered);
          if (Array.isArray(parsedRecovered)) return parsedRecovered;
        } catch {
          // ignore
        }
      }
    }
  }
  return [];
}

// ==========================================
// 6. EXPRESS SERVER & API ROUTES
// ==========================================

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // CORS: izinkan frontend statis (GitHub Pages) memakai API backend ini,
  // agar QR Code / Pairing Code WhatsApp bisa muncul dari github.io.
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://ridgital-auto.github.io');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Get full store + runtime WA state
  app.get('/api/state', (_req, res) => {
    res.json({
      store,
      waState: {
        ...waState,
        hasSavedCreds: hasSavedBaileysCreds(),
      },
      serverTime: getIndonesiaZoneTime('WITA').hhmmss,
    });
  });

  // Replace or restore full store (from local JSON import or Google Drive restore)
  app.post('/api/store/restore', (req, res) => {
    const incoming = req.body?.store;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ error: 'Data backup tidak valid.' });
      return;
    }
    const hadiths = Array.isArray(incoming.hadiths) ? incoming.hadiths : store.hadiths;
    const profiles = syncProfiles(
      hadiths,
      Array.isArray(incoming.profiles) ? incoming.profiles : store.profiles
    );
    const generationHistory = syncGenerationHistory(
      hadiths,
      Array.isArray(incoming.generationHistory)
        ? incoming.generationHistory
        : store.generationHistory || []
    );
    const contacts = Array.isArray(incoming.contacts) ? incoming.contacts : store.contacts;
    const contactGroups = syncContactGroups(
      contacts,
      Array.isArray(incoming.contactGroups) ? incoming.contactGroups : store.contactGroups || []
    );

    // Merge deliveryLogs safely: preserve server active 'queued' or 'sending' items
    const incomingLogs = Array.isArray(incoming.deliveryLogs) ? incoming.deliveryLogs : [];
    const activeServerLogs = store.deliveryLogs.filter(
      (l) => l.status === 'queued' || l.status === 'sending'
    );
    const activeServerIds = new Set(activeServerLogs.map((l) => l.id));
    const mergedLogs = [
      ...activeServerLogs,
      ...incomingLogs.filter((l: any) => !activeServerIds.has(l.id)),
    ].slice(0, 500);

    // Merge projects while preserving server activeRun and lastTriggeredDate
    const incomingProjects = Array.isArray(incoming.projects) ? incoming.projects : store.projects;
    const mergedProjects = incomingProjects.map((ip: any) => {
      const sp = store.projects.find((p) => p.id === ip.id);
      if (!sp) return ip;
      return {
        ...ip,
        lastTriggeredDate: sp.lastTriggeredDate || ip.lastTriggeredDate,
        totalSentCount: Math.max(sp.totalSentCount || 0, ip.totalSentCount || 0),
        activeRun: sp.activeRun || ip.activeRun,
      };
    });

    // Hydrate WA auth snapshot if client provided one and local disk has none
    if (incoming.waAuthSnapshot && !hasSavedBaileysCreds()) {
      restoreWaAuthDir(incoming.waAuthSnapshot);
      store.waAuthSnapshot = incoming.waAuthSnapshot;
      persistWaAuthSnapshot();
    }

    store = {
      profiles,
      contactGroups,
      hadiths,
      generationHistory,
      templates: Array.isArray(incoming.templates) ? incoming.templates : store.templates,
      templateVariables:
        Array.isArray(incoming.templateVariables) && incoming.templateVariables.length > 0
          ? incoming.templateVariables
          : store.templateVariables || DEFAULT_TEMPLATE_VARIABLES,
      contacts,
      projects: mergedProjects,
      projectHistory: Array.isArray(incoming.projectHistory)
        ? incoming.projectHistory
        : store.projectHistory,
      schedule: incoming.schedule ? { ...store.schedule, ...incoming.schedule } : store.schedule,
      gatewaySettings: incoming.gatewaySettings
        ? { ...store.gatewaySettings, ...incoming.gatewaySettings }
        : store.gatewaySettings,
      externalSync: incoming.externalSync
        ? { ...store.externalSync, ...incoming.externalSync }
        : store.externalSync,
      deliveryLogs: mergedLogs,
      waAuthSnapshot: store.waAuthSnapshot || incoming.waAuthSnapshot,
    };

    if (waState.realSocketConnected && waSocket) {
      waState.status = 'connected';
      waState.hasSavedCreds = true;
    } else if (hasSavedBaileysCreds() || tryHydrateWaAuthFromBackup()) {
      waState.status = 'connecting';
      waState.hasSavedCreds = true;
      ensureBaileysConnected().catch(() => {});
    } else {
      waState.status = 'disconnected';
      waState.realSocketConnected = false;
      waState.hasSavedCreds = false;
      store.gatewaySettings.sessionLinked = false;
    }
    store.gatewaySettings.simulateIfOffline = Boolean(incoming.gatewaySettings?.simulateIfOffline && false);
    saveStore(store);
    res.json({ ok: true, store, waState });
  });

  // --- PROFILES LIST: VIEW, RENAME (EDIT), DELETE ---
  app.put('/api/profiles/rename', (req, res) => {
    const oldName = String(req.body?.oldName || '').trim();
    const newName = String(req.body?.newName || '').trim();
    if (!oldName || !newName) {
      res.status(400).json({ error: 'Nama profil lama dan baru wajib diisi.' });
      return;
    }
    if (oldName === 'Belum Terkategori') {
      res.status(400).json({ error: 'Profil "Belum Terkategori" tidak dapat diubah namanya.' });
      return;
    }
    store.hadiths.forEach((h) => {
      if ((h.profileName || 'Belum Terkategori') === oldName) {
        h.profileName = newName;
      }
    });
    store.profiles = store.profiles.map((p) => (p === oldName ? newName : p));
    if (!store.profiles.includes(newName)) {
      store.profiles.push(newName);
    }
    store.projects.forEach((proj) => {
      proj.selectedProfiles = (proj.selectedProfiles || []).map((p) =>
        p === oldName ? newName : p
      );
    });
    saveStore(store);
    res.json({
      ok: true,
      profiles: store.profiles,
      hadiths: store.hadiths,
      projects: store.projects,
    });
  });

  app.delete('/api/profiles/:name', (req, res) => {
    const targetName = decodeURIComponent(req.params.name || '').trim();
    if (!targetName || targetName === 'Belum Terkategori') {
      res.status(400).json({ error: 'Profil default tidak dapat dihapus.' });
      return;
    }
    const deleteItems = Boolean(req.body?.deleteItems);
    if (deleteItems) {
      store.hadiths = store.hadiths.filter((h) => h.profileName !== targetName);
    } else {
      store.hadiths.forEach((h) => {
        if (h.profileName === targetName) {
          h.profileName = 'Belum Terkategori';
        }
      });
    }
    store.profiles = store.profiles.filter((p) => p !== targetName);
    store.projects.forEach((proj) => {
      proj.selectedProfiles = (proj.selectedProfiles || []).filter((p) => p !== targetName);
      if (proj.selectedProfiles.length === 0) {
        proj.selectedProfiles = ['Belum Terkategori'];
      }
    });
    saveStore(store);
    res.json({
      ok: true,
      profiles: store.profiles,
      hadiths: store.hadiths,
      projects: store.projects,
    });
  });

  // --- HADITH DATABASE CRUD ---
  app.post('/api/hadiths/save-batch', (req, res) => {
    const items: HadithItem[] = req.body?.items || [];
    const targetProfile = String(req.body?.profileName || '').trim() || 'Belum Terkategori';
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Tidak ada item hadis untuk disimpan.' });
      return;
    }
    if (!store.profiles.includes(targetProfile)) {
      store.profiles.push(targetProfile);
    }
    const baseOrder = store.hadiths.length;
    const normalized: HadithItem[] = items.map((item, idx) => ({
      id:
        item.id && !item.id.startsWith('preview-')
          ? item.id
          : `hd-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      type: item.type || 'hadis',
      profileName: targetProfile,
      sourceBook: item.sourceBook || 'HR. Bukhari',
      sourceBookName:
        item.sourceBookName ||
        (item.type === 'quran' ? 'Al-Quran Terjemahan Kemenag RI' : 'Shahih Al-Bukhari'),
      hadithNumber: String(item.hadithNumber || idx + 1),
      hadithDegree:
        item.hadithDegree || (item.type === 'quran' ? "Qath'i (Al-Quran)" : 'Shahih'),
      hadithLength:
        item.hadithLength || classifyHadithLength(item.arabicText || '', item.translationText || ''),
      title: item.title || 'Mutiara Hadis Shahih',
      arabicText: item.arabicText || '',
      translationText: item.translationText || '',
      asbabulWurud:
        item.asbabulWurud ||
        'Tidak terdapat riwayat asbabul wurud khusus untuk hadis ini; hadis ini merupakan sabda tuntunan umum Rasulullah ﷺ.',
      shortSummary: item.shortSummary || '',
      lessonText: item.lessonText || '',
      categoryTopic: item.categoryTopic || 'Umum',
      sequenceOrder: baseOrder + idx + 1,
      isSent: Boolean(item.isSent),
      createdAt: item.createdAt || new Date().toISOString(),
    }));
    store.hadiths = [...store.hadiths, ...normalized];
    saveStore(store);
    res.json({
      ok: true,
      hadiths: store.hadiths,
      profiles: store.profiles,
      generationHistory: store.generationHistory,
    });
  });

  app.put('/api/hadiths/:id', (req, res) => {
    const { id } = req.params;
    const idx = store.hadiths.findIndex((h) => h.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Hadis tidak ditemukan.' });
      return;
    }
    store.hadiths[idx] = { ...store.hadiths[idx], ...req.body, id };
    saveStore(store);
    res.json({
      ok: true,
      hadiths: store.hadiths,
      profiles: store.profiles,
      generationHistory: store.generationHistory,
    });
  });

  app.delete('/api/hadiths/:id', (req, res) => {
    const { id } = req.params;
    store.hadiths = store.hadiths.filter((h) => h.id !== id);
    saveStore(store);
    res.json({
      ok: true,
      hadiths: store.hadiths,
      profiles: store.profiles,
      generationHistory: store.generationHistory,
    });
  });

  // --- LOG HADIS TER-GENERATE & SINKRONISASI ANTI-DUPLIKAT ---
  app.post('/api/generation-history/sync', (_req, res) => {
    store.generationHistory = syncGenerationHistory(
      store.hadiths,
      store.generationHistory || []
    );
    saveStore(store);
    res.json({ ok: true, generationHistory: store.generationHistory });
  });

  app.post('/api/generation-history/clear-orphans', (_req, res) => {
    // Keep only log entries that are currently in store.hadiths
    store.generationHistory = syncGenerationHistory(store.hadiths, []);
    saveStore(store);
    res.json({ ok: true, generationHistory: store.generationHistory });
  });

  app.delete('/api/generation-history/:id', (req, res) => {
    const { id } = req.params;
    store.generationHistory = (store.generationHistory || []).filter((g) => g.id !== id);
    saveStore(store);
    res.json({ ok: true, generationHistory: store.generationHistory });
  });

  // --- AI HADITH & QURAN DATABASE GENERATOR (GEMINI) ---
  app.post('/api/ai/generate-database', async (req, res) => {
    try {
      const {
        criteria = 'Keutamaan akhlak mulia, sedekah, dan menjaga lisan',
        mainTheme = '',
        subThemes = [],
        hadithLength = 'singkat',
        sourceBook = 'bukhari',
        sourceBooks,
        contentType = 'hadis',
        count = 5,
        profileName = 'Belum Terkategori',
        allowDuplicates = false,
        excludeRefs = [],
        userEmail = '',
      } = req.body || {};

      const safeCount = Math.min(25, Math.max(1, Number(count) || 5));
      const cleanProfile = String(profileName || 'Belum Terkategori').trim() || 'Belum Terkategori';
      const requestedLength: 'singkat' | 'sedang' | 'panjang' =
        hadithLength === 'sedang' || hadithLength === 'panjang' ? hadithLength : 'singkat';

      const cleanMainTheme = String(mainTheme || criteria || 'Akhlak Mulia & Ibadah')
        .trim()
        .slice(0, 1200);
      const cleanSubThemes: string[] = Array.isArray(subThemes)
        ? subThemes
            .map((st: any) => String(st || '').trim().slice(0, 500))
            .filter(Boolean)
        : [];

      const fullThemeDescription =
        cleanSubThemes.length > 0
          ? `Tema Utama: "${cleanMainTheme}". Sub-Tema Spesifik: ${cleanSubThemes
              .map((s, idx) => `(${idx + 1}) ${s}`)
              .join('; ')}`
          : `Tema Utama: "${cleanMainTheme}"`;

      const lengthInstruction =
        requestedLength === 'singkat'
          ? 'Panjang Materi: SINGKAT / RINGKAS (Pilih hadis/ayat dengan matan pendek 1-2 kalimat yang padat, mudah dihafal, dan langsung pada inti permasalahan).'
          : requestedLength === 'sedang'
          ? 'Panjang Materi: SEDANG (Pilih hadis/ayat dengan panjang menengah sekitar 2-4 kalimat yang memuat konteks nasihat secara utuh).'
          : 'Panjang Materi: PANJANG / MENDALAM (Pilih hadis/ayat yang lebih panjang atau memuat dialog/rincian lengkap beserta penjelasan mendalam).';

      const selectedBooksList: string[] =
        Array.isArray(sourceBooks) && sourceBooks.length > 0
          ? sourceBooks.map((b: any) => String(b).trim()).filter(Boolean)
          : sourceBook === 'semua'
          ? ['bukhari', 'muslim']
          : [String(sourceBook || 'bukhari')];

      const bookLabels = selectedBooksList.map(
        (id) => FREE_HADITH_BOOKS[id]?.label || `HR. ${id}`
      );
      const bookOfficialNames = selectedBooksList.map(
        (id) => FREE_HADITH_BOOKS[id]?.bookName || `Kitab ${id}`
      );
      const combinedBooksLabel = bookLabels.join(', ');
      const combinedBookNames = bookOfficialNames.join(', ');

      // Build anti-duplicate list from database + generationHistory + explicit excludeRefs
      const syncedLog = syncGenerationHistory(store.hadiths, store.generationHistory || []);
      const existingRegistryStrings: string[] = [];
      if (!allowDuplicates) {
        for (const entry of syncedLog.slice(-120)) {
          existingRegistryStrings.push(
            `${entry.sourceBook} No. ${entry.hadithNumber} ("${entry.title}")`
          );
        }
        if (Array.isArray(excludeRefs)) {
          for (const ex of excludeRefs) {
            if (ex && typeof ex === 'string') existingRegistryStrings.push(ex);
          }
        }
      }

      let rawApiSeeds: any[] = [];
      let rawQuranSeeds: any[] = [];
      if (contentType === 'hadis') {
        const booksToSeed = selectedBooksList.slice(0, 3);
        const perBookCount = Math.max(2, Math.ceil(safeCount / booksToSeed.length));
        for (const bId of booksToSeed) {
          if (FREE_HADITH_BOOKS[bId]) {
            const seeds = await fetchFreeHadithSeeds(bId, perBookCount);
            rawApiSeeds.push(
              ...seeds.map((s: any) => ({
                ...s,
                bookLabel: FREE_HADITH_BOOKS[bId].label,
                bookName: FREE_HADITH_BOOKS[bId].bookName,
                defaultDegree: FREE_HADITH_BOOKS[bId].defaultDegree,
              }))
            );
          }
        }
      } else {
        rawQuranSeeds = await fetchKemenagQuranSeeds();
      }

      const seedContext =
        contentType === 'hadis' && rawApiSeeds.length > 0
          ? `\nContoh format data terjemahan bahasa Indonesia terverifikasi dari Ensiklopedi Kitab 9 Imam (${combinedBookNames}):\n` +
            rawApiSeeds
              .slice(0, 5)
              .map(
                (s: any) =>
                  `- [${s.bookLabel} | Kitab: ${s.bookName} | No. ${s.number}]: ${String(
                    s.arab || ''
                  ).slice(0, 220)} => Terjemahan Kitab: "${String(s.id || '').slice(0, 260)}"`
              )
              .join('\n')
          : contentType === 'quran' && rawQuranSeeds.length > 0
          ? `\nContoh format data terjemahan resmi Lajnah Pentashihan Mushaf Al-Quran Kemenag RI:\n` +
            rawQuranSeeds
              .slice(0, 4)
              .map(
                (q: any) =>
                  `- [${q.surahName} Ayat ${q.ayatNumber}]: ${String(q.arab || '').slice(
                    0,
                    200
                  )} => Terjemahan Resmi Kemenag RI: "${String(q.terjemahKemenag || '').slice(
                    0,
                    240
                  )}"`
              )
              .join('\n')
          : '';

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const batchSizes: number[] = [];
      let remaining = safeCount;
      const maxPerCall = requestedLength === 'panjang' ? 5 : 8;
      while (remaining > 0) {
        const take = Math.min(maxPerCall, remaining);
        batchSizes.push(take);
        remaining -= take;
      }

      const allParsedItems: any[] = [];

      for (let bIdx = 0; bIdx < batchSizes.length; bIdx++) {
        const chunkCount = batchSizes[bIdx];
        const currentChunkAvoid = [
          ...existingRegistryStrings,
          ...allParsedItems.map(
            (it) => `${it.sourceBook} No. ${it.hadithNumber} ("${it.title}")`
          ),
        ];

        const avoidClause =
          !allowDuplicates && currentChunkAvoid.length > 0
            ? `\nATURAN ANTI-DUPLIKAT (WAJIB DITAATI): DILARANG KERAS mengulang atau memilih hadis/ayat yang sudah ada di daftar log berikut ini (pilih nomor hadis / riwayat lain yang berbeda): ${currentChunkAvoid
                .slice(-80)
                .join('; ')}.`
            : allParsedItems.length > 0
            ? `\nHindari mengulang judul/nomor hadis yang baru saja dibuat di batch ini: ${allParsedItems
                .map((it) => `${it.sourceBook} No. ${it.hadithNumber}`)
                .join(', ')}.`
            : '';

        const prompt =
          contentType === 'quran'
            ? `Susunkan ${chunkCount} data Ayat Al-Quran berdasarkan ${fullThemeDescription}.
${lengthInstruction}${seedContext}${avoidClause}

ATURAN KEVALIDAN SUMBER & TERJEMAHAN (WAJIB DITAATI):
1. Terjemahan (translationText) WAJIB mengutip teks terjemahan resmi Lajnah Pentashihan Mushaf Al-Quran Kementerian Agama RI (Kemenag RI) yang sudah baku, BUKAN hasil terjemahan bebas AI dari teks Arab.
2. sourceBook diisi nama Surah (contoh: "QS. Al-Baqarah"), sourceBookName diisi sumber mushaf/kitab tafsir resmi (contoh: "Al-Quran Terjemahan Kemenag RI & Tafsir Ibnu Katsir"), dan hadithNumber diisi nomor ayat yang akurat (contoh: "153" atau "2:153").
3. hadithDegree diisi "Qath'i (Al-Quran Al-Karim)".
4. hadithLength diisi "${requestedLength}".
5. shortSummary berisi intisari singkat 1-2 kalimat padat yang langsung merangkum pokok ayat untuk tampilan daftar utama.
6. asbabulWurud berisi riwayat Asbabun Nuzul yang shahih dari kitab tafsir muktabar (Ibnu Katsir / Ath-Thabari / As-Suyuthi). Jika tidak ada asbabun nuzul khusus, tulis jujur bahwa ayat ini turun sebagai tuntunan umum.`
            : `Susunkan ${chunkCount} data Hadis yang valid dari kitab: ${combinedBooksLabel} (${combinedBookNames}) berdasarkan ${fullThemeDescription}.
${lengthInstruction}${seedContext}${avoidClause}

ATURAN KEVALIDAN SUMBER, NOMOR KITAB, DERAJAT & TERJEMAHAN (WAJIB DITAATI):
1. Terjemahan (translationText) WAJIB menggunakan teks terjemahan baku bahasa Indonesia dari kitab hadis yang sudah diterjemahkan secara resmi (Ensiklopedi Hadits 9 Imam / Kutubut Tis'ah / Terjemah Shahih Bukhari-Muslim-Sunan yang muktabar), BUKAN menerjemahkan sendiri secara bebas dari teks Arab.
2. Perawi (sourceBook) diisi nama perawi (contoh: "HR. Bukhari", "HR. Muslim", "HR. Tirmidzi").
3. Nama Kitab Sumber (sourceBookName) WAJIB menyebutkan nama kitab sumber beserta bab/kitabnya secara jelas (contoh: "Shahih Al-Bukhari - Kitab Al-Iman" atau "Shahih Muslim - Kitab Al-Birr wa Ash-Shilah" atau "Jami' At-Tirmidzi").
4. Nomor Hadis (hadithNumber) WAJIB berupa nomor hadis asli sesuai penomoran standar dari kitab sumber tersebut (contoh: "1", "2564", "1956", "6018") — bukan nomor urut 1, 2, 3 sembarangan.
5. Derajat Hadis (hadithDegree) WAJIB dicantumkan secara ilmiah sesuai tahqiq ulama hadis (contoh: "Shahih", "Shahih (Muttafaqun 'Alaih)", atau "Hasan Shahih").
6. hadithLength diisi "${requestedLength}" (sesuai panjang hadis yang diminta).
7. shortSummary berisi ringkasan singkat 1-2 kalimat yang padat dan jelas untuk tampilan ringkas di halaman utama.
8. asbabulWurud berisi sebab munculnya hadis dari syarah muktabar (Fathul Bari / Syarah Muslim An-Nawawi). Jika tidak ada riwayat khusus, tulis jujur: "Tidak terdapat riwayat asbabul wurud khusus untuk hadis ini; hadis ini disampaikan Rasulullah ﷺ sebagai tuntunan umum."`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction: `Anda adalah tim lajnah pentashih hadis & Al-Quran BDI Daily Quran & Hadis (${userEmail || 'Admin BDI'}). Anda hanya menyajikan teks Arab, nomor hadis asli dari kitab sumber (${combinedBookNames}), derajat hadis yang terverifikasi, serta terjemahan resmi dari kitab terjemahan baku / Kemenag RI (bukan terjemahan karangan bebas AI).`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  sourceBook: { type: Type.STRING },
                  sourceBookName: { type: Type.STRING },
                  hadithNumber: { type: Type.STRING },
                  hadithDegree: { type: Type.STRING },
                  hadithLength: { type: Type.STRING },
                  arabicText: { type: Type.STRING },
                  translationText: { type: Type.STRING },
                  asbabulWurud: { type: Type.STRING },
                  shortSummary: { type: Type.STRING },
                  lessonText: { type: Type.STRING },
                  categoryTopic: { type: Type.STRING },
                },
                required: [
                  'title',
                  'sourceBook',
                  'sourceBookName',
                  'hadithNumber',
                  'hadithDegree',
                  'hadithLength',
                  'arabicText',
                  'translationText',
                  'asbabulWurud',
                  'shortSummary',
                  'lessonText',
                  'categoryTopic',
                ],
              },
            },
          },
        });

        const parsedChunk = safeParseGeminiArray(response.text || '[]');
        allParsedItems.push(...parsedChunk);
      }

      const previewItems: HadithItem[] = allParsedItems.slice(0, safeCount).map(
        (item: any, index: number) => {
          const fallbackBookKey = selectedBooksList[index % selectedBooksList.length] || 'bukhari';
          const fallbackBookMeta = FREE_HADITH_BOOKS[fallbackBookKey] || FREE_HADITH_BOOKS.bukhari;
          const normLen =
            item.hadithLength === 'sedang' || item.hadithLength === 'panjang' || item.hadithLength === 'singkat'
              ? item.hadithLength
              : requestedLength;

          return {
            id: `preview-${Date.now()}-${index}`,
            type: contentType === 'quran' ? 'quran' : 'hadis',
            profileName: cleanProfile,
            sourceBook:
              item.sourceBook ||
              (contentType === 'quran' ? 'QS. Al-Baqarah' : fallbackBookMeta.label),
            sourceBookName:
              item.sourceBookName ||
              (contentType === 'quran'
                ? 'Al-Quran Terjemahan Kemenag RI'
                : fallbackBookMeta.bookName),
            hadithNumber: String(item.hadithNumber || index + 1),
            hadithDegree:
              item.hadithDegree ||
              (contentType === 'quran' ? "Qath'i (Al-Quran)" : fallbackBookMeta.defaultDegree),
            hadithLength: normLen,
            title: item.title || 'Mutiara Hadis Shahih',
            arabicText: item.arabicText || '',
            translationText: item.translationText || '',
            asbabulWurud:
              item.asbabulWurud ||
              'Tidak terdapat riwayat asbabul wurud khusus untuk hadis ini; hadis ini disampaikan Rasulullah ﷺ sebagai tuntunan umum.',
            shortSummary: item.shortSummary || item.translationText || '',
            lessonText: item.lessonText || '',
            categoryTopic:
              item.categoryTopic ||
              (cleanSubThemes.length > 0
                ? `${cleanMainTheme} (${cleanSubThemes[index % cleanSubThemes.length]})`
                : cleanMainTheme),
            sequenceOrder: store.hadiths.length + index + 1,
            isSent: false,
            createdAt: new Date().toISOString(),
          };
        }
      );

      if (previewItems.length === 0) {
        throw new Error('Hasil generate kosong, silakan coba kembali.');
      }

      // Record in generationHistory log and detect any duplicates against existing store.hadiths or previous log
      const existingLogSnapshot = [...(store.generationHistory || [])];
      const duplicateMatches: {
        previewId: string;
        existingTitle: string;
        existingSourceBook: string;
        existingHadithNumber: string;
        existingProfileName: string;
        inDatabase: boolean;
      }[] = [];

      for (const pItem of previewItems) {
        const dbMatch = store.hadiths.find((h) => isSameHadithItem(h, pItem));
        const logMatch = existingLogSnapshot.find((g) => isSameHadithItem(g, pItem));
        if (dbMatch) {
          duplicateMatches.push({
            previewId: pItem.id,
            existingTitle: dbMatch.title,
            existingSourceBook: dbMatch.sourceBook,
            existingHadithNumber: dbMatch.hadithNumber,
            existingProfileName: dbMatch.profileName || 'Belum Terkategori',
            inDatabase: true,
          });
        } else if (logMatch) {
          duplicateMatches.push({
            previewId: pItem.id,
            existingTitle: logMatch.title,
            existingSourceBook: logMatch.sourceBook,
            existingHadithNumber: logMatch.hadithNumber,
            existingProfileName: logMatch.profileName || 'Riwayat Generate',
            inDatabase: Boolean(logMatch.inDatabase),
          });
        }

        const fp = computeHadithFingerprint(pItem);
        if (fp && !store.generationHistory?.some((g) => g.fingerprint === fp)) {
          store.generationHistory = [
            ...(store.generationHistory || []),
            {
              id: `genlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              fingerprint: fp,
              type: pItem.type,
              sourceBook: pItem.sourceBook,
              sourceBookName: pItem.sourceBookName || pItem.sourceBook,
              hadithNumber: pItem.hadithNumber,
              title: pItem.title,
              categoryTopic: pItem.categoryTopic,
              profileName: cleanProfile,
              inDatabase: Boolean(dbMatch),
              generatedAt: new Date().toISOString(),
            },
          ];
        }
      }

      saveStore(store);

      res.json({
        ok: true,
        items: previewItems,
        duplicateMatches,
        generationHistory: store.generationHistory,
      });
    } catch (error: any) {
      console.error('Gemini generate-database error:', error);
      res.status(500).json({
        error:
          error?.message || 'Gagal menyusun database dengan AI. Silakan coba lagi beberapa saat.',
      });
    }
  });

  // --- FITUR BARU 1: BUAT PROFIL DATABASE DENGAN AI (PENGELOMPOKAN DARI DATABASE YANG SUDAH ADA) ---
  app.post('/api/ai/group-profile', async (req, res) => {
    try {
      const { profileName = '', criteria = '', sourceProfileFilter = 'all' } = req.body || {};
      const cleanCriteria = String(criteria || '').trim();
      const suggestedName = String(profileName || '').trim();
      if (!cleanCriteria) {
        res.status(400).json({ error: 'Masukkan kriteria pengelompokan profil terlebih dahulu.' });
        return;
      }

      const candidatePool =
        sourceProfileFilter && sourceProfileFilter !== 'all'
          ? store.hadiths.filter((h) => (h.profileName || 'Belum Terkategori') === sourceProfileFilter)
          : store.hadiths;

      if (candidatePool.length === 0) {
        res.status(400).json({ error: 'Database materi saat ini masih kosong.' });
        return;
      }

      const compactCatalog = candidatePool.map((h) => ({
        id: h.id,
        type: h.type,
        title: h.title,
        source: `${h.sourceBook} (${h.sourceBookName || h.sourceBook}) No. ${h.hadithNumber}`,
        topic: h.categoryTopic,
        summary: (h.shortSummary || h.translationText || '').slice(0, 180),
        currentProfile: h.profileName || 'Belum Terkategori',
      }));

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `Anda adalah kurator database Hadis & Al-Quran BDI Daily.
Pengguna ingin membuat/mengisi Profil Database dengan nama: "${suggestedName || 'Profil Tematik Baru'}"
Berdasarkan kriteria pengelompokan berikut: "${cleanCriteria}"

Berikut adalah daftar seluruh materi yang tersedia di database saat ini (${compactCatalog.length} item):
${JSON.stringify(compactCatalog, null, 2)}

TUGAS ANDA:
1. Pilih seluruh item dari daftar di atas yang cocok/relevan dengan kriteria "${cleanCriteria}".
2. Urutkan item yang terpilih dalam urutan penyampaian kajian yang paling sistematis dan baik.
3. Berikan alasan singkat (1 kalimat) mengapa masing-masing item cocok dimasukkan ke profil ini.
4. Jika nama profil belum ditentukan pengguna, rekomendasikan nama profil yang singkat dan jelas pada field recommendedProfileName.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendedProfileName: { type: Type.STRING },
              groupingSummary: { type: Type.STRING },
              matches: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    recommendedOrder: { type: Type.NUMBER },
                  },
                  required: ['id', 'reason', 'recommendedOrder'],
                },
              },
            },
            required: ['recommendedProfileName', 'groupingSummary', 'matches'],
          },
        },
      });

      const rawJson = (response.text || '{}')
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const parsed = JSON.parse(rawJson || '{}');
      const matchesList = Array.isArray(parsed.matches) ? parsed.matches : [];
      const validIds = new Set(candidatePool.map((h) => h.id));
      const filteredMatches = matchesList.filter((m: any) => m && validIds.has(m.id));

      res.json({
        ok: true,
        recommendedProfileName: suggestedName || parsed.recommendedProfileName || 'Profil Pilihan AI',
        groupingSummary:
          parsed.groupingSummary ||
          `Ditemukan ${filteredMatches.length} materi yang sesuai dengan kriteria "${cleanCriteria}".`,
        matches: filteredMatches,
      });
    } catch (error: any) {
      console.error('AI group-profile error:', error);
      res.status(500).json({
        error: error?.message || 'Gagal mengelompokkan database dengan AI.',
      });
    }
  });

  app.post('/api/profiles/apply-grouping', (req, res) => {
    const {
      targetProfileName = '',
      hadithIds = [],
      actionMode = 'move', // 'move' = pindahkan ke profil baru, 'copy' = duplikat salinan ke profil baru
    } = req.body || {};

    const cleanProfile = String(targetProfileName || '').trim();
    if (!cleanProfile) {
      res.status(400).json({ error: 'Nama profil tujuan wajib diisi.' });
      return;
    }
    if (!Array.isArray(hadithIds) || hadithIds.length === 0) {
      res.status(400).json({ error: 'Pilih minimal 1 hadis untuk dimasukkan ke profil.' });
      return;
    }

    if (!store.profiles.includes(cleanProfile)) {
      store.profiles.push(cleanProfile);
    }

    const idOrderMap = new Map<string, number>();
    hadithIds.forEach((id: string, idx: number) => idOrderMap.set(String(id), idx + 1));

    if (actionMode === 'copy') {
      const toCopy = store.hadiths.filter((h) => idOrderMap.has(h.id));
      const copies: HadithItem[] = toCopy.map((h, idx) => ({
        ...h,
        id: `hd-${Date.now()}-copy-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        profileName: cleanProfile,
        sequenceOrder: (idOrderMap.get(h.id) || idx + 1),
        isSent: false,
        createdAt: new Date().toISOString(),
      }));
      store.hadiths = [...store.hadiths, ...copies];
    } else {
      store.hadiths = store.hadiths.map((h) => {
        if (idOrderMap.has(h.id)) {
          return {
            ...h,
            profileName: cleanProfile,
            sequenceOrder: idOrderMap.get(h.id) || h.sequenceOrder,
          };
        }
        return h;
      });
    }

    saveStore(store);
    res.json({
      ok: true,
      profiles: store.profiles,
      hadiths: store.hadiths,
      generationHistory: store.generationHistory,
    });
  });

  // --- FITUR BARU 2: EDIT PROFIL DATABASE DENGAN AI (RAPIHKAN HADIS & REKOMENDASI TAMBAHAN) ---
  app.post('/api/ai/profile-assistant', async (req, res) => {
    try {
      const {
        profileName = '',
        mode = 'tidy', // 'tidy' = rapihkan hadis & urutan dalam profil, 'recommend' = rekomendasikan tambahan hadis untuk profil
        instruction = '',
        recommendCount = 3,
      } = req.body || {};

      const cleanProfile = String(profileName || '').trim();
      if (!cleanProfile || cleanProfile === 'all') {
        res.status(400).json({ error: 'Pilih satu profil database terlebih dahulu.' });
        return;
      }

      const profileItems = store.hadiths.filter(
        (h) => (h.profileName || 'Belum Terkategori') === cleanProfile
      );

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      if (mode === 'tidy') {
        if (profileItems.length === 0) {
          res.status(400).json({
            error: `Profil "${cleanProfile}" masih kosong. Silakan tambahkan atau minta rekomendasi hadis terlebih dahulu.`,
          });
          return;
        }

        const itemsToTidy = profileItems.slice(0, 15).map((h) => ({
          id: h.id,
          type: h.type,
          title: h.title,
          sourceBook: h.sourceBook,
          sourceBookName: h.sourceBookName || h.sourceBook,
          hadithNumber: h.hadithNumber,
          hadithDegree: h.hadithDegree || 'Shahih',
          shortSummary: h.shortSummary,
          lessonText: h.lessonText,
          categoryTopic: h.categoryTopic,
          sequenceOrder: h.sequenceOrder,
        }));

        const prompt = `Anda adalah editor ahli Lajnah Hadis & Al-Quran untuk Profil Database "${cleanProfile}".
Instruksi tambahan dari pengguna: "${instruction || 'Rapihkan judul, penyeragaman topik, kelengkapan nama kitab sumber, derajat hadis, ringkasan singkat, hikmah, dan susun urutan penyampaian terbaik.'}"

Berikut adalah daftar materi di dalam profil "${cleanProfile}":
${JSON.stringify(itemsToTidy, null, 2)}

TUGAS ANDA:
1. Rapihkan setiap item agar memiliki judul (title) yang rapi dan menarik, sourceBookName (nama kitab & bab yang jelas), hadithDegree (derajat hadis ilmiah yang jelas), shortSummary (ringkasan 1-2 kalimat padat), lessonText (hikmah aplikatif yang jelas), serta categoryTopic yang seragam.
2. Tetapkan sequenceOrder (1, 2, 3...) sesuai urutan kurikulum kajian paling sistematis.
3. JANGAN mengubah makna terjemahan asli hadis/ayat. Pertahankan id masing-masing item dengan tepat.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summaryNote: { type: Type.STRING },
                tidiedItems: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      title: { type: Type.STRING },
                      sourceBook: { type: Type.STRING },
                      sourceBookName: { type: Type.STRING },
                      hadithNumber: { type: Type.STRING },
                      hadithDegree: { type: Type.STRING },
                      shortSummary: { type: Type.STRING },
                      lessonText: { type: Type.STRING },
                      categoryTopic: { type: Type.STRING },
                      sequenceOrder: { type: Type.NUMBER },
                      changeNote: { type: Type.STRING },
                    },
                    required: [
                      'id',
                      'title',
                      'sourceBook',
                      'sourceBookName',
                      'hadithNumber',
                      'hadithDegree',
                      'shortSummary',
                      'lessonText',
                      'categoryTopic',
                      'sequenceOrder',
                      'changeNote',
                    ],
                  },
                },
              },
              required: ['summaryNote', 'tidiedItems'],
            },
          },
        });

        const rawJson = (response.text || '{}')
          .replace(/^```json\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();
        const parsed = JSON.parse(rawJson || '{}');
        res.json({
          ok: true,
          mode: 'tidy',
          summaryNote:
            parsed.summaryNote ||
            `Berhasil merapihkan ${parsed.tidiedItems?.length || 0} materi pada profil "${cleanProfile}".`,
          tidiedItems: Array.isArray(parsed.tidiedItems) ? parsed.tidiedItems : [],
        });
        return;
      }

      // Mode === 'recommend': Recommend new complementary hadiths for this profile
      const safeRecCount = Math.min(8, Math.max(1, Number(recommendCount) || 3));
      const existingTopics = profileItems
        .map((h) => `${h.sourceBook} No. ${h.hadithNumber}: ${h.title} (${h.categoryTopic})`)
        .join('; ');
      const syncedLog = syncGenerationHistory(store.hadiths, store.generationHistory || []);
      const allKnownRefs = syncedLog
        .slice(-100)
        .map((g) => `${g.sourceBook} No. ${g.hadithNumber} ("${g.title}")`)
        .join('; ');

      const prompt = `Anda adalah kurator Lajnah Hadis & Al-Quran untuk Profil Database bernama "${cleanProfile}".
Daftar materi yang saat ini sudah ada di profil "${cleanProfile}" (${profileItems.length} materi):
${existingTopics || '(Profil masih kosong, gunakan nama profil dan instruksi sebagai acuan utama)'}

Instruksi / fokus tambahan dari pengguna: "${instruction || `Rekomendasikan hadis shahih pelengkap yang sangat relevan dengan tema profil "${cleanProfile}"`}"

ATURAN PENTING:
1. Rekomendasikan ${safeRecCount} Hadis Shahih baru yang melengkapi/memperkaya profil "${cleanProfile}".
2. DILARANG mengulang hadis yang sudah ada di database/log berikut: ${allKnownRefs || 'tidak ada'}.
3. Wajib menggunakan teks Arab valid, terjemahan resmi dari Ensiklopedi Hadits 9 Imam / Kutubut Tis'ah (bukan terjemahan bebas AI), nomor hadis asli dari kitab sumber (hadithNumber), nama kitab sumber beserta babnya (sourceBookName), dan derajat hadis (hadithDegree).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryNote: { type: Type.STRING },
              recommendedItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    sourceBook: { type: Type.STRING },
                    sourceBookName: { type: Type.STRING },
                    hadithNumber: { type: Type.STRING },
                    hadithDegree: { type: Type.STRING },
                    hadithLength: { type: Type.STRING },
                    arabicText: { type: Type.STRING },
                    translationText: { type: Type.STRING },
                    asbabulWurud: { type: Type.STRING },
                    shortSummary: { type: Type.STRING },
                    lessonText: { type: Type.STRING },
                    categoryTopic: { type: Type.STRING },
                    recommendationReason: { type: Type.STRING },
                  },
                  required: [
                    'title',
                    'sourceBook',
                    'sourceBookName',
                    'hadithNumber',
                    'hadithDegree',
                    'hadithLength',
                    'arabicText',
                    'translationText',
                    'asbabulWurud',
                    'shortSummary',
                    'lessonText',
                    'categoryTopic',
                    'recommendationReason',
                  ],
                },
              },
            },
            required: ['summaryNote', 'recommendedItems'],
          },
        },
      });

      const rawJson = (response.text || '{}')
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const parsed = JSON.parse(rawJson || '{}');
      const rawRecs = Array.isArray(parsed.recommendedItems) ? parsed.recommendedItems : [];

      const recommendedItems: (HadithItem & { recommendationReason?: string })[] = rawRecs.map(
        (item: any, idx: number) => ({
          id: `rec-${Date.now()}-${idx}`,
          type: 'hadis',
          profileName: cleanProfile,
          sourceBook: item.sourceBook || 'HR. Bukhari',
          sourceBookName: item.sourceBookName || 'Shahih Al-Bukhari',
          hadithNumber: String(item.hadithNumber || idx + 1),
          hadithDegree: item.hadithDegree || 'Shahih',
          hadithLength:
            item.hadithLength === 'sedang' || item.hadithLength === 'panjang'
              ? item.hadithLength
              : 'singkat',
          title: item.title || 'Rekomendasi Hadis Shahih',
          arabicText: item.arabicText || '',
          translationText: item.translationText || '',
          asbabulWurud:
            item.asbabulWurud ||
            'Tidak terdapat riwayat asbabul wurud khusus untuk hadis ini; hadis ini merupakan sabda tuntunan umum Rasulullah ﷺ.',
          shortSummary: item.shortSummary || item.translationText || '',
          lessonText: item.lessonText || '',
          categoryTopic: item.categoryTopic || cleanProfile,
          sequenceOrder: store.hadiths.length + idx + 1,
          isSent: false,
          createdAt: new Date().toISOString(),
          recommendationReason:
            item.recommendationReason || `Melengkapi tema kajian pada profil ${cleanProfile}.`,
        })
      );

      res.json({
        ok: true,
        mode: 'recommend',
        summaryNote:
          parsed.summaryNote ||
          `AI merekomendasikan ${recommendedItems.length} hadis shahih tambahan untuk profil "${cleanProfile}".`,
        recommendedItems,
      });
    } catch (error: any) {
      console.error('AI profile-assistant error:', error);
      res.status(500).json({
        error: error?.message || 'Gagal menjalankan asisten AI untuk profil ini.',
      });
    }
  });

  app.post('/api/profiles/apply-tidy', (req, res) => {
    const { profileName = '', tidiedItems = [] } = req.body || {};
    if (!Array.isArray(tidiedItems) || tidiedItems.length === 0) {
      res.status(400).json({ error: 'Tidak ada perubahan untuk diterapkan.' });
      return;
    }
    const updateMap = new Map<string, any>();
    for (const t of tidiedItems) {
      if (t && t.id) updateMap.set(String(t.id), t);
    }

    store.hadiths = store.hadiths.map((h) => {
      const upd = updateMap.get(h.id);
      if (!upd) return h;
      return {
        ...h,
        title: upd.title || h.title,
        sourceBook: upd.sourceBook || h.sourceBook,
        sourceBookName: upd.sourceBookName || h.sourceBookName,
        hadithNumber: String(upd.hadithNumber || h.hadithNumber),
        hadithDegree: upd.hadithDegree || h.hadithDegree,
        shortSummary: upd.shortSummary || h.shortSummary,
        lessonText: upd.lessonText || h.lessonText,
        categoryTopic: upd.categoryTopic || h.categoryTopic,
        sequenceOrder: Number(upd.sequenceOrder) || h.sequenceOrder,
      };
    });

    // Sort hadiths within this profile by sequenceOrder
    if (profileName) {
      store.hadiths.sort((a, b) => {
        if (a.profileName === profileName && b.profileName === profileName) {
          return (a.sequenceOrder || 0) - (b.sequenceOrder || 0);
        }
        return 0;
      });
    }

    saveStore(store);
    res.json({
      ok: true,
      hadiths: store.hadiths,
      profiles: store.profiles,
      generationHistory: store.generationHistory,
    });
  });

  // --- TEMPLATES CRUD ---
  app.post('/api/templates', (req, res) => {
    const { id, name, category, content, isDefault } = req.body || {};
    if (!name || !content) {
      res.status(400).json({ error: 'Nama dan isi format wajib diisi.' });
      return;
    }
    const targetCategory = category || 'lengkap';
    if (isDefault) {
      store.templates.forEach((t) => {
        if (t.category === targetCategory) t.isDefault = false;
      });
    }
    const existingIdx = store.templates.findIndex((t) => t.id === id);
    if (existingIdx >= 0) {
      store.templates[existingIdx] = {
        ...store.templates[existingIdx],
        name,
        category: targetCategory,
        content,
        isDefault: Boolean(isDefault),
      };
    } else {
      store.templates.push({
        id: `tpl-${Date.now()}`,
        name,
        category: targetCategory,
        content,
        isDefault: Boolean(isDefault),
      });
    }
    saveStore(store);
    res.json({ ok: true, templates: store.templates });
  });

  app.delete('/api/templates/:id', (req, res) => {
    store.templates = store.templates.filter((t) => t.id !== req.params.id);
    saveStore(store);
    res.json({ ok: true, templates: store.templates });
  });

  // --- TEMPLATE VARIABLES CRUD (ADD, EDIT, DELETE) ---
  app.post('/api/template-variables', (req, res) => {
    const { id, key, label, defaultValue } = req.body || {};
    const rawKey = String(key || '').trim();
    const rawLabel = String(label || '').trim();
    if (!rawKey || !rawLabel) {
      res.status(400).json({ error: 'Kode variabel dan label nama variabel wajib diisi.' });
      return;
    }
    const cleanSlug = rawKey
      .replace(/^\{+|\}+$/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    if (!cleanSlug) {
      res.status(400).json({ error: 'Kode variabel hanya boleh berisi huruf, angka, atau garis bawah.' });
      return;
    }
    const formattedKey = `{${cleanSlug}}`;

    if (!Array.isArray(store.templateVariables) || store.templateVariables.length === 0) {
      store.templateVariables = [...DEFAULT_TEMPLATE_VARIABLES];
    }

    const systemKeys = new Set([
      '{judul}',
      '{arab}',
      '{terjemah}',
      '{asbabul_wurud}',
      '{ringkasan}',
      '{perawi}',
      '{kitab}',
      '{nomor_hadis}',
      '{derajat_hadis}',
      '{hikmah}',
      '{profil}',
      '{nama_kontak}',
      '{tanggal}',
    ]);

    const existingIdx = store.templateVariables.findIndex(
      (v) => v.id === id || v.key === formattedKey
    );

    const varItem: TemplateVariableItem = {
      id: existingIdx >= 0 ? store.templateVariables[existingIdx].id : id || `var-${Date.now()}`,
      key: formattedKey,
      label: rawLabel,
      defaultValue: String(defaultValue || ''),
      isSystem: systemKeys.has(formattedKey),
    };

    if (existingIdx >= 0) {
      store.templateVariables[existingIdx] = varItem;
    } else {
      store.templateVariables.push(varItem);
    }

    saveStore(store);
    res.json({ ok: true, templateVariables: store.templateVariables });
  });

  app.delete('/api/template-variables/:id', (req, res) => {
    if (!Array.isArray(store.templateVariables)) {
      store.templateVariables = [...DEFAULT_TEMPLATE_VARIABLES];
    }
    store.templateVariables = store.templateVariables.filter((v) => v.id !== req.params.id);
    saveStore(store);
    res.json({ ok: true, templateVariables: store.templateVariables });
  });

  app.post('/api/template-variables/reset', (_req, res) => {
    store.templateVariables = [...DEFAULT_TEMPLATE_VARIABLES];
    saveStore(store);
    res.json({ ok: true, templateVariables: store.templateVariables });
  });

  // --- CONTACTS CRUD, CONTACT GROUPS & BULK MULTI-SELECT ACTIONS ---
  app.post('/api/contacts', (req, res) => {
    const { id, name, phone, preference, groupTag, isActive, notes } = req.body || {};
    const cleanPhone = normalizePhone(phone);
    if (!name || !cleanPhone) {
      res.status(400).json({ error: 'Nama dan nomor WhatsApp wajib diisi.' });
      return;
    }
    const normalizedGroup = String(groupTag || 'Jamaah Umum').trim() || 'Jamaah Umum';
    const existingIdx = store.contacts.findIndex((c) => c.id === id);
    const contactObj: ContactItem = {
      id: id || `ct-${Date.now()}`,
      name: String(name).trim(),
      phone: cleanPhone,
      preference: preference === 'singkat' ? 'singkat' : 'detail',
      groupTag: normalizedGroup,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      notes: String(notes || '').trim(),
    };
    if (existingIdx >= 0) {
      store.contacts[existingIdx] = contactObj;
    } else {
      store.contacts.push(contactObj);
    }
    store.contactGroups = syncContactGroups(store.contacts, store.contactGroups || []);
    saveStore(store);
    res.json({ ok: true, contacts: store.contacts, contactGroups: store.contactGroups });
  });

  app.post('/api/contacts/bulk', (req, res) => {
    const items: any[] = req.body?.contacts || [];
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Daftar kontak kosong.' });
      return;
    }
    const added: ContactItem[] = items
      .map((c, idx) => ({
        id: `ct-${Date.now()}-${idx}`,
        name: String(c.name || `Jamaah ${idx + 1}`).trim(),
        phone: normalizePhone(String(c.phone || '')),
        preference: (c.preference === 'singkat' ? 'singkat' : 'detail') as 'singkat' | 'detail',
        groupTag: String(c.groupTag || 'Impor Massal').trim() || 'Impor Massal',
        isActive: true,
        notes: String(c.notes || '').trim(),
      }))
      .filter((c) => c.phone.length >= 9);

    store.contacts = [...store.contacts, ...added];
    store.contactGroups = syncContactGroups(store.contacts, store.contactGroups || []);
    saveStore(store);
    res.json({
      ok: true,
      contacts: store.contacts,
      contactGroups: store.contactGroups,
      addedCount: added.length,
    });
  });

  // Bulk Actions on Multi-Selected Contacts (Move to Group, Change Preference, Delete, Toggle Active)
  app.post('/api/contacts/bulk-action', (req, res) => {
    const {
      contactIds = [],
      action,
      targetGroup,
      targetPreference,
      targetActive,
    } = req.body || {};

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      res.status(400).json({ error: 'Pilih minimal 1 kontak jamaah terlebih dahulu.' });
      return;
    }
    const idSet = new Set(contactIds.map((id: any) => String(id)));

    if (action === 'move_group') {
      const grp = String(targetGroup || '').trim();
      if (!grp) {
        res.status(400).json({ error: 'Nama grup tujuan tidak boleh kosong.' });
        return;
      }
      store.contacts = store.contacts.map((c) =>
        idSet.has(c.id) ? { ...c, groupTag: grp } : c
      );
      if (!store.contactGroups) store.contactGroups = [];
      if (!store.contactGroups.includes(grp)) {
        store.contactGroups.push(grp);
      }
    } else if (action === 'change_preference') {
      const pref: 'singkat' | 'detail' = targetPreference === 'singkat' ? 'singkat' : 'detail';
      store.contacts = store.contacts.map((c) =>
        idSet.has(c.id) ? { ...c, preference: pref } : c
      );
    } else if (action === 'toggle_active') {
      const nextActive = targetActive !== undefined ? Boolean(targetActive) : true;
      store.contacts = store.contacts.map((c) =>
        idSet.has(c.id) ? { ...c, isActive: nextActive } : c
      );
    } else if (action === 'delete') {
      store.contacts = store.contacts.filter((c) => !idSet.has(c.id));
    } else {
      res.status(400).json({ error: 'Aksi massal kontak tidak dikenali.' });
      return;
    }

    store.contactGroups = syncContactGroups(store.contacts, store.contactGroups || []);
    saveStore(store);
    res.json({
      ok: true,
      contacts: store.contacts,
      contactGroups: store.contactGroups,
    });
  });

  // Contact Groups Management (Add Group, Rename Group, Delete Group)
  app.post('/api/contact-groups', (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'Nama grup kontak tidak boleh kosong.' });
      return;
    }
    const current = syncContactGroups(store.contacts, store.contactGroups || []);
    if (!current.includes(name)) {
      current.push(name);
    }
    store.contactGroups = current;
    saveStore(store);
    res.json({ ok: true, contactGroups: store.contactGroups });
  });

  app.put('/api/contact-groups/rename', (req, res) => {
    const oldName = String(req.body?.oldName || '').trim();
    const newName = String(req.body?.newName || '').trim();
    if (!oldName || !newName) {
      res.status(400).json({ error: 'Nama grup lama dan baru wajib diisi.' });
      return;
    }
    store.contacts = store.contacts.map((c) =>
      (c.groupTag || 'Jamaah Umum').trim() === oldName ? { ...c, groupTag: newName } : c
    );
    store.contactGroups = (store.contactGroups || []).map((g) => (g === oldName ? newName : g));
    if (!store.contactGroups.includes(newName)) {
      store.contactGroups.push(newName);
    }
    store.projects.forEach((p) => {
      if (Array.isArray(p.targetGroups)) {
        p.targetGroups = p.targetGroups.map((g) => (g === oldName ? newName : g));
      }
    });
    store.contactGroups = syncContactGroups(store.contacts, store.contactGroups);
    saveStore(store);
    res.json({
      ok: true,
      contacts: store.contacts,
      contactGroups: store.contactGroups,
      projects: store.projects,
    });
  });

  app.delete('/api/contact-groups/:name', (req, res) => {
    const targetName = decodeURIComponent(req.params.name || '').trim();
    if (!targetName || targetName === 'Jamaah Umum') {
      res.status(400).json({ error: 'Grup "Jamaah Umum" adalah grup dasar dan tidak dapat dihapus.' });
      return;
    }
    const fallbackGroup = String(req.body?.fallbackGroup || 'Jamaah Umum').trim() || 'Jamaah Umum';
    const deleteContacts = Boolean(req.body?.deleteContacts);
    if (deleteContacts) {
      store.contacts = store.contacts.filter(
        (c) => (c.groupTag || 'Jamaah Umum').trim() !== targetName
      );
    } else {
      store.contacts = store.contacts.map((c) =>
        (c.groupTag || 'Jamaah Umum').trim() === targetName
          ? { ...c, groupTag: fallbackGroup }
          : c
      );
    }
    store.contactGroups = (store.contactGroups || []).filter((g) => g !== targetName);
    store.contactGroups = syncContactGroups(store.contacts, store.contactGroups);
    saveStore(store);
    res.json({
      ok: true,
      contacts: store.contacts,
      contactGroups: store.contactGroups,
    });
  });

  app.delete('/api/contacts/:id', (req, res) => {
    store.contacts = store.contacts.filter((c) => c.id !== req.params.id);
    saveStore(store);
    res.json({ ok: true, contacts: store.contacts, contactGroups: store.contactGroups });
  });

  // --- BDI PROJEK MULTI-PROJECT SCHEDULER CRUD & ACTIONS ---
  app.post('/api/projects', (req, res) => {
    const body = req.body || {};
    const name = String(body.name || 'BDI Projek Baru').trim();
    const minDelay = Math.max(3, Number(body.minDelaySeconds) || 12);
    const maxDelay = Math.max(minDelay, Number(body.maxDelaySeconds) || 35);
    const selectedProfiles =
      Array.isArray(body.selectedProfiles) && body.selectedProfiles.length > 0
        ? body.selectedProfiles
        : [store.profiles[0] || 'Belum Terkategori'];

    const scheduleFrequency: 'daily' | 'weekly' | 'custom_days' =
      body.scheduleFrequency === 'weekly' || body.scheduleFrequency === 'custom_days'
        ? body.scheduleFrequency
        : 'daily';
    const scheduleDays: number[] =
      scheduleFrequency === 'daily'
        ? [0, 1, 2, 3, 4, 5, 6]
        : Array.isArray(body.scheduleDays) && body.scheduleDays.length > 0
        ? body.scheduleDays.map((n: any) => Number(n)).filter((n: number) => n >= 0 && n <= 6)
        : [5]; // default Jumat if empty

    const targetMode: 'all' | 'groups' | 'contacts' =
      body.targetMode === 'groups' || body.targetMode === 'contacts' ? body.targetMode : 'all';
    const targetGroups: string[] = Array.isArray(body.targetGroups)
      ? body.targetGroups.map((g: any) => String(g).trim()).filter(Boolean)
      : [];
    const targetContactIds: string[] = Array.isArray(body.targetContactIds)
      ? body.targetContactIds.map((id: any) => String(id).trim()).filter(Boolean)
      : [];

    const templateMode: 'auto_contact' | 'single_template' =
      body.templateMode === 'single_template' ? 'single_template' : 'auto_contact';
    const templateId = body.templateId ? String(body.templateId) : undefined;
    const detailTemplateId = body.detailTemplateId ? String(body.detailTemplateId) : undefined;
    const singkatTemplateId = body.singkatTemplateId ? String(body.singkatTemplateId) : undefined;

    const existingIdx = store.projects.findIndex((p) => p.id === body.id);
    if (existingIdx >= 0) {
      store.projects[existingIdx] = {
        ...store.projects[existingIdx],
        ...body,
        name,
        timezone: body.timezone || store.projects[existingIdx].timezone || 'WITA',
        scheduleFrequency,
        scheduleDays,
        targetMode,
        targetGroups,
        targetContactIds,
        templateMode,
        templateId,
        detailTemplateId,
        singkatTemplateId,
        minDelaySeconds: minDelay,
        maxDelaySeconds: maxDelay,
        selectedProfiles,
      };
    } else {
      const newProj: BdiProject = {
        id: `proj-${Date.now()}`,
        name,
        status: body.status || 'running',
        sendTime: body.sendTime || '06:00',
        timezone: body.timezone || 'WITA',
        scheduleFrequency,
        scheduleDays,
        targetMode,
        targetGroups,
        targetContactIds,
        templateMode,
        templateId,
        detailTemplateId,
        singkatTemplateId,
        durationMode: body.durationMode || 'database_count',
        durationValue: Number(body.durationValue) || 1,
        startDate: body.startDate || new Date().toISOString().slice(0, 10),
        currentDatabaseIndex: 0,
        selectedProfiles,
        selectionOrder: body.selectionOrder === 'random' ? 'random' : 'sequential',
        minDelaySeconds: minDelay,
        maxDelaySeconds: maxDelay,
        repeatWhenExhausted: body.repeatWhenExhausted !== false,
        lastTriggeredDate: '',
        totalSentCount: 0,
        createdAt: new Date().toISOString(),
      };
      store.projects.unshift(newProj);
    }
    saveStore(store);
    res.json({ ok: true, projects: store.projects });
  });

  // Pause / Resume / Stop / Run Now for a BDI Projek
  app.post('/api/projects/:id/action', (req, res) => {
    const { id } = req.params;
    const { action } = req.body || {}; // 'pause' | 'resume' | 'stop' | 'run_now'
    const proj = store.projects.find((p) => p.id === id);
    if (!proj) {
      res.status(404).json({ error: 'Projek BDI tidak ditemukan.' });
      return;
    }

    const nowMs = Date.now();
    const nowIso = new Date().toISOString();

    if (action === 'pause') {
      proj.status = 'paused';
      if (proj.activeRun) {
        proj.activeRun.status = 'paused';
      }
      // Also freeze any queued or in-flight messages belonging to this project
      let pausedQueueCount = 0;
      store.deliveryLogs.forEach((l) => {
        if (
          (l.projectId === proj.id || (proj.activeRun?.batchId && l.batchId === proj.activeRun.batchId)) &&
          (l.status === 'queued' || l.status === 'sending')
        ) {
          l.status = 'paused';
          l.remainingMsWhenPaused = Math.max(2000, (l.scheduledAtMs || nowMs) - nowMs);
          pausedQueueCount++;
        }
      });
      saveStore(store);
      store.projectHistory.unshift({
        id: `hist-${nowMs}`,
        projectId: proj.id,
        projectName: proj.name,
        hadithId: '-',
        hadithTitle: 'Projek Dijeda (Paused)',
        profileName: proj.selectedProfiles.join(', '),
        triggeredAt: nowIso,
        triggerType: 'pause',
        contactCount: pausedQueueCount,
        notes: `Projek dijeda sementara. ${pausedQueueCount} antrean pesan dibekukan total.`,
      });
    } else if (action === 'resume') {
      if (proj.status !== 'paused') {
        res.status(400).json({
          error:
            'Tombol Resume hanya dapat digunakan untuk projek yang sedang dijeda (paused). Untuk projek yang di-stop, silakan gunakan tombol "Mulai dari Hadis No. X".',
        });
        return;
      }
      proj.status = 'running';
      if (proj.activeRun) {
        proj.activeRun.status = 'running';
      }
      let resumedQueueCount = 0;
      let nextOffsetMs = 2000;
      store.deliveryLogs.forEach((l) => {
        if (
          (l.projectId === proj.id || (proj.activeRun?.batchId && l.batchId === proj.activeRun.batchId)) &&
          l.status === 'paused'
        ) {
          l.status = 'queued';
          const remaining = l.remainingMsWhenPaused || 5000;
          l.scheduledAtMs = nowMs + nextOffsetMs + (remaining > 0 ? remaining : 3000);
          nextOffsetMs += getRandomInt(proj.minDelaySeconds || 5, proj.maxDelaySeconds || 15) * 1000;
          delete l.remainingMsWhenPaused;
          resumedQueueCount++;
        }
      });
      saveStore(store);
      store.projectHistory.unshift({
        id: `hist-${nowMs}`,
        projectId: proj.id,
        projectName: proj.name,
        hadithId: '-',
        hadithTitle: 'Projek Dilanjutkan (Resumed)',
        profileName: proj.selectedProfiles.join(', '),
        triggeredAt: nowIso,
        triggerType: 'resume',
        contactCount: resumedQueueCount,
        notes: `Projek dilanjutkan dari status jeda. ${resumedQueueCount} antrean dilanjutkan dengan jeda acak.`,
      });
    } else if (action === 'stop') {
      proj.status = 'stopped';
      delete proj.activeRun; // Hapus activeRun total agar tidak ada sisa batch atau sisa kontak lama
      proj.lastTriggeredDate = ''; // Reset proteksi tanggal agar bebas dimulai lagi kapan pun
      // Pertahankan proj.currentDatabaseIndex agar hadis pilihan pengguna tidak di-reset ke 0
      let stoppedQueueCount = 0;
      // Batalkan dan bersihkan seluruh antrean yang sedang berjalan untuk projek ini
      store.deliveryLogs = store.deliveryLogs.filter((l) => {
        if (
          l.projectId === proj.id &&
          (l.status === 'queued' || l.status === 'paused' || l.status === 'sending')
        ) {
          stoppedQueueCount++;
          return false; // Hapus dari antrean agar tidak terkirim lagi
        }
        return true;
      });
      saveStore(store);
      store.projectHistory.unshift({
        id: `hist-${nowMs}`,
        projectId: proj.id,
        projectName: proj.name,
        hadithId: '-',
        hadithTitle: 'Projek Dihentikan (Stopped)',
        profileName: proj.selectedProfiles.join(', '),
        triggeredAt: nowIso,
        triggerType: 'stop',
        contactCount: stoppedQueueCount,
        notes: `Projek dihentikan total. ${stoppedQueueCount} antrean pesan dibatalkan dan dibersihkan dari antrean. Siap mulai lagi dari hadis pilihan.`,
      });
    } else if (action === 'next_hadith') {
      const pool = getCandidateHadithsForProject(proj);
      if (pool.length > 0) {
        const nextIdx = ((proj.currentDatabaseIndex || 0) + 1) % pool.length;
        proj.currentDatabaseIndex = nextIdx;
        delete proj.activeRun;
        saveStore(store);
      }
      const chosen = pool[proj.currentDatabaseIndex || 0];
      res.json({
        ok: true,
        message: `Materi selanjutnya dipilih: Hadis No. ${(proj.currentDatabaseIndex || 0) + 1} (${chosen?.title || ''})`,
        projects: store.projects,
        projectHistory: store.projectHistory,
        deliveryLogs: store.deliveryLogs,
      });
      return;
    } else if (action === 'prev_hadith') {
      const pool = getCandidateHadithsForProject(proj);
      if (pool.length > 0) {
        const prevIdx = ((proj.currentDatabaseIndex || 0) - 1 + pool.length) % pool.length;
        proj.currentDatabaseIndex = prevIdx;
        delete proj.activeRun;
        saveStore(store);
      }
      const chosen = pool[proj.currentDatabaseIndex || 0];
      res.json({
        ok: true,
        message: `Materi sebelumnya dipilih: Hadis No. ${(proj.currentDatabaseIndex || 0) + 1} (${chosen?.title || ''})`,
        projects: store.projects,
        projectHistory: store.projectHistory,
        deliveryLogs: store.deliveryLogs,
      });
      return;
    } else if (action === 'set_hadith') {
      const pool = getCandidateHadithsForProject(proj);
      const targetHadithId = req.body?.hadithId;
      const targetIndex = Number(req.body?.targetIndex);
      if (pool.length > 0) {
        if (targetHadithId) {
          const foundIdx = pool.findIndex((h) => h.id === targetHadithId);
          if (foundIdx !== -1) {
            proj.currentDatabaseIndex = foundIdx;
          }
        } else if (!isNaN(targetIndex) && targetIndex >= 0 && targetIndex < pool.length) {
          proj.currentDatabaseIndex = targetIndex;
        }
        delete proj.activeRun;
        saveStore(store);
      }
      const chosen = pool[proj.currentDatabaseIndex || 0];
      res.json({
        ok: true,
        message: `Materi hadis disetel ke No. ${(proj.currentDatabaseIndex || 0) + 1} (${chosen?.title || ''})`,
        projects: store.projects,
        projectHistory: store.projectHistory,
        deliveryLogs: store.deliveryLogs,
      });
      return;
    } else if (action === 'start' || action === 'run_now') {
      const targetContacts = getCandidateContactsForProject(proj);
      if (targetContacts.length === 0) {
        res.status(400).json({ error: 'Tidak ada kontak penerima aktif untuk target projek ini.' });
        return;
      }
      const tz: 'WIB' | 'WITA' | 'WIT' = proj.timezone || 'WITA';
      const { dateStr: todayStr } = getIndonesiaZoneTime(tz);

      const pool = getCandidateHadithsForProject(proj);
      if (pool.length === 0) {
        res.status(400).json({ error: 'Database hadis untuk projek ini kosong.' });
        return;
      }

      // Jika user memilih hadithId atau targetIndex tertentu, set ke projek
      const explicitHadithId = req.body?.hadithId;
      const targetIndex = Number(req.body?.targetIndex);
      if (explicitHadithId) {
        const foundIdx = pool.findIndex((h) => h.id === explicitHadithId);
        if (foundIdx !== -1) {
          proj.currentDatabaseIndex = foundIdx;
        }
      } else if (!isNaN(targetIndex) && targetIndex >= 0 && targetIndex < pool.length) {
        proj.currentDatabaseIndex = targetIndex;
      }

      const activeIdx = Math.min(pool.length - 1, Math.max(0, proj.currentDatabaseIndex || 0));
      const chosenHadith = pool[activeIdx];
      if (!chosenHadith) {
        res.status(400).json({ error: 'Hadis pilihan tidak ditemukan.' });
        return;
      }

      // Mulai fresh: hapus activeRun lama, bersihkan sisa antrean lama projek ini
      delete proj.activeRun;
      store.deliveryLogs = store.deliveryLogs.filter(
        (l) => !(l.projectId === proj.id && (l.status === 'queued' || l.status === 'paused' || l.status === 'sending'))
      );

      proj.status = 'running';
      chosenHadith.isSent = true;
      proj.lastTriggeredDate = todayStr;
      proj.totalSentCount = (proj.totalSentCount || 0) + targetContacts.length;

      // Enqueue batch siaran baru ke SEMUA kontak target dari awal
      enqueueBroadcastBatch({
        hadith: chosenHadith,
        contacts: targetContacts,
        messageType: 'scheduled',
        projectId: proj.id,
        projectName: proj.name,
        minDelaySeconds: proj.minDelaySeconds,
        maxDelaySeconds: proj.maxDelaySeconds,
        templateMode: proj.templateMode || 'auto_contact',
        templateId: proj.templateId,
        detailTemplateId: proj.detailTemplateId,
        singkatTemplateId: proj.singkatTemplateId,
        forceResendAll: true,
      });

      // Jika berurutan, majukan indeks ke materi berikutnya untuk jadwal otomatis esok hari
      if (proj.selectionOrder === 'sequential') {
        proj.currentDatabaseIndex = (activeIdx + 1) % pool.length;
      }

      store.projectHistory.unshift({
        id: `hist-${nowMs}`,
        projectId: proj.id,
        projectName: proj.name,
        hadithId: chosenHadith.id,
        hadithTitle: chosenHadith.title,
        profileName: chosenHadith.profileName || 'Belum Terkategori',
        triggeredAt: nowIso,
        triggerType: 'manual_trigger',
        contactCount: targetContacts.length,
        notes: `Mulai pengiriman dari Hadis No. ${activeIdx + 1} (${chosenHadith.title}) ke seluruh ${targetContacts.length} kontak penerima.`,
      });
    } else if (action === 'send_now_once') {
      // Kirim Sekarang (satu kali): kirim langsung TANPA mengubah status/jadwal projek.
      // Cocok untuk kiriman darurat/tambahan di luar jadwal rutin.
      const targetContacts = getCandidateContactsForProject(proj);
      if (targetContacts.length === 0) {
        res.status(400).json({ error: 'Tidak ada kontak penerima aktif untuk target projek ini.' });
        return;
      }
      const pool = getCandidateHadithsForProject(proj);
      if (pool.length === 0) {
        res.status(400).json({ error: 'Database hadis untuk projek ini kosong.' });
        return;
      }
      const explicitHadithId = req.body?.hadithId;
      const targetIndex = Number(req.body?.targetIndex);
      if (explicitHadithId) {
        const foundIdx = pool.findIndex((h) => h.id === explicitHadithId);
        if (foundIdx !== -1) proj.currentDatabaseIndex = foundIdx;
      } else if (!isNaN(targetIndex) && targetIndex >= 0 && targetIndex < pool.length) {
        proj.currentDatabaseIndex = targetIndex;
      }
      const activeIdx = Math.min(pool.length - 1, Math.max(0, proj.currentDatabaseIndex || 0));
      const chosenHadith = pool[activeIdx];
      if (!chosenHadith) {
        res.status(400).json({ error: 'Hadis pilihan tidak ditemukan.' });
        return;
      }
      // Hapus antrean lama projek ini saja (jangan ubah status/lastTriggeredDate/index)
      store.deliveryLogs = store.deliveryLogs.filter(
        (l) => !(l.projectId === proj.id && (l.status === 'queued' || l.status === 'paused' || l.status === 'sending'))
      );
      chosenHadith.isSent = true;
      proj.totalSentCount = (proj.totalSentCount || 0) + targetContacts.length;
      enqueueBroadcastBatch({
        hadith: chosenHadith,
        contacts: targetContacts,
        messageType: 'scheduled',
        projectId: proj.id,
        projectName: proj.name,
        minDelaySeconds: proj.minDelaySeconds,
        maxDelaySeconds: proj.maxDelaySeconds,
        templateMode: proj.templateMode || 'auto_contact',
        templateId: proj.templateId,
        detailTemplateId: proj.detailTemplateId,
        singkatTemplateId: proj.singkatTemplateId,
        forceResendAll: true,
      });
      store.projectHistory.unshift({
        id: `hist-${nowMs}`,
        projectId: proj.id,
        projectName: proj.name,
        hadithId: chosenHadith.id,
        hadithTitle: chosenHadith.title,
        profileName: chosenHadith.profileName || 'Belum Terkategori',
        triggeredAt: nowIso,
        triggerType: 'manual_once',
        contactCount: targetContacts.length,
        notes: `Kirim Sekarang (satu kali): Hadis No. ${activeIdx + 1} (${chosenHadith.title}) ke ${targetContacts.length} kontak. Jadwal projek tidak berubah.`,
      });
    } else if (action === 'activate_schedule') {
      // Jalankan Sesuai Jadwal: aktifkan projek TANPA kirim sekarang.
      // Scheduler otomatis akan mengirim pada jam jadwal berikutnya
      // (hari ini jam 10:00 bila belum lewat, atau jadwal berikutnya).
      const targetContacts = getCandidateContactsForProject(proj);
      if (targetContacts.length === 0) {
        res.status(400).json({ error: 'Tidak ada kontak penerima aktif untuk target projek ini.' });
        return;
      }
      const pool = getCandidateHadithsForProject(proj);
      if (pool.length === 0) {
        res.status(400).json({ error: 'Database hadis untuk projek ini kosong.' });
        return;
      }
      proj.status = 'running';
      // Jangan set lastTriggeredDate: biarkan scheduler yang menentukan
      // apakah jadwal hari ini sudah lewat atau belum.
      store.projectHistory.unshift({
        id: `hist-${nowMs}`,
        projectId: proj.id,
        projectName: proj.name,
        hadithId: '',
        hadithTitle: '',
        profileName: '',
        triggeredAt: nowIso,
        triggerType: 'schedule_activated',
        contactCount: targetContacts.length,
        notes: `Jadwal diaktifkan: projek akan mengirim otomatis sesuai jadwal (${proj.scheduleTime || 'jam terjadwal'}).`,
      });
    }

    store.projectHistory = store.projectHistory.slice(0, 200);
    saveStore(store);
    res.json({
      ok: true,
      projects: store.projects,
      projectHistory: store.projectHistory,
      deliveryLogs: store.deliveryLogs,
    });
  });

  app.delete('/api/projects/:id', (req, res) => {
    store.projects = store.projects.filter((p) => p.id !== req.params.id);
    saveStore(store);
    res.json({ ok: true, projects: store.projects });
  });

  // Global Queue Pause / Resume / Stop
  app.post('/api/queue/control', (req, res) => {
    const { action } = req.body || {}; // 'pause_all' | 'resume_all' | 'stop_all'
    const nowMs = Date.now();
    if (action === 'pause_all') {
      store.deliveryLogs.forEach((l) => {
        if (l.status === 'queued') {
          l.status = 'paused';
          l.remainingMsWhenPaused = Math.max(2000, l.scheduledAtMs - nowMs);
        }
      });
    } else if (action === 'resume_all') {
      store.deliveryLogs.forEach((l) => {
        if (l.status === 'paused') {
          l.status = 'queued';
          l.scheduledAtMs = nowMs + (l.remainingMsWhenPaused || 4000);
        }
      });
    } else if (action === 'stop_all') {
      store.deliveryLogs.forEach((l) => {
        if (l.status === 'queued' || l.status === 'paused') {
          l.status = 'stopped';
          l.errorMessage = 'Antrean dihentikan oleh Admin.';
        }
      });
    }
    saveStore(store);
    res.json({ ok: true, deliveryLogs: store.deliveryLogs });
  });

  app.post('/api/broadcast/manual', (req, res) => {
    const { messageText, targetFilter = 'all', selectedContactIds = [], hadithId } = req.body || {};
    if (!messageText || !String(messageText).trim()) {
      res.status(400).json({ error: 'Isi pesan manual tidak boleh kosong.' });
      return;
    }

    let targets = store.contacts.filter((c) => c.isActive);
    if (targetFilter === 'singkat') {
      targets = targets.filter((c) => c.preference === 'singkat');
    } else if (targetFilter === 'detail') {
      targets = targets.filter((c) => c.preference === 'detail');
    } else if (targetFilter === 'custom' && Array.isArray(selectedContactIds)) {
      targets = store.contacts.filter((c) => selectedContactIds.includes(c.id));
    }

    if (targets.length === 0) {
      res.status(400).json({ error: 'Tidak ada kontak yang sesuai dengan filter penerima.' });
      return;
    }

    const referenceHadith: HadithItem =
      store.hadiths.find((h) => h.id === hadithId) ||
      store.hadiths[0] || {
        id: 'manual-msg',
        type: 'hadis',
        profileName: 'Pengumuman',
        sourceBook: 'Pesan Admin BDI',
        hadithNumber: '-',
        title: 'Pengumuman / Pesan Manual BDI',
        arabicText: '',
        translationText: String(messageText),
        asbabulWurud: '',
        shortSummary: String(messageText),
        lessonText: String(messageText),
        categoryTopic: 'Pengumuman',
        sequenceOrder: 0,
        isSent: true,
        createdAt: new Date().toISOString(),
      };

    const logs = enqueueBroadcastBatch({
      hadith: referenceHadith,
      contacts: targets,
      messageType: 'manual',
      projectName: 'Pesan Manual / Pengumuman',
      customManualText: String(messageText),
    });

    res.json({
      ok: true,
      queuedCount: logs.length,
      deliveryLogs: store.deliveryLogs,
    });
  });

  // --- DELIVERY LOGS & RETRY ---
  app.post('/api/logs/retry/:id', (req, res) => {
    const item = store.deliveryLogs.find((l) => l.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Log pengiriman tidak ditemukan.' });
      return;
    }
    const randomSec = getRandomInt(3, 10);
    item.status = 'queued';
    item.errorMessage = undefined;
    item.randomDelayAppliedSec = randomSec;
    item.scheduledAtMs = Date.now() + randomSec * 1000;
    saveStore(store);
    res.json({ ok: true, deliveryLogs: store.deliveryLogs });
  });

  app.post('/api/logs/clear', (_req, res) => {
    store.deliveryLogs = [];
    saveStore(store);
    res.json({ ok: true, deliveryLogs: [] });
  });

  // Delete a single delivery log by ID
  app.delete('/api/logs/:id', (req, res) => {
    const logId = req.params.id;
    const targetLog = store.deliveryLogs.find((l) => l.id === logId);
    if (!targetLog) {
      res.status(404).json({ error: 'Log tidak ditemukan.' });
      return;
    }
    store.deliveryLogs = store.deliveryLogs.filter((l) => l.id !== logId);

    if (targetLog.projectId) {
      const proj = store.projects.find((p) => p.id === targetLog.projectId);
      if (proj && proj.activeRun) {
        proj.activeRun.sentContactIds = proj.activeRun.sentContactIds.filter((id) => id !== targetLog.contactId);
        proj.activeRun.failedContactIds = proj.activeRun.failedContactIds.filter((id) => id !== targetLog.contactId);
        proj.activeRun.pendingContactIds = proj.activeRun.pendingContactIds.filter((id) => id !== targetLog.contactId);
      }
    }

    saveStore(store);
    res.json({ ok: true, deliveryLogs: store.deliveryLogs, projects: store.projects });
  });

  // Clear logs for a specific project (all, by scope, or by target date)
  app.post('/api/projects/:id/logs/clear', (req, res) => {
    const projId = req.params.id;
    const { scope = 'messages', targetDate } = req.body || {}; // scope: 'messages' | 'history' | 'all'
    const proj = store.projects.find((p) => p.id === projId);
    if (!proj) {
      res.status(404).json({ error: 'Projek tidak ditemukan.' });
      return;
    }

    let deletedCount = 0;
    if (scope === 'messages' || scope === 'all') {
      if (targetDate) {
        const before = store.deliveryLogs.length;
        store.deliveryLogs = store.deliveryLogs.filter(
          (l) => !(l.projectId === projId && l.timestamp && l.timestamp.slice(0, 10) === targetDate)
        );
        deletedCount = before - store.deliveryLogs.length;
      } else {
        const before = store.deliveryLogs.length;
        store.deliveryLogs = store.deliveryLogs.filter((l) => l.projectId !== projId);
        deletedCount = before - store.deliveryLogs.length;
        if (proj.activeRun && (proj.status === 'paused' || proj.status === 'stopped' || proj.activeRun.status === 'completed')) {
          delete proj.activeRun;
        }
      }
    }

    if (scope === 'history' || scope === 'all') {
      if (targetDate) {
        store.projectHistory = (store.projectHistory || []).filter(
          (h) => !(h.projectId === projId && h.triggeredAt && h.triggeredAt.slice(0, 10) === targetDate)
        );
      } else {
        store.projectHistory = (store.projectHistory || []).filter((h) => h.projectId !== projId);
      }
    }

    saveStore(store);
    res.json({
      ok: true,
      deletedCount,
      deliveryLogs: store.deliveryLogs,
      projectHistory: store.projectHistory,
      projects: store.projects,
    });
  });

  // Delete a single history item for a project
  app.delete('/api/projects/:projId/history/:histId', (req, res) => {
    const { histId } = req.params;
    store.projectHistory = (store.projectHistory || []).filter((h) => h.id !== histId);
    saveStore(store);
    res.json({ ok: true, projectHistory: store.projectHistory });
  });

  // --- WA ADMIN & GATEWAY SETTINGS ---
  app.post('/api/gateway/settings', (req, res) => {
    const nextPhone = normalizePhone(
      req.body?.adminPhone !== undefined
        ? String(req.body.adminPhone)
        : store.gatewaySettings.adminPhone
    );
    if (!nextPhone || nextPhone.length < 8) {
      res.status(400).json({ error: 'Nomor WhatsApp Admin tidak valid (minimal 8 digit).' });
      return;
    }
    store.gatewaySettings = {
      ...store.gatewaySettings,
      ...req.body,
      adminPhone: nextPhone,
    };
    saveStore(store);
    res.json({ ok: true, gatewaySettings: store.gatewaySettings });
  });

  // Get saved WA Auth bundle (for cross-device synchronization)
  app.get('/api/gateway/auth-bundle', (_req, res) => {
    const bundle = serializeWaAuthDir() || store.waAuthSnapshot || null;
    res.json({
      ok: true,
      hasBundle: Boolean(bundle && bundle['creds.json']),
      bundle,
      connectedPhone: waState.connectedPhone || store.gatewaySettings?.linkedPhone,
    });
  });

  // Restore WA Auth bundle from client or other device
  app.post('/api/gateway/restore-auth', async (req, res) => {
    const { bundle } = req.body || {};
    if (!bundle || typeof bundle !== 'object' || !bundle['creds.json']) {
      res.status(400).json({ error: 'Data sesi WhatsApp Auth tidak valid.' });
      return;
    }
    const restored = restoreWaAuthDir(bundle);
    if (!restored) {
      res.status(500).json({ error: 'Gagal menulis berkas autentikasi WhatsApp ke disk.' });
      return;
    }
    store.waAuthSnapshot = bundle;
    persistWaAuthSnapshot();
    await ensureBaileysConnected();
    res.json({ ok: true, waState, gatewaySettings: store.gatewaySettings });
  });

  // Force reconnect real socket
  app.post('/api/gateway/reconnect', async (_req, res) => {
    await ensureBaileysConnected();
    res.json({ ok: true, waState });
  });

  app.post('/api/gateway/connect-baileys', async (req, res) => {
    const { mode = 'qr', phone, freshReset = true } = req.body || {};
    const targetPhone = normalizePhone(phone || store.gatewaySettings.adminPhone);
    if (targetPhone) {
      store.gatewaySettings.adminPhone = targetPhone;
      saveStore(store);
    }
    await startBaileysSession(mode === 'pairing' ? targetPhone : undefined, Boolean(freshReset));
    res.json({ ok: true, waState, gatewaySettings: store.gatewaySettings });
  });

  // Check / Reconnect Real Baileys Session (No fake connected state!)
  app.post('/api/gateway/confirm-scan', async (req, res) => {
    const targetPhone = normalizePhone(req.body?.phone || store.gatewaySettings.adminPhone);
    if (targetPhone) {
      store.gatewaySettings.adminPhone = targetPhone;
    }
    if (waState.realSocketConnected && waSocket) {
      waState.status = 'connected';
      store.gatewaySettings.sessionLinked = true;
      store.gatewaySettings.linkedPhone = waState.connectedPhone || targetPhone;
      saveStore(store);
      res.json({ ok: true, waState, gatewaySettings: store.gatewaySettings });
      return;
    }
    if (hasSavedBaileysCreds() || tryHydrateWaAuthFromBackup()) {
      await ensureBaileysConnected();
      res.json({ ok: Boolean(waState.realSocketConnected), waState, gatewaySettings: store.gatewaySettings });
      return;
    }
    res.json({
      ok: false,
      waState,
      gatewaySettings: store.gatewaySettings,
      error:
        'Sesi WhatsApp belum terdeteksi masuk. Silakan scan QR Code atau masukkan 8-Digit Pairing Code di aplikasi WhatsApp Anda hingga status otomatis berubah menjadi TERHUBUNG.',
    });
  });

  app.post('/api/gateway/disconnect-baileys', async (_req, res) => {
    await disconnectBaileysSession();
    res.json({ ok: true, waState });
  });

  app.post('/api/gateway/test-send', async (req, res) => {
    const targetPhone = normalizePhone(req.body?.phone || store.gatewaySettings.adminPhone);
    const text =
      req.body?.message ||
      `✅ *TES KONEKSI BDI DAILY QURAN & HADIS*\n📅 ${formatIndonesianDate()}\nNomor WA Admin (${targetPhone}) berhasil terhubung secara nyata & siap mengirim pesan hadis otomatis dengan interval acak anti-blokir.`;

    const result = await sendSingleWhatsAppMessage(targetPhone, text);
    const logItem: DeliveryLog = {
      id: `log-test-${Date.now()}`,
      batchId: 'test-batch',
      projectName: 'Tes Koneksi WA Admin',
      contactId: 'admin',
      contactName: 'Nomor WA Admin',
      contactPhone: targetPhone,
      contactPreference: 'detail',
      hadithId: 'test',
      hadithTitle:
        result.gatewayUsed === 'simulation'
          ? 'Tes Koneksi WA Admin (Mode Simulasi)'
          : 'Tes Koneksi WA Admin (Pengiriman Nyata)',
      messageType: 'test',
      renderedMessage: text,
      status: result.ok ? 'sent' : 'failed',
      randomDelayAppliedSec: 1,
      scheduledAtMs: Date.now(),
      gatewayUsed: result.gatewayUsed,
      errorMessage: result.error,
      timestamp: new Date().toISOString(),
    };
    store.deliveryLogs = [logItem, ...store.deliveryLogs].slice(0, 500);
    saveStore(store);
    res.json({ ok: result.ok, result, logItem, deliveryLogs: store.deliveryLogs });
  });

  // --- EXTERNAL CLOUD BACKUP: GITHUB REPO & GOOGLE SHEETS ---
  app.post('/api/external-sync/settings', (req, res) => {
    store.externalSync = {
      ...store.externalSync,
      ...(req.body || {}),
    };
    saveStore(store);
    res.json({ ok: true, externalSync: store.externalSync });
  });

  // Push or Pull Backup to GitHub Repository via GitHub REST API
  app.post('/api/external-sync/github', async (req, res) => {
    try {
      const { mode = 'push', githubRepo, githubBranch = 'main', githubFilePath = 'backup/bdi-daily-hadis.json', githubToken } = req.body || {};
      const repo = String(githubRepo || store.externalSync.githubRepo || '').trim();
      const token = String(githubToken || store.externalSync.githubToken || '').trim();
      const branch = String(githubBranch || store.externalSync.githubBranch || 'main').trim();
      const filePath = String(githubFilePath || store.externalSync.githubFilePath || 'backup/bdi-daily-hadis.json').trim().replace(/^\/+/, '');

      if (!repo || !repo.includes('/') || !token) {
        res.status(400).json({
          error: 'Masukkan nama Repository (contoh: username/repo-backup) dan Personal Access Token GitHub.',
        });
        return;
      }

      store.externalSync = {
        ...store.externalSync,
        githubRepo: repo,
        githubBranch: branch,
        githubFilePath: filePath,
        githubToken: token,
      };
      saveStore(store);

      const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'BDI-Daily-Quran-Hadis-App',
      };

      if (mode === 'pull') {
        const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
        if (!getRes.ok) {
          const errText = await getRes.text();
          res.status(400).json({ error: `Gagal mengambil file dari GitHub (${getRes.status}): ${errText.slice(0, 120)}` });
          return;
        }
        const fileData: any = await getRes.json();
        const decoded = Buffer.from(fileData.content || '', 'base64').toString('utf-8');
        const parsedStore = JSON.parse(decoded);
        store = {
          ...store,
          ...parsedStore,
          profiles: syncProfiles(parsedStore.hadiths || store.hadiths, parsedStore.profiles || store.profiles),
        };
        saveStore(store);
        res.json({ ok: true, store, message: `Data berhasil di-restore dari GitHub (${repo}/${filePath}).` });
        return;
      }

      // Mode === 'push': Check if file exists to get its SHA
      let existingSha: string | undefined;
      const checkRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
      if (checkRes.ok) {
        const existingJson: any = await checkRes.json();
        existingSha = existingJson?.sha;
      }

      const contentBase64 = Buffer.from(JSON.stringify(store, null, 2), 'utf-8').toString('base64');
      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Backup BDI Daily Quran & Hadis (${new Date().toISOString()})`,
          content: contentBase64,
          branch,
          ...(existingSha ? { sha: existingSha } : {}),
        }),
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        res.status(400).json({ error: `Gagal upload ke GitHub (${putRes.status}): ${errText.slice(0, 140)}` });
        return;
      }

      res.json({ ok: true, message: `Backup berhasil disimpan ke GitHub (${repo} -> ${filePath}).` });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal menghubungi API GitHub.' });
    }
  });

  // Push or Pull Backup to Google Sheets (via Google Apps Script Web App URL)
  app.post('/api/external-sync/gsheet', async (req, res) => {
    try {
      const { mode = 'push', gsheetWebhookUrl } = req.body || {};
      const url = String(gsheetWebhookUrl || store.externalSync.gsheetWebhookUrl || '').trim();
      if (!url) {
        res.status(400).json({
          error: 'Masukkan URL Web App Google Sheets (Apps Script) terlebih dahulu. Klik tombol Tutorial untuk panduan.',
        });
        return;
      }

      store.externalSync.gsheetWebhookUrl = url;
      saveStore(store);

      if (mode === 'pull') {
        const getRes = await fetch(url);
        if (!getRes.ok) {
          res.status(400).json({ error: `Gagal membaca dari Google Sheets HTTP ${getRes.status}` });
          return;
        }
        const json: any = await getRes.json();
        const incoming = json?.store || json;
        if (incoming && Array.isArray(incoming.hadiths)) {
          store = {
            ...store,
            ...incoming,
            profiles: syncProfiles(incoming.hadiths, incoming.profiles || store.profiles),
          };
          saveStore(store);
          res.json({ ok: true, store, message: 'Data berhasil dipulihkan dari Google Sheets.' });
          return;
        }
        res.status(400).json({ error: 'Data dari Google Sheets belum berisi struktur backup yang valid.' });
        return;
      }

      const postRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'backup_bdi',
          timestamp: new Date().toISOString(),
          hadithCount: store.hadiths.length,
          contactCount: store.contacts.length,
          store,
        }),
      });

      if (!postRes.ok) {
        res.status(400).json({ error: `Gagal mengirim ke Google Sheets HTTP ${postRes.status}` });
        return;
      }

      res.json({ ok: true, message: 'Seluruh database Hadis, Kontak & Projek berhasil dikirim ke Google Sheets!' });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal menghubungi Google Sheets Web App.' });
    }
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('registerSW.js') ||
            filePath.endsWith('manifest.webmanifest')
          ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BDI Daily Quran & Hadis server running on http://0.0.0.0:${PORT}`);
    // Automatically resume saved Baileys WhatsApp session on server startup without wiping credentials
    if (hasSavedBaileysCreds()) {
      startBaileysSession(undefined, false).catch(() => {});
    }
  });
}

startServer();
