import React, { useState, useEffect } from 'react';
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
  GRADIENT_PRESETS,
  SOLID_SWATCHES,
  BackgroundMode,
  GradientType,
  RippleStyle,
  RippleColor,
  VisualQuality,
} from '../services/appearanceConfig';
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
} from 'lucide-react';
import { playlistDb } from '../services/playlistDb';

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppearanceConfig;
  onUpdateConfig: (updated: Partial<AppearanceConfig>) => void;
  onResetDefault: () => void;
  initialTab?: 'presets' | 'time' | 'date' | 'lyrics' | 'ambient' | 'background' | 'effects' | 'library';
  onShowToast?: (message: string) => void;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none animate-in fade-in duration-200">
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
                {APPEARANCE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onUpdateConfig(p.config)}
                    className="p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/25 text-left transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="font-semibold text-white text-sm mb-1 group-hover:text-white transition-colors">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-white/50 leading-relaxed">
                        {p.description}
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-white/40 font-mono">
                      Click to apply
                    </div>
                  </button>
                ))}
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
                  {AVAILABLE_FONTS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onUpdateConfig({ timeFont: f.id })}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        config.timeFont === f.id
                          ? 'bg-white/20 border-white text-white'
                          : 'bg-black/30 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">{f.name}</div>
                      <div
                        className="text-sm mt-1 truncate opacity-90"
                        style={{ fontFamily: f.family }}
                      >
                        12:45
                      </div>
                    </button>
                  ))}
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
                  {AVAILABLE_FONTS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onUpdateConfig({ dateFont: f.id })}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        config.dateFont === f.id
                          ? 'bg-white/20 border-white text-white'
                          : 'bg-black/30 border-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-medium truncate">{f.name}</div>
                      <div
                        className="text-[11px] truncate opacity-80"
                        style={{ fontFamily: f.family }}
                      >
                        Thu Nov 12
                      </div>
                    </button>
                  ))}
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
                  {AVAILABLE_FONTS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onUpdateConfig({ lyricsFont: f.id })}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        config.lyricsFont === f.id
                          ? 'bg-white/20 border-white text-white'
                          : 'bg-black/30 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">{f.name}</div>
                      <div
                        className="text-xs mt-1 truncate opacity-85"
                        style={{ fontFamily: f.family }}
                      >
                        constellation
                      </div>
                    </button>
                  ))}
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
              {/* Motion Mode */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">Motion Mode</div>
                    <div className="text-[11px] text-white/50">Beat synchronization and perimeter comet travel</div>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/10 text-white">
                    {config.ambientMotionMode}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(['off', 'calm', 'beat', 'party'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => onUpdateConfig({ ambientMotionMode: m })}
                      className={`py-2 px-2 rounded-lg border text-center font-medium capitalize text-xs transition-all ${
                        config.ambientMotionMode === m
                          ? 'bg-white/20 border-white text-white shadow-sm'
                          : 'bg-black/30 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style: Rim + Bloom / Soft bloom only / Rim only */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                <div className="font-medium text-white">Light Style</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'rim-bloom', label: 'Rim + Bloom', desc: 'Neon rim + inner bloom' },
                    { id: 'bloom-only', label: 'Soft Bloom Only', desc: 'No thin border line' },
                    { id: 'rim-only', label: 'Rim Only', desc: 'Crisp 2px neon rim' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onUpdateConfig({ ambientStyle: s.id as any })}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        config.ambientStyle === s.id
                          ? 'bg-white/20 border-white text-white'
                          : 'bg-black/30 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="text-xs font-semibold">{s.label}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders Grid */}
              <div className="space-y-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                {/* Intensity */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-white">Intensity</span>
                    <span className="font-mono text-white/70">{Math.round(config.ambientIntensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.05"
                    value={config.ambientIntensity}
                    onChange={(e) => onUpdateConfig({ ambientIntensity: parseFloat(e.target.value) })}
                    className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Motion Speed */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-white">Motion Speed</span>
                    <span className="font-mono text-white/70">{config.ambientMotionSpeed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.05"
                    value={config.ambientMotionSpeed}
                    onChange={(e) => onUpdateConfig({ ambientMotionSpeed: parseFloat(e.target.value) })}
                    className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Beat Reaction */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-white">Beat Reaction</span>
                    <span className="font-mono text-white/70">{config.ambientBeatReaction.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="2.0"
                    step="0.05"
                    value={config.ambientBeatReaction}
                    onChange={(e) => onUpdateConfig({ ambientBeatReaction: parseFloat(e.target.value) })}
                    className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Beat Sensitivity */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-white">Beat Sensitivity</span>
                    <span className="font-mono text-white/70">{Math.round(config.ambientBeatSensitivity)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={config.ambientBeatSensitivity}
                    onChange={(e) => onUpdateConfig({ ambientBeatSensitivity: parseInt(e.target.value, 10) })}
                    className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
                  />
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
            <div className="space-y-4">
              {/* Background Mode Selector */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">Background Mode</div>
                    <div className="text-[11px] text-white/50">Theme style behind lyrics and ambient light</div>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/10 text-white">
                    {config.bgMode}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'solid', label: 'Solid' },
                      { id: 'gradient', label: 'Gradient' },
                      { id: 'album', label: 'Album Color' },
                      { id: 'mesh', label: 'Ambient Mesh' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onUpdateConfig({ bgMode: m.id })}
                      className={`py-2 px-1 rounded-lg border text-center font-medium text-xs transition-all ${
                        config.bgMode === m.id
                          ? 'bg-white/20 border-white text-white shadow-sm'
                          : 'bg-black/30 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* MODE: SOLID */}
              {config.bgMode === 'solid' && (
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="font-medium text-white">Solid Color Swatches</div>
                  <div className="grid grid-cols-3 gap-2">
                    {SOLID_SWATCHES.map((s) => (
                      <button
                        key={s.hex}
                        onClick={() => onUpdateConfig({ bgSolidColor: s.hex })}
                        className={`p-2.5 rounded-lg border flex items-center space-x-2 text-left transition-all ${
                          config.bgSolidColor.toLowerCase() === s.hex.toLowerCase()
                            ? 'bg-white/20 border-white text-white'
                            : 'bg-black/30 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-white/30 flex-shrink-0"
                          style={{ backgroundColor: s.hex }}
                        />
                        <span className="text-[11px] font-medium truncate">{s.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Custom Color Picker */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-white/70">Custom Solid Color</span>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={config.bgSolidColor}
                        onChange={(e) => onUpdateConfig({ bgSolidColor: e.target.value })}
                        className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={config.bgSolidColor}
                        onChange={(e) => onUpdateConfig({ bgSolidColor: e.target.value })}
                        className="w-24 px-2 py-1 rounded bg-black/50 border border-white/20 text-white font-mono text-[11px] outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MODE: GRADIENT */}
              {config.bgMode === 'gradient' && (
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                  {/* Presets */}
                  <div>
                    <div className="font-medium text-white mb-2">Gradient Presets</div>
                    <div className="grid grid-cols-3 gap-2">
                      {GRADIENT_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() =>
                            onUpdateConfig({
                              bgGradientPreset: p.id,
                              bgGradientType: p.type,
                              bgGradientColors: p.colors,
                              bgGradientAngle: p.angle,
                            })
                          }
                          className={`p-2.5 rounded-lg border text-left transition-all relative overflow-hidden ${
                            config.bgGradientPreset === p.id
                              ? 'border-white text-white shadow-md'
                              : 'border-white/10 text-white/70 hover:border-white/30'
                          }`}
                          style={{
                            background: `linear-gradient(${p.angle}deg, ${p.colors.join(', ')})`,
                          }}
                        >
                          <div className="relative z-10 font-bold text-xs drop-shadow">{p.name}</div>
                          <div className="relative z-10 text-[10px] text-white/60">{p.type}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Type: Linear vs Radial */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-white/70">Gradient Type</span>
                    <div className="flex space-x-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
                      {(['linear', 'radial'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => onUpdateConfig({ bgGradientType: t, bgGradientPreset: 'custom' })}
                          className={`px-3 py-1 rounded capitalize font-medium text-xs transition-all ${
                            config.bgGradientType === t
                              ? 'bg-white/20 text-white shadow-sm'
                              : 'text-white/50 hover:text-white'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Angle slider (if linear) */}
                  {config.bgGradientType === 'linear' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/70">Gradient Angle</span>
                        <span className="font-mono text-white/60">{config.bgGradientAngle}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="5"
                        value={config.bgGradientAngle}
                        onChange={(e) =>
                          onUpdateConfig({
                            bgGradientAngle: parseInt(e.target.value, 10),
                            bgGradientPreset: 'custom',
                          })
                        }
                        className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Colors */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="text-[11px] text-white/70">Gradient Colors (2–3 colors)</div>
                    <div className="flex space-x-3">
                      {config.bgGradientColors.map((color, idx) => (
                        <div key={idx} className="flex items-center space-x-1.5 bg-black/40 p-1.5 rounded-lg border border-white/10">
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => {
                              const newCols = [...config.bgGradientColors];
                              newCols[idx] = e.target.value;
                              onUpdateConfig({ bgGradientColors: newCols, bgGradientPreset: 'custom' });
                            }}
                            className="w-6 h-6 rounded border border-white/20 bg-transparent cursor-pointer"
                          />
                          <span className="font-mono text-[10px] text-white/70">{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MODE: ALBUM COLOR */}
              {config.bgMode === 'album' && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                  <div className="font-semibold text-white">Album Artwork Tinting</div>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Astralyr extracts the dominant and secondary colors from the current song's artwork (downscaled to 64×64 and cached).
                    Colors are automatically clamped to ≤ 22% lightness to preserve high-contrast readability for lyrics and the clock.
                  </p>
                  <div className="text-[10px] text-white/40 italic">
                    If a song has no artwork, your chosen accent color is used as a fallback.
                  </div>
                </div>
              )}

              {/* MODE: AMBIENT MESH */}
              {config.bgMode === 'mesh' && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                  <div className="font-semibold text-white">Ambient Mesh Blobs</div>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    3–4 soft, large organic blurred blobs drift slowly behind the UI, gently swelling on each bass beat without rapid flashing.
                  </p>
                  <div className="text-[10px] text-white/40">
                    Runs at capped resolution and 800ms crossfade transitions.
                  </div>
                </div>
              )}

              {/* INTENSITY SLIDER */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-white">Background Intensity</span>
                  <span className="font-mono text-white/70">{Math.round(config.bgIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={config.bgIntensity}
                  onChange={(e) => onUpdateConfig({ bgIntensity: parseFloat(e.target.value) })}
                  className="w-full accent-white h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="text-[10px] text-white/40 pt-1">
                  Base lightness is capped at 22% for perfect readability. Crossfades smoothly over 800ms.
                </div>
              </div>
            </div>
          )}

          {/* TAB: VISUAL EFFECTS & PERFORMANCE */}
          {activeTab === 'effects' && (
            <div className="space-y-4">
              {/* SECTION 1: WORD RIPPLE */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">Word Ripple Effect</div>
                    <div className="text-[11px] text-white/50">
                      Concentric rings & soft pulse expanding from active word star
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.rippleEnabled !== false}
                    onChange={(e) => onUpdateConfig({ rippleEnabled: e.target.checked })}
                    className="w-4 h-4 rounded accent-white cursor-pointer"
                  />
                </div>

                {config.rippleEnabled !== false && (
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    {/* Ripple Style */}
                    <div className="flex items-center justify-between">
                      <span className="text-white/80">Ripple Style</span>
                      <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/10">
                        {[
                          { id: 'rings', label: 'Rings' },
                          { id: 'pulse-only', label: 'Pulse only' },
                          { id: 'rings-pulse', label: 'Rings + Pulse' },
                        ].map((st) => (
                          <button
                            key={st.id}
                            onClick={() => onUpdateConfig({ rippleStyle: st.id as RippleStyle })}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                              config.rippleStyle === st.id
                                ? 'bg-white text-black shadow'
                                : 'text-white/60 hover:text-white'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ripple Color */}
                    <div className="flex items-center justify-between">
                      <span className="text-white/80">Ripple Color</span>
                      <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/10">
                        {[
                          { id: 'accent', label: 'Accent Color' },
                          { id: 'white', label: 'Pure White' },
                        ].map((c) => (
                          <button
                            key={c.id}
                            onClick={() => onUpdateConfig({ rippleColor: c.id as RippleColor })}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                              config.rippleColor === c.id
                                ? 'bg-white text-black shadow'
                                : 'text-white/60 hover:text-white'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ripple Size */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-white/70">Ripple Size</span>
                        <span className="font-mono text-white/90">{config.rippleSize.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={config.rippleSize}
                        onChange={(e) => onUpdateConfig({ rippleSize: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>

                    {/* Ripple Speed */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-white/70">Ripple Speed</span>
                        <span className="font-mono text-white/90">{config.rippleSpeed.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={config.rippleSpeed}
                        onChange={(e) => onUpdateConfig({ rippleSpeed: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>

                    {/* Subtle Shimmer */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <div className="text-white/90 font-medium text-xs">Subtle Shimmer</div>
                        <div className="text-[10px] text-white/40">Faint sparkle dust along expanding ring</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(config.rippleShimmer)}
                        onChange={(e) => onUpdateConfig({ rippleShimmer: e.target.checked })}
                        className="w-4 h-4 rounded accent-white cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: LYRIC TINTING */}
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
                    'High: Full 60fps, 3 comets, 4 drifting blobs, 3 ripple rings, dynamic mesh.'}
                  {config.visualQuality === 'medium' &&
                    'Medium: 0.5x resolution, 2 comets, 2 blobs, 2 ripple rings, 30fps mesh.'}
                  {config.visualQuality === 'low' &&
                    'Low: Static background, 1 comet, 1 ripple ring.'}
                  {config.visualQuality === 'minimal' &&
                    'Minimal: Static rim only, ripples & comets disabled for max battery life.'}
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
