export type TimeFormat = '12h' | '24h';

export type DateFormatOption =
  | 'short' // "Thu Nov 12"
  | 'long' // "Thursday, 12 November"
  | 'numeric-dmy' // "12/11/2026"
  | 'numeric-mdy' // "11/12/2026"
  | 'iso' // "2026-11-12"
  | 'day-month' // "12 Nov"
  | 'hidden';

export type DatePosition = 'above' | 'below';

export type WordCase = 'original' | 'lowercase' | 'uppercase';

export interface AppearanceConfig {
  // Time
  timeFormat: TimeFormat;
  showAmPm: boolean;
  showSeconds: boolean;
  leadingZero: boolean;
  timeFont: string;
  timeWeight: number; // 200, 300, 400, 700
  timeSize: number; // 70 to 160 px (default 110)

  // Date
  dateFormat: DateFormatOption;
  datePosition: DatePosition;
  dateFont: string; // 'follow-time' or font id
  locale: string; // 'default' or language code like 'en-US', 'es-ES', etc.

  // Lyrics
  lyricsFont: string;
  lyricsActiveWeight: number; // 200, 300, 400, 700
  lyricsActiveSize: number; // 24 to 64 px (default 44)
  lyricsPastSize: number; // 10 to 20 px (default 13)
  lyricsCase: WordCase;
  showStars: boolean;
  showConnectingLines: boolean;
}

export interface FontOption {
  id: string;
  name: string;
  family: string;
  weights: number[];
}

export const AVAILABLE_FONTS: FontOption[] = [
  {
    id: 'sf-style',
    name: 'System UI / Sans',
    family: 'system-ui, "Segoe UI", Roboto, sans-serif',
    weights: [200, 300, 400, 700],
  },
  {
    id: 'inter',
    name: 'Inter',
    family: '"Inter", system-ui, sans-serif',
    weights: [200, 300, 400, 700],
  },
  {
    id: 'space-grotesk',
    name: 'Space Grotesk',
    family: '"Space Grotesk", sans-serif',
    weights: [300, 400, 700],
  },
  {
    id: 'poppins',
    name: 'Poppins',
    family: '"Poppins", sans-serif',
    weights: [200, 300, 400, 700],
  },
  {
    id: 'playfair-display',
    name: 'Playfair Display',
    family: '"Playfair Display", Georgia, serif',
    weights: [400, 700],
  },
  {
    id: 'bebas-neue',
    name: 'Bebas Neue',
    family: '"Bebas Neue", Impact, sans-serif',
    weights: [400],
  },
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    family: '"JetBrains Mono", Menlo, Consolas, monospace',
    weights: [200, 300, 400, 700],
  },
  {
    id: 'orbitron',
    name: 'Orbitron',
    family: '"Orbitron", "SF Pro Display", sans-serif',
    weights: [400, 700],
  },
  {
    id: 'dancing-script',
    name: 'Dancing Script',
    family: '"Dancing Script", cursive',
    weights: [400, 700],
  },
];

export const AVAILABLE_LOCALES = [
  { code: 'default', label: 'System / Auto' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'pt-BR', label: 'Portuguese' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'zh-CN', label: 'Chinese' },
  { code: 'hi-IN', label: 'Hindi' },
];

export const DEFAULT_APPEARANCE_CONFIG: AppearanceConfig = {
  timeFormat: '24h',
  showAmPm: false,
  showSeconds: false,
  leadingZero: true,
  timeFont: 'sf-style',
  timeWeight: 200,
  timeSize: 110,

  dateFormat: 'short',
  datePosition: 'above',
  dateFont: 'follow-time',
  locale: 'default',

  lyricsFont: 'sf-style',
  lyricsActiveWeight: 700,
  lyricsActiveSize: 44,
  lyricsPastSize: 13,
  lyricsCase: 'original',
  showStars: true,
  showConnectingLines: true,
};

export interface AppearancePreset {
  id: string;
  name: string;
  description: string;
  config: Partial<AppearanceConfig>;
}

export const APPEARANCE_PRESETS: AppearancePreset[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Thin typography, pure black background, synced lyrics + ambient light',
    config: {
      timeFont: 'sf-style',
      timeWeight: 200,
      timeSize: 110,
      timeFormat: '24h',
      showAmPm: false,
      showSeconds: false,
      leadingZero: true,
      dateFormat: 'short',
      datePosition: 'above',
      dateFont: 'follow-time',
      lyricsFont: 'sf-style',
      lyricsActiveWeight: 700,
      lyricsActiveSize: 44,
      lyricsPastSize: 13,
      lyricsCase: 'original',
      showStars: true,
      showConnectingLines: true,
    },
  },
  {
    id: 'retro',
    name: 'Retro',
    description: 'Futuristic Orbitron with monospace accents and ISO date',
    config: {
      timeFont: 'orbitron',
      timeWeight: 400,
      timeSize: 96,
      timeFormat: '24h',
      showAmPm: false,
      showSeconds: true,
      leadingZero: true,
      dateFormat: 'iso',
      datePosition: 'below',
      dateFont: 'jetbrains-mono',
      lyricsFont: 'jetbrains-mono',
      lyricsActiveWeight: 700,
      lyricsActiveSize: 40,
      lyricsPastSize: 13,
      lyricsCase: 'uppercase',
      showStars: true,
      showConnectingLines: true,
    },
  },
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'Refined Playfair serif styling with full written date',
    config: {
      timeFont: 'playfair-display',
      timeWeight: 400,
      timeSize: 105,
      timeFormat: '12h',
      showAmPm: true,
      showSeconds: false,
      leadingZero: false,
      dateFormat: 'long',
      datePosition: 'above',
      dateFont: 'playfair-display',
      lyricsFont: 'playfair-display',
      lyricsActiveWeight: 700,
      lyricsActiveSize: 46,
      lyricsPastSize: 14,
      lyricsCase: 'original',
      showStars: true,
      showConnectingLines: true,
    },
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'Impactful Bebas Neue display typography and clean modern lines',
    config: {
      timeFont: 'bebas-neue',
      timeWeight: 400,
      timeSize: 130,
      timeFormat: '12h',
      showAmPm: false,
      showSeconds: false,
      leadingZero: false,
      dateFormat: 'day-month',
      datePosition: 'above',
      dateFont: 'space-grotesk',
      lyricsFont: 'space-grotesk',
      lyricsActiveWeight: 700,
      lyricsActiveSize: 48,
      lyricsPastSize: 13,
      lyricsCase: 'uppercase',
      showStars: true,
      showConnectingLines: true,
    },
  },
];

// Lazy font loaders bundle fonts locally with @fontsource packages
const FONT_LOADERS: Record<string, () => Promise<unknown>> = {
  'inter': async () => {
    await Promise.all([
      import('@fontsource/inter/200.css'),
      import('@fontsource/inter/300.css'),
      import('@fontsource/inter/400.css'),
      import('@fontsource/inter/700.css'),
    ]);
  },
  'space-grotesk': async () => {
    await Promise.all([
      import('@fontsource/space-grotesk/300.css'),
      import('@fontsource/space-grotesk/400.css'),
      import('@fontsource/space-grotesk/700.css'),
    ]);
  },
  'poppins': async () => {
    await Promise.all([
      import('@fontsource/poppins/200.css'),
      import('@fontsource/poppins/300.css'),
      import('@fontsource/poppins/400.css'),
      import('@fontsource/poppins/700.css'),
    ]);
  },
  'playfair-display': async () => {
    await Promise.all([
      import('@fontsource/playfair-display/400.css'),
      import('@fontsource/playfair-display/700.css'),
    ]);
  },
  'bebas-neue': async () => {
    await import('@fontsource/bebas-neue/400.css');
  },
  'jetbrains-mono': async () => {
    await Promise.all([
      import('@fontsource/jetbrains-mono/200.css'),
      import('@fontsource/jetbrains-mono/300.css'),
      import('@fontsource/jetbrains-mono/400.css'),
      import('@fontsource/jetbrains-mono/700.css'),
    ]);
  },
  'orbitron': async () => {
    await Promise.all([
      import('@fontsource/orbitron/400.css'),
      import('@fontsource/orbitron/700.css'),
    ]);
  },
  'dancing-script': async () => {
    await Promise.all([
      import('@fontsource/dancing-script/400.css'),
      import('@fontsource/dancing-script/700.css'),
    ]);
  },
};

const loadedFontIds = new Set<string>();

export async function ensureFontLoaded(fontId: string): Promise<void> {
  if (!fontId || fontId === 'sf-style' || fontId === 'follow-time' || loadedFontIds.has(fontId)) {
    return;
  }
  const loader = FONT_LOADERS[fontId];
  if (loader) {
    try {
      await loader();
      loadedFontIds.add(fontId);
      if (typeof document !== 'undefined' && document.fonts) {
        await document.fonts.ready;
      }
    } catch (err) {
      console.warn(`[FontLoader] Could not load font ${fontId}:`, err);
    }
  }
}

export function getFontFamily(fontId: string): string {
  const found = AVAILABLE_FONTS.find((f) => f.id === fontId);
  return found ? found.family : 'system-ui, "Segoe UI", Roboto, sans-serif';
}

const STORAGE_KEY = 'ambient_visualizer_appearance_v1';

export function loadStoredAppearance(): AppearanceConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_APPEARANCE_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('[Appearance] Failed to read appearance from localStorage:', e);
  }
  return DEFAULT_APPEARANCE_CONFIG;
}

export function saveStoredAppearance(cfg: AppearanceConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.warn('[Appearance] Failed to save appearance to localStorage:', e);
  }
}

