export interface TimedWord {
  text: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
}

export interface LyricLine {
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
  words: TimedWord[];
}

export interface ConstellationStarNode {
  id: string;
  word: string;
  startTime: number;
  endTime: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  baseX: number;
  baseY: number;
  driftAngle: number;
  driftSpeed: number;
  scale: number;
  targetScale: number;
  brightness: number;
  targetBrightness: number;
  starRotation: number;
  starSize: number;
  isWordHit: boolean;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  duration: number; // seconds
  audioUrl: string;
  rawLrc?: string;
  primaryColor: string;
  secondaryColor: string;
  accentGlow: string;
}

