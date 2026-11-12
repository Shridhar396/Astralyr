export type VisualizerMode = 
  | 'ambient-waveform'
  | 'cyberpunk-bars'
  | 'circular-halo'
  | 'neon-grid';

export type DesktopWindowMode = 'normal' | 'wallpaper' | 'theatre' | 'overlay';

export interface VisualizerSettings {
  mode: VisualizerMode;
  borderThickness: number; // 2px to 32px
  glowSpread: number;      // 10px to 100px
  beatSensitivity: number; // 1.0 to 2.5
  beatGlowMultiplier: number; // 1.1 to 2.5
  fpsLimit: number;        // 60
  barSpacing: number;
  waveformSmoothness: number;
  particleCount: number;
  showParticles: boolean;
  colorSyncWithStation: boolean;
  customPrimaryColor: string;
  customSecondaryColor: string;
}

export interface DesktopModeState {
  mode: DesktopWindowMode;
  isClickThrough: boolean;
  isHUDVisible: boolean;
}

