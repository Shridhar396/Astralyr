import { LyricLine, TimedWord, MusicTrack } from '../types/lyrics';

export interface ParsedTrackInfo {
  artist: string;
  title: string;
}

export interface LrcMatchResult {
  syncedLyrics: string;
  trackName: string;
  artistName: string;
  duration?: number;
}

export class LrcService {
  /**
   * Cleans track title:
   * - Strips leading track numbers ("29 ", "01. ", "02 - ")
   * - Strips bracketed tags "(Rockstar)", "(SPOTISAVER)", "(Official Audio/Video)", "[Lyrics]", "[Official]"
   * - Strips suffixes "- Remastered", "- Single Version", "- Live", etc.
   * - Strips "feat./ft./featuring/with ..."
   * - Strips emojis and extra punctuation
   */
  public static cleanTrackTitle(title: string): string {
    if (!title) return '';
    let clean = title;

    // 1. Strip leading track numbers like "29 ", "01. ", "02 - ", "1 "
    clean = clean.replace(/^\s*\d{1,3}[\s.\-_–—]+\s*/, '');

    // 2. Remove text inside parentheses or brackets: (SPOTISAVER), [Official Video], (Lyrics), (Rockstar)
    clean = clean.replace(/\(.*?\)/g, ' ').replace(/\[.*?\]/g, ' ');

    // 3. Strip "- Remastered...", "- Remaster 2011", etc.
    clean = clean.replace(/[\-_–—]\s*remaster(ed)?(\s*\d{4})?.*/gi, '');
    clean = clean.replace(/[\-_–—]\s*(live|deluxe|bonus|single\s*version|acoustic).*/gi, '');

    // 4. Strip "feat. xyz", "ft. xyz", "featuring xyz", "with xyz"
    clean = clean.replace(/\b(feat|ft|featuring|with)\b\.?.*$/gi, '');

    // 5. Strip common standalone noise words
    clean = clean.replace(
      /\b(spotisaver|official\s*(audio|video|music\s*video|lyric\s*video|visualizer)?|sped\s*up|slowed|nightcore|reverb|remix|edit|vip|bootleg|flip|cover|lyrics?|audio|video|hd|hq|320kbps|128kbps|flac|wav|mp3)\b/gi,
      ''
    );

    // 6. Strip emojis and unicode symbols
    clean = clean.replace(
      /[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ''
    );

    // 7. Strip extra punctuation and normalize whitespace
    clean = clean.replace(/[\-_–—|~*#@$^&]+/g, ' ').replace(/\s+/g, ' ').trim();

    return clean || title.trim();
  }

  /**
   * Cleans artist name:
   * Strips leading numbers, bracketed tags, feat/with, emojis, and punctuation.
   */
  public static cleanArtist(artist: string): string {
    if (!artist) return '';
    let clean = artist;

    clean = clean.replace(/^\s*\d{1,3}[\s.\-_–—]+\s*/, '');
    clean = clean.replace(/\(.*?\)/g, ' ').replace(/\[.*?\]/g, ' ');
    clean = clean.replace(/\b(feat|ft|featuring|with)\b\.?.*$/gi, '');
    clean = clean.replace(
      /[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ''
    );
    clean = clean.replace(/[\-_–—|~*#@$^&]+/g, ' ').replace(/\s+/g, ' ').trim();

    return clean || artist.trim();
  }

  /**
   * Checks whether LRC string actually contains timestamp tags [mm:ss.xx].
   * If there are no timestamps, it's plain lyrics only -> treated as no synced lyrics.
   */
  public static hasSyncedTimestamps(lrcText?: string | null): boolean {
    if (!lrcText || lrcText.trim().length === 0) return false;
    return /\[\d{2}:\d{2}\.\d{2,3}\]/.test(lrcText);
  }

  /**
   * Parses Artist and Title from local audio filename.
   */
  public static parseArtistTitleFromFilename(filename: string): ParsedTrackInfo {
    let clean = filename.replace(/\.[^/.]+$/, '').trim();

    const separators = [' - ', ' – ', ' — ', '_'];
    for (const sep of separators) {
      if (clean.includes(sep)) {
        const parts = clean.split(sep).map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          return {
            artist: this.cleanArtist(parts[0]),
            title: this.cleanTrackTitle(parts.slice(1).join(' ')),
          };
        }
      }
    }

    return {
      artist: '',
      title: this.cleanTrackTitle(clean),
    };
  }

  /**
   * Parses raw .lrc string into an array of LyricLines with word-level timing.
   */
  public static parseLrc(lrcText: string, totalDuration: number = 240): LyricLine[] {
    if (!this.hasSyncedTimestamps(lrcText)) return [];

    const lines = lrcText.split('\n');
    const rawParsed: { time: number; text: string }[] = [];

    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(timeRegex);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const fraction = parseFloat(`0.${match[3]}`);
        const totalTime = minutes * 60 + seconds + fraction;
        const text = match[4].trim();

        if (text) {
          rawParsed.push({ time: totalTime, text });
        }
      }
    }

    rawParsed.sort((a, b) => a.time - b.time);

    const result: LyricLine[] = [];

    for (let i = 0; i < rawParsed.length; i++) {
      const current = rawParsed[i];
      const nextTime = i < rawParsed.length - 1 ? rawParsed[i + 1].time : totalDuration;
      const lineDuration = Math.min(12, Math.max(2.5, nextTime - current.time));
      const lineEndTime = current.time + lineDuration;

      const rawWords = current.text.split(/\s+/).filter((w) => w.length > 0);
      const timedWords: TimedWord[] = [];

      if (rawWords.length > 0) {
        const totalChars = rawWords.reduce((acc, w) => acc + w.length, 0);
        let wordStart = current.time;

        for (let j = 0; j < rawWords.length; j++) {
          const w = rawWords[j];
          const proportion = w.length / (totalChars || 1);
          const wordDuration = Math.max(0.25, lineDuration * proportion * 0.9);
          const wordEnd = wordStart + wordDuration;

          timedWords.push({
            text: w,
            startTime: wordStart,
            endTime: wordEnd,
          });

          wordStart = wordEnd + (lineDuration * 0.1) / rawWords.length;
        }
      }

      result.push({
        startTime: current.time,
        endTime: lineEndTime,
        text: current.text,
        words: timedWords,
      });
    }

    return result;
  }

  /**
   * Fetches synced (LRC) lyrics from LRCLIB:
   * 1. Checks localStorage cache (including negative results).
   * 2. Cleans title and artist.
   * 3. Queries /api/get with cleaned artist, title and duration.
   * 4. If fails, queries /api/search with "title artist", then "title" only.
   * 5. Filters results by duration closest to audio duration (within ±3s). Rejects results beyond that.
   * 6. Treats non-synced plain lyrics as "no synced lyrics".
   * 7. Enforces a 5-second timeout.
   */
  public static async searchSyncedLyricsWithDuration(
    trackName: string,
    artistName?: string,
    audioDuration?: number,
    timeoutMs = 5000
  ): Promise<LrcMatchResult | null> {
    try {
      const cleanTrack = this.cleanTrackTitle(trackName);
      const cleanArtist = artistName ? this.cleanArtist(artistName) : '';

      if (!cleanTrack) return null;

      const durKey = audioDuration && audioDuration > 0 ? Math.round(audioDuration) : 0;
      const cacheKey = `lrclib_auto_v3_${cleanArtist.toLowerCase().replace(/\W+/g, '_')}_${cleanTrack.toLowerCase().replace(/\W+/g, '_')}_${durKey}`;

      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.notFound) {
            console.log(`[LrcService] Cache HIT (Not Found) for: "${cleanTrack}" by "${cleanArtist}"`);
            return null;
          }
          if (parsed?.syncedLyrics && this.hasSyncedTimestamps(parsed.syncedLyrics)) {
            console.log(`[LrcService] Cache HIT for: "${cleanTrack}" by "${cleanArtist}"`);
            return parsed;
          }
        }
      } catch (err) {
        console.warn('[LrcService] Cache read error:', err);
      }

      console.log(
        `[LrcService] Fetching LRCLIB for: "${cleanTrack}" by "${cleanArtist}" (Duration: ${
          audioDuration ? audioDuration.toFixed(1) + 's' : 'unknown'
        })`
      );

      interface LrcRecord {
        id?: number;
        trackName?: string;
        artistName?: string;
        duration?: number;
        syncedLyrics?: string;
        plainLyrics?: string;
      }

      const saveCacheAndReturn = (result: LrcMatchResult) => {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch (e) {
          console.warn('[LrcService] Cache save error:', e);
        }
        return result;
      };

      const markNotFoundAndReturn = () => {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ notFound: true, timestamp: Date.now() }));
        } catch (e) {
          console.warn('[LrcService] Cache save error:', e);
        }
        return null;
      };

      // Helper with 5-second timeout
      const fetchWithTimeout = async (url: string): Promise<Response> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);
          return res;
        } catch (err) {
          clearTimeout(timer);
          throw err;
        }
      };

      // STEP 1: Direct GET with cleaned artist, title and duration
      if (cleanArtist && audioDuration && audioDuration > 0) {
        try {
          const getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(
            cleanArtist
          )}&track_name=${encodeURIComponent(cleanTrack)}&duration=${Math.round(audioDuration)}`;
          const res = await fetchWithTimeout(getUrl);
          if (res.ok) {
            const data: LrcRecord = await res.json();
            if (this.hasSyncedTimestamps(data?.syncedLyrics)) {
              // Verify duration proximity within 3s if duration is present
              const durationDiff =
                typeof data.duration === 'number' ? Math.abs(data.duration - audioDuration) : 0;
              if (durationDiff <= 3.0) {
                console.log(
                  `[LrcService] Exact GET match: "${data.trackName}" by ${data.artistName} (Δ${durationDiff.toFixed(1)}s)`
                );
                return saveCacheAndReturn({
                  syncedLyrics: data.syncedLyrics!,
                  trackName: data.trackName || cleanTrack,
                  artistName: data.artistName || cleanArtist,
                  duration: data.duration,
                });
              }
            }
          }
        } catch (err) {
          console.warn('[LrcService] Direct GET with duration failed:', err);
        }
      }

      // STEP 2: Fallback to /api/search with "title artist", then "title" only
      const searchQueries: string[] = [];
      if (cleanArtist) {
        searchQueries.push(`q=${encodeURIComponent(`${cleanTrack} ${cleanArtist}`)}`);
      }
      searchQueries.push(`q=${encodeURIComponent(cleanTrack)}`);

      for (const queryParam of searchQueries) {
        try {
          const searchUrl = `https://lrclib.net/api/search?${queryParam}`;
          const res = await fetchWithTimeout(searchUrl);
          if (res.ok) {
            const results: LrcRecord[] = await res.json();
            if (Array.isArray(results) && results.length > 0) {
              // Only consider candidates with verified synced timestamps
              const syncedCandidates = results.filter((r) => this.hasSyncedTimestamps(r.syncedLyrics));

              if (syncedCandidates.length > 0) {
                if (audioDuration && audioDuration > 0) {
                  // Filter strictly to results within ±3.0 seconds
                  const validDurationMatches = syncedCandidates.filter(
                    (r) => typeof r.duration === 'number' && Math.abs(r.duration - audioDuration) <= 3.0
                  );

                  if (validDurationMatches.length > 0) {
                    // Pick the closest duration
                    validDurationMatches.sort(
                      (a, b) =>
                        Math.abs((a.duration || 0) - audioDuration) -
                        Math.abs((b.duration || 0) - audioDuration)
                    );
                    const best = validDurationMatches[0];
                    console.log(
                      `[LrcService] Search duration match (±3s): "${best.trackName}" by ${best.artistName} (diff: ${Math.abs(
                        (best.duration || 0) - audioDuration
                      ).toFixed(1)}s)`
                    );
                    return saveCacheAndReturn({
                      syncedLyrics: best.syncedLyrics!,
                      trackName: best.trackName || cleanTrack,
                      artistName: best.artistName || cleanArtist,
                      duration: best.duration,
                    });
                  } else {
                    console.log(
                      `[LrcService] Candidates found for "${cleanTrack}", but none within ±3s of audio duration (${audioDuration.toFixed(1)}s). Rejecting.`
                    );
                    // Reject results beyond ±3s
                  }
                } else {
                  // No audio duration specified: take first synced match
                  const best = syncedCandidates[0];
                  return saveCacheAndReturn({
                    syncedLyrics: best.syncedLyrics!,
                    trackName: best.trackName || cleanTrack,
                    artistName: best.artistName || cleanArtist,
                    duration: best.duration,
                  });
                }
              }
            }
          }
        } catch (err) {
          console.warn(`[LrcService] Search query "${queryParam}" failed:`, err);
        }
      }

      console.log(`[LrcService] No matching synced lyrics (±3s) found for "${cleanTrack}".`);
      return markNotFoundAndReturn();
    } catch (err) {
      console.warn('[LrcService] Search error:', err);
      return null;
    }
  }

  /**
   * Direct fetch wrapper
   */
  public static async fetchLyrics(trackName: string, artistName: string, duration?: number): Promise<string | null> {
    const res = await this.searchSyncedLyricsWithDuration(trackName, artistName, duration);
    return res ? res.syncedLyrics : null;
  }
}

/**
 * Built-in Demo Tracks with reliable local /demo.wav audio asset
 */
export const DEMO_TRACKS: MusicTrack[] = [
  {
    id: 'ambient-demo',
    title: 'Constellation Ambient (Lo-Fi Chill)',
    artist: 'Antigravity Soundscapes',
    album: 'Starlight Horizons',
    duration: 40,
    audioUrl: '/demo.wav',
    primaryColor: '#ffffff',
    secondaryColor: '#94a3b8',
    accentGlow: 'rgba(255, 255, 255, 0.75)',
    rawLrc: `[00:02.00] In the silence of the midnight city
[00:06.50] Neon echoes drift across the sky
[00:11.20] Every star is whispering a secret
[00:16.80] In the quiet glow of passing time
[00:22.40] Electric pulses moving through the wires
[00:28.00] Mapping out constellations in the dark
[00:33.80] We are wanderers beneath the starlight
[00:38.00] Igniting fire from a gentle spark`,
  },
];
