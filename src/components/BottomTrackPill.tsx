import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Search,
  FileAudio,
  Clock,
  Music,
  Loader2,
  Palette,
  Sparkles,
  Disc3,
  Check,
  Settings2,
  Info,
  Library,
  Heart,
  FolderPlus,
} from 'lucide-react';
import { MusicTrack } from '../types/lyrics';
import { PlaybackState } from '../types/radio';
import { MusicSearchService, AudiusTrackItem } from '../services/musicSearchService';

export type AmbientColorMode = 'preset' | 'album' | 'autocycle' | 'custom';

export interface AmbientColorConfig {
  mode: AmbientColorMode;
  presetColor: string;
  customColor: string;
  intensity: number; // 0.2 to 2.0 (default 1.0)
}

const PRESET_SWATCHES = [
  { name: 'White', color: '#ffffff', hex: '#ffffff' },
  { name: 'Warm White', color: '#fff4e6', hex: '#fff4e6' },
  { name: 'Blue', color: '#38bdf8', hex: '#38bdf8' },
  { name: 'Purple', color: '#a855f7', hex: '#a855f7' },
  { name: 'Pink', color: '#ec4899', hex: '#ec4899' },
  { name: 'Red', color: '#ef4444', hex: '#ef4444' },
  { name: 'Orange', color: '#f97316', hex: '#f97316' },
  { name: 'Green', color: '#10b981', hex: '#10b981' },
  { name: 'Cyan', color: '#06b6d4', hex: '#06b6d4' },
];

interface BottomTrackPillProps {
  currentTrack: MusicTrack;
  playbackState: PlaybackState;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  syncOffset?: number;
  onAdjustOffset?: (delta: number) => void;
  onResetOffset?: () => void;
  colorConfig: AmbientColorConfig;
  onUpdateColorConfig: (cfg: Partial<AmbientColorConfig>) => void;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onLoadLocalAudio: (file: File) => void;
  onSelectAudiusTrack: (track: AudiusTrackItem) => void;
  onOpenAppearance?: () => void;
  onOpenAbout?: () => void;
  onOpenLibrary?: () => void;
  onOpenAddToPlaylist?: (track: MusicTrack | AudiusTrackItem) => void;
  isTrackFavorited?: boolean;
  onToggleFavorite?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const BottomTrackPill: React.FC<BottomTrackPillProps> = ({
  currentTrack,
  playbackState,
  currentTime,
  duration,
  volume,
  isMuted,
  syncOffset = 0,
  onAdjustOffset,
  onResetOffset,
  colorConfig,
  onUpdateColorConfig,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onLoadLocalAudio,
  onSelectAudiusTrack,
  onOpenAppearance,
  onOpenAbout,
  onOpenLibrary,
  onOpenAddToPlaylist,
  isTrackFavorited = false,
  onToggleFavorite,
  onMouseEnter,
  onMouseLeave,
}) => {
  const [showSearchDrawer, setShowSearchDrawer] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Audius Live Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AudiusTrackItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadLocalAudio(file);
    }
  };

  // Close color popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorPicker]);

  // Load trending tracks on initial search drawer open
  useEffect(() => {
    if (showSearchDrawer && searchResults.length === 0 && !searchQuery.trim()) {
      setIsSearching(true);
      MusicSearchService.fetchTrending(16).then((tracks) => {
        setSearchResults(tracks);
        setIsSearching(false);
      });
    }
  }, [showSearchDrawer]);

  // Debounced Audius search (400ms) on query input
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(async () => {
      setIsSearching(true);
      if (!query.trim()) {
        const trending = await MusicSearchService.fetchTrending(16);
        setSearchResults(trending);
      } else {
        const results = await MusicSearchService.searchTracks(query, 16);
        setSearchResults(results);
      }
      setIsSearching(false);
    }, 400);
  };

  // Active color indicator hex
  const activeColorHex =
    colorConfig.mode === 'album'
      ? currentTrack.primaryColor || '#a5b4fc'
      : colorConfig.mode === 'custom'
      ? colorConfig.customColor
      : colorConfig.mode === 'autocycle'
      ? '#38bdf8'
      : colorConfig.presetColor;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="flex flex-col items-center w-full max-w-2xl select-none relative"
    >
      {/* Hidden Native Audio File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Color Picker Popover */}
      {showColorPicker && (
        <div
          ref={colorPickerRef}
          className="absolute bottom-full mb-3 right-0 w-80 p-4 rounded-2xl border border-white/20 bg-neutral-950/95 backdrop-blur-2xl shadow-2xl text-white z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 1px 1px rgba(255, 255, 255, 0.15)',
          }}
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <span className="text-xs font-semibold tracking-wide uppercase text-white/70 flex items-center space-x-1.5">
              <Palette className="w-3.5 h-3.5 text-white/90" />
              <span>Ambient Glow Color</span>
            </span>
            <span className="text-[10px] text-white/40 font-mono">
              {Math.round(colorConfig.intensity * 100)}%
            </span>
          </div>

          {/* Preset Swatches Grid */}
          <div className="mb-3">
            <div className="text-[11px] text-white/50 mb-2">Preset Colors</div>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_SWATCHES.map((swatch) => {
                const isSelected =
                  colorConfig.mode === 'preset' && colorConfig.presetColor.toLowerCase() === swatch.hex.toLowerCase();
                return (
                  <button
                    key={swatch.name}
                    onClick={() => {
                      onUpdateColorConfig({ mode: 'preset', presetColor: swatch.hex });
                    }}
                    title={swatch.name}
                    className={`group relative flex flex-col items-center p-1 rounded-xl transition-all ${
                      isSelected ? 'bg-white/15 ring-1 ring-white/50' : 'hover:bg-white/10'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center transition-transform group-hover:scale-105"
                      style={{
                        backgroundColor: swatch.hex,
                        boxShadow: `0 0 8px ${swatch.hex}55`,
                      }}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-black drop-shadow" />}
                    </div>
                    <span className="text-[9px] text-white/60 truncate mt-1 max-w-[50px]">
                      {swatch.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Special Modes: Album Color & Auto Cycle */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {/* Album Color */}
            <button
              onClick={() => onUpdateColorConfig({ mode: 'album' })}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                colorConfig.mode === 'album'
                  ? 'bg-white/20 border-white/50 text-white shadow-sm'
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Disc3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Album Color</span>
            </button>

            {/* Auto Cycle */}
            <button
              onClick={() => onUpdateColorConfig({ mode: 'autocycle' })}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                colorConfig.mode === 'autocycle'
                  ? 'bg-white/20 border-white/50 text-white shadow-sm'
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Auto Cycle</span>
            </button>
          </div>

          {/* Custom Color Input */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 mb-3">
            <span className="text-xs text-white/70">Custom Color:</span>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={colorConfig.customColor}
                onChange={(e) =>
                  onUpdateColorConfig({ mode: 'custom', customColor: e.target.value })
                }
                className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
              />
              <span className="text-[11px] font-mono text-white/60 uppercase">
                {colorConfig.customColor}
              </span>
            </div>
          </div>

          {/* Glow Intensity Slider */}
          <div className="space-y-1.5 pt-1 border-t border-white/10">
            <div className="flex justify-between text-xs text-white/60">
              <span>Glow Intensity</span>
              <span className="font-mono">{Math.round(colorConfig.intensity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.0"
              step="0.05"
              value={colorConfig.intensity}
              onChange={(e) =>
                onUpdateColorConfig({ intensity: parseFloat(e.target.value) })
              }
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>
        </div>
      )}

      {/* Frosted Glass Player Panel Drawer */}
      <div
        className="w-full rounded-2xl p-4 border border-white/15 bg-black/85 backdrop-blur-2xl shadow-2xl text-white font-sans antialiased"
        style={{
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.95), 0 0 1px 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Top Header Row: Track Info & Duration */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2.5 min-w-0 pr-3">
            <span className="text-white/80 text-sm">✦</span>
            <div className="truncate flex items-center">
              <span className="text-[13px] font-semibold text-white tracking-tight mr-2 truncate">
                {currentTrack.title}
              </span>
              <span className="text-[12px] font-normal text-white/50 truncate">
                {currentTrack.artist}
              </span>
            </div>

            {/* Quick Favorite / Add to Playlist buttons */}
            <div className="flex items-center space-x-1 pl-1 flex-shrink-0">
              {onToggleFavorite && (
                <button
                  onClick={onToggleFavorite}
                  className={`p-1 rounded-lg transition-colors ${
                    isTrackFavorited
                      ? 'text-red-400 hover:text-red-300'
                      : 'text-white/30 hover:text-white/80 hover:bg-white/10'
                  }`}
                  title={isTrackFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
                >
                  <Heart className={`w-3.5 h-3.5 ${isTrackFavorited ? 'fill-current' : ''}`} />
                </button>
              )}
              {onOpenAddToPlaylist && (
                <button
                  onClick={() => onOpenAddToPlaylist(currentTrack)}
                  className="p-1 rounded-lg text-white/30 hover:text-white/80 hover:bg-white/10 transition-colors"
                  title="Add to Playlist…"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="text-[11px] font-mono text-white/50 flex-shrink-0">
            <span>{formatTime(currentTime)}</span>
            <span className="mx-1 text-white/30">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Timeline Scrubber */}
        <div className="space-y-1 mb-3">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.5"
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:bg-white/30 transition-all"
          />
        </div>

        {/* Transport Controls & Tools Bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          {/* Play/Pause/Skip */}
          <div className="flex items-center space-x-1">
            <button
              onClick={onPrevTrack}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Previous Track"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={onTogglePlay}
              className="p-2 rounded-full text-black bg-white hover:bg-white/90 shadow transition-transform active:scale-95 font-bold"
              title={playbackState === 'playing' ? 'Pause' : 'Play'}
            >
              {playbackState === 'playing' ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={onNextTrack}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Next Track"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>


          <div className="flex items-center space-x-1.5">
            {/* Library / Playlists Button */}
            <button
              id="open-library-btn"
              onClick={onOpenLibrary}
              className="px-2.5 py-1.5 rounded-xl flex items-center space-x-1.5 bg-white/5 border border-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-all text-[11px] font-medium"
              title="Open Music Library & Playlists (L)"
            >
              <Library className="w-3.5 h-3.5 text-white/80" />
              <span className="hidden sm:inline">Library</span>
            </button>

            {/* Appearance Settings Button (replaces sync offset) */}
            <button
              onClick={onOpenAppearance}
              className="px-2.5 py-1.5 rounded-xl flex items-center space-x-1.5 bg-white/5 border border-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-all text-[11px] font-medium"
              title="Appearance Settings (Fonts, Formats, Lyrics)"
            >
              <Settings2 className="w-3.5 h-3.5 text-white/80" />
              <span className="hidden sm:inline">Appearance</span>
            </button>

            {/* About Constella Button */}
            <button
              onClick={onOpenAbout}
              className="px-2.5 py-1.5 rounded-xl flex items-center space-x-1.5 bg-white/5 border border-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-all text-[11px] font-medium"
              title="About Constella"
            >
              <Info className="w-3.5 h-3.5 text-white/80" />
              <span className="hidden sm:inline">About</span>
            </button>
          </div>

          {/* Right Tools: Ambient Color Popover, Audius Search, Local File, Volume */}
          <div className="flex items-center space-x-2">
            {/* Color Picker Popover Button */}
            <button
              onClick={() => setShowColorPicker((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl flex items-center space-x-1.5 border transition-all text-[11px] font-medium ${
                showColorPicker
                  ? 'bg-white/20 border-white/50 text-white'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white'
              }`}
              title="Ambient Glow Color & Intensity"
            >
              <div
                className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm"
                style={{ backgroundColor: activeColorHex }}
              />
              <span className="hidden sm:inline">Glow Color</span>
            </button>

            {/* Audius Music Search Toggle */}
            <button
              onClick={() => setShowSearchDrawer((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl flex items-center space-x-1.5 border transition-all text-[11px] font-medium ${
                showSearchDrawer
                  ? 'bg-white/20 border-white/40 text-white'
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              title="Audius Music Search & Stream"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Audius</span>
            </button>

            {/* Local Audio File Picker */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-xl flex items-center space-x-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white transition-all text-[11px] font-medium"
              title="Open Local Audio File (MP3/WAV/FLAC)"
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Local File</span>
            </button>

            {/* Volume Control */}
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded-xl bg-white/5 border border-white/10">
              <button
                onClick={onToggleMute}
                className="text-white/70 hover:text-white transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-14 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                title={`Volume: ${Math.round(volume * 100)}%`}
              />
            </div>
          </div>
        </div>

        {/* Expandable Audius Search Drawer */}
        {showSearchDrawer && (
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-col space-y-2 animate-in fade-in duration-200">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search songs, artists, or genres on Audius..."
                value={searchQuery}
                onChange={handleQueryChange}
                autoFocus
                className="w-full pl-9 pr-9 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-colors"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-white/50 animate-spin" />
              )}
            </div>

            {/* Audius Results List */}
            <div className="max-h-52 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {searchResults.length === 0 && !isSearching && (
                <div className="text-center py-4 text-xs text-white/40">
                  {searchQuery ? 'No tracks found on Audius.' : 'Type to search trending music.'}
                </div>
              )}

              {searchResults.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectAudiusTrack(item);
                    setShowSearchDrawer(false);
                  }}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-white/10 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    {item.artworkUrl ? (
                      <img
                        src={item.artworkUrl}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-white/10"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <Music className="w-4 h-4 text-white/60" />
                      </div>
                    )}
                    <div className="truncate">
                      <div className="text-xs font-medium text-white truncate group-hover:text-cyan-300 transition-colors">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-white/50 truncate">{item.artist}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    <span className="text-[10px] font-mono text-white/40">
                      {formatTime(item.duration)}
                    </span>
                    {onOpenAddToPlaylist && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAddToPlaylist(item);
                        }}
                        className="p-1 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                        title="Add to playlist…"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
