import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  Copy,
  Lightbulb,
  LoaderCircle,
  ShieldAlert,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { CopilotSynthesizeResponse } from '@assessflow/contracts';
import { api } from '../../lib/api';
import { InlineError, StatusBadge } from '../../components/ui';
import './ai-copilot-card.css';

export function AiCopilotCard({
  caseId,
  defaultTab = 'synthesis',
  currentEvidenceText,
  onApplySynthesis,
  onApplySanitizedText,
  onApplyAction,
}: {
  caseId: string;
  defaultTab?: 'synthesis' | 'bias' | 'actions';
  currentEvidenceText?: string;
  onApplySynthesis?: (synthesis: CopilotSynthesizeResponse) => void;
  onApplySanitizedText?: (cleanText: string) => void;
  onApplyAction?: (action: { title: string; description: string; targetWeeks: number }) => void;
}) {
  const [activeTab, setActiveTab] = useState<'synthesis' | 'bias' | 'actions'>(defaultTab);
  const [biasInputText, setBiasInputText] = useState(currentEvidenceText ?? '');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [appliedSynthesis, setAppliedSynthesis] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, caseId]);

  useEffect(() => {
    setBiasInputText(currentEvidenceText ?? '');
  }, [caseId, currentEvidenceText]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const synthesizeMutation = useMutation({
    mutationFn: () => api.copilotSynthesize(caseId),
    onSuccess: () => setAppliedSynthesis(false),
  });

  const biasCheckMutation = useMutation({
    mutationFn: (text: string) => api.copilotBiasCheck(caseId, { text }),
  });

  const actionsMutation = useMutation({
    mutationFn: () => api.copilotSuggestActions(caseId, { limit: 3 }),
  });

  const synthesis = synthesizeMutation.data;
  const biasResult = biasCheckMutation.data;
  const actionsResult = actionsMutation.data;

  return (
    <div className="panel ai-copilot-card copilot-card">
      <div className="copilot-header">
        <div className="copilot-brand">
          <div className="copilot-badge-icon" aria-hidden="true">
            <Sparkles size={16} />
          </div>
          <div>
            <h4>AssessFlow AI Assessor Copilot</h4>
            <span>Evidence Synthesis, Bias Radar & SMART Milestones</span>
          </div>
        </div>

        <div className="copilot-tabs" role="tablist" aria-label="AI Copilot modules">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'synthesis'}
            className={`copilot-tab ${activeTab === 'synthesis' ? 'active' : ''}`}
            onClick={() => setActiveTab('synthesis')}
          >
            Executive Synthesis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bias'}
            className={`copilot-tab ${activeTab === 'bias' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('bias');
              if (!biasInputText && currentEvidenceText) setBiasInputText(currentEvidenceText);
            }}
          >
            Bias Radar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'actions'}
            className={`copilot-tab ${activeTab === 'actions' ? 'active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            SMART Actions
          </button>
        </div>
      </div>

      <div className="copilot-body" role="tabpanel">
        {activeTab === 'synthesis' && (
          <>
            {!synthesis ? (
              <div className="copilot-empty">
                <p>
                  Analyze submitted assessor evidence and synthesize candidate readiness against
                  target role competencies.
                </p>
                <button
                  type="button"
                  className="primary-button"
                  disabled={synthesizeMutation.isPending}
                  onClick={() => synthesizeMutation.mutate()}
                >
                  {synthesizeMutation.isPending ? (
                    <>
                      <LoaderCircle size={15} className="spin" /> Synthesizing Evidence…
                    </>
                  ) : (
                    <>
                      <Wand2 size={15} /> Synthesize Assessment Evidence
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <div className="copilot-summary-box">
                  <div className="copilot-summary-top">
                    <span className="copilot-kicker">Executive Evaluation Synthesis</span>
                    <StatusBadge status={synthesis.suggestedOutcome} />
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>
                    {synthesis.executiveSummary}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                    <strong>Rationale:</strong> {synthesis.suggestedOutcomeRationale}
                  </p>
                </div>

                {synthesis.demonstratedStrengths.length > 0 && (
                  <div>
                    <strong style={{ fontSize: 12.5 }}>Demonstrated Competencies</strong>
                    <div className="copilot-grid">
                      {synthesis.demonstratedStrengths.map((str, idx) => (
                        <div key={idx} className="copilot-strength-item">
                          <div className="copilot-strength-head">
                            <span>{str.competency}</span>
                            <span>{Math.round(str.confidenceScore * 100)}%</span>
                          </div>
                          <p style={{ margin: '4px 0 0', color: 'var(--secondary)' }}>
                            {str.evidenceExcerpt}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {synthesis.identifiedGaps.length > 0 && (
                  <div>
                    <strong style={{ fontSize: 12.5 }}>Target Competency Gaps</strong>
                    <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                      {synthesis.identifiedGaps.map((gap, idx) => (
                        <div key={idx} className="copilot-gap-item">
                          <div className="copilot-gap-head">
                            <span>{gap.competency}</span>
                            <span className="soft-chip">{gap.severity}</span>
                          </div>
                          <p style={{ margin: '4px 0 0', color: '#78350f' }}>{gap.observation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="action-row" style={{ justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={synthesizeMutation.isPending}
                    onClick={() => synthesizeMutation.mutate()}
                  >
                    Re-generate
                  </button>
                  {onApplySynthesis && (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => {
                        onApplySynthesis(synthesis);
                        setAppliedSynthesis(true);
                      }}
                    >
                      <Check size={14} />
                      {appliedSynthesis ? 'Applied to Summary' : 'Apply to Result Summary'}
                    </button>
                  )}
                </div>
              </div>
            )}
            {synthesizeMutation.isError && <InlineError error={synthesizeMutation.error} />}
          </>
        )}

        {activeTab === 'bias' && (
          <>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>
              Scans assessor evaluations for non-behavioral adjectives, age bias, or coded phrasing.
            </p>
            <label className="field">
              <span>Assessment notes to scan</span>
              <textarea
                rows={3}
                placeholder="Paste assessor notes or feedback narrative to inspect…"
                value={biasInputText}
                onChange={(e) => setBiasInputText(e.target.value)}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="primary-button"
                disabled={biasCheckMutation.isPending || !biasInputText.trim()}
                onClick={() => biasCheckMutation.mutate(biasInputText)}
              >
                {biasCheckMutation.isPending ? (
                  <LoaderCircle size={14} className="spin" />
                ) : (
                  <ShieldAlert size={14} />
                )}
                Scan for Unconscious Bias
              </button>
            </div>
            {biasCheckMutation.isError && <InlineError error={biasCheckMutation.error} />}

            {biasResult && (
              <div style={{ display: 'grid', gap: 8 }}>
                {biasResult.clean ? (
                  <div className="settings-security-badge" role="status">
                    <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    <span>
                      <strong>Objective & Clean:</strong> No subjective bias indicators detected.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="inline-error" role="status">
                      <ShieldAlert size={16} />
                      <span>
                        <strong>Bias Alert ({biasResult.findingsCount} flagged):</strong> Consider
                        replacing subjective wording with behavioral observations.
                      </span>
                    </div>
                    {biasResult.warnings.map((w, idx) => (
                      <div key={idx} className="copilot-bias-warning">
                        <div className="copilot-summary-top">
                          <strong style={{ color: 'var(--danger)' }}>
                            &ldquo;{w.phrase}&rdquo;
                          </strong>
                          <span className="soft-chip">{w.category}</span>
                        </div>
                        <p style={{ margin: 0, color: 'var(--muted)' }}>{w.explanation}</p>
                        <div
                          style={{
                            background: 'var(--surface-subtle)',
                            padding: '6px 10px',
                            borderRadius: 6,
                          }}
                        >
                          <strong style={{ color: 'var(--success)' }}>
                            Objective alternative:{' '}
                          </strong>
                          <span>{w.objectiveAlternative}</span>
                        </div>
                      </div>
                    ))}
                    {biasResult.sanitizedSuggestion && onApplySanitizedText && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => onApplySanitizedText(biasResult.sanitizedSuggestion!)}
                        >
                          <Check size={14} />
                          Apply Sanitized Wording
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'actions' && (
          <>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>
              Generate targeted SMART development milestones aligned to observed competency gaps.
            </p>
            {!actionsResult ? (
              <div className="copilot-empty">
                <button
                  type="button"
                  className="primary-button"
                  disabled={actionsMutation.isPending}
                  onClick={() => actionsMutation.mutate()}
                >
                  {actionsMutation.isPending ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <Lightbulb size={15} />
                  )}
                  Suggest SMART Milestones
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {actionsResult.actions.map((act, idx) => (
                  <div key={idx} className="copilot-action-item">
                    <div className="copilot-action-head">
                      <strong style={{ fontSize: 13 }}>{act.title}</strong>
                      <span className="status-badge info">
                        {act.targetWeeks} Weeks · {act.category}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
                      {act.description}
                    </p>
                    <div className="copilot-action-foot">
                      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        <strong>Evidence:</strong> {act.suggestedEvidence}
                      </span>
                      {onApplyAction && (
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ minHeight: 32, padding: '0 10px', fontSize: 12 }}
                          onClick={() => {
                            onApplyAction(act);
                            setCopiedIndex(idx);
                            if (copiedTimerRef.current !== null) {
                              window.clearTimeout(copiedTimerRef.current);
                            }
                            copiedTimerRef.current = window.setTimeout(
                              () => setCopiedIndex(null),
                              2000,
                            );
                          }}
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check size={13} style={{ color: 'var(--success)' }} />
                              Added
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              Add to Plan
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {actionsMutation.isError && <InlineError error={actionsMutation.error} />}
          </>
        )}
      </div>
    </div>
  );
}
