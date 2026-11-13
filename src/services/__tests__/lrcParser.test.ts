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

  describe('parseTabTitleHint', () => {
    it('parses browser tab titles for YouTube videos like Sia - Snowman', () => {
      const hint1 = LrcService.parseTabTitleHint('Tab (Sia - Snowman (Official Video))');
      expect(hint1).toEqual({
        rawLabel: 'Tab (Sia - Snowman (Official Video))',
        artist: 'Sia',
        title: 'Snowman',
      });

      const hint2 = LrcService.parseTabTitleHint('Sia - Snowman (Official Music Video) - YouTube');
      expect(hint2).toEqual({
        rawLabel: 'Sia - Snowman (Official Music Video) - YouTube',
        artist: 'Sia',
        title: 'Snowman',
      });

      const hint3 = LrcService.parseTabTitleHint('Tab (Sia – Snowman)');
      expect(hint3).toEqual({
        rawLabel: 'Tab (Sia – Snowman)',
        artist: 'Sia',
        title: 'Snowman',
      });

      const hint4 = LrcService.parseTabTitleHint('Snowman by Sia - YouTube');
      expect(hint4).toEqual({
        rawLabel: 'Snowman by Sia - YouTube',
        artist: 'Sia',
        title: 'Snowman',
      });
    });

    it('rejects self app titles and non-music capture labels', () => {
      expect(LrcService.parseTabTitleHint('Constella — your music, as a constellation')).toBeNull();
      expect(LrcService.parseTabTitleHint('Entire Screen')).toBeNull();
      expect(LrcService.parseTabTitleHint('')).toBeNull();
      expect(LrcService.parseTabTitleHint(null)).toBeNull();
    });
  });
});
