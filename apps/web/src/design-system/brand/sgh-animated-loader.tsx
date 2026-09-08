import * as React from 'react';
import { SghHeartSvg } from './sgh-heart-svg';

export interface SghAnimatedLoaderProps {
  fullScreen?: boolean;
  onComplete?: () => void;
  durationMs?: number;
  textSequence?: string;
  subtitle?: string;
  className?: string;
  isDark?: boolean;
}

export function SghAnimatedLoader({
  fullScreen = true,
  onComplete,
  durationMs = 2000,
  textSequence = 'Saudi German Health',
  subtitle = 'Authenticating & Loading Assessment Workspace...',
  className = '',
}: SghAnimatedLoaderProps) {
  const [displayText, setDisplayText] = React.useState('');
  const [progress, setProgress] = React.useState(0);
  const [isFinished, setIsFinished] = React.useState(false);

  React.useEffect(() => {
    let frameId: number;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);

      // Typewriter calculation
      const textProgress = Math.min(1, elapsed / (durationMs * 0.75));
      const charCount = Math.floor(textProgress * textSequence.length);
      setDisplayText(textSequence.slice(0, charCount));

      if (elapsed < durationMs) {
        frameId = requestAnimationFrame(animate);
      } else {
        setDisplayText(textSequence);
        setProgress(100);
        setIsFinished(true);
        if (onComplete) {
          setTimeout(onComplete, 300);
        }
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [durationMs, textSequence, onComplete]);

  const loaderContent = (
    <div
      className={`sgh-loader-card ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label="Authenticating session"
    >
      {/* 1. Animated Dual-Wing SGH Heart Emblem with Glowing Ring */}
      <div
        className="relative mb-7 flex items-center justify-center"
        style={{ position: 'relative', marginBottom: '24px' }}
      >
        {/* Ambient Halo Glow */}
        <div
          style={{
            position: 'absolute',
            inset: '-28px',
            borderRadius: '50%',
            pointerEvents: 'none',
            background:
              'radial-gradient(circle, rgba(0, 163, 224, 0.45) 0%, rgba(0, 168, 89, 0.35) 45%, transparent 75%)',
            filter: 'blur(28px)',
            animation: 'sghHaloPulse 2.4s ease-in-out infinite',
          }}
        />

        {/* Floating Heart Icon */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            animation: 'sghFloat 3s ease-in-out infinite',
            filter: 'drop-shadow(0 14px 32px rgba(0, 163, 224, 0.4))',
          }}
        >
          <SghHeartSvg size={120} glow={true} />
        </div>
      </div>

      {/* 2. Storyboard Typewriter Text: "Saudi German Health" */}
      <div
        style={{
          minHeight: '40px',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <h2 className="sgh-loader-title">
          <span>{displayText}</span>
          {!isFinished && (
            <span
              style={{
                display: 'inline-block',
                width: '4px',
                height: '28px',
                borderRadius: '999px',
                marginLeft: '4px',
                backgroundColor: '#38bdf8',
                animation: 'sghCursorBlink 0.8s infinite',
              }}
            />
          )}
        </h2>
      </div>

      {/* Subtitle */}
      {subtitle && <p className="sgh-loader-subtitle">{subtitle}</p>}

      {/* 3. Multi-stop SGH Gradient Progress Bar */}
      <div className="sgh-loader-progress-wrap">
        <div className="sgh-loader-bar-bg">
          <div className="sgh-loader-bar-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="sgh-loader-meta-row">
          <span className="sgh-loader-ping-wrap">
            <span
              style={{ position: 'relative', display: 'inline-flex', width: '8px', height: '8px' }}
            >
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  opacity: 0.75,
                  backgroundColor: '#00A3E0',
                  animation: 'sghPing 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                }}
              />
              <span
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  borderRadius: '50%',
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#00A3E0',
                }}
              />
            </span>
            Initializing Services
          </span>
          <span className="sgh-loader-pct">{progress}%</span>
        </div>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="sgh-loader-fullscreen-overlay">
        <div className="sgh-loader-spotlight" />
        {loaderContent}
      </div>
    );
  }

  return loaderContent;
}

export default SghAnimatedLoader;
