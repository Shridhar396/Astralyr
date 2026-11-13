/**
 * Astralyr Storage & Database Migration Service
 * Seamlessly migrates localStorage and IndexedDB data from legacy 'constella' to 'astralyr'
 */

export function migrateStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    // 1. Migrate all localStorage keys starting with 'constella_' to 'astralyr_'
    const keysToMigrate: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('constella_')) {
        keysToMigrate.push(key);
      }
    }

    for (const oldKey of keysToMigrate) {
      const newKey = 'astralyr_' + oldKey.slice('constella_'.length);
      const existingNewVal = localStorage.getItem(newKey);
      if (existingNewVal === null) {
        const val = localStorage.getItem(oldKey);
        if (val !== null) {
          localStorage.setItem(newKey, val);
        }
      }
    }
  } catch (err) {
    console.warn('[Astralyr] Error during localStorage migration:', err);
  }
}

