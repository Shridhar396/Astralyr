import { describe, it, expect } from 'vitest';
import { BeatEngine } from '../beat';

describe('Genre Beat Benchmark (EDM, Hip-hop, Slow Acoustic, Bollywood)', () => {
  const sampleRate = 44100;
  const fftSize = 1024;
  const binCount = fftSize / 2;
  const binWidth = sampleRate / fftSize; // ~43.07 Hz

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

  function simulateGenreTrack(
    genre: 'edm' | 'hiphop' | 'acoustic' | 'bollywood',
    targetBpm: number,
    durationSec = 7.0
  ): { bpm: number; confidence: number } {
    const engine = new BeatEngine({ sampleRate, fftSize, sensitivity: 65 });
    const beatInterval = 60 / targetBpm;
    const fps = 60;
    const frameDt = 1 / fps;
    const totalFrames = Math.floor(durationSec * fps);

    let finalBpm = 0;
    let finalConfidence = 0;

    for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
      const t = frameIdx * frameDt;
      const beatIdx = Math.floor(t / beatInterval);
      const timeSinceBeat = t % beatInterval;
      const barBeat = beatIdx % 4; // 0, 1, 2, 3

      let isKick = false;
      let isSnare = false;
      let isHat = false;

      if (genre === 'edm') {
        // 128 BPM: Kick on every beat, snare on 1 & 3, hat on 0.5
        isKick = timeSinceBeat < 0.05;
        isSnare = (barBeat === 1 || barBeat === 3) && timeSinceBeat < 0.04;
        isHat = Math.abs(timeSinceBeat - beatInterval * 0.5) < 0.03;
      } else if (genre === 'hiphop') {
        // 90 BPM: Kick on beat 0 and syncopated beat 2.5; snare on beats 1 and 3
        const isBeat0Kick = barBeat === 0 && timeSinceBeat < 0.06;
        const isSyncKick = barBeat === 2 && Math.abs(timeSinceBeat - beatInterval * 0.5) < 0.06;
        isKick = isBeat0Kick || isSyncKick;
        isSnare = (barBeat === 1 || barBeat === 3) && timeSinceBeat < 0.05;
      } else if (genre === 'acoustic') {
        // 72 BPM: Rhythmic acoustic guitar strum on each beat (bass tap + mids)
        isKick = (barBeat === 0 || barBeat === 2) && timeSinceBeat < 0.06;
        isSnare = (barBeat === 1 || barBeat === 3) && timeSinceBeat < 0.05;
      } else if (genre === 'bollywood') {
        // 110 BPM: Dhol rhythm (Dha on 0, Dhin on 1, Dha on 2, Dhin on 3)
        isKick = (barBeat === 0 || barBeat === 2) && timeSinceBeat < 0.055;
        isSnare = (barBeat === 1 || barBeat === 3) && timeSinceBeat < 0.045;
      }

      let subBass = 0.04;
      let bass = 0.05;
      let mids = 0.06;
      let highs = 0.03;

      if (isKick) {
        subBass = 0.95;
        bass = 0.92;
        mids = 0.35;
      }
      if (isSnare) {
        bass = Math.max(bass, 0.45);
        mids = Math.max(mids, 0.85);
        highs = Math.max(highs, 0.7);
      }
      if (isHat) {
        highs = Math.max(highs, 0.65);
      }

      const frame = createFrame({ subBass, bass, mids, highs, noise: 0.02 });
      const state = engine.process(frame, t);

      if (t >= 5.0) {
        finalBpm = state.bpm;
        finalConfidence = state.confidence;
      }
    }

    return { bpm: finalBpm, confidence: finalConfidence };
  }

  it('detects EDM (Cyber Neon Beats / 128 BPM) with high confidence', () => {
    const res = simulateGenreTrack('edm', 128, 7.5);
    console.log(`[Genre Benchmark] EDM 128 BPM -> Detected BPM: ${res.bpm}, Confidence: ${(res.confidence * 100).toFixed(1)}%`);
    expect(res.bpm).toBeGreaterThanOrEqual(125);
    expect(res.bpm).toBeLessThanOrEqual(131);
    expect(res.confidence).toBeGreaterThan(0.65);
  });

  it('detects Hip-Hop (Boom Bap / 90 BPM) with high confidence', () => {
    const res = simulateGenreTrack('hiphop', 90, 7.5);
    console.log(`[Genre Benchmark] Hip-Hop 90 BPM -> Detected BPM: ${res.bpm}, Confidence: ${(res.confidence * 100).toFixed(1)}%`);
    expect(res.bpm).toBeGreaterThanOrEqual(87);
    expect(res.bpm).toBeLessThanOrEqual(93);
    expect(res.confidence).toBeGreaterThan(0.5);
  });

  it('detects Slow Acoustic (Fingerstyle / 72 BPM) with high confidence', () => {
    const res = simulateGenreTrack('acoustic', 72, 7.5);
    console.log(`[Genre Benchmark] Slow Acoustic 72 BPM -> Detected BPM: ${res.bpm}, Confidence: ${(res.confidence * 100).toFixed(1)}%`);
    expect(res.bpm).toBeGreaterThanOrEqual(69);
    expect(res.bpm).toBeLessThanOrEqual(75);
    expect(res.confidence).toBeGreaterThan(0.55);
  });

  it('detects Bollywood (Dhol Beats / 110 BPM) with high confidence', () => {
    const res = simulateGenreTrack('bollywood', 110, 7.5);
    console.log(`[Genre Benchmark] Bollywood 110 BPM -> Detected BPM: ${res.bpm}, Confidence: ${(res.confidence * 100).toFixed(1)}%`);
    expect(res.bpm).toBeGreaterThanOrEqual(107);
    expect(res.bpm).toBeLessThanOrEqual(113);
    expect(res.confidence).toBeGreaterThan(0.6);
  });
});
