import React, { useEffect, useRef } from 'react';
import { PlaybackState } from '../types/radio';
import { BeatState } from '../audio/beat';
import { AmbientMotionMode, AmbientStyle, VisualQuality } from '../services/appearanceConfig';
import { adaptiveQuality } from '../services/adaptiveQuality';

interface MovingAmbientLightProps {
  getBeatState: () => BeatState;
  playbackState: PlaybackState;
  colorRgb?: [number, number, number];
  accentRgbRef?: React.MutableRefObject<[number, number, number]>;
  mode?: AmbientMotionMode;
  styleMode?: AmbientStyle;
  intensity?: number;
  motionSpeed?: number;
  beatReaction?: number;
  autoCycle?: boolean;
  visualQuality?: VisualQuality;
}

interface Comet {
  pos: number; // Normalized perimeter position [0, 1)
  speed: number; // Laps per second
  tailLength: number; // Normalized perimeter length [0.15, 0.25]
  brightness: number; // 0 to 1
  decayRate: number;
  active: boolean;
}

interface DriftingBlob {
  pos: number; // Normalized perimeter position [0, 1)
  speed: number;
  radius: number;
  depthScale: number;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

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
  return [h, s, l];
}

export const MovingAmbientLight: React.FC<MovingAmbientLightProps> = ({
  getBeatState,
  playbackState,
  colorRgb = [255, 75, 130],
  accentRgbRef,
  mode = 'beat',
  styleMode = 'rim-bloom',
  intensity = 1.0,
  motionSpeed = 1.0,
  beatReaction = 1.0,
  autoCycle = false,
  visualQuality = 'auto',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use refs for animation variables to prevent recreation on re-render
  const stateRef = useRef({
    comets: [
      { pos: 0.1, speed: 0.125, tailLength: 0.2, brightness: 0.9, decayRate: 0.08, active: true },
      { pos: 0.45, speed: 0.11, tailLength: 0.22, brightness: 0.7, decayRate: 0.06, active: true },
      { pos: 0.8, speed: 0.13, tailLength: 0.18, brightness: 0.85, decayRate: 0.07, active: true },
    ] as Comet[],
    blobs: [
      { pos: 0.15, speed: 0.02, radius: 0.15, depthScale: 1.0 },
      { pos: 0.4, speed: -0.018, radius: 0.18, depthScale: 1.1 },
      { pos: 0.65, speed: 0.022, radius: 0.16, depthScale: 0.95 },
      { pos: 0.9, speed: -0.015, radius: 0.17, depthScale: 1.05 },
    ] as DriftingBlob[],
    beatPulse: 0.08,
    lastBeatTime: 0,
    prevLuminance: 0.1,
    lastFrameTime: performance.now(),
    autoCycleHue: 0,
    idleTransition: 1.0, // 0 = fully active music, 1 = fully idle breathing
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      // 0.5x resolution cap for background/ambient layer per performance specs
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const s = stateRef.current;

    const render = () => {
      const nowMs = performance.now();

      // Pause loop when document is hidden
      if (typeof document !== 'undefined' && document.hidden) {
        animId = requestAnimationFrame(render);
        return;
      }

      adaptiveQuality.recordFrame(nowMs);
      const profile = adaptiveQuality.getProfile(visualQuality);

      const dt = Math.max(0.001, Math.min(0.1, (nowMs - s.lastFrameTime) / 1000));
      s.lastFrameTime = nowMs;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const perimeter = 2 * (width + height);

      const isPlaying = playbackState === 'playing';
      const beatState = getBeatState();

      // Smooth idle transition (within 1s when paused/silent)
      if (isPlaying && (beatState.smoothedEnergy > 0.04 || beatState.isBeat)) {
        s.idleTransition = Math.max(0, s.idleTransition - dt * 2.0);
      } else {
        s.idleTransition = Math.min(1.0, s.idleTransition + dt * 1.2);
      }

      // Check prefers-reduced-motion
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const effectiveMode: AmbientMotionMode = prefersReducedMotion ? 'calm' : mode;

      // 1. BEAT PULSE
      // Attack ~40ms, decay ~350ms (scaled by tempo)
      const bpm = beatState.bpm || 120;
      const decayTime = (0.35 * (120 / bpm)) / Math.max(0.4, beatReaction);
      const attackAlpha = 1 - Math.exp(-dt / 0.04);
      const decayAlpha = 1 - Math.exp(-dt / decayTime);

      const modeReactionMult =
        effectiveMode === 'off'
          ? 0.0
          : effectiveMode === 'calm'
          ? 0.35
          : effectiveMode === 'party'
          ? 1.45
          : 1.0; // 'beat'

      if (beatState.isBeat && effectiveMode !== 'off') {
        const targetPulse = Math.min(
          1.0,
          0.12 + beatState.beatStrength * 0.75 * beatReaction * modeReactionMult
        );
        s.beatPulse += (targetPulse - s.beatPulse) * attackAlpha;
        s.lastBeatTime = nowMs;
      } else {
        const idleTarget = 0.06 + 0.035 * Math.sin((nowMs * 2 * Math.PI) / 8000);
        s.beatPulse += (idleTarget - s.beatPulse) * decayAlpha;
      }

      // Drop swell effect: raises baseline glow over 1.2s
      let dropSwell = 0;
      if (beatState.buildDropSignal === 'drop') {
        dropSwell = (1.0 - beatState.dropProgress) * 0.45;
      }

      // Build energy rise
      let buildLift = 0;
      if (beatState.buildDropSignal === 'building') {
        buildLift = 0.15;
      }

      // 2. SPEED CALCULATION
      // Base speed = 1 lap per 4 beats (or 8s per lap with no tempo)
      const beatsPerSec = bpm / 60;
      const baseLapSpeed = (beatsPerSec / 4) * motionSpeed;
      const lapSpeed =
        effectiveMode === 'off'
          ? 0
          : effectiveMode === 'calm'
          ? baseLapSpeed * 0.35
          : effectiveMode === 'party'
          ? baseLapSpeed * 1.35
          : baseLapSpeed;

      // When building, increase speed slightly
      const finalLapSpeed = lapSpeed * (1.0 + buildLift * 0.5) * (1.0 - s.idleTransition);

      // Kick Corner Spawning:
      // A strong kick spawns a new comet from nearest corner (pooled max 3)
      if (profile.enableComets && profile.maxComets > 0 && beatState.isKick && effectiveMode !== 'off' && s.idleTransition < 0.5) {
        // Corners: 0 (TL), W/P (TR), (W+H)/P (BR), (2W+H)/P (BL)
        const corners = [0, width / perimeter, (width + height) / perimeter, (2 * width + height) / perimeter];
        // Pick corner furthest from existing comets
        let bestCorner = corners[0];
        let maxMinDist = -1;
        for (const c of corners) {
          let minDist = 1.0;
          for (let ci = 0; ci < Math.min(s.comets.length, profile.maxComets); ci++) {
            const comet = s.comets[ci];
            if (comet.active) {
              const d = Math.abs(comet.pos - c);
              const wrappedD = Math.min(d, 1.0 - d);
              if (wrappedD < minDist) minDist = wrappedD;
            }
          }
          if (minDist > maxMinDist) {
            maxMinDist = minDist;
            bestCorner = c;
          }
        }

        // Spawn or recycle comet
        const cIdx = Math.floor(Math.random() * Math.min(s.comets.length, profile.maxComets));
        s.comets[cIdx].pos = bestCorner;
        s.comets[cIdx].speed = finalLapSpeed * (0.9 + Math.random() * 0.3);
        s.comets[cIdx].brightness = Math.min(1.0, 0.75 + beatState.smoothedBass * 0.4);
        s.comets[cIdx].tailLength = 0.18 + Math.random() * 0.07;
        s.comets[cIdx].active = true;
      }

      // Update Comets
      if (profile.enableComets) {
        const cometLimit = Math.min(s.comets.length, profile.maxComets);
        for (let ci = 0; ci < cometLimit; ci++) {
          const comet = s.comets[ci];
          if (!comet.active) continue;
          comet.pos = (comet.pos + (comet.speed || finalLapSpeed) * dt) % 1.0;
          if (comet.pos < 0) comet.pos += 1.0;
          // Slowly relax brightness
          comet.brightness = Math.max(0.4, comet.brightness - dt * comet.decayRate);
        }
      }

      // Update Drifting Blobs
      if (profile.enableBlobs) {
        const blobLimit = Math.min(s.blobs.length, profile.maxBlobs);
        for (let bi = 0; bi < blobLimit; bi++) {
          const blob = s.blobs[bi];
          blob.pos = (blob.pos + blob.speed * (0.8 + beatState.smoothedMids * 0.4) * dt) % 1.0;
          if (blob.pos < 0) blob.pos += 1.0;
        }
      }

      // 3. COLOR FLOW GRADIENT
      let [baseR, baseG, baseB] = accentRgbRef?.current || colorRgb;

      if (autoCycle) {
        // Auto cycle shifts hue once per 8 beats
        const beatCycleTime = (8 * (60 / bpm)) * 1000;
        s.autoCycleHue = ((nowMs / beatCycleTime) * 360) % 360;
        [baseR, baseG, baseB] = hslToRgb(s.autoCycleHue, 0.85, 0.65);
      }

      const [h, sat, lit] = rgbToHsl(baseR, baseG, baseB);
      // Hues: accent +-25 degrees rotating with beat phase
      const phaseAngle = (beatState.phase || 0) * 360;
      const [r1, g1, b1] = hslToRgb(h + 25 * Math.sin((phaseAngle * Math.PI) / 180), sat, lit);
      const [r2, g2, b2] = hslToRgb(h - 25 * Math.sin((phaseAngle * Math.PI) / 180), sat, lit);

      // 4. CLEAR CANVAS
      ctx.clearRect(0, 0, width, height);

      // Overall intensity calculation with safety clamping
      const rawLuminance =
        (0.18 + s.beatPulse * 0.55 + dropSwell + buildLift) * Math.min(2.0, Math.max(0.2, intensity));

      // Safety: clamp luminance swing to max 0.5 per 100ms (5.0 per sec)
      const maxDelta = 5.0 * dt;
      let clampedLuminance = s.prevLuminance;
      if (rawLuminance > s.prevLuminance + maxDelta) {
        clampedLuminance = s.prevLuminance + maxDelta;
      } else if (rawLuminance < s.prevLuminance - maxDelta) {
        clampedLuminance = s.prevLuminance - maxDelta;
      } else {
        clampedLuminance = rawLuminance;
      }
      // Absolute brightness cap in all modes
      clampedLuminance = Math.min(0.92, Math.max(0.04, clampedLuminance));
      s.prevLuminance = clampedLuminance;

      // 5. HELPER: Perimeter coordinate to (x, y)
      // s in [0, 1]
      const getCoord = (normS: number): [number, number] => {
        const dist = ((normS % 1.0) + 1.0) % 1.0 * perimeter;
        if (dist <= width) {
          // Top edge: (0, 0) to (W, 0)
          return [dist, 0];
        } else if (dist <= width + height) {
          // Right edge: (W, 0) to (W, H)
          return [width, dist - width];
        } else if (dist <= 2 * width + height) {
          // Bottom edge: (W, H) to (0, H)
          return [width - (dist - (width + height)), height];
        } else {
          // Left edge: (0, H) to (0, 0)
          return [0, height - (dist - (2 * width + height))];
        }
      };

      // Helper: Edge brightness at normalized s
      const getBrightnessAt = (normS: number): number => {
        let b = 0.25; // Base brightness
        if (effectiveMode === 'off') return 0.6;

        if (profile.enableComets) {
          const limit = Math.min(s.comets.length, profile.maxComets);
          for (let i = 0; i < limit; i++) {
            const comet = s.comets[i];
            if (!comet.active) continue;
            let d = Math.abs(normS - comet.pos);
            if (d > 0.5) d = 1.0 - d;
            if (d < comet.tailLength) {
              const factor = 1.0 - d / comet.tailLength;
              b += comet.brightness * factor * factor * 0.75;
            }
          }
        }

        // Drifting blobs contribution
        if (profile.enableBlobs) {
          const limit = Math.min(s.blobs.length, profile.maxBlobs);
          for (let i = 0; i < limit; i++) {
            const blob = s.blobs[i];
            let d = Math.abs(normS - blob.pos);
            if (d > 0.5) d = 1.0 - d;
            if (d < blob.radius) {
              b += 0.2 * (1.0 - d / blob.radius);
            }
          }
        }

        return Math.min(1.0, b);
      };

      // Inward bass push on depth (4-8% screen depth)
      const bassPush = beatState.smoothedBass * 0.06;
      const baseBloomDepth = Math.round(
        Math.min(width, height) * (0.08 + bassPush + dropSwell * 0.12)
      );

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // ==========================================
      // PART A: INNER BLOOM (if not rim-only)
      // ==========================================
      if (styleMode !== 'rim-only') {
        const topB = getBrightnessAt(0.125);
        const rightB = getBrightnessAt(0.375);
        const bottomB = getBrightnessAt(0.625);
        const leftB = getBrightnessAt(0.875);

        // TOP BLOOM
        const topDepth = Math.round(baseBloomDepth * (0.7 + topB * 0.5));
        const topAlpha = clampedLuminance * topB * 0.65;
        const gradTop = ctx.createLinearGradient(0, 0, 0, topDepth);
        gradTop.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${topAlpha})`);
        gradTop.addColorStop(0.3, `rgba(${baseR}, ${baseG}, ${baseB}, ${topAlpha * 0.4})`);
        gradTop.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradTop;
        ctx.fillRect(0, 0, width, topDepth);

        // BOTTOM BLOOM
        const botDepth = Math.round(baseBloomDepth * (0.7 + bottomB * 0.5));
        const botAlpha = clampedLuminance * bottomB * 0.65;
        const gradBot = ctx.createLinearGradient(0, height, 0, height - botDepth);
        gradBot.addColorStop(0, `rgba(${r2}, ${g2}, ${b2}, ${botAlpha})`);
        gradBot.addColorStop(0.3, `rgba(${baseR}, ${baseG}, ${baseB}, ${botAlpha * 0.4})`);
        gradBot.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradBot;
        ctx.fillRect(0, height - botDepth, width, botDepth);

        // LEFT BLOOM
        const leftDepth = Math.round(baseBloomDepth * (0.7 + leftB * 0.5));
        const leftAlpha = clampedLuminance * leftB * 0.65;
        const gradLeft = ctx.createLinearGradient(0, 0, leftDepth, 0);
        gradLeft.addColorStop(0, `rgba(${r2}, ${g2}, ${b2}, ${leftAlpha})`);
        gradLeft.addColorStop(0.3, `rgba(${baseR}, ${baseG}, ${baseB}, ${leftAlpha * 0.4})`);
        gradLeft.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradLeft;
        ctx.fillRect(0, 0, leftDepth, height);

        // RIGHT BLOOM
        const rightDepth = Math.round(baseBloomDepth * (0.7 + rightB * 0.5));
        const rightAlpha = clampedLuminance * rightB * 0.65;
        const gradRight = ctx.createLinearGradient(width, 0, width - rightDepth, 0);
        gradRight.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${rightAlpha})`);
        gradRight.addColorStop(0.3, `rgba(${baseR}, ${baseG}, ${baseB}, ${rightAlpha * 0.4})`);
        gradRight.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradRight;
        ctx.fillRect(width - rightDepth, 0, rightDepth, height);

        // COMET RADIAL HOT SPOTS ALONG RIM
        if (effectiveMode !== 'off' && profile.enableComets) {
          const limit = Math.min(s.comets.length, profile.maxComets);
          for (let i = 0; i < limit; i++) {
            const comet = s.comets[i];
            if (!comet.active) continue;
            const [cx, cy] = getCoord(comet.pos);
            const spotRadius = Math.round(baseBloomDepth * 1.5 * comet.brightness);
            const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, spotRadius);
            const spotAlpha = clampedLuminance * comet.brightness * 0.85;
            radGrad.addColorStop(0, `rgba(255, 240, 245, ${spotAlpha})`);
            radGrad.addColorStop(0.2, `rgba(${r1}, ${g1}, ${b1}, ${spotAlpha * 0.7})`);
            radGrad.addColorStop(0.6, `rgba(${baseR}, ${baseG}, ${baseB}, ${spotAlpha * 0.25})`);
            radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = radGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, spotRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // ==========================================
      // PART B: CRISP NEON RIM (if not bloom-only)
      // ==========================================
      if (styleMode !== 'bloom-only') {
        // Outer colored glow rim (2px)
        ctx.beginPath();
        ctx.rect(1, 1, width - 2, height - 2);
        ctx.lineWidth = 2;
        const rimAlpha = Math.min(1.0, clampedLuminance * 1.1);
        ctx.strokeStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${rimAlpha})`;
        ctx.stroke();

        // Inner white/lighter core (1px crisp neon core)
        ctx.beginPath();
        ctx.rect(1, 1, width - 2, height - 2);
        ctx.lineWidth = 1;
        const coreAlpha = Math.min(0.9, rimAlpha * 0.65 + s.beatPulse * 0.25);
        ctx.strokeStyle = `rgba(255, 255, 255, ${coreAlpha})`;
        ctx.stroke();

        // Highlight comet head positions on the rim with pure bright core
        if (effectiveMode !== 'off' && profile.enableComets) {
          const limit = Math.min(s.comets.length, profile.maxComets);
          for (let i = 0; i < limit; i++) {
            const comet = s.comets[i];
            if (!comet.active) continue;
            const [cx, cy] = getCoord(comet.pos);
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1.0, comet.brightness * clampedLuminance * 1.4)})`;
            ctx.fill();
          }
        }
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [
    playbackState,
    colorRgb,
    accentRgbRef,
    mode,
    styleMode,
    intensity,
    motionSpeed,
    beatReaction,
    autoCycle,
    getBeatState,
  ]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 w-full h-full" />;
};

