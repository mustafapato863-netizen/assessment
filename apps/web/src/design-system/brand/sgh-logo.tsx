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
    <div className={['sgh-heart-icon', className].filter(Boolean).join(' ')}>
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
  void brandName;
  const sizeMap = {
    xs: { icon: 24, titleClass: 'sgh-logo-title--xs', subClass: 'sgh-logo-sub--xs' },
    sm: { icon: 30, titleClass: 'sgh-logo-title--sm', subClass: 'sgh-logo-sub--sm' },
    md: { icon: 38, titleClass: 'sgh-logo-title--md', subClass: 'sgh-logo-sub--md' },
    lg: { icon: 48, titleClass: 'sgh-logo-title--lg', subClass: 'sgh-logo-sub--lg' },
    xl: { icon: 64, titleClass: 'sgh-logo-title--xl', subClass: 'sgh-logo-sub--xl' },
  }[size];

  if (variant === 'icon-only') {
    return <SghHeartIcon size={sizeMap.icon} className={className} />;
  }

  if (variant === 'full') {
    return (
      <div className={['sgh-logo-full', className].filter(Boolean).join(' ')}>
        <SghHeartIcon size={sizeMap.icon * 1.3} glow={true} className="sgh-logo-full__icon" />
        <div className="sgh-logo-horiz__copy">
          <span
            className={`sgh-logo-title ${sizeMap.titleClass}`}
            style={{ color: 'var(--color-ink-950, #0f172a)' }}
          >
            Saudi German <span style={{ color: '#00A3E0' }}>Health</span>
          </span>
          {showSubtitle && (
            <span
              className={`sgh-logo-sub ${sizeMap.subClass}`}
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
    <div className={['sgh-logo-horiz', className].filter(Boolean).join(' ')}>
      <SghHeartIcon size={sizeMap.icon} glow={false} />
      <div className="sgh-logo-horiz__copy">
        <div
          className={`sgh-logo-title ${sizeMap.titleClass}`}
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
            className={`sgh-logo-sub ${sizeMap.subClass}`}
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
