import React, { useEffect, useState, useRef } from 'react';
import { AppearanceConfig, clampColorForBackground } from '../services/appearanceConfig';
import { extractAlbumColors, AlbumColors } from '../services/albumColorExtractor';
import { MusicTrack } from '../types/lyrics';
import { BeatState } from '../audio/beat';

interface BackgroundThemeProps {
  config: AppearanceConfig;
  currentTrack: MusicTrack;
  accentColor: string;
  getBeatState: () => BeatState;
}

interface MeshBlob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  colorRgb: [number, number, number];
}

function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  return [
    parseInt(clean.substring(0, 2), 16) || 0,
    parseInt(clean.substring(2, 4), 16) || 0,
    parseInt(clean.substring(4, 6), 16) || 0,
  ];
}

export const BackgroundTheme: React.FC<BackgroundThemeProps> = ({
  config,
  currentTrack,
  accentColor,
  getBeatState,
}) => {
  const {
    bgMode = 'solid',
    bgSolidColor = '#000000',
    bgGradientType = 'linear',
    bgGradientAngle = 135,
    bgGradientColors = ['#090a0f', '#181b26', '#0d1117'],
    bgIntensity = 1.0,
  } = config;

  const [albumColors, setAlbumColors] = useState<AlbumColors>({
    dominant: '#0a0d14',
    secondary: '#120b18',
  });

  // Extract album colors when track changes
  useEffect(() => {
    let isCancelled = false;
    extractAlbumColors(currentTrack.artworkUrl, accentColor).then((cols) => {
      if (!isCancelled) {
        setAlbumColors(cols);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [currentTrack.artworkUrl, currentTrack.id, accentColor]);

  // Compute CSS background for the current configuration
  const computeBackgroundStyle = (): string => {
    switch (bgMode) {
      case 'solid': {
        const clamped = clampColorForBackground(bgSolidColor, 0.22, bgIntensity);
        return clamped;
      }
      case 'gradient': {
        const clampedColors = (bgGradientColors.length >= 2 ? bgGradientColors : ['#090a0f', '#181b26']).map((c) =>
          clampColorForBackground(c, 0.22, bgIntensity)
        );
        if (bgGradientType === 'radial') {
          return `radial-gradient(circle at center, ${clampedColors.join(', ')})`;
        }
        return `linear-gradient(${bgGradientAngle}deg, ${clampedColors.join(', ')})`;
      }
      case 'album': {
        const dom = clampColorForBackground(albumColors.dominant, 0.22, bgIntensity);
        const sec = clampColorForBackground(albumColors.secondary, 0.18, bgIntensity);
        return `radial-gradient(ellipse at 50% 40%, ${dom} 0%, ${sec} 65%, #000000 100%)`;
      }
      case 'mesh': {
        // Mesh background base is deep black
        return '#000000';
      }
      default:
        return '#000000';
    }
  };

  const currentBg = computeBackgroundStyle();

  // Dual-layer 800ms crossfade management
  const [layers, setLayers] = useState({
    active: 0 as 0 | 1,
    layer0: currentBg,
    layer1: currentBg,
  });

  const lastBgRef = useRef(currentBg);

  useEffect(() => {
    if (currentBg !== lastBgRef.current) {
      lastBgRef.current = currentBg;
      setLayers((prev) => {
        if (prev.active === 0) {
          return { active: 1, layer0: prev.layer0, layer1: currentBg };
        } else {
          return { active: 0, layer0: currentBg, layer1: prev.layer1 };
        }
      });
    }
  }, [currentBg]);

  // Ambient Mesh Canvas
  const meshCanvasRef = useRef<HTMLCanvasElement>(null);
  const meshStateRef = useRef<{
    blobs: MeshBlob[];
    lastTime: number;
    smoothedBass: number;
  }>({
    blobs: [],
    lastTime: performance.now(),
    smoothedBass: 0,
  });

  // Initialize or re-color mesh blobs
  useEffect(() => {
    if (bgMode !== 'mesh') return;

    const baseHex = albumColors.dominant || accentColor || '#10b981';
    const c1 = hexToRgb(clampColorForBackground(baseHex, 0.22, bgIntensity));
    const c2 = hexToRgb(clampColorForBackground(albumColors.secondary || '#3b82f6', 0.20, bgIntensity));
    const c3 = hexToRgb(clampColorForBackground(accentColor || '#ec4899', 0.18, bgIntensity));
    const c4 = hexToRgb(clampColorForBackground('#14b8a6', 0.18, bgIntensity));

    meshStateRef.current.blobs = [
      { x: 0.25, y: 0.3, vx: 0.015, vy: 0.012, radius: 0.35, colorRgb: c1 },
      { x: 0.75, y: 0.35, vx: -0.018, vy: 0.014, radius: 0.38, colorRgb: c2 },
      { x: 0.35, y: 0.75, vx: 0.012, vy: -0.016, radius: 0.36, colorRgb: c3 },
      { x: 0.8, y: 0.8, vx: -0.014, vy: -0.015, radius: 0.34, colorRgb: c4 },
    ];
  }, [bgMode, albumColors, accentColor, bgIntensity]);

  // Mesh animation loop
  useEffect(() => {
    if (bgMode !== 'mesh') return;
    const canvas = meshCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      // 0.5x resolution for soft blurred mesh layer
      const dpr = Math.min(1.0, window.devicePixelRatio || 1);
      canvas.width = Math.round(window.innerWidth * dpr * 0.5);
      canvas.height = Math.round(window.innerHeight * dpr * 0.5);
    };

    resize();
    window.addEventListener('resize', resize);

    const m = meshStateRef.current;

    const render = () => {
      const now = performance.now();
      const dt = Math.max(0.001, Math.min(0.1, (now - m.lastTime) / 1000));
      m.lastTime = now;

      const w = canvas.width;
      const h = canvas.height;

      // Gentle bass reaction (smooth attack/decay, never flashing)
      const beatState = getBeatState();
      const targetBass = beatState?.smoothedBass || 0;
      m.smoothedBass += (targetBass - m.smoothedBass) * Math.min(1.0, dt * 5.0);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const bassExpansion = m.smoothedBass * 0.08;

      for (const blob of m.blobs) {
        blob.x += blob.vx * dt;
        blob.y += blob.vy * dt;

        // Soft bounce within screen margins
        if (blob.x < 0.1 || blob.x > 0.9) blob.vx *= -1;
        if (blob.y < 0.1 || blob.y > 0.9) blob.vy *= -1;

        const bx = blob.x * w;
        const by = blob.y * h;
        const radius = Math.min(w, h) * (blob.radius + bassExpansion);

        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, radius);
        const [r, g, b] = blob.colorRgb;
        const alpha = Math.min(0.65, (0.35 + m.smoothedBass * 0.15) * bgIntensity);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
        grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.4})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [bgMode, getBeatState, bgIntensity]);

  return (
    <div className="fixed inset-0 pointer-events-none -z-20 overflow-hidden select-none bg-black">
      {/* Layer 0 (800ms crossfade) */}
      <div
        className="absolute inset-0 transition-all duration-800 ease-in-out"
        style={{
          background: layers.layer0,
          opacity: layers.active === 0 ? 1 : 0,
        }}
      />

      {/* Layer 1 (800ms crossfade) */}
      <div
        className="absolute inset-0 transition-all duration-800 ease-in-out"
        style={{
          background: layers.layer1,
          opacity: layers.active === 1 ? 1 : 0,
        }}
      />

      {/* Ambient Mesh Layer (only active when mode === 'mesh') */}
      {bgMode === 'mesh' && (
        <canvas
          ref={meshCanvasRef}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-800 ease-in-out"
          style={{ filter: 'blur(32px)' }}
        />
      )}
    </div>
  );
};

