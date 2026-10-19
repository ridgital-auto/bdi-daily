export interface HadithItem {
  id: string;
  type: 'hadis' | 'quran';
  profileName: string; // e.g., "Oktober", "Belum Terkategori"
  sourceBook: string; // Perawi, e.g., "HR. Bukhari"
  sourceBookName?: string; // Nama Kitab Sumber spesifik, e.g., "Shahih Al-Bukhari"
  hadithNumber: string; // Nomor hadis dari kitab sumber
  hadithDegree?: string; // Derajat hadis, e.g., "Shahih" / "Hasan Shahih" / "Muttafaqun 'Alaih"
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
  key: string; // e.g., "{judul}" or "{salam}"
  label: string; // e.g., "Judul Hadis/Ayat" or "Salam Pembuka"
  defaultValue: string; // Value used when variable is custom or as fallback
  isSystem?: boolean; // True if mapped to dynamic hadith/contact/date fields
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
  name: string; // e.g. "BDI Projek Kajian Subuh"
  status: 'running' | 'paused' | 'stopped';
  sendTime: string; // HH:mm
  timezone?: 'WIB' | 'WITA' | 'WIT'; // Default 'WITA' (Asia/Makassar UTC+8)
  scheduleFrequency?: 'daily' | 'weekly' | 'custom_days'; // Default 'daily'
  scheduleDays?: number[]; // 0=Minggu, 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu
  targetMode?: 'all' | 'groups' | 'contacts'; // Default 'all'
  targetGroups?: string[]; // Selected contact groupTags when targetMode === 'groups'
  targetContactIds?: string[]; // Selected contact IDs when targetMode === 'contacts'
  templateMode?: 'auto_contact' | 'single_template'; // Default 'auto_contact'
  templateId?: string; // Selected template ID when templateMode === 'single_template'
  detailTemplateId?: string; // Selected template ID for 'detail' contacts when templateMode === 'auto_contact'
  singkatTemplateId?: string; // Selected template ID for 'singkat' contacts when templateMode === 'auto_contact'
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
  githubRepo: string; // e.g. "username/bdi-hadis-backup"
  githubBranch: string; // e.g. "main"
  githubFilePath: string; // e.g. "backup/bdi-store.json"
  githubToken: string;
  gsheetWebhookUrl: string; // Google Apps Script Web App URL
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
  fingerprint: string; // Normalized key e.g., "hr. bukhari#1" or normalized title
  type: 'hadis' | 'quran';
  sourceBook: string;
  sourceBookName: string;
  hadithNumber: string;
  title: string;
  categoryTopic: string;
  profileName: string;
  inDatabase?: boolean; // Automatically synced with current store.hadiths
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

export interface RuntimeWAState {
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

