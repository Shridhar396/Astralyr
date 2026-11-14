import React, { useState, useEffect, useRef } from 'react';
import {
  AppearanceConfig,
  AVAILABLE_FONTS,
  AVAILABLE_LOCALES,
  DEFAULT_APPEARANCE_CONFIG,
  DateFormatOption,
  DatePosition,
  TimeFormat,
  WordCase,
  VisualQuality,
  ensureFontLoaded,
} from '../services/appearanceConfig';
import { CURATED_BACKGROUNDS, getCuratedBackground } from '../services/curatedBackgrounds';
import { BackgroundTabContent } from './BackgroundTabContent';
import { AmbientColorConfig } from './BottomTrackPill';
import { MusicTrack } from '../types/lyrics';
import {
  Sliders,
  X,
  RotateCcw,
  Clock,
  Sparkles,
  ChevronDown,
  Check,
  Upload,
  Disc3,
  Palette,
  FolderArchive,
  HardDrive,
  FolderOpen,
  Trash2,
  Download,
  Type,
} from 'lucide-react';
import { playlistDb } from '../services/playlistDb';

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppearanceConfig;
  onUpdateConfig: (updated: Partial<AppearanceConfig>) => void;
  onResetDefault: () => void;
  initialTab?: string;
  onShowToast?: (message: string) => void;
  colorConfig?: AmbientColorConfig;
  onUpdateColorConfig?: (cfg: Partial<AmbientColorConfig>) => void;
  currentTrack?: MusicTrack;
}

interface DebouncedSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  formatValue?: (val: number) => string;
  onChange: (val: number) => void;
  description?: string;
}

const DebouncedSlider: React.FC<DebouncedSliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  formatValue,
  onChange,
  description,
}) => {
  const [localVal, setLocalVal] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const handleChange = (newVal: number) => {
    setLocalVal(newVal);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onChange(newVal);
    }, 250);
  };

  const handlePointerUp = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onChange(localVal);
  };

  const display = formatValue ? formatValue(localVal) : `${localVal}${unit}`;

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <div>
          <span className="font-medium text-white">{label}</span>
          {description && <div className="text-[10px] text-white/40">{description}</div>}
        </div>
        <span className="font-mono text-white/70">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localVal}
        onChange={(e) => handleChange(parseFloat(e.target.value))}
        onPointerUp={handlePointerUp}
        onTouchEnd={handlePointerUp}
        className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
      />
    </div>
  );
};

// 8 distinct vibrant glow colors + auto
const GLOW_COLORS = [
  { name: 'Crimson', hex: '#ff2d3c' },
  { name: 'Ember', hex: '#ff9628' },
  { name: 'Violet', hex: '#be6eff' },
  { name: 'Ocean', hex: '#4696ff' },
  { name: 'Aurora', hex: '#5affbe' },
  { name: 'Rose', hex: '#ff6eaa' },
  { name: 'Forest', hex: '#6ee682' },
  { name: 'White', hex: '#ffffff' },
];

export const AppearanceModal: React.FC<AppearanceModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onResetDefault,
  onShowToast,
  colorConfig,
  onUpdateColorConfig,
  currentTrack,
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Library stats for Desktop in Advanced
  const [libraryStats, setLibraryStats] = useState<{
    libraryDir: string;
    trackCount: number;
    totalSizeBytes: number;
    freeSpaceBytes: number;
  } | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [libraryMessage, setLibraryMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const loadLibraryStats = async () => {
    if (window.electronAPI?.library?.getStats) {
      try {
        const stats = await window.electronAPI.library.getStats();
        setLibraryStats(stats);
      } catch (err: any) {
        console.error('Failed to load library stats:', err);
      }
    }
  };

  useEffect(() => {
    if (isOpen && isAdvancedOpen) {
      loadLibraryStats();
    }
  }, [isOpen, isAdvancedOpen]);

  if (!isOpen) return null;

  const isGlowOn = config.ambientLightStyle !== 'off' && config.ambientMotionMode !== 'off';

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      if (url) {
        onUpdateConfig({
          bgMode: 'wallpaper',
          wallpaper: {
            ...(config.wallpaper || DEFAULT_APPEARANCE_CONFIG.wallpaper),
            url,
            useAlbumArt: false,
          },
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none animate-in fade-in duration-150">
      {/* SOLID DARK PANEL - NO backdrop-filter / backdrop-blur */}
      <div className="w-full max-w-xl max-h-[85vh] bg-[#0d1017] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-white/90">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#0d1017]">
          <div className="flex items-center space-x-2.5">
            <Sliders className="w-4 h-4 text-white" />
            <h3 className="font-semibold text-sm tracking-wide text-white">Appearance</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onResetDefault}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center space-x-1.5 transition-colors border border-white/5 text-[11px]"
              title="Restore default appearance"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Single Scrolling Panel */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* =========================================================================
              SECTION 1: BACKGROUND (9 curated tiles + Album art + Upload)
             ========================================================================= */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-medium text-white flex items-center space-x-1.5">
                <Palette className="w-3.5 h-3.5 text-white/70" />
                <span>Background</span>
              </span>
              <span className="text-[11px] text-white/50 capitalize">
                {config.bgMode === 'curated'
                  ? getCuratedBackground(config.bgCuratedId || 'crimson').name
                  : config.bgMode}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {/* 9 Curated Tiles */}
              {CURATED_BACKGROUNDS.map((bg) => {
                const isSelected =
                  config.bgMode === 'curated' &&
                  (config.bgCuratedId === bg.id || (!config.bgCuratedId && bg.id === 'crimson'));
                return (
                  <button
                    key={bg.id}
                    onClick={() => {
                      onUpdateConfig({ bgMode: 'curated', bgCuratedId: bg.id });
                    }}
                    className={`group relative flex flex-col p-1.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-white bg-white/15 ring-2 ring-white/60 shadow-lg'
                        : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
                    }`}
                  >
                    <div
                      className="w-full h-12 rounded-lg border border-white/10 shadow-inner relative overflow-hidden"
                      style={{ background: bg.css }}
                    >
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white text-black flex items-center justify-center shadow">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <span className="mt-1 text-[11px] font-medium text-white/80 group-hover:text-white truncate">
                      {bg.name}
                    </span>
                  </button>
                );
              })}

              {/* Album Art Tile */}
              <button
                onClick={() => onUpdateConfig({ bgMode: 'album' })}
                className={`group relative flex flex-col p-1.5 rounded-xl border text-left transition-all ${
                  config.bgMode === 'album'
                    ? 'border-white bg-white/15 ring-2 ring-white/60 shadow-lg'
                    : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
                }`}
              >
                <div className="w-full h-12 rounded-lg border border-white/10 bg-neutral-900 flex items-center justify-center relative overflow-hidden">
                  {currentTrack?.artworkUrl ? (
                    <img
                      src={currentTrack.artworkUrl}
                      alt="Album"
                      className="w-full h-full object-cover filter blur-[2px] opacity-80"
                    />
                  ) : (
                    <Disc3 className="w-5 h-5 text-indigo-400" />
                  )}
                  {config.bgMode === 'album' && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white text-black flex items-center justify-center shadow">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>
                <span className="mt-1 text-[11px] font-medium text-white/80 group-hover:text-white truncate">
                  Album art
                </span>
              </button>

              {/* Upload Tile */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`group relative flex flex-col p-1.5 rounded-xl border text-left transition-all ${
                  config.bgMode === 'wallpaper'
                    ? 'border-white bg-white/15 ring-2 ring-white/60 shadow-lg'
                    : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
                }`}
              >
                <div className="w-full h-12 rounded-lg border border-dashed border-white/20 bg-white/[0.03] flex items-center justify-center relative overflow-hidden">
                  {config.bgMode === 'wallpaper' && config.wallpaper?.url ? (
                    <img
                      src={config.wallpaper.url}
                      alt="Wallpaper"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Upload className="w-4 h-4 text-white/60 group-hover:text-white" />
                  )}
                  {config.bgMode === 'wallpaper' && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white text-black flex items-center justify-center shadow">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>
                <span className="mt-1 text-[11px] font-medium text-white/80 group-hover:text-white truncate">
                  Upload
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleWallpaperUpload}
                  className="hidden"
                />
              </button>
            </div>
          </div>

          {/* =========================================================================
              SECTION 2: GLOW (On/Off, 8 dots + Auto, Brightness, Speed, Beat sync)
             ========================================================================= */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="font-medium text-white">Edge Glow Light</span>
              </div>
              <button
                onClick={() => {
                  onUpdateConfig({
                    ambientLightStyle: isGlowOn ? 'off' : 'sliding',
                    ambientMotionMode: isGlowOn ? 'off' : 'beat',
                  });
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isGlowOn ? 'bg-white' : 'bg-white/20'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isGlowOn ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {isGlowOn && (
              <>
                {/* 8 Colour Dots + Auto */}
                <div>
                  <div className="text-[11px] text-white/60 mb-2">Color</div>
                  <div className="flex items-center flex-wrap gap-2">
                    {/* Auto (follow background) */}
                    <button
                      onClick={() => onUpdateColorConfig?.({ mode: 'auto' })}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium flex items-center space-x-1.5 transition-all ${
                        colorConfig?.mode === 'auto'
                          ? 'bg-white text-black ring-2 ring-white/70 shadow'
                          : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auto</span>
                    </button>

                    {/* 8 Colour Dots */}
                    {GLOW_COLORS.map((col) => {
                      const isSelected =
                        colorConfig?.mode === 'preset' &&
                        colorConfig?.presetColor.toLowerCase() === col.hex.toLowerCase();
                      return (
                        <button
                          key={col.hex}
                          onClick={() => {
                            onUpdateColorConfig?.({ mode: 'preset', presetColor: col.hex });
                          }}
                          title={col.name}
                          className={`w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center ${
                            isSelected
                              ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0d1017] scale-110 shadow-lg'
                              : ''
                          }`}
                          style={{
                            backgroundColor: col.hex,
                            boxShadow: `0 0 10px ${col.hex}66`,
                          }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-black drop-shadow stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Brightness Slider */}
                <DebouncedSlider
                  label="Brightness"
                  min={0.2}
                  max={2.0}
                  step={0.05}
                  value={config.ambientIntensity}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(val) => onUpdateConfig({ ambientIntensity: val })}
                />

                {/* Speed Slider */}
                <DebouncedSlider
                  label="Speed"
                  min={0.2}
                  max={2.5}
                  step={0.05}
                  value={config.ambientMotionSpeed}
                  formatValue={(v) => `${v.toFixed(1)}x`}
                  onChange={(val) => onUpdateConfig({ ambientMotionSpeed: val })}
                />

                {/* Beat Sync Toggle */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-white font-medium">Beat reaction</span>
                  <button
                    onClick={() => {
                      onUpdateConfig({ ambientBeatSync: !config.ambientBeatSync });
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      config.ambientBeatSync !== false ? 'bg-white' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                        config.ambientBeatSync !== false ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* =========================================================================
              SECTION 3: LYRICS (Style: Constellation, Font, Size)
             ========================================================================= */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-4">
            <div className="flex items-center space-x-2">
              <Type className="w-4 h-4 text-purple-400" />
              <span className="font-medium text-white">Lyrics</span>
            </div>

            {/* Style Segmented Control */}
            <div>
              <div className="text-[11px] text-white/60 mb-1.5">Style</div>
              <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10">
                <button
                  type="button"
                  className="px-3.5 py-1.5 rounded-lg text-[11px] font-medium bg-white text-black shadow transition-all"
                >
                  Constellation
                </button>
              </div>
            </div>

            {/* Font Dropdown */}
            <div>
              <div className="text-[11px] text-white/60 mb-1.5">Font</div>
              <select
                value={config.lyricsFont}
                onChange={(e) => {
                  ensureFontLoaded(e.target.value);
                  onUpdateConfig({ lyricsFont: e.target.value });
                }}
                className="w-full bg-[#161a24] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white/40 text-xs"
              >
                {AVAILABLE_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Size Slider */}
            <DebouncedSlider
              label="Size"
              min={24}
              max={64}
              step={1}
              unit="px"
              value={config.lyricsActiveSize}
              onChange={(val) => onUpdateConfig({ lyricsActiveSize: val })}
            />
          </div>

          {/* =========================================================================
              SECTION 4: CLOCK (12h/24h, Show date, Font)
             ========================================================================= */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="font-medium text-white">Clock</span>
            </div>

            {/* 12h / 24h Segmented Control */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/60">Time Format</span>
              <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10">
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ timeFormat: '12h', showAmPm: true })}
                  className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    config.timeFormat === '12h'
                      ? 'bg-white text-black shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  12h
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ timeFormat: '24h', showAmPm: false })}
                  className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    config.timeFormat === '24h'
                      ? 'bg-white text-black shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  24h
                </button>
              </div>
            </div>

            {/* Show Date Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/60">Show date</span>
              <button
                onClick={() => {
                  onUpdateConfig({
                    dateFormat: config.dateFormat === 'hidden' ? 'short' : 'hidden',
                  });
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  config.dateFormat !== 'hidden' ? 'bg-white' : 'bg-white/20'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                    config.dateFormat !== 'hidden' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Clock Font Dropdown */}
            <div>
              <div className="text-[11px] text-white/60 mb-1.5">Clock Font</div>
              <select
                value={config.timeFont}
                onChange={(e) => {
                  ensureFontLoaded(e.target.value);
                  onUpdateConfig({ timeFont: e.target.value });
                }}
                className="w-full bg-[#161a24] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white/40 text-xs"
              >
                {AVAILABLE_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* =========================================================================
              SECTION 5: ADVANCED (Collapsed Accordion, closed by default)
             ========================================================================= */}
          <div className="pt-2">
            <button
              onClick={() => setIsAdvancedOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-white/70" />
                <span>Advanced Controls</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-white/60 transition-transform duration-200 ${
                  isAdvancedOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isAdvancedOpen && (
              <div className="mt-3 p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-6 animate-in fade-in duration-200">
                {/* Advanced Background Customizer */}
                <div>
                  <h4 className="font-semibold text-white/90 text-sm mb-3">Custom Background Builder</h4>
                  <BackgroundTabContent
                    config={config}
                    onUpdateConfig={onUpdateConfig}
                    onShowToast={onShowToast}
                  />
                </div>

                {/* Advanced Glow Settings */}
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <h4 className="font-semibold text-white/90 text-sm">Glow Fine-Tuning</h4>
                  <DebouncedSlider
                    label="Glow Arc Length"
                    min={0.2}
                    max={0.5}
                    step={0.02}
                    value={config.ambientLightLength ?? 0.3}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onChange={(val) => onUpdateConfig({ ambientLightLength: val })}
                  />
                  <DebouncedSlider
                    label="Glow Inward Bleed Size"
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    value={config.ambientLightGlowSize ?? 1.0}
                    formatValue={(v) => `${v.toFixed(1)}x`}
                    onChange={(val) => onUpdateConfig({ ambientLightGlowSize: val })}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">Number of Lights</span>
                    <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10">
                      {[1, 2].map((cnt) => (
                        <button
                          key={cnt}
                          onClick={() => onUpdateConfig({ ambientLightCount: cnt as 1 | 2 })}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                            config.ambientLightCount === cnt
                              ? 'bg-white text-black shadow'
                              : 'text-white/60 hover:text-white'
                          }`}
                        >
                          {cnt} {cnt === 1 ? 'Light' : 'Lights'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">Motion Direction</span>
                    <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10">
                      {(['clockwise', 'counter-clockwise', 'alternating'] as const).map((dir) => (
                        <button
                          key={dir}
                          onClick={() => onUpdateConfig({ ambientLightDirection: dir })}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-medium capitalize transition-all ${
                            config.ambientLightDirection === dir
                              ? 'bg-white text-black shadow'
                              : 'text-white/60 hover:text-white'
                          }`}
                        >
                          {dir === 'counter-clockwise' ? 'Counter' : dir}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-white/70 text-xs mb-1">Visual Performance Quality</label>
                    <select
                      value={config.visualQuality || 'auto'}
                      onChange={(e) => onUpdateConfig({ visualQuality: e.target.value as VisualQuality })}
                      className="w-full bg-[#161a24] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white/40 text-xs"
                    >
                      <option value="auto">Auto (Adaptive 60fps)</option>
                      <option value="high">High Quality</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low (Battery Saver)</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </div>
                </div>

                {/* Advanced Lyrics Settings */}
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <h4 className="font-semibold text-white/90 text-sm">Lyrics Details</h4>
                  <div>
                    <label className="block text-white/70 text-xs mb-1">Active Line Font Weight</label>
                    <select
                      value={config.lyricsActiveWeight}
                      onChange={(e) => onUpdateConfig({ lyricsActiveWeight: parseInt(e.target.value, 10) })}
                      className="w-full bg-[#161a24] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white/40 text-xs"
                    >
                      <option value={200}>200 - Ultra Light</option>
                      <option value={300}>300 - Light</option>
                      <option value={400}>400 - Regular</option>
                      <option value={700}>700 - Bold</option>
                    </select>
                  </div>
                  <DebouncedSlider
                    label="Past Lines Size"
                    min={10}
                    max={20}
                    step={1}
                    unit="px"
                    value={config.lyricsPastSize}
                    onChange={(val) => onUpdateConfig({ lyricsPastSize: val })}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">Word Case</span>
                    <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10">
                      {(['original', 'lowercase', 'uppercase'] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => onUpdateConfig({ lyricsCase: c as WordCase })}
                          className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                            config.lyricsCase === c
                              ? 'bg-white text-black shadow'
                              : 'text-white/60 hover:text-white'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">Show Constellation Stars</span>
                    <input
                      type="checkbox"
                      checked={config.showStars}
                      onChange={(e) => onUpdateConfig({ showStars: e.target.checked })}
                      className="w-4 h-4 rounded accent-white"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">Show Connecting Lines</span>
                    <input
                      type="checkbox"
                      checked={config.showConnectingLines}
                      onChange={(e) => onUpdateConfig({ showConnectingLines: e.target.checked })}
                      className="w-4 h-4 rounded accent-white"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">Tint Lyrics with Accent Glow</span>
                    <input
                      type="checkbox"
                      checked={config.tintLyricsWithAccent}
                      onChange={(e) => onUpdateConfig({ tintLyricsWithAccent: e.target.checked })}
                      className="w-4 h-4 rounded accent-white"
                    />
                  </div>
                </div>

                {/* Advanced Clock & Date */}
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <h4 className="font-semibold text-white/90 text-sm">Clock & Date Typography</h4>
                  <DebouncedSlider
                    label="Clock Size"
                    min={70}
                    max={160}
                    step={2}
                    unit="px"
                    value={config.timeSize}
                    onChange={(val) => onUpdateConfig({ timeSize: val })}
                  />
                  <div>
                    <label className="block text-white/70 text-xs mb-1">Clock Font Weight</label>
                    <select
                      value={config.timeWeight}
                      onChange={(e) => onUpdateConfig({ timeWeight: parseInt(e.target.value, 10) })}
                      className="w-full bg-[#161a24] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white/40 text-xs"
                    >
                      <option value={200}>200 - Ultra Light</option>
                      <option value={300}>300 - Light</option>
                      <option value={400}>400 - Regular</option>
                      <option value={700}>700 - Bold</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">Show Seconds</span>
                    <input
                      type="checkbox"
                      checked={config.showSeconds}
                      onChange={(e) => onUpdateConfig({ showSeconds: e.target.checked })}
                      className="w-4 h-4 rounded accent-white"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">Leading Zero (e.g. 09:41)</span>
                    <input
                      type="checkbox"
                      checked={config.leadingZero}
                      onChange={(e) => onUpdateConfig({ leadingZero: e.target.checked })}
                      className="w-4 h-4 rounded accent-white"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 text-xs mb-1">Date Format Style</label>
                    <select
                      value={config.dateFormat}
                      onChange={(e) => onUpdateConfig({ dateFormat: e.target.value as DateFormatOption })}
                      className="w-full bg-[#161a24] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white/40 text-xs"
                    >
                      <option value="short">Short (Thu Nov 12)</option>
                      <option value="long">Long (Thursday, 12 November)</option>
                      <option value="numeric-dmy">Numeric Day/Month (12/11/2026)</option>
                      <option value="numeric-mdy">Numeric Month/Day (11/12/2026)</option>
                      <option value="iso">ISO Format (2026-11-12)</option>
                      <option value="day-month">Day & Month (12 Nov)</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">Date Position</span>
                    <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10">
                      {(['above', 'below'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => onUpdateConfig({ datePosition: pos as DatePosition })}
                          className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                            config.datePosition === pos
                              ? 'bg-white text-black shadow'
                              : 'text-white/60 hover:text-white'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-white/70 text-xs mb-1">Date Font</label>
                    <select
                      value={config.dateFont}
                      onChange={(e) => {
                        ensureFontLoaded(e.target.value);
                        onUpdateConfig({ dateFont: e.target.value });
                      }}
                      className="w-full bg-[#161a24] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white/40 text-xs"
                    >
                      <option value="follow-time">Follow Clock Font</option>
                      {AVAILABLE_FONTS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-white/70 text-xs mb-1">Language / Locale</label>
                    <select
                      value={config.locale}
                      onChange={(e) => onUpdateConfig({ locale: e.target.value })}
                      className="w-full bg-[#161a24] border border-white/15 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white/40 text-xs"
                    >
                      {AVAILABLE_LOCALES.map((loc) => (
                        <option key={loc.code} value={loc.code}>
                          {loc.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Library Management (Desktop Only) */}
                {window.electronAPI?.library && (
                  <div className="pt-4 border-t border-white/10 space-y-3">
                    <h4 className="font-semibold text-white/90 text-sm flex items-center space-x-2">
                      <FolderArchive className="w-4 h-4 text-emerald-400" />
                      <span>Library & Permanent Storage</span>
                    </h4>
                    {libraryStats && (
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1.5 text-[11px] text-white/70">
                        <div className="flex justify-between">
                          <span>Tracks in Library:</span>
                          <span className="font-mono text-white">{libraryStats.trackCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Library Disk Usage:</span>
                          <span className="font-mono text-white">
                            {(libraryStats.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Free Space on Disk:</span>
                          <span className="font-mono text-white">
                            {(libraryStats.freeSpaceBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await window.electronAPI?.library?.openFolder();
                          } catch (err: any) {
                            setLibraryMessage({ text: err.message, error: true });
                          }
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium flex items-center justify-center space-x-2 transition-colors border border-white/10"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Open Folder</span>
                      </button>
                      <button
                        disabled={isCleaning}
                        onClick={async () => {
                          setIsCleaning(true);
                          setLibraryMessage(null);
                          try {
                            const res = await window.electronAPI?.library?.cleanupUnused([]);
                            if (res) {
                              setLibraryMessage({
                                text: `Cleaned ${res.deletedAudio} orphaned file(s) (${(res.freedBytes / (1024 * 1024)).toFixed(1)} MB freed).`,
                              });
                              loadLibraryStats();
                            }
                          } catch (err: any) {
                            setLibraryMessage({ text: err.message, error: true });
                          } finally {
                            setIsCleaning(false);
                          }
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-medium flex items-center justify-center space-x-2 transition-colors border border-rose-500/30 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isCleaning ? 'Cleaning...' : 'Clean Orphans'}</span>
                      </button>
                    </div>
                    {libraryMessage && (
                      <div
                        className={`text-[11px] p-2 rounded-lg ${
                          libraryMessage.error
                            ? 'bg-rose-500/10 text-rose-300'
                            : 'bg-emerald-500/10 text-emerald-300'
                        }`}
                      >
                        {libraryMessage.text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
