import { clampColorForBackground } from './appearanceConfig';

export interface AlbumColors {
  dominant: string;
  secondary: string;
}

// In-memory cache so extraction runs only once per track / artwork
const colorCache = new Map<string, AlbumColors>();

/**
 * Extracts dominant and secondary colors from artwork downscaled to 64x64.
 * Clamps lightness to <= 22% for readability.
 * Caches results per track/artworkUrl.
 */
export async function extractAlbumColors(
  artworkUrl?: string,
  fallbackAccent: string = '#3b82f6'
): Promise<AlbumColors> {
  // 1. Fallback if no artwork URL
  if (!artworkUrl || artworkUrl.trim() === '') {
    const dominant = clampColorForBackground(fallbackAccent, 0.22);
    const secondary = shiftHue(dominant, 30);
    return { dominant, secondary };
  }

  // 2. Check cache
  if (colorCache.has(artworkUrl)) {
    return colorCache.get(artworkUrl)!;
  }

  // 3. Extract from image via offscreen canvas
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Artwork image failed to load'));
      img.src = artworkUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      throw new Error('Could not get 2d context for color extraction');
    }

    ctx.drawImage(img, 0, 0, 64, 64);
    const imgData = ctx.getImageData(0, 0, 64, 64).data;

    // Bucket colors in RGB space (quantize 5 bits per channel: 32 bins per channel)
    const colorCounts = new Map<number, number>();

    for (let i = 0; i < imgData.length; i += 4) {
      const a = imgData[i + 3];
      if (a < 128) continue; // Skip transparent

      const r = imgData[i] >> 3; // 0..31
      const g = imgData[i + 1] >> 3;
      const b = imgData[i + 2] >> 3;

      // Filter pure black and pure white to focus on album chromatic colors
      if ((r < 2 && g < 2 && b < 2) || (r > 29 && g > 29 && b > 29)) continue;

      const key = (r << 10) | (g << 5) | b;
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    }

    let topKey = -1;
    let topCount = -1;
    for (const [key, count] of colorCounts.entries()) {
      if (count > topCount) {
        topCount = count;
        topKey = key;
      }
    }

    let dominantHex = fallbackAccent;
    if (topKey >= 0) {
      const r = ((topKey >> 10) & 31) << 3;
      const g = ((topKey >> 5) & 31) << 3;
      const b = (topKey & 31) << 3;
      dominantHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    // Find secondary distinct color
    let secondKey = -1;
    let secondCount = -1;
    const topR = (topKey >> 10) & 31;
    const topG = (topKey >> 5) & 31;
    const topB = topKey & 31;

    for (const [key, count] of colorCounts.entries()) {
      if (key === topKey) continue;
      const r = (key >> 10) & 31;
      const g = (key >> 5) & 31;
      const b = key & 31;

      // Color distance in quantized space
      const dist = Math.abs(r - topR) + Math.abs(g - topG) + Math.abs(b - topB);
      if (dist >= 8 && count > secondCount) {
        secondCount = count;
        secondKey = key;
      }
    }

    let secondaryHex = shiftHue(dominantHex, 35);
    if (secondKey >= 0) {
      const r = ((secondKey >> 10) & 31) << 3;
      const g = ((secondKey >> 5) & 31) << 3;
      const b = (secondKey & 31) << 3;
      secondaryHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    // Clamp both to <= 22% lightness
    const clampedDominant = clampColorForBackground(dominantHex, 0.22);
    const clampedSecondary = clampColorForBackground(secondaryHex, 0.20);

    const result: AlbumColors = {
      dominant: clampedDominant,
      secondary: clampedSecondary,
    };

    colorCache.set(artworkUrl, result);
    return result;
  } catch (err) {
    console.warn('[AlbumColorExtractor] Extraction failed, falling back to accent:', err);
    const dominant = clampColorForBackground(fallbackAccent, 0.22);
    const secondary = shiftHue(dominant, 30);
    const result: AlbumColors = { dominant, secondary };
    colorCache.set(artworkUrl, result);
    return result;
  }
}

function toHex(n: number): string {
  return Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0');
}

function shiftHue(hex: string, degrees: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(clean.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(clean.substring(4, 6), 16) / 255 || 0;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;

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

  h = (h + degrees + 360) % 360;
  const clampedL = Math.min(0.22, l);

  const c = (1 - Math.abs(2 * clampedL - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = clampedL - c / 2;
  let rFinal = 0,
    gFinal = 0,
    bFinal = 0;

  if (h >= 0 && h < 60) {
    rFinal = c;
    gFinal = x;
    bFinal = 0;
  } else if (h >= 60 && h < 120) {
    rFinal = x;
    gFinal = c;
    bFinal = 0;
  } else if (h >= 120 && h < 180) {
    rFinal = 0;
    gFinal = c;
    bFinal = x;
  } else if (h >= 180 && h < 240) {
    rFinal = 0;
    gFinal = x;
    bFinal = c;
  } else if (h >= 240 && h < 300) {
    rFinal = x;
    gFinal = 0;
    bFinal = c;
  } else {
    rFinal = c;
    gFinal = 0;
    bFinal = x;
  }

  return `#${toHex(Math.round((rFinal + m) * 255))}${toHex(
    Math.round((gFinal + m) * 255)
  )}${toHex(Math.round((bFinal + m) * 255))}`;
}

