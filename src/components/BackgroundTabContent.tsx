import React, { useState, useRef, useEffect } from 'react';
import {
  AppearanceConfig,
  BackgroundMode,
  GradientPreset,
  GRADIENT_PRESETS,
  SOLID_SWATCHES,
  CustomGradientConfig,
  CustomGradientStop,
  WallpaperConfig,
  clampColorForBackground,
} from '../services/appearanceConfig';
import {
  Palette,
  Sparkles,
  Sliders,
  Image as ImageIcon,
  RotateCcw,
  Plus,
  Trash2,
  Shuffle,
  ArrowLeftRight,
  Upload,
  AlertTriangle,
  Download,
  FileCode,
  Lock,
} from 'lucide-react';
import { hasFeature, startProPreview, hasUsedProPreview } from '../features';

interface BackgroundTabContentProps {
  config: AppearanceConfig;
  onUpdateConfig: (updated: Partial<AppearanceConfig>) => void;
  onShowToast?: (message: string) => void;
}

const CATEGORIES = ['All', 'Dark', 'Neon', 'Sunset', 'Ocean', 'Aurora', 'Pastel', 'Mono'] as const;

export const BackgroundTabContent: React.FC<BackgroundTabContentProps> = ({
  config,
  onUpdateConfig,
  onShowToast,
}) => {
  const [subTab, setSubTab] = useState<'solid' | 'gradient' | 'custom' | 'wallpaper'>(
    config.bgMode === 'gradient'
      ? 'gradient'
      : config.bgMode === 'custom'
      ? 'custom'
      : config.bgMode === 'wallpaper' || config.bgMode === 'album'
      ? 'wallpaper'
      : 'solid'
  );

  useEffect(() => {
    if (config.bgMode === 'gradient') setSubTab('gradient');
    else if (config.bgMode === 'custom') setSubTab('custom');
    else if (config.bgMode === 'wallpaper' || config.bgMode === 'album') setSubTab('wallpaper');
    else if (config.bgMode === 'solid') setSubTab('solid');
  }, [config.bgMode]);

  const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[number]>('All');
  const [selectedStopIdx, setSelectedStopIdx] = useState<number>(0);
  const [cssImportInput, setCssImportInput] = useState<string>('');
  const [showCssImport, setShowCssImport] = useState<boolean>(false);
  const [savedCustomPresets, setSavedCustomPresets] = useState<Array<{ name: string; config: CustomGradientConfig }>>(() => {
    try {
      const saved = localStorage.getItem('astralyr_my_gradients');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Readability calculation
  const isReadabilityWarning = (() => {
    if (config.bgMode === 'solid') {
      const hex = config.bgSolidColor || '#000000';
      const clean = hex.replace('#', '');
      const r = (parseInt(clean.substring(0, 2), 16) || 0) / 255;
      const g = (parseInt(clean.substring(2, 4), 16) || 0) / 255;
      const b = (parseInt(clean.substring(4, 6), 16) || 0) / 255;
      return (0.299 * r + 0.587 * g + 0.114 * b) * (config.bgIntensity || 1.0) > 0.38;
    }
    if (config.bgMode === 'wallpaper' && config.wallpaper) {
      return (1.0 - (config.wallpaper.dim || 40) / 100) > 0.75;
    }
    return false;
  })();

  // Render Live Preview Thumbnail onto Canvas
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (config.bgMode === 'solid') {
      ctx.fillStyle = config.bgSolidColor || '#000000';
      ctx.fillRect(0, 0, w, h);
    } else if (config.bgMode === 'gradient') {
      const cols = config.bgGradientColors || ['#090a0f', '#181b26'];
      const angle = (config.bgGradientAngle || 135) * (Math.PI / 180);
      const x1 = w / 2 - (Math.cos(angle) * w) / 2;
      const y1 = h / 2 - (Math.sin(angle) * h) / 2;
      const x2 = w / 2 + (Math.cos(angle) * w) / 2;
      const y2 = h / 2 + (Math.sin(angle) * h) / 2;

      let grad: CanvasGradient;
      if (config.bgGradientType === 'radial') {
        grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
      } else {
        grad = ctx.createLinearGradient(x1, y1, x2, y2);
      }
      cols.forEach((c, idx) => {
        grad.addColorStop(idx / Math.max(1, cols.length - 1), c);
      });
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (config.bgMode === 'custom' && config.customGradient) {
      const cg = config.customGradient;
      const sorted = [...cg.stops].sort((a, b) => a.position - b.position);
      const angle = (cg.angle || 135) * (Math.PI / 180);
      const grad = ctx.createLinearGradient(
        w / 2 - (Math.cos(angle) * w) / 2,
        h / 2 - (Math.sin(angle) * h) / 2,
        w / 2 + (Math.cos(angle) * w) / 2,
        h / 2 + (Math.sin(angle) * h) / 2
      );
      sorted.forEach((st) => grad.addColorStop(st.position, st.color));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (config.wallpaper?.url) {
      ctx.fillStyle = '#10121a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Wallpaper Active', w / 2, h / 2 + 3);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
    }
  }, [config.bgMode, config.bgSolidColor, config.bgGradientColors, config.bgGradientAngle, config.bgGradientType, config.customGradient, config.wallpaper?.url]);

  // Handle Wallpaper File Upload (Local copy or Base64 URI)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      if (onShowToast) onShowToast('Image must be under 25 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      onUpdateConfig({
        bgMode: 'wallpaper',
        wallpaper: {
          ...(config.wallpaper || {
            fit: 'cover',
            zoom: 100,
            offsetX: 0,
            offsetY: 0,
            blur: 24,
            dim: 40,
            saturation: 100,
            contrast: 100,
            tintColor: '#000000',
            tintOpacity: 0,
            useAlbumArt: false,
          }),
          url: dataUri,
          useAlbumArt: false,
        },
      });
      if (onShowToast) onShowToast('Wallpaper uploaded successfully!');
    };
    reader.readAsDataURL(file);
  };

  // Filtered gradient presets
  const filteredPresets = selectedCategory === 'All'
    ? GRADIENT_PRESETS
    : GRADIENT_PRESETS.filter((p) => p.category === selectedCategory);

  // Custom gradient helpers
  const cg = config.customGradient || {
    type: 'linear',
    angle: 135,
    centerX: 50,
    centerY: 50,
    stops: [
      { id: '1', color: '#090a0f', position: 0 },
      { id: '2', color: '#1f132b', position: 0.5 },
      { id: '3', color: '#0d1117', position: 1 },
    ],
    smooth: true,
    grain: 2,
    animated: false,
  };

  const handleAddStop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cg.stops.length >= 8) {
      if (onShowToast) onShowToast('Maximum 8 color stops allowed.');
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newStop: CustomGradientStop = {
      id: `stop-${Date.now()}`,
      color: '#38bdf8',
      position: parseFloat(pos.toFixed(2)),
    };
    const updated = {
      ...cg,
      stops: [...cg.stops, newStop].sort((a, b) => a.position - b.position),
    };
    onUpdateConfig({ bgMode: 'custom', customGradient: updated });
    setSelectedStopIdx(updated.stops.findIndex((s) => s.id === newStop.id));
  };

  const handleRemoveStop = (idx: number) => {
    if (cg.stops.length <= 2) {
      if (onShowToast) onShowToast('A gradient requires at least 2 color stops.');
      return;
    }
    const updatedStops = cg.stops.filter((_, i) => i !== idx);
    onUpdateConfig({ bgMode: 'custom', customGradient: { ...cg, stops: updatedStops } });
    setSelectedStopIdx(Math.max(0, idx - 1));
  };

  const handleReverseStops = () => {
    const updatedStops = cg.stops.map((st) => ({
      ...st,
      position: parseFloat((1.0 - st.position).toFixed(2)),
    })).sort((a, b) => a.position - b.position);
    onUpdateConfig({ bgMode: 'custom', customGradient: { ...cg, stops: updatedStops } });
  };

  const handleRandomizePalette = () => {
    const pleasantPalettes = [
      ['#090a14', '#1f1530', '#3b1d3d', '#0c0d12'],
      ['#03141f', '#062936', '#093d3b', '#030c14'],
      ['#230b1e', '#3b1028', '#4d1222', '#140612'],
      ['#08120c', '#0f2618', '#143b24', '#050a06'],
      ['#14141c', '#20202e', '#2c2c3d', '#0d0d12'],
    ];
    const picked = pleasantPalettes[Math.floor(Math.random() * pleasantPalettes.length)];
    const newStops: CustomGradientStop[] = picked.map((c, i) => ({
      id: `stop-${Date.now()}-${i}`,
      color: c,
      position: parseFloat((i / (picked.length - 1)).toFixed(2)),
    }));
    onUpdateConfig({ bgMode: 'custom', customGradient: { ...cg, stops: newStops } });
  };

  return (
    <div className="space-y-4">
      {/* Live Preview Header Thumbnail */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black shadow-lg">
        <canvas ref={previewCanvasRef} width={400} height={70} className="w-full h-16 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between px-3.5 py-2">
          <div className="text-[11px] font-medium text-white flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="capitalize">{config.bgMode} Background Preview</span>
          </div>
          <button
            onClick={() => onUpdateConfig({ bgMode: 'solid', bgSolidColor: '#000000' })}
            className="text-[10px] text-white/50 hover:text-white flex items-center space-x-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Black</span>
          </button>
        </div>
      </div>

      {/* Readability Guard Warning Banner */}
      {isReadabilityWarning && (
        <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Background is very bright. Dark overlay has been applied to protect lyric legibility.</span>
        </div>
      )}

      {/* 4 Tabs Selector: Solid / Gradient / Custom / Wallpaper */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 rounded-xl border border-white/10 text-xs font-medium">
        {[
          { id: 'solid', label: 'Solid' },
          { id: 'gradient', label: 'Gradient' },
          { id: 'custom', label: 'Custom' },
          { id: 'wallpaper', label: 'Wallpaper' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setSubTab(tab.id as any);
              if (tab.id === 'solid') onUpdateConfig({ bgMode: 'solid' });
              else if (tab.id === 'gradient') onUpdateConfig({ bgMode: 'gradient' });
              else if (tab.id === 'custom') onUpdateConfig({ bgMode: 'custom' });
              else if (tab.id === 'wallpaper') onUpdateConfig({ bgMode: 'wallpaper' });
            }}
            className={`py-1.5 rounded-lg text-center transition-all ${
              subTab === tab.id
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUB-TAB A: SOLID */}
      {subTab === 'solid' && (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3.5">
          <div className="font-medium text-white text-xs">Solid Color Swatches</div>
          <div className="grid grid-cols-3 gap-2">
            {SOLID_SWATCHES.map((s) => (
              <button
                key={s.hex}
                onClick={() => onUpdateConfig({ bgMode: 'solid', bgSolidColor: s.hex })}
                className={`p-2.5 rounded-lg border flex items-center space-x-2 text-left transition-all ${
                  config.bgSolidColor?.toLowerCase() === s.hex.toLowerCase()
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

          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-white/70 text-xs">Custom Solid Color</span>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={config.bgSolidColor || '#000000'}
                onChange={(e) => onUpdateConfig({ bgMode: 'solid', bgSolidColor: e.target.value })}
                className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={config.bgSolidColor || '#000000'}
                onChange={(e) => onUpdateConfig({ bgMode: 'solid', bgSolidColor: e.target.value })}
                className="w-24 px-2 py-1 rounded bg-black/50 border border-white/20 text-white font-mono text-[11px] outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB B: GRADIENT GALLERY */}
      {subTab === 'gradient' && (
        <div className="space-y-3">
          {/* Category Filter Pills */}
          <div className="flex space-x-1 overflow-x-auto pb-1 custom-scrollbar text-[11px]">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-white text-black font-semibold border-white'
                    : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 25+ Presets Grid */}
          <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto custom-scrollbar p-1">
            {filteredPresets.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  onUpdateConfig({
                    bgMode: 'gradient',
                    bgGradientPreset: p.id,
                    bgGradientType: p.type,
                    bgGradientColors: p.colors,
                    bgGradientAngle: p.angle,
                  })
                }
                className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden h-16 flex flex-col justify-end ${
                  config.bgGradientPreset === p.id && config.bgMode === 'gradient'
                    ? 'border-white text-white shadow-lg ring-1 ring-white/50'
                    : 'border-white/10 text-white/80 hover:border-white/40'
                }`}
                style={{
                  background: `linear-gradient(${p.angle}deg, ${p.colors.join(', ')})`,
                }}
              >
                <div className="font-bold text-[11px] text-white drop-shadow truncate">{p.name}</div>
                <div className="text-[9px] text-white/60 drop-shadow">{p.category}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB C: CUSTOM GRADIENT BUILDER */}
      {subTab === 'custom' && (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-4 text-xs">
          {/* Gradient Type Selector */}
          <div className="flex items-center justify-between">
            <span className="text-white/70">Type</span>
            <div className="flex space-x-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
              {(['linear', 'radial', 'conic'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onUpdateConfig({ bgMode: 'custom', customGradient: { ...cg, type: t } })}
                  className={`px-3 py-1 rounded capitalize font-medium transition-all ${
                    cg.type === t ? 'bg-white/20 text-white shadow' : 'text-white/50 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Gradient Stop Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[11px] text-white/60">
              <span>Stops (click bar to add, 2–8 stops)</span>
              <span>{cg.stops.length} / 8 stops</span>
            </div>
            <div
              onClick={handleAddStop}
              className="relative h-7 rounded-lg cursor-crosshair border border-white/20 overflow-hidden shadow-inner"
              style={{
                background: `linear-gradient(90deg, ${[...cg.stops].sort((a, b) => a.position - b.position).map((s) => `${s.color} ${s.position * 100}%`).join(', ')})`,
              }}
            >
              {cg.stops.map((st, idx) => (
                <div
                  key={st.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStopIdx(idx);
                  }}
                  className={`absolute top-0 bottom-0 w-3 -ml-1.5 border-2 rounded-sm cursor-pointer shadow-md transition-transform ${
                    selectedStopIdx === idx ? 'border-white scale-110 z-20' : 'border-black/60 z-10'
                  }`}
                  style={{
                    left: `${st.position * 100}%`,
                    backgroundColor: st.color,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Selected Stop Editor */}
          {cg.stops[selectedStopIdx] && (
            <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={cg.stops[selectedStopIdx].color}
                  onChange={(e) => {
                    const updated = [...cg.stops];
                    updated[selectedStopIdx].color = e.target.value;
                    onUpdateConfig({ bgMode: 'custom', customGradient: { ...cg, stops: updated } });
                  }}
                  className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={cg.stops[selectedStopIdx].color}
                  onChange={(e) => {
                    const updated = [...cg.stops];
                    updated[selectedStopIdx].color = e.target.value;
                    onUpdateConfig({ bgMode: 'custom', customGradient: { ...cg, stops: updated } });
                  }}
                  className="w-20 px-2 py-0.5 rounded bg-black/60 border border-white/15 text-white font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-white/60 text-[11px]">Position:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round(cg.stops[selectedStopIdx].position * 100)}
                  onChange={(e) => {
                    const pos = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) / 100;
                    const updated = [...cg.stops];
                    updated[selectedStopIdx].position = pos;
                    onUpdateConfig({ bgMode: 'custom', customGradient: { ...cg, stops: updated } });
                  }}
                  className="w-12 px-1.5 py-0.5 rounded bg-black/60 border border-white/15 text-white font-mono text-[11px]"
                />
                <button
                  onClick={() => handleRemoveStop(selectedStopIdx)}
                  className="p-1 rounded text-red-400 hover:bg-red-500/20"
                  title="Delete Stop"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Controls: Reverse, Randomize, Grain */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleReverseStops}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 hover:text-white flex items-center space-x-1 text-[11px]"
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span>Reverse</span>
            </button>
            <button
              onClick={handleRandomizePalette}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 hover:text-white flex items-center space-x-1 text-[11px]"
            >
              <Shuffle className="w-3 h-3" />
              <span>Randomize</span>
            </button>
          </div>

          {/* Angle slider */}
          {cg.type !== 'radial' && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-white/70">
                <span>Angle</span>
                <span className="font-mono">{cg.angle}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={cg.angle}
                onChange={(e) => onUpdateConfig({ bgMode: 'custom', customGradient: { ...cg, angle: parseInt(e.target.value, 10) } })}
                className="w-full accent-white h-1.5 bg-white/10 rounded cursor-pointer"
              />
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB D: WALLPAPER */}
      {subTab === 'wallpaper' && (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-4 text-xs">
          {/* Upload Button */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-white">Custom Image Wallpaper</div>
              <div className="text-[11px] text-white/50">Supports JPG, PNG, WebP, AVIF up to 25 MB</div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center space-x-1.5 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Image</span>
            </button>
          </div>

          {/* Use Album Artwork Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div>
              <div className="font-medium text-white">Use Album Artwork</div>
              <div className="text-[11px] text-white/50">Updates per track with 800ms crossfade</div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(config.wallpaper?.useAlbumArt || config.bgMode === 'album')}
              onChange={(e) => {
                onUpdateConfig({
                  bgMode: e.target.checked ? 'album' : 'wallpaper',
                  wallpaper: {
                    ...(config.wallpaper || {
                      fit: 'cover',
                      zoom: 100,
                      offsetX: 0,
                      offsetY: 0,
                      blur: 24,
                      dim: 40,
                      saturation: 100,
                      contrast: 100,
                      tintColor: '#000000',
                      tintOpacity: 0,
                      useAlbumArt: false,
                    }),
                    useAlbumArt: e.target.checked,
                  },
                });
              }}
              className="w-4 h-4 rounded accent-white cursor-pointer"
            />
          </div>

          {/* Blur Intensity Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-white/70">
              <span>Blur Intensity (Pre-rendered offscreen)</span>
              <span className="font-mono">{config.wallpaper?.blur || 24} px</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="2"
              value={config.wallpaper?.blur ?? 24}
              onChange={(e) => {
                onUpdateConfig({
                  wallpaper: {
                    ...(config.wallpaper || {
                      fit: 'cover',
                      zoom: 100,
                      offsetX: 0,
                      offsetY: 0,
                      blur: 24,
                      dim: 40,
                      saturation: 100,
                      contrast: 100,
                      tintColor: '#000000',
                      tintOpacity: 0,
                      useAlbumArt: false,
                    }),
                    blur: parseInt(e.target.value, 10),
                  },
                });
              }}
              className="w-full accent-white h-1.5 bg-white/10 rounded cursor-pointer"
            />
          </div>

          {/* Dim Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-white/70">
              <span>Brightness Dimming</span>
              <span className="font-mono">{config.wallpaper?.dim ?? 40}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={config.wallpaper?.dim ?? 40}
              onChange={(e) => {
                onUpdateConfig({
                  wallpaper: {
                    ...(config.wallpaper || {
                      fit: 'cover',
                      zoom: 100,
                      offsetX: 0,
                      offsetY: 0,
                      blur: 24,
                      dim: 40,
                      saturation: 100,
                      contrast: 100,
                      tintColor: '#000000',
                      tintOpacity: 0,
                      useAlbumArt: false,
                    }),
                    dim: parseInt(e.target.value, 10),
                  },
                });
              }}
              className="w-full accent-white h-1.5 bg-white/10 rounded cursor-pointer"
            />
          </div>

          {/* Fit Mode */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-white/70 text-[11px]">Fit Mode</span>
            <div className="flex space-x-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
              {(['cover', 'contain', 'stretch', 'center', 'tile'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    onUpdateConfig({
                      wallpaper: {
                        ...(config.wallpaper || {
                          fit: 'cover',
                          zoom: 100,
                          offsetX: 0,
                          offsetY: 0,
                          blur: 24,
                          dim: 40,
                          saturation: 100,
                          contrast: 100,
                          tintColor: '#000000',
                          tintOpacity: 0,
                          useAlbumArt: false,
                        }),
                        fit: mode,
                      },
                    });
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] capitalize transition-all ${
                    (config.wallpaper?.fit || 'cover') === mode
                      ? 'bg-white/20 text-white shadow'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
