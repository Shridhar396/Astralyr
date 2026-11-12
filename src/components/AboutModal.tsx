import React, { useEffect } from 'react';
import { X, ExternalLink, Sparkles, Music2, Radio } from 'lucide-react';
import appIcon from '../../assets/branding/icon-512.png';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-[#08090c]/90 border border-white/10 shadow-2xl p-7 text-white flex flex-col items-center text-center overflow-hidden"
        style={{
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(255, 255, 255, 0.06)',
        }}
      >
        {/* Ambient Top Glow */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full blur-3xl pointer-events-none opacity-25"
          style={{ backgroundColor: 'var(--accent-rgb, #ffffff)' }}
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* App Icon */}
        <div className="relative mb-4 mt-1 group">
          <div
            className="absolute -inset-2 rounded-2xl blur-xl opacity-40 group-hover:opacity-70 transition-opacity pointer-events-none"
            style={{ backgroundColor: 'var(--accent-rgb, #ffffff)' }}
          />
          <img
            src={appIcon}
            alt="Constella Icon"
            className="relative w-20 h-20 rounded-2xl shadow-xl object-cover border border-white/15"
          />
        </div>

        {/* Wordmark (thin weight, lowercase) */}
        <h1
          className="text-4xl tracking-tight text-white font-[200] lowercase select-none"
          style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
        >
          constella
        </h1>

        {/* Tagline */}
        <p className="text-sm font-light text-white/70 mt-1 mb-3">
          your music, as a constellation
        </p>

        {/* Version Badge */}
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-white/60 mb-5">
          v1.0.2 · synced lyrics + ambient light
        </div>

        {/* Features / Highlights */}
        <div className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-3.5 mb-5 text-left text-xs space-y-2 text-white/75 font-light">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
            <span>Word-by-word synced starlight constellation lyrics</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <Radio className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
            <span>Beat-reactive ambient rim lighting & glow physics</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <Music2 className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
            <span>Live Audius streaming & local audio metadata matching</span>
          </div>
        </div>

        {/* Credits */}
        <div className="text-[11px] text-white/45 font-light leading-relaxed mb-6">
          Lyrics from LRCLIB. Music is never bundled or hosted.
        </div>

        {/* Actions & Links */}
        <div className="w-full flex items-center justify-between gap-3 pt-3 border-t border-white/10">
          <a
            href="https://github.com/Shridhar396/Constella"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white/80 hover:text-white transition-colors"
          >
            <svg
              className="w-3.5 h-3.5 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3 text-white/40" />
          </a>

          <button
            onClick={onClose}
            className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-white/90 text-black text-xs font-medium transition-all shadow active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
