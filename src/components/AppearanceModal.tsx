import React, { useState, useEffect, useRef } from 'react';
import {
  AppearanceConfig,
  AVAILABLE_FONTS,
  AVAILABLE_LOCALES,
  APPEARANCE_PRESETS,
  DEFAULT_APPEARANCE_CONFIG,
  DateFormatOption,
  DatePosition,
  TimeFormat,
  WordCase,
  VisualQuality,
} from '../services/appearanceConfig';
import { BackgroundTabContent } from './BackgroundTabContent';
import {
  Sliders,
  X,
  RotateCcw,
  Clock,
  Calendar,
  Sparkles,
  Wand2,
  Check,
  AlertCircle,
  FolderArchive,
  HardDrive,
  FolderOpen,
  Trash2,
  Download,
  Upload,
  Palette,
  Zap,
  Lock,
} from 'lucide-react';
import { playlistDb } from '../services/playlistDb';
import {
  hasFeature,
  FREE_ALLOWED_FONTS,
  FREE_ALLOWED_THEMES,
  FREE_GLOW_COLORS,
  startProPreview,
  isProPreviewActive,
  hasUsedProPreview,
  BUY_PRO_URL,
} from '../features';

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppearanceConfig;
  onUpdateConfig: (updated: Partial<AppearanceConfig>) => void;
  onResetDefault: () => void;
  initialTab?: 'presets' | 'time' | 'date' | 'lyrics' | 'ambient' | 'background' | 'effects' | 'library';
  onShowToast?: (message: string) => void;
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

export const AppearanceModal: React.FC<AppearanceModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onResetDefault,
  initialTab,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'time' | 'date' | 'lyrics' | 'ambient' | 'background' | 'effects' | 'library'>('presets');
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
    if (isOpen && activeTab === 'library') {
      loadLibraryStats();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[85vh] bg-[#0c0d12]/90 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs text-white/90">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center space-x-2.5">
            <Sliders className="w-4 h-4 text-white" />
            <h3 className="font-semibold text-sm tracking-wide text-white">Appearance Settings</h3>
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 px-4 bg-black/30">
          <button
            data-tab="presets"
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-2.5 font-medium flex items-center space-x-1.5 border-b-2 transition-all text-xs ${
              activeTab === 'presets'
                ? 'border-white text-white'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Presets</span>
          </button>
          <button
            data-tab="time"
            onClick={() => setActiveTab('time')}
            className={`px-3 py-2.5 font-medium flex items-center space-x-1.5 border-b-2 transition-all text-xs ${
              activeTab === 'time'
                ? 'border-white text-white'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Time</span>
          </button>
          <button
            data-tab="date"
            onClick={() => setActiveTab('date')}
            className={`px-3 py-2.5 font-medium flex items-center space-x-1.5 border-b-2 transition-all text-xs ${
              activeTab === 'date'
                ? 'border-white text-white'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Date & Language</span>
          </button>
          <button
            data-tab="lyrics"
            onClick={() => setActiveTab('lyrics')}
            className={`px-3 py-2.5 font-medium flex items-center space-x-1.5 border-b-2 transition-all text-xs ${
              activeTab === 'lyrics'
                ? 'border-white text-white'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Lyrics Constellation</span>
          </button>
          <button
            data-tab="ambient"
            onClick={() => setActiveTab('ambient')}
            className={`px-3 py-2.5 font-medium flex items-center space-x-1.5 border-b-2 transition-all text-xs ${
              activeTab === 'ambient'
                ? 'border-white text-white'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ambient Light</span>
          </button>
          <button
            data-tab="background"
            onClick={() => setActiveTab('background')}
            className={`px-3 py-2.5 font-medium flex items-center space-x-1.5 border-b-2 transition-all text-xs ${
              activeTab === 'background'
                ? 'border-white text-white'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Background</span>
          </button>
          <button
            data-tab="effects"
            onClick={() => setActiveTab('effects')}
            className={`px-3 py-2.5 font-medium flex items-center space-x-1.5 border-b-2 transition-all text-xs ${
              activeTab === 'effects'
                ? 'border-white text-white'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Effects</span>
          </button>
          <button
            data-tab="library"
            onClick={() => setActiveTab('library')}
            className={`px-3 py-2.5 font-medium flex items-center space-x-1.5 border-b-2 transition-all text-xs ${
              activeTab === 'library'
                ? 'border-white text-white'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>Library</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-5 space-y-5 flex-1 custom-scrollbar">
          {/* TAB 1: PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <div className="text-[11px] text-white/50 mb-1">
                Choose a pre-crafted typography and layout preset, or fine-tune individually:
              </div>
              <div className="grid grid-cols-2 gap-3">
                {APPEARANCE_PRESETS.map((p) => {
                  const isPresetLocked = !hasFeature('appearance_presets');
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (isPresetLocked) {
                          if (!hasUsedProPreview()) {
                            startProPreview();
                            if (onShowToast) onShowToast('30s Pro Visuals Preview started!');
                            onUpdateConfig(p.config);
                          } else {
                            if (onShowToast) onShowToast('Presets are exclusive to Astralyr Desktop Pro.');
                          }
                          return;
                        }
                        onUpdateConfig(p.config);
                      }}
                      className="p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/25 text-left transition-all group flex flex-col justify-between"
                    >
                      <div>
                        <div className="font-semibold text-white text-sm mb-1 group-hover:text-white transition-colors flex items-center justify-between">
                          <span>{p.name}</span>
                          {isPresetLocked && <Lock className="w-3.5 h-3.5 text-amber-400" />}
                        </div>
                        <div className="text-[11px] text-white/50 leading-relaxed">
                          {p.description}
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-white/40 font-mono flex items-center justify-between">
                        <span>Click to apply</span>
                        {isPresetLocked && <span className="text-amber-400/80">Pro</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: TIME */}
          {activeTab === 'time' && (
            <div className="space-y-4">
              {/* Format: 12-hour or 24-hour */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <div>
                  <div className="font-medium text-white">Hour Format</div>
                  <div className="text-[11px] text-white/50">Switch between 12-hour and 24-hour clock</div>
                </div>
                <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/10">
                  <button
                    onClick={() => onUpdateConfig({ timeFormat: '12h' })}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      config.timeFormat === '12h'
                        ? 'bg-white text-black shadow'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    12-Hour
                  </button>
                  <button
                    onClick={() => onUpdateConfig({ timeFormat: '24h' })}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      config.timeFormat === '24h'
                        ? 'bg-white text-black shadow'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    24-Hour
                  </button>
                </div>
              </div>

              {/* Toggles: AM/PM, Seconds, Leading Zero */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* AM/PM indicator */}
                <div
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                    config.timeFormat === '12h'
                      ? 'bg-white/[0.03] border-white/10'
                      : 'opacity-40 bg-white/[0.01] border-white/5'
                  }`}
                >
                  <span className="font-medium text-white">AM / PM Suffix</span>
                  <label className="flex items-center justify-between mt-2 cursor-pointer">
                    <span className="text-[11px] text-white/50">Show suffix</span>
                    <input
                      type="checkbox"
                      disabled={config.timeFormat !== '12h'}
                      checked={config.showAmPm}
                      onChange={(e) => onUpdateConfig({ showAmPm: e.target.checked })}
                      className="w-4 h-4 rounded accent-white cursor-pointer"
                    />
                  </label>
                </div>

                {/* Show Seconds */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
                  <span className="font-medium text-white">Show Seconds</span>
                  <label className="flex items-center justify-between mt-2 cursor-pointer">
                    <span className="text-[11px] text-white/50">:SS display</span>
                    <input
                      type="checkbox"
                      checked={config.showSeconds}
                      onChange={(e) => onUpdateConfig({ showSeconds: e.target.checked })}
                      className="w-4 h-4 rounded accent-white cursor-pointer"
                    />
                  </label>
                </div>

                {/* Leading Zero */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
                  <span className="font-medium text-white">Leading Zero</span>
                  <label className="flex items-center justify-between mt-2 cursor-pointer">
                    <span className="text-[11px] text-white/50">06:00 vs 6:00</span>
                    <input
                      type="checkbox"
                      checked={config.leadingZero}
                      onChange={(e) => onUpdateConfig({ leadingZero: e.target.checked })}
                      className="w-4 h-4 rounded accent-white cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Time Font Selection */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="font-medium text-white">Time Font</div>
                <div className="grid grid-cols-3 gap-2">
                  {AVAILABLE_FONTS.map((f) => {
                    const isFontLocked = !hasFeature('all_fonts') && !FREE_ALLOWED_FONTS.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          if (isFontLocked) {
                            if (!hasUsedProPreview()) {
                              startProPreview();
                              if (onShowToast) onShowToast('30s Pro Visuals Preview started!');
                              onUpdateConfig({ timeFont: f.id });
                            } else {
                              if (onShowToast) onShowToast(`${f.name} font is exclusive to Astralyr Desktop Pro.`);
                            }
                            return;
                          }
                          onUpdateConfig({ timeFont: f.id });
                        }}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          config.timeFont === f.id
                            ? 'bg-white/20 border-white text-white'
                            : 'bg-black/30 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="text-xs font-semibold truncate flex items-center justify-between">
                          <span>{f.name}</span>
                          {isFontLocked && <Lock className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />}
                        </div>
                        <div
                          className="text-sm mt-1 truncate opacity-90"
                          style={{ fontFamily: f.family }}
                        >
                          12:45
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Weight */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <div>
                  <div className="font-medium text-white">Font Weight</div>
                  <div className="text-[11px] text-white/50">Typography thickness</div>
                </div>
                <div className="flex space-x-1">
                  {[
                    { label: 'Thin', val: 200 },
                    { label: 'Light', val: 300 },
                    { label: 'Regular', val: 400 },
                    { label: 'Bold', val: 700 },
                  ].map((w) => (
                    <button
                      key={w.val}
                      onClick={() => onUpdateConfig({ timeWeight: w.val })}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        config.timeWeight === w.val
                          ? 'bg-white text-black font-bold shadow'
                          : 'bg-black/40 text-white/60 hover:text-white'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Size Slider */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-white">Time Font Size</span>
                  <span className="font-mono text-white/80">{config.timeSize} px</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="160"
                  step="2"
                  value={config.timeSize}
                  onChange={(e) => onUpdateConfig({ timeSize: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>
            </div>
          )}

          {/* TAB 3: DATE & LANGUAGE */}
          {activeTab === 'date' && (
            <div className="space-y-4">
              {/* Date Format */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="font-medium text-white">Date Format</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'short', label: 'Thu Nov 12', desc: 'Short Date' },
                    { id: 'long', label: 'Thursday, 12 November', desc: 'Full Long' },
                    { id: 'day-month', label: '12 Nov', desc: 'Day & Month' },
                    { id: 'numeric-dmy', label: '12/11/2026', desc: 'DD/MM/YYYY' },
                    { id: 'numeric-mdy', label: '11/12/2026', desc: 'MM/DD/YYYY' },
                    { id: 'iso', label: '2026-11-12', desc: 'ISO Standard' },
                    { id: 'hidden', label: 'Hidden', desc: 'Hide Date' },
                  ].map((df) => (
                    <button
                      key={df.id}
                      onClick={() => onUpdateConfig({ dateFormat: df.id as DateFormatOption })}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        config.dateFormat === df.id
                          ? 'bg-white/20 border-white text-white'
                          : 'bg-black/30 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="font-semibold text-xs truncate">{df.label}</div>
                      <div className="text-[10px] text-white/40 truncate">{df.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Position: Above vs Below */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <div>
                  <div className="font-medium text-white">Date Position</div>
                  <div className="text-[11px] text-white/50">Show date above or below the time</div>
                </div>
                <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/10">
                  <button
                    onClick={() => onUpdateConfig({ datePosition: 'above' })}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      config.datePosition === 'above'
                        ? 'bg-white text-black shadow'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Above Time
                  </button>
                  <button
                    onClick={() => onUpdateConfig({ datePosition: 'below' })}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      config.datePosition === 'below'
                        ? 'bg-white text-black shadow'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Below Time
                  </button>
                </div>
              </div>

              {/* Date Font */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-white">Date Font</span>
                  {config.dateFont !== 'follow-time' && (
                    <button
                      onClick={() => onUpdateConfig({ dateFont: 'follow-time' })}
                      className="text-[10px] text-white/50 hover:text-white underline"
                    >
                      Follow Time Font
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => onUpdateConfig({ dateFont: 'follow-time' })}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      config.dateFont === 'follow-time'
                        ? 'bg-white/20 border-white text-white'
                        : 'bg-black/30 border-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-medium">Follows Time</div>
                    <div className="text-[10px] text-white/40">Default matching</div>
                  </button>
                  {AVAILABLE_FONTS.map((f) => {
                    const isFontLocked = !hasFeature('all_fonts') && !FREE_ALLOWED_FONTS.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          if (isFontLocked) {
                            if (!hasUsedProPreview()) {
                              startProPreview();
                              if (onShowToast) onShowToast('30s Pro Visuals Preview started!');
                              onUpdateConfig({ dateFont: f.id });
                            } else {
                              if (onShowToast) onShowToast(`${f.name} font is exclusive to Astralyr Desktop Pro.`);
                            }
                            return;
                          }
                          onUpdateConfig({ dateFont: f.id });
                        }}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          config.dateFont === f.id
                            ? 'bg-white/20 border-white text-white'
                            : 'bg-black/30 border-white/5 text-white/60 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-medium truncate flex items-center justify-between">
                          <span>{f.name}</span>
                          {isFontLocked && <Lock className="w-2 h-2 text-amber-400 flex-shrink-0" />}
                        </div>
                        <div
                          className="text-[11px] truncate opacity-80"
                          style={{ fontFamily: f.family }}
                        >
                          Thu Nov 12
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Language / Locale */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <div>
                  <div className="font-medium text-white">Date Language (Locale)</div>
                  <div className="text-[11px] text-white/50">Month and weekday localized names</div>
                </div>
                <select
                  value={config.locale}
                  onChange={(e) => onUpdateConfig({ locale: e.target.value })}
                  className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-white text-xs outline-none focus:border-white cursor-pointer"
                >
                  {AVAILABLE_LOCALES.map((loc) => (
                    <option key={loc.code} value={loc.code} className="bg-neutral-900 text-white">
                      {loc.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* TAB 4: LYRICS CONSTELLATION */}
          {activeTab === 'lyrics' && (
            <div className="space-y-4">
              {/* Lyrics Font */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="font-medium text-white">Lyrics Font</div>
                <div className="grid grid-cols-3 gap-2">
                  {AVAILABLE_FONTS.map((f) => {
                    const isFontLocked = !hasFeature('all_fonts') && !FREE_ALLOWED_FONTS.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          if (isFontLocked) {
                            if (!hasUsedProPreview()) {
                              startProPreview();
                              if (onShowToast) onShowToast('30s Pro Visuals Preview started!');
                              onUpdateConfig({ lyricsFont: f.id });
                            } else {
                              if (onShowToast) onShowToast(`${f.name} font is exclusive to Astralyr Desktop Pro.`);
                            }
                            return;
                          }
                          onUpdateConfig({ lyricsFont: f.id });
                        }}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          config.lyricsFont === f.id
                            ? 'bg-white/20 border-white text-white'
                            : 'bg-black/30 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="text-xs font-semibold truncate flex items-center justify-between">
                          <span>{f.name}</span>
                          {isFontLocked && <Lock className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />}
                        </div>
                        <div
                          className="text-xs mt-1 truncate opacity-85"
                          style={{ fontFamily: f.family }}
                        >
                          constellation
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Word Weight */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <div>
                  <div className="font-medium text-white">Active Word Weight</div>
                  <div className="text-[11px] text-white/50">Hero word emphasis</div>
                </div>
                <div className="flex space-x-1">
                  {[
                    { label: 'Light', val: 300 },
                    { label: 'Regular', val: 400 },
                    { label: 'Bold', val: 700 },
                  ].map((w) => (
                    <button
                      key={w.val}
                      onClick={() => onUpdateConfig({ lyricsActiveWeight: w.val })}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        config.lyricsActiveWeight === w.val
                          ? 'bg-white text-black font-bold shadow'
                          : 'bg-black/40 text-white/60 hover:text-white'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-white">Active Word Size</span>
                    <span className="font-mono text-white/80">{config.lyricsActiveSize} px</span>
                  </div>
                  <input
                    type="range"
                    min="24"
                    max="64"
                    step="1"
                    value={config.lyricsActiveSize}
                    onChange={(e) => onUpdateConfig({ lyricsActiveSize: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                </div>

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-white">Past Words Size</span>
                    <span className="font-mono text-white/80">{config.lyricsPastSize} px</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="22"
                    step="1"
                    value={config.lyricsPastSize}
                    onChange={(e) => onUpdateConfig({ lyricsPastSize: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                </div>
              </div>

              {/* Active-Word Case */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <div>
                  <div className="font-medium text-white">Word Capitalization</div>
                  <div className="text-[11px] text-white/50">Lyrics text transformation</div>
                </div>
                <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/10">
                  {[
                    { id: 'original', label: 'As Written' },
                    { id: 'lowercase', label: 'lowercase' },
                    { id: 'uppercase', label: 'UPPERCASE' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onUpdateConfig({ lyricsCase: c.id as WordCase })}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        config.lyricsCase === c.id
                          ? 'bg-white text-black shadow'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles: Sparkle Star Nodes & Connecting Lines */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">Sparkle Stars (✦)</div>
                    <div className="text-[10px] text-white/50">Word sparkle nodes</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.showStars}
                    onChange={(e) => onUpdateConfig({ showStars: e.target.checked })}
                    className="w-4 h-4 rounded accent-white cursor-pointer"
                  />
                </div>

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">Connecting Lines</div>
                    <div className="text-[10px] text-white/50">Constellation web</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.showConnectingLines}
                    onChange={(e) => onUpdateConfig({ showConnectingLines: e.target.checked })}
                    className="w-4 h-4 rounded accent-white cursor-pointer"
                  />
                </div>

                {/* Tint lyrics with accent color */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between col-span-2">
                  <div>
                    <div className="font-medium text-white">Tint lyrics with accent color</div>
                    <div className="text-[10px] text-white/50">Active ring/glow, stars & lines take accent; past words at 50% opacity</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.tintLyricsWithAccent !== false}
                    onChange={(e) => onUpdateConfig({ tintLyricsWithAccent: e.target.checked })}
                    className="w-4 h-4 rounded accent-white cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: AMBIENT LIGHT */}
          {activeTab === 'ambient' && (
            <div className="space-y-4">
              {/* Light Style Selector (Sliding light / Static rim / Beat pulse) */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">Light Style</div>
                    <div className="text-[11px] text-white/50">Ambient light trajectory around window edges</div>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/10 text-white">
                    {config.ambientLightStyle || 'sliding'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'sliding', label: 'Sliding Light', desc: 'Comet body travels around perimeter' },
                    { id: 'static-rim', label: 'Static Rim', desc: 'Gentle static window rim glow' },
                    { id: 'beat-pulse', label: 'Beat Pulse', desc: 'Breathing rim pulsing on kicks' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onUpdateConfig({ ambientLightStyle: s.id as any })}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        (config.ambientLightStyle || 'sliding') === s.id
                          ? 'bg-white/20 border-white text-white shadow-sm'
                          : 'bg-black/30 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="text-xs font-semibold">{s.label}</div>
                      <div className="text-[10px] text-white/40 mt-0.5 leading-snug">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliding Light Settings (Shown when Sliding Light is active) */}
              {(config.ambientLightStyle === 'sliding' || !config.ambientLightStyle) && (
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="font-medium text-white text-xs uppercase tracking-wider text-white/60">Sliding Motion Controls</div>
                  
                  {/* Number of Lights (1 vs 2) */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-white">Number of Lights</div>
                      <div className="text-[10px] text-white/50">Single comet or dual opposing comets (180° offset)</div>
                    </div>
                    <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/10">
                      {[1, 2].map((cnt) => (
                        <button
                          key={cnt}
                          onClick={() => onUpdateConfig({ ambientLightCount: cnt as 1 | 2 })}
                          className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                            (config.ambientLightCount || 1) === cnt
                              ? 'bg-white text-black shadow-sm'
                              : 'text-white/60 hover:text-white'
                          }`}
                        >
                          {cnt === 1 ? '1 Light' : '2 Lights'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Direction Selector */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-white">Direction</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'clockwise', label: 'Clockwise' },
                        { id: 'counter-clockwise', label: 'Counter-CW' },
                        { id: 'alternating', label: 'Alternating' },
                      ].map((d) => (
                        <button
                          key={d.id}
                          onClick={() => onUpdateConfig({ ambientLightDirection: d.id as any })}
                          className={`py-1.5 px-2 rounded-lg border text-center text-xs font-medium transition-all ${
                            (config.ambientLightDirection || 'clockwise') === d.id
                              ? 'bg-white/20 border-white text-white'
                              : 'bg-black/30 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Length Slider (20% - 45%) */}
                  <DebouncedSlider
                    label="Comet Body Length"
                    value={config.ambientLightLength ?? 0.30}
                    min={0.20}
                    max={0.45}
                    step={0.01}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onChange={(val) => onUpdateConfig({ ambientLightLength: val })}
                    description="Fraction of perimeter covered by the light body (25–35% default)"
                  />

                  {/* Speed Slider (0.5x - 2.5x) */}
                  <DebouncedSlider
                    label="Lap Speed"
                    value={config.ambientMotionSpeed ?? 1.0}
                    min={0.5}
                    max={2.5}
                    step={0.05}
                    formatValue={(v) => `${v.toFixed(2)}x (~${(8 / v).toFixed(1)}s/lap)`}
                    onChange={(val) => onUpdateConfig({ ambientMotionSpeed: val })}
                    description="Lap time around window perimeter (~8s at 1.0x)"
                  />
                </div>
              )}

              {/* General Appearance Sliders */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="font-medium text-white text-xs uppercase tracking-wider text-white/60">Glow & Intensity</div>

                {/* Intensity Slider (0.2x - 2.0x) */}
                <DebouncedSlider
                  label="Intensity"
                  value={config.ambientIntensity ?? 1.0}
                  min={0.2}
                  max={2.0}
                  step={0.05}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                  onChange={(val) => onUpdateConfig({ ambientIntensity: val })}
                  description="Brightness level of the ambient glow"
                />

                {/* Glow Size Slider (0.5x - 2.0x) */}
                <DebouncedSlider
                  label="Glow Size"
                  value={config.ambientLightGlowSize ?? 1.0}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  formatValue={(v) => `${v.toFixed(2)}x`}
                  onChange={(val) => onUpdateConfig({ ambientLightGlowSize: val })}
                  description="Inward radial reach into the window"
                />
              </div>

              {/* Beat Synchronization Controls */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">Beat Synchronization</div>
                    <div className="text-[11px] text-white/50">Surge light brightness (+30%) on bass kicks</div>
                  </div>
                  <button
                    onClick={() => onUpdateConfig({ ambientBeatSync: !(config.ambientBeatSync ?? true) })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      (config.ambientBeatSync ?? true) ? 'bg-white' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform ${
                        (config.ambientBeatSync ?? true) ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {(config.ambientBeatSync ?? true) && (
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    {/* Beat Reaction */}
                    <DebouncedSlider
                      label="Beat Reaction Multiplier"
                      value={config.ambientBeatReaction ?? 1.0}
                      min={0.0}
                      max={2.0}
                      step={0.05}
                      formatValue={(v) => `${v.toFixed(2)}x`}
                      onChange={(val) => onUpdateConfig({ ambientBeatReaction: val })}
                    />

                    {/* Beat Sensitivity */}
                    <DebouncedSlider
                      label="Beat Sensitivity"
                      value={config.ambientBeatSensitivity ?? 65}
                      min={0}
                      max={100}
                      step={1}
                      formatValue={(v) => `${Math.round(v)}`}
                      onChange={(val) => onUpdateConfig({ ambientBeatSensitivity: val })}
                    />
                  </div>
                )}
              </div>

              {/* Motion Dynamics Preset (off/calm/beat/party) */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">Motion Dynamics Preset</div>
                    <div className="text-[11px] text-white/50">Presets for ambient movement behavior</div>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/10 text-white">
                    {config.ambientMotionMode}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(['off', 'calm', 'beat', 'party'] as const).map((m) => {
                    const isModeLocked = (m === 'beat' || m === 'party') && !hasFeature('moving_ambient_light');
                    return (
                      <button
                        key={m}
                        onClick={() => {
                          if (isModeLocked) {
                            if (!hasUsedProPreview()) {
                              startProPreview();
                              if (onShowToast) onShowToast('30s Pro Visuals Preview started!');
                              onUpdateConfig({ ambientMotionMode: m });
                            } else {
                              if (onShowToast) onShowToast(`${m} motion is exclusive to Astralyr Desktop Pro.`);
                            }
                            return;
                          }
                          onUpdateConfig({ ambientMotionMode: m });
                        }}
                        className={`py-2 px-2 rounded-lg border text-center font-medium capitalize text-xs transition-all ${
                          config.ambientMotionMode === m
                            ? 'bg-white/20 border-white text-white shadow-sm'
                            : 'bg-black/30 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span className="flex items-center justify-center space-x-1">
                          <span>{m}</span>
                          {isModeLocked && <Lock className="w-2.5 h-2.5 text-amber-400" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Keyboard shortcuts tip */}
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-[11px] text-white/60">
                <span>Toggle Beat Engine HUD (BPM, phase & bands):</span>
                <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-mono font-bold text-[10px]">D</kbd>
              </div>
            </div>
          )}

          {/* TAB: BACKGROUND THEMES */}
          {activeTab === 'background' && (
            <BackgroundTabContent
              config={config}
              onUpdateConfig={onUpdateConfig}
              onShowToast={onShowToast}
            />
          )}

          {/* TAB: VISUAL EFFECTS & PERFORMANCE */}
          {activeTab === 'effects' && (
            <div className="space-y-4">
              {/* SECTION: LYRIC TINTING */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Tint lyrics with accent color</div>
                  <div className="text-[11px] text-white/50">
                    Active ring/glow, stars & lines take accent; past words at 50% opacity
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.tintLyricsWithAccent !== false}
                  onChange={(e) => onUpdateConfig({ tintLyricsWithAccent: e.target.checked })}
                  className="w-4 h-4 rounded accent-white cursor-pointer"
                />
              </div>

              {/* SECTION 3: ADAPTIVE QUALITY & PERFORMANCE */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">Visual Quality Tier</div>
                    <div className="text-[11px] text-white/50">
                      Adaptive frame pacing & rendering optimizations
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {[
                    { id: 'auto', label: 'Auto' },
                    { id: 'high', label: 'High' },
                    { id: 'medium', label: 'Med' },
                    { id: 'low', label: 'Low' },
                    { id: 'minimal', label: 'Minimal' },
                  ].map((q) => (
                    <button
                      key={q.id}
                      onClick={() => onUpdateConfig({ visualQuality: q.id as VisualQuality })}
                      className={`py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        (config.visualQuality || 'auto') === q.id
                          ? 'bg-white text-black border-white shadow'
                          : 'bg-black/30 border-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>

                <div className="text-[10px] text-white/40 leading-relaxed pt-1 border-t border-white/5">
                  {(config.visualQuality || 'auto') === 'auto' &&
                    'Auto: Monitors 120-frame rolling average. Drops tier if frame times exceed 20ms for 3s; upgrades after 15s below 10ms.'}
                  {config.visualQuality === 'high' &&
                    'High: Full 60fps, dynamic sliding light, multi-sprite glow, fluid themes.'}
                  {config.visualQuality === 'medium' &&
                    'Medium: 0.5x resolution, smooth sliding light, optimized performance.'}
                  {config.visualQuality === 'low' &&
                    'Low: Static rim, 1 light, minimal effects.'}
                  {config.visualQuality === 'minimal' &&
                    'Minimal: Static rim only, motion disabled for maximum battery life.'}
                </div>

                <div className="text-[10px] text-emerald-400/80 pt-1 flex items-center justify-between">
                  <span>Press key <kbd className="px-1 py-0.5 rounded bg-white/10 text-white font-mono">F</kbd> for live FPS meter</span>
                  <span>Press key <kbd className="px-1 py-0.5 rounded bg-white/10 text-white font-mono">D</kbd> for Beat Debug HUD</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LIBRARY MANAGEMENT */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-white/70">
                <FolderArchive className="w-4 h-4 text-white" />
                <span className="font-medium text-xs text-white">Local Library Storage & Backup</span>
              </div>

              {!window.electronAPI?.library ? (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 text-white/70">
                  <div className="font-semibold text-white">Desktop Library Storage</div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    You are running Astralyr in a web browser. Permanent local filesystem storage and high-performance audio streaming are built into the Astralyr Desktop app for Windows, macOS, and Linux. In the browser, your uploaded songs and playlists are stored in IndexedDB.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Free Disk Space Warning if < 1GB */}
                  {libraryStats && libraryStats.freeSpaceBytes < 1024 * 1024 * 1024 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center space-x-2.5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-xs">Low Disk Space Warning</div>
                        <div className="text-[11px] text-amber-300/80">
                          Drive has less than 1 GB free space remaining ({(libraryStats.freeSpaceBytes / (1024 * 1024)).toFixed(0)} MB left).
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Feedback Message */}
                  {libraryMessage && (
                    <div
                      className={`p-3 rounded-xl text-[11px] flex items-center space-x-2 ${
                        libraryMessage.error
                          ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {libraryMessage.error ? (
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      ) : (
                        <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span>{libraryMessage.text}</span>
                    </div>
                  )}

                  {/* Library Folder Path & Open Button */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-white flex items-center space-x-1.5">
                        <FolderOpen className="w-3.5 h-3.5 text-white/70" />
                        <span>Library Directory</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.electronAPI?.library?.openFolder) {
                            await window.electronAPI.library.openFolder();
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-[11px] transition-colors border border-white/10 flex items-center space-x-1"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>Open folder</span>
                      </button>
                    </div>
                    <div className="font-mono text-[10px] text-white/50 bg-black/40 p-2 rounded-lg break-all border border-white/5">
                      {libraryStats?.libraryDir || 'Loading path...'}
                    </div>
                  </div>

                  {/* Storage Stats Grid */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                      <div className="text-[10px] text-white/50 mb-0.5">Stored Songs</div>
                      <div className="text-base font-bold text-white">
                        {libraryStats ? libraryStats.trackCount : '—'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                      <div className="text-[10px] text-white/50 mb-0.5">Library Size</div>
                      <div className="text-base font-bold text-white">
                        {libraryStats ? `${(libraryStats.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB` : '—'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                      <div className="text-[10px] text-white/50 mb-0.5">Drive Free Space</div>
                      <div className="text-base font-bold text-white">
                        {libraryStats ? `${(libraryStats.freeSpaceBytes / (1024 * 1024 * 1024)).toFixed(1)} GB` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Cleanup Unreferenced Files */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white flex items-center space-x-1.5">
                        <Trash2 className="w-3.5 h-3.5 text-white/70" />
                        <span>Remove Unused Files</span>
                      </div>
                      <div className="text-[11px] text-white/50">
                        Scan library and safely delete unreferenced audio and artwork files.
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isCleaning}
                      onClick={async () => {
                        setIsCleaning(true);
                        setLibraryMessage(null);
                        try {
                          const activeIds = await playlistDb.getAllTrackIds();
                          const res = await window.electronAPI!.library!.cleanupUnused(activeIds);
                          setLibraryMessage({
                            text: `Cleaned up: deleted ${res.deletedAudio} unused audio file(s) and ${res.deletedArt} artwork file(s) (${(res.freedBytes / (1024 * 1024)).toFixed(1)} MB freed).`,
                          });
                          await loadLibraryStats();
                        } catch (err: any) {
                          setLibraryMessage({ text: err.message || 'Cleanup failed', error: true });
                        } finally {
                          setIsCleaning(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 font-medium text-xs transition-colors flex items-center space-x-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{isCleaning ? 'Cleaning...' : 'Clean unused'}</span>
                    </button>
                  </div>

                  {/* Backup & Restore */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="font-medium text-white flex items-center space-x-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-white/70" />
                      <span>Backup & Restore Library</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setLibraryMessage(null);
                          try {
                            const res = await window.electronAPI!.library!.exportBackup();
                            if (res.success) {
                              setLibraryMessage({
                                text: `Library backup exported successfully!`,
                              });
                              if (onShowToast) onShowToast('Library backup exported successfully');
                            }
                          } catch (err: any) {
                            setLibraryMessage({ text: err.message || 'Export failed', error: true });
                          }
                        }}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white font-medium text-xs transition-colors flex items-center justify-center space-x-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Library Backup</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setLibraryMessage(null);
                          try {
                            const res = await window.electronAPI!.library!.importBackup();
                            if (res.success) {
                              setLibraryMessage({
                                text: `Imported ${res.importedCount} track(s) from backup!`,
                              });
                              await loadLibraryStats();
                              if (onShowToast) onShowToast(`Imported ${res.importedCount} tracks from backup`);
                            }
                          } catch (err: any) {
                            setLibraryMessage({ text: err.message || 'Import failed', error: true });
                          }
                        }}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white font-medium text-xs transition-colors flex items-center justify-center space-x-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Import Backup</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-white/[0.01] flex items-center justify-between text-[11px] text-white/40">
          <span>All options save live to localStorage with no reload</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white text-black font-semibold hover:bg-white/90 transition-colors shadow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
