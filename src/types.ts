export interface HadithItem {
  id: string;
  type: 'hadis' | 'quran';
  profileName: string; // e.g., "Oktober", "Adab", "Belum Terkategori"
  sourceBook: string; // Perawi, e.g., "HR. Bukhari"
  sourceBookName?: string; // e.g., "Shahih Al-Bukhari"
  hadithNumber: string; // e.g. "1"
  hadithDegree?: string; // "Shahih" / "Hasan Shahih" / "Muttafaqun 'Alaih"
  hadithLength?: 'singkat' | 'sedang' | 'panjang';
  title: string;
  arabicText: string;
  translationText: string;
  asbabulWurud?: string;
  shortSummary?: string;
  lessonText?: string;
  categoryTopic?: string;
  sequenceOrder: number;
  isSent: boolean;
  createdAt: string;
}

export interface TemplateVariableItem {
  id: string;
  key: string; // e.g., "{judul}" or "{salam}"
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
  notes?: string;
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
  sendTime: string; // HH:mm
  timezone?: 'WIB' | 'WITA' | 'WIT';
  scheduleFrequency?: 'daily' | 'weekly' | 'custom_days';
  scheduleDays?: number[]; // 0=Minggu, 1=Senin, ..
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

export interface ExternalSyncConfig {
  githubRepo: string;
  githubBranch: string;
  githubFilePath: string;
  githubToken: string;
  gsheetWebhookUrl: string;
  autoSyncCloud: boolean;
}

export interface GeneratedHadithLogEntry {
  id: string;
  fingerprint?: string;
  type?: 'hadis' | 'quran';
  title: string;
  sourceBook: string;
  sourceBookName?: string;
  hadithNumber: string;
  hadithDegree?: string;
  categoryTopic: string;
  profileName: string;
  generatedAt: string;
  inDatabase?: boolean;
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

export interface AppStoreData {
  hadiths: HadithItem[];
  profiles: string[];
  contacts: ContactItem[];
  contactGroups: string[];
  templates: MessageTemplate[];
  templateVariables: TemplateVariableItem[];
  projects: BdiProject[];
  deliveryLogs: DeliveryLog[];
  projectHistory: ProjectRunHistory[];
  gatewaySettings: GatewaySettings;
  externalSync: ExternalSyncConfig;
  generationHistory?: GeneratedHadithLogEntry[];
  waAuthSnapshot?: Record<string, string>;
}

export interface GoogleDriveBackupInfo {
  fileId: string;
  fileName: string;
  folderId?: string;
  modifiedTime?: string;
  sizeBytes?: number;
}
