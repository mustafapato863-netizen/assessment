import { SghHeartSvg } from './sgh-heart-svg';

export interface SghLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon-only' | 'horizontal';
  showSubtitle?: boolean;
  className?: string;
  brandName?: string;
  subtitle?: string;
}

export function SghHeartIcon({
  size = 36,
  className = '',
  glow = false,
}: {
  size?: number;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`.trim()}
    >
      <SghHeartSvg size={size} glow={glow} />
    </div>
  );
}

export function SghLogo({
  size = 'md',
  variant = 'horizontal',
  showSubtitle = true,
  className = '',
  brandName = 'Saudi German Health',
  subtitle = 'Assessment & Talent Workflow',
}: SghLogoProps) {
  const sizeMap = {
    xs: { icon: 24, text: 'text-xs', sub: 'text-[9px]' },
    sm: { icon: 30, text: 'text-sm', sub: 'text-[10px]' },
    md: { icon: 38, text: 'text-base', sub: 'text-[11px]' },
    lg: { icon: 48, text: 'text-lg', sub: 'text-xs' },
    xl: { icon: 64, text: 'text-2xl', sub: 'text-sm' },
  }[size];

  if (variant === 'icon-only') {
    return <SghHeartIcon size={sizeMap.icon} className={className} />;
  }

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center text-center gap-2 ${className}`.trim()}>
        <SghHeartIcon size={sizeMap.icon * 1.3} glow={true} className="mb-1" />
        <div className="flex flex-col items-center">
          <span
            className={`font-extrabold tracking-tight leading-tight ${sizeMap.text}`}
            style={{ color: 'var(--color-ink-950, #0f172a)' }}
          >
            Saudi German <span style={{ color: '#00A3E0' }}>Health</span>
          </span>
          {showSubtitle && (
            <span
              className={`font-medium tracking-wide mt-0.5 ${sizeMap.sub}`}
              style={{ color: 'var(--color-ink-500, #64748b)' }}
            >
              {subtitle}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Horizontal Variant
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <SghHeartIcon size={sizeMap.icon} glow={false} />
      <div className="flex flex-col min-w-0">
        <div
          className={`font-extrabold tracking-tight leading-tight truncate ${sizeMap.text}`}
          style={{ color: 'var(--color-ink-950, #0f172a)' }}
        >
          Saudi German{' '}
          <span
            className="sgh-gradient-text"
            style={{
              background: 'linear-gradient(135deg, #00A3E0 0%, #00A859 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Health
          </span>
        </div>
        {showSubtitle && (
          <span
            className={`font-medium tracking-wide truncate ${sizeMap.sub}`}
            style={{ color: 'var(--color-ink-500, #64748b)' }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export default SghLogo;
