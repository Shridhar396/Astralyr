/**
 * Astralyr Pro Proprietary Modules - Interfaces
 */

export interface ProTranscriptionResult {
  timestamps: Array<{ time: number; text: string }>;
  confidence: number;
  engine: string;
}

export interface IProEngine {
  isProEngineActive(): boolean;
  getProEngineVersion(): string;
  transcribeAudio(buffer: ArrayBuffer): Promise<ProTranscriptionResult>;
  getHighPrecisionBeatClock(currentTime: number, bpm: number): { phase: number; nextBeatTime: number };
}
