import React, { useEffect } from 'react';
import { X, Plus, Check, Music, FolderPlus } from 'lucide-react';
import { Playlist, PlaylistTrack } from '../services/playlistDb';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  track: PlaylistTrack | null;
  playlists: Playlist[];
  onClose: () => void;
  onToggleTrackInPlaylist: (playlistId: string, track: PlaylistTrack) => Promise<void>;
  onRequestNewPlaylist: (trackToAutoAdd?: PlaylistTrack) => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  track,
  playlists,
  onClose,
  onToggleTrackInPlaylist,
  onRequestNewPlaylist,
}) => {
  // Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !track) return null;

  const isTrackIn = (playlist: Playlist): boolean => {
    return playlist.tracks.some(
      (t) =>
        t.id === track.id ||
        (t.title.toLowerCase() === track.title.toLowerCase() &&
          t.artist.toLowerCase() === track.artist.toLowerCase())
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-[#090a0f]/95 border border-white/10 shadow-2xl p-5 text-white flex flex-col max-h-[80vh] overflow-hidden"
        style={{
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.95), 0 0 1px 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <FolderPlus className="w-4 h-4 text-white/80" />
            <h2 className="text-sm font-semibold text-white tracking-tight">Add to Playlist</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Track Pill */}
        <div className="my-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/5 flex items-center space-x-3">
          {track.artworkUrl ? (
            <img
              src={track.artworkUrl}
              alt=""
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <Music className="w-5 h-5 text-white/60" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">{track.title}</div>
            <div className="text-[11px] text-white/50 truncate">{track.artist}</div>
          </div>
        </div>

        {/* Playlists List */}
        <div className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5 px-1">
          Select Playlists
        </div>
        <div className="overflow-y-auto space-y-1.5 flex-1 pr-1 custom-scrollbar min-h-[140px] max-h-[260px]">
          {playlists.length === 0 ? (
            <div className="py-6 text-center text-xs text-white/40">No playlists available.</div>
          ) : (
            playlists.map((playlist) => {
              const inPlaylist = isTrackIn(playlist);
              return (
                <div
                  key={playlist.id}
                  onClick={() => onToggleTrackInPlaylist(playlist.id, track)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer border transition-all ${
                    inPlaylist
                      ? 'bg-white/15 border-white/30 text-white'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/10 hover:border-white/15 text-white/70'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-2">
                    {/* Cover thumbnail */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs flex-shrink-0 border border-white/10"
                      style={{
                        backgroundColor: playlist.coverColor || '#1c1e24',
                      }}
                    >
                      {playlist.coverEmoji ? (
                        <span>{playlist.coverEmoji}</span>
                      ) : (
                        <Music className="w-3.5 h-3.5 text-white/60" />
                      )}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-medium text-white truncate">{playlist.name}</div>
                      <div className="text-[10px] text-white/40">
                        {playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}
                      </div>
                    </div>
                  </div>

                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                      inPlaylist
                        ? 'bg-white border-white text-black'
                        : 'border-white/30 bg-black/40'
                    }`}
                  >
                    {inPlaylist && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: + New Playlist Button */}
        <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={() => onRequestNewPlaylist(track)}
            className="flex items-center space-x-1.5 text-xs text-white/80 hover:text-white transition-colors py-1.5 px-2.5 rounded-xl hover:bg-white/10"
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium">+ New playlist…</span>
          </button>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-white/90 text-black text-xs font-semibold shadow transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
