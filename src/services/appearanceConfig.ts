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

export type AmbientMotionMode = 'off' | 'calm' | 'beat' | 'party';
export type AmbientStyle = 'rim-bloom' | 'bloom-only' | 'rim-only';

export type BackgroundMode = 'solid' | 'gradient' | 'album' | 'mesh';
export type GradientType = 'linear' | 'radial';

export type VisualQuality = 'auto' | 'high' | 'medium' | 'low' | 'minimal';
export type RippleStyle = 'rings' | 'pulse-only' | 'rings-pulse';
export type RippleColor = 'accent' | 'white';

export interface GradientPreset {
  id: string;
  name: string;
  type: GradientType;
  colors: string[];
  angle: number;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: 'midnight', name: 'Midnight', type: 'linear', colors: ['#090a0f', '#181b26', '#0d1117'], angle: 135 },
  { id: 'sunset', name: 'Sunset', type: 'linear', colors: ['#230b1e', '#3b1024', '#150616'], angle: 180 },
  { id: 'ocean', name: 'Ocean', type: 'linear', colors: ['#04151f', '#092532', '#050c14'], angle: 120 },
  { id: 'aurora', name: 'Aurora', type: 'linear', colors: ['#051c14', '#072b22', '#06151f'], angle: 145 },
  { id: 'rose', name: 'Rose', type: 'linear', colors: ['#200914', '#380e22', '#12040b'], angle: 160 },
  { id: 'ember', name: 'Ember', type: 'linear', colors: ['#220d06', '#3b1708', '#140602'], angle: 195 },
];

export const SOLID_SWATCHES = [
  { name: 'Pure black (OLED)', hex: '#000000' },
  { name: 'Deep Charcoal', hex: '#0a0a0c' },
  { name: 'Midnight Blue', hex: '#080c14' },
  { name: 'Obsidian Slate', hex: '#0e1117' },
  { name: 'Dark Plum', hex: '#120814' },
  { name: 'Forest Shadow', hex: '#06120b' },
];

/**
 * Clamps a hex color's lightness to <= maxLightness (default 0.22)
 * to ensure background themes remain dark enough for crisp text and clock legibility.
 */
export function clampColorForBackground(hex: string, maxLightness = 0.22, intensity = 1.0): string {
  if (!hex || hex === '#000000' || hex === '#000') return '#000000';
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(clean.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(clean.substring(4, 6), 16) / 255 || 0;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }

  // Clamp lightness to maxLightness (e.g. 22%)
  const clampedL = Math.min(maxLightness, l) * Math.max(0.1, Math.min(1.0, intensity));

  // Convert HSL back to RGB
  const c = (1 - Math.abs(2 * clampedL - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = clampedL - c / 2;
  let rFinal = 0,
    gFinal = 0,
    bFinal = 0;

  if (h >= 0 && h < 60) {
    rFinal = c;
    gFinal = x;
    bFinal = 0;
  } else if (h >= 60 && h < 120) {
    rFinal = x;
    gFinal = c;
    bFinal = 0;
  } else if (h >= 120 && h < 180) {
    rFinal = 0;
    gFinal = c;
    bFinal = x;
  } else if (h >= 180 && h < 240) {
    rFinal = 0;
    gFinal = x;
    bFinal = c;
  } else if (h >= 240 && h < 300) {
    rFinal = x;
    gFinal = 0;
    bFinal = c;
  } else {
    rFinal = c;
    gFinal = 0;
    bFinal = x;
  }

  const rByte = Math.round((rFinal + m) * 255);
  const gByte = Math.round((gFinal + m) * 255);
  const bByte = Math.round((bFinal + m) * 255);

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(rByte)}${toHex(gByte)}${toHex(bByte)}`;
}

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

  // Ambient Moving Light (Phase 2)
  ambientMotionMode: AmbientMotionMode;
  ambientStyle: AmbientStyle;
  ambientIntensity: number; // 0.2 to 2.0 (default 1.0)
  ambientMotionSpeed: number; // 0.2 to 2.0 (default 1.0)
  ambientBeatReaction: number; // 0.0 to 2.0 (default 1.0)
  ambientBeatSensitivity: number; // 0 to 100 (default 65)

  // Background Theme (Phase 3)
  bgMode: BackgroundMode;
  bgSolidColor: string; // default '#000000'
  bgGradientType: GradientType; // 'linear' | 'radial'
  bgGradientAngle: number; // 0 to 360 degrees
  bgGradientColors: string[]; // 2-3 colors
  bgGradientPreset: string; // preset id or 'custom'
  bgIntensity: number; // 0.1 to 1.0 (default 1.0)

  // Effects & Lyrics Tinting (Phase 4)
  tintLyricsWithAccent: boolean; // default true
  rippleEnabled: boolean; // default true
  rippleStyle: RippleStyle; // 'rings' | 'pulse-only' | 'rings-pulse' (default 'rings-pulse')
  rippleSize: number; // 0.5 to 2.0 (default 1.0)
  rippleSpeed: number; // 0.5 to 2.0 (default 1.0)
  rippleColor: RippleColor; // 'accent' | 'white' (default 'accent')
  rippleShimmer: boolean; // default false

  // Adaptive Quality & Performance (Phase 5)
  visualQuality: VisualQuality; // 'auto' | 'high' | 'medium' | 'low' | 'minimal' (default 'auto')
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

  // Ambient Moving Light (Phase 2)
  ambientMotionMode: 'beat',
  ambientStyle: 'rim-bloom',
  ambientIntensity: 1.0,
  ambientMotionSpeed: 1.0,
  ambientBeatReaction: 1.0,
  ambientBeatSensitivity: 65,

  // Background Theme (Phase 3)
  bgMode: 'solid',
  bgSolidColor: '#000000',
  bgGradientType: 'linear',
  bgGradientAngle: 135,
  bgGradientColors: ['#090a0f', '#181b26', '#0d1117'],
  bgGradientPreset: 'midnight',
  bgIntensity: 1.0,

  // Effects & Lyrics Tinting (Phase 4)
  tintLyricsWithAccent: true,
  rippleEnabled: true,
  rippleStyle: 'rings-pulse',
  rippleSize: 1.0,
  rippleSpeed: 1.0,
  rippleColor: 'accent',
  rippleShimmer: false,

  // Adaptive Quality & Performance (Phase 5)
  visualQuality: 'auto',
};

export interface AppearancePreset {
  id: string;
  name: string;
  description: string;
  config: Partial<AppearanceConfig>;
}

export const APPEARANCE_PRESETS: AppearancePreset[] = [
  {
    id: 'late-night',
    name: 'Late night',
    description: 'Pure black OLED, beat-synced rim & bloom, tinted lyrics, active word ripples',
    config: {
      bgMode: 'solid',
      bgSolidColor: '#000000',
      ambientMotionMode: 'beat',
      ambientStyle: 'rim-bloom',
      tintLyricsWithAccent: true,
      rippleEnabled: true,
      rippleStyle: 'rings-pulse',
      rippleColor: 'accent',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Drifting organic mesh background with ethereal cyan/emerald bloom and beat waves',
    config: {
      bgMode: 'mesh',
      ambientMotionMode: 'beat',
      ambientStyle: 'rim-bloom',
      tintLyricsWithAccent: true,
      rippleEnabled: true,
      rippleStyle: 'rings-pulse',
      rippleColor: 'accent',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm twilight gradient background with radiant golden glow and active ripples',
    config: {
      bgMode: 'gradient',
      bgGradientPreset: 'sunset',
      bgGradientType: 'linear',
      bgGradientAngle: 180,
      bgGradientColors: ['#230b1e', '#3b1024', '#150616'],
      ambientMotionMode: 'beat',
      ambientStyle: 'rim-bloom',
      tintLyricsWithAccent: true,
      rippleEnabled: true,
      rippleStyle: 'rings-pulse',
      rippleColor: 'accent',
    },
  },
  {
    id: 'mono',
    name: 'Mono',
    description: 'Pure black OLED with calm crisp white perimeter rim and neutral lyrics',
    config: {
      bgMode: 'solid',
      bgSolidColor: '#000000',
      ambientMotionMode: 'calm',
      ambientStyle: 'rim-only',
      tintLyricsWithAccent: false,
      rippleEnabled: false,
    },
  },
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
      tintLyricsWithAccent: true,
      rippleEnabled: true,
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

