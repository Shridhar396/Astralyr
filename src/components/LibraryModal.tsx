import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  Search,
  ArrowUpDown,
  MoreVertical,
  Play,
  Shuffle,
  Repeat,
  Trash2,
  Edit2,
  Clock,
  Music,
  ArrowLeft,
  GripVertical,
  Heart,
  RotateCcw,
  AlertCircle,
  HardDrive,
  FolderOpen,
  Download,
  Upload,
  Check,
} from 'lucide-react';
import {
  Playlist,
  PlaylistTrack,
  PlaylistSortOption,
  DEFAULT_FAVORITES_ID,
  playlistDb,
} from '../services/playlistDb';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrackId?: string;
  onPlayTrack: (track: PlaylistTrack, queue: PlaylistTrack[]) => void;
  onRequestNewPlaylist: () => void;
  onRequestRenamePlaylist: (playlist: Playlist) => void;
  onShowToast: (message: string, action?: { label: string; onClick: () => void }) => void;
}

const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const PlaylistCover: React.FC<{ playlist: Playlist; className?: string }> = ({
  playlist,
  className = 'w-12 h-12',
}) => {
  if (playlist.coverEmoji) {
    return (
      <div
        className={`${className} rounded-xl flex items-center justify-center text-xl border border-white/10 flex-shrink-0`}
        style={{ backgroundColor: playlist.coverColor || '#181a20' }}
      >
        <span>{playlist.coverEmoji}</span>
      </div>
    );
  }

  if (playlist.coverColor) {
    return (
      <div
        className={`${className} rounded-xl flex items-center justify-center border border-white/10 flex-shrink-0`}
        style={{ backgroundColor: playlist.coverColor }}
      >
        <Music className="w-5 h-5 text-white/80" />
      </div>
    );
  }

  // 2x2 Grid of the first 4 songs with covers
  const artCovers = playlist.tracks.filter((t) => t.artworkUrl).slice(0, 4);
  if (artCovers.length >= 4) {
    return (
      <div
        className={`${className} rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 border border-white/10 bg-black/40 flex-shrink-0`}
      >
        {artCovers.map((t, idx) => (
          <img key={idx} src={t.artworkUrl} alt="" className="w-full h-full object-cover" />
        ))}
      </div>
    );
  }

  if (artCovers.length > 0) {
    return (
      <div
        className={`${className} rounded-xl overflow-hidden border border-white/10 bg-black/40 flex-shrink-0 relative`}
      >
        <img src={artCovers[0].artworkUrl} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-xl flex items-center justify-center bg-white/5 border border-white/10 flex-shrink-0`}
    >
      <Music className="w-5 h-5 text-white/40" />
    </div>
  );
};

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  currentTrackId,
  onPlayTrack,
  onRequestNewPlaylist,
  onRequestRenamePlaylist,
  onShowToast,
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<PlaylistSortOption>(() => {
    try {
      const saved = localStorage.getItem('astralyr_playlist_sort') || localStorage.getItem('constella_playlist_sort');
      return (saved as PlaylistSortOption) || 'updated';
    } catch {
      return 'updated';
    }
  });

  // Track player options for the open playlist
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  // Confirmation dialog state for deleting playlist
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);

  // Confirmation dialog state for deleting track (from playlist vs permanently from library)
  const [trackToDelete, setTrackToDelete] = useState<{ track: PlaylistTrack; playlistId: string } | null>(null);

  // Storage management modal & stats
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [libraryStats, setLibraryStats] = useState<{
    libraryDir: string;
    trackCount: number;
    totalSizeBytes: number;
    freeSpaceBytes: number;
  } | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [storageMessage, setStorageMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const fetchLibraryStats = async () => {
    if (window.electronAPI?.library?.getStats) {
      try {
        const stats = await window.electronAPI.library.getStats();
        setLibraryStats(stats);
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    if (showStorageModal) {
      fetchLibraryStats();
    }
  }, [showStorageModal]);

  // Active playlist dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // Load playlists from IndexedDB
  const reloadPlaylists = async () => {
    try {
      const all = await playlistDb.getAllPlaylists();
      setPlaylists(all);
    } catch (e) {
      console.error('Failed to load playlists:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      reloadPlaylists();
    }
  }, [isOpen]);

  useEffect(() => {
    const unsub = playlistDb.subscribe(() => {
      reloadPlaylists();
    });
    return unsub;
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    if (activeMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuId]);

  // Handle Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (playlistToDelete) {
          setPlaylistToDelete(null);
        } else if (selectedPlaylistId) {
          setSelectedPlaylistId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedPlaylistId, playlistToDelete, onClose]);

  const handleSortChange = (opt: PlaylistSortOption) => {
    setSortOption(opt);
    try {
      localStorage.setItem('astralyr_playlist_sort', opt);
    } catch {}
  };

  // Filtered & sorted playlists
  const displayPlaylists = useMemo(() => {
    let result = [...playlists];

    // Filter by search query if present
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      // Keep Favorites pinned to top if desired or follow standard sort
      if (sortOption === 'updated') {
        return b.updatedAt - a.updatedAt;
      } else if (sortOption === 'name') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      } else if (sortOption === 'created') {
        return b.createdAt - a.createdAt;
      }
      return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
    });

    return result;
  }, [playlists, searchQuery, sortOption]);

  const selectedPlaylist = useMemo(() => {
    if (!selectedPlaylistId) return null;
    return playlists.find((p) => p.id === selectedPlaylistId) || null;
  }, [playlists, selectedPlaylistId]);

  // Delete handler with confirmation and 5-second Undo toast
  const handleConfirmDelete = async () => {
    if (!playlistToDelete) return;
    const toDelete = playlistToDelete;
    setPlaylistToDelete(null);

    try {
      const deleted = await playlistDb.deletePlaylist(toDelete.id);
      if (deleted) {
        if (selectedPlaylistId === toDelete.id) {
          setSelectedPlaylistId(null);
        }
        onShowToast(`Deleted "${toDelete.name}"`, {
          label: 'Undo',
          onClick: async () => {
            await playlistDb.restorePlaylist(deleted);
            onShowToast(`Restored "${toDelete.name}"`);
          },
        });
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to delete playlist');
    }
  };

  // Drag and drop reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const reordered = [...displayPlaylists];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setPlaylists(reordered);
    setDraggedIndex(null);

    const orderedIds = reordered.map((p) => p.id);
    await playlistDb.reorderPlaylists(orderedIds);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-[#08090d]/95 border border-white/10 shadow-2xl flex flex-col max-h-[85vh] text-white overflow-hidden"
        style={{
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.95), 0 0 1px 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center space-x-3">
            {selectedPlaylist ? (
              <button
                onClick={() => setSelectedPlaylistId(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors"
                title="Back to Playlists"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : null}

            <div>
              <h1 className="text-base font-semibold text-white tracking-tight flex items-center space-x-2">
                <span>{selectedPlaylist ? selectedPlaylist.name : 'Your Library'}</span>
                {selectedPlaylist?.isDefault && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                    Default
                  </span>
                )}
              </h1>
              <div className="text-xs text-white/40">
                {selectedPlaylist
                  ? `${selectedPlaylist.tracks.length} songs · ${formatDuration(
                      selectedPlaylist.tracks.reduce((acc, t) => acc + (t.duration || 0), 0)
                    )} total duration`
                  : `${playlists.length} playlists`}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!selectedPlaylist && (
              <>
                {window.electronAPI?.library && (
                  <button
                    onClick={() => setShowStorageModal(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium transition-colors"
                    title="Manage Library Storage & Backups"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Storage</span>
                  </button>
                )}
                <button
                  id="new-playlist-btn"
                  onClick={onRequestNewPlaylist}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-white/90 text-black text-xs font-semibold shadow transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>New playlist</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* VIEW 1: PLAYLISTS LIST */}
        {!selectedPlaylist ? (
          <div className="flex flex-col flex-1 overflow-hidden p-5">
            {/* Search Box (shows when playlists > 8 or when searching) */}
            {playlists.length > 8 && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-white/40" />
                <input
                  type="text"
                  placeholder="Filter playlists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-white/40 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Sorting Toolbar */}
            <div className="flex items-center justify-between mb-3 text-xs text-white/50 pb-2 border-b border-white/5">
              <div className="flex items-center space-x-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-white/40" />
                <span>Sort by:</span>
              </div>
              <div className="flex space-x-1">
                {[
                  { id: 'updated', label: 'Recently updated' },
                  { id: 'name', label: 'Name A-Z' },
                  { id: 'created', label: 'Date created' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSortChange(s.id as PlaylistSortOption)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      sortOption === s.id
                        ? 'bg-white/20 text-white border border-white/20'
                        : 'bg-white/[0.02] text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Playlists Grid / List with Drag and Drop */}
            <div className="overflow-y-auto space-y-2 flex-1 pr-1 custom-scrollbar">
              {displayPlaylists.length === 0 ? (
                <div className="py-12 text-center text-xs text-white/40">
                  {searchQuery ? 'No playlists match your search.' : 'No playlists created yet.'}
                </div>
              ) : (
                displayPlaylists.map((playlist, idx) => {
                  const totalSecs = playlist.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
                  return (
                    <div
                      key={playlist.id}
                      draggable={!searchQuery}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, idx)}
                      className={`group flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                        draggedIndex === idx
                          ? 'opacity-40 border-dashed border-white/40'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.07] hover:border-white/15'
                      }`}
                      onClick={() => setSelectedPlaylistId(playlist.id)}
                    >
                      <div className="flex items-center space-x-3.5 min-w-0 pr-2">
                        {/* Drag Grip Handle */}
                        {!searchQuery && (
                          <div
                            className="cursor-grab text-white/20 group-hover:text-white/60 p-0.5"
                            title="Drag to reorder"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                        )}

                        {/* Cover Art / 2x2 Grid */}
                        <PlaylistCover playlist={playlist} />

                        {/* Details */}
                        <div className="truncate">
                          <div className="text-sm font-medium text-white truncate flex items-center space-x-1.5">
                            <span>{playlist.name}</span>
                            {playlist.isDefault && (
                              <Heart className="w-3 h-3 text-red-400 fill-current" />
                            )}
                          </div>
                          <div className="text-xs text-white/45 mt-0.5 flex items-center space-x-2">
                            <span>
                              {playlist.tracks.length}{' '}
                              {playlist.tracks.length === 1 ? 'song' : 'songs'}
                            </span>
                            <span>•</span>
                            <span>{formatDuration(totalSecs)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Actions: Play & Options Menu */}
                      <div
                        className="flex items-center space-x-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {playlist.tracks.length > 0 && (
                          <button
                            onClick={() => onPlayTrack(playlist.tracks[0], playlist.tracks)}
                            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                            title="Play playlist"
                          >
                            <Play className="w-4 h-4 fill-current" />
                          </button>
                        )}

                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveMenuId(activeMenuId === playlist.id ? null : playlist.id)
                            }
                            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                            title="More options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuId === playlist.id && (
                            <div
                              ref={menuRef}
                              className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-[#111318] border border-white/10 shadow-xl py-1 z-30 text-xs animate-in fade-in duration-100"
                            >
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onRequestRenamePlaylist(playlist);
                                }}
                                className="w-full flex items-center space-x-2 px-3 py-2 text-white/80 hover:text-white hover:bg-white/10 text-left transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Rename</span>
                              </button>

                              {!playlist.isDefault && (
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setPlaylistToDelete(playlist);
                                  }}
                                  className="w-full flex items-center space-x-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 text-left transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* VIEW 2: SELECTED PLAYLIST DETAIL & TRACKS */
          <div className="flex flex-col flex-1 overflow-hidden p-5">
            {/* Playlist Hero Toolbar */}
            <div className="flex items-center justify-between pb-4 mb-3 border-b border-white/10 flex-wrap gap-3">
              <div className="flex items-center space-x-3.5">
                <PlaylistCover playlist={selectedPlaylist} className="w-14 h-14 text-2xl" />
                <div>
                  <div className="text-base font-semibold text-white">{selectedPlaylist.name}</div>
                  <div className="text-xs text-white/50">
                    {selectedPlaylist.tracks.length} songs ·{' '}
                    {formatDuration(
                      selectedPlaylist.tracks.reduce((acc, t) => acc + (t.duration || 0), 0)
                    )}
                  </div>
                </div>
              </div>

              {/* Controls: Play All, Shuffle, Repeat, Rename, Delete */}
              <div className="flex items-center space-x-2">
                {selectedPlaylist.tracks.length > 0 && (
                  <button
                    onClick={() => {
                      let queue = [...selectedPlaylist.tracks];
                      if (isShuffle) {
                        queue = [...queue].sort(() => Math.random() - 0.5);
                      }
                      onPlayTrack(queue[0], queue);
                    }}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-white/90 text-black text-xs font-semibold shadow active:scale-95 transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play</span>
                  </button>
                )}

                {/* Shuffle toggle */}
                <button
                  onClick={() => setIsShuffle((prev) => !prev)}
                  className={`p-2 rounded-xl border transition-all ${
                    isShuffle
                      ? 'bg-white/20 border-white/40 text-white'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                  title={isShuffle ? 'Shuffle is ON' : 'Shuffle is OFF'}
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                {/* Repeat toggle */}
                <button
                  onClick={() => {
                    setRepeatMode((prev) => {
                      if (prev === 'off') return 'all';
                      if (prev === 'all') return 'one';
                      return 'off';
                    });
                  }}
                  className={`p-2 rounded-xl border transition-all relative ${
                    repeatMode !== 'off'
                      ? 'bg-white/20 border-white/40 text-white'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                  title={`Repeat: ${repeatMode.toUpperCase()}`}
                >
                  <Repeat className="w-4 h-4" />
                  {repeatMode === 'one' && (
                    <span className="absolute top-1 right-1 text-[8px] font-bold">1</span>
                  )}
                </button>

                {/* More / Rename / Delete */}
                <button
                  onClick={() => onRequestRenamePlaylist(selectedPlaylist)}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  title="Rename Playlist"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                {!selectedPlaylist.isDefault && (
                  <button
                    onClick={() => setPlaylistToDelete(selectedPlaylist)}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
                    title="Delete Playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Song Table / List */}
            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1 custom-scrollbar">
              {selectedPlaylist.tracks.length === 0 ? (
                <div className="py-16 text-center text-xs text-white/40">
                  This playlist is empty. Add songs from Audius search or the currently playing
                  song!
                </div>
              ) : (
                selectedPlaylist.tracks.map((track, trackIdx) => {
                  const isCurrent = track.id === currentTrackId;
                  const isMissing = track.status === 'missing';
                  const needsReadding = track.status === 'needs-readding';

                  return (
                    <div
                      key={track.id + '_' + trackIdx}
                      className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-white/15 border-white/30 text-white'
                          : isMissing
                          ? 'bg-red-500/[0.04] border-red-500/20 text-white/70'
                          : needsReadding
                          ? 'bg-amber-500/[0.04] border-amber-500/20 text-white/70'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.08] hover:border-white/15 text-white/80'
                      }`}
                      onClick={() => {
                        if (isMissing) {
                          onShowToast(`Cannot play "${track.title}": file is missing from library. Click "Locate" to re-link.`);
                          return;
                        }
                        if (needsReadding) {
                          onShowToast(`Cannot play "${track.title}": file needs to be re-added to library.`);
                          return;
                        }
                        onPlayTrack(track, selectedPlaylist.tracks);
                      }}
                    >
                      <div className="flex items-center space-x-3 min-w-0 pr-2">
                        {/* Index or Play icon */}
                        <div className="w-5 text-center text-xs font-mono text-white/40 flex-shrink-0 group-hover:hidden">
                          {trackIdx + 1}
                        </div>
                        <div className="w-5 hidden group-hover:flex items-center justify-center flex-shrink-0 text-white">
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </div>

                        {/* Thumbnail */}
                        {track.artworkUrl ? (
                          <img
                            src={track.artworkUrl}
                            alt=""
                            className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-white/10"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                            <Music className="w-4 h-4 text-white/60" />
                          </div>
                        )}

                        <div className="truncate">
                          <div
                            className={`text-xs font-medium truncate ${
                              isCurrent ? 'text-white font-semibold' : 'text-white'
                            }`}
                          >
                            {track.title}
                          </div>
                          <div className="text-[11px] text-white/50 truncate flex items-center space-x-2">
                            <span>{track.artist}</span>
                            {isMissing && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                                <AlertCircle className="w-2.5 h-2.5 mr-1" />
                                File missing
                              </span>
                            )}
                            {needsReadding && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                <AlertCircle className="w-2.5 h-2.5 mr-1" />
                                Needs re-adding
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Duration & Actions */}
                      <div
                        className="flex items-center space-x-2.5 text-xs text-white/40 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isMissing && (
                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.electronAPI?.library?.locateFile) {
                                  const res = await window.electronAPI.library.locateFile(track.id);
                                  if (res) {
                                    await playlistDb.updateTrack(track.id, {
                                      status: 'ok',
                                      storedFileName: res.storedFileName,
                                      duration: res.duration,
                                      artworkUrl: res.artwork,
                                      audioUrl: `astralyr-media://${res.id}`,
                                    });
                                    await reloadPlaylists();
                                    onShowToast(`Located and updated "${res.title}"`);
                                  }
                                }
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition-colors"
                              title="Locate missing file on disk"
                            >
                              Locate
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await playlistDb.removeTrackFromPlaylist(selectedPlaylist.id, track.id);
                                await reloadPlaylists();
                                onShowToast(`Removed "${track.title}"`);
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 transition-colors"
                              title="Remove from playlist"
                            >
                              Remove
                            </button>
                          </div>
                        )}

                        {needsReadding && (
                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.electronAPI?.library?.locateFile) {
                                  const res = await window.electronAPI.library.locateFile(track.id);
                                  if (res) {
                                    await playlistDb.updateTrack(track.id, {
                                      status: 'ok',
                                      storedFileName: res.storedFileName,
                                      duration: res.duration,
                                      artworkUrl: res.artwork,
                                      audioUrl: `astralyr-media://${res.id}`,
                                    });
                                    await reloadPlaylists();
                                    onShowToast(`Re-added "${res.title}" to Library`);
                                  }
                                }
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-colors"
                              title="Re-add file to library"
                            >
                              Re-add
                            </button>
                          </div>
                        )}

                        <span className="font-mono text-[11px]">{formatDuration(track.duration)}</span>
                        <button
                          onClick={() => {
                            if (window.electronAPI?.library) {
                              setTrackToDelete({ track, playlistId: selectedPlaylist.id });
                            } else {
                              playlistDb.removeTrackFromPlaylist(
                                selectedPlaylist.id,
                                track.id
                              ).then(() => {
                                reloadPlaylists();
                                onShowToast(`Removed "${track.title}" from ${selectedPlaylist.name}`);
                              });
                            }
                          }}
                          className="p-1 rounded-md text-white/30 hover:text-red-400 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                          title="Remove from playlist"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {playlistToDelete && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-100">
            <div className="w-full max-w-sm rounded-2xl bg-[#0e1017] border border-white/10 p-5 shadow-2xl text-white">
              <h3 className="text-sm font-semibold mb-2">Delete Playlist?</h3>
              <p className="text-xs text-white/60 mb-5 leading-relaxed">
                Are you sure you want to delete{' '}
                <strong className="text-white">"{playlistToDelete.name}"</strong>? This will only
                remove the playlist, never the saved songs from your other playlists.
              </p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setPlaylistToDelete(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow transition-all active:scale-95"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Track Delete Confirmation Dialog */}
        {trackToDelete && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-100">
            <div className="w-full max-w-sm rounded-2xl bg-[#0e1017] border border-white/10 p-5 shadow-2xl text-white">
              <h3 className="text-sm font-semibold mb-2">Remove Song</h3>
              <p className="text-xs text-white/60 mb-5 leading-relaxed">
                Remove <strong className="text-white">"{trackToDelete.track.title}"</strong> from this playlist, or delete it from your app library folder completely?
              </p>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={async () => {
                    const { track, playlistId } = trackToDelete;
                    setTrackToDelete(null);
                    await playlistDb.removeTrackFromPlaylist(playlistId, track.id);
                    await reloadPlaylists();
                    onShowToast(`Removed "${track.title}" from playlist`);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors text-center"
                >
                  Remove from this playlist only
                </button>
                <button
                  onClick={async () => {
                    const { track } = trackToDelete;
                    setTrackToDelete(null);
                    if (window.electronAPI?.library?.removeSong) {
                      await window.electronAPI.library.removeSong(track.id);
                    } else if (window.electronAPI?.library?.deleteTrack) {
                      await window.electronAPI.library.deleteTrack(track.id);
                    }
                    await playlistDb.removeTrackEverywhere(track.id);
                    await reloadPlaylists();
                    onShowToast(`Permanently deleted "${track.title}" from library`);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow transition-colors text-center"
                >
                  Delete permanently from library folder
                </button>
                <button
                  onClick={() => setTrackToDelete(null)}
                  className="w-full py-1.5 text-xs text-white/50 hover:text-white transition-colors text-center"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Library Storage & Backup Dialog */}
        {showStorageModal && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-100">
            <div className="w-full max-w-md rounded-2xl bg-[#0c0d12] border border-white/10 p-5 shadow-2xl text-white space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center space-x-2">
                  <HardDrive className="w-4 h-4 text-white" />
                  <h3 className="text-sm font-semibold">Library Storage & Backup</h3>
                </div>
                <button
                  onClick={() => setShowStorageModal(false)}
                  className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Free Space Warning */}
              {libraryStats && libraryStats.freeSpaceBytes < 1024 * 1024 * 1024 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center space-x-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <div className="text-[11px]">
                    <div className="font-semibold">Low disk space</div>
                    <div>Drive has less than 1 GB free space available.</div>
                  </div>
                </div>
              )}

              {/* Message */}
              {storageMessage && (
                <div
                  className={`p-2.5 rounded-xl text-[11px] flex items-center space-x-2 ${
                    storageMessage.error
                      ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                      : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {storageMessage.error ? (
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <Check className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  <span>{storageMessage.text}</span>
                </div>
              )}

              {/* Path & Open Folder */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white/80">Folder Path</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.electronAPI?.library?.openFolder) {
                        await window.electronAPI.library.openFolder();
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] flex items-center space-x-1"
                  >
                    <FolderOpen className="w-3 h-3" />
                    <span>Open folder</span>
                  </button>
                </div>
                <div className="font-mono text-[10px] text-white/50 bg-black/40 p-2 rounded-lg break-all border border-white/5">
                  {libraryStats?.libraryDir || 'Loading...'}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                  <div className="text-[10px] text-white/50">Tracks</div>
                  <div className="text-sm font-bold text-white">{libraryStats?.trackCount ?? '—'}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                  <div className="text-[10px] text-white/50">Size</div>
                  <div className="text-sm font-bold text-white">
                    {libraryStats ? `${(libraryStats.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB` : '—'}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                  <div className="text-[10px] text-white/50">Free Space</div>
                  <div className="text-sm font-bold text-white">
                    {libraryStats ? `${(libraryStats.freeSpaceBytes / (1024 * 1024 * 1024)).toFixed(1)} GB` : '—'}
                  </div>
                </div>
              </div>

              {/* Cleanup */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-white">Remove Unused Files</div>
                  <div className="text-[10px] text-white/50">Delete unreferenced audio & cover art</div>
                </div>
                <button
                  type="button"
                  disabled={isCleaning}
                  onClick={async () => {
                    setIsCleaning(true);
                    setStorageMessage(null);
                    try {
                      const activeIds = await playlistDb.getAllTrackIds();
                      const res = await window.electronAPI!.library!.cleanupUnused(activeIds);
                      setStorageMessage({
                        text: `Deleted ${res.deletedAudio} unused audio file(s) (${(res.freedBytes / (1024 * 1024)).toFixed(1)} MB freed).`,
                      });
                      await fetchLibraryStats();
                    } catch (err: any) {
                      setStorageMessage({ text: err.message || 'Cleanup failed', error: true });
                    } finally {
                      setIsCleaning(false);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs border border-red-500/20 flex items-center space-x-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{isCleaning ? 'Cleaning...' : 'Clean'}</span>
                </button>
              </div>

              {/* Backup & Restore */}
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    setStorageMessage(null);
                    try {
                      const res = await window.electronAPI!.library!.exportBackup();
                      if (res.success) {
                        setStorageMessage({ text: 'Library backup exported successfully!' });
                        onShowToast('Library backup exported successfully');
                      }
                    } catch (err: any) {
                      setStorageMessage({ text: err.message || 'Export failed', error: true });
                    }
                  }}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/10 flex items-center justify-center space-x-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Export Backup</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setStorageMessage(null);
                    try {
                      const res = await window.electronAPI!.library!.importBackup();
                      if (res.success) {
                        setStorageMessage({ text: `Imported ${res.importedCount} songs from backup!` });
                        await fetchLibraryStats();
                        await reloadPlaylists();
                        onShowToast(`Imported ${res.importedCount} songs from backup`);
                      }
                    } catch (err: any) {
                      setStorageMessage({ text: err.message || 'Import failed', error: true });
                    }
                  }}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/10 flex items-center justify-center space-x-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>Import Backup</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
