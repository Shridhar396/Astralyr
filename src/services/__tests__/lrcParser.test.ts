import { describe, it, expect } from 'vitest';
import { LrcService } from '../lrcService';

describe('LrcService', () => {
  it('parses synchronized lyrics correctly', () => {
    const lrc = `
[00:01.50]Hello starry night
[00:04.20]Constellation shines bright
`;
    const result = LrcService.parseLrc(lrc, 10);
    expect(result.length).toBe(2);
    expect(result[0].startTime).toBeCloseTo(1.5, 1);
    expect(result[0].text).toBe('Hello starry night');
    expect(result[1].startTime).toBeCloseTo(4.2, 1);
    expect(result[1].text).toBe('Constellation shines bright');
  });

  it('cleans track titles reliably', () => {
    expect(LrcService.cleanTrackTitle('29 Rockstar (Official Audio) [Lyrics]')).toBe('Rockstar');
    expect(LrcService.cleanTrackTitle('Song Title - Remastered 2021')).toBe('Song Title');
  });

  it('handles empty or malformed strings gracefully', () => {
    expect(LrcService.parseLrc('')).toEqual([]);
    expect(LrcService.parseLrc('Plain text without timestamps')).toEqual([]);
  });
});
