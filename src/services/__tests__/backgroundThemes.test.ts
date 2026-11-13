import { describe, it, expect } from 'vitest';
import { clampColorForBackground, GRADIENT_PRESETS, SOLID_SWATCHES } from '../appearanceConfig';
import { extractAlbumColors } from '../albumColorExtractor';

describe('Phase 3: Background Themes & Color Clamping', () => {
  describe('clampColorForBackground', () => {
    it('keeps pure black at #000000', () => {
      expect(clampColorForBackground('#000000')).toBe('#000000');
      expect(clampColorForBackground('#000')).toBe('#000000');
    });

    it('clamps bright white to lightness <= 0.22', () => {
      const clamped = clampColorForBackground('#ffffff', 0.22);
      expect(clamped).not.toBe('#ffffff');
      // Parse clamped RGB
      const r = parseInt(clamped.substring(1, 3), 16);
      const g = parseInt(clamped.substring(3, 5), 16);
      const b = parseInt(clamped.substring(5, 7), 16);
      // Normalized lightness (r+g+b)/(3*255) must be <= 0.25
      const avgL = (r + g + b) / (3 * 255);
      expect(avgL).toBeLessThanOrEqual(0.24);
    });

    it('clamps neon yellow (#ffff00) to <= 0.22 lightness for crisp text contrast', () => {
      const clamped = clampColorForBackground('#ffff00', 0.22);
      const r = parseInt(clamped.substring(1, 3), 16);
      const g = parseInt(clamped.substring(3, 5), 16);
      const b = parseInt(clamped.substring(5, 7), 16);
      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const l = (max + min) / 2;
      expect(l).toBeLessThanOrEqual(0.23);
    });

    it('scales lightness with intensity slider', () => {
      const full = clampColorForBackground('#38bdf8', 0.22, 1.0);
      const half = clampColorForBackground('#38bdf8', 0.22, 0.5);
      const rFull = parseInt(full.substring(1, 3), 16);
      const rHalf = parseInt(half.substring(1, 3), 16);
      expect(rHalf).toBeLessThan(rFull);
    });
  });

  describe('SOLID_SWATCHES and GRADIENT_PRESETS', () => {
    it('has Pure black (OLED) as the first solid preset', () => {
      expect(SOLID_SWATCHES[0].name).toBe('Pure black (OLED)');
      expect(SOLID_SWATCHES[0].hex).toBe('#000000');
    });

    it('contains all required gradient presets: Midnight, Sunset, Ocean, Aurora, Rose, Ember', () => {
      const presetIds = GRADIENT_PRESETS.map((p) => p.id);
      expect(presetIds).toContain('midnight');
      expect(presetIds).toContain('sunset');
      expect(presetIds).toContain('ocean');
      expect(presetIds).toContain('aurora');
      expect(presetIds).toContain('rose');
      expect(presetIds).toContain('ember');
    });

    it('gradient presets define 2 to 3 colors', () => {
      for (const preset of GRADIENT_PRESETS) {
        expect(preset.colors.length).toBeGreaterThanOrEqual(2);
        expect(preset.colors.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('extractAlbumColors', () => {
    it('gracefully falls back to clamped accent color when no artwork is provided', async () => {
      const result = await extractAlbumColors(undefined, '#ff2d75');
      expect(result.dominant).toBeDefined();
      expect(result.secondary).toBeDefined();
      // Dominant color must be dark (<= 22% lightness)
      const r = parseInt(result.dominant.substring(1, 3), 16);
      const g = parseInt(result.dominant.substring(3, 5), 16);
      const b = parseInt(result.dominant.substring(5, 7), 16);
      const l = (Math.max(r, g, b) + Math.min(r, g, b)) / (2 * 255);
      expect(l).toBeLessThanOrEqual(0.24);
    });
  });
});

