import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Check, AlertCircle } from 'lucide-react';
import { Playlist } from '../services/playlistDb';

const CURATED_EMOJIS = [
  '❤️', '✨', '🌙', '🪐', '⚡', '🔥', '🌊', '🎧', '🌌', '🎵', '🔮', '💎', '🚀', '☕', '🌿', '💿'
];

const COVER_PALETTE = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'White', hex: '#ffffff' },
];

interface PlaylistNamingModalProps {
  isOpen: boolean;
  mode: 'create' | 'rename';
  initialName?: string;
  initialColor?: string;
  initialEmoji?: string;
  existingPlaylists: Playlist[];
  currentPlaylistId?: string;
  onClose: () => void;
  onSubmit: (name: string, coverColor?: string, coverEmoji?: string) => void;
}

export const PlaylistNamingModal: React.FC<PlaylistNamingModalProps> = ({
  isOpen,
  mode,
  initialName = '',
  initialColor,
  initialEmoji,
  existingPlaylists,
  currentPlaylistId,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState(initialName);
  const [coverType, setCoverType] = useState<'auto' | 'emoji' | 'color'>('auto');
  const [selectedColor, setSelectedColor] = useState<string | undefined>(initialColor);
  const [selectedEmoji, setSelectedEmoji] = useState<string | undefined>(initialEmoji);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setSelectedColor(initialColor);
      setSelectedEmoji(initialEmoji);
      if (initialEmoji) {
        setCoverType('emoji');
      } else if (initialColor) {
        setCoverType('color');
      } else {
        setCoverType('auto');
      }
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, initialName, initialColor, initialEmoji]);

  // Handle Esc key
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

  if (!isOpen) return null;

  const validate = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Please enter a playlist name';
    }
    if (trimmed.length > 40) {
      return 'Playlist name cannot exceed 40 characters';
    }
    const isDup = existingPlaylists.some(
      (p) =>
        p.id !== currentPlaylistId &&
        p.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDup) {
      return `A playlist named "${trimmed}" already exists`;
    }
    return null;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (error) {
      setError(validate(val));
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      inputRef.current?.focus();
      return;
    }

    const trimmed = name.trim();
    let finalColor = coverType === 'color' ? selectedColor : undefined;
    let finalEmoji = coverType === 'emoji' ? selectedEmoji : undefined;

    onSubmit(trimmed, finalColor, finalEmoji);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-[#090a0f]/95 border border-white/10 shadow-2xl p-5 text-white flex flex-col overflow-hidden"
        style={{
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.95), 0 0 1px 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white tracking-tight">
            {mode === 'create' ? '+ New Playlist' : 'Rename Playlist'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Input */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="playlist-name-input" className="text-xs font-medium text-white/80">
                Playlist Name <span className="text-red-400">*</span>
              </label>
              <span className={`text-[10px] font-mono ${name.trim().length > 40 ? 'text-red-400' : 'text-white/40'}`}>
                {name.trim().length} / 40
              </span>
            </div>
            <input
              id="playlist-name-input"
              ref={inputRef}
              type="text"
              value={name}
              onChange={handleNameChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="e.g. Midnight Drive, Lo-Fi Chill..."
              maxLength={45}
              className={`w-full px-3 py-2 rounded-xl bg-white/5 border text-xs text-white placeholder-white/30 focus:outline-none transition-colors ${
                error
                  ? 'border-red-500/80 focus:border-red-500'
                  : 'border-white/15 focus:border-white/40'
              }`}
            />
            {error && (
              <div className="flex items-center space-x-1.5 mt-1.5 text-[11px] text-red-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Optional: Cover Type Picker */}
          <div>
            <div className="text-xs font-medium text-white/80 mb-1.5">
              Playlist Artwork <span className="text-[10px] text-white/40">(Optional)</span>
            </div>
            <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/10 text-xs mb-2.5">
              <button
                type="button"
                onClick={() => setCoverType('auto')}
                className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-all ${
                  coverType === 'auto'
                    ? 'bg-white text-black shadow'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                2x2 Covers
              </button>
              <button
                type="button"
                onClick={() => {
                  setCoverType('emoji');
                  if (!selectedEmoji) setSelectedEmoji('✨');
                }}
                className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-all ${
                  coverType === 'emoji'
                    ? 'bg-white text-black shadow'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Emoji
              </button>
              <button
                type="button"
                onClick={() => {
                  setCoverType('color');
                  if (!selectedColor) setSelectedColor('#8b5cf6');
                }}
                className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-all ${
                  coverType === 'color'
                    ? 'bg-white text-black shadow'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Color
              </button>
            </div>

            {/* Emoji Selection Grid */}
            {coverType === 'emoji' && (
              <div className="grid grid-cols-8 gap-1 p-2 rounded-xl bg-white/[0.03] border border-white/5 animate-in fade-in duration-150">
                {CURATED_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                      selectedEmoji === emoji
                        ? 'bg-white/25 border border-white/40 scale-105'
                        : 'hover:bg-white/10'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Color Swatches Grid */}
            {coverType === 'color' && (
              <div className="grid grid-cols-9 gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/5 animate-in fade-in duration-150">
                {COVER_PALETTE.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setSelectedColor(c.hex)}
                    className={`w-7 h-7 rounded-lg transition-transform flex items-center justify-center border ${
                      selectedColor === c.hex
                        ? 'border-white scale-110 shadow'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {selectedColor === c.hex && (
                      <Check
                        className={`w-3.5 h-3.5 ${
                          c.hex === '#ffffff' ? 'text-black' : 'text-white'
                        }`}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            {coverType === 'auto' && (
              <div className="text-[11px] text-white/40 italic px-1">
                A 2x2 grid will automatically generate from the first 4 songs added to this playlist.
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              id="playlist-submit-btn"
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-white hover:bg-white/90 text-black text-xs font-semibold shadow transition-all active:scale-95"
            >
              {mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
