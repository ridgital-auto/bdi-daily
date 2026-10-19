// Base URL untuk backend API (server Express + Baileys).
// Kosong = same-origin (mode AI Studio / backend lokal).
// Bila aplikasi dibuka via GitHub Pages (statis, tanpa backend), isi dengan
// URL Cloud Run agar fitur server (QR WhatsApp, dsb.) tetap bisa dipakai.

const DEFAULT_BACKEND_URL =
  'https://ais-pre-s5ocf7cy4urrkgghg2uyeb-365231750370.asia-southeast1.run.app';
const STORAGE_KEY = 'bdi_backend_url';

export function getBackendUrl(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    // String kosong yang tersimpan = paksa same-origin
    if (saved !== null) return saved;
  } catch {
    // ignore
  }
  // Default otomatis: di github.io pakai Cloud Run; selain itu same-origin
  if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
    return DEFAULT_BACKEND_URL;
  }
  return '';
}

export function setBackendUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, (url || '').trim());
  } catch {
    // ignore
  }
}

export function getDefaultBackendUrl(): string {
  return DEFAULT_BACKEND_URL;
}

/** Bangun URL API lengkap dari path relatif '/api/...'. */
export function api(path: string): string {
  return getBackendUrl() + path;
}
