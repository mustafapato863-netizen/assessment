import { useEffect, useRef } from 'react';

export type AtmosphereVariant = 'auth' | 'dashboard' | 'workspace';

interface AtmosphericBackgroundProps {
  className?: string;
  variant?: AtmosphereVariant;
}

/**
 * AtmosphericBackground - A restrained, CSS-only ambient canvas with drifting radial gradients.
 */
export function AtmosphericBackground({
  className = '',
  variant = 'auth',
}: AtmosphericBackgroundProps) {
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateVisibility = () => {
      if (backgroundRef.current) {
        backgroundRef.current.dataset.paused = String(document.visibilityState !== 'visible');
      }
    };

    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  return (
    <div
      ref={backgroundRef}
      className={`sgh-atmosphere pointer-events-none fixed inset-0 select-none ${className}`.trim()}
      data-variant={variant}
      aria-hidden="true"
    />
  );
}

export default AtmosphericBackground;
