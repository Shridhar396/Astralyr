import React from 'react';
import { X, Sliders, Palette, Activity, Sparkles } from 'lucide-react';
import { VisualizerSettings, VisualizerMode } from '../types/visualizer';
import { PRESET_PALETTES } from '../constants/palettes';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VisualizerSettings;
  onUpdateSettings: (newSettings: Partial<VisualizerSettings>) => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  const visualizerModes: { id: VisualizerMode; label: string; desc: string }[] = [
    {
      id: 'ambient-waveform',
      label: 'Fluid Waveform',
      desc: 'Smooth continuous flowing audio waveform with reflection',
    },
    {
      id: 'cyberpunk-bars',
      label: '64 Neon Bars',
      desc: 'Cyberpunk neon frequency columns with floating peak caps',
    },
    {
      id: 'circular-halo',
      label: 'Circular Halo',
      desc: 'Radial audio-reactive ring with core bass pulse',
    },
    {
      id: 'neon-grid',
      label: 'Retro Synthwave Grid',
      desc: '3D perspective horizon terrain moving to music rhythm',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-white/10 shadow-2xl relative max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center space-x-2.5">
            <Sliders className="w-5 h-5 text-purple-400" />
            <h3 className="font-mono font-bold text-lg text-white">Visualizer & Glow Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg glass-pill text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="overflow-y-auto my-4 space-y-6 pr-2 flex-1 font-mono text-xs">
          {/* Visualizer Mode Selection */}
          <div>
            <div className="flex items-center space-x-2 mb-2.5 text-slate-300 font-bold uppercase tracking-wider">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Canvas Visualizer Mode (60 FPS)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {visualizerModes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onUpdateSettings({ mode: m.id })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    settings.mode === m.id
                      ? 'border-cyan-400 bg-cyan-500/10 text-white'
                      : 'border-white/5 bg-white/[0.03] text-slate-400 hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="font-bold text-sm text-white">{m.label}</div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-tight">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Ambient Glow Settings */}
          <div>
            <div className="flex items-center space-x-2 mb-3 text-slate-300 font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>Beat-Reactive Ambient Glow</span>
            </div>

            <div className="space-y-4 bg-black/30 p-4 rounded-xl border border-white/5">
              {/* Border Thickness */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Border Thickness:</span>
                  <span className="text-white font-bold">{settings.borderThickness} px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="32"
                  step="1"
                  value={settings.borderThickness}
                  onChange={(e) =>
                    onUpdateSettings({ borderThickness: parseInt(e.target.value) })
                  }
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-400"
                />
              </div>

              {/* Glow Spread */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Glow Spread / Blur:</span>
                  <span className="text-white font-bold">{settings.glowSpread} px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="2"
                  value={settings.glowSpread}
                  onChange={(e) =>
                    onUpdateSettings({ glowSpread: parseInt(e.target.value) })
                  }
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-400"
                />
              </div>

              {/* Beat Reactivity Sensitivity */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Beat Pulse Reactivity:</span>
                  <span className="text-white font-bold">{settings.beatSensitivity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="2.2"
                  step="0.05"
                  value={settings.beatSensitivity}
                  onChange={(e) =>
                    onUpdateSettings({ beatSensitivity: parseFloat(e.target.value) })
                  }
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-400"
                />
              </div>

              {/* Beat Pulse Multiplier */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Glow Expansion on Beat:</span>
                  <span className="text-white font-bold">{settings.beatGlowMultiplier.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="1.1"
                  max="2.5"
                  step="0.1"
                  value={settings.beatGlowMultiplier}
                  onChange={(e) =>
                    onUpdateSettings({ beatGlowMultiplier: parseFloat(e.target.value) })
                  }
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-400"
                />
              </div>
            </div>
          </div>

          {/* Color Palettes */}
          <div>
            <div className="flex items-center space-x-2 mb-2.5 text-slate-300 font-bold uppercase tracking-wider">
              <Palette className="w-4 h-4 text-amber-400" />
              <span>Color Gradient Theme</span>
            </div>

            {/* Sync with Station toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 mb-3">
              <span>Auto-shift colors on station change</span>
              <input
                type="checkbox"
                checked={settings.colorSyncWithStation}
                onChange={(e) => onUpdateSettings({ colorSyncWithStation: e.target.checked })}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Preset Palettes */}
            <div className="grid grid-cols-3 gap-2">
              {PRESET_PALETTES.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    onUpdateSettings({
                      colorSyncWithStation: false,
                      customPrimaryColor: p.primary,
                      customSecondaryColor: p.secondary,
                    })
                  }
                  className="p-2.5 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.08] flex items-center space-x-2 text-left"
                >
                  <div className="flex -space-x-1.5 flex-shrink-0">
                    <span
                      className="w-4 h-4 rounded-full border border-black/40"
                      style={{ backgroundColor: p.primary }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-black/40"
                      style={{ backgroundColor: p.secondary }}
                    />
                  </div>
                  <span className="text-[11px] text-white truncate">{p.name}</span>
                </button>
              ))}
            </div>

            {/* Custom Color Pickers */}
            <div className="flex items-center gap-4 mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="flex items-center space-x-2">
                <span>Primary:</span>
                <input
                  type="color"
                  value={settings.customPrimaryColor}
                  onChange={(e) =>
                    onUpdateSettings({
                      colorSyncWithStation: false,
                      customPrimaryColor: e.target.value,
                    })
                  }
                  className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
                />
              </div>

              <div className="flex items-center space-x-2">
                <span>Secondary:</span>
                <input
                  type="color"
                  value={settings.customSecondaryColor}
                  onChange={(e) =>
                    onUpdateSettings({
                      colorSyncWithStation: false,
                      customSecondaryColor: e.target.value,
                    })
                  }
                  className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Ambient Particles */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div>
              <div className="font-bold text-white">Ambient Floating Particles</div>
              <div className="text-[10px] text-slate-400">Flowing micro-stardust reacting to bass energy</div>
            </div>
            <input
              type="checkbox"
              checked={settings.showParticles}
              onChange={(e) => onUpdateSettings({ showParticles: e.target.checked })}
              className="w-4 h-4 accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

