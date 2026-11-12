import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DEMO_TRACKS, LrcService } from './services/lrcService';
import { Id3Parser } from './services/id3Parser';
import { MusicTrack, LyricLine } from './types/lyrics';
import { AudiusTrackItem } from './services/musicSearchService';
import { PlaybackState, AudioVisualizerData } from './types/radio';
import { DesktopWindowMode, VisualizerSettings } from './types/visualizer';
import { AudioManager } from './services/audioManager';
import {
  setDesktopMode,
  setClickThrough,
  subscribeToTauriEvents,
} from './services/tauriBridge';
import { ConstellationLyricEngine } from './components/ConstellationLyricEngine';
import { CenteredAudioRing } from './components/CenteredAudioRing';
import { AmbientEdgeLight } from './components/AmbientEdgeLight';
import { LockScreenClock } from './components/LockScreenClock';
import { BottomTrackPill, AmbientColorConfig } from './components/BottomTrackPill';
import { LrcSearchModal } from './components/LrcSearchModal';
import { AudiusModal } from './components/AudiusModal';
import { SettingsDrawer } from './components/SettingsDrawer';
import { AppearanceModal } from './components/AppearanceModal';
import { AboutModal } from './components/AboutModal';
import { LibraryModal } from './components/LibraryModal';
import { PlaylistNamingModal } from './components/PlaylistNamingModal';
import { AddToPlaylistModal } from './components/AddToPlaylistModal';
import { ToastNotification, ToastData } from './components/ToastNotification';
import { playlistDb, Playlist, PlaylistTrack } from './services/playlistDb';
import {
  AppearanceConfig,
  loadStoredAppearance,
  saveStoredAppearance,
  DEFAULT_APPEARANCE_CONFIG,
} from './services/appearanceConfig';
import { DesktopModeBar } from './components/DesktopModeBar';

function hexToRgb(hex: string): [number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return [240, 246, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
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
    b = 0;
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

function desaturateRgb([r, g, b]: [number, number, number], maxSat = 0.35): [number, number, number] {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  return [
    Math.round(gray + (r - gray) * maxSat),
    Math.round(gray + (g - gray) * maxSat),
    Math.round(gray + (b - gray) * maxSat),
  ];
}

const DEFAULT_COLOR_CONFIG: AmbientColorConfig = {
  mode: 'preset',
  presetColor: '#ffffff',
  customColor: '#a855f7',
  intensity: 1.0,
};

export const App: React.FC = () => {
  const [trackIndex, setTrackIndex] = useState(0);
  const [tracks, setTracks] = useState<MusicTrack[]>(DEMO_TRACKS);
  const currentTrack = tracks[trackIndex] || DEMO_TRACKS[0];

  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(currentTrack.duration || 40);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);

  // Automatic Mode: 'lyrics' by default; fallback to 'ring' when no synced lyrics found
  const [visualizerMode, setVisualizerMode] = useState<'lyrics' | 'ring'>('lyrics');
  const [isSyncingLyrics, setIsSyncingLyrics] = useState(false);

  // Appearance Settings (Time, Date, Fonts, Lyrics) with live persistence
  const [appearanceConfig, setAppearanceConfig] = useState<AppearanceConfig>(loadStoredAppearance);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Manual Sync Offset in seconds (-0.5s, 0.0s, +0.5s) per track with persistence
  const [syncOffset, setSyncOffset] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`sync_offset_${currentTrack?.id}`) || localStorage.getItem('sync_offset');
      return saved ? parseFloat(saved) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const syncOffsetRef = useRef(syncOffset);
  syncOffsetRef.current = syncOffset;

  // Restore sync offset on track change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sync_offset_${currentTrack?.id}`);
      if (saved !== null) {
        setSyncOffset(parseFloat(saved) || 0);
      } else {
        const globalSaved = localStorage.getItem('sync_offset');
        setSyncOffset(globalSaved ? parseFloat(globalSaved) || 0 : 0);
      }
    } catch {}
  }, [currentTrack?.id]);

  const handleAdjustOffset = useCallback((delta: number) => {
    setSyncOffset((prev) => {
      const next = +(prev + delta).toFixed(2);
      try {
        localStorage.setItem(`sync_offset_${currentTrack?.id}`, String(next));
        localStorage.setItem('sync_offset', String(next));
      } catch {}
      return next;
    });
  }, [currentTrack?.id]);

  const handleResetOffset = useCallback(() => {
    setSyncOffset(0);
    try {
      localStorage.setItem(`sync_offset_${currentTrack?.id}`, '0');
      localStorage.setItem('sync_offset', '0');
    } catch {}
  }, [currentTrack?.id]);

  // Library & Playlists State (IndexedDB)
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isNamingOpen, setIsNamingOpen] = useState(false);
  const [namingMode, setNamingMode] = useState<'create' | 'rename'>('create');
  const [playlistToRename, setPlaylistToRename] = useState<Playlist | null>(null);
  const [trackToAutoAdd, setTrackToAutoAdd] = useState<PlaylistTrack | null>(null);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [trackForPlaylist, setTrackForPlaylist] = useState<PlaylistTrack | null>(null);
  const [isCurrentTrackFavorited, setIsCurrentTrackFavorited] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = useCallback((message: string, action?: { label: string; onClick: () => void }) => {
    setToast({
      id: String(Date.now()),
      message,
      action,
      durationMs: 5000,
    });
  }, []);

  const refreshPlaylists = useCallback(async () => {
    try {
      const all = await playlistDb.getAllPlaylists();
      setPlaylists(all);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    refreshPlaylists();
    const unsub = playlistDb.subscribe(refreshPlaylists);
    return unsub;
  }, [refreshPlaylists]);

  // Check if current track is in Favorites
  useEffect(() => {
    if (!currentTrack) return;
    playlistDb.isTrackInFavorites(currentTrack.id).then(setIsCurrentTrackFavorited);
  }, [currentTrack?.id, playlists]);

  // Convert currentTrack or Audius item to PlaylistTrack format
  const toPlaylistTrack = useCallback((item: any): PlaylistTrack => {
    return {
      id: String(item.id || item.audioUrl || Date.now()),
      title: item.title || 'Unknown Title',
      artist: item.artist || item.user?.name || 'Unknown Artist',
      duration: item.duration || 0,
      artworkUrl: item.artworkUrl || item.artwork?.['480x480'] || item.artwork?.['150x150'],
      audioUrl: item.audioUrl || (item.id ? `https://api.audius.co/v1/tracks/${item.id}/stream?app_name=weyv` : ''),
      rawLrc: item.rawLrc,
      addedAt: Date.now(),
    };
  }, []);

  const handleToggleFavorite = useCallback(async () => {
    if (!currentTrack) return;
    const plTrack = toPlaylistTrack(currentTrack);
    const added = await playlistDb.toggleFavorite(plTrack);
    setIsCurrentTrackFavorited(added);
    showToast(added ? 'Added to Favorites' : 'Removed from Favorites');
  }, [currentTrack, toPlaylistTrack, showToast]);

  const handleOpenAddToPlaylist = useCallback((track: any) => {
    setTrackForPlaylist(toPlaylistTrack(track));
    setIsAddToPlaylistOpen(true);
  }, [toPlaylistTrack]);

  const handleToggleTrackInPlaylist = useCallback(async (playlistId: string, track: PlaylistTrack) => {
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return;
    const inPlaylist = pl.tracks.some(t => t.id === track.id || (t.title.toLowerCase() === track.title.toLowerCase() && t.artist.toLowerCase() === track.artist.toLowerCase()));
    if (inPlaylist) {
      await playlistDb.removeTrackFromPlaylist(playlistId, track.id);
      showToast(`Removed from "${pl.name}"`);
    } else {
      const res = await playlistDb.addTrackToPlaylist(playlistId, track);
      if (res.isDuplicate) {
        showToast(`Already in "${pl.name}"`);
      } else {
        showToast(`Added to "${pl.name}"`);
      }
    }
  }, [playlists, showToast]);

  const handleCreatePlaylistSubmit = useCallback(async (name: string, coverColor?: string, coverEmoji?: string) => {
    try {
      const newPl = await playlistDb.createPlaylist(name, {
        coverColor,
        coverEmoji,
        initialTracks: trackToAutoAdd ? [trackToAutoAdd] : [],
      });
      showToast(`Created playlist "${newPl.name}"`);
      if (trackToAutoAdd) {
        showToast(`Added "${trackToAutoAdd.title}" to "${newPl.name}"`);
        setTrackToAutoAdd(null);
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to create playlist');
    }
  }, [trackToAutoAdd, showToast]);

  const handleRenamePlaylistSubmit = useCallback(async (name: string, coverColor?: string, coverEmoji?: string) => {
    if (!playlistToRename) return;
    try {
      const updated = await playlistDb.renamePlaylist(playlistToRename.id, name, { coverColor, coverEmoji });
      showToast(`Renamed playlist to "${updated.name}"`);
      setPlaylistToRename(null);
    } catch (e: any) {
      showToast(e.message || 'Failed to rename playlist');
    }
  }, [playlistToRename, showToast]);

  const handlePlayTrackFromPlaylist = useCallback(async (track: PlaylistTrack, queue: PlaylistTrack[]) => {
    const convertedQueue: MusicTrack[] = queue.map(t => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      audioUrl: t.audioUrl,
      duration: t.duration,
      rawLrc: t.rawLrc,
      artworkUrl: t.artworkUrl,
      primaryColor: '#ffffff',
      secondaryColor: '#94a3b8',
      accentGlow: 'rgba(255, 255, 255, 0.75)',
    }));
    setTracks(convertedQueue);
    const targetIdx = convertedQueue.findIndex(t => t.id === track.id);
    const finalIdx = targetIdx >= 0 ? targetIdx : 0;
    setTrackIndex(finalIdx);

    audioManager.current.resumeAudioContext();
    await audioManager.current.playUrl(track.audioUrl, true);
    setPlaybackState('playing');

    setIsSyncingLyrics(true);
    const lyrics = await LrcService.fetchLyrics(track.title, track.artist, track.duration);
    setIsSyncingLyrics(false);
    if (lyrics) {
      convertedQueue[finalIdx].rawLrc = lyrics;
      setTracks([...convertedQueue]);
      setVisualizerMode('lyrics');
    } else {
      setVisualizerMode('ring');
    }
  }, []);

  const handleUpdateAppearance = useCallback((updated: Partial<AppearanceConfig>) => {
    setAppearanceConfig((prev) => {
      const next = { ...prev, ...updated };
      saveStoredAppearance(next);
      return next;
    });
  }, []);

  const handleResetAppearance = useCallback(() => {
    setAppearanceConfig(DEFAULT_APPEARANCE_CONFIG);
    saveStoredAppearance(DEFAULT_APPEARANCE_CONFIG);
  }, []);

  // Ambient Glow Color Config (saved & restored from localStorage)
  const [colorConfig, setColorConfig] = useState<AmbientColorConfig>(() => {
    try {
      const saved = localStorage.getItem('ambient_color_config_v2');
      if (saved) return { ...DEFAULT_COLOR_CONFIG, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_COLOR_CONFIG;
  });

  const colorConfigRef = useRef(colorConfig);
  colorConfigRef.current = colorConfig;

  // Single dynamic RGB ref for 60fps synchronous, zero-flicker canvas & CSS updates
  const accentRgbRef = useRef<[number, number, number]>([255, 255, 255]);

  const handleUpdateColorConfig = useCallback((cfg: Partial<AmbientColorConfig>) => {
    setColorConfig((prev) => {
      const updated = { ...prev, ...cfg };
      try {
        localStorage.setItem('ambient_color_config_v2', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save color config:', e);
      }
      return updated;
    });
  }, []);

  // Sync --accent CSS variable live whenever colorConfig or currentTrack changes
  useEffect(() => {
    if (colorConfig.mode === 'autocycle') return;
    let r = 255,
      g = 255,
      b = 255;
    if (colorConfig.mode === 'album') {
      const raw = hexToRgb(currentTrack.primaryColor || '#ffffff');
      [r, g, b] = desaturateRgb(raw, 0.45);
    } else if (colorConfig.mode === 'custom') {
      [r, g, b] = hexToRgb(colorConfig.customColor);
    } else if (colorConfig.mode === 'preset') {
      [r, g, b] = hexToRgb(colorConfig.presetColor);
    }
    accentRgbRef.current = [r, g, b];
    document.documentElement.style.setProperty('--accent', `${r} ${g} ${b}`);
    document.documentElement.style.setProperty('--accent-rgb', `rgb(${r}, ${g}, ${b})`);
    document.documentElement.style.setProperty('--accent-hex', rgbToHex(r, g, b));
  }, [colorConfig, currentTrack.primaryColor]);

  // Compute active RGB for Ambient Edge Glow and Centered Audio Ring
  const ambientColorRgb: [number, number, number] = useMemo(() => {
    if (colorConfig.mode === 'album') {
      const raw = hexToRgb(currentTrack.primaryColor || '#ffffff');
      return desaturateRgb(raw, 0.4);
    }
    if (colorConfig.mode === 'custom') {
      return hexToRgb(colorConfig.customColor);
    }
    if (colorConfig.mode === 'preset') {
      return hexToRgb(colorConfig.presetColor);
    }
    return [255, 255, 255];
  }, [colorConfig, currentTrack.primaryColor]);

  // Hex color for accent ring tinting on active words
  const activeColorHex = useMemo(() => {
    if (colorConfig.mode === 'album') return currentTrack.primaryColor || '#ffffff';
    if (colorConfig.mode === 'custom') return colorConfig.customColor;
    if (colorConfig.mode === 'autocycle') return '#ffffff';
    return colorConfig.presetColor;
  }, [colorConfig, currentTrack.primaryColor]);

  // Auto-hiding Bottom Control Drawer (~3s timer)
  const [isChromeVisible, setIsChromeVisible] = useState(false);
  const [isHoveringDrawer, setIsHoveringDrawer] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  // Desktop integration state
  const [desktopMode, setDesktopModeState] = useState<DesktopWindowMode>('normal');
  const [isClickThrough, setIsClickThrough] = useState(false);

  // Modals & Drawers
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAudiusOpen, setIsAudiusOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDesktopModesOpen, setIsDesktopModesOpen] = useState(false);

  // Visualizer settings
  const [settings, setSettings] = useState<VisualizerSettings>({
    mode: 'ambient-waveform',
    borderThickness: 3,
    glowSpread: 32,
    beatSensitivity: 1.35,
    beatGlowMultiplier: 1.8,
    fpsLimit: 60,
    barSpacing: 2,
    waveformSmoothness: 0.8,
    particleCount: 70,
    showParticles: true,
    colorSyncWithStation: false,
    customPrimaryColor: '#ffffff',
    customSecondaryColor: '#cbd5e1',
  });

  const audioManager = useRef(AudioManager.getInstance());
  const audioDataRef = useRef<AudioVisualizerData>({
    frequencyData: new Uint8Array(64),
    timeData: new Uint8Array(128),
    binCount: 64,
    averageFrequency: 0,
    subBassEnergy: 0,
    bassEnergy: 0,
    midEnergy: 0,
    trebleEnergy: 0,
    isBeat: false,
    peakDb: -90,
  });

  // Accurate audio time getter compensated for audio hardware output device buffer latency + user sync offset
  const getAcousticTime = useCallback(
    () => Math.max(0, audioManager.current.getAcousticTime() + syncOffsetRef.current),
    []
  );

  // Parsed Lyric Lines from currentTrack.rawLrc
  const lyricLines: LyricLine[] = useMemo(() => {
    if (!currentTrack.rawLrc || currentTrack.rawLrc.trim().length === 0) return [];
    return LrcService.parseLrc(currentTrack.rawLrc, duration);
  }, [currentTrack.rawLrc, duration]);

  // Update visualizerMode automatically whenever the track or its lyrics change
  useEffect(() => {
    const hasLyrics = Boolean(
      currentTrack.rawLrc &&
        currentTrack.rawLrc.trim().length > 0 &&
        LrcService.hasSyncedTimestamps(currentTrack.rawLrc)
    );
    setVisualizerMode(hasLyrics ? 'lyrics' : 'ring');
  }, [currentTrack.rawLrc]);

  // Audio manager setup & throttled RAF loop
  useEffect(() => {
    const mgr = audioManager.current;
    mgr.init();

    const unsub = mgr.onStateChange((state) => {
      setPlaybackState(state);
    });

    let animId: number;
    let lastTimeUpdate = 0;

    const loop = (timestamp: number) => {
      const data = mgr.getVisualizerData(settings.beatSensitivity);
      audioDataRef.current = data;

      // Smooth 60fps auto-cycle animation of --accent and accentRgbRef (zero flicker)
      if (colorConfigRef.current.mode === 'autocycle') {
        const hue = (timestamp * 0.018) % 360;
        const [r, g, b] = hslToRgb(hue, 0.75, 0.72);
        accentRgbRef.current = [r, g, b];
        document.documentElement.style.setProperty('--accent', `${r} ${g} ${b}`);
        document.documentElement.style.setProperty('--accent-rgb', `rgb(${r}, ${g}, ${b})`);
        document.documentElement.style.setProperty('--accent-hex', rgbToHex(r, g, b));
      }

      if (timestamp - lastTimeUpdate > 200) {
        const time = mgr.getAcousticTime();
        setCurrentTime(time);

        const dur = mgr.getDuration();
        if (dur > 0 && dur !== duration) {
          setDuration(dur);
        }
        lastTimeUpdate = timestamp;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      unsub();
      cancelAnimationFrame(animId);
    };
  }, [duration, settings.beatSensitivity]);

  // Auto-hide chrome on mouse move or keypress (~3s timeout)
  const resetHideTimer = useCallback(() => {
    setIsChromeVisible(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setIsChromeVisible(false);
    }, 3000);
  }, []);

  useEffect(() => {
    const onActivity = () => {
      resetHideTimer();
    };

    window.addEventListener('mousemove', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('mousedown', onActivity);
    window.addEventListener('touchstart', onActivity);

    // Initial show then fade to idle
    resetHideTimer();

    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('mousedown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  // Subscribe to Tauri backend events
  useEffect(() => {
    const unsub = subscribeToTauriEvents({
      onModeChange: (newMode) => {
        setDesktopModeState(newMode);
      },
      onTogglePlay: () => {
        handleTogglePlay();
      },
      onNextStation: () => {
        handleNextTrack();
      },
      onToggleHUD: () => {
        setIsChromeVisible((prev) => !prev);
      },
    });

    return () => unsub();
  }, []);

  // Handlers
  const handleTogglePlay = useCallback(async () => {
    const mgr = audioManager.current;
    await mgr.resumeAudioContext();

    if (playbackState === 'idle') {
      await mgr.playUrl(currentTrack.audioUrl);
    } else {
      await mgr.togglePlay(currentTrack.audioUrl);
    }
  }, [playbackState, currentTrack.audioUrl]);

  const handleNextTrack = useCallback(async () => {
    const nextIdx = (trackIndex + 1) % tracks.length;
    setTrackIndex(nextIdx);
    const nextTrk = tracks[nextIdx];
    await audioManager.current.resumeAudioContext();
    await audioManager.current.playUrl(nextTrk.audioUrl, true);
  }, [trackIndex, tracks]);

  const handlePrevTrack = useCallback(async () => {
    const prevIdx = (trackIndex - 1 + tracks.length) % tracks.length;
    setTrackIndex(prevIdx);
    const prevTrk = tracks[prevIdx];
    await audioManager.current.resumeAudioContext();
    await audioManager.current.playUrl(prevTrk.audioUrl, true);
  }, [trackIndex, tracks]);

  const handleSeek = useCallback((seconds: number) => {
    audioManager.current.seek(seconds);
    setCurrentTime(seconds);
  }, []);

  // Expose API for headless screenshot testing and verification
  useEffect(() => {
    (window as any).__VISUALIZER_API__ = {
      play: handleTogglePlay,
      seek: handleSeek,
      setColorConfig: handleUpdateColorConfig,
      loadHindiNoLyricsTrack: () => {
        const hindiTrack: MusicTrack = {
          id: 'hindi-demo-ring-fallback',
          title: 'Tum Hi Ho',
          artist: 'Arijit Singh',
          album: 'Aashiqui 2',
          duration: 40,
          audioUrl: '/demo.wav',
          rawLrc: '', // No synced lyrics -> triggers automatic 600ms crossfade to Ring visualizer
          primaryColor: '#f97316',
          secondaryColor: '#fdba74',
          accentGlow: 'rgba(249, 115, 22, 0.75)',
        };
        setTracks((prev) => [hindiTrack, ...prev.filter((t) => t.id !== hindiTrack.id)]);
        setTrackIndex(0);
        setVisualizerMode('ring');
      },
      loadEnglishLyricsTrack: () => {
        setTracks(DEMO_TRACKS);
        setTrackIndex(0);
        setVisualizerMode('lyrics');
      },
      openColorPicker: () => {
        setIsChromeVisible(true);
      },
      setAppearanceConfig: handleUpdateAppearance,
      openAppearanceModal: () => {
        setIsAppearanceOpen(true);
      },
      closeAppearanceModal: () => {
        setIsAppearanceOpen(false);
      },
      getCurrentTime: () => audioManager.current.getAcousticTime(),
      getMode: () => visualizerMode,
    };
  }, [handleTogglePlay, handleSeek, handleUpdateColorConfig, handleUpdateAppearance, visualizerMode]);

  const handleVolumeChange = useCallback((vol: number) => {
    setVolumeState(vol);
    audioManager.current.setVolume(vol);
    setIsMuted(false);
  }, []);

  const handleToggleMute = useCallback(() => {
    const muted = audioManager.current.toggleMute();
    setIsMuted(muted);
  }, []);

  const handleSelectDesktopMode = useCallback(async (mode: DesktopWindowMode) => {
    setDesktopModeState(mode);
    await setDesktopMode(mode);
  }, []);

  const handleToggleClickThrough = useCallback(async () => {
    const nextVal = !isClickThrough;
    setIsClickThrough(nextVal);
    await setClickThrough(nextVal);
  }, [isClickThrough]);

  // Load user's local audio file: extracts ID3 tags and queries LRCLIB
  const handleLoadLocalAudio = useCallback(async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setIsSyncingLyrics(true);

    // 1. Parse ID3 metadata (Title, Artist, Album, Cover Artwork)
    const id3Data = await Id3Parser.parseFile(file);
    const filenameParsed = LrcService.parseArtistTitleFromFilename(file.name);

    const title = id3Data.title || filenameParsed.title || 'Local Track';
    const artist = id3Data.artist || filenameParsed.artist || 'Local Audio';
    const artworkUrl = id3Data.artworkUrl;

    console.log(`[LocalAudio] Metadata extracted: "${title}" by "${artist}"`);

    const tempAudio = new Audio(objectUrl);
    tempAudio.onloadedmetadata = async () => {
      const audioDuration = tempAudio.duration;

      // 2. Query LRCLIB with 5s timeout & ±3s duration constraint
      const match = await LrcService.searchSyncedLyricsWithDuration(title, artist, audioDuration, 5000);
      setIsSyncingLyrics(false);

      const hasLyrics = Boolean(
        match && match.syncedLyrics && LrcService.hasSyncedTimestamps(match.syncedLyrics)
      );

      const newTrack: MusicTrack = {
        id: `local-${Date.now()}`,
        title: match?.trackName || title,
        artist: match?.artistName || artist,
        album: id3Data.album || 'Local Audio',
        duration: audioDuration,
        audioUrl: objectUrl,
        artworkUrl,
        rawLrc: hasLyrics ? match!.syncedLyrics : '',
        primaryColor: '#ffffff',
        secondaryColor: '#94a3b8',
        accentGlow: 'rgba(255, 255, 255, 0.75)',
      };

      setTracks((prev) => [newTrack, ...prev]);
      setTrackIndex(0);
      setDuration(audioDuration);
      setVisualizerMode(hasLyrics ? 'lyrics' : 'ring');

      const mgr = audioManager.current;
      await mgr.resumeAudioContext();
      await mgr.playUrl(objectUrl, true, true);
    };
  }, []);

  // Load Audius online track with automatic LRCLIB matching
  const handleSelectAudiusTrack = useCallback(async (item: AudiusTrackItem) => {
    console.log(`[Audius] Direct stream selected: "${item.title}" by ${item.artist} (${item.duration}s)`);
    setIsSyncingLyrics(true);

    const mgr = audioManager.current;
    await mgr.resumeAudioContext();
    await mgr.playUrl(item.streamUrl, true, false);

    const lrcMatch = await LrcService.searchSyncedLyricsWithDuration(item.title, item.artist, item.duration, 5000);
    setIsSyncingLyrics(false);

    const hasLyrics = Boolean(
      lrcMatch && lrcMatch.syncedLyrics && LrcService.hasSyncedTimestamps(lrcMatch.syncedLyrics)
    );

    const readyTrack: MusicTrack = {
      id: `audius-${item.id}`,
      title: item.title,
      artist: item.artist,
      album: item.genre || 'Audius Stream',
      duration: item.duration,
      audioUrl: item.streamUrl,
      artworkUrl: item.artworkUrl,
      rawLrc: hasLyrics ? lrcMatch!.syncedLyrics : '',
      primaryColor: '#ffffff',
      secondaryColor: '#94a3b8',
      accentGlow: 'rgba(255, 255, 255, 0.75)',
    };

    setTracks((prev) => [readyTrack, ...prev.filter((t) => t.id !== readyTrack.id)]);
    setTrackIndex(0);
    setDuration(item.duration);
    setVisualizerMode(hasLyrics ? 'lyrics' : 'ring');
  }, []);

  const handleApplyFetchedLyrics = useCallback(
    (title: string, artist: string, lrcText: string) => {
      const hasLyrics = Boolean(lrcText && LrcService.hasSyncedTimestamps(lrcText));
      const newTrack: MusicTrack = {
        id: `fetched-${Date.now()}`,
        title,
        artist,
        duration: duration || 210,
        audioUrl: currentTrack.audioUrl,
        rawLrc: hasLyrics ? lrcText : '',
        primaryColor: currentTrack.primaryColor,
        secondaryColor: currentTrack.secondaryColor,
        accentGlow: currentTrack.accentGlow,
      };

      setTracks((prev) => [newTrack, ...prev]);
      setTrackIndex(0);
      setVisualizerMode(hasLyrics ? 'lyrics' : 'ring');
      audioManager.current.seek(0);
    },
    [currentTrack, duration]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'KeyM') {
        handleToggleMute();
      } else if (e.code === 'KeyW') {
        handleSelectDesktopMode('wallpaper');
      } else if (e.code === 'KeyF') {
        handleSelectDesktopMode('theatre');
      } else if (e.code === 'KeyT') {
        handleToggleClickThrough();
      } else if (e.code === 'ArrowRight') {
        handleNextTrack();
      } else if (e.code === 'ArrowLeft') {
        handlePrevTrack();
      } else if (e.key === '[') {
        handleAdjustOffset(-0.25);
      } else if (e.key === ']') {
        handleAdjustOffset(0.25);
      } else if (e.key === '\\') {
        handleResetOffset();
      } else if (e.code === 'KeyL') {
        setIsLibraryOpen((prev) => !prev);
      } else if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        if (tracks[idx]) {
          setTrackIndex(idx);
          audioManager.current.resumeAudioContext();
          audioManager.current.playUrl(tracks[idx].audioUrl, true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleTogglePlay,
    handleToggleMute,
    handleSelectDesktopMode,
    handleToggleClickThrough,
    handleNextTrack,
    handlePrevTrack,
    handleAdjustOffset,
    handleResetOffset,
    tracks,
  ]);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col justify-between p-6 select-none bg-black"
      style={{
        backgroundColor: desktopMode === 'wallpaper' ? 'transparent' : '#000000',
      }}
    >
      {/* 1. Ambient Edge Lighting (Bleeds softly inward from all 4 bezels & corners, center pure #000) */}
      <AmbientEdgeLight
        audioDataRef={audioDataRef}
        playbackState={playbackState}
        colorRgb={ambientColorRgb}
        accentRgbRef={accentRgbRef}
        intensity={colorConfig.intensity}
        autoCycle={colorConfig.mode === 'autocycle'}
      />

      {/* 2A. Synced Lyric Constellation Engine (Active when synced lyrics exist; 600ms crossfade) */}
      <div
        className={`absolute inset-0 transition-opacity duration-600 ease-in-out ${
          visualizerMode === 'lyrics' ? 'opacity-100 pointer-events-none' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ConstellationLyricEngine
          lines={lyricLines}
          currentTime={currentTime + syncOffset}
          getCurrentTime={getAcousticTime}
          audioDataRef={audioDataRef}
          accentRgbRef={accentRgbRef}
          accentColor={activeColorHex}
          appearanceConfig={appearanceConfig}
        />
      </div>

      {/* 2B. Centered Audio Ring Visualizer (Automatic fallback when no synced lyrics; 600ms crossfade) */}
      <div
        className={`absolute inset-0 transition-opacity duration-600 ease-in-out ${
          visualizerMode === 'ring' ? 'opacity-100 pointer-events-none' : 'opacity-0 pointer-events-none'
        }`}
      >
        <CenteredAudioRing
          audioDataRef={audioDataRef}
          playbackState={playbackState}
          colorRgb={ambientColorRgb}
          accentRgbRef={accentRgbRef}
          intensity={colorConfig.intensity}
        />
      </div>

      {/* Top: Ambient Clock (Top-center, configurable typography & date) */}
      <div className="z-20 flex items-center justify-center pt-2">
        <LockScreenClock config={appearanceConfig} />
      </div>

      {/* Center Spacer where Constellation or Ring renders */}
      <div className="flex-1" />

      {/* Bottom: Auto-Hiding Frosted Glass Control Drawer (~3s idle auto-hide) */}
      <div className="z-30 w-full flex flex-col items-center">
        {/* Floating Player Drawer */}
        <div
          className={`transition-all duration-300 transform mb-3 ${
            isChromeVisible
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
          onMouseEnter={() => {
            setIsHoveringDrawer(true);
            if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
          }}
          onMouseLeave={() => {
            setIsHoveringDrawer(false);
            resetHideTimer();
          }}
        >
          <BottomTrackPill
            currentTrack={currentTrack}
            playbackState={playbackState}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            syncOffset={syncOffset}
            onAdjustOffset={handleAdjustOffset}
            onResetOffset={handleResetOffset}
            colorConfig={colorConfig}
            onUpdateColorConfig={handleUpdateColorConfig}
            onTogglePlay={handleTogglePlay}
            onNextTrack={handleNextTrack}
            onPrevTrack={handlePrevTrack}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
            onLoadLocalAudio={handleLoadLocalAudio}
            onSelectAudiusTrack={handleSelectAudiusTrack}
            onOpenAppearance={() => setIsAppearanceOpen(true)}
            onOpenAbout={() => setIsAboutOpen(true)}
            onOpenLibrary={() => setIsLibraryOpen(true)}
            onOpenAddToPlaylist={handleOpenAddToPlaylist}
            isTrackFavorited={isCurrentTrackFavorited}
            onToggleFavorite={handleToggleFavorite}
            onMouseEnter={() => {
              setIsHoveringDrawer(true);
              if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
            }}
            onMouseLeave={() => {
              setIsHoveringDrawer(false);
              resetHideTimer();
            }}
          />
        </div>

        {/* Ambient Footer ("Song title – Artist" / "No synced lyrics..." / "Syncing lyrics...") */}
        <div className="z-20 flex flex-col items-center justify-center pb-2 select-none pointer-events-none">
          {isSyncingLyrics ? (
            <div className="text-[12px] font-normal text-white/60 tracking-wide mb-1 antialiased animate-pulse">
              Syncing lyrics...
            </div>
          ) : visualizerMode === 'ring' ? (
            <div className="text-[12px] font-normal text-white/45 tracking-wide mb-1 antialiased">
              No synced lyrics for this track
            </div>
          ) : (
            <div className="text-[12px] font-normal text-white/40 tracking-wider antialiased">
              {currentTrack.title} — {currentTrack.artist}
            </div>
          )}
        </div>
      </div>

      {/* Appearance Settings Popover */}
      <AppearanceModal
        isOpen={isAppearanceOpen}
        onClose={() => setIsAppearanceOpen(false)}
        config={appearanceConfig}
        onUpdateConfig={handleUpdateAppearance}
        onResetDefault={handleResetAppearance}
      />

      {/* About Constella Dialog */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      {/* Library Modal */}
      <LibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        currentTrackId={currentTrack?.id}
        onPlayTrack={handlePlayTrackFromPlaylist}
        onRequestNewPlaylist={() => {
          setNamingMode('create');
          setPlaylistToRename(null);
          setTrackToAutoAdd(null);
          setIsNamingOpen(true);
        }}
        onRequestRenamePlaylist={(pl) => {
          setNamingMode('rename');
          setPlaylistToRename(pl);
          setIsNamingOpen(true);
        }}
        onShowToast={showToast}
      />

      {/* Playlist Naming / Renaming Modal */}
      <PlaylistNamingModal
        isOpen={isNamingOpen}
        mode={namingMode}
        initialName={playlistToRename ? playlistToRename.name : ''}
        initialColor={playlistToRename ? playlistToRename.coverColor : undefined}
        initialEmoji={playlistToRename ? playlistToRename.coverEmoji : undefined}
        existingPlaylists={playlists}
        currentPlaylistId={playlistToRename?.id}
        onClose={() => {
          setIsNamingOpen(false);
          setPlaylistToRename(null);
          setTrackToAutoAdd(null);
        }}
        onSubmit={(name, color, emoji) => {
          if (namingMode === 'create') {
            handleCreatePlaylistSubmit(name, color, emoji);
          } else {
            handleRenamePlaylistSubmit(name, color, emoji);
          }
        }}
      />

      {/* Add To Playlist Modal */}
      <AddToPlaylistModal
        isOpen={isAddToPlaylistOpen}
        track={trackForPlaylist}
        playlists={playlists}
        onClose={() => {
          setIsAddToPlaylistOpen(false);
          setTrackForPlaylist(null);
        }}
        onToggleTrackInPlaylist={handleToggleTrackInPlaylist}
        onRequestNewPlaylist={(trackToAuto) => {
          setNamingMode('create');
          setPlaylistToRename(null);
          setTrackToAutoAdd(trackToAuto || null);
          setIsNamingOpen(true);
        }}
      />

      {/* Toast Notification Container */}
      <ToastNotification toast={toast} onDismiss={() => setToast(null)} />

      {/* Modals & Dialogs */}
      <AudiusModal
        isOpen={isAudiusOpen}
        onClose={() => setIsAudiusOpen(false)}
        onSelectTrack={handleSelectAudiusTrack}
        currentTrackId={currentTrack.id}
      />

      <LrcSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onApplyLyrics={handleApplyFetchedLyrics}
      />

      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
      />

      <DesktopModeBar
        isOpen={isDesktopModesOpen}
        onClose={() => setIsDesktopModesOpen(false)}
        currentMode={desktopMode}
        isClickThrough={isClickThrough}
        onSelectMode={handleSelectDesktopMode}
        onToggleClickThrough={handleToggleClickThrough}
      />
    </div>
  );
};
