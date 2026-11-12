import { MusicTrack } from '../types/lyrics';

export interface AudiusTrackRaw {
  id: string;
  title: string;
  duration: number;
  user: {
    name: string;
    handle: string;
  };
  artwork?: {
    '150x150'?: string;
    '480x480'?: string;
    '1000x1000'?: string;
  };
  genre?: string;
}

export class AudiusService {
  private static readonly APP_NAME = 'weyv';
  private static readonly BASE_URL = 'https://api.audius.co/v1';

  /**
   * Fetches trending tracks from Audius API
   */
  public static async fetchTrending(limit: number = 20): Promise<MusicTrack[]> {
    try {
      const url = `${this.BASE_URL}/tracks/trending?app_name=${this.APP_NAME}&limit=${limit}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Audius API error: ${resp.status}`);
      }

      const json = await resp.json();
      const rawTracks: AudiusTrackRaw[] = json.data || [];

      return rawTracks.map((t) => this.mapToMusicTrack(t));
    } catch (err) {
      console.warn('[AudiusService] Failed to fetch trending tracks:', err);
      return [];
    }
  }

  /**
   * Searches tracks on Audius API
   */
  public static async searchTracks(query: string, limit: number = 15): Promise<MusicTrack[]> {
    try {
      const url = `${this.BASE_URL}/tracks/search?query=${encodeURIComponent(query)}&app_name=${this.APP_NAME}&limit=${limit}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Audius search error: ${resp.status}`);
      }

      const json = await resp.json();
      const rawTracks: AudiusTrackRaw[] = json.data || [];

      return rawTracks.map((t) => this.mapToMusicTrack(t));
    } catch (err) {
      console.warn('[AudiusService] Search error:', err);
      return [];
    }
  }

  /**
   * Maps raw Audius track to application MusicTrack format
   */
  private static mapToMusicTrack(t: AudiusTrackRaw): MusicTrack {
    // Audius stream endpoint redirects via HTTP 302 to high-speed CDN audio
    const streamUrl = `${this.BASE_URL}/tracks/${t.id}/stream?app_name=${this.APP_NAME}`;

    return {
      id: `audius-${t.id}`,
      title: t.title.trim(),
      artist: t.user?.name ? t.user.name.trim() : 'Audius Artist',
      album: t.genre || 'Audius Trending',
      duration: t.duration || 180,
      audioUrl: streamUrl,
      primaryColor: '#ffffff',
      secondaryColor: '#94a3b8',
      accentGlow: 'rgba(255, 255, 255, 0.75)',
    };
  }
}

