import React, { useState } from 'react';
import { X, Search, Sparkles, Music, Loader2 } from 'lucide-react';
import { LrcService } from '../services/lrcService';

interface LrcSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyLyrics: (title: string, artist: string, lrcText: string) => void;
}

export const LrcSearchModal: React.FC<LrcSearchModalProps> = ({
  isOpen,
  onClose,
  onApplyLyrics,
}) => {
  const [trackName, setTrackName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackName.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    const lrc = await LrcService.fetchLyrics(trackName.trim(), artistName.trim());
    setLoading(false);

    if (lrc) {
      onApplyLyrics(trackName.trim(), artistName.trim() || 'Unknown Artist', lrc);
      onClose();
    } else {
      setErrorMsg('No synced lyrics found on lrclib.net. Try different keywords.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-white/10 shadow-2xl relative font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-sm text-white">Fetch Synced Lyrics (LRCLIB.net)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg glass-pill text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSearch} className="my-4 space-y-3">
          <div>
            <label className="block text-slate-400 mb-1">Track / Song Title:</label>
            <input
              type="text"
              placeholder="e.g. Resonance, Starboy, After Hours"
              value={trackName}
              onChange={(e) => setTrackName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-white/40"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Artist Name (Optional):</label>
            <input
              type="text"
              placeholder="e.g. HOME, The Weeknd"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-white/40"
            />
          </div>

          {errorMsg && (
            <div className="text-red-400 text-[11px] bg-red-500/10 p-2 rounded border border-red-500/20">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-white hover:bg-white/90 text-black font-semibold flex items-center justify-center space-x-2 transition-all mt-4"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>Searching LRCLIB API...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 text-black" />
                <span>Fetch Synced Constellation Lyrics</span>
              </>
            )}
          </button>
        </form>

        <div className="text-[10px] text-slate-500 border-t border-white/10 pt-3">
          Free, open-source synced lyrics API powered by lrclib.net. If a song is offline, the app seamlessly falls back to our curated ambient synthwave demo tracks!
        </div>
      </div>
    </div>
  );
};

