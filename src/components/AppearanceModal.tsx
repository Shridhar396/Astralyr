import React, { useState } from 'react';
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
} from '../services/appearanceConfig';
import { Sliders, X, RotateCcw, Clock, Calendar, Sparkles, Wand2 } from 'lucide-react';

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppearanceConfig;
  onUpdateConfig: (updated: Partial<AppearanceConfig>) => void;
  onResetDefault: () => void;
}

export const AppearanceModal: React.FC<AppearanceModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onResetDefault,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'time' | 'date' | 'lyrics'>('presets');

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
              </div>
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
