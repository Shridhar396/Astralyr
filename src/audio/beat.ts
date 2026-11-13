export interface BeatState {
  // Raw instantaneous energy in bands (0-1)
  subBass: number;
  bass: number;
  mids: number;
  highs: number;

  // Smoothed energies with discrete attack/release envelopes (0-1)
  smoothedSubBass: number;
  smoothedBass: number;
  smoothedMids: number;
  smoothedHighs: number;
  smoothedEnergy: number;

  // Detected events on the current frame
  isBeat: boolean;
  beatStrength: number;
  isKick: boolean;
  isSnare: boolean;

  // Tempo and Phase Clock
  bpm: number;
  confidence: number;
  phase: number; // 0.0 at beat onset to ~1.0 just before next beat

  // Build / Drop tracking
  buildDropSignal: 'none' | 'building' | 'drop';
  dropProgress: number; // 0 to 1 during 1.2s drop swell
}

export interface BeatEngineOptions {
  sampleRate?: number;
  fftSize?: number;
  sensitivity?: number; // 0-100
}

export class BeatEngine {
  public sampleRate: number;
  public fftSize: number;
  public binCount: number;
  public sensitivity: number; // 0-100

  // Pre-allocated typed arrays (Zero per-frame allocations)
  private frequencyData: Uint8Array;
  private prevFreqData: Float32Array;
  private binWidth: number;

  // Band bin indices
  private subBassStart: number;
  private subBassEnd: number;
  private bassStart: number;
  private bassEnd: number;
  private midsStart: number;
  private midsEnd: number;
  private highsStart: number;
  private highsEnd: number;
  private fluxEndBin: number; // bass + low-mid bins for spectral flux (~20Hz to ~1000Hz)

  // Envelopes: smoothed values
  private smoothedSubBass = 0;
  private smoothedBass = 0;
  private smoothedMids = 0;
  private smoothedHighs = 0;
  private smoothedEnergy = 0;

  // Attack & Release time constants in seconds
  // Bass: attack 20ms, release 250ms
  private readonly subBassAttack = 0.025;
  private readonly subBassRelease = 0.28;
  private readonly bassAttack = 0.02;
  private readonly bassRelease = 0.25;
  private readonly midsAttack = 0.03;
  private readonly midsRelease = 0.2;
  private readonly highsAttack = 0.015;
  private readonly highsRelease = 0.15;
  private readonly energyAttack = 0.03;
  private readonly energyRelease = 0.3;

  // Spectral Flux & Adaptive Threshold
  // ~1.5s window at 60fps = 90 frames
  private static readonly FLUX_HISTORY_LEN = 90;
  private fluxHistory = new Float32Array(BeatEngine.FLUX_HISTORY_LEN);
  private fluxHistoryIdx = 0;
  private fluxCount = 0;
  private lastOnsetTime = -10.0;
  private readonly minOnsetGap = 0.18; // 180ms min gap between raw onsets

  // Tempo tracking via Inter-Onset Intervals (IOI) over the last 8.0s
  private static readonly MAX_ONSET_HISTORY = 128;
  private onsetTimes = new Float32Array(BeatEngine.MAX_ONSET_HISTORY);
  private onsetStrengths = new Float32Array(BeatEngine.MAX_ONSET_HISTORY);
  private onsetCount = 0;
  private lastTempoCalcTime = -10.0;
  private readonly tempoUpdateInterval = 0.25; // Recomputed ~4 times per second

  // BPM & Phase Clock
  private bpm = 120;
  private confidence = 0.0;
  private phase = 0.0;
  private lastPhaseBeatTime = 0.0;
  private lastBeatTimestamp = 0.0;
  private beatInterval = 60 / 120; // 0.5s for 120 BPM
  private prevFramePhase = 0.0;

  // Build / Drop tracking
  private buildDropState: 'none' | 'building' | 'drop' = 'none';
  private dropStartTime = -10.0;
  private mediumEnergy = 0.0; // ~4s moving baseline
  private buildStartTime = -10.0;

  // Timing
  private lastProcessTime = 0;

  // Reusable state object to prevent any garbage collection in hot loop
  private readonly state: BeatState = {
    subBass: 0,
    bass: 0,
    mids: 0,
    highs: 0,
    smoothedSubBass: 0,
    smoothedBass: 0,
    smoothedMids: 0,
    smoothedHighs: 0,
    smoothedEnergy: 0,
    isBeat: false,
    beatStrength: 0,
    isKick: false,
    isSnare: false,
    bpm: 120,
    confidence: 0,
    phase: 0,
    buildDropSignal: 'none',
    dropProgress: 0,
  };

  constructor(options: BeatEngineOptions = {}) {
    this.sampleRate = options.sampleRate || 44100;
    this.fftSize = options.fftSize || 1024;
    this.binCount = this.fftSize / 2;
    this.sensitivity = options.sensitivity !== undefined ? options.sensitivity : 65;

    this.frequencyData = new Uint8Array(this.binCount);
    this.prevFreqData = new Float32Array(this.binCount);
    this.binWidth = this.sampleRate / this.fftSize;

    // Calculate band bin ranges based on binWidth
    this.subBassStart = Math.max(0, Math.floor(20 / this.binWidth));
    this.subBassEnd = Math.max(this.subBassStart + 1, Math.ceil(80 / this.binWidth));

    this.bassStart = this.subBassEnd;
    this.bassEnd = Math.max(this.bassStart + 1, Math.ceil(250 / this.binWidth));

    this.midsStart = this.bassEnd;
    this.midsEnd = Math.max(this.midsStart + 1, Math.ceil(2000 / this.binWidth));

    this.highsStart = this.midsEnd;
    this.highsEnd = Math.min(this.binCount, Math.max(this.highsStart + 1, Math.ceil(12000 / this.binWidth)));

    // Spectral flux cutoff: ~1000Hz (bass + low-mid)
    this.fluxEndBin = Math.min(this.binCount, Math.ceil(1000 / this.binWidth));
  }

  public setSensitivity(val: number): void {
    this.sensitivity = Math.max(0, Math.min(100, val));
  }

  public reset(): void {
    this.smoothedSubBass = 0;
    this.smoothedBass = 0;
    this.smoothedMids = 0;
    this.smoothedHighs = 0;
    this.smoothedEnergy = 0;
    this.prevFreqData.fill(0);
    this.fluxHistory.fill(0);
    this.fluxHistoryIdx = 0;
    this.fluxCount = 0;
    this.lastOnsetTime = -10.0;
    this.onsetCount = 0;
    this.lastTempoCalcTime = -10.0;
    this.bpm = 120;
    this.confidence = 0;
    this.phase = 0;
    this.lastPhaseBeatTime = 0;
    this.lastBeatTimestamp = 0;
    this.buildDropState = 'none';
    this.dropStartTime = -10.0;
    this.mediumEnergy = 0.0;
    this.buildStartTime = -10.0;
    this.lastProcessTime = 0;
  }

  /**
   * Main processing method called each frame.
   * Can accept either an AnalyserNode or pre-filled Uint8Array / Float32Array.
   * Zero allocations per call.
   */
  public process(
    input: AnalyserNode | Uint8Array | Float32Array,
    currentTimeSeconds?: number
  ): BeatState {
    const now =
      currentTimeSeconds !== undefined
        ? currentTimeSeconds
        : typeof performance !== 'undefined'
        ? performance.now() / 1000
        : Date.now() / 1000;

    let dt = this.lastProcessTime > 0 ? now - this.lastProcessTime : 1 / 60;
    if (dt <= 0 || dt > 0.5) dt = 1 / 60;
    this.lastProcessTime = now;

    // 1. Fetch frequency data
    if ('getByteFrequencyData' in input && typeof input.getByteFrequencyData === 'function') {
      (input as any).getByteFrequencyData(this.frequencyData);
    } else if (input instanceof Uint8Array) {
      const len = Math.min(input.length, this.binCount);
      for (let i = 0; i < len; i++) {
        this.frequencyData[i] = input[i];
      }
    } else if (input instanceof Float32Array) {
      // If float array is normalized 0-1, scale to 0-255, else clamp
      const len = Math.min(input.length, this.binCount);
      for (let i = 0; i < len; i++) {
        const val = input[i];
        this.frequencyData[i] = val <= 1.0 ? Math.round(val * 255) : Math.min(255, Math.round(val));
      }
    }

    // 2. Compute instantaneous band energies (normalized 0-1)
    let subBassSum = 0;
    for (let i = this.subBassStart; i < this.subBassEnd; i++) {
      subBassSum += this.frequencyData[i];
    }
    const rawSubBass = subBassSum / ((this.subBassEnd - this.subBassStart || 1) * 255);

    let bassSum = 0;
    for (let i = this.bassStart; i < this.bassEnd; i++) {
      bassSum += this.frequencyData[i];
    }
    const rawBass = bassSum / ((this.bassEnd - this.bassStart || 1) * 255);

    let midsSum = 0;
    for (let i = this.midsStart; i < this.midsEnd; i++) {
      midsSum += this.frequencyData[i];
    }
    const rawMids = midsSum / ((this.midsEnd - this.midsStart || 1) * 255);

    let highsSum = 0;
    for (let i = this.highsStart; i < this.highsEnd; i++) {
      highsSum += this.frequencyData[i];
    }
    const rawHighs = highsSum / ((this.highsEnd - this.highsStart || 1) * 255);

    const rawEnergy = rawSubBass * 0.25 + rawBass * 0.35 + rawMids * 0.25 + rawHighs * 0.15;

    // 3. Smooth bands with distinct attack/release envelopes
    this.smoothedSubBass = this.applyEnvelope(
      this.smoothedSubBass,
      rawSubBass,
      dt,
      this.subBassAttack,
      this.subBassRelease
    );
    this.smoothedBass = this.applyEnvelope(
      this.smoothedBass,
      rawBass,
      dt,
      this.bassAttack,
      this.bassRelease
    );
    this.smoothedMids = this.applyEnvelope(
      this.smoothedMids,
      rawMids,
      dt,
      this.midsAttack,
      this.midsRelease
    );
    this.smoothedHighs = this.applyEnvelope(
      this.smoothedHighs,
      rawHighs,
      dt,
      this.highsAttack,
      this.highsRelease
    );
    this.smoothedEnergy = this.applyEnvelope(
      this.smoothedEnergy,
      rawEnergy,
      dt,
      this.energyAttack,
      this.energyRelease
    );

    // 4. Spectral Flux on bass + low-mid bins (half-wave rectified difference)
    let spectralFlux = 0;
    let bassFlux = 0;
    let highFlux = 0;

    for (let i = 0; i < this.binCount; i++) {
      const curr = this.frequencyData[i] / 255;
      const prev = this.prevFreqData[i];
      const diff = curr - prev;
      if (diff > 0) {
        if (i < this.fluxEndBin) {
          spectralFlux += diff;
        }
        if (i >= this.subBassStart && i < this.bassEnd) {
          bassFlux += diff;
        } else if (i >= this.highsStart) {
          highFlux += diff;
        }
      }
      this.prevFreqData[i] = curr;
    }

    // Normalize spectral flux
    spectralFlux = spectralFlux / (this.fluxEndBin || 1);

    // 5. Adaptive Threshold (running mean + k * std over ~1.5s window)
    this.fluxHistory[this.fluxHistoryIdx] = spectralFlux;
    this.fluxHistoryIdx = (this.fluxHistoryIdx + 1) % BeatEngine.FLUX_HISTORY_LEN;
    if (this.fluxCount < BeatEngine.FLUX_HISTORY_LEN) {
      this.fluxCount++;
    }

    let fluxMean = 0;
    for (let i = 0; i < this.fluxCount; i++) {
      fluxMean += this.fluxHistory[i];
    }
    fluxMean /= this.fluxCount;

    let fluxVar = 0;
    for (let i = 0; i < this.fluxCount; i++) {
      const d = this.fluxHistory[i] - fluxMean;
      fluxVar += d * d;
    }
    const fluxStd = Math.sqrt(fluxVar / (this.fluxCount || 1));

    // Sensitivity maps 0-100:
    // Sensitivity 50 -> k = 1.4, relativeSpikeFactor = 1.25
    // Sensitivity 100 -> k = 0.75, relativeSpikeFactor = 1.12 (more sensitive)
    // Sensitivity 0 -> k = 2.2, relativeSpikeFactor = 1.45 (less sensitive)
    const k = 2.2 - (this.sensitivity / 100) * 1.45;
    const minThreshold = 0.02 * (1.5 - (this.sensitivity / 100) * 0.9);
    const relativeSpikeFactor = 1.12 + (1.0 - this.sensitivity / 100) * 0.32;

    // Real onsets must be an actual relative spike above the running average flux
    // This naturally rejects stationary noise floors and flat white noise hiss
    const adaptiveThreshold = Math.max(
      minThreshold,
      fluxMean * relativeSpikeFactor,
      fluxMean + k * fluxStd
    );

    // 6. Onset detection
    let isRawBeat = false;
    let beatStrength = 0;
    let isKick = false;
    let isSnare = false;

    const timeSinceLastOnset = now - this.lastOnsetTime;

    if (spectralFlux > adaptiveThreshold && timeSinceLastOnset >= this.minOnsetGap) {
      isRawBeat = true;
      this.lastOnsetTime = now;

      // Strength 0-1
      const excess = spectralFlux - adaptiveThreshold;
      beatStrength = Math.min(1.0, Math.max(0.2, excess / (fluxStd * 2 + 0.01)));

      // Classify Kick vs Snare/Hat
      // Kick: bass flux dominates or rawBass is significantly elevated
      if (bassFlux > highFlux * 1.25 || (rawBass > 0.4 && bassFlux > 0.02)) {
        isKick = true;
      }
      // Snare: high flux or rawHighs dominates
      if (highFlux > bassFlux * 1.25 && rawHighs > 0.15) {
        isSnare = true;
      }

      // Record onset for tempo tracking
      this.recordOnset(now, beatStrength);
    }

    // 7. Periodic Tempo (BPM) recalculation ~4 times per second
    if (now - this.lastTempoCalcTime >= this.tempoUpdateInterval) {
      this.recalculateTempo(now);
      this.lastTempoCalcTime = now;
    }

    // 8. Beat Phase Clock
    // If tempo is confident, beat phase advances smoothly and generates continuous pulses
    this.beatInterval = 60 / Math.max(60, Math.min(180, this.bpm));

    // Phase: 0 at beat to 1 before next beat
    let currentPhase = 0;
    let isPhaseBeat = false;

    if (this.confidence >= 0.35) {
      // Calculate phase relative to last verified beat
      const elapsedSinceBeat = now - this.lastBeatTimestamp;
      currentPhase = (elapsedSinceBeat / this.beatInterval) % 1.0;
      if (currentPhase < 0) currentPhase += 1.0;

      // Detect wrap-around from ~1.0 to ~0.0
      if (this.prevFramePhase > 0.75 && currentPhase < 0.25) {
        if (now - this.lastPhaseBeatTime > this.beatInterval * 0.6) {
          isPhaseBeat = true;
          this.lastPhaseBeatTime = now;
        }
      }

      // Phase lock correction on raw beat onset
      if (isRawBeat) {
        // Compute phase error
        const phaseErr = currentPhase < 0.5 ? currentPhase : currentPhase - 1.0;
        // If within 40ms of expected beat, align phase
        if (Math.abs(phaseErr * this.beatInterval) < 0.09) {
          this.lastBeatTimestamp += phaseErr * this.beatInterval * 0.3;
        } else {
          // If on a solid offbeat/beat, resync
          this.lastBeatTimestamp = now;
        }
      }
    } else {
      // Low confidence fallback: phase directly from time or raw onsets
      currentPhase = (now / this.beatInterval) % 1.0;
    }

    this.prevFramePhase = currentPhase;
    this.phase = currentPhase;

    // Combined beat signal:
    // If confident: raw onsets OR phase pulses
    // If low confidence: raw onsets only
    let isFinalBeat = false;
    if (this.confidence >= 0.35) {
      if (isRawBeat) {
        isFinalBeat = true;
        this.lastBeatTimestamp = now;
      } else if (isPhaseBeat) {
        isFinalBeat = true;
        beatStrength = 0.55; // Moderate pulse for cadence continuation through quiet beats
      }
    } else {
      isFinalBeat = isRawBeat;
    }

    // 9. Build / Drop Detection
    // Track medium-term baseline energy (~4s)
    const mediumDtAlpha = 1 - Math.exp(-dt / 3.5);
    this.mediumEnergy += (this.smoothedEnergy - this.mediumEnergy) * mediumDtAlpha;

    let dropProgress = 0;
    if (this.buildDropState === 'drop') {
      const dropAge = now - this.dropStartTime;
      if (dropAge < 1.2) {
        dropProgress = Math.max(0, Math.min(1.0, dropAge / 1.2));
      } else {
        this.buildDropState = 'none';
      }
    } else {
      // Check for Build
      // High onset activity + energy climbing significantly above medium baseline
      const isRising = this.smoothedEnergy > this.mediumEnergy * 1.35 && this.smoothedEnergy > 0.25;
      if (isRising) {
        if (this.buildStartTime <= 0) {
          this.buildStartTime = now;
        } else if (now - this.buildStartTime > 1.4) {
          this.buildDropState = 'building';
        }
      } else {
        if (this.buildDropState === 'building') {
          // Energy stopped rising; if bass suddenly explodes or kick arrives, trigger DROP!
          if (isKick && rawBass > 0.5) {
            this.buildDropState = 'drop';
            this.dropStartTime = now;
            dropProgress = 0;
          } else if (now - this.buildStartTime > 4.0) {
            this.buildDropState = 'none';
            this.buildStartTime = -10.0;
          }
        } else {
          this.buildStartTime = -10.0;
        }
      }

      // Instant drop check: massive jump in bass after quiet gap
      if (
        this.buildDropState !== 'drop' &&
        isKick &&
        rawBass > 0.65 &&
        this.smoothedBass < 0.3
      ) {
        this.buildDropState = 'drop';
        this.dropStartTime = now;
        dropProgress = 0;
      }
    }

    // Update state object in-place (no new allocations)
    this.state.subBass = rawSubBass;
    this.state.bass = rawBass;
    this.state.mids = rawMids;
    this.state.highs = rawHighs;
    this.state.smoothedSubBass = this.smoothedSubBass;
    this.state.smoothedBass = this.smoothedBass;
    this.state.smoothedMids = this.smoothedMids;
    this.state.smoothedHighs = this.smoothedHighs;
    this.state.smoothedEnergy = this.smoothedEnergy;
    this.state.isBeat = isFinalBeat;
    this.state.beatStrength = beatStrength;
    this.state.isKick = isKick;
    this.state.isSnare = isSnare;
    this.state.bpm = Math.round(this.bpm);
    this.state.confidence = this.confidence;
    this.state.phase = this.phase;
    this.state.buildDropSignal = this.buildDropState;
    this.state.dropProgress = dropProgress;

    return this.state;
  }

  /**
   * Exponential moving envelope attack/release calculation
   */
  private applyEnvelope(
    current: number,
    target: number,
    dt: number,
    attackTime: number,
    releaseTime: number
  ): number {
    const timeConstant = target > current ? attackTime : releaseTime;
    const alpha = 1 - Math.exp(-dt / timeConstant);
    return current + (target - current) * alpha;
  }

  /**
   * Record onset timestamp and strength into circular 8-second buffer
   */
  private recordOnset(time: number, strength: number): void {
    if (this.onsetCount < BeatEngine.MAX_ONSET_HISTORY) {
      this.onsetTimes[this.onsetCount] = time;
      this.onsetStrengths[this.onsetCount] = strength;
      this.onsetCount++;
    } else {
      // Shift left by 1 to make room
      for (let i = 1; i < BeatEngine.MAX_ONSET_HISTORY; i++) {
        this.onsetTimes[i - 1] = this.onsetTimes[i];
        this.onsetStrengths[i - 1] = this.onsetStrengths[i];
      }
      this.onsetTimes[BeatEngine.MAX_ONSET_HISTORY - 1] = time;
      this.onsetStrengths[BeatEngine.MAX_ONSET_HISTORY - 1] = strength;
    }
  }

  /**
   * Recalculates BPM from onset intervals over the last 8.0 seconds.
   * Uses comb-filter autocorrelation across 60-180 BPM range.
   */
  private recalculateTempo(currentTime: number): void {
    const minTime = currentTime - 8.0;

    // Filter valid onsets in the 8-second window
    let validStart = 0;
    while (validStart < this.onsetCount && this.onsetTimes[validStart] < minTime) {
      validStart++;
    }

    const count = this.onsetCount - validStart;
    if (count < 3) {
      // Not enough onsets to compute tempo
      this.confidence = Math.max(0, this.confidence - 0.08);
      return;
    }

    // Evaluate candidate BPMs from 60 to 180 (step 1 BPM)
    let bestBpm = this.bpm;
    let maxScore = -1;
    let totalScore = 0;
    let scoreCount = 0;

    // Buffer for candidate scores
    for (let candidateBpm = 60; candidateBpm <= 180; candidateBpm += 1) {
      const candidateInterval = 60 / candidateBpm;
      let score = 0;

      // Check all onset pairs
      for (let i = validStart; i < this.onsetCount - 1; i++) {
        const t1 = this.onsetTimes[i];
        const s1 = this.onsetStrengths[i];

        for (let j = i + 1; j < this.onsetCount; j++) {
          const delta = this.onsetTimes[j] - t1;
          if (delta > 4.0) break; // Don't check beyond 4 seconds
          if (delta < 0.25) continue; // Below 240 BPM limit

          // Check harmonic multipliers m = 1, 2, 3, 4
          const ratio = delta / candidateInterval;
          const nearestInt = Math.round(ratio);

          if (nearestInt >= 1 && nearestInt <= 4) {
            const diff = Math.abs(ratio - nearestInt);
            // Tolerance: within 8% of candidate interval
            if (diff < 0.085) {
              const weight = (1 - diff / 0.085) * (s1 * this.onsetStrengths[j]) / Math.sqrt(nearestInt);
              score += weight;
            }
          }
        }
      }

      // Only apply very gentle prior weight (1.0 to 1.04) if score is already non-trivial
      const priorWeight = 1.0 + 0.03 * Math.exp(-Math.pow((candidateBpm - 120) / 50, 2));
      score *= priorWeight;

      totalScore += score;
      scoreCount++;

      if (score > maxScore) {
        maxScore = score;
        bestBpm = candidateBpm;
      }
    }

    const avgScore = scoreCount > 0 ? totalScore / scoreCount : 0;

    // Peak-to-mean ratio requirement for rhythmicity
    if (maxScore > 0 && avgScore > 0 && maxScore > 2.2 * avgScore && count >= 4) {
      // Check interval regularity of adjacent onsets against best candidate interval
      const bestInterval = 60 / bestBpm;
      let regularMatches = 0;
      const totalAdjacent = count - 1;

      for (let i = validStart; i < this.onsetCount - 1; i++) {
        const delta = this.onsetTimes[i + 1] - this.onsetTimes[i];
        if (delta >= 0.25) {
          const nearestMultiple = Math.round(delta / bestInterval);
          if (nearestMultiple >= 1 && nearestMultiple <= 4) {
            const err = Math.abs(delta - nearestMultiple * bestInterval);
            if (err < 0.06 * nearestMultiple) {
              regularMatches++;
            }
          }
        }
      }

      const regularity = totalAdjacent > 0 ? regularMatches / totalAdjacent : 0;

      // Prominence: how much the peak stands out above the noise floor
      const prominence = (maxScore - 2.0 * avgScore) / (maxScore + 0.001);

      // Normalized confidence requires BOTH comb peak prominence AND onset interval regularity
      // Rhythmic music has regularity > 0.6 and prominence > 0.5 -> confidence > 0.5
      // Uncorrelated noise has regularity < 0.25 -> confidence < 0.2
      const rawConfidence = Math.min(
        1.0,
        Math.max(0.0, prominence * (0.3 + 0.7 * regularity) * Math.min(1.2, count / 5))
      );

      // Smooth confidence
      this.confidence = this.confidence * 0.7 + rawConfidence * 0.3;

      if (this.confidence >= 0.25) {
        // Smooth BPM transition if close, otherwise lock to new peak
        if (Math.abs(bestBpm - this.bpm) < 8) {
          this.bpm = this.bpm * 0.85 + bestBpm * 0.15;
        } else {
          this.bpm = bestBpm;
        }
      }
    } else {
      // Uncorrelated or weak rhythm
      this.confidence = Math.max(0, this.confidence * 0.75 - 0.05);
    }
  }

  public getState(): BeatState {
    return this.state;
  }
}
