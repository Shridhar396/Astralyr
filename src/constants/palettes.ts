export interface ColorPalette {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

export const PRESET_PALETTES: ColorPalette[] = [
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    primary: '#00f2fe',
    secondary: '#fe019a',
    accent: 'rgba(0, 242, 254, 0.8)',
  },
  {
    id: 'synthwave-sunset',
    name: 'Synthwave Sunset',
    primary: '#f43f5e',
    secondary: '#fb923c',
    accent: 'rgba(244, 63, 94, 0.8)',
  },
  {
    id: 'electric-violet',
    name: 'Electric Violet',
    primary: '#a855f7',
    secondary: '#ec4899',
    accent: 'rgba(168, 85, 247, 0.8)',
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean Blue',
    primary: '#38bdf8',
    secondary: '#6366f1',
    accent: 'rgba(56, 189, 248, 0.8)',
  },
  {
    id: 'matrix-emerald',
    name: 'Matrix Emerald',
    primary: '#10b981',
    secondary: '#06b6d4',
    accent: 'rgba(16, 185, 129, 0.8)',
  },
  {
    id: 'solar-gold',
    name: 'Solar Amber',
    primary: '#fbbf24',
    secondary: '#ea580c',
    accent: 'rgba(251, 191, 36, 0.8)',
  },
];

