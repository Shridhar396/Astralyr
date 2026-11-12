export interface RadioStation {
  id: string;
  name: string;
  genre: 'Lofi Chill' | 'Synthwave' | 'Ambient Space' | 'Vaporwave' | 'Chillout / Drone';
  tagline: string;
  streamUrl: string;
  bitrate: string;
  primaryColor: string;
  secondaryColor: string;
  accentGlow: string;
}

export type PlaybackState = 'idle' | 'connecting' | 'playing' | 'paused' | 'error';

export interface AudioVisualizerData {
  frequencyData: Uint8Array;
  timeData: Uint8Array;
  binCount: number;
  averageFrequency: number;
  subBassEnergy: number; // 0–60Hz sub-bass energy
  bassEnergy: number;
  midEnergy: number;
  trebleEnergy: number;
  isBeat: boolean;
  peakDb: number;
}

