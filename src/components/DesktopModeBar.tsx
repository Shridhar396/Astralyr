import React from 'react';
import { X, Layers, Maximize, MousePointer, AppWindow, ShieldAlert } from 'lucide-react';
import { DesktopWindowMode } from '../types/visualizer';

interface DesktopModeBarProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: DesktopWindowMode;
  isClickThrough: boolean;
  onSelectMode: (mode: DesktopWindowMode) => void;
  onToggleClickThrough: () => void;
}

export const DesktopModeBar: React.FC<DesktopModeBarProps> = ({
  isOpen,
  onClose,
  currentMode,
  isClickThrough,
  onSelectMode,
  onToggleClickThrough,
}) => {
  if (!isOpen) return null;

  const modes: {
    id: DesktopWindowMode;
    title: string;
    tag: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'wallpaper',
      title: 'Windows 11 Wallpaper Mode',
      tag: 'WorkerW Desktop Layer',
      desc: 'Parents the borderless visualizer behind Windows desktop icons (WorkerW under Progman). Live animated audio wallpaper.',
      icon: <Layers className="w-5 h-5 text-emerald-400" />,
    },
    {
      id: 'theatre',
      title: 'Theatre Fullscreen Mode',
      tag: 'Borderless Stage',
      desc: 'Occupies full display with zero borders. Best for immersive ambient listening and full screen party visualizer.',
      icon: <Maximize className="w-5 h-5 text-purple-400" />,
    },
    {
      id: 'overlay',
      title: 'Screen-Edge Rim Light Overlay',
      tag: 'Always On Top',
      desc: 'Floats the glowing border rim light above all other windows while you work, code, or game.',
      icon: <AppWindow className="w-5 h-5 text-cyan-400" />,
    },
    {
      id: 'normal',
      title: 'Standard Desktop Window',
      tag: 'Floating Window',
      desc: 'Standard floating desktop window for testing and easy repositioning.',
      icon: <AppWindow className="w-5 h-5 text-slate-400" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-white/10 shadow-2xl relative max-h-[85vh] flex flex-col font-mono">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center space-x-2.5">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-lg text-white">Windows 11 Desktop Modes</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg glass-pill text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Options */}
        <div className="my-4 space-y-2.5 overflow-y-auto flex-1">
          {modes.map((m) => {
            const isSelected = currentMode === m.id;
            return (
              <div
                key={m.id}
                onClick={() => {
                  onSelectMode(m.id);
                  onClose();
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-cyan-400 bg-cyan-500/10 shadow-lg'
                    : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20'
                }`}
              >
                <div className="flex items-center space-x-3 mb-1">
                  {m.icon}
                  <span className="font-bold text-white text-sm">{m.title}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-cyan-300 ml-auto">
                    {m.tag}
                  </span>
                </div>
                <p className="text-xs text-slate-400 pl-8 leading-relaxed">{m.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Click-Through (WS_EX_TRANSPARENT) Toggle */}
        <div className="pt-3 border-t border-white/10">
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MousePointer className="w-5 h-5 text-pink-400" />
              <div>
                <div className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>Click-Through Mode</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 font-normal">
                    WS_EX_TRANSPARENT
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Clicks pass through window to apps beneath it. Press 'T' or Tray to toggle off.
                </div>
              </div>
            </div>

            <button
              onClick={onToggleClickThrough}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                isClickThrough
                  ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              {isClickThrough ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          <div className="mt-2 text-[10px] text-slate-500 flex items-center space-x-1.5 px-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>
              Tip: Modes can also be switched instantly via the System Tray icon in the Windows taskbar!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

