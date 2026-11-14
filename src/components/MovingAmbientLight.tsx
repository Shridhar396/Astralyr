import React, { useEffect, useRef } from 'react';
import { PlaybackState } from '../types/radio';
import { BeatState } from '../audio/beat';
import {
  AmbientMotionMode,
  AmbientStyle,
  AmbientLightStyle,
  VisualQuality,
} from '../services/appearanceConfig';
import { adaptiveQuality } from '../services/adaptiveQuality';

interface MovingAmbientLightProps {
  getBeatState: () => BeatState;
  playbackState: PlaybackState;
  colorRgb?: [number, number, number];
  accentRgbRef?: React.MutableRefObject<[number, number, number]>;
  mode?: AmbientMotionMode;
  styleMode?: AmbientStyle;
  lightStyle?: AmbientLightStyle;
  intensity?: number;
  motionSpeed?: number;
  beatReaction?: number;
  lightLength?: number;
  glowSize?: number;
  lightCount?: 1 | 2;
  direction?: 'clockwise' | 'counter-clockwise' | 'alternating';
  beatSync?: boolean;
  autoCycle?: boolean;
  visualQuality?: VisualQuality;
}

interface PathSample {
  x: number;
  y: number;
  nx: number;
  ny: number;
  isCorner: boolean;
}

const TABLE_SAMPLES = 1024;

class RoundedRectPathTable {
  public px = new Float32Array(TABLE_SAMPLES);
  public py = new Float32Array(TABLE_SAMPLES);
  public nx = new Float32Array(TABLE_SAMPLES);
  public ny = new Float32Array(TABLE_SAMPLES);
  public isCorner = new Uint8Array(TABLE_SAMPLES);
  public perimeter: number = 0;

  public rebuild(width: number, height: number, radius = 28): void {
    const r = Math.min(radius, Math.min(width, height) * 0.1);
    const straightW = Math.max(1, width - 2 * r);
    const straightH = Math.max(1, height - 2 * r);
    const cornerArc = 0.5 * Math.PI * r;
    const totalP = 2 * straightW + 2 * straightH + 4 * cornerArc;
    this.perimeter = totalP;

    // Segment boundaries along perimeter [0, totalP]
    // 0: Top side: [r, 0] to [width - r, 0]
    // 1: TR Corner: center [width - r, r], angle -PI/2 to 0
    // 2: Right side: [width, r] to [width, height - r]
    // 3: BR Corner: center [width - r, height - r], angle 0 to PI/2
    // 4: Bottom side: [width - r, height] to [r, height]
    // 5: BL Corner: center [r, height - r], angle PI/2 to PI
    // 6: Left side: [0, height - r] to [0, r]
    // 7: TL Corner: center [r, r], angle PI to 3*PI/2

    const segLengths = [
      straightW,   // 0: top
      cornerArc,   // 1: TR
      straightH,   // 2: right
      cornerArc,   // 3: BR
      straightW,   // 4: bottom
      cornerArc,   // 5: BL
      straightH,   // 6: left
      cornerArc,   // 7: TL
    ];

    for (let i = 0; i < TABLE_SAMPLES; i++) {
      const d = (i / TABLE_SAMPLES) * totalP;
      let accum = 0;
      let seg = 0;
      let segDist = 0;

      for (let s = 0; s < 8; s++) {
        if (d <= accum + segLengths[s] || s === 7) {
          seg = s;
          segDist = d - accum;
          break;
        }
        accum += segLengths[s];
      }

      let x = 0, y = 0, nx = 0, ny = 0, corner = 0;

      switch (seg) {
        case 0: { // Top side -> normal points DOWN (0, 1)
          x = r + segDist;
          y = 0;
          nx = 0;
          ny = 1;
          corner = 0;
          break;
        }
        case 1: { // TR corner
          const t = segDist / cornerArc;
          const ang = -0.5 * Math.PI + t * 0.5 * Math.PI;
          x = width - r + r * Math.cos(ang);
          y = r + r * Math.sin(ang);
          nx = -Math.cos(ang);
          ny = -Math.sin(ang);
          corner = 1;
          break;
        }
        case 2: { // Right side -> normal points LEFT (-1, 0)
          x = width;
          y = r + segDist;
          nx = -1;
          ny = 0;
          corner = 0;
          break;
        }
        case 3: { // BR corner
          const t = segDist / cornerArc;
          const ang = t * 0.5 * Math.PI;
          x = width - r + r * Math.cos(ang);
          y = height - r + r * Math.sin(ang);
          nx = -Math.cos(ang);
          ny = -Math.sin(ang);
          corner = 1;
          break;
        }
        case 4: { // Bottom side -> normal points UP (0, -1)
          x = width - r - segDist;
          y = height;
          nx = 0;
          ny = -1;
          corner = 0;
          break;
        }
        case 5: { // BL corner
          const t = segDist / cornerArc;
          const ang = 0.5 * Math.PI + t * 0.5 * Math.PI;
          x = r + r * Math.cos(ang);
          y = height - r + r * Math.sin(ang);
          nx = -Math.cos(ang);
          ny = -Math.sin(ang);
          corner = 1;
          break;
        }
        case 6: { // Left side -> normal points RIGHT (1, 0)
          x = 0;
          y = height - r - segDist;
          nx = 1;
          ny = 0;
          corner = 0;
          break;
        }
        case 7: { // TL corner
          const t = segDist / cornerArc;
          const ang = Math.PI + t * 0.5 * Math.PI;
          x = r + r * Math.cos(ang);
          y = r + r * Math.sin(ang);
          nx = -Math.cos(ang);
          ny = -Math.sin(ang);
          corner = 1;
          break;
        }
      }

      this.px[i] = x;
      this.py[i] = y;
      this.nx[i] = nx;
      this.ny[i] = ny;
      this.isCorner[i] = corner;
    }
  }

  public sample(normS: number): PathSample {
    const s = ((normS % 1.0) + 1.0) % 1.0;
    const idx = Math.min(TABLE_SAMPLES - 1, Math.floor(s * TABLE_SAMPLES));
    return {
      x: this.px[idx],
      y: this.py[idx],
      nx: this.nx[idx],
      ny: this.ny[idx],
      isCorner: this.isCorner[idx] === 1,
    };
  }
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export const MovingAmbientLight: React.FC<MovingAmbientLightProps> = ({
  getBeatState,
  playbackState,
  colorRgb = [255, 75, 130],
  accentRgbRef,
  mode = 'beat',
  styleMode = 'sliding',
  lightStyle = 'sliding',
  intensity = 1.0,
  motionSpeed = 1.0,
  beatReaction = 1.0,
  lightLength = 0.30,
  glowSize = 1.0,
  lightCount = 1,
  direction = 'clockwise',
  beatSync = true,
  autoCycle = false,
  visualQuality = 'auto',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathTableRef = useRef<RoundedRectPathTable>(new RoundedRectPathTable());
  const spriteCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const headSpriteCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastSpriteKeyRef = useRef<string>('');

  const animStateRef = useRef({
    headProgress: 0.1,
    directionSign: 1,
    beatSurge: 0,
    prevLuminance: 0.40,
    lastFrameTime: performance.now(),
    autoCycleHue: 0,
    idleTransition: 1.0,
  });

  // Pre-render soft seamless radial glow sprite
  const getGlowSprite = (r: number, g: number, b: number): { body: HTMLCanvasElement; head: HTMLCanvasElement } => {
    const key = `${r}-${g}-${b}`;
    if (spriteCanvasRef.current && headSpriteCanvasRef.current && lastSpriteKeyRef.current === key) {
      return { body: spriteCanvasRef.current, head: headSpriteCanvasRef.current };
    }

    const size = 192;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2;

    // 1. Continuous body sprite (seamless pure glow, no center hot spot)
    const bodyCanvas = document.createElement('canvas');
    bodyCanvas.width = size;
    bodyCanvas.height = size;
    const bctx = bodyCanvas.getContext('2d')!;

    const bgrad = bctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    bgrad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0.95)`);
    bgrad.addColorStop(0.20, `rgba(${r}, ${g}, ${b}, 0.75)`);
    bgrad.addColorStop(0.48, `rgba(${r}, ${g}, ${b}, 0.35)`);
    bgrad.addColorStop(0.75, `rgba(${r}, ${g}, ${b}, 0.10)`);
    bgrad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.0)`);

    bctx.fillStyle = bgrad;
    bctx.beginPath();
    bctx.arc(cx, cy, radius, 0, Math.PI * 2);
    bctx.fill();

    // 2. Comet head tip sprite (bright luminous core focal point at the very front)
    const headCanvas = document.createElement('canvas');
    headCanvas.width = size;
    headCanvas.height = size;
    const hctx = headCanvas.getContext('2d')!;

    const hgrad = hctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    hgrad.addColorStop(0.0, `rgba(255, 255, 255, 0.98)`);
    hgrad.addColorStop(0.22, `rgba(${r}, ${g}, ${b}, 0.88)`);
    hgrad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.35)`);
    hgrad.addColorStop(0.80, `rgba(${r}, ${g}, ${b}, 0.08)`);
    hgrad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.0)`);

    hctx.fillStyle = hgrad;
    hctx.beginPath();
    hctx.arc(cx, cy, radius, 0, Math.PI * 2);
    hctx.fill();

    spriteCanvasRef.current = bodyCanvas;
    headSpriteCanvasRef.current = headCanvas;
    lastSpriteKeyRef.current = key;
    return { body: bodyCanvas, head: headCanvas };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      pathTableRef.current.rebuild(w, h, 28);
    };

    resize();
    window.addEventListener('resize', resize);

    const s = animStateRef.current;
    const pathTable = pathTableRef.current;
    if (typeof window !== 'undefined') {
      (window as any).__AMBIENT_LIGHT_STATE__ = s;
    }

    const render = () => {
      const nowMs = performance.now();

      adaptiveQuality.recordFrame(nowMs);
      const profile = adaptiveQuality.getProfile(visualQuality);

      const dt = Math.max(0.001, Math.min(0.066, (nowMs - s.lastFrameTime) / 1000));
      s.lastFrameTime = nowMs;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const isPlaying = playbackState === 'playing';
      const beatState = getBeatState();

      // Check prefers-reduced-motion
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Smooth idle transition: when paused or silent, s.idleTransition -> 1.0; when playing, s.idleTransition -> 0.0
      if (isPlaying && (beatState.smoothedEnergy > 0.03 || beatState.isBeat)) {
        s.idleTransition = Math.max(0, s.idleTransition - dt * 2.5);
      } else {
        s.idleTransition = Math.min(1.0, s.idleTransition + dt * 1.5);
      }

      // 1. BEAT SYNC SURGE (Ease-out over ~300ms)
      if (beatSync && beatState.isBeat && s.idleTransition < 0.7) {
        s.beatSurge = Math.min(1.0, s.beatSurge + 0.35 * Math.max(0.5, beatReaction));
      } else {
        s.beatSurge = Math.max(0, s.beatSurge - dt * 3.33); // decay over ~300ms
      }

      // 2. COLOR CALCULATION
      let [baseR, baseG, baseB] = accentRgbRef?.current || colorRgb;
      if (autoCycle) {
        const cycleSpeed = 8000 / Math.max(0.5, motionSpeed);
        s.autoCycleHue = ((nowMs / cycleSpeed) * 360) % 360;
        [baseR, baseG, baseB] = hslToRgb(s.autoCycleHue, 0.85, 0.65);
      }

      // 3. MOTION POSITION
      // Base speed: 1 lap every 8 seconds (0.125 laps/s) at motionSpeed = 1.0
      const baseSpeed = 0.125 * motionSpeed;
      const surgeSpeedMultiplier = 1.0 + (beatSync ? s.beatSurge * 0.35 : 0);
      // Idle speed: keeps sliding slowly at 40% speed when paused; full speed when playing
      const idleSpeedMultiplier = 1.0 - s.idleTransition * 0.60;
      const effectiveSpeed = baseSpeed * (isPlaying ? surgeSpeedMultiplier : 1.0) * idleSpeedMultiplier;

      let dir = direction === 'counter-clockwise' ? -1 : 1;
      if (direction === 'alternating') {
        const altPhase = Math.sin((nowMs * 2 * Math.PI) / 16000);
        dir = altPhase >= 0 ? 1 : -1;
      }

      if (!prefersReducedMotion && lightStyle !== 'off') {
        s.headProgress = (s.headProgress + dir * effectiveSpeed * dt) % 1.0;
        if (s.headProgress < 0) s.headProgress += 1.0;
      }

      // Gentle breathing (+/- 8% over 3 seconds)
      const breathing =
        profile.tier === 'low' || profile.tier === 'minimal' || prefersReducedMotion
          ? 1.0
          : 1.0 + 0.08 * Math.sin((nowMs * 2 * Math.PI) / 3000);

      // Raw luminance calculation:
      // When paused (idle): exactly 40% brightness baseline
      // When playing: full brightness (0.85 to 1.0) with beat reaction
      const idleLuminance = 0.40;
      const playingLuminance =
        (0.85 + (beatSync ? s.beatSurge * 0.25 : 0) + (beatState.smoothedBass || 0) * 0.15) * breathing;
      const targetLuminance =
        (idleLuminance * s.idleTransition + playingLuminance * (1.0 - s.idleTransition)) * intensity;

      // Smooth delta limiting for flicker-free transitions
      const maxDelta = 5.0 * dt;
      let clampedLuminance = s.prevLuminance;
      if (targetLuminance > s.prevLuminance + maxDelta) {
        clampedLuminance = s.prevLuminance + maxDelta;
      } else if (targetLuminance < s.prevLuminance - maxDelta) {
        clampedLuminance = s.prevLuminance - maxDelta;
      } else {
        clampedLuminance = targetLuminance;
      }
      clampedLuminance = Math.min(1.0, Math.max(0.35, clampedLuminance));
      s.prevLuminance = clampedLuminance;

      // 4. DRAWING
      const scaleX = canvas.width / width;
      const scaleY = canvas.height / height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (lightStyle === 'off' || mode === 'off') {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.save();
      ctx.scale(scaleX, scaleY);

      // SLIDING AMBIENT LIGHT AROUND WINDOW (Soft, continuous glowing perimeter ribbon)
      const { body: bodySprite, head: headSprite } = getGlowSprite(baseR, baseG, baseB);
      const count = lightCount === 2 ? 2 : 1;
      const bodyLength = Math.max(0.20, Math.min(0.45, lightLength || 0.30));
      const numSprites = profile.tier === 'low' || profile.tier === 'minimal' ? 64 : 110;
      const baseGlowRadius = Math.max(36, Math.min(80, Math.min(width, height) * 0.06 * glowSize));

      ctx.globalCompositeOperation = 'lighter'; // Additive blending for radiant light bleed

      for (let l = 0; l < count; l++) {
        const headOffset = l === 1 ? 0.5 : 0;
        const headS = (s.headProgress + headOffset) % 1.0;

        // Sample head position for luminous comet head tip
        const headSample = pathTable.sample(headS);
        const headInward = 4 * glowSize;
        const headCx = headSample.x + headSample.nx * headInward;
        const headCy = headSample.y + headSample.ny * headInward;
        const headDrawSize = baseGlowRadius * 2.4;

        // Draw seamless continuous trailing body (high-density overlapping sprites)
        for (let step = 0; step < numSprites; step++) {
          const u = step / (numSprites - 1); // 0 at head, 1 at tail
          const normDist = (headS - dir * u * bodyLength + 1.0) % 1.0;
          const sample = pathTable.sample(normDist);

          // Hug the edge: small inward offset so the glow hugs the bezel and bleeds softly inward
          const inward = Math.max(4, Math.min(18, 6 * glowSize * (1.0 - 0.3 * u)));
          const cx = sample.x + sample.nx * inward;
          const cy = sample.y + sample.ny * inward;

          // Sprite draw size tapering gently from head to tail
          const drawSize = baseGlowRadius * 2 * (1.0 - 0.35 * u);

          // Alpha eases smoothly along the trailing body
          const easeAlpha = Math.pow(1.0 - u, 1.3);
          const stepAlpha = (clampedLuminance / (numSprites * 0.16)) * easeAlpha;

          ctx.globalAlpha = Math.min(0.9, Math.max(0.01, stepAlpha));
          ctx.drawImage(
            bodySprite,
            cx - drawSize / 2,
            cy - drawSize / 2,
            drawSize,
            drawSize
          );
        }

        // Draw luminous comet head tip (accent core at the leading edge)
        ctx.globalAlpha = Math.min(1.0, clampedLuminance * 0.95);
        ctx.drawImage(
          headSprite,
          headCx - headDrawSize / 2,
          headCy - headDrawSize / 2,
          headDrawSize,
          headDrawSize
        );
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
    lightStyle,
    intensity,
    motionSpeed,
    beatReaction,
    lightLength,
    glowSize,
    lightCount,
    direction,
    beatSync,
    autoCycle,
    visualQuality,
    getBeatState,
  ]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[1] w-full h-full" />;
};
