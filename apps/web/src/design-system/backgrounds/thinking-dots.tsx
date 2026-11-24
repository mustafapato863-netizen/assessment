import React, { useEffect, useRef } from 'react';

export interface ThinkingDotsProps {
  dotSize?: number;
  spacing?: number;
  color?: string;
  speed?: number;
  fadeEdge?: boolean;
  className?: string;
  isDark?: boolean;
}

/**
 * ThinkingDots - Restrained ambient canvas particle grid effect.
 * Pauses animation when document is hidden or prefers-reduced-motion is set.
 */
export const ThinkingDots: React.FC<ThinkingDotsProps> = ({
  dotSize = 1.5,
  spacing = 30,
  speed = 0.0014,
  className = '',
  isDark = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId = 0;
    let time = 0;

    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawFrame = () => {
      const displayW = window.innerWidth;
      const displayH = window.innerHeight;
      ctx.clearRect(0, 0, displayW, displayH);

      const cols = Math.ceil(displayW / spacing);
      const rows = Math.ceil(displayH / spacing);

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing;
          const y = j * spacing;
          const dist = Math.sin(i * 0.18 + time) + Math.cos(j * 0.18 + time);
          const normalized = (dist + 2) / 4;
          const currentDotSize = dotSize * (0.6 + normalized * 0.8);

          if (isDark) {
            const opacity = 0.08 + normalized * 0.24;
            ctx.fillStyle = `rgba(${i % 2 === 0 ? '0, 163, 224' : '0, 168, 89'}, ${opacity})`;
          } else {
            const opacity = 0.05 + normalized * 0.16;
            ctx.fillStyle = `rgba(${i % 2 === 0 ? '0, 132, 206' : '0, 168, 89'}, ${opacity})`;
          }

          ctx.beginPath();
          ctx.arc(x, y, currentDotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const tick = () => {
      drawFrame();
      if (!prefersReducedMotion && document.visibilityState === 'visible') {
        time += speed;
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    const handleVisibility = () => {
      cancelAnimationFrame(animationFrameId);
      if (document.visibilityState === 'visible') {
        tick();
      }
    };

    handleResize();
    tick();
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(animationFrameId);
    };
  }, [dotSize, spacing, speed, isDark]);

  return (
    <canvas
      ref={canvasRef}
      className={`sgh-thinking-dots ${className}`.trim()}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
};

export default ThinkingDots;
