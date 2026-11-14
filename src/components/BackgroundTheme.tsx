import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  AppearanceConfig,
  clampColorForBackground,
  CustomGradientConfig,
  WallpaperConfig,
} from '../services/appearanceConfig';
import { extractAlbumColors, AlbumColors } from '../services/albumColorExtractor';
import { MusicTrack } from '../types/lyrics';
import { BeatState } from '../audio/beat';

interface BackgroundThemeProps {
  config: AppearanceConfig;
  currentTrack: MusicTrack;
  accentColor: string;
  getBeatState?: () => BeatState;
  onReadabilityWarning?: (isBright: boolean) => void;
}

// Generates a subtle SVG grain data URI to avoid color banding on gradients
function generateGrainDataUri(amountPercent: number): string {
  if (amountPercent <= 0) return '';
  const opacity = Math.min(0.2, (amountPercent / 100) * 1.5);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>
    <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' stitchTiles='stitch'/></filter>
    <rect width='100%' height='100%' filter='url(#n)' opacity='${opacity.toFixed(3)}'/>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Computes relative luminance from hex color string
function hexToLuminance(hex: string): number {
  if (!hex || hex === '#000000') return 0;
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  const r = (parseInt(clean.substring(0, 2), 16) || 0) / 255;
  const g = (parseInt(clean.substring(2, 4), 16) || 0) / 255;
  const b = (parseInt(clean.substring(4, 6), 16) || 0) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export const BackgroundTheme: React.FC<BackgroundThemeProps> = ({
  config,
  currentTrack,
  accentColor,
  getBeatState,
  onReadabilityWarning,
}) => {
  const {
    bgMode = 'solid',
    bgSolidColor = '#000000',
    bgGradientType = 'linear',
    bgGradientAngle = 135,
    bgGradientColors = ['#090a0f', '#181b26', '#0d1117'],
    bgIntensity = 1.0,
    bgDim = 0.4,
    bgGrain = 2,
    bgAnimatedGradient = false,
    customGradient,
    wallpaper,
  } = config;

  const [albumColors, setAlbumColors] = useState<AlbumColors>({
    dominant: '#0a0d14',
    secondary: '#120b18',
  });

  const [wallpaperDataUrl, setWallpaperDataUrl] = useState<string | null>(null);
  const [readabilityOverlayAlpha, setReadabilityOverlayAlpha] = useState<number>(0);
  const animatedAngleRef = useRef<number>(bgGradientAngle);
  const animFrameRef = useRef<number>(0);

  // Extract album colors when track artwork changes
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

  // Handle wallpaper or album artwork background with offscreen blur cache
  useEffect(() => {
    const isAlbum = bgMode === 'album' || (bgMode === 'wallpaper' && wallpaper?.useAlbumArt);
    const sourceUrl = isAlbum ? currentTrack.artworkUrl : wallpaper?.url;

    if (!sourceUrl) {
      setWallpaperDataUrl(null);
      return;
    }

    let isCancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (isCancelled) return;

      const blurPx = Math.max(0, Math.min(60, wallpaper?.blur ?? 24));
      const dimFactor = Math.max(0, Math.min(0.9, (wallpaper?.dim ?? 40) / 100));

      // Offscreen downscaled canvas for blur (1/4 size if blur > 10)
      const scale = blurPx > 10 ? 0.25 : 0.5;
      const offscreen = document.createElement('canvas');
      offscreen.width = Math.max(1, Math.round(img.width * scale));
      offscreen.height = Math.max(1, Math.round(img.height * scale));
      const ctx = offscreen.getContext('2d')!;

      // Apply image filters onto the offscreen render once
      ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height);

      // Fast box blur approximation on canvas pixels to avoid full-screen CSS filter: blur
      if (blurPx > 0) {
        ctx.globalAlpha = 0.85;
        const blurRadius = Math.round(blurPx * scale * 0.5);
        for (let dx = -blurRadius; dx <= blurRadius; dx += Math.max(1, blurRadius)) {
          for (let dy = -blurRadius; dy <= blurRadius; dy += Math.max(1, blurRadius)) {
            ctx.drawImage(offscreen, dx, dy);
          }
        }
        ctx.globalAlpha = 1.0;
      }

      // Read average luminance from sampled pixels for the Readability Guard
      try {
        const sampleData = ctx.getImageData(0, 0, Math.min(32, offscreen.width), Math.min(32, offscreen.height)).data;
        let totalLum = 0;
        let count = 0;
        for (let i = 0; i < sampleData.length; i += 16) {
          const r = sampleData[i] / 255;
          const g = sampleData[i + 1] / 255;
          const b = sampleData[i + 2] / 255;
          totalLum += 0.299 * r + 0.587 * g + 0.114 * b;
          count++;
        }
        const avgLum = (totalLum / Math.max(1, count)) * (1.0 - dimFactor);
        const isTooBright = avgLum > 0.35;
        if (onReadabilityWarning) onReadabilityWarning(isTooBright);
        setReadabilityOverlayAlpha(isTooBright ? Math.min(0.65, (avgLum - 0.35) * 1.5) : 0);
      } catch {
        // Fallback for tainted canvas
        setReadabilityOverlayAlpha(0);
      }

      try {
        const resultUri = offscreen.toDataURL('image/jpeg', 0.85);
        setWallpaperDataUrl(resultUri);
      } catch {
        setWallpaperDataUrl(sourceUrl);
      }
    };

    img.onerror = () => {
      if (!isCancelled) {
        setWallpaperDataUrl(null);
      }
    };

    img.src = sourceUrl;

    return () => {
      isCancelled = true;
    };
  }, [bgMode, wallpaper?.url, wallpaper?.blur, wallpaper?.dim, wallpaper?.useAlbumArt, currentTrack.artworkUrl]);

  // Compute CSS background string for the active configuration
  const computeBackgroundStyle = (): { background: string; backgroundSize?: string; backgroundPosition?: string; backgroundRepeat?: string } => {
    switch (bgMode) {
      case 'solid': {
        const clamped = clampColorForBackground(bgSolidColor, 0.22, bgIntensity);
        return { background: clamped };
      }
      case 'gradient': {
        const colors = bgGradientColors && bgGradientColors.length >= 2 ? bgGradientColors : ['#230b1e', '#3b1024', '#150616'];
        const grainUri = generateGrainDataUri(bgGrain);
        let grad = '';
        if (bgGradientType === 'radial') {
          grad = `radial-gradient(circle at center, ${colors.join(', ')})`;
        } else if (bgGradientType === 'conic') {
          grad = `conic-gradient(from ${bgGradientAngle}deg at 50% 50%, ${colors.join(', ')})`;
        } else {
          grad = `linear-gradient(${bgGradientAngle}deg, ${colors.join(', ')})`;
        }
        return { background: grainUri ? `${grainUri}, ${grad}` : grad };
      }
      case 'custom': {
        const cg = customGradient || {
          type: 'linear',
          angle: 135,
          centerX: 50,
          centerY: 50,
          stops: [
            { id: '1', color: '#090a0f', position: 0 },
            { id: '2', color: '#1f132b', position: 0.5 },
            { id: '3', color: '#0d1117', position: 1 },
          ],
          smooth: true,
          grain: 2,
          animated: false,
        };

        const sortedStops = [...cg.stops].sort((a, b) => a.position - b.position);
        const stopStrings = sortedStops.map((st) => {
          return `${st.color} ${Math.round(st.position * 100)}%`;
        });

        const grainUri = generateGrainDataUri(cg.grain || bgGrain);
        let grad = '';
        if (cg.type === 'radial') {
          grad = `radial-gradient(circle at ${cg.centerX}% ${cg.centerY}%, ${stopStrings.join(', ')})`;
        } else if (cg.type === 'conic') {
          grad = `conic-gradient(from ${cg.angle}deg at ${cg.centerX}% ${cg.centerY}%, ${stopStrings.join(', ')})`;
        } else {
          grad = `linear-gradient(${cg.angle}deg, ${stopStrings.join(', ')})`;
        }
        return { background: grainUri ? `${grainUri}, ${grad}` : grad };
      }
      case 'wallpaper':
      case 'album': {
        if (wallpaperDataUrl) {
          const dimPercent = Math.max(0, Math.min(90, wallpaper?.dim ?? 40));
          const dimOverlay = `linear-gradient(rgba(0,0,0,${(dimPercent / 100).toFixed(2)}), rgba(0,0,0,${(dimPercent / 100).toFixed(2)}))`;
          const tintOverlay =
            wallpaper?.tintColor && (wallpaper?.tintOpacity || 0) > 0
              ? `, linear-gradient(rgba(${parseInt(wallpaper.tintColor.slice(1, 3), 16) || 0}, ${parseInt(wallpaper.tintColor.slice(3, 5), 16) || 0}, ${parseInt(wallpaper.tintColor.slice(5, 7), 16) || 0}, ${(wallpaper.tintOpacity / 100).toFixed(2)}), rgba(0,0,0,0))`
              : '';

          const fit = wallpaper?.fit || 'cover';
          const bgSize =
            fit === 'cover'
              ? `${wallpaper?.zoom || 100}%`
              : fit === 'contain'
              ? 'contain'
              : fit === 'stretch'
              ? '100% 100%'
              : fit === 'tile'
              ? 'auto'
              : 'auto';

          return {
            background: `${dimOverlay}${tintOverlay}, url("${wallpaperDataUrl}")`,
            backgroundSize: bgSize,
            backgroundPosition: `${50 + (wallpaper?.offsetX || 0)}% ${50 + (wallpaper?.offsetY || 0)}%`,
            backgroundRepeat: fit === 'tile' ? 'repeat' : 'no-repeat',
          };
        }
        // Fallback if no artwork or wallpaper: use deep starlight dark
        const dom = clampColorForBackground(albumColors.dominant || '#0a0d14', 0.22, bgIntensity);
        const sec = clampColorForBackground(albumColors.secondary || '#120b18', 0.18, bgIntensity);
        return { background: `radial-gradient(ellipse at 50% 40%, ${dom} 0%, ${sec} 65%, #000000 100%)` };
      }
      default:
        return { background: '#000000' };
    }
  };

  const currentBgStyle = useMemo(() => computeBackgroundStyle(), [
    bgMode,
    bgSolidColor,
    bgGradientType,
    bgGradientAngle,
    bgGradientColors,
    bgIntensity,
    bgGrain,
    customGradient,
    wallpaper,
    wallpaperDataUrl,
    albumColors,
  ]);

  // Dual-layer 800ms crossfade between any two backgrounds
  const [layers, setLayers] = useState({
    active: 0 as 0 | 1,
    layer0: currentBgStyle,
    layer1: currentBgStyle,
  });

  const lastBgKeyRef = useRef(JSON.stringify(currentBgStyle));

  useEffect(() => {
    const key = JSON.stringify(currentBgStyle);
    if (key !== lastBgKeyRef.current) {
      lastBgKeyRef.current = key;
      setLayers((prev) => {
        if (prev.active === 0) {
          return { active: 1, layer0: prev.layer0, layer1: currentBgStyle };
        } else {
          return { active: 0, layer0: currentBgStyle, layer1: prev.layer1 };
        }
      });
    }
  }, [currentBgStyle]);

  // Readability Guard: measure solid / gradient / custom luminance
  useEffect(() => {
    if (bgMode === 'solid') {
      const lum = hexToLuminance(bgSolidColor);
      const isBright = lum > 0.35;
      if (onReadabilityWarning) onReadabilityWarning(isBright);
      setReadabilityOverlayAlpha(isBright ? Math.min(0.65, (lum - 0.35) * 1.5) : 0);
    } else if (bgMode === 'gradient') {
      const lums = (bgGradientColors || []).map(hexToLuminance);
      const avgLum = lums.reduce((a, b) => a + b, 0) / Math.max(1, lums.length);
      const isBright = avgLum > 0.35;
      if (onReadabilityWarning) onReadabilityWarning(isBright);
      setReadabilityOverlayAlpha(isBright ? Math.min(0.65, (avgLum - 0.35) * 1.5) : 0);
    } else if (bgMode === 'custom' && customGradient?.stops) {
      const lums = customGradient.stops.map((s) => hexToLuminance(s.color));
      const avgLum = lums.reduce((a, b) => a + b, 0) / Math.max(1, lums.length);
      const isBright = avgLum > 0.35;
      if (onReadabilityWarning) onReadabilityWarning(isBright);
      setReadabilityOverlayAlpha(isBright ? Math.min(0.65, (avgLum - 0.35) * 1.5) : 0);
    } else if (bgMode !== 'wallpaper' && bgMode !== 'album') {
      setReadabilityOverlayAlpha(0);
      if (onReadabilityWarning) onReadabilityWarning(false);
    }
  }, [bgMode, bgSolidColor, bgGradientColors, customGradient, onReadabilityWarning]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* Base black fallback */}
      <div className="absolute inset-0 bg-black -z-10" />

      {/* Layer 0 (800ms crossfade) */}
      <div
        className="absolute inset-0"
        style={{
          ...layers.layer0,
          opacity: layers.active === 0 ? 1 : 0,
          transition: 'opacity 800ms ease-in-out',
        }}
      />

      {/* Layer 1 (800ms crossfade) */}
      <div
        className="absolute inset-0"
        style={{
          ...layers.layer1,
          opacity: layers.active === 1 ? 1 : 0,
          transition: 'opacity 800ms ease-in-out',
        }}
      />

      {/* Readability Guard Dark Overlay (Applies automatically if background is too bright) */}
      {readabilityOverlayAlpha > 0.01 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: `rgba(0, 0, 0, ${readabilityOverlayAlpha.toFixed(2)})`,
            transition: 'opacity 500ms ease-in-out',
          }}
        />
      )}
    </div>
  );
};
