/**
 * Astralyr Pro Stubs for Public Web Edition
 * Zero proprietary code or Pro signatures.
 */

import { IProEngine, ProTranscriptionResult } from './types';

export class ProEngineStub implements IProEngine {
  isProEngineActive(): boolean {
    return false;
  }

  getProEngineVersion(): string {
    return 'free-web';
  }

  async transcribeAudio(_buffer: ArrayBuffer): Promise<ProTranscriptionResult> {
    throw new Error('Auto-timing and transcription are available exclusively in Astralyr Desktop Pro.');
  }

  getHighPrecisionBeatClock(currentTime: number, bpm: number): { phase: number; nextBeatTime: number } {
    const beatInterval = 60 / Math.max(30, bpm);
    const phase = (currentTime % beatInterval) / beatInterval;
    return { phase, nextBeatTime: currentTime + (1 - phase) * beatInterval };
  }
}

export const proEngineInstance = new ProEngineStub();
