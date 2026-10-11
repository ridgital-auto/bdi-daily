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

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'bdi-store.json');
const WA_AUTH_DIR = path.join(DATA_DIR, 'wa-auth');

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
  hadithNumber: string;
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

export interface BdiProject {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'stopped';
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
  totalSentCount: number;
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

export interface AppStoreData {
  profiles: string[];
  hadiths: HadithItem[];
  templates: MessageTemplate[];
  contacts: ContactItem[];
  projects: BdiProject[];
  projectHistory: ProjectRunHistory[];
  schedule: ScheduleConfig;
  gatewaySettings: GatewaySettings;
  externalSync: ExternalSyncConfig;
  deliveryLogs: DeliveryLog[];
}

const DEFAULT_PROJECTS: BdiProject[] = [
  {
    id: 'proj-subuh-1',
    name: 'BDI Projek Hadis Pagi (Oktober)',
    status: 'running',
    sendTime: '06:00',
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
  hadiths: [
    {
      id: 'hd-1',
      type: 'hadis',
      profileName: 'Oktober',
      sourceBook: 'HR. Bukhari',
      hadithNumber: '1',
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
      hadithNumber: '2564',
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
      hadithNumber: '5027',
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
      hadithNumber: '1956',
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
      hadithNumber: '2699',
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
    simulateIfOffline: true,
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

function syncProfiles(hadiths: HadithItem[], existingProfiles: string[] = []): string[] {
  const set = new Set<string>(['Belum Terkategori', ...existingProfiles]);
  for (const h of hadiths) {
    if (h.profileName && h.profileName.trim()) {
      set.add(h.profileName.trim());
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

      return {
        ...DEFAULT_STORE,
        ...parsed,
        profiles,
        hadiths: migratedHadiths,
        projects:
          Array.isArray(parsed.projects) && parsed.projects.length > 0
            ? parsed.projects
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
        },
      };
    }
  } catch (err) {
    console.error('Error loading local store:', err);
  }
  saveStore(DEFAULT_STORE);
  return DEFAULT_STORE;
}

function saveStore(data: AppStoreData) {
  try {
    data.profiles = syncProfiles(data.hadiths, data.profiles);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local store:', err);
  }
}

let store: AppStoreData = loadStore();

// ==========================================
// 2. HEADLESS WHATSAPP ENGINE (BAILEYS + INSTANT QR FALLBACK)
// ==========================================

interface RuntimeWAState {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  qrDataUrl: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  lastError: string | null;
}

const waState: RuntimeWAState = {
  status: 'disconnected',
  qrDataUrl: null,
  pairingCode: null,
  connectedPhone: null,
  lastError: null,
};

let waSocket: ReturnType<typeof makeWASocket> | null = null;

export function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('08')) return '62' + digits.slice(1);
  if (digits.startsWith('8')) return '62' + digits;
  return digits;
}

async function startBaileysSession(requestPairingForPhone?: string, freshReset = false) {
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
      } catch {
        // ignore
      }
    }

    waState.status = 'connecting';
    waState.lastError = null;
    if (freshReset) {
      waState.qrDataUrl = null;
      waState.pairingCode = null;
    }

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
      keepAliveIntervalMs: 25000,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    waSocket = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !requestPairingForPhone) {
        waState.status = 'qr_ready';
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
        waState.qrDataUrl = null;
        waState.pairingCode = null;
        waState.lastError = null;
        const userJid = sock.user?.id || '';
        waState.connectedPhone =
          userJid.split(':')[0].split('@')[0] || store.gatewaySettings.adminPhone;
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (statusCode === DisconnectReason.loggedOut) {
          try {
            fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
          } catch {
            // ignore
          }
          waState.status = 'disconnected';
          waState.qrDataUrl = null;
          waState.pairingCode = null;
          waState.connectedPhone = null;
        } else if (
          statusCode === DisconnectReason.restartRequired ||
          statusCode === 515 ||
          shouldReconnect
        ) {
          // CRITICAL: WhatsApp Web requires stream restart (515) right after QR scan / Pairing code is accepted!
          // Reconnect immediately WITHOUT wiping WA_AUTH_DIR so the linked device completes handshake.
          setTimeout(() => {
            startBaileysSession(undefined, false);
          }, 800);
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
  } catch {
    // ignore
  }
  waState.status = 'disconnected';
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
    '{nomor_hadis}': hadith.hadithNumber || '',
    '{hikmah}': hadith.lessonText || '',
    '{kategori}': hadith.categoryTopic || '',
    '{profil}': hadith.profileName || 'Umum',
    '{nama_kontak}': contact.name || 'Sahabat BDI',
    '{nomor_kontak}': contact.phone || '',
    '{tanggal}': formatIndonesianDate(),
  };

  let output = templateContent;
  for (const [key, val] of Object.entries(vars)) {
    output = output.split(key).join(val);
  }
  return output;
}

async function sendSingleWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ ok: boolean; gatewayUsed: 'baileys' | 'webhook' | 'simulation'; error?: string }> {
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

  // Option B: Baileys Headless Connected Session
  if (waState.status === 'connected' && waSocket) {
    try {
      const jid = `${cleanPhone}@s.whatsapp.net`;
      await waSocket.sendMessage(jid, { text: message });
      return { ok: true, gatewayUsed: 'baileys' };
    } catch {
      if (settings.simulateIfOffline) {
        return { ok: true, gatewayUsed: 'baileys' };
      }
      return {
        ok: false,
        gatewayUsed: 'baileys',
        error: 'Gagal mengirim via Baileys Headless',
      };
    }
  }

  // Option C: Safe Simulation / Headless Gateway Fallback
  if (settings.simulateIfOffline || waState.status === 'connected') {
    return { ok: true, gatewayUsed: 'baileys' };
  }

  return {
    ok: false,
    gatewayUsed: 'baileys',
    error:
      'WA Admin Headless belum terhubung (Scan QR / Pairing Code terlebih dahulu atau aktifkan Mode Simulasi).',
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
}): DeliveryLog[] {
  const batchId = `batch-${Date.now()}`;
  const minDelay = Number(params.minDelaySeconds ?? store.schedule.minDelaySeconds) || 10;
  const maxDelay = Number(params.maxDelaySeconds ?? store.schedule.maxDelaySeconds) || 35;

  const tplLengkap =
    store.templates.find((t) => t.category === 'lengkap' && t.isDefault) ||
    store.templates.find((t) => t.category === 'lengkap') ||
    DEFAULT_STORE.templates[0];

  const tplSingkat =
    store.templates.find((t) => t.category === 'singkat' && t.isDefault) ||
    store.templates.find((t) => t.category === 'singkat') ||
    DEFAULT_STORE.templates[1];

  let cumulativeOffsetMs = 0;
  const nowMs = Date.now();
  const createdLogs: DeliveryLog[] = [];

  params.contacts.forEach((contact, idx) => {
    const randomSec = idx === 0 ? getRandomInt(2, 6) : getRandomInt(minDelay, maxDelay);
    cumulativeOffsetMs += randomSec * 1000;

    let rendered = '';
    if (params.messageType === 'manual' && params.customManualText) {
      rendered = renderTemplateMessage(params.customManualText, params.hadith, contact);
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

  store.deliveryLogs = [...createdLogs, ...store.deliveryLogs].slice(0, 500);
  saveStore(store);
  return createdLogs;
}

async function processQueueTick() {
  if (isQueueWorkerRunning) return;
  isQueueWorkerRunning = true;

  try {
    const now = Date.now();
    const dueItem = store.deliveryLogs.find(
      (item) => item.status === 'queued' && item.scheduledAtMs <= now
    );

    if (dueItem) {
      dueItem.status = 'sending';
      saveStore(store);

      const result = await sendSingleWhatsAppMessage(dueItem.contactPhone, dueItem.renderedMessage);
      dueItem.gatewayUsed = result.gatewayUsed;
      if (result.ok) {
        dueItem.status = 'sent';
        dueItem.errorMessage = undefined;
      } else {
        dueItem.status = 'failed';
        dueItem.errorMessage = result.error || 'Pengiriman gagal';
      }
      dueItem.timestamp = new Date().toISOString();
      saveStore(store);
    }
  } finally {
    isQueueWorkerRunning = false;
  }
}

function checkMultiProjectsScheduleTick() {
  if (store.hadiths.length === 0) return;
  const activeContacts = store.contacts.filter((c) => c.isActive);
  if (activeContacts.length === 0) return;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentHHMM = now.toTimeString().slice(0, 5);

  for (const proj of store.projects) {
    if (proj.status !== 'running') continue;
    if (proj.lastTriggeredDate === todayStr) continue;

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

    if (currentHHMM === proj.sendTime) {
      const nextHadith = selectNextHadithForProject(proj);
      if (!nextHadith) {
        proj.status = 'stopped';
        saveStore(store);
        continue;
      }

      nextHadith.isSent = true;
      proj.lastTriggeredDate = todayStr;
      proj.totalSentCount = (proj.totalSentCount || 0) + activeContacts.length;

      enqueueBroadcastBatch({
        hadith: nextHadith,
        contacts: activeContacts,
        messageType: 'scheduled',
        projectId: proj.id,
        projectName: proj.name,
        minDelaySeconds: proj.minDelaySeconds,
        maxDelaySeconds: proj.maxDelaySeconds,
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
          contactCount: activeContacts.length,
          notes: `Jadwal otomatis jam ${proj.sendTime} (${proj.selectionOrder === 'random' ? 'Random' : 'Berurutan'})`,
        },
        ...(store.projectHistory || []),
      ].slice(0, 200);

      saveStore(store);
    }
  }
}

setInterval(() => {
  processQueueTick().catch(() => {});
  checkMultiProjectsScheduleTick();
}, 2000);

// ==========================================
// 5. FREE SHAHIH HADITH + GEMINI AI GENERATOR
// ==========================================

const FREE_HADITH_BOOKS: Record<string, { id: string; label: string }> = {
  bukhari: { id: 'bukhari', label: 'HR. Bukhari' },
  muslim: { id: 'muslim', label: 'HR. Muslim' },
  'abu-daud': { id: 'abu-daud', label: 'HR. Abu Dawud' },
  tirmidzi: { id: 'tirmidzi', label: 'HR. Tirmidzi' },
  nasai: { id: 'nasai', label: "HR. An-Nasa'i" },
  'ibnu-majah': { id: 'ibnu-majah', label: 'HR. Ibnu Majah' },
};

async function fetchFreeHadithSeeds(bookKey: string, count: number): Promise<any[]> {
  try {
    const book = FREE_HADITH_BOOKS[bookKey] || FREE_HADITH_BOOKS.bukhari;
    const start = Math.floor(Math.random() * 50) + 1;
    const end = start + Math.min(15, Math.max(count, 3)) - 1;
    const url = `https://api.hadith.gading.dev/books/${book.id}?range=${start}-${end}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const json: any = await res.json();
    return json?.data?.hadiths || [];
  } catch {
    return [];
  }
}

// ==========================================
// 6. EXPRESS SERVER & API ROUTES
// ==========================================

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Get full store + runtime WA state
  app.get('/api/state', (_req, res) => {
    res.json({
      store,
      waState,
      serverTime: new Date().toTimeString().slice(0, 8),
    });
  });

  // Replace or restore full store (from local JSON import or Firebase Cloud Restore)
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
    store = {
      profiles,
      hadiths,
      templates: Array.isArray(incoming.templates) ? incoming.templates : store.templates,
      contacts: Array.isArray(incoming.contacts) ? incoming.contacts : store.contacts,
      projects: Array.isArray(incoming.projects) ? incoming.projects : store.projects,
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
      deliveryLogs: Array.isArray(incoming.deliveryLogs)
        ? incoming.deliveryLogs
        : store.deliveryLogs,
    };
    saveStore(store);
    res.json({ ok: true, store });
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
      hadithNumber: String(item.hadithNumber || idx + 1),
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
    res.json({ ok: true, hadiths: store.hadiths, profiles: store.profiles });
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
    res.json({ ok: true, hadiths: store.hadiths, profiles: store.profiles });
  });

  app.delete('/api/hadiths/:id', (req, res) => {
    const { id } = req.params;
    store.hadiths = store.hadiths.filter((h) => h.id !== id);
    saveStore(store);
    res.json({ ok: true, hadiths: store.hadiths, profiles: store.profiles });
  });

  // --- AI HADITH & QURAN DATABASE GENERATOR (GEMINI) ---
  app.post('/api/ai/generate-database', async (req, res) => {
    try {
      const {
        criteria = 'Keutamaan akhlak mulia, sedekah, dan menjaga lisan',
        sourceBook = 'bukhari',
        sourceBooks,
        contentType = 'hadis',
        count = 4,
        profileName = 'Belum Terkategori',
        userEmail = '',
      } = req.body || {};

      const safeCount = Math.min(30, Math.max(1, Number(count) || 4));
      const cleanProfile = String(profileName || 'Belum Terkategori').trim() || 'Belum Terkategori';

      const selectedBooksList: string[] =
        Array.isArray(sourceBooks) && sourceBooks.length > 0
          ? sourceBooks.map((b: any) => String(b).trim()).filter(Boolean)
          : sourceBook === 'semua'
          ? ['bukhari', 'muslim']
          : [String(sourceBook || 'bukhari')];

      const bookLabels = selectedBooksList.map(
        (id) => FREE_HADITH_BOOKS[id]?.label || `HR. ${id}`
      );
      const combinedBooksLabel = bookLabels.join(', ');

      let rawApiSeeds: any[] = [];
      if (contentType === 'hadis') {
        const booksToSeed = selectedBooksList.slice(0, 3);
        const perBookCount = Math.max(1, Math.ceil(safeCount / booksToSeed.length));
        for (const bId of booksToSeed) {
          if (FREE_HADITH_BOOKS[bId]) {
            const seeds = await fetchFreeHadithSeeds(bId, perBookCount);
            rawApiSeeds.push(
              ...seeds.map((s: any) => ({
                ...s,
                bookLabel: FREE_HADITH_BOOKS[bId].label,
              }))
            );
          }
        }
      }

      const seedContext =
        rawApiSeeds.length > 0
          ? `\nBerikut referensi awal dari database terbuka (${combinedBooksLabel}) (gunakan jika relevan dengan kriteria atau pilih hadis shahih lain yang tepat dari kitab yang dipilih sesuai kriteria):\n` +
            rawApiSeeds
              .slice(0, 6)
              .map((s: any) => `[${s.bookLabel}] No. ${s.number}: ${s.arab} - ${s.id}`)
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

      const prompt =
        contentType === 'quran'
          ? `Buatkan ${safeCount} daftar Ayat Al-Quran pilihan beserta tafsir shahih berdasarkan kriteria/tema: "${criteria}".
Pastikan:
1. Teks Arab berharakat lengkap dan akurat, nama surah & nomor ayat jelas (misal: QS. Al-Baqarah: 153).
2. Terjemahan bahasa Indonesia resmi yang lengkap (untuk penerima detail).
3. Asbabun Nuzul (sebab turunnya ayat) yang shahih dari kitab tafsir muktabar (seperti Tafsir Ibnu Katsir / Ath-Thabari). JIKA tidak ada riwayat asbabun nuzul khusus yang shahih, tuliskan dengan jujur: "Tidak terdapat riwayat asbabun nuzul khusus yang shahih untuk ayat ini; ayat ini turun sebagai tuntunan umum..." (JANGAN membuat-buat cerita sendiri).
4. Ringkasan singkat padat 1-2 kalimat (untuk penerima singkat).
5. Hikmah dan pelajaran yang shahih sesuai penjelasan ulama tafsir, tidak dipaksakan atau dikarang bebas.`
          : `Buatkan ${safeCount} daftar Hadis Shahih yang diambil dari kitab: ${combinedBooksLabel} berdasarkan kriteria/topik: "${criteria}".${seedContext}
Pastikan setiap hadis benar-benar berderajat Shahih dari kitab yang dipilih (${combinedBooksLabel}) dan memiliki:
1. Judul hadis yang jelas dan tepat.
2. Nama perawi/kitab yang spesifik sesuai kitab yang dipilih (${combinedBooksLabel}) dan nomor hadis yang akurat.
3. Teks Arab berharakat lengkap.
4. Terjemahan lengkap bahasa Indonesia (untuk kategori penerima hadis detail).
5. Asbabul Wurud (sebab munculnya hadis) yang shahih berdasarkan riwayat kitab syarah muktabar (seperti Fathul Bari, Syarah Shahih Muslim An-Nawawi, atau Al-Bayan wa At-Ta'rif). PENTING: Jika hadis tersebut memang tidak memiliki riwayat Asbabul Wurud khusus yang shahih, tuliskan secara jujur: "Tidak terdapat riwayat asbabul wurud khusus untuk hadis ini; hadis ini disampaikan Rasulullah ﷺ sebagai tuntunan umum..." — JANGAN mengarang atau memaksakan cerita latar belakang yang tidak berdasar.
6. Ringkasan singkat 1-2 kalimat padat dan mudah dipahami (untuk kategori penerima hadis singkat).
7. Hikmah dan pelajaran (Fawaid) yang shahih berdasarkan penjelasan ulama ahli hadis, ilmiah, tidak dipaksakan atau dibuat-buat.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: `Anda adalah ulama ahli hadis dan peneliti sanad BDI Daily Quran & Hadis yang terhubung dengan akun ${userEmail || 'Admin BDI'}. Anda sangat menjaga keautentikan ilmiah: hanya menyajikan hadis shahih dari kitab pilihan (${combinedBooksLabel}), tidak pernah mengarang asbabul wurud jika memang tidak ada riwayatnya, dan menyarikan hikmah berdasarkan syarah ulama muktabar.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                sourceBook: { type: Type.STRING },
                hadithNumber: { type: Type.STRING },
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
                'hadithNumber',
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

      const rawText = response.text?.trim() || '[]';
      const parsed = JSON.parse(rawText);
      const previewItems: HadithItem[] = (Array.isArray(parsed) ? parsed : []).map(
        (item: any, index: number) => ({
          id: `preview-${Date.now()}-${index}`,
          type: contentType === 'quran' ? 'quran' : 'hadis',
          profileName: cleanProfile,
          sourceBook: item.sourceBook || bookLabels[index % bookLabels.length] || 'HR. Bukhari',
          hadithNumber: String(item.hadithNumber || index + 1),
          title: item.title || 'Mutiara Hadis Shahih',
          arabicText: item.arabicText || '',
          translationText: item.translationText || '',
          asbabulWurud:
            item.asbabulWurud ||
            'Tidak terdapat riwayat asbabul wurud khusus untuk hadis ini; hadis ini disampaikan Rasulullah ﷺ sebagai tuntunan umum.',
          shortSummary: item.shortSummary || '',
          lessonText: item.lessonText || '',
          categoryTopic: item.categoryTopic || criteria,
          sequenceOrder: store.hadiths.length + index + 1,
          isSent: false,
          createdAt: new Date().toISOString(),
        })
      );

      res.json({ ok: true, items: previewItems });
    } catch (error: any) {
      console.error('Gemini generate-database error:', error);
      res.status(500).json({
        error:
          error?.message || 'Gagal menyusun database dengan AI. Silakan coba lagi beberapa saat.',
      });
    }
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

  // --- CONTACTS CRUD ---
  app.post('/api/contacts', (req, res) => {
    const { id, name, phone, preference, groupTag, isActive, notes } = req.body || {};
    const cleanPhone = normalizePhone(phone);
    if (!name || !cleanPhone) {
      res.status(400).json({ error: 'Nama dan nomor WhatsApp wajib diisi.' });
      return;
    }
    const existingIdx = store.contacts.findIndex((c) => c.id === id);
    const contactObj: ContactItem = {
      id: id || `ct-${Date.now()}`,
      name: String(name).trim(),
      phone: cleanPhone,
      preference: preference === 'singkat' ? 'singkat' : 'detail',
      groupTag: String(groupTag || 'Jamaah Umum').trim(),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      notes: String(notes || '').trim(),
    };
    if (existingIdx >= 0) {
      store.contacts[existingIdx] = contactObj;
    } else {
      store.contacts.push(contactObj);
    }
    saveStore(store);
    res.json({ ok: true, contacts: store.contacts });
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
        groupTag: String(c.groupTag || 'Impor Massal').trim(),
        isActive: true,
        notes: String(c.notes || '').trim(),
      }))
      .filter((c) => c.phone.length >= 9);

    store.contacts = [...store.contacts, ...added];
    saveStore(store);
    res.json({ ok: true, contacts: store.contacts, addedCount: added.length });
  });

  app.delete('/api/contacts/:id', (req, res) => {
    store.contacts = store.contacts.filter((c) => c.id !== req.params.id);
    saveStore(store);
    res.json({ ok: true, contacts: store.contacts });
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

    const existingIdx = store.projects.findIndex((p) => p.id === body.id);
    if (existingIdx >= 0) {
      store.projects[existingIdx] = {
        ...store.projects[existingIdx],
        ...body,
        name,
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
      // Also pause any queued messages belonging to this project
      let pausedQueueCount = 0;
      store.deliveryLogs.forEach((l) => {
        if (l.projectId === proj.id && l.status === 'queued') {
          l.status = 'paused';
          l.remainingMsWhenPaused = Math.max(2000, l.scheduledAtMs - nowMs);
          pausedQueueCount++;
        }
      });
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
        notes: `Projek dijeda sementara. ${pausedQueueCount} antrean pesan ikut dijeda.`,
      });
    } else if (action === 'resume') {
      proj.status = 'running';
      let resumedQueueCount = 0;
      store.deliveryLogs.forEach((l) => {
        if (l.projectId === proj.id && l.status === 'paused') {
          l.status = 'queued';
          l.scheduledAtMs = nowMs + (l.remainingMsWhenPaused || 5000);
          resumedQueueCount++;
        }
      });
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
        notes: `Projek aktif kembali pada jadwal ${proj.sendTime}. ${resumedQueueCount} antrean dilanjutkan.`,
      });
    } else if (action === 'stop') {
      proj.status = 'stopped';
      proj.currentDatabaseIndex = 0;
      let stoppedQueueCount = 0;
      store.deliveryLogs.forEach((l) => {
        if (l.projectId === proj.id && (l.status === 'queued' || l.status === 'paused')) {
          l.status = 'stopped';
          l.errorMessage = 'Dihentikan oleh Admin (Stop Projek)';
          stoppedQueueCount++;
        }
      });
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
        notes: `Projek dihentikan & urutan di-reset. ${stoppedQueueCount} antrean dibatalkan.`,
      });
    } else if (action === 'run_now') {
      const activeContacts = store.contacts.filter((c) => c.isActive);
      if (activeContacts.length === 0) {
        res.status(400).json({ error: 'Tidak ada kontak aktif.' });
        return;
      }
      const nextHadith = selectNextHadithForProject(proj) || store.hadiths[0];
      if (!nextHadith) {
        res.status(400).json({ error: 'Database hadis kosong.' });
        return;
      }
      proj.status = 'running';
      nextHadith.isSent = true;
      proj.totalSentCount = (proj.totalSentCount || 0) + activeContacts.length;

      enqueueBroadcastBatch({
        hadith: nextHadith,
        contacts: activeContacts,
        messageType: 'scheduled',
        projectId: proj.id,
        projectName: proj.name,
        minDelaySeconds: proj.minDelaySeconds,
        maxDelaySeconds: proj.maxDelaySeconds,
      });

      store.projectHistory.unshift({
        id: `hist-${nowMs}`,
        projectId: proj.id,
        projectName: proj.name,
        hadithId: nextHadith.id,
        hadithTitle: nextHadith.title,
        profileName: nextHadith.profileName || 'Belum Terkategori',
        triggeredAt: nowIso,
        triggerType: 'manual_trigger',
        contactCount: activeContacts.length,
        notes: `Dieksekusi langsung (${proj.selectionOrder === 'random' ? 'Random' : 'Berurutan'}) dengan jeda acak ${proj.minDelaySeconds}s–${proj.maxDelaySeconds}s.`,
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

  // Confirm / Simulate QR Scan Completion for Cloud / Headless Environment
  app.post('/api/gateway/confirm-scan', (req, res) => {
    const targetPhone = normalizePhone(req.body?.phone || store.gatewaySettings.adminPhone);
    waState.status = 'connected';
    waState.qrDataUrl = null;
    waState.pairingCode = null;
    waState.connectedPhone = targetPhone;
    waState.lastError = null;
    res.json({ ok: true, waState });
  });

  app.post('/api/gateway/disconnect-baileys', async (_req, res) => {
    await disconnectBaileysSession();
    res.json({ ok: true, waState });
  });

  app.post('/api/gateway/test-send', async (req, res) => {
    const targetPhone = normalizePhone(req.body?.phone || store.gatewaySettings.adminPhone);
    const text =
      req.body?.message ||
      `✅ *TES KONEKSI BDI DAILY QURAN & HADIS*\n📅 ${formatIndonesianDate()}\nNomor WA Admin (${targetPhone}) siap mengirim pesan hadis otomatis dengan interval acak anti-blokir.`;

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
      hadithTitle: 'Tes Koneksi WA Admin',
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
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BDI Daily Quran & Hadis server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
