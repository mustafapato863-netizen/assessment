import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Database,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Sliders,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { getSession } from '../lib/auth';
import { initials } from '../lib/format';
import { queryKeys } from '../lib/query-keys';
import { useFocusTrap } from '../hooks/use-focus-trap';
import { useToast } from '../hooks/use-toast';

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'system' | 'preferences'>('system');
  const session = getSession();

  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('assessflow:pref:sound') !== 'false';
    } catch {
      return true;
    }
  });
  const [compactDensity, setCompactDensity] = useState(() => {
    try {
      return (
        localStorage.getItem('assessflow:density') === 'compact' ||
        localStorage.getItem('assessflow:pref:compact') === 'true'
      );
    } catch {
      return false;
    }
  });

  useFocusTrap(isOpen, modalRef, onClose);

  const {
    data: healthData,
    isLoading: healthLoading,
    isError: healthError,
    refetch: refetchHealth,
    isFetching: healthFetching,
  } = useQuery({
    queryKey: queryKeys.healthReady(),
    queryFn: () => api.healthReady(),
    enabled: isOpen,
    retry: false,
    staleTime: 10_000,
  });

  if (!isOpen) return null;

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem('assessflow:pref:sound', String(next));
    } catch {
      // ignore storage errors
    }
    showToast(next ? 'Audio alerts enabled.' : 'Audio alerts silenced.', 'info');
  };

  const handleToggleDensity = () => {
    const next = !compactDensity;
    setCompactDensity(next);
    const mode = next ? 'compact' : 'comfortable';
    document.documentElement.dataset.density = mode;
    try {
      localStorage.setItem('assessflow:density', mode);
      localStorage.setItem('assessflow:pref:compact', String(next));
    } catch {
      // ignore storage errors
    }
    showToast(
      next ? 'Compact table density active.' : 'Comfortable display density active.',
      'info',
    );
  };

  const isHealthy = !healthError && (healthData?.status === 'ok' || healthData?.status === 'ready');

  return (
    <div
      className="drawer-backdrop settings-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="settings-dialog-card panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        ref={modalRef}
      >
        <div className="settings-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'var(--sgh-gradient-brand)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Settings2 size={18} />
            </div>
            <div>
              <h3
                id="settings-dialog-title"
                style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}
              >
                System & Workspace Settings
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                AssessFlow Enterprise · Live Health & Preferences
              </span>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings-tabs-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'system'}
            className={`settings-tab-btn ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <Server size={15} />
            System Health
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'preferences'}
            className={`settings-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <Sliders size={15} />
            Display Preferences
          </button>
        </div>

        <div className="settings-dialog-body">
          {activeTab === 'system' && (
            <div className="settings-section">
              {session && (
                <div className="settings-user-card">
                  <div
                    className={`avatar ${session.avatarColor}`}
                    style={{ width: 42, height: 42 }}
                  >
                    {session.avatarInitials || initials(session.name)}
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '14px' }}>{session.name}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {session.email} · {session.roleTitle}
                    </span>
                  </div>
                </div>
              )}

              <div className="settings-info-box" style={{ marginTop: '14px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={17} style={{ color: 'var(--primary)' }} />
                    <strong>API & Data Store Telemetry</strong>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ minHeight: 30, padding: '0 10px', fontSize: 12 }}
                    onClick={() => void refetchHealth()}
                    disabled={healthFetching}
                  >
                    <RefreshCw size={12} className={healthFetching ? 'spin' : undefined} />
                    Probe
                  </button>
                </div>

                <div className="settings-meta-grid">
                  <div className="meta-item">
                    <span>Readiness Status</span>
                    {healthLoading ? (
                      <strong>Checking…</strong>
                    ) : isHealthy ? (
                      <strong style={{ color: 'var(--success)' }}>
                        <span
                          className="pulse-dot"
                          style={{
                            display: 'inline-block',
                            width: '7px',
                            height: '7px',
                            marginRight: '6px',
                          }}
                        />
                        Healthy ({healthData?.status})
                      </strong>
                    ) : (
                      <strong style={{ color: 'var(--danger)' }}>
                        <AlertTriangle
                          size={13}
                          style={{ verticalAlign: 'middle', marginRight: 5 }}
                        />
                        Degraded / Unreachable
                      </strong>
                    )}
                  </div>
                  <div className="meta-item">
                    <span>Data Store</span>
                    <strong>{healthData?.dataStore ?? 'unavailable'}</strong>
                  </div>
                  <div className="meta-item">
                    <span>Service / Release</span>
                    <strong>
                      {healthData?.service ?? 'assessflow-api'}
                      {healthData?.version ? ` · v${healthData.version}` : ''}
                    </strong>
                  </div>
                  <div className="meta-item">
                    <span>DB Probe Latency</span>
                    <strong>
                      {typeof healthData?.latencyMs === 'number'
                        ? `${healthData.latencyMs} ms`
                        : '—'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="settings-security-badge" style={{ marginTop: '14px' }}>
                <ShieldCheck size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span>
                  Audit ledger active with HMAC/Entra JWT verification and optimistic version
                  conflict locks.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="settings-section">
              <div className="pref-toggle-row">
                <div>
                  <strong>Sound & Audio Alerts</strong>
                  <span>Play subtle alerts for incoming approval actions and warnings.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={soundEnabled}
                  className={`toggle-switch ${soundEnabled ? 'on' : ''}`}
                  onClick={handleToggleSound}
                  aria-label="Toggle sound"
                >
                  <span />
                </button>
              </div>

              <div className="pref-toggle-row" style={{ borderBottom: 'none' }}>
                <div>
                  <strong>Compact Table Density</strong>
                  <span>Condense table rows and cards across directories and matrices.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={compactDensity}
                  className={`toggle-switch ${compactDensity ? 'on' : ''}`}
                  onClick={handleToggleDensity}
                  aria-label="Toggle compact density"
                >
                  <span />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="settings-dialog-footer">
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            SGH AssessFlow Workspace v3
          </span>
          <button type="button" className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
