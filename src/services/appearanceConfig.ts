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
export type AmbientStyle = 'sliding' | 'off';

export type AmbientLightStyle = 'sliding' | 'off';
export type BackgroundMode = 'solid' | 'gradient' | 'custom' | 'wallpaper' | 'album' | 'mesh';
export type GradientType = 'linear' | 'radial' | 'conic';

export type VisualQuality = 'auto' | 'high' | 'medium' | 'low' | 'minimal';

export interface GradientPreset {
  id: string;
  name: string;
  category: 'Dark' | 'Neon' | 'Sunset' | 'Ocean' | 'Aurora' | 'Pastel' | 'Mono';
  type: GradientType;
  colors: string[];
  angle: number;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  // Dark
  { id: 'midnight', name: 'Midnight', category: 'Dark', type: 'linear', colors: ['#090a0f', '#181b26', '#0d1117'], angle: 135 },
  { id: 'deep-space', name: 'Deep Space', category: 'Dark', type: 'linear', colors: ['#03050a', '#0a1128', '#000411'], angle: 150 },
  { id: 'forest', name: 'Forest', category: 'Dark', type: 'linear', colors: ['#091c10', '#0f2e1a', '#06130b'], angle: 135 },
  { id: 'dusk', name: 'Dusk', category: 'Dark', type: 'linear', colors: ['#1d0d26', '#2d143b', '#120718'], angle: 160 },
  { id: 'twilight-mist', name: 'Twilight Mist', category: 'Dark', type: 'linear', colors: ['#141824', '#1f2436', '#0e1019'], angle: 120 },

  // Neon
  { id: 'cyber-neon', name: 'Cyber Neon', category: 'Neon', type: 'linear', colors: ['#1f082e', '#2d0a3d', '#082032'], angle: 135 },
  { id: 'synthwave', name: 'Synthwave', category: 'Neon', type: 'linear', colors: ['#2b0826', '#3d0c36', '#0d1b3a'], angle: 145 },
  { id: 'neon-glow', name: 'Neon Glow', category: 'Neon', type: 'linear', colors: ['#0a2024', '#0d3238', '#290a2a'], angle: 180 },
  { id: 'cosmic-velvet', name: 'Cosmic Velvet', category: 'Neon', type: 'linear', colors: ['#1a0b2e', '#281145', '#0f061c'], angle: 125 },

  // Sunset
  { id: 'sunset', name: 'Sunset', category: 'Sunset', type: 'linear', colors: ['#230b1e', '#3b1024', '#150616'], angle: 180 },
  { id: 'ember', name: 'Ember', category: 'Sunset', type: 'linear', colors: ['#220d06', '#3b1708', '#140602'], angle: 195 },
  { id: 'rose', name: 'Rose Gold', category: 'Sunset', type: 'linear', colors: ['#2d0f1e', '#42152b', '#1a0711'], angle: 160 },
  { id: 'rose-gold', name: 'Rose Gold', category: 'Sunset', type: 'linear', colors: ['#2d0f1e', '#42152b', '#1a0711'], angle: 160 },
  { id: 'coral', name: 'Coral', category: 'Sunset', type: 'linear', colors: ['#2d1114', '#40191d', '#19080a'], angle: 140 },

  // Ocean
  { id: 'ocean', name: 'Ocean', category: 'Ocean', type: 'linear', colors: ['#04151f', '#092532', '#050c14'], angle: 120 },
  { id: 'abyss', name: 'Abyss', category: 'Ocean', type: 'linear', colors: ['#020b14', '#071a2c', '#01070e'], angle: 170 },
  { id: 'emerald-isle', name: 'Emerald Isle', category: 'Ocean', type: 'linear', colors: ['#051d14', '#0b2e21', '#04140e'], angle: 135 },
  { id: 'ice', name: 'Ice', category: 'Ocean', type: 'linear', colors: ['#0c1924', '#122536', '#091119'], angle: 130 },

  // Aurora
  { id: 'aurora', name: 'Aurora', category: 'Aurora', type: 'linear', colors: ['#051c14', '#072b22', '#06151f'], angle: 145 },
  { id: 'northern-lights', name: 'Northern Lights', category: 'Aurora', type: 'linear', colors: ['#03181b', '#062828', '#08321d'], angle: 160 },

  // Pastel
  { id: 'lavender', name: 'Lavender', category: 'Pastel', type: 'linear', colors: ['#191428', '#271e3d', '#110d1c'], angle: 135 },
  { id: 'peach', name: 'Peach', category: 'Pastel', type: 'linear', colors: ['#281514', '#3b201d', '#1a0d0c'], angle: 155 },
  { id: 'mint', name: 'Mint', category: 'Pastel', type: 'linear', colors: ['#0e241c', '#16362b', '#091a13'], angle: 140 },

  // Mono
  { id: 'graphite', name: 'Graphite', category: 'Mono', type: 'linear', colors: ['#121316', '#1a1c21', '#0d0e10'], angle: 135 },
  { id: 'carbon', name: 'Carbon', category: 'Mono', type: 'linear', colors: ['#08090a', '#111215', '#050506'], angle: 180 },
  { id: 'obsidian-noir', name: 'Obsidian Noir', category: 'Mono', type: 'linear', colors: ['#050507', '#0c0d12', '#000000'], angle: 145 },
];

export interface CustomGradientStop {
  id: string;
  color: string;
  position: number; // 0.0 to 1.0
}

export interface CustomGradientConfig {
  type: 'linear' | 'radial' | 'conic';
  angle: number; // 0 to 360
  centerX: number; // 0 to 100%
  centerY: number; // 0 to 100%
  stops: CustomGradientStop[];
  smooth: boolean;
  grain: number; // 0 to 10%
  animated: boolean; // slow drift
}

export interface WallpaperConfig {
  id?: string;
  url?: string;
  fit: 'cover' | 'contain' | 'stretch' | 'center' | 'tile';
  zoom: number; // 100 to 300%
  offsetX: number; // -100 to 100%
  offsetY: number; // -100 to 100%
  blur: number; // 0 to 60px
  dim: number; // 0 to 90% (default 40%)
  saturation: number; // 0 to 200% (default 100%)
  contrast: number; // 50 to 150% (default 100%)
  tintColor: string; // hex
  tintOpacity: number; // 0 to 100%
  useAlbumArt: boolean;
}

export const DEFAULT_CUSTOM_GRADIENT: CustomGradientConfig = {
  type: 'linear',
  angle: 135,
  centerX: 50,
  centerY: 50,
  stops: [
    { id: 'stop-1', color: '#090a0f', position: 0.0 },
    { id: 'stop-2', color: '#1f132b', position: 0.35 },
    { id: 'stop-3', color: '#2a1220', position: 0.7 },
    { id: 'stop-4', color: '#0d1117', position: 1.0 },
  ],
  smooth: true,
  grain: 2,
  animated: false,
};

export const DEFAULT_WALLPAPER_CONFIG: WallpaperConfig = {
  fit: 'cover',
  zoom: 100,
  offsetX: 0,
  offsetY: 0,
  blur: 24,
  dim: 40,
  saturation: 100,
  contrast: 100,
  tintColor: '#000000',
  tintOpacity: 0,
  useAlbumArt: false,
};

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

  // Ambient Moving Light & Sliding Perimeter Light
  ambientMotionMode: AmbientMotionMode;
  ambientStyle: AmbientStyle;
  ambientLightStyle: AmbientLightStyle; // 'sliding' | 'rim-bloom' | 'static-rim' | 'beat-pulse'
  ambientIntensity: number; // 0.2 to 2.0 (default 1.0)
  ambientMotionSpeed: number; // 0.2 to 2.5 (default 1.0)
  ambientBeatReaction: number; // 0.0 to 2.0 (default 1.0)
  ambientBeatSensitivity: number; // 0 to 100 (default 65)
  ambientLightLength: number; // 0.20 to 0.45 (default 0.30 = 30%)
  ambientLightGlowSize: number; // 0.5 to 2.0 (default 1.0)
  ambientLightCount: 1 | 2; // 1 or 2 lights
  ambientLightDirection: 'clockwise' | 'counter-clockwise' | 'alternating';
  ambientBeatSync: boolean; // toggle (default true)

  // Background Theme
  bgMode: BackgroundMode;
  bgSolidColor: string; // default '#000000'
  bgGradientType: GradientType; // 'linear' | 'radial' | 'conic'
  bgGradientAngle: number; // 0 to 360 degrees
  bgGradientColors: string[]; // 2-8 colors
  bgGradientPreset: string; // preset id or 'custom'
  bgIntensity: number; // 0.1 to 1.0 (default 1.0)
  bgDim: number; // manual dim slider 0.0 to 0.9 (default 0.4)
  bgGrain: number; // 0 to 10%
  bgAnimatedGradient: boolean; // toggle (default false)
  customGradient: CustomGradientConfig;
  wallpaper: WallpaperConfig;

  // Effects & Lyrics Tinting
  tintLyricsWithAccent: boolean; // default true

  // Adaptive Quality & Performance
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

  // Ambient Moving Light & Sliding Perimeter Light
  ambientMotionMode: 'beat',
  ambientStyle: 'sliding',
  ambientLightStyle: 'sliding',
  ambientIntensity: 1.0,
  ambientMotionSpeed: 1.0,
  ambientBeatReaction: 1.0,
  ambientBeatSensitivity: 65,
  ambientLightLength: 0.30,
  ambientLightGlowSize: 1.0,
  ambientLightCount: 1,
  ambientLightDirection: 'clockwise',
  ambientBeatSync: true,

  // Background Theme
  bgMode: 'solid',
  bgSolidColor: '#000000',
  bgGradientType: 'linear',
  bgGradientAngle: 135,
  bgGradientColors: ['#090a0f', '#181b26', '#0d1117'],
  bgGradientPreset: 'midnight',
  bgIntensity: 1.0,
  bgDim: 0.4,
  bgGrain: 2,
  bgAnimatedGradient: false,
  customGradient: DEFAULT_CUSTOM_GRADIENT,
  wallpaper: DEFAULT_WALLPAPER_CONFIG,

  // Effects & Lyrics Tinting
  tintLyricsWithAccent: true,

  // Adaptive Quality & Performance
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
    description: 'Pure black OLED, sliding ambient light, tinted lyrics',
    config: {
      bgMode: 'solid',
      bgSolidColor: '#000000',
      ambientMotionMode: 'beat',
      ambientLightStyle: 'sliding',
      tintLyricsWithAccent: true,
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Drifting organic mesh background with ethereal cyan/emerald bloom and beat waves',
    config: {
      bgMode: 'mesh',
      ambientMotionMode: 'beat',
      ambientLightStyle: 'sliding',
      tintLyricsWithAccent: true,
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm twilight gradient background with radiant golden glow',
    config: {
      bgMode: 'gradient',
      bgGradientPreset: 'sunset',
      bgGradientType: 'linear',
      bgGradientAngle: 180,
      bgGradientColors: ['#230b1e', '#3b1024', '#150616'],
      ambientMotionMode: 'beat',
      ambientLightStyle: 'sliding',
      tintLyricsWithAccent: true,
    },
  },
  {
    id: 'mono',
    name: 'Mono',
    description: 'Pure black OLED with calm crisp white sliding light and neutral lyrics',
    config: {
      bgMode: 'solid',
      bgSolidColor: '#000000',
      ambientMotionMode: 'calm',
      ambientLightStyle: 'sliding',
      tintLyricsWithAccent: false,
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
    // Clear legacy rim / ambient localStorage keys
    try {
      localStorage.removeItem('astralyr_ambient_style');
      localStorage.removeItem('constella_ambient_style');
      localStorage.removeItem('ambient_style');
      localStorage.removeItem('astralyr_static_rim');
    } catch {}

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Clean up legacy rim / static-rim / beat-pulse values
      if (
        parsed.ambientLightStyle === 'static-rim' ||
        parsed.ambientLightStyle === 'rim-bloom' ||
        parsed.ambientLightStyle === 'beat-pulse'
      ) {
        parsed.ambientLightStyle = 'sliding';
      }
      if (parsed.ambientStyle && parsed.ambientStyle !== 'sliding' && parsed.ambientStyle !== 'off') {
        parsed.ambientStyle = parsed.ambientLightStyle === 'off' ? 'off' : 'sliding';
      }
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

