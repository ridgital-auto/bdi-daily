import { AppStoreData } from './types';
import { initialStoreData } from './defaultStore';

const STORAGE_KEY = 'bdi_local_backup_snapshot';
const TIME_KEY = 'bdi_local_backup_time';

export function loadStandaloneStore(): AppStoreData {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.hadiths)) {
          return {
            ...initialStoreData,
            ...parsed,
          };
        }
      }
    }
  } catch (err) {
    console.error('Error loading standalone store:', err);
  }
  return JSON.parse(JSON.stringify(initialStoreData));
}

export function saveStandaloneStore(store: AppStoreData): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      localStorage.setItem(TIME_KEY, new Date().toLocaleString('id-ID'));
    }
  } catch (err) {
    console.error('Error saving standalone store:', err);
  }
}
