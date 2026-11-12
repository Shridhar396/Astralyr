export interface AudiusTrackItem {
  id: string;
  title: string;
  artist: string;
  duration: number; // seconds
  streamUrl: string;
  artworkUrl?: string;
  genre?: string;
}

export class MusicSearchService {
  private static readonly APP_NAME = 'weyv';
  private static readonly BASE_URL = 'https://api.audius.co/v1';

  /**
   * Fetches trending tracks on Audius on initial drawer open
   */
  public static async fetchTrending(limit: number = 25): Promise<AudiusTrackItem[]> {
    try {
      const url = `${this.BASE_URL}/tracks/trending?app_name=${this.APP_NAME}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Audius trending returned status ${res.status}`);
      }

      const json = await res.json();
      const rawList = json.data || [];
      return rawList.map((t: any) => this.mapRawTrack(t));
    } catch (err) {
      console.warn('[MusicSearchService] Failed to load trending tracks:', err);
      return [];
    }
  }

  /**
   * Live search query on Audius API with debouncing support
   */
  public static async searchTracks(query: string, limit: number = 25): Promise<AudiusTrackItem[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return this.fetchTrending(limit);
    }

    try {
      const url = `${this.BASE_URL}/tracks/search?query=${encodeURIComponent(trimmed)}&app_name=${this.APP_NAME}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Audius search returned status ${res.status}`);
      }

      const json = await res.json();
      const rawList = json.data || [];
      return rawList.map((t: any) => this.mapRawTrack(t));
    } catch (err) {
      console.warn('[MusicSearchService] Failed to search tracks:', err);
      return [];
    }
  }

  /**
   * Constructs the direct streaming audio URL for an Audius track
   */
  public static getStreamUrl(trackId: string): string {
    return `${this.BASE_URL}/tracks/${trackId}/stream?app_name=${this.APP_NAME}`;
  }

  private static mapRawTrack(t: any): AudiusTrackItem {
    const streamUrl = this.getStreamUrl(t.id);
    const artwork =
      t.artwork?.['150x150'] ||
      t.artwork?.['480x480'] ||
      t.artwork?.['1000x1000'] ||
      undefined;

    return {
      id: t.id,
      title: (t.title || 'Untitled Track').trim(),
      artist: (t.user?.name || t.user?.handle || 'Unknown Artist').trim(),
      duration: t.duration || 180,
      streamUrl,
      artworkUrl: artwork,
      genre: t.genre || 'Electronic',
    };
  }
}

