export interface HadithItem {
  id: string;
  type: 'hadis' | 'quran';
  profileName: string; // e.g., "Oktober", "Belum Terkategori"
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
  name: string; // e.g. "BDI Projek Kajian Subuh"
  status: 'running' | 'paused' | 'stopped';
  sendTime: string; // HH:mm
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

export interface RuntimeWAState {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  qrDataUrl: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  lastError: string | null;
}
