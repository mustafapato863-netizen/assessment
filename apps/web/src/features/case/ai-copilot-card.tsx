import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  AlertCircle,
  BrainCircuit,
  Check,
  CheckCircle2,
  Copy,
  Lightbulb,
  LoaderCircle,
  ShieldAlert,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type {
  CopilotBiasCheckResponse,
  CopilotSuggestActionsResponse,
  CopilotSynthesizeResponse,
} from '@assessflow/contracts';
import { api } from '../../lib/api';

export function AiCopilotCard({
  caseId,
  currentEvidenceText,
  onApplySynthesis,
  onApplySanitizedText,
  onApplyAction,
}: {
  caseId: string;
  currentEvidenceText?: string;
  onApplySynthesis?: (synthesis: CopilotSynthesizeResponse) => void;
  onApplySanitizedText?: (cleanText: string) => void;
  onApplyAction?: (action: { title: string; description: string; targetWeeks: number }) => void;
}) {
  const [activeTab, setActiveTab] = useState<'synthesis' | 'bias' | 'actions'>('synthesis');
  const [biasInputText, setBiasInputText] = useState(currentEvidenceText ?? '');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Synthesis mutation
  const synthesizeMutation = useMutation({
    mutationFn: () => api.copilotSynthesize(caseId),
    onSuccess: (data) => {
      if (onApplySynthesis) onApplySynthesis(data);
    },
  });

  // Bias check mutation
  const biasCheckMutation = useMutation({
    mutationFn: (text: string) => api.copilotBiasCheck(caseId, { text }),
  });

  // Action suggestions mutation
  const actionsMutation = useMutation({
    mutationFn: () => api.copilotSuggestActions(caseId, { limit: 3 }),
  });

  const synthesis = synthesizeMutation.data;
  const biasResult = biasCheckMutation.data;
  const actionsResult = actionsMutation.data;

  return (
    <div
      className="panel ai-copilot-card"
      style={{
        border: '1px solid #c7d2fe',
        background: 'linear-gradient(180deg, #f8faff 0%, #ffffff 100%)',
        borderRadius: '10px',
        marginBottom: '20px',
        overflow: 'hidden',
      }}
    >
      {/* Copilot Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #e0e7ff',
          background: 'linear-gradient(90deg, #eef2ff 0%, #f5f3ff 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: '#4f46e5',
              color: '#ffffff',
            }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#312e81' }}>
              AssessFlow AI Assessor Copilot
            </h4>
            <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 500 }}>
              Evidence Synthesis & Bias Radar
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            background: '#e0e7ff',
            padding: '3px',
            borderRadius: '6px',
          }}
        >
          <button
            type="button"
            className="tab-btn"
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              background: activeTab === 'synthesis' ? '#ffffff' : 'transparent',
              color: activeTab === 'synthesis' ? '#312e81' : '#64748b',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('synthesis')}
          >
            Executive Synthesis
          </button>
          <button
            type="button"
            className="tab-btn"
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              background: activeTab === 'bias' ? '#ffffff' : 'transparent',
              color: activeTab === 'bias' ? '#312e81' : '#64748b',
              cursor: 'pointer',
            }}
            onClick={() => {
              setActiveTab('bias');
              if (!biasInputText && currentEvidenceText) setBiasInputText(currentEvidenceText);
            }}
          >
            Bias Radar
          </button>
          <button
            type="button"
            className="tab-btn"
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              background: activeTab === 'actions' ? '#ffffff' : 'transparent',
              color: activeTab === 'actions' ? '#312e81' : '#64748b',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab('actions')}
          >
            SMART Actions
          </button>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {/* TAB 1: EXECUTIVE SYNTHESIS */}
        {activeTab === 'synthesis' && (
          <div>
            {!synthesis ? (
              <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 12px' }}>
                  Analyze assessor evidence submissions and synthesize candidate readiness against
                  target competencies.
                </p>
                <button
                  type="button"
                  className="primary-button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    background: '#4f46e5',
                    color: '#ffffff',
                    borderRadius: '6px',
                  }}
                  disabled={synthesizeMutation.isPending}
                  onClick={() => synthesizeMutation.mutate()}
                >
                  {synthesizeMutation.isPending ? (
                    <>
                      <LoaderCircle size={15} className="spinner" /> Synthesizing Evidence...
                    </>
                  ) : (
                    <>
                      <Wand2 size={15} /> Synthesize Assessment Evidence
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#4338ca',
                        textTransform: 'uppercase',
                      }}
                    >
                      Executive Evaluation Synthesis
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background:
                          synthesis.suggestedOutcome === 'READY_NOW'
                            ? '#dcfce7'
                            : synthesis.suggestedOutcome === 'NOT_READY'
                              ? '#fee2e2'
                              : '#fef3c7',
                        color:
                          synthesis.suggestedOutcome === 'READY_NOW'
                            ? '#15803d'
                            : synthesis.suggestedOutcome === 'NOT_READY'
                              ? '#b91c1c'
                              : '#b45309',
                      }}
                    >
                      AI Outcome: {synthesis.suggestedOutcome.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#1e293b', lineHeight: 1.5 }}>
                    {synthesis.executiveSummary}
                  </p>
                  <p
                    style={{
                      margin: '8px 0 0',
                      fontSize: '12px',
                      color: '#64748b',
                      fontStyle: 'italic',
                    }}
                  >
                    <strong>Rationale:</strong> {synthesis.suggestedOutcomeRationale}
                  </p>
                </div>

                {/* Demonstrated Strengths */}
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                    Demonstrated Competencies:
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '8px',
                      marginTop: '6px',
                    }}
                  >
                    {synthesis.demonstratedStrengths.map((str, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: 600,
                            color: '#166534',
                          }}
                        >
                          <span>{str.competency}</span>
                          <span>{Math.round(str.confidenceScore * 100)}% Match</span>
                        </div>
                        <p style={{ margin: '4px 0 0', color: '#334155', fontSize: '11px' }}>
                          {str.evidenceExcerpt}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Identified Gaps */}
                {synthesis.identifiedGaps.length > 0 && (
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                      Target Competency Gaps:
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginTop: '6px',
                      }}
                    >
                      {synthesis.identifiedGaps.map((gap, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontWeight: 600,
                              color: '#92400e',
                            }}
                          >
                            <span>{gap.competency}</span>
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 5px',
                                background: '#fef3c7',
                                borderRadius: '3px',
                              }}
                            >
                              {gap.severity}
                            </span>
                          </div>
                          <p style={{ margin: '4px 0 0', color: '#451a03', fontSize: '11px' }}>
                            {gap.observation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '8px',
                    marginTop: '4px',
                  }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ fontSize: '12px', padding: '5px 10px' }}
                    onClick={() => synthesizeMutation.mutate()}
                  >
                    Re-generate
                  </button>
                  {onApplySynthesis && (
                    <button
                      type="button"
                      className="primary-button"
                      style={{
                        fontSize: '12px',
                        padding: '5px 12px',
                        background: '#4f46e5',
                        color: '#fff',
                      }}
                      onClick={() => onApplySynthesis(synthesis)}
                    >
                      <Check size={13} /> Apply to Result Form
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UNCONSCIOUS BIAS RADAR */}
        {activeTab === 'bias' && (
          <div>
            <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 8px' }}>
              Scans assessor evaluations for non-behavioral adjectives, age bias, or gender-coded
              terms.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                }}
                placeholder="Paste assessor notes or feedback text to inspect for bias..."
                value={biasInputText}
                onChange={(e) => setBiasInputText(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="primary-button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    background: '#4f46e5',
                    color: '#ffffff',
                    borderRadius: '6px',
                  }}
                  disabled={biasCheckMutation.isPending || !biasInputText.trim()}
                  onClick={() => biasCheckMutation.mutate(biasInputText)}
                >
                  {biasCheckMutation.isPending ? (
                    <LoaderCircle size={14} className="spinner" />
                  ) : (
                    <ShieldAlert size={14} />
                  )}
                  Scan For Unconscious Bias
                </button>
              </div>

              {biasResult && (
                <div style={{ marginTop: '8px' }}>
                  {biasResult.clean ? (
                    <div
                      style={{
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '6px',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#166534',
                        fontSize: '13px',
                      }}
                    >
                      <CheckCircle2 size={16} />
                      <span>
                        <strong>Objective & Clean:</strong> No subjective bias indicators or
                        non-behavioral language detected.
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div
                        style={{
                          background: '#fff1f2',
                          border: '1px solid #fecdd3',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          color: '#9f1239',
                          fontSize: '12px',
                        }}
                      >
                        <strong>Bias Alert ({biasResult.findingsCount} flagged):</strong> Feedback
                        contains subjective or demographically coded phrasing.
                      </div>

                      {biasResult.warnings.map((w, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            fontSize: '12px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontWeight: 700, color: '#e11d48' }}>"{w.phrase}"</span>
                            <span
                              style={{
                                fontSize: '10px',
                                background: '#f1f5f9',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              {w.category}
                            </span>
                          </div>
                          <p style={{ margin: '3px 0 6px', color: '#475569', fontSize: '11px' }}>
                            {w.explanation}
                          </p>
                          <div
                            style={{
                              background: '#f8fafc',
                              padding: '6px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                            }}
                          >
                            <span style={{ fontWeight: 600, color: '#166534' }}>
                              Objective Alternative:{' '}
                            </span>
                            <span style={{ color: '#0f172a' }}>{w.objectiveAlternative}</span>
                          </div>
                        </div>
                      ))}

                      {biasResult.sanitizedSuggestion && onApplySanitizedText && (
                        <div
                          style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}
                        >
                          <button
                            type="button"
                            className="primary-button"
                            style={{
                              fontSize: '12px',
                              padding: '6px 12px',
                              background: '#059669',
                              color: '#fff',
                            }}
                            onClick={() => onApplySanitizedText(biasResult.sanitizedSuggestion!)}
                          >
                            <Check size={13} /> Apply Sanitized Wording
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SMART ACTION GENERATOR */}
        {activeTab === 'actions' && (
          <div>
            <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 10px' }}>
              Auto-generates targeted development milestones based on observed competency gaps.
            </p>
            {!actionsResult ? (
              <div style={{ textAlign: 'center', padding: '12px' }}>
                <button
                  type="button"
                  className="primary-button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    background: '#4f46e5',
                    color: '#ffffff',
                    borderRadius: '6px',
                  }}
                  disabled={actionsMutation.isPending}
                  onClick={() => actionsMutation.mutate()}
                >
                  {actionsMutation.isPending ? (
                    <LoaderCircle size={15} className="spinner" />
                  ) : (
                    <Lightbulb size={15} />
                  )}
                  Suggest SMART Milestones
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {actionsResult.actions.map((act, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '10px 12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                        {act.title}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: '#e0e7ff',
                          color: '#4338ca',
                        }}
                      >
                        {act.targetWeeks} Weeks ({act.category})
                      </span>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: '12px', color: '#475569' }}>
                      {act.description}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '6px',
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        <strong>Evidence:</strong> {act.suggestedEvidence}
                      </span>
                      {onApplyAction && (
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                          onClick={() => {
                            onApplyAction(act);
                            setCopiedIndex(idx);
                            setTimeout(() => setCopiedIndex(null), 2000);
                          }}
                        >
                          {copiedIndex === idx ? (
                            <Check size={12} color="#166534" />
                          ) : (
                            <Copy size={12} />
                          )}
                          {copiedIndex === idx ? 'Added' : 'Add to Plan'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
