/**
 * Astralyr Feature Gating & Edition Management
 * Centralized feature resolution for Web and Desktop (Trial / Pro / Free) editions.
 */

export type AstralyrEdition = 'web' | 'desktop-trial' | 'desktop-pro' | 'desktop-free';

export type FeatureName =
  | 'beat_engine'             // Beat-synced audio frequency analysis & onsets
  | 'moving_ambient_light'    // Dynamic orbital moving ambient light
  | 'mesh_background'         // Multi-point organic fluid gradient mesh
  | 'album_background'        // Dynamic color extraction from album artwork
  | 'custom_gradients'        // Custom gradient presets, angles, and color stops
  | 'appearance_presets'      // One-click aesthetic presets (Late night, Aurora, etc.)
  | 'all_fonts'               // Unlocks all 9 curated fonts (Free has 3)
  | 'unlimited_playlists'     // Unlimited playlists and tracks (Free has 1 playlist, 20 tracks)
  | 'persistent_library'      // OS-safe permanent library folder & copy-on-import
  | 'audius_downloads'        // Download Audius tracks to local storage
  | 'auto_timing'             // Auto lyrics duration matching & sync via LRCLIB
  | 'offline_mode'            // Full offline mode & local playback
  | 'desktop_controls'        // Fullscreen, always-on-top, system tray
  | 'auto_update';            // Seamless background updates

export const GET_DESKTOP_URL = 'https://astralyr.app/download';
export const BUY_PRO_URL = 'https://astralyr.app/buy';

// Free / Web edition limits
export const FREE_ALLOWED_FONTS = ['sf-style', 'inter', 'space-grotesk'];
export const FREE_ALLOWED_THEMES = ['solid', 'midnight'];
export const FREE_PLAYLIST_LIMIT = 1;
export const FREE_TRACK_LIMIT = 20;

// Free glow colors (3 gentle pulse choices)
export const FREE_GLOW_COLORS = [
  { name: 'Starlight White', hex: '#ffffff' },
  { name: 'Nebula Cyan', hex: '#38bdf8' },
  { name: 'Astral Amber', hex: '#fbbf24' },
];

// Current runtime edition override (can be set by licensing manager or desktop bridge)
let currentEditionOverride: AstralyrEdition | null = null;

// Pro Preview State (once per session, 30 seconds)
const PRO_PREVIEW_DURATION_SEC = 30;
let proPreviewRemaining = 0;
let proPreviewTimer: NodeJS.Timeout | null = null;
const previewListeners = new Set<(remaining: number) => void>();

export function isElectronApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.electronAPI?.isElectron);
}

export function setEdition(edition: AstralyrEdition): void {
  currentEditionOverride = edition;
}

export function getEdition(): AstralyrEdition {
  if (currentEditionOverride) return currentEditionOverride;

  // Development override for testing Pro features in browser (STRICTLY excluded from production builds)
  if (import.meta.env.DEV) {
    if (import.meta.env.VITE_EDITION === 'desktop-pro') {
      return 'desktop-pro';
    }
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('edition') === 'pro') {
          return 'desktop-pro';
        }
      } catch {
        // ignore in non-browser env
      }
    }
  }

  if (isElectronApp()) {
    // Check local storage or license cache for desktop edition
    const cached = localStorage.getItem('astralyr_edition');
    if (cached === 'desktop-pro' || cached === 'desktop-trial' || cached === 'desktop-free') {
      return cached;
    }
    return 'desktop-trial'; // Default desktop starts in 14-day trial
  }

  return 'web';
}

export const ALL_FEATURE_GATES: FeatureName[] = [
  'beat_engine',
  'moving_ambient_light',
  'mesh_background',
  'album_background',
  'custom_gradients',
  'appearance_presets',
  'all_fonts',
  'unlimited_playlists',
  'persistent_library',
  'audius_downloads',
  'auto_timing',
  'offline_mode',
  'desktop_controls',
  'auto_update',
];

export function logFeatureGateStatus(): void {
  const edition = getEdition();
  const rows = ALL_FEATURE_GATES.map((f) => {
    const allowed = hasFeature(f);
    return {
      'Feature Gate': f,
      'Allowed': allowed,
      'Returning False': !allowed,
    };
  });
  console.log(`%c[Astralyr Edition] Active: ${edition}`, 'color: #38bdf8; font-weight: bold; font-size: 13px;');
  console.table(rows);
}

export function isVisualFeature(feature: FeatureName): boolean {
  return [
    'beat_engine',
    'moving_ambient_light',
    'mesh_background',
    'album_background',
    'custom_gradients',
    'appearance_presets',
    'all_fonts',
  ].includes(feature);
}

// Prompt 1: Unlocked for now (defaults to true). Tests can toggle via setUnlockAllFeatures(false).
let unlockAllFeatures = true;

export function setUnlockAllFeatures(unlocked: boolean): void {
  unlockAllFeatures = unlocked;
}

export function isAllFeaturesUnlocked(): boolean {
  return unlockAllFeatures;
}

/**
 * Check if the active edition or preview has access to a specific feature.
 */
export function hasFeature(feature: FeatureName): boolean {
  if (unlockAllFeatures) return true;

  const edition = getEdition();

  // Desktop Pro has all features
  if (edition === 'desktop-pro') return true;

  // Desktop Trial has all features during trial period
  if (edition === 'desktop-trial') return true;

  // Web or Desktop Free with active Pro Preview gets temporary visual features
  if (isProPreviewActive() && isVisualFeature(feature)) {
    return true;
  }

  // Common features available in web & free
  switch (feature) {
    case 'offline_mode':
      return isElectronApp(); // Local playback in desktop free
    case 'desktop_controls':
      return isElectronApp();
    default:
      return false;
  }
}

// -------------------------------------------------------------
// Pro Preview (30 seconds, once per session)
// -------------------------------------------------------------

export function hasUsedProPreview(): boolean {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('astralyr_pro_preview_used') === 'true';
    }
  } catch {}
  return false;
}

export function isProPreviewActive(): boolean {
  return proPreviewRemaining > 0;
}

export function getProPreviewRemaining(): number {
  return proPreviewRemaining;
}

export function subscribeProPreview(callback: (remaining: number) => void): () => void {
  previewListeners.add(callback);
  callback(proPreviewRemaining);
  return () => {
    previewListeners.delete(callback);
  };
}

function notifyPreviewListeners() {
  previewListeners.forEach((fn) => fn(proPreviewRemaining));
}

/**
 * Start the 30-second Pro Preview. Can only be triggered once per session.
 * Never interrupts playback or displays popups during a song.
 */
export function startProPreview(): boolean {
  if (hasUsedProPreview() || isProPreviewActive()) {
    return false;
  }

  try {
    sessionStorage.setItem('astralyr_pro_preview_used', 'true');
  } catch {}

  proPreviewRemaining = PRO_PREVIEW_DURATION_SEC;
  notifyPreviewListeners();

  if (proPreviewTimer) clearInterval(proPreviewTimer);

  proPreviewTimer = setInterval(() => {
    proPreviewRemaining -= 1;
    notifyPreviewListeners();

    if (proPreviewRemaining <= 0) {
      if (proPreviewTimer) clearInterval(proPreviewTimer);
      proPreviewTimer = null;
      proPreviewRemaining = 0;
      notifyPreviewListeners();
    }
  }, 1000);

  return true;
}

export function cancelProPreview(): void {
  if (proPreviewTimer) {
    clearInterval(proPreviewTimer);
    proPreviewTimer = null;
  }
  proPreviewRemaining = 0;
  notifyPreviewListeners();
}
