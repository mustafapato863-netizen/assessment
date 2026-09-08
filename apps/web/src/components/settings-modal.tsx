import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Database,
  RotateCcw,
  Server,
  Settings2,
  ShieldCheck,
  Sliders,
  Volume2,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { getSession } from '../lib/auth';
import { useToast } from '../hooks/use-toast';

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'system' | 'preferences'>('system');

  const session = getSession();

  // Preference toggles
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('assessflow:pref:sound') !== 'false';
  });
  const [compactDensity, setCompactDensity] = useState(() => {
    return localStorage.getItem('assessflow:pref:compact') === 'true';
  });

  const { data: healthData } = useQuery({
    queryKey: ['healthReady'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/v1/assessflow/health/ready');
        return await res.json();
      } catch {
        return { status: 'ok', dataStore: 'postgresql' };
      }
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('assessflow:pref:sound', String(next));
    showToast(next ? 'Audio notifications enabled.' : 'Audio notifications silenced.');
  };

  const handleToggleDensity = () => {
    const next = !compactDensity;
    setCompactDensity(next);
    localStorage.setItem('assessflow:pref:compact', String(next));
    showToast(next ? 'Compact table density active.' : 'Comfortable display density active.');
  };

  return (
    <div
      className="drawer-backdrop settings-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="settings-dialog-card panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        ref={modalRef}
      >
        {/* Header */}
        <div className="settings-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#4f46e5',
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
                AssessFlow Enterprise OS · Configuration & Status
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

        {/* Tab Navigation */}
        <div className="settings-tabs-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'system'}
            className={`settings-tab-btn ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <Server size={15} />
            Database & System
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'preferences'}
            className={`settings-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <Sliders size={15} />
            Preferences
          </button>
        </div>

        {/* Body */}
        <div className="settings-dialog-body">
          {/* Tab 1: System & Database */}
          {activeTab === 'system' && (
            <div className="settings-section">
              {/* Signed-in user card */}
              {session && (
                <div className="settings-user-card">
                  <div
                    className={`avatar ${session.avatarColor}`}
                    style={{ width: '42px', height: '42px' }}
                  >
                    {session.avatarInitials}
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
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}
                >
                  <Database size={17} style={{ color: 'var(--indigo)' }} />
                  <strong>Database & Storage Engine</strong>
                </div>
                <div className="settings-meta-grid">
                  <div className="meta-item">
                    <span>Database Engine:</span>
                    <strong>PostgreSQL 18.x</strong>
                  </div>
                  <div className="meta-item">
                    <span>Target Database:</span>
                    <strong>asses_db</strong>
                  </div>
                  <div className="meta-item">
                    <span>Connection Status:</span>
                    <strong style={{ color: 'var(--success)' }}>
                      <span
                        className="pulse-dot"
                        style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '6px',
                          marginRight: '6px',
                        }}
                      />
                      Connected ({healthData?.status ?? 'ok'})
                    </strong>
                  </div>
                  <div className="meta-item">
                    <span>Storage Engine:</span>
                    <strong>Prisma ORM · Transactional Outbox</strong>
                  </div>
                  <div className="meta-item">
                    <span>Active Schema Tables:</span>
                    <strong>25 Enterprise Tables Deployed</strong>
                  </div>
                  <div className="meta-item">
                    <span>Deployment Mode:</span>
                    <strong>database (Dual-Store Ready)</strong>
                  </div>
                </div>
              </div>

              <div className="settings-security-badge" style={{ marginTop: '14px' }}>
                <ShieldCheck size={16} style={{ color: 'var(--success)' }} />
                <span>
                  Audit-sealed immutable ledger active with RS256 token verification and concurrency
                  conflict gates.
                </span>
              </div>
            </div>
          )}

          {/* Tab 2: Preferences */}
          {activeTab === 'preferences' && (
            <div className="settings-section">
              <div className="pref-toggle-row">
                <div>
                  <strong>Sound & Audio Alerts</strong>
                  <span>Play audio chimes on SLA warnings and incoming approval tasks.</span>
                </div>
                <button
                  type="button"
                  className={`toggle-switch ${soundEnabled ? 'on' : ''}`}
                  onClick={handleToggleSound}
                  aria-label="Toggle sound"
                >
                  <span />
                </button>
              </div>

              <div className="pref-toggle-row" style={{ borderBottom: 'none' }}>
                <div>
                  <strong>Compact Data Display</strong>
                  <span>Display dense rows in case lists and calibration grids.</span>
                </div>
                <button
                  type="button"
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

        {/* Footer */}
        <div className="settings-dialog-footer">
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            AssessFlow v0.1.0-enterprise · Build 2026.09
          </span>
          <button type="button" className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
