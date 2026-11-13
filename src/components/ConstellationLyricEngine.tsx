import React, { useEffect, useRef } from 'react';
import { LyricLine } from '../types/lyrics';
import { AudioVisualizerData } from '../types/radio';
import { BeatState } from '../audio/beat';
import {
  AppearanceConfig,
  DEFAULT_APPEARANCE_CONFIG,
  getFontFamily,
  ensureFontLoaded,
} from '../services/appearanceConfig';

interface ConstellationLyricEngineProps {
  lines: LyricLine[];
  currentTime: number;
  getCurrentTime?: () => number;
  audioDataRef?: React.MutableRefObject<AudioVisualizerData>;
  accentRgbRef?: React.MutableRefObject<[number, number, number]>;
  accentColor?: string;
  appearanceConfig?: AppearanceConfig;
  getBeatState?: () => BeatState;
}

interface ConstellationNode {
  word: string;
  startTime: number;
  endTime: number;
  x: number;
  y: number;
  hasStem: boolean;
  stemDir: 1 | -1;
  currentFontSize: number;
  currentOpacity: number;
  currentStarRadius: number;
  currentRingAlpha: number;
}

interface ConstellationBranch {
  from: number;
  to: number;
  progress: number;
}

interface WordRippleItem {
  active: boolean;
  x: number;
  y: number;
  startTime: number;
  duration: number;
  ringsCount: number;
  bassFactor: number;
  color: 'accent' | 'white';
  style: 'rings' | 'pulse-only' | 'rings-pulse';
  sizeScale: number;
  shimmer: boolean;
}

// 53-bit string hash for deterministic layout seed
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c64e6d ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function createPRNG(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const ConstellationLyricEngine: React.FC<ConstellationLyricEngineProps> = ({
  lines,
  currentTime,
  getCurrentTime,
  accentRgbRef,
  accentColor = '#ffffff',
  appearanceConfig,
  getBeatState,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getTimeRef = useRef(getCurrentTime);
  getTimeRef.current = getCurrentTime;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const lastActiveTimeRef = useRef<number>(0);
  const appearanceConfigRef = useRef(appearanceConfig);
  appearanceConfigRef.current = appearanceConfig;
  const getBeatStateRef = useRef(getBeatState);
  getBeatStateRef.current = getBeatState;

  // Word Ripple object pool (max 4 alive, zero hot-loop allocations)
  const ripplesPoolRef = useRef<WordRippleItem[]>([
    { active: false, x: 0, y: 0, startTime: 0, duration: 1.4, ringsCount: 3, bassFactor: 1.0, color: 'accent', style: 'rings-pulse', sizeScale: 1.0, shimmer: false },
    { active: false, x: 0, y: 0, startTime: 0, duration: 1.4, ringsCount: 3, bassFactor: 1.0, color: 'accent', style: 'rings-pulse', sizeScale: 1.0, shimmer: false },
    { active: false, x: 0, y: 0, startTime: 0, duration: 1.4, ringsCount: 3, bassFactor: 1.0, color: 'accent', style: 'rings-pulse', sizeScale: 1.0, shimmer: false },
    { active: false, x: 0, y: 0, startTime: 0, duration: 1.4, ringsCount: 3, bassFactor: 1.0, color: 'accent', style: 'rings-pulse', sizeScale: 1.0, shimmer: false },
  ]);
  const lastActiveWordRef = useRef<{ lineIdx: number; wordIdx: number }>({ lineIdx: -1, wordIdx: -1 });
  const lastWordSpawnTimeRef = useRef<number>(0);

  // Lazy load selected font locally
  useEffect(() => {
    if (appearanceConfig?.lyricsFont) {
      ensureFontLoaded(appearanceConfig.lyricsFont);
    }
  }, [appearanceConfig?.lyricsFont]);

  // Active line state
  const currentLineIndexRef = useRef<number>(-1);
  const nodesRef = useRef<ConstellationNode[]>([]);
  const lineProgressRef = useRef<number[]>([]);
  const branchesRef = useRef<ConstellationBranch[]>([]);
  const lineFadeRef = useRef<number>(1.0);

  // Layout builder for the active lyric line
  const buildLineConstellation = (lineIndex: number, line: LyricLine, width: number, height: number) => {
    const rawWords = line.words && line.words.length > 0
      ? line.words
      : line.text.split(/\s+/).filter(Boolean).map((w, i, arr) => {
          const span = (line.endTime - line.startTime) / arr.length;
          return {
            text: w,
            startTime: line.startTime + i * span,
            endTime: line.startTime + (i + 1) * span,
          };
        });

    const N = rawWords.length;
    if (N === 0) {
      nodesRef.current = [];
      lineProgressRef.current = [];
      branchesRef.current = [];
      return;
    }

    const prng = createPRNG(cyrb53(`${line.text}_${lineIndex}`));

    // Viewport bounds: middle 70% width, 30% to 75% height
    const minX = width * 0.16;
    const maxX = width * 0.84;
    const minY = height * 0.32;
    const maxY = height * 0.72;
    const spanX = maxX - minX;

    const nodes: ConstellationNode[] = [];

    // Loose zigzag with deterministic jitter across the bounds
    const baseWaveDir = prng() > 0.5 ? 1 : -1;

    for (let i = 0; i < N; i++) {
      const w = rawWords[i];
      const progX = N === 1 ? 0.5 : i / (N - 1);

      // Horizontal position
      const jitterX = (prng() - 0.5) * Math.min(35, spanX / Math.max(1, N * 1.8));
      let x = minX + progX * spanX + jitterX;
      x = Math.max(minX, Math.min(maxX, x));

      // Vertical zigzag position
      const zig = ((i % 2 === 0 ? 1 : -1) * baseWaveDir);
      const waveOffset = zig * (height * 0.12 + (prng() - 0.5) * height * 0.08);
      const jitterY = (prng() - 0.5) * 45;
      let y = height * 0.52 + waveOffset + jitterY;
      y = Math.max(minY, Math.min(maxY, y));

      // Prevent collision with previous node
      if (i > 0) {
        const prev = nodes[i - 1];
        const dx = Math.abs(x - prev.x);
        const dy = Math.abs(y - prev.y);
        if (dx < 70 && dy < 40) {
          y = prev.y > height * 0.52 ? prev.y - 55 : prev.y + 55;
          y = Math.max(minY, Math.min(maxY, y));
        }
      }

      // 1 or 2 nodes get vertical stems
      const hasStem = N > 3 && (i === 1 || i === Math.floor(N * 0.65));
      const stemDir = y > height * 0.52 ? -1 : 1;

      nodes.push({
        word: w.text,
        startTime: w.startTime,
        endTime: w.endTime,
        x,
        y,
        hasStem,
        stemDir,
        currentFontSize: 0,
        currentOpacity: 0,
        currentStarRadius: 0,
        currentRingAlpha: 0,
      });
    }

    // Connect lines progressive array
    const progressArr = new Array(Math.max(0, N)).fill(0);

    // Extra branches (1–2 extra branch lines so lines cross in true constellation look)
    const branches: ConstellationBranch[] = [];
    if (N >= 4) {
      branches.push({ from: 0, to: Math.min(2, N - 1), progress: 0 });
    }
    if (N >= 6) {
      branches.push({ from: 1, to: Math.min(4, N - 1), progress: 0 });
    }

    nodesRef.current = nodes;
    lineProgressRef.current = progressArr;
    branchesRef.current = branches;
    lineFadeRef.current = 1.0;
  };

  useEffect(() => {
    // Reset active line when track or lines change
    currentLineIndexRef.current = -1;
    nodesRef.current = [];
    lineProgressRef.current = [];
    branchesRef.current = [];
    for (let i = 0; i < ripplesPoolRef.current.length; i++) {
      ripplesPoolRef.current[i].active = false;
    }
    lastActiveWordRef.current = { lineIdx: -1, wordIdx: -1 };
  }, [lines]);

  // 60FPS Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // Helper: Draw 4-point sparkle star (✦)
    const drawSparkleStar = (cx: number, cy: number, outerR: number) => {
      if (outerR <= 0.5) return;
      const innerR = outerR * 0.26;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / 4;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    };

    const render = (timestamp: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      const activeTime = getTimeRef.current ? getTimeRef.current() : currentTimeRef.current;
      const currentLines = linesRef.current;
      const isSeek = Math.abs(activeTime - lastActiveTimeRef.current) > 0.4;
      lastActiveTimeRef.current = activeTime;

      // 1. Locate current line
      let activeLineIdx = -1;
      if (currentLines && currentLines.length > 0) {
        for (let i = 0; i < currentLines.length; i++) {
          const l = currentLines[i];
          // Line remains visible through its duration + 500ms fade
          if (activeTime >= l.startTime && activeTime <= l.endTime + 0.55) {
            activeLineIdx = i;
            break;
          }
          if (activeTime > l.endTime + 0.55 && (i === currentLines.length - 1 || activeTime < currentLines[i + 1].startTime)) {
            // In gap between lines: fade out
            activeLineIdx = -1;
          }
        }
      }

      // Check if we need to switch line constellation
      if (activeLineIdx !== currentLineIndexRef.current) {
        currentLineIndexRef.current = activeLineIdx;
        if (activeLineIdx !== -1 && currentLines[activeLineIdx]) {
          buildLineConstellation(activeLineIdx, currentLines[activeLineIdx], width, height);
        } else {
          nodesRef.current = [];
          lineProgressRef.current = [];
          branchesRef.current = [];
        }
      }

      // Clear Canvas: pure #000000 background (no stars, no vignette)
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const N = nodes.length;

      if (N > 0 && activeLineIdx !== -1) {
        const currentLine = currentLines[activeLineIdx];

        // 500ms line fade out at end of line (Rule 10)
        let globalLineAlpha = 1.0;
        if (activeTime > currentLine.endTime) {
          const elapsedFade = activeTime - currentLine.endTime;
          globalLineAlpha = Math.max(0, 1.0 - elapsedFade / 0.5);
        }
        lineFadeRef.current += (globalLineAlpha - lineFadeRef.current) * 0.18;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, lineFadeRef.current));

        // Read dynamic accent RGB (updates live at 60fps even during Auto Cycle)
        const [ar, ag, ab] = accentRgbRef?.current || [255, 255, 255];

        // Determine which words are revealed, which is active, which are past
        // Never show future words! (Rule 6)
        let activeWordIdx = -1;
        for (let i = 0; i < N; i++) {
          if (activeTime >= nodes[i].startTime) {
            activeWordIdx = i;
          }
        }

        // Get dynamic appearance config
        const appCfg = appearanceConfigRef.current || DEFAULT_APPEARANCE_CONFIG;
        const showLines = appCfg.showConnectingLines !== false;
        const showStars = appCfg.showStars !== false;
        const activeWeight = appCfg.lyricsActiveWeight || 700;
        const activeSize = appCfg.lyricsActiveSize || 44;
        const pastSize = appCfg.lyricsPastSize || 13;
        const lyricsFontFamily = getFontFamily(appCfg.lyricsFont || 'sf-style');
        const lyricsCase = appCfg.lyricsCase || 'original';

        // Tinting & Ripple flags
        const isTinted = appCfg.tintLyricsWithAccent !== false;
        const isRippleOn = appCfg.rippleEnabled !== false;

        // Trigger Word Ripple on active word transition
        if (activeWordIdx !== -1 && nodes[activeWordIdx]) {
          if (
            activeLineIdx !== lastActiveWordRef.current.lineIdx ||
            activeWordIdx !== lastActiveWordRef.current.wordIdx
          ) {
            lastActiveWordRef.current = { lineIdx: activeLineIdx, wordIdx: activeWordIdx };

            if (isRippleOn) {
              const timeSinceLast = Math.abs(activeTime - lastWordSpawnTimeRef.current);
              lastWordSpawnTimeRef.current = activeTime;

              const isFast = timeSinceLast < 0.15;
              const rStyle = appCfg.rippleStyle || 'rings-pulse';
              const ringsCount = rStyle === 'pulse-only' ? 0 : (isFast ? 1 : 3);

              const beatState = getBeatStateRef.current ? getBeatStateRef.current() : null;
              const smoothedBass = beatState ? Math.max(0, Math.min(1.0, beatState.smoothedBass)) : 0;
              const bassFactor = Math.max(1.0, Math.min(1.6, 1.0 + 0.5 * smoothedBass));

              const speed = Math.max(0.5, Math.min(2.0, appCfg.rippleSpeed || 1.0));
              const sizeScale = Math.max(0.5, Math.min(2.0, appCfg.rippleSize || 1.0));

              const pool = ripplesPoolRef.current;
              let targetSlot = pool.find((r) => !r.active);
              if (!targetSlot) {
                let oldestTime = Infinity;
                for (let ri = 0; ri < pool.length; ri++) {
                  if (pool[ri].startTime < oldestTime) {
                    oldestTime = pool[ri].startTime;
                    targetSlot = pool[ri];
                  }
                }
              }

              if (targetSlot) {
                targetSlot.active = true;
                targetSlot.x = nodes[activeWordIdx].x;
                targetSlot.y = nodes[activeWordIdx].y;
                targetSlot.startTime = activeTime;
                targetSlot.duration = 1.4 / speed;
                targetSlot.ringsCount = ringsCount;
                targetSlot.bassFactor = bassFactor;
                targetSlot.color = appCfg.rippleColor || 'accent';
                targetSlot.style = rStyle;
                targetSlot.sizeScale = sizeScale;
                targetSlot.shimmer = Boolean(appCfg.rippleShimmer);
              }
            }
          }
        }

        // Connecting lines colors (tinted vs neutral)
        const lineR = isTinted ? ar : Math.round(255 * 0.9 + ar * 0.1);
        const lineG = isTinted ? ag : Math.round(255 * 0.9 + ag * 0.1);
        const lineB = isTinted ? ab : Math.round(255 * 0.9 + ab * 0.1);
        const lineAlpha = isTinted ? 0.35 : 0.22;

        // --- STEP A: Progressive Connecting Lines (Rule 8) ---
        // Lyric order lines draw in progressively as each new word arrives
        if (showLines) {
          const lineProg = lineProgressRef.current;

          for (let i = 1; i < N; i++) {
            const prev = nodes[i - 1];
            const curr = nodes[i];

            // Line i connects node i-1 to node i. It starts drawing when word i arrives.
            const isRevealed = activeTime >= curr.startTime;
            const targetP = isRevealed ? 1.0 : 0.0;
            if (lineProg[i] === undefined || isSeek) lineProg[i] = targetP;
            else lineProg[i] += (targetP - lineProg[i]) * 0.16; // ~400ms progressive draw in

            const p = lineProg[i];
            if (p > 0.01) {
              const destX = prev.x + (curr.x - prev.x) * p;
              const destY = prev.y + (curr.y - prev.y) * p;

              ctx.beginPath();
              ctx.moveTo(prev.x, prev.y);
              ctx.lineTo(destX, destY);
              ctx.strokeStyle = `rgba(${lineR}, ${lineG}, ${lineB}, ${lineAlpha})`;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }

          // Extra branch lines (cross the constellation)
          const branches = branchesRef.current;
          for (let b = 0; b < branches.length; b++) {
            const br = branches[b];
            if (br.from < N && br.to < N) {
              const nodeA = nodes[br.from];
              const nodeB = nodes[br.to];
              const isRevealed = activeTime >= nodeB.startTime;
              const targetP = isRevealed ? 1.0 : 0.0;
              if (isSeek) br.progress = targetP;
              else br.progress += (targetP - br.progress) * 0.14;

              if (br.progress > 0.01) {
                const destX = nodeA.x + (nodeB.x - nodeA.x) * br.progress;
                const destY = nodeA.y + (nodeB.y - nodeA.y) * br.progress;

                ctx.beginPath();
                ctx.moveTo(nodeA.x, nodeA.y);
                ctx.lineTo(destX, destY);
                ctx.strokeStyle = `rgba(${lineR}, ${lineG}, ${lineB}, ${isTinted ? 0.25 : 0.16})`;
                ctx.lineWidth = 1;
                ctx.stroke();
              }
            }
          }
        }

        // --- STEP B: Word Ripples (Concentric rings + soft-light pulse behind words) ---
        const ripples = ripplesPoolRef.current;
        for (let ri = 0; ri < ripples.length; ri++) {
          const r = ripples[ri];
          if (!r.active) continue;

          const elapsed = activeTime - r.startTime;
          if (elapsed < 0 || elapsed > r.duration + 0.3) {
            r.active = false;
            continue;
          }

          const ripR = r.color === 'white' ? 255 : ar;
          const ripG = r.color === 'white' ? 255 : ag;
          const ripB = r.color === 'white' ? 255 : ab;

          // 1. Soft-light pulse behind word (in 200ms, out 900ms)
          if (r.style === 'pulse-only' || r.style === 'rings-pulse') {
            if (elapsed <= 1.1) {
              let pulseAlpha = 0;
              if (elapsed < 0.2) {
                pulseAlpha = (elapsed / 0.2) * 0.35 * r.bassFactor;
              } else {
                pulseAlpha = Math.max(0, 1 - (elapsed - 0.2) / 0.9) * 0.35 * r.bassFactor;
              }

              if (pulseAlpha > 0.01) {
                const pulseR = 60 * r.sizeScale * r.bassFactor;
                const grad = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, pulseR);
                grad.addColorStop(0, `rgba(${ripR}, ${ripG}, ${ripB}, ${pulseAlpha * 0.45})`);
                grad.addColorStop(0.5, `rgba(${ripR}, ${ripG}, ${ripB}, ${pulseAlpha * 0.18})`);
                grad.addColorStop(1, `rgba(${ripR}, ${ripG}, ${ripB}, 0)`);
                ctx.beginPath();
                ctx.arc(r.x, r.y, pulseR, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();
              }
            }
          }

          // 2. Concentric rings (8px -> 240px over ~1.4s ease-out)
          if (r.style === 'rings' || r.style === 'rings-pulse') {
            for (let k = 0; k < r.ringsCount; k++) {
              const ringElapsed = elapsed - k * 0.12;
              const t = ringElapsed / r.duration;
              if (t >= 0 && t <= 1.0) {
                const easeOut = 1 - Math.pow(1 - t, 3);
                const radius = (8 + (240 - 8) * easeOut) * r.sizeScale * r.bassFactor;
                const ringAlpha = Math.min(0.75, 0.5 * (1 - easeOut) * r.bassFactor);

                if (ringAlpha > 0.01) {
                  ctx.beginPath();
                  ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
                  ctx.strokeStyle = `rgba(${ripR}, ${ripG}, ${ripB}, ${ringAlpha})`;
                  ctx.lineWidth = 1.5;
                  ctx.stroke();

                  if (r.shimmer) {
                    for (let s = 0; s < 4; s++) {
                      const ang = easeOut * Math.PI + (s * Math.PI) / 2;
                      const sx = r.x + Math.cos(ang) * radius;
                      const sy = r.y + Math.sin(ang) * radius;
                      ctx.beginPath();
                      ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
                      ctx.fillStyle = `rgba(255, 255, 255, ${ringAlpha * 0.5})`;
                      ctx.fill();
                    }
                  }
                }
              }
            }
          }
        }

        // --- STEP C: Vertical Stems & Node Elements ---
        for (let i = 0; i < N; i++) {
          const n = nodes[i];
          const isRevealed = activeTime >= n.startTime;

          // If future word: completely hidden (Rule 6)
          if (!isRevealed && n.currentOpacity < 0.01) {
            continue;
          }

          const isActive = i === activeWordIdx;
          const isPast = isRevealed && i < activeWordIdx;

          // Target values
          // Active word: large (activeSize), bold, bright white (100% opacity)
          // Past word: animates down (~400ms ease-out) to small (pastSize), dim (~55% opacity), lighter weight
          const targetFontSize = isRevealed ? (isActive ? activeSize : pastSize) : 0;
          const targetOpacity = isRevealed ? (isActive ? 1.0 : 0.55) : 0;
          const targetStarR = isRevealed && showStars ? (isActive ? 6.5 : 3.0) : 0;
          const targetRingAlpha = isActive && showStars ? 0.35 : 0.0;

          if (isSeek) {
            n.currentFontSize = targetFontSize;
            n.currentOpacity = targetOpacity;
            n.currentStarRadius = targetStarR;
            n.currentRingAlpha = targetRingAlpha;
          } else {
            // Smooth 400ms ease-out transitions
            n.currentFontSize += (targetFontSize - n.currentFontSize) * 0.14;
            n.currentOpacity += (targetOpacity - n.currentOpacity) * 0.14;
            n.currentStarRadius += (targetStarR - n.currentStarRadius) * 0.14;
            n.currentRingAlpha += (targetRingAlpha - n.currentRingAlpha) * 0.14;
          }

          if (n.currentOpacity < 0.02) continue;

          // 1. Draw vertical stem if present (Rule 8)
          if (showStars && n.hasStem && n.currentOpacity > 0.1) {
            const stemLen = 18;
            const stemY = n.y + n.stemDir * stemLen;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(n.x, stemY);
            ctx.strokeStyle = `rgba(${lineR}, ${lineG}, ${lineB}, ${n.currentOpacity * 0.25})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Tiny tip dot
            ctx.beginPath();
            ctx.arc(n.x, stemY, 1, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${lineR}, ${lineG}, ${lineB}, ${n.currentOpacity * 0.4})`;
            ctx.fill();
          }

          // 2. Glowing Ring around Star on Active Word (takes Accent / Glow Color)
          if (showStars && n.currentRingAlpha > 0.02) {
            const ringPulse = Math.sin(timestamp * 0.0035) * 1.5;
            const ringR = 14 + ringPulse;

            ctx.save();
            ctx.beginPath();
            ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = isTinted
              ? `rgba(${ar}, ${ag}, ${ab}, ${n.currentRingAlpha * 0.95})`
              : `rgba(255, 255, 255, ${n.currentRingAlpha * 0.95})`;
            ctx.lineWidth = 1;
            ctx.shadowColor = isTinted
              ? `rgba(${ar}, ${ag}, ${ab}, 0.65)`
              : 'rgba(255, 255, 255, 0.65)';
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.restore();
          }

          // 3. Four-point sparkle star (✦)
          if (showStars) {
            ctx.save();
            if (isActive) {
              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = isTinted
                ? `rgba(${ar}, ${ag}, ${ab}, 0.85)`
                : 'rgba(255, 255, 255, 0.85)';
              ctx.shadowBlur = 10;
            } else {
              ctx.fillStyle = isTinted
                ? `rgba(${ar}, ${ag}, ${ab}, ${n.currentOpacity * 0.75})`
                : `rgba(255, 255, 255, ${n.currentOpacity})`;
            }
            drawSparkleStar(n.x, n.y, n.currentStarRadius);
            ctx.restore();
          }

          // 4. Word Label beside Star (Active word text stays white; past words tinted at 50% opacity)
          ctx.save();
          const labelX = showStars ? (n.x + (isActive ? 15 : 10)) : n.x;
          const labelY = n.y + (isActive ? 13 : 4);

          const weight = isActive ? activeWeight.toString() : '300';
          const sizePx = Math.max(9, Math.round(n.currentFontSize));
          ctx.font = `${weight} ${sizePx}px ${lyricsFontFamily}`;

          if (isActive) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = isTinted
              ? `rgba(${ar}, ${ag}, ${ab}, 0.65)`
              : 'rgba(255, 255, 255, 0.45)';
            ctx.shadowBlur = 12;
          } else if (isPast) {
            // Previous words use the accent at about 50% opacity
            ctx.fillStyle = isTinted
              ? `rgba(${ar}, ${ag}, ${ab}, ${n.currentOpacity * 0.5})`
              : `rgba(255, 255, 255, ${n.currentOpacity})`;
          } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${n.currentOpacity})`;
          }
          ctx.textBaseline = 'alphabetic';
          ctx.textAlign = 'left';

          let displayWord = n.word;
          if (lyricsCase === 'lowercase') displayWord = n.word.toLowerCase();
          else if (lyricsCase === 'uppercase') displayWord = n.word.toUpperCase();

          ctx.fillText(displayWord, labelX, labelY);
          ctx.restore();
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-10 w-full h-full"
    />
  );
};
