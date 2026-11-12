import React, { useEffect, useRef } from 'react';
import { AudioVisualizerData, PlaybackState } from '../types/radio';

interface CenteredAudioRingProps {
  audioDataRef: React.MutableRefObject<AudioVisualizerData>;
  playbackState: PlaybackState;
  colorRgb?: [number, number, number];
  accentRgbRef?: React.MutableRefObject<[number, number, number]>;
  intensity?: number;
}

export const CenteredAudioRing: React.FC<CenteredAudioRingProps> = ({
  audioDataRef,
  playbackState,
  colorRgb = [255, 255, 255],
  accentRgbRef,
  intensity = 1.0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smoothedBassRef = useRef(0.1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const size = Math.min(window.innerWidth * 0.75, window.innerHeight * 0.55, 460);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = (timestamp: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      const isPlaying = playbackState === 'playing';
      const audioData = audioDataRef.current;

      // Bass smoothing for central orb pulse
      let targetBass = 0.08;
      if (isPlaying && audioData) {
        targetBass = Math.min(1.0, (audioData.subBassEnergy || 0) * 0.7 + (audioData.bassEnergy || 0) * 0.3);
      } else {
        targetBass = 0.06 + 0.04 * Math.sin(timestamp * 0.002);
      }
      smoothedBassRef.current += (targetBass - smoothedBassRef.current) * 0.16;
      const pulse = smoothedBassRef.current;

      const [r, g, b] = accentRgbRef?.current || colorRgb;
      const baseR = Math.min(width, height) * 0.22;
      const orbRadius = baseR * (1 + pulse * 0.22 * intensity);

      // --- 1. Soft Central Glowing Orb ---
      ctx.save();
      const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbRadius * 1.6);
      orbGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.28 * intensity + pulse * 0.25})`);
      orbGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${0.08 * intensity + pulse * 0.1})`);
      orbGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Crisp inner orb outline
      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.35 + pulse * 0.45})`;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
      ctx.shadowBlur = 8 + pulse * 8;
      ctx.stroke();
      ctx.restore();

      // --- 2. Audio-Reactive Radial Bars ---
      const numBars = 64;
      const freqData = audioData?.frequencyData;
      const gapRadius = orbRadius + 8;
      const maxBarLen = Math.min(width, height) * 0.22 * intensity;

      ctx.save();
      for (let i = 0; i < numBars; i++) {
        const angle = (i / numBars) * Math.PI * 2 - Math.PI / 2;

        let barVal = 0.08;
        if (isPlaying && freqData && freqData.length > 0) {
          // Map index to frequency bin with logarithmic / perceptual weighting
          const binIdx = Math.floor(Math.pow(i / numBars, 1.4) * Math.min(freqData.length, 48));
          barVal = Math.min(1.0, (freqData[binIdx] || 0) / 255);
        } else {
          // Idle wave undulation
          barVal = 0.08 + 0.05 * Math.sin(timestamp * 0.0025 + i * 0.18);
        }

        const barLen = Math.max(4, barVal * maxBarLen);
        const x1 = cx + Math.cos(angle) * gapRadius;
        const y1 = cy + Math.sin(angle) * gapRadius;
        const x2 = cx + Math.cos(angle) * (gapRadius + barLen);
        const y2 = cy + Math.sin(angle) * (gapRadius + barLen);

        const barAlpha = Math.min(1.0, 0.25 + barVal * 0.75 * intensity);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${barAlpha})`;
        ctx.lineWidth = 2.0;
        ctx.lineCap = 'round';
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${barAlpha * 0.6})`;
        ctx.shadowBlur = barVal > 0.4 ? 6 : 2;
        ctx.stroke();
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [playbackState, colorRgb, intensity, audioDataRef]);

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-10">
      <canvas ref={canvasRef} className="rounded-full select-none" />
    </div>
  );
};

