import { describe, it, expect, beforeEach } from 'vitest';
import { BeatEngine } from '../beat';

describe('BeatEngine (Phase 1)', () => {
  let engine: BeatEngine;
  const sampleRate = 44100;
  const fftSize = 1024;
  const binCount = fftSize / 2;
  const binWidth = sampleRate / fftSize; // ~43.07 Hz

  beforeEach(() => {
    engine = new BeatEngine({ sampleRate, fftSize, sensitivity: 65 });
  });

  // Helper to create a frequency frame
  function createFrame(options: {
    subBass?: number;
    bass?: number;
    mids?: number;
    highs?: number;
    noise?: number;
  }): Uint8Array {
    const frame = new Uint8Array(binCount);
    const { subBass = 0, bass = 0, mids = 0, highs = 0, noise = 0 } = options;

    for (let i = 0; i < binCount; i++) {
      const freq = i * binWidth;
      let val = 0;

      if (freq <= 80) {
        val = Math.max(val, subBass * 255);
      } else if (freq > 80 && freq <= 250) {
        val = Math.max(val, bass * 255);
      } else if (freq > 250 && freq <= 2000) {
        val = Math.max(val, mids * 255);
      } else if (freq > 2000 && freq <= 12000) {
        val = Math.max(val, highs * 255);
      }

      if (noise > 0) {
        val = Math.min(255, val + Math.random() * noise * 255);
      }

      frame[i] = Math.round(val);
    }
    return frame;
  }

  describe('Synthetic Click Tracks at 90, 120, 150 BPM', () => {
    const tempos = [90, 120, 150];

    tempos.forEach((targetBpm) => {
      it(`detects ${targetBpm} BPM within +-3 BPM and beat timing within 40ms`, () => {
        engine.reset();
        const beatInterval = 60 / targetBpm;
        const totalDuration = 7.0; // 7 seconds
        const fps = 60;
        const frameDt = 1 / fps;
        const totalFrames = Math.floor(totalDuration * fps);

        let detectedBeats: number[] = [];
        let finalBpm = 0;
        let finalConfidence = 0;

        for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
          const t = frameIdx * frameDt;
          const timeSinceLastBeat = t % beatInterval;

          // Onset pulse lasts ~50ms (3 frames)
          const isClick = timeSinceLastBeat < 0.05;
          const frame = createFrame(
            isClick
              ? { subBass: 0.95, bass: 0.9, mids: 0.4, highs: 0.1 }
              : { subBass: 0.05, bass: 0.05, mids: 0.05, highs: 0.02 }
          );

          const state = engine.process(frame, t);

          if (state.isBeat && t > 1.0) {
            // Record beat timing
            detectedBeats.push(t);
          }

          if (t >= 5.5) {
            finalBpm = state.bpm;
            finalConfidence = state.confidence;
          }
        }

        // 1. Assert BPM within +-3
        expect(finalBpm).toBeGreaterThanOrEqual(targetBpm - 3);
        expect(finalBpm).toBeLessThanOrEqual(targetBpm + 3);

        // 2. Assert confidence is high for rhythmic click track
        expect(finalConfidence).toBeGreaterThan(0.45);

        // 3. Assert beat timing within 40ms (0.040s)
        expect(detectedBeats.length).toBeGreaterThan(5);
        for (const beatTime of detectedBeats.slice(-5)) {
          // Expected nearest true click time
          const nearestExpected = Math.round(beatTime / beatInterval) * beatInterval;
          const diffMs = Math.abs(beatTime - nearestExpected) * 1000;
          expect(diffMs).toBeLessThanOrEqual(40);
        }
      });
    });
  });

  describe('Silence Gaps and Phase Clock Cadence', () => {
    it('maintains beat cadence and phase clock through silence gaps', () => {
      engine.reset();
      const targetBpm = 120;
      const beatInterval = 60 / targetBpm; // 0.5s
      const fps = 60;
      const frameDt = 1 / fps;

      // 1. Play 120 BPM track for 4.5 seconds to lock tempo and phase
      for (let t = 0; t <= 4.5; t += frameDt) {
        const timeSinceBeat = t % beatInterval;
        const isClick = timeSinceBeat < 0.05;
        const frame = createFrame(
          isClick
            ? { subBass: 0.9, bass: 0.85, mids: 0.3 }
            : { subBass: 0.04, bass: 0.03 }
        );
        engine.process(frame, t);
      }

      const stateBeforeSilence = engine.getState();
      expect(stateBeforeSilence.bpm).toBeCloseTo(120, -1);
      expect(stateBeforeSilence.confidence).toBeGreaterThan(0.35);

      // 2. Introduce 1.5 seconds of total silence (t = 4.5 to 6.0s)
      const silentFrame = new Uint8Array(binCount); // All zeros
      let predictedBeatsDuringSilence: number[] = [];

      for (let t = 4.5 + frameDt; t <= 6.0; t += frameDt) {
        const state = engine.process(silentFrame, t);
        if (state.isBeat) {
          predictedBeatsDuringSilence.push(t);
        }
      }

      // Expected clicks at 5.0s, 5.5s, 6.0s
      expect(predictedBeatsDuringSilence.length).toBeGreaterThanOrEqual(2);
      for (const beatTime of predictedBeatsDuringSilence) {
        const nearestExpected = Math.round(beatTime / beatInterval) * beatInterval;
        const diffMs = Math.abs(beatTime - nearestExpected) * 1000;
        // Phase clock keeps timing within 40ms even without audio input!
        expect(diffMs).toBeLessThanOrEqual(40);
      }
    });
  });

  describe('White Noise & Uncorrelated Audio', () => {
    it('reports low confidence (<0.35) for pure white noise', () => {
      engine.reset();
      const fps = 60;
      const frameDt = 1 / fps;
      const frame = new Uint8Array(binCount);

      let maxConfidence = 0;

      for (let t = 0; t <= 4.0; t += frameDt) {
        // Fill completely random noise
        for (let i = 0; i < binCount; i++) {
          frame[i] = Math.floor(Math.random() * 180);
        }

        const state = engine.process(frame, t);
        if (t > 1.5) {
          maxConfidence = Math.max(maxConfidence, state.confidence);
        }
      }

      // White noise must produce low confidence
      expect(maxConfidence).toBeLessThan(0.35);
    });
  });

  describe('Band Isolation & Attack/Release Envelopes', () => {
    it('isolates sub-bass and bass separately', () => {
      engine.reset();
      // Pure sub-bass frame (50Hz)
      const subBassFrame = createFrame({ subBass: 0.9, bass: 0.0, mids: 0.0, highs: 0.0 });
      const state1 = engine.process(subBassFrame, 0.05);

      expect(state1.subBass).toBeGreaterThan(0.6);
      expect(state1.mids).toBeLessThan(0.1);
      expect(state1.highs).toBeLessThan(0.1);

      // Pure highs frame (6000Hz)
      const highsFrame = createFrame({ subBass: 0.0, bass: 0.0, mids: 0.0, highs: 0.85 });
      const state2 = engine.process(highsFrame, 0.1);

      expect(state2.highs).toBeGreaterThan(0.6);
      expect(state2.subBass).toBeLessThan(0.1);
    });

    it('smooths bass with fast attack and gradual release', () => {
      engine.reset();
      // Fast attack: jump to 1.0 at t=0.02
      const fullBass = createFrame({ bass: 1.0 });
      engine.process(fullBass, 0.02);
      const afterAttack = engine.getState().smoothedBass;
      expect(afterAttack).toBeGreaterThan(0.4);

      // Release: zero input at t=0.10
      const zeroFrame = new Uint8Array(binCount);
      engine.process(zeroFrame, 0.1);
      const duringRelease = engine.getState().smoothedBass;
      expect(duringRelease).toBeGreaterThan(0.15); // Release takes ~250ms
      expect(duringRelease).toBeLessThan(afterAttack);
    });
  });
});
