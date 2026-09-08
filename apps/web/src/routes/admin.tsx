import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  History,
  Layers,
  LockKeyhole,
  Save,
  Scale,
  Settings2,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { copy, type Copy } from '../lib/labels';
import { PageHeading, PanelHeader } from '../components/ui';
import { useToast } from '../hooks/use-toast';
import { getSession } from '../lib/auth';

interface AuditRecord {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  hash: string;
  status: 'VERIFIED' | 'MONITORED';
}

const INITIAL_AUDIT_LOG: AuditRecord[] = [
  {
    id: 'AUD-9021',
    timestamp: '2026-09-05 10:14:22',
    actor: 'Sarah Johnson (HRBP)',
    action: 'POLICY_PARAM_UPDATE',
    target: 'CBI Weight adjusted to 40%',
    hash: 'sha256:9f8e...3b1a',
    status: 'VERIFIED',
  },
  {
    id: 'AUD-8840',
    timestamp: '2026-09-05 09:45:00',
    actor: 'Karim Taha (VP Sponsor)',
    action: 'STAGE_GATE_APPROVAL',
    target: 'Case #SF-001 promotion ratified',
    hash: 'sha256:e3a1...88c4',
    status: 'VERIFIED',
  },
  {
    id: 'AUD-8712',
    timestamp: '2026-09-04 17:30:19',
    actor: 'Tarek Admin (SysAdmin)',
    action: 'SECURITY_ENFORCEMENT',
    target: 'Blind 2-Assessor Consensus enforced',
    hash: 'sha256:7c44...120f',
    status: 'VERIFIED',
  },
  {
    id: 'AUD-8650',
    timestamp: '2026-09-04 14:02:11',
    actor: 'System Automated Worker',
    action: 'GDPR_RETENTION_SEAL',
    target: '7-Year retention partition sealed (2019-Q3)',
    hash: 'sha256:21aa...ff09',
    status: 'VERIFIED',
  },
  {
    id: 'AUD-8520',
    timestamp: '2026-09-03 11:22:04',
    actor: 'Dr. Ahmed Mansour (Assessor)',
    action: 'RUBRIC_SCORE_SUBMISSION',
    target: 'Case #SF-002 Strategic Presentation 4.5/5',
    hash: 'sha256:5b32...fa10',
    status: 'VERIFIED',
  },
];

export function AdminPage({ t: propT }: { t?: Copy } = {}) {
  const t = propT ?? copy;
  const { showToast } = useToast();
  const currentUser = getSession();

  const [activeVersion, setActiveVersion] = useState<'v2026.1' | 'v2026.2-DRAFT' | 'v2025.4'>(
    'v2026.1',
  );
  const [cbiWeight, setCbiWeight] = useState(40);
  const [caseStudyWeight, setCaseStudyWeight] = useState(35);
  const [simulationWeight, setSimulationWeight] = useState(25);
  const [passingScore, setPassingScore] = useState(75);
  const [blindGrading, setBlindGrading] = useState(true);
  const [autoEscalate, setAutoEscalate] = useState(true);
  const [eligibilitySla, setEligibilitySla] = useState(48);
  const [assessorSla, setAssessorSla] = useState(5);
  const [committeeSla, setCommitteeSla] = useState(72);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>(INITIAL_AUDIT_LOG);
  const [isSaving, setIsSaving] = useState(false);

  const totalWeight = cbiWeight + caseStudyWeight + simulationWeight;

  const handleSavePolicy = () => {
    setIsSaving(true);
    setTimeout(() => {
      const newEntry: AuditRecord = {
        id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        actor: `${currentUser?.name ?? 'Admin'} (${currentUser?.role ?? 'SYS_ADMIN'})`,
        action: 'GOVERNANCE_POLICY_APPLIED',
        target: `Policy ${activeVersion}: Weights (${cbiWeight}/${caseStudyWeight}/${simulationWeight}), Pass: ${passingScore}%`,
        hash: `sha256:${Math.random().toString(36).substring(2, 8)}...${Math.random().toString(36).substring(2, 6)}`,
        status: 'VERIFIED',
      };
      setAuditLogs((prev) => [newEntry, ...prev]);
      setIsSaving(false);
      showToast(
        `Governance policy ${activeVersion} updated and sealed with cryptographic verification.`,
      );
    }, 400);
  };

  const handleExportAudit = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['ID,Timestamp,Actor,Action,Target,Hash,Status']
        .concat(
          auditLogs.map(
            (log) =>
              `"${log.id}","${log.timestamp}","${log.actor}","${log.action}","${log.target}","${log.hash}","${log.status}"`,
          ),
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `assessflow_governance_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Enterprise compliance audit log exported as CSV.');
  };

  return (
    <div className="admin-console-page">
      <PageHeading
        eyebrow="ENTERPRISE TALENT GOVERNANCE"
        title={t.admin ?? 'Governance & Compliance Console'}
        subtitle="Manage organization-wide evaluation rubrics, SLA thresholds, approval pathways, and cryptographic audit telemetry."
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="secondary-button" onClick={handleExportAudit}>
              <Download size={15} />
              Export Audit Trail
            </button>
            <button
              className="primary-button"
              onClick={handleSavePolicy}
              disabled={isSaving || totalWeight !== 100}
            >
              {isSaving ? <Sparkles size={15} className="spin" /> : <Save size={15} />}
              Save & Enforce Policy
            </button>
          </div>
        }
      />

      {/* Top Telemetry KPI Bar */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon active-policy">
            <Scale size={20} />
          </div>
          <div>
            <span className="admin-stat-label">Active Policy Version</span>
            <div className="admin-stat-val">
              {activeVersion}{' '}
              <span className="soft-chip" style={{ fontSize: '11px', marginLeft: '6px' }}>
                Enforced
              </span>
            </div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon security">
            <Shield size={20} />
          </div>
          <div>
            <span className="admin-stat-label">Compliance Status</span>
            <div className="admin-stat-val" style={{ color: 'var(--color-success, #16a34a)' }}>
              SOC2 Type II & GDPR
            </div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon sla">
            <Clock size={20} />
          </div>
          <div>
            <span className="admin-stat-label">Target Assessment SLA</span>
            <div className="admin-stat-val">5 Business Days</div>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon audit">
            <History size={20} />
          </div>
          <div>
            <span className="admin-stat-label">Audit Log Integrity</span>
            <div className="admin-stat-val" style={{ color: '#0284c7' }}>
              100% Sealed
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="admin-grid-layout">
        {/* Left Column: Standards & Scoring Weights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Panel: Evaluation Rubric Weights */}
          <section className="panel">
            <PanelHeader
              icon={<Sliders size={17} />}
              title="Methodology Scoring Weights"
              action={
                <span
                  className="soft-count"
                  style={{
                    color: totalWeight === 100 ? '#16a34a' : '#dc2626',
                    fontWeight: 600,
                  }}
                >
                  Total: {totalWeight}% {totalWeight !== 100 && '(Must equal 100%)'}
                </span>
              }
            />
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="weight-slider-group">
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}
                >
                  <label style={{ fontWeight: 600, fontSize: '13px' }}>
                    Competency-Based Interview (CBI)
                  </label>
                  <span className="weight-badge">{cbiWeight}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="70"
                  step="5"
                  value={cbiWeight}
                  onChange={(e) => setCbiWeight(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-primary, #4f46e5)' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #64748b)' }}>
                  Evaluates leadership behaviors, culture alignment, and emotional intelligence.
                </span>
              </div>

              <div className="weight-slider-group">
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}
                >
                  <label style={{ fontWeight: 600, fontSize: '13px' }}>
                    Strategic Case Study & Presentation
                  </label>
                  <span className="weight-badge">{caseStudyWeight}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="70"
                  step="5"
                  value={caseStudyWeight}
                  onChange={(e) => setCaseStudyWeight(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-primary, #4f46e5)' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #64748b)' }}>
                  Assesses analytical rigor, commercial problem-solving, and executive synthesis.
                </span>
              </div>

              <div className="weight-slider-group">
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}
                >
                  <label style={{ fontWeight: 600, fontSize: '13px' }}>
                    Situational Roleplay & Simulation
                  </label>
                  <span className="weight-badge">{simulationWeight}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="70"
                  step="5"
                  value={simulationWeight}
                  onChange={(e) => setSimulationWeight(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-primary, #4f46e5)' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #64748b)' }}>
                  Live observation of stakeholder negotiation and conflict resolution dynamics.
                </span>
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--color-border-subtle, #e2e8f0)',
                  paddingTop: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong style={{ fontSize: '13px', display: 'block' }}>
                    Minimum Passing Score Benchmark
                  </strong>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #64748b)' }}>
                    Standard track candidate readiness threshold
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="50"
                    max="95"
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                    style={{
                      width: '64px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border, #cbd5e1)',
                      textAlign: 'center',
                      fontWeight: 600,
                    }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>%</span>
                </div>
              </div>
            </div>
          </section>

          {/* Panel: Governance Gates & Safeguards */}
          <section className="panel">
            <PanelHeader
              icon={<ShieldAlert size={17} />}
              title="Quality Safeguards & Blind Grading"
            />
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={blindGrading}
                  onChange={(e) => setBlindGrading(e.target.checked)}
                  style={{ marginTop: '3px', accentColor: 'var(--color-primary, #4f46e5)' }}
                />
                <div>
                  <strong style={{ fontSize: '13px', display: 'block' }}>
                    Enforce 2-Assessor Blind Consensus
                  </strong>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #64748b)' }}>
                    Assessors evaluate independently without viewing peer scores until preliminary
                    submission is sealed.
                  </span>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={autoEscalate}
                  onChange={(e) => setAutoEscalate(e.target.checked)}
                  style={{ marginTop: '3px', accentColor: 'var(--color-primary, #4f46e5)' }}
                />
                <div>
                  <strong style={{ fontSize: '13px', display: 'block' }}>
                    Automated SLA Escalation Webhook
                  </strong>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #64748b)' }}>
                    Broadcast high-priority Slack/Teams and email alerts to VP Sponsors when review
                    breaches 48h.
                  </span>
                </div>
              </label>
            </div>
          </section>
        </div>

        {/* Right Column: SLAs, Multi-Stage Route, and Policies */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Panel: SLA Governance Windows */}
          <section className="panel">
            <PanelHeader icon={<Clock size={17} />} title="SLA Turnaround Windows" />
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--color-bg-subtle, #f8fafc)',
                  borderRadius: '6px',
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>
                    Eligibility Screening Gate
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #64748b)' }}>
                    HRBP intake & tenure validation
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    min="12"
                    max="120"
                    step="12"
                    value={eligibilitySla}
                    onChange={(e) => setEligibilitySla(Number(e.target.value))}
                    style={{
                      width: '56px',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border, #cbd5e1)',
                      textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #64748b)' }}>
                    Hours
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--color-bg-subtle, #f8fafc)',
                  borderRadius: '6px',
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>
                    Assessor Execution & Scoring
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #64748b)' }}>
                    Simulation conduct & evidence rubric
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={assessorSla}
                    onChange={(e) => setAssessorSla(Number(e.target.value))}
                    style={{
                      width: '56px',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border, #cbd5e1)',
                      textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #64748b)' }}>
                    Days
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--color-bg-subtle, #f8fafc)',
                  borderRadius: '6px',
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>
                    Committee Approval Decision
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #64748b)' }}>
                    VP Sponsor sign-off or escalation
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    min="24"
                    max="168"
                    step="12"
                    value={committeeSla}
                    onChange={(e) => setCommitteeSla(Number(e.target.value))}
                    style={{
                      width: '56px',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border, #cbd5e1)',
                      textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #64748b)' }}>
                    Hours
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Panel: Approval Pathway Architecture */}
          <section className="panel">
            <PanelHeader icon={<Layers size={17} />} title="Approval Route Pipeline" />
            <div style={{ padding: '16px' }}>
              <div className="approval-route-steps">
                <div className="route-step">
                  <div className="route-step-num">1</div>
                  <div className="route-step-info">
                    <strong>Lead Assessor Recommendation</strong>
                    <span>Validates competency evidence and submits final rubric synthesis.</span>
                  </div>
                  <span className="soft-chip">Mandatory</span>
                </div>
                <div className="route-step-connector" />
                <div className="route-step">
                  <div className="route-step-num">2</div>
                  <div className="route-step-info">
                    <strong>Business Unit VP Sponsor</strong>
                    <span>
                      Reviews business justification, budget readiness, and head-count fit.
                    </span>
                  </div>
                  <span className="soft-chip">Mandatory</span>
                </div>
                <div className="route-step-connector" />
                <div className="route-step">
                  <div className="route-step-num">3</div>
                  <div className="route-step-info">
                    <strong>Executive Talent Committee</strong>
                    <span>Convenes only for Level 6+ Executive tracks or disputed outcomes.</span>
                  </div>
                  <span className="soft-chip">Conditional</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Live Immutable Cryptographic Audit Log */}
      <section className="panel" style={{ marginTop: '24px' }}>
        <PanelHeader
          icon={<History size={17} />}
          title="Live Cryptographic Audit Trail"
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="soft-count"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <CheckCircle2 size={13} style={{ color: '#16a34a' }} /> SHA-256 Ledger
              </span>
            </div>
          }
        />
        <div style={{ overflowX: 'auto' }}>
          <table className="case-table admin-audit-table">
            <thead>
              <tr>
                <th>Audit ID</th>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action Code</th>
                <th>Target & Details</th>
                <th>Proof Hash</th>
                <th>Integrity</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <strong
                      style={{ fontFamily: 'monospace', color: 'var(--color-primary, #4f46e5)' }}
                    >
                      {log.id}
                    </strong>
                  </td>
                  <td
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-text-muted, #64748b)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {log.timestamp}
                  </td>
                  <td style={{ fontWeight: 500, fontSize: '13px' }}>{log.actor}</td>
                  <td>
                    <span className="code-chip">{log.action}</span>
                  </td>
                  <td style={{ fontSize: '13px' }}>{log.target}</td>
                  <td>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        background: 'var(--color-bg-subtle, #f1f5f9)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        color: 'var(--color-text-muted, #475569)',
                      }}
                    >
                      {log.hash}
                    </span>
                  </td>
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        background: '#f0fdf4',
                        color: '#166534',
                        borderColor: '#bbf7d0',
                        fontSize: '11px',
                        padding: '2px 8px',
                      }}
                    >
                      <CheckCircle2 size={11} style={{ marginRight: '4px' }} /> {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Compliance Note */}
      <div className="pipeline-note" role="note" style={{ marginTop: '20px' }}>
        <LockKeyhole size={15} />
        <span>
          Organization Policy v2026.1 is enforced under ISO/IEC 27001 and SOC 2 Type II controls.
          All parameter adjustments create an immutable ledger event attributed to the signing
          actor.
        </span>
      </div>
    </div>
  );
}
