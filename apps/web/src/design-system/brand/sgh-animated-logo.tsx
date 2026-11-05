import * as React from 'react';
import { SghHeartSvg } from './sgh-heart-svg';

export interface SghAnimatedLogoProps {
  size?: number;
  showText?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function SghAnimatedLogo({
  size = 56,
  showText = false,
  title = 'AssessFlow',
  subtitle = 'Saudi German Health',
  className = '',
}: SghAnimatedLogoProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      className={['sgh-animated-logo-root', 'sgh-anim-logo', className].filter(Boolean).join(' ')}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Interactive Animated Vector Emblem */}
      <div className="sgh-anim-logo__mark" style={{ width: size * 1.25, height: size * 1.15 }}>
        {/* Pulsing Cyan / Emerald Ambient Glow Halo */}
        <div
          className={`sgh-logo-halo sgh-anim-logo__halo ${isHovered ? 'is-hovered' : ''}`.trim()}
        />

        {/* Floating Heart with Spring Hover Effect */}
        <div
          className={`sgh-anim-logo__heart ${isHovered ? 'is-hovered' : ''}`.trim()}
          style={{
            animation: 'sghFloat 3.2s ease-in-out infinite',
            filter: 'drop-shadow(0 8px 20px rgba(0, 163, 224, 0.35))',
          }}
        >
          <SghHeartSvg size={size} glow={true} />
        </div>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="sgh-anim-logo__copy">
          <div className="sgh-anim-logo__title">
            <span>{title}</span>
          </div>
          {subtitle && <p className="sgh-anim-logo__subtitle">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}

export default SghAnimatedLogo;
