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
      className={`sgh-animated-logo-root flex items-center gap-3.5 select-none ${className}`.trim()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Interactive Animated Vector Emblem */}
      <div
        className="relative flex items-center justify-center p-1.5"
        style={{ width: size * 1.25, height: size * 1.15 }}
      >
        {/* Pulsing Cyan / Emerald Ambient Glow Halo */}
        <div
          className={`sgh-logo-halo absolute inset-0 rounded-full pointer-events-none transition-all duration-500 ${
            isHovered ? 'scale-125 opacity-80' : 'scale-105 opacity-50'
          }`}
          style={{
            background:
              'radial-gradient(circle, rgba(0, 163, 224, 0.4) 0%, rgba(0, 168, 89, 0.25) 50%, transparent 70%)',
            filter: 'blur(16px)',
          }}
        />

        {/* Floating Heart with Spring Hover Effect */}
        <div
          className={`relative z-10 cursor-pointer transition-transform duration-300 ${
            isHovered ? 'scale-110 -translate-y-1' : 'hover:scale-105'
          }`}
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
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 font-extrabold tracking-tight text-xl leading-tight">
            <span>{title}</span>
          </div>
          {subtitle && (
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#00A3E0] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default SghAnimatedLogo;
