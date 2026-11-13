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

    // 2. Clear leftover legacy ripple settings keys on startup (Step 2)
    const rippleKeysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('ripple') || key.includes('word_ripple'))) {
        rippleKeysToRemove.push(key);
      }
    }
    for (const k of rippleKeysToRemove) {
      localStorage.removeItem(k);
    }

    // Also sanitize saved appearance config if stored in localStorage
    const savedAppearance = localStorage.getItem('astralyr_appearance_config');
    if (savedAppearance) {
      try {
        const parsed = JSON.parse(savedAppearance);
        delete parsed.rippleEnabled;
        delete parsed.rippleStyle;
        delete parsed.rippleSize;
        delete parsed.rippleSpeed;
        delete parsed.rippleColor;
        delete parsed.rippleShimmer;
        localStorage.setItem('astralyr_appearance_config', JSON.stringify(parsed));
      } catch {}
    }
  } catch (err) {
    console.warn('[Astralyr] Error during localStorage migration:', err);
  }
}

