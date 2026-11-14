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

/**
 * EDGE LIGHT
 * ----------
 * One soft band of light that slides around the window edge and flows around
 * the corners. It is NOT a comet / orb / laser: there is no bright head dot.
 *
 * How it works (cheap, one canvas, one rAF loop, no React state per frame):
 *  1. The window outline is a rounded rectangle. We pre-compute ~300 points
 *     along it (position + inward normal).
 *  2. Every frame we compute a smooth intensity value for each point:
 *     a cos^2 lobe centred on the light's position. Intensity is 1 in the
 *     middle of the lobe and fades to 0 at both ends (no hard head or tail).
 *  3. For every point with intensity > 0 we stamp ONE pre-rendered soft
 *     radial sprite centred ON the edge, additively. Neighbouring sprites
 *     overlap heavily, so the sum is a continuous band whose glow bleeds
 *     inward from the edge, and wraps around corners because the points
 *     follow the rounded corner.
 *  4. A thinner, brighter sprite pass gives the band a slightly brighter
 *     rim right at the edge (like the reference), still soft, still no dot.
 */

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

// ---------------------------------------------------------------------------
// Perimeter table: rounded rectangle, clockwise from top-left corner end
// ---------------------------------------------------------------------------
const N = 320;
const STRIDE = 2; // draw every 2nd point: fewer, stronger sprites = cleaner colour

class Perimeter {
  x = new Float32Array(N);
  y = new Float32Array(N);
  nx = new Float32Array(N); // inward normal
  ny = new Float32Array(N);
  corner = new Uint8Array(N);
  length = 1;

  rebuild(w: number, h: number) {
    const r = Math.max(12, Math.min(40, Math.min(w, h) * 0.04));
    const sw = Math.max(1, w - 2 * r);
    const sh = Math.max(1, h - 2 * r);
    const arc = 0.5 * Math.PI * r;
    const seg = [sw, arc, sh, arc, sw, arc, sh, arc];
    const total = seg.reduce((a, b) => a + b, 0);
    this.length = total;

    for (let i = 0; i < N; i++) {
      let d = (i / N) * total;
      let s = 0;
      while (s < 7 && d > seg[s]) {
        d -= seg[s];
        s++;
      }
      const t = d / seg[s];
      let px = 0, py = 0, nx = 0, ny = 0, c = 0;
      switch (s) {
        case 0: px = r + t * sw; py = 0; nx = 0; ny = 1; break;
        case 1: { const a = -Math.PI / 2 + t * Math.PI / 2; px = w - r + r * Math.cos(a); py = r + r * Math.sin(a); nx = -Math.cos(a); ny = -Math.sin(a); c = 1; break; }
        case 2: px = w; py = r + t * sh; nx = -1; ny = 0; break;
        case 3: { const a = t * Math.PI / 2; px = w - r + r * Math.cos(a); py = h - r + r * Math.sin(a); nx = -Math.cos(a); ny = -Math.sin(a); c = 1; break; }
        case 4: px = w - r - t * sw; py = h; nx = 0; ny = -1; break;
        case 5: { const a = Math.PI / 2 + t * Math.PI / 2; px = r + r * Math.cos(a); py = h - r + r * Math.sin(a); nx = -Math.cos(a); ny = -Math.sin(a); c = 1; break; }
        case 6: px = 0; py = h - r - t * sh; nx = 1; ny = 0; break;
        default: { const a = Math.PI + t * Math.PI / 2; px = r + r * Math.cos(a); py = r + r * Math.sin(a); nx = -Math.cos(a); ny = -Math.sin(a); c = 1; break; }
      }
      this.x[i] = px; this.y[i] = py; this.nx[i] = nx; this.ny[i] = ny; this.corner[i] = c;
    }
  }
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// Soft sprite: smooth quadratic-ish falloff, no hot centre.
function makeSprite(r: number, g: number, b: number, tight: boolean): HTMLCanvasElement {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const x = c.getContext('2d')!;
  // Opaque sprite = colour already multiplied by the falloff, on black.
  // Drawn with 'lighter' this adds colour without the 8-bit premultiplied-alpha
  // quantisation that turned faint tails grey.
  x.fillStyle = '#000';
  x.fillRect(0, 0, size, size);
  const grad = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // tight sprite is lighter in colour (rim); wide sprite is the full body colour
  const mix = tight ? 0.22 : 0;
  const rr = Math.round(r + (255 - r) * mix);
  const gg = Math.round(g + (255 - g) * mix);
  const bb = Math.round(b + (255 - b) * mix);
  // premultiply by hand: rgb * falloff, alpha stays 1
  // gaussian-like falloff (many stops = no visible banding / square edges)
  const stops: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    stops.push([t, Math.max(0, Math.exp(-4.2 * t * t) - 0.015 * t) * (1 - t * t * t)]);
  }
  for (const [at, f] of stops) {
    grad.addColorStop(at, `rgb(${Math.round(rr * f)},${Math.round(gg * f)},${Math.round(bb * f)})`);
  }
  x.fillStyle = grad;
  x.fillRect(0, 0, size, size);
  return c;
}

export const MovingAmbientLight: React.FC<MovingAmbientLightProps> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Live props in a ref: changing a slider must NEVER restart the render loop.
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const per = new Perimeter();
    let W = 0, H = 0;
    const RES = 0.5; // half-resolution canvas; the CSS scales it up, glow is soft anyway

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.max(1, Math.round(W * RES));
      canvas.height = Math.max(1, Math.round(H * RES));
      per.rebuild(W, H);
    };
    resize();
    window.addEventListener('resize', resize);

    const st = {
      pos: 0.02,           // 0..1 around the perimeter
      surge: 0,
      idle: 1,             // 1 = paused/silent, 0 = playing
      lum: 0.5,
      hue: 0,
      last: performance.now(),
      spriteKey: '',
      body: null as HTMLCanvasElement | null,
      rim: null as HTMLCanvasElement | null,
    };
    (window as any).__AMBIENT_LIGHT_STATE__ = st;

    let raf = 0;
    let frameToggle = false;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const p = propsRef.current;
      const now = performance.now();

      adaptiveQuality.recordFrame(now);
      const profile = adaptiveQuality.getProfile(p.visualQuality ?? 'auto');
      const lowTier = profile.tier === 'low' || profile.tier === 'minimal';
      if (lowTier) {
        frameToggle = !frameToggle;
        if (frameToggle) return; // 30fps on weak machines
      }

      const dt = Math.max(0.001, Math.min(0.066, (now - st.last) / 1000));
      st.last = now;

      const off = p.lightStyle === 'off' || p.mode === 'off' || p.styleMode === 'off';
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (off) return;

      const reduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const playing = p.playbackState === 'playing';
      const beat = p.getBeatState();
      const beatSync = p.beatSync !== false;
      const intensity = p.intensity ?? 1;
      const speed = p.motionSpeed ?? 1;
      const reaction = p.beatReaction ?? 1;

      // idle <-> playing blend
      if (playing && (beat.smoothedEnergy > 0.03 || beat.isBeat)) st.idle = Math.max(0, st.idle - dt * 2.5);
      else st.idle = Math.min(1, st.idle + dt * 1.5);

      // beat surge (~300ms decay)
      if (beatSync && beat.isBeat && st.idle < 0.7) st.surge = Math.min(1, st.surge + 0.35 * Math.max(0.5, reaction));
      else st.surge = Math.max(0, st.surge - dt * 3.3);

      // colour
      let [r, g, b] = p.accentRgbRef?.current || p.colorRgb || [255, 75, 130];
      if (p.autoCycle) {
        st.hue = ((now / (8000 / Math.max(0.5, speed))) * 360) % 360;
        [r, g, b] = hslToRgb(st.hue, 0.85, 0.6);
      }
      const key = `${r >> 3}-${g >> 3}-${b >> 3}`;
      if (key !== st.spriteKey || !st.body) {
        st.body = makeSprite(r, g, b, false);
        st.rim = makeSprite(r, g, b, true);
        st.spriteKey = key;
      }

      // motion: 1 lap / 9s at speed 1, slows when idle, slight push on beat
      let dir = p.direction === 'counter-clockwise' ? -1 : 1;
      if (p.direction === 'alternating') dir = Math.sin((now * 2 * Math.PI) / 18000) >= 0 ? 1 : -1;
      const lapsPerSec = (1 / 9) * speed * (1 - st.idle * 0.6) * (1 + (beatSync && playing ? st.surge * 0.3 : 0));
      if (!reduced) st.pos = (((st.pos + dir * lapsPerSec * dt) % 1) + 1) % 1;

      // brightness (never below a calm floor, change clamped -> no flicker)
      const breathing = lowTier || reduced ? 1 : 1 + 0.06 * Math.sin((now * 2 * Math.PI) / 3200);
      const playingLum = (0.8 + (beatSync ? st.surge * 0.22 : 0) + (beat.smoothedBass || 0) * 0.12) * breathing;
      const target = (0.42 * st.idle + playingLum * (1 - st.idle)) * intensity;
      const maxDelta = 4 * dt;
      st.lum += Math.max(-maxDelta, Math.min(maxDelta, target - st.lum));
      const lum = Math.min(1.25, Math.max(0.3, st.lum));

      // geometry
      const lights = p.lightCount === 2 ? 2 : 1;
      const lenFrac = Math.max(0.2, Math.min(0.5, (p.lightLength ?? 0.3))) * (1 + (beatSync ? st.surge * 0.06 : 0));
      const half = lenFrac / 2;                                    // half-length of lobe, in perimeter fraction
      const R = Math.max(80, Math.min(260, Math.min(W, H) * 0.3 * (p.glowSize ?? 1))); // inward bleed radius (css px)
      const spacing = (per.length / N) * STRIDE;                   // css px between drawn sprites
      const bodyA = 1.1 * (spacing / R);                          // normalises overlap -> ~constant peak brightness
      const rimR = R * 0.5;
      const rimA = 0.4 * (spacing / rimR);

      ctx.save();
      ctx.scale(RES, RES);
      ctx.globalCompositeOperation = 'lighter';

      for (let l = 0; l < lights; l++) {
        const centre = (st.pos + l * 0.5) % 1;
        const iStart = Math.floor(((centre - half) * N) / STRIDE) * STRIDE;
        const iEnd = Math.ceil((centre + half) * N);
        for (let k = iStart; k <= iEnd; k += STRIDE) {
          const idx = ((k % N) + N) % N;
          let d = Math.abs(k / N - centre);
          if (d > 0.5) d = 1 - d;
          if (d >= half) continue;
          const c = Math.cos((d / half) * Math.PI * 0.5);
          const I = c * c;                                        // cos^2 lobe: 1 in the middle, 0 at both ends
          const cornerBoost = per.corner[idx] ? 1.18 : 1;
          const a = Math.min(1, I * lum * cornerBoost);

          const cx = per.x[idx];
          const cy = per.y[idx];

          ctx.globalAlpha = Math.min(1, a * bodyA);
          ctx.drawImage(st.body!, cx - R, cy - R, R * 2, R * 2);

          if (!lowTier && I > 0.3) {
            ctx.globalAlpha = Math.min(1, a * rimA);
            ctx.drawImage(st.rim!, cx - rimR, cy - rimR, rimR * 2, rimR * 2);
          }
        }
      }
      ctx.restore();
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[1] w-full h-full"
      // black canvas + 'screen' blend = light is added on top of whatever background is behind it
      style={{ mixBlendMode: 'screen' }}
    />;
};