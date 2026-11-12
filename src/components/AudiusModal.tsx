import React, { useState, useEffect } from 'react';
import { X, Flame, Search, Play, Music, Loader2, Sparkles } from 'lucide-react';
import { MusicSearchService, AudiusTrackItem } from '../services/musicSearchService';

interface AudiusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrack: (track: AudiusTrackItem) => void;
  currentTrackId?: string;
}

export const AudiusModal: React.FC<AudiusModalProps> = ({
  isOpen,
  onClose,
  onSelectTrack,
  currentTrackId,
}) => {
  const [tracks, setTracks] = useState<AudiusTrackItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'trending' | 'search'>('trending');

  useEffect(() => {
    if (isOpen && tracks.length === 0) {
      loadTrending();
    }
  }, [isOpen]);

  const loadTrending = async () => {
    setLoading(true);
    const list = await MusicSearchService.fetchTrending(25);
    setTracks(list);
    setLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setActiveTab('search');
    const results = await MusicSearchService.searchTracks(searchQuery.trim(), 20);
    setTracks(results);
    setLoading(false);
  };

  if (!isOpen) return null;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-xl rounded-2xl p-6 border border-white/10 shadow-2xl relative max-h-[85vh] flex flex-col font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center space-x-2.5">
            <Flame className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Audius Online Music Integration</h3>
              <p className="text-[11px] text-slate-400">Streams directly with auto-synced LRCLIB lyrics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg glass-pill text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Tabs */}
        <div className="my-3 space-y-2">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search artists, songs or genres on Audius..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-white/40 text-xs"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-white/90 text-black font-semibold text-xs flex items-center space-x-1 transition-all"
            >
              <span>Search</span>
            </button>
          </form>

          <div className="flex items-center space-x-2 pt-1">
            <button
              onClick={() => {
                setActiveTab('trending');
                loadTrending();
              }}
              className={`px-3 py-1 rounded-full text-[11px] transition-all ${
                activeTab === 'trending'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🔥 Trending Today
            </button>
            <span className="text-slate-600">•</span>
            <span className="text-[11px] text-slate-400">Free, uncompressed, ad-free Audius API</span>
          </div>
        </div>

        {/* Tracks List */}
        <div className="overflow-y-auto flex-1 space-y-2 pr-1 my-2">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <span>Fetching tracks from Audius API...</span>
            </div>
          ) : tracks.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No tracks found. Try searching a different keyword.
            </div>
          ) : (
            tracks.map((t) => {
              const isPlayingThis = currentTrackId === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    onSelectTrack(t);
                    onClose();
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                    isPlayingThis
                      ? 'border-accent bg-accent-subtle shadow-accent'
                      : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div className="w-8 h-8 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-accent">
                      {isPlayingThis ? (
                        <Sparkles className="w-4 h-4 text-accent animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-slate-300 group-hover:text-white ml-0.5" />
                      )}
                    </div>
                    <div className="truncate">
                      <div className="font-medium text-white text-xs truncate group-hover:text-accent transition-colors">
                        {t.title}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {t.artist}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 flex-shrink-0 pl-3">
                    <span className="text-[10px] text-slate-500">{formatDuration(t.duration)}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-400 uppercase">
                      Audius
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 text-[10px] text-slate-500 flex items-center justify-between">
          <span>Powered by Audius Discovery API v1 (`app_name=weyv`)</span>
          <span className="text-white/60">Click any track to stream with synced lyrics</span>
        </div>
      </div>
    </div>
  );
};

