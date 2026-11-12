import React, { useEffect, useRef } from 'react';
import { AudioVisualizerData, PlaybackState } from '../types/radio';

interface AmbientEdgeLightProps {
  audioDataRef: React.MutableRefObject<AudioVisualizerData>;
  playbackState: PlaybackState;
  colorRgb?: [number, number, number];
  accentRgbRef?: React.MutableRefObject<[number, number, number]>;
  intensity?: number;
  autoCycle?: boolean;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
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

export const AmbientEdgeLight: React.FC<AmbientEdgeLightProps> = ({
  audioDataRef,
  playbackState,
  colorRgb = [240, 246, 255],
  accentRgbRef,
  intensity = 1.0,
  autoCycle = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Audio energy smoothing refs (Attack ~80ms, Release ~600ms)
  const smoothedBassRef = useRef(0.08);
  const smoothedShimmerRef = useRef(0.0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const now = performance.now();
      const dt = Math.max(0.001, Math.min(0.1, (now - lastTimeRef.current) / 1000));
      lastTimeRef.current = now;

      const width = window.innerWidth;
      const height = window.innerHeight;

      const isPlaying = playbackState === 'playing';
      const audioData = audioDataRef.current;

      // 1. Audio-reactive Bass Breathing Pulse:
      // Attack ~80ms, Release ~600ms
      let targetBass = 0.08;
      if (isPlaying && audioData) {
        const sub = audioData.subBassEnergy || 0;
        const bass = audioData.bassEnergy || 0;
        targetBass = Math.min(1.0, sub * 0.75 + bass * 0.25);
      } else {
        // Idle breathing when paused
        targetBass = 0.06 + 0.035 * Math.sin(now * 0.0018);
      }

      const currentSmoothed = smoothedBassRef.current;
      const attackRate = 1 - Math.exp(-dt / 0.08); // 80ms attack
      const releaseRate = 1 - Math.exp(-dt / 0.6); // 600ms release

      if (targetBass > currentSmoothed) {
        smoothedBassRef.current += (targetBass - currentSmoothed) * attackRate;
      } else {
        smoothedBassRef.current += (targetBass - currentSmoothed) * releaseRate;
      }

      const pulse = smoothedBassRef.current;

      // 2. Mids and highs slow brightness shimmer (never flash or strobe)
      let midTreble = 0;
      if (isPlaying && audioData) {
        midTreble = (audioData.midEnergy || 0) * 0.6 + (audioData.trebleEnergy || 0) * 0.4;
      }
      smoothedShimmerRef.current += (midTreble - smoothedShimmerRef.current) * 0.04;
      const shimmer = Math.sin(now * 0.0016) * 0.04 * smoothedShimmerRef.current;

      // 3. Clear Canvas
      ctx.clearRect(0, 0, width, height);

      // 4. Color Selection
      let [r, g, b] = accentRgbRef?.current || colorRgb;
      if (!accentRgbRef && autoCycle) {
        const hue = (now * 0.015) % 360;
        [r, g, b] = hslToRgb(hue, 0.75, 0.72);
      }

      // 5. Spread and Intensity:
      // Depth breathes in from bezel (35px to 85px), leaving center pure #000
      const spreadDepth = Math.round((35 + pulse * 50) * Math.min(1.35, Math.max(0.65, intensity)));
      const peakAlpha = Math.min(0.9, Math.max(0.05, (0.16 + pulse * 0.38 + shimmer) * intensity));
      const midAlpha = peakAlpha * 0.42;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // --- EDGE 1: TOP BEZEL BLEED ---
      const gradTop = ctx.createLinearGradient(0, 0, 0, spreadDepth);
      gradTop.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${peakAlpha})`);
      gradTop.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${midAlpha})`);
      gradTop.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradTop;
      ctx.fillRect(0, 0, width, spreadDepth);

      // --- EDGE 2: BOTTOM BEZEL BLEED ---
      const gradBottom = ctx.createLinearGradient(0, height, 0, height - spreadDepth);
      gradBottom.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${peakAlpha})`);
      gradBottom.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${midAlpha})`);
      gradBottom.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradBottom;
      ctx.fillRect(0, height - spreadDepth, width, spreadDepth);

      // --- EDGE 3: LEFT BEZEL BLEED ---
      const gradLeft = ctx.createLinearGradient(0, 0, spreadDepth, 0);
      gradLeft.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${peakAlpha})`);
      gradLeft.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${midAlpha})`);
      gradLeft.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradLeft;
      ctx.fillRect(0, 0, spreadDepth, height);

      // --- EDGE 4: RIGHT BEZEL BLEED ---
      const gradRight = ctx.createLinearGradient(width, 0, width - spreadDepth, 0);
      gradRight.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${peakAlpha})`);
      gradRight.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${midAlpha})`);
      gradRight.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradRight;
      ctx.fillRect(width - spreadDepth, 0, spreadDepth, height);

      // --- 4 CORNERS: SOFT CORNER RADIAL BLEEDS ---
      const cornerR = spreadDepth * 1.35;

      // Top-Left
      const radTL = ctx.createRadialGradient(0, 0, 0, 0, 0, cornerR);
      radTL.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${peakAlpha * 0.85})`);
      radTL.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${midAlpha * 0.7})`);
      radTL.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radTL;
      ctx.fillRect(0, 0, cornerR, cornerR);

      // Top-Right
      const radTR = ctx.createRadialGradient(width, 0, 0, width, 0, cornerR);
      radTR.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${peakAlpha * 0.85})`);
      radTR.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${midAlpha * 0.7})`);
      radTR.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radTR;
      ctx.fillRect(width - cornerR, 0, cornerR, cornerR);

      // Bottom-Left
      const radBL = ctx.createRadialGradient(0, height, 0, 0, height, cornerR);
      radBL.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${peakAlpha * 0.85})`);
      radBL.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${midAlpha * 0.7})`);
      radBL.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radBL;
      ctx.fillRect(0, height - cornerR, cornerR, cornerR);

      // Bottom-Right
      const radBR = ctx.createRadialGradient(width, height, 0, width, height, cornerR);
      radBR.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${peakAlpha * 0.85})`);
      radBR.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${midAlpha * 0.7})`);
      radBR.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radBR;
      ctx.fillRect(width - cornerR, height - cornerR, cornerR, cornerR);

      // --- 1PX CRISP BEZEL OUTLINE ---
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1.0, (0.28 + pulse * 0.4) * intensity)})`;
      ctx.lineWidth = 1;
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.6 * intensity})`;
      ctx.shadowBlur = 4 + pulse * 6;
      ctx.stroke();

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [playbackState, colorRgb, intensity, autoCycle, audioDataRef]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 w-full h-full" />;
};
