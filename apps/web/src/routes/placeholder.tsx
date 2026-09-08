import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { copy, type Copy } from '../lib/labels';
import { PanelHeader } from '../components/ui';

export function CalibrationPage({ t: propT }: { t?: Copy } = {}) {
  const t = propT ?? copy;

  return (
    <div className="panel" role="region" aria-label={t.calibration}>
      <PanelHeader
        icon={<Sparkles size={17} />}
        title={t.calibration}
        action={<span className="soft-count">Phase 2 Preview</span>}
      />
      <div className="empty-state" style={{ padding: '48px 16px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted, #64748b)', margin: 0 }}>
          Calibration workspace is enabled via feature flag (UX-18). Cross-department outcome
          balancing is scheduled for Phase 2.
        </p>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="empty-page panel">
      <div className="empty-icon">
        <Sparkles size={24} />
      </div>
      <span className="eyebrow">404 NOT FOUND</span>
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist or has been moved.</p>
      <button className="primary-button" onClick={() => navigate('/')}>
        <ArrowLeft size={16} />
        Back to home
      </button>
    </div>
  );
}
