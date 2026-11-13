import React, { useEffect, useState, useRef } from 'react';
import { BeatState } from '../audio/beat';
import { adaptiveQuality } from '../services/adaptiveQuality';
import { VisualQuality } from '../services/appearanceConfig';

interface BeatDebugOverlayProps {
  getBeatState: () => BeatState;
  visualQuality?: VisualQuality;
}

export const BeatDebugOverlay: React.FC<BeatDebugOverlayProps> = ({ getBeatState, visualQuality = 'auto' }) => {
  const [visible, setVisible] = useState(false);
  const [showFps, setShowFps] = useState(false);
  const [fps, setFps] = useState(60);
  const [frameTimeMs, setFrameTimeMs] = useState(16.6);
  const [tier, setTier] = useState(adaptiveQuality.getEffectiveTier(visualQuality));

  // We update local display state at 30fps to avoid React render churn
  const [displayState, setDisplayState] = useState<BeatState | null>(null);

  const fpsRef = useRef({
    frames: 0,
    lastTime: performance.now(),
    lastFrameStamp: performance.now(),
    frameTimes: [] as number[],
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        setVisible((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        setShowFps((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update loop for debug overlay and FPS
  useEffect(() => {
    let animId: number;
    let lastRenderUpdate = 0;

    const tick = (now: number) => {
      // FPS measurement
      const fpsData = fpsRef.current;
      fpsData.frames++;
      const frameDelta = now - fpsData.lastFrameStamp;
      fpsData.lastFrameStamp = now;
      fpsData.frameTimes.push(frameDelta);
      if (fpsData.frameTimes.length > 60) fpsData.frameTimes.shift();

      if (now - fpsData.lastTime >= 500) {
        const computedFps = Math.round((fpsData.frames * 1000) / (now - fpsData.lastTime));
        const avgFrameTime =
          fpsData.frameTimes.reduce((a, b) => a + b, 0) / (fpsData.frameTimes.length || 1);
        setFps(computedFps);
        setFrameTimeMs(parseFloat(avgFrameTime.toFixed(1)));
        setTier(adaptiveQuality.getEffectiveTier(visualQuality));
        fpsData.frames = 0;
        fpsData.lastTime = now;
      }

      // Throttled UI refresh at ~25fps (every 40ms)
      if (visible && now - lastRenderUpdate >= 40) {
        const state = getBeatState();
        setDisplayState({ ...state });
        lastRenderUpdate = now;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [visible, getBeatState]);

  if (!visible && !showFps) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end space-y-2 pointer-events-none select-none font-mono text-[11px]">
      {/* FPS Badge (Key F) */}
      {showFps && (
        <div className="bg-black/80 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-lg text-emerald-400 font-semibold shadow-xl flex items-center space-x-2">
          <span>FPS: {fps}</span>
          <span className="text-white/40">|</span>
          <span className="text-white/70">{frameTimeMs} ms</span>
          <span className="text-white/40">|</span>
          <span className="text-cyan-400 uppercase text-[10px] tracking-wider">Tier: {tier}</span>
        </div>
      )}

      {/* Main Beat Debug HUD (Key D) */}
      {visible && displayState && (
        <div className="bg-black/90 backdrop-blur-xl border border-white/20 p-4 rounded-xl shadow-2xl text-white/90 w-72 space-y-3 pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
              <span className="font-bold tracking-wider text-xs text-white">BEAT ENGINE HUD</span>
            </div>
            <span className="text-[10px] text-white/40">Press 'D' to close</span>
          </div>

          {/* Tempo & Confidence */}
          <div className="grid grid-cols-2 gap-2 bg-white/[0.04] p-2 rounded-lg border border-white/5">
            <div>
              <div className="text-[10px] text-white/50">TEMPO</div>
              <div className="text-base font-bold text-white tracking-wide">
                {displayState.bpm} <span className="text-xs font-normal text-white/60">BPM</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-white/50">CONFIDENCE</div>
              <div className="text-base font-bold text-emerald-400">
                {Math.round(displayState.confidence * 100)}%
              </div>
            </div>
          </div>

          {/* Beat Phase Gauge */}
          <div>
            <div className="flex justify-between text-[10px] text-white/60 mb-1">
              <span>BEAT PHASE</span>
              <span>{Math.round(displayState.phase * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-amber-400 transition-none"
                style={{ width: `${Math.round(displayState.phase * 100)}%` }}
              />
            </div>
          </div>

          {/* Event Flashes */}
          <div className="flex space-x-2">
            <div
              className={`flex-1 py-1.5 text-center rounded font-bold text-[10px] border transition-colors ${
                displayState.isBeat
                  ? 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.8)]'
                  : 'bg-white/5 text-white/40 border-white/5'
              }`}
            >
              BEAT
            </div>
            <div
              className={`flex-1 py-1.5 text-center rounded font-bold text-[10px] border transition-colors ${
                displayState.isKick
                  ? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.8)]'
                  : 'bg-white/5 text-white/40 border-white/5'
              }`}
            >
              KICK
            </div>
            <div
              className={`flex-1 py-1.5 text-center rounded font-bold text-[10px] border transition-colors ${
                displayState.isSnare
                  ? 'bg-cyan-400 text-black border-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]'
                  : 'bg-white/5 text-white/40 border-white/5'
              }`}
            >
              SNARE
            </div>
          </div>

          {/* Frequency Bands */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] text-white/50">FREQUENCY ENERGIES</div>

            {/* Sub-bass */}
            <div>
              <div className="flex justify-between text-[10px] text-white/70">
                <span>Sub-bass (20-80Hz)</span>
                <span>{Math.round(displayState.smoothedSubBass * 100)}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500"
                  style={{ width: `${Math.round(displayState.smoothedSubBass * 100)}%` }}
                />
              </div>
            </div>

            {/* Bass */}
            <div>
              <div className="flex justify-between text-[10px] text-white/70">
                <span>Bass (80-250Hz)</span>
                <span>{Math.round(displayState.smoothedBass * 100)}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500"
                  style={{ width: `${Math.round(displayState.smoothedBass * 100)}%` }}
                />
              </div>
            </div>

            {/* Mids */}
            <div>
              <div className="flex justify-between text-[10px] text-white/70">
                <span>Mids (250Hz-2kHz)</span>
                <span>{Math.round(displayState.smoothedMids * 100)}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400"
                  style={{ width: `${Math.round(displayState.smoothedMids * 100)}%` }}
                />
              </div>
            </div>

            {/* Highs */}
            <div>
              <div className="flex justify-between text-[10px] text-white/70">
                <span>Highs (2-12kHz)</span>
                <span>{Math.round(displayState.smoothedHighs * 100)}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400"
                  style={{ width: `${Math.round(displayState.smoothedHighs * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Build / Drop Signal */}
          <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[10px]">
            <span className="text-white/50">BUILD / DROP:</span>
            <span
              className={`font-bold px-2 py-0.5 rounded ${
                displayState.buildDropSignal === 'drop'
                  ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50 animate-pulse'
                  : displayState.buildDropSignal === 'building'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                  : 'text-white/40'
              }`}
            >
              {displayState.buildDropSignal.toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

