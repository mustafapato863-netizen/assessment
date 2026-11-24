import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  LockKeyhole,
  Plus,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AssessmentCaseDetail,
  AssessorRecommendationCode,
  ResultCode,
  ScorecardConfig,
  ScorecardDimension,
  ScorecardIssueSummary,
  ScorecardKnockoutCheck,
  ScorecardRatings,
} from '@assessflow/contracts';
import {
  SCORECARD_QUICK_FRACTIONS,
  SCORECARD_READY_NOW_THRESHOLD,
  SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD,
  assessorRecommendationCodes,
  calculateScorecard,
  isValidQuestionScore,
  scorecardRatingKey,
  scorecardWeightProblems,
} from '@assessflow/contracts';
import { api } from '../../lib/api';
import { getActiveUser } from '../../lib/auth';
import { queryKeys } from '../../lib/query-keys';
import { InlineError, PanelHeader, StatusBadge } from '../../components/ui';
import { PromptDialog } from '../../components/dialogs';
import type { AssessmentSummaryData, ScorecardResponse } from './case-utils';

export function resultCodeLabel(code: ResultCode) {
  return {
    READY_NOW: 'Ready now',
    READY_WITH_DEVELOPMENT: 'Ready with development',
    NOT_READY: 'Not ready',
    INCOMPLETE: 'Incomplete',
  }[code];
}

function formatScore(value: number) {
  return String(Math.round(value * 100) / 100);
}

function formatCategoryScore(value: number) {
  return value.toFixed(2);
}

function AssessorScorecardInner({
  caseId,
  onToast,
  onRefresh,
  onGoToResult,
}: {
  caseId: string;
  onToast: (msg: string) => void;
  onRefresh: () => void;
  /** Shown after submitting: moves the case view to the Result stage. */
  onGoToResult?: () => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.caseScorecard(caseId);
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => api.scorecard<ScorecardResponse>(caseId),
  });
  const [config, setConfig] = useState<ScorecardConfig | null>(null);
  const [ratings, setRatings] = useState<ScorecardRatings>({});
  const [dirtyConfig, setDirtyConfig] = useState(false);
  const [activeScorecardTab, setActiveScorecardTab] = useState<'technical' | 'behavioral'>(
    'technical',
  );
  const [expandedComments, setExpandedComments] = useState<Set<string>>(() => new Set());
  const [openIssues, setOpenIssues] = useState<Set<string>>(
    () => new Set(['technical-0', 'behavioral-0']),
  );
  const [editStructure, setEditStructure] = useState(false);
  const [reviseDialogOpen, setReviseDialogOpen] = useState(false);
  const [numericDrafts, setNumericDrafts] = useState<
    Record<string, { value: string; valid: boolean }>
  >({});

  useEffect(() => {
    if (data && !dirtyConfig) setConfig(data.config);
  }, [data?.config, dirtyConfig]);
  // Reload scores only when the saved copy on the server changes. Editing or saving
  // scorecard settings must never wipe the scores being entered.
  useEffect(() => {
    if (data) setRatings(data.mySubmission?.ratings ?? {});
  }, [data?.mySubmission]);

  const saveConfig = useMutation({
    mutationFn: (next: ScorecardConfig) => api.updateScorecardConfig(caseId, next),
    onSuccess: (result) => {
      setDirtyConfig(false);
      queryClient.setQueryData<ScorecardResponse>(queryKey, (current) =>
        current
          ? { ...current, config: result.config, canEditWeights: result.canEditWeights }
          : current,
      );
      onToast('Scorecard settings saved.');
    },
  });
  const saveRatings = useMutation({
    mutationFn: async ({ submit }: { submit: boolean }) => {
      if (dirtyConfig && config) await saveConfig.mutateAsync(config);
      return api.saveScorecard(caseId, ratings, submit);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey });
      if (variables.submit) {
        queryClient.invalidateQueries({ queryKey: ['case', caseId] });
        queryClient.invalidateQueries({ queryKey: ['overview'] });
        queryClient.invalidateQueries({ queryKey: ['cases'] });
      }
      onToast(variables.submit ? 'Scorecard submitted and locked.' : 'Scorecard draft saved.');
    },
  });
  const reviseSubmittedScores = useMutation({
    mutationFn: (reason: string) => api.reviseScorecard(caseId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      onToast('Scorecard reopened as a draft. The previous submission is in the audit history.');
    },
  });

  if (isLoading)
    return (
      <section className="panel">
        <p>Loading assessment scorecard…</p>
      </section>
    );
  if (error || !data || !config)
    return (
      <section className="panel">
        <PanelHeader icon={<ClipboardCheck size={17} />} title="Assessment scorecard" />
        {error ? (
          <InlineError error={error} onRefresh={onRefresh} />
        ) : (
          <p>Scorecard unavailable.</p>
        )}
      </section>
    );

  const locked = Boolean(data.mySubmission?.submittedAt);
  const preview = calculateScorecard(config, [{ ratings, submitted: true }]);
  const activeCategoryLabel =
    activeScorecardTab === 'technical'
      ? (config.technicalLabel ?? 'TECHNICAL')
      : (config.behavioralLabel ?? 'BEHAVIORAL');
  const activeCategoryScore =
    activeScorecardTab === 'technical' ? preview.technical : preview.behavioral;
  const allDimensions = [...config.technical, ...config.behavioral];
  const totalQuestionCount = allDimensions.reduce(
    (total, dimension) => total + dimension.criteria.length,
    0,
  );
  const completedQuestionCount = allDimensions.reduce(
    (total, dimension) =>
      total +
      dimension.criteria.filter((criterion) => {
        const score = ratings[scorecardRatingKey(dimension, criterion)]?.score;
        return isValidQuestionScore(score, criterion.weight);
      }).length,
    0,
  );
  // Knockout is a flag the assessor sets on a question; it does not depend on the score.
  const knockoutFlags = allDimensions.flatMap((dimension) =>
    dimension.criteria.filter(
      (criterion) => ratings[scorecardRatingKey(dimension, criterion)]?.knockout === true,
    ),
  );
  const knockoutTriggered = knockoutFlags.length > 0;
  const weightProblems = scorecardWeightProblems(config);
  const activeSectionWeightTotal = config[activeScorecardTab].reduce(
    (total, dimension) => total + dimension.weight,
    0,
  );
  const sectionSplitTotal = config.technicalWeight + config.behavioralWeight;
  const hasInvalidNumericDraft = Object.values(numericDrafts).some((draft) => !draft.valid);
  const setNumericDraft = (
    key: string,
    rawValue: string,
    min: number,
    max: number,
    allowEmpty: boolean,
    onValidValue: (value: number | undefined) => void,
  ) => {
    const parsed = /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(rawValue) ? Number(rawValue) : undefined;
    const empty = rawValue === '';
    const valid = empty ? allowEmpty : parsed !== undefined && parsed >= min && parsed <= max;
    setNumericDrafts((current) => ({ ...current, [key]: { value: rawValue, valid } }));
    if (valid) onValidValue(empty ? undefined : parsed);
  };
  const clearNumericDraft = (key: string) =>
    setNumericDrafts((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  const numericInputValue = (key: string, value: number | undefined) =>
    numericDrafts[key]?.value ?? (value === undefined ? '' : String(value));
  const setWeight = (section: 'technical' | 'behavioral', groupIndex: number, value: number) => {
    setConfig((current) => {
      if (!current) return current;
      const groups = [...current[section]];
      groups[groupIndex] = { ...groups[groupIndex]!, weight: value };
      return { ...current, [section]: groups };
    });
    setDirtyConfig(true);
  };
  const setDimensionName = (
    section: 'technical' | 'behavioral',
    groupIndex: number,
    name: string,
  ) => {
    setConfig((current) => {
      if (!current) return current;
      const groups = [...current[section]];
      groups[groupIndex] = { ...groups[groupIndex]!, name };
      return { ...current, [section]: groups };
    });
    setDirtyConfig(true);
  };
  const setSectionLabel = (field: 'technicalLabel' | 'behavioralLabel', label: string) => {
    setConfig((current) => (current ? { ...current, [field]: label } : current));
    setDirtyConfig(true);
  };
  const setCriterionWeight = (
    section: 'technical' | 'behavioral',
    groupIndex: number,
    ratingKey: string,
    value: number,
  ) => {
    setConfig((current) => {
      if (!current) return current;
      const groups = [...current[section]];
      groups[groupIndex] = {
        ...groups[groupIndex]!,
        criteria: groups[groupIndex]!.criteria.map((criterion) =>
          scorecardRatingKey(groups[groupIndex]!, criterion) === ratingKey
            ? { ...criterion, weight: value }
            : criterion,
        ),
      };
      return { ...current, [section]: groups };
    });
    setDirtyConfig(true);
  };
  const setCriterionText = (
    section: 'technical' | 'behavioral',
    groupIndex: number,
    ratingKey: string,
    field: 'name' | 'standard',
    value: string,
  ) => {
    setConfig((current) => {
      if (!current) return current;
      const groups = [...current[section]];
      const group = groups[groupIndex]!;
      groups[groupIndex] = {
        ...group,
        criteria: group.criteria.map((criterion) =>
          scorecardRatingKey(group, criterion) === ratingKey
            ? { ...criterion, [field]: value }
            : criterion,
        ),
      };
      return { ...current, [section]: groups };
    });
    setDirtyConfig(true);
  };
  const addCriterion = (section: 'technical' | 'behavioral', groupIndex: number) => {
    setConfig((current) => {
      if (!current) return current;
      const groups = [...current[section]];
      const group = groups[groupIndex]!;
      const ratingKey = `${group.code}:custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      let sequence = group.criteria.length + 1;
      while (group.criteria.some((criterion) => criterion.code === `N${sequence}`)) sequence += 1;
      groups[groupIndex] = {
        ...group,
        criteria: [
          ...group.criteria,
          {
            code: `N${sequence}`,
            ratingKey,
            name: 'New criterion',
            standard: 'Describe the expected behavior or evidence for this criterion.',
            weight: 1,
          },
        ],
      };
      return { ...current, [section]: groups };
    });
    setDirtyConfig(true);
  };
  const removeCriterion = (
    section: 'technical' | 'behavioral',
    groupIndex: number,
    ratingKey: string,
  ) => {
    const group = config[section][groupIndex]!;
    if (group.criteria.length <= 1) return;
    setConfig((current) => {
      if (!current) return current;
      const groups = [...current[section]];
      const currentGroup = groups[groupIndex]!;
      groups[groupIndex] = {
        ...currentGroup,
        criteria: currentGroup.criteria.filter(
          (criterion) => scorecardRatingKey(currentGroup, criterion) !== ratingKey,
        ),
      };
      return { ...current, [section]: groups };
    });
    setRatings((current) => {
      const next = { ...current };
      delete next[ratingKey];
      return next;
    });
    setDirtyConfig(true);
  };
  const setRating = (code: string, field: 'score' | 'evidence', value: string) =>
    setRatings((current) => ({
      ...current,
      [code]: {
        ...current[code],
        [field]: field === 'score' ? (value ? Number(value) : undefined) : value,
      },
    }));
  const setScore = (code: string, score: number | undefined) =>
    setRatings((current) => ({
      ...current,
      [code]: {
        ...current[code],
        score: score === undefined ? undefined : Math.round(score * 100) / 100,
      },
    }));
  const toggleKnockout = (code: string) =>
    setRatings((current) => ({
      ...current,
      [code]: { ...current[code], knockout: !current[code]?.knockout },
    }));
  const toggleComment = (ratingKey: string) =>
    setExpandedComments((current) => {
      const next = new Set(current);
      if (next.has(ratingKey)) next.delete(ratingKey);
      else next.add(ratingKey);
      return next;
    });

  const toggleIssue = (key: string) =>
    setOpenIssues((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // ---- Scorecard v2 view: mirrors the approved "Scorecard redesign" mockup ----
  const issueStats = (dimension: ScorecardDimension) => {
    let target = 0;
    let actual = 0;
    let answered = 0;
    for (const criterion of dimension.criteria) {
      const value = ratings[scorecardRatingKey(dimension, criterion)]?.score;
      target += criterion.weight;
      if (isValidQuestionScore(value, criterion.weight)) {
        actual += value;
        answered += 1;
      }
    }
    return {
      target,
      actual,
      answered,
      pct: target ? actual / target : 0,
      complete: answered === dimension.criteria.length,
    };
  };
  const sectionStats = (section: 'technical' | 'behavioral') => {
    let weighted = 0;
    let totalWeight = 0;
    let answered = 0;
    let total = 0;
    let complete = true;
    for (const dimension of config[section]) {
      const stats = issueStats(dimension);
      answered += stats.answered;
      total += dimension.criteria.length;
      if (!stats.complete) complete = false;
      // Every issue counts with its full weight; unanswered questions count as 0 points,
      // so the score reflects only what has actually been earned so far.
      weighted += stats.pct * 5 * dimension.weight;
      totalWeight += dimension.weight;
    }
    return {
      score: answered && totalWeight ? weighted / totalWeight : undefined,
      answered,
      total,
      complete,
    };
  };
  const technicalStats = sectionStats('technical');
  const behavioralStats = sectionStats('behavioral');
  const runningOverall =
    (technicalStats.answered || behavioralStats.answered) && sectionSplitTotal > 0
      ? ((technicalStats.score ?? 0) * config.technicalWeight +
          (behavioralStats.score ?? 0) * config.behavioralWeight) /
        sectionSplitTotal
      : undefined;
  const runningResult: ResultCode | null = knockoutTriggered
    ? 'NOT_READY'
    : runningOverall === undefined
      ? null
      : runningOverall >= SCORECARD_READY_NOW_THRESHOLD
        ? 'READY_NOW'
        : runningOverall >= SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD
          ? 'READY_WITH_DEVELOPMENT'
          : 'NOT_READY';
  const sectionStatus = (stats: ReturnType<typeof sectionStats>) =>
    stats.complete
      ? 'Complete'
      : stats.answered
        ? `Provisional · ${stats.answered} of ${stats.total} scored`
        : 'Not started';
  const bandTone = (pct: number, answered: number) =>
    !answered ? 'none' : pct >= 0.8 ? 'good' : pct >= 0.6 ? 'mid' : 'low';
  const formatPoints = (value: number) => String(Math.round(value * 100) / 100);
  // Quick-pick buttons are shares of the question weight. With weight 1 they read 0 ¼ ½ ¾ 1;
  // with weight 3 they read 0 · 0.75 · 1.5 · 2.25 · 3. Any other value goes in the points box.
  const quickPickLabel = (fraction: number, weight: number) =>
    weight === 1
      ? fraction === 0.25
        ? '¼'
        : fraction === 0.5
          ? '½'
          : fraction === 0.75
            ? '¾'
            : String(fraction)
      : formatPoints(fraction * weight);
  const canEditStructure = data.canEditWeights && !locked;
  const sectionLabel = (section: 'technical' | 'behavioral') =>
    section === 'technical'
      ? (config.technicalLabel ?? 'Technical')
      : (config.behavioralLabel ?? 'Behavioral');
  const footerMessage =
    dirtyConfig && weightProblems.length
      ? { tone: 'error', text: weightProblems.join(' ') }
      : dirtyConfig
        ? {
            tone: 'muted',
            text: 'Scorecard settings changed. They are saved together with your scores when you save a draft or submit.',
          }
        : locked
          ? { tone: 'muted', text: 'Your scores are submitted and locked.' }
          : completedQuestionCount === totalQuestionCount
            ? { tone: 'ok', text: 'All questions scored and weights balanced. Ready to submit.' }
            : {
                tone: 'muted',
                text: `${completedQuestionCount} of ${totalQuestionCount} questions scored. Save a draft anytime; submit when every question has a score.`,
              };

  const issueCards = (section: 'technical' | 'behavioral') =>
    config[section].map((dimension, index) => {
      const stats = issueStats(dimension);
      const issueKey = `${section}-${index}`;
      const open = openIssues.has(issueKey);
      const tone = bandTone(stats.pct, stats.answered);
      const hasKnockoutFlag = dimension.criteria.some(
        (criterion) => ratings[scorecardRatingKey(dimension, criterion)]?.knockout,
      );
      return (
        <div key={issueKey} className="sc2-issue">
          <div className="sc2-issue-head">
            <button
              type="button"
              className="sc2-issue-toggle"
              aria-expanded={open}
              onClick={() => toggleIssue(issueKey)}
            >
              <span className="sc2-code-badge" aria-hidden="true">
                {dimension.code}
              </span>
              <span className="sc2-issue-title">
                <span className="sc2-issue-name">{dimension.name}</span>
                <span className="sc2-issue-meta">
                  {dimension.criteria.length} questions · {stats.answered} scored
                  {hasKnockoutFlag ? ' · knockout flagged' : ''}
                </span>
              </span>
            </button>
            <label className="sc2-weight-field">
              Weight
              <input
                className="sc2-input"
                type="number"
                inputMode="numeric"
                min="0"
                max="100"
                step="1"
                aria-label={`${dimension.name} weight in percent`}
                value={numericInputValue(`dimension-weight:${section}:${index}`, dimension.weight)}
                disabled={!canEditStructure}
                onChange={(event) =>
                  setNumericDraft(
                    `dimension-weight:${section}:${index}`,
                    event.target.value,
                    0,
                    100,
                    false,
                    (value) => {
                      if (value !== undefined) setWeight(section, index, value);
                    },
                  )
                }
                onBlur={() => clearNumericDraft(`dimension-weight:${section}:${index}`)}
              />
              <span>%</span>
            </label>
            <div className="sc2-issue-progress">
              <div
                className="sc2-bar"
                role="progressbar"
                aria-label={`${dimension.name} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(stats.pct * 100)}
              >
                <span
                  className={`sc2-bar-fill tone-${tone}`}
                  style={{ width: `${Math.round(stats.pct * 100)}%` }}
                />
              </div>
              <span className="sc2-issue-total">
                <span className={`sc2-num sc2-issue-total-main tone-text-${tone}`}>
                  {formatScore(stats.actual)} / {formatScore(stats.target)}
                </span>
                <span className="sc2-num sc2-issue-total-sub">
                  {Math.round(stats.pct * 100)}% ·{' '}
                  {stats.answered ? formatCategoryScore(stats.pct * 5) : '—'}/5
                </span>
              </span>
            </div>
          </div>

          {open && (
            <div className="sc2-issue-body">
              {editStructure && canEditStructure && (
                <label className="sc2-edit-row">
                  Issue name
                  <input
                    className="sc2-text-input"
                    value={dimension.name}
                    onChange={(event) => setDimensionName(section, index, event.target.value)}
                  />
                </label>
              )}
              <div className="sc2-grid sc2-col-head">
                <span>QUESTION</span>
                <span>POINTS (0 TO Q. WEIGHT)</span>
                <span className="sc2-right">Q. WEIGHT</span>
              </div>
              {dimension.criteria.map((criterion) => {
                const ratingKey = scorecardRatingKey(dimension, criterion);
                const rating = ratings[ratingKey];
                const noteOpen = expandedComments.has(ratingKey);
                return (
                  <div key={ratingKey} className="sc2-question">
                    <div className="sc2-grid sc2-question-row">
                      <div className="sc2-question-text">
                        <span className="sc2-question-heading">
                          <span className="sc2-num sc2-question-code">{criterion.code}</span>
                          {editStructure && canEditStructure ? (
                            <input
                              className="sc2-text-input"
                              aria-label={`${criterion.code} question name`}
                              value={criterion.name}
                              onChange={(event) =>
                                setCriterionText(
                                  section,
                                  index,
                                  ratingKey,
                                  'name',
                                  event.target.value,
                                )
                              }
                            />
                          ) : (
                            <span className="sc2-question-name">{criterion.name}</span>
                          )}
                          {rating?.knockout && <span className="sc2-ko-badge">KNOCKOUT</span>}
                          {editStructure && canEditStructure && (
                            <button
                              type="button"
                              className="sc2-icon-button"
                              aria-label={`Remove ${criterion.name}`}
                              disabled={dimension.criteria.length <= 1}
                              onClick={() => removeCriterion(section, index, ratingKey)}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </span>
                        {editStructure && canEditStructure ? (
                          <textarea
                            className="sc2-note"
                            aria-label={`${criterion.name} standard`}
                            rows={2}
                            value={criterion.standard}
                            onChange={(event) =>
                              setCriterionText(
                                section,
                                index,
                                ratingKey,
                                'standard',
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          <span className="sc2-question-std">{criterion.standard}</span>
                        )}
                        <span className="sc2-question-actions">
                          <button
                            type="button"
                            className={`sc2-ko-toggle${rating?.knockout ? ' active' : ''}`}
                            aria-pressed={Boolean(rating?.knockout)}
                            disabled={locked}
                            onClick={() => toggleKnockout(ratingKey)}
                          >
                            {rating?.knockout ? 'Knockout flagged' : 'Flag knockout'}
                          </button>
                          <button
                            type="button"
                            className="sc2-link"
                            aria-expanded={noteOpen}
                            onClick={() => toggleComment(ratingKey)}
                          >
                            {noteOpen
                              ? 'Hide evidence note'
                              : rating?.evidence?.trim()
                                ? 'Evidence note saved · edit'
                                : '+ Evidence note'}
                          </button>
                        </span>
                      </div>
                      <div className="sc2-points">
                        <div
                          className="sc2-seg-group"
                          role="group"
                          aria-label={`${criterion.name} quick score`}
                        >
                          {SCORECARD_QUICK_FRACTIONS.map((fraction) => {
                            const points = Math.round(fraction * criterion.weight * 100) / 100;
                            return (
                              <button
                                key={fraction}
                                type="button"
                                className="sc2-seg"
                                aria-pressed={rating?.score === points}
                                aria-label={`${criterion.name}: ${formatPoints(points)} of ${formatPoints(criterion.weight)}`}
                                disabled={locked}
                                onClick={() => {
                                  clearNumericDraft(`points:${ratingKey}`);
                                  setScore(ratingKey, points);
                                }}
                              >
                                {quickPickLabel(fraction, criterion.weight)}
                              </button>
                            );
                          })}
                        </div>
                        <span className="sc2-points-entry">
                          <input
                            className={`sc2-input sc2-points-input${
                              numericDrafts[`points:${ratingKey}`]?.valid === false
                                ? ' invalid'
                                : ''
                            }`}
                            type="text"
                            inputMode="decimal"
                            placeholder="—"
                            aria-label={`${criterion.name} points earned (0 to ${formatPoints(criterion.weight)})`}
                            value={numericInputValue(`points:${ratingKey}`, rating?.score)}
                            disabled={locked}
                            onChange={(event) =>
                              setNumericDraft(
                                `points:${ratingKey}`,
                                event.target.value,
                                0,
                                criterion.weight,
                                true,
                                (value) => setScore(ratingKey, value),
                              )
                            }
                            onBlur={() => {
                              if (numericDrafts[`points:${ratingKey}`]?.valid !== false)
                                clearNumericDraft(`points:${ratingKey}`);
                            }}
                          />
                          <span className="sc2-points-max">/ {formatPoints(criterion.weight)}</span>
                        </span>
                      </div>
                      <div className="sc2-right">
                        <input
                          className="sc2-input"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.5"
                          aria-label={`${criterion.name} question weight`}
                          value={numericInputValue(
                            `criterion-weight:${ratingKey}`,
                            criterion.weight,
                          )}
                          disabled={!canEditStructure}
                          onChange={(event) =>
                            setNumericDraft(
                              `criterion-weight:${ratingKey}`,
                              event.target.value,
                              0,
                              1000,
                              false,
                              (value) => {
                                if (value !== undefined)
                                  setCriterionWeight(section, index, ratingKey, value);
                              },
                            )
                          }
                          onBlur={() => clearNumericDraft(`criterion-weight:${ratingKey}`)}
                        />
                      </div>
                    </div>
                    {noteOpen && (
                      <textarea
                        className="sc2-note"
                        aria-label={`${criterion.name} evidence note`}
                        placeholder="Evidence observed in the session for this question"
                        value={rating?.evidence ?? ''}
                        disabled={locked}
                        onChange={(event) => setRating(ratingKey, 'evidence', event.target.value)}
                      />
                    )}
                  </div>
                );
              })}
              {editStructure && canEditStructure && (
                <div className="sc2-add-row">
                  <button
                    type="button"
                    className="sc2-link"
                    onClick={() => addCriterion(section, index)}
                  >
                    + Add question
                  </button>
                </div>
              )}
              <div className="sc2-issue-foot">
                <span>
                  Target = sum of question weights (
                  <span className="sc2-num">{formatScore(stats.target)}</span>). Actual = Σ points
                  entered (<span className="sc2-num">{formatScore(stats.actual)}</span>).
                </span>
                <span className="sc2-num sc2-strong">
                  Issue score {stats.answered ? formatCategoryScore(stats.pct * 5) : '—'} / 5
                </span>
              </div>
            </div>
          )}
        </div>
      );
    });

  return (
    <section className="sc2" style={{ marginTop: '22px' }}>
      <div className="sc2-header">
        <div className="sc2-header-text">
          <span className="sc2-kicker">ASSESSOR SCORECARD</span>
          <h2 className="sc2-title">Assessment scorecard</h2>
          <span className="sc2-sub">
            Enter the points earned on each question (0 up to its weight). An issue&apos;s target is
            the sum of its question weights; its actual is the sum of your points. Unscored
            questions count as 0.
          </span>
        </div>
        <div className="sc2-header-side">
          {canEditStructure && (
            <button
              type="button"
              className="sc2-link"
              aria-pressed={editStructure}
              onClick={() => setEditStructure((value) => !value)}
            >
              {editStructure ? 'Done editing questions' : 'Edit questions'}
            </button>
          )}
          <span className="sc2-num sc2-sub">
            {completedQuestionCount} / {totalQuestionCount} questions scored
          </span>
        </div>
      </div>

      <div className="sc2-summary">
        {(['technical', 'behavioral'] as const).map((section) => {
          const stats = section === 'technical' ? technicalStats : behavioralStats;
          return (
            <div key={section} className="sc2-card">
              <span className="sc2-card-label">
                {sectionLabel(section).toUpperCase()} · {config[`${section}Weight`]}%
              </span>
              <span className="sc2-num sc2-card-value">
                {stats.score === undefined ? '—' : formatCategoryScore(stats.score)}
                <span className="sc2-card-unit"> / 5</span>
              </span>
              <span className="sc2-card-note">{sectionStatus(stats)}</span>
            </div>
          );
        })}
        <div className="sc2-card sc2-card-dark">
          <span className="sc2-card-label">OVERALL</span>
          <span className="sc2-num sc2-card-value">
            {runningOverall === undefined ? '—' : formatCategoryScore(runningOverall)}
            <span className="sc2-card-unit"> / 5</span>
          </span>
          <span className={`sc2-result-chip result-${runningResult ?? 'none'}`}>
            {runningResult
              ? resultCodeLabel(runningResult)
              : 'Score both sections to see the result'}
          </span>
        </div>
        <div className="sc2-card">
          <span className="sc2-card-label">KNOCKOUT</span>
          <span className={`sc2-ko-status ${knockoutTriggered ? 'triggered' : 'clear'}`}>
            {knockoutTriggered ? 'Triggered' : 'Clear'}
          </span>
          <span className="sc2-card-note">
            {knockoutTriggered
              ? `Flagged on ${knockoutFlags.map((criterion) => criterion.code).join(', ')}. Result is Not ready.`
              : 'Flag a knockout on any question to force Not ready.'}
          </span>
        </div>
      </div>

      <div className="sc2-split">
        <span className="sc2-strong">Section split</span>
        {(['technicalWeight', 'behavioralWeight'] as const).map((field) => (
          <label key={field} className="sc2-weight-field">
            {field === 'technicalWeight' ? sectionLabel('technical') : sectionLabel('behavioral')}
            <input
              className="sc2-input"
              type="number"
              inputMode="numeric"
              min="0"
              max="100"
              step="1"
              value={numericInputValue(`section-weight:${field}`, config[field])}
              disabled={!canEditStructure}
              onChange={(event) =>
                setNumericDraft(
                  `section-weight:${field}`,
                  event.target.value,
                  0,
                  100,
                  false,
                  (value) => {
                    if (value !== undefined) {
                      setConfig({ ...config, [field]: value });
                      setDirtyConfig(true);
                    }
                  },
                )
              }
              onBlur={() => clearNumericDraft(`section-weight:${field}`)}
            />
            <span>%</span>
          </label>
        ))}
        <span className={`sc2-pill ${sectionSplitTotal === 100 ? 'ok' : 'error'}`}>
          {sectionSplitTotal === 100
            ? 'Total 100% ✓'
            : `Total ${sectionSplitTotal}% · must be 100%`}
        </span>
      </div>

      <div className="sc2-tabbar">
        <div role="tablist" aria-label="Scorecard section" className="sc2-tabs">
          {(['technical', 'behavioral'] as const).map((section) => (
            <button
              key={section}
              type="button"
              role="tab"
              className="sc2-tab"
              aria-selected={activeScorecardTab === section}
              onClick={() => setActiveScorecardTab(section)}
            >
              {sectionLabel(section)}
              <span className="sc2-num sc2-tab-count">{config[section].length} issues</span>
            </button>
          ))}
        </div>
        <div className="sc2-budget">
          <span>Issue weights</span>
          <span className="sc2-budget-bar">
            <span
              className={`sc2-bar-fill tone-${
                activeSectionWeightTotal === 100
                  ? 'good'
                  : activeSectionWeightTotal > 100
                    ? 'low'
                    : 'mid'
              }`}
              style={{ width: `${Math.min(activeSectionWeightTotal, 100)}%` }}
            />
          </span>
          <span
            className={`sc2-num sc2-strong tone-text-${
              activeSectionWeightTotal === 100
                ? 'good'
                : activeSectionWeightTotal > 100
                  ? 'low'
                  : 'mid'
            }`}
          >
            {activeSectionWeightTotal === 100
              ? '100% of 100%'
              : activeSectionWeightTotal > 100
                ? `${activeSectionWeightTotal}% · over by ${activeSectionWeightTotal - 100}%`
                : `${activeSectionWeightTotal}% · ${100 - activeSectionWeightTotal}% unassigned`}
          </span>
        </div>
      </div>

      {editStructure && canEditStructure && (
        <label className="sc2-edit-row">
          Section name
          <input
            className="sc2-text-input"
            value={sectionLabel(activeScorecardTab)}
            onChange={(event) =>
              setSectionLabel(
                activeScorecardTab === 'technical' ? 'technicalLabel' : 'behavioralLabel',
                event.target.value,
              )
            }
          />
        </label>
      )}

      <div className="sc2-issues" role="tabpanel">
        {issueCards(activeScorecardTab)}
      </div>

      {data.submissions.length > 0 && (
        <p className="sc2-sub">
          {data.submissions.filter((submission) => submission.submitted).length} assessor
          scorecard(s) submitted. The final result averages all completed scorecards.
        </p>
      )}

      <div className="sc2-footer">
        <span className={`sc2-footer-msg tone-${footerMessage.tone}`} role="status">
          {footerMessage.text}
        </span>
        <div className="sc2-footer-actions">
          {locked && data.canReviseSubmission && (
            <button
              type="button"
              className="sc2-btn sc2-btn-secondary"
              disabled={reviseSubmittedScores.isPending}
              onClick={() => setReviseDialogOpen(true)}
            >
              {reviseSubmittedScores.isPending ? 'Reopening…' : 'Edit submitted scores'}
            </button>
          )}
          {canEditStructure && dirtyConfig && (
            <button
              type="button"
              className="sc2-btn sc2-btn-secondary"
              disabled={hasInvalidNumericDraft || weightProblems.length > 0 || saveConfig.isPending}
              onClick={() => saveConfig.mutate(config)}
            >
              {saveConfig.isPending ? 'Saving…' : 'Save scorecard settings'}
            </button>
          )}
          <button
            type="button"
            className="sc2-btn sc2-btn-secondary"
            disabled={
              locked ||
              (dirtyConfig && weightProblems.length > 0) ||
              hasInvalidNumericDraft ||
              saveConfig.isPending ||
              saveRatings.isPending
            }
            onClick={() => saveRatings.mutate({ submit: false })}
          >
            {saveRatings.isPending && !saveRatings.variables?.submit ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            className="sc2-btn sc2-btn-primary"
            disabled={
              locked ||
              (dirtyConfig && weightProblems.length > 0) ||
              hasInvalidNumericDraft ||
              saveConfig.isPending ||
              completedQuestionCount < totalQuestionCount ||
              saveRatings.isPending
            }
            title={
              completedQuestionCount < totalQuestionCount
                ? `${totalQuestionCount - completedQuestionCount} question(s) still need points.`
                : undefined
            }
            onClick={() => saveRatings.mutate({ submit: true })}
          >
            {saveRatings.isPending && saveRatings.variables?.submit
              ? 'Submitting…'
              : 'Submit scores'}
          </button>
        </div>
      </div>

      {locked && onGoToResult && (
        <div className="sc2-next">
          <div className="sc2-next-text">
            <strong>Scores submitted</strong>
            <span>Next step: review the calculated result and finalize it.</span>
          </div>
          <button type="button" className="sc2-btn sc2-btn-primary" onClick={onGoToResult}>
            Go to Result
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {locked && (
        <div className="restricted-callout" style={{ marginTop: '12px' }}>
          <LockKeyhole size={16} />
          <div>
            <strong>Scores submitted and locked</strong>
            <span>
              {data.canReviseSubmission
                ? 'To make a correction, choose “Edit submitted scores” and enter a reason. The earlier submission will remain in the audit history.'
                : 'This result has moved past assessment. Reopen the result first, then revise the submitted scores with a reason.'}
            </span>
          </div>
        </div>
      )}
      {saveConfig.isError && <InlineError error={saveConfig.error} onRefresh={onRefresh} />}
      {saveRatings.isError && <InlineError error={saveRatings.error} onRefresh={onRefresh} />}
      {reviseSubmittedScores.isError && (
        <InlineError error={reviseSubmittedScores.error} onRefresh={onRefresh} />
      )}
      <PromptDialog
        isOpen={reviseDialogOpen}
        title="Revise submitted scorecard"
        description="Explain why you are reopening this submitted scorecard. The prior submission remains in the audit history."
        label="Revision reason"
        placeholder="e.g. Correcting behavioral competency rating after panel calibration…"
        minLength={3}
        confirmLabel="Reopen scorecard"
        busy={reviseSubmittedScores.isPending}
        onCancel={() => setReviseDialogOpen(false)}
        onConfirm={async (reason) => {
          await reviseSubmittedScores.mutateAsync(reason);
          setReviseDialogOpen(false);
        }}
      />
    </section>
  );
}

function recommendationLabel(summary: AssessmentSummaryData) {
  if (!summary.completeCount || summary.overall === undefined) return 'Complete scoring';
  if (summary.knockout) return 'Not appointable — knockout';
  if (summary.overall >= SCORECARD_READY_NOW_THRESHOLD) return 'Strong — appointable';
  if (summary.overall >= SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD)
    return 'Appointable with development plan';
  return 'Not appointable at Stage 3';
}

const assessorRecommendationLabels: Record<AssessorRecommendationCode, string> = {
  READY_FOR_PROMOTION: 'Ready for promotion',
  ACTING_FOR_3_MONTHS: 'Acting as for 3 Months',
  FIT_FOR_CURRENT_POSITION: 'Fit for current Position',
  UNFIT_FOR_CURRENT_POSITION: 'Unfit for current position',
  NOT_READY_FOR_PROMOTION: 'Not Ready for promotion',
  DOWNGRADE: 'Downgrade',
  REPLACEMENT: 'Replacement',
};

export function defaultAssessorRecommendation(summary: AssessmentSummaryData): string | undefined {
  if (!summary.completeCount || summary.overall === undefined) return undefined;
  if (summary.knockout || summary.overall < SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD)
    return 'Not appointable';
  if (summary.overall < SCORECARD_READY_NOW_THRESHOLD) return 'Appointable with development';
  return 'Strong';
}

function assessorRecommendationText(value?: string) {
  if (!value) return undefined;
  return Object.hasOwn(assessorRecommendationLabels, value)
    ? assessorRecommendationLabels[value as AssessorRecommendationCode]
    : value;
}

function summaryDate(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        date,
      );
}

const RECOMMENDATION_OPTIONS = [
  { label: 'Strong', band: '4.00 – 5.00' },
  { label: 'Appointable with development', band: '3.00 – 3.99' },
  { label: 'Not appointable', band: 'below 3.00 · or any knockout' },
] as const;

function formatIssuePoints(value: number) {
  return String(Math.round(value * 100) / 100);
}

function summaryResultCode(summary: AssessmentSummaryData): ResultCode {
  if (!summary.completeCount || summary.overall === undefined) return 'INCOMPLETE';
  if (summary.knockout) return 'NOT_READY';
  if (summary.overall >= SCORECARD_READY_NOW_THRESHOLD) return 'READY_NOW';
  if (summary.overall >= SCORECARD_READY_WITH_DEVELOPMENT_THRESHOLD)
    return 'READY_WITH_DEVELOPMENT';
  return 'NOT_READY';
}

function issueTone(pct: number) {
  return pct >= 0.999 ? 'full' : pct >= 0.8 ? 'good' : pct >= 0.6 ? 'mid' : 'low';
}

// ---- Assessment summary: mirrors the approved "Result summary redesign" mockup ----
function AssessmentSummaryInner({
  caseDetail,
  summary,
  assessors,
  finalizedAt,
  finalizedBy,
  recommendationCode,
  editable = false,
  onRecommendationChange,
}: {
  caseDetail: AssessmentCaseDetail;
  summary: AssessmentSummaryData;
  assessors: Array<{ assessorName: string; submitted: boolean; submittedAt: string | null }>;
  finalizedAt?: string;
  finalizedBy?: string;
  recommendationCode?: string;
  editable?: boolean;
  onRecommendationChange?: (value: string) => void;
}) {
  const totalDimensionWeight = summary.technicalWeight + summary.behavioralWeight || 1;
  const submitted = assessors.filter((assessor) => assessor.submitted);
  const submittedNames = submitted.map((assessor) => assessor.assessorName).join(', ');
  const latestSubmission = submitted
    .filter((assessor) => assessor.submittedAt)
    .map((assessor) => assessor.submittedAt!)
    .sort((a, b) => b.localeCompare(a))[0];
  const resultCode = summaryResultCode(summary);
  const contribution = (score: number | undefined, weight: number) =>
    score === undefined ? undefined : (score * weight) / totalDimensionWeight;
  const technicalContribution = contribution(summary.technical, summary.technicalWeight);
  const behavioralContribution = contribution(summary.behavioral, summary.behavioralWeight);
  const pctOf = (value: number | undefined) =>
    `${Math.max(0, Math.min(100, ((value ?? 0) / 5) * 100)).toFixed(1)}%`;
  const recommendationText =
    assessorRecommendationText(recommendationCode) ?? defaultAssessorRecommendation(summary) ?? '';
  const suggested = defaultAssessorRecommendation(summary);
  const isPreset = RECOMMENDATION_OPTIONS.some((option) => option.label === recommendationText);

  const sectionCard = (
    label: string,
    weight: number,
    score: number | undefined,
    contributes: number | undefined,
  ) => (
    <div className="rs-card">
      <span className="rs-kicker">
        {label} · {Math.round((weight / totalDimensionWeight) * 100)}%
      </span>
      <div className="rs-big">
        <span className="rs-num rs-big-value">
          {score === undefined ? '—' : formatCategoryScore(score)}
        </span>
        <span className="rs-num rs-big-max">/ 5</span>
      </div>
      <div className="rs-track">
        <div className={`rs-fill ${issueTone((score ?? 0) / 5)}`} style={{ width: pctOf(score) }} />
      </div>
      <span className="rs-muted">
        Contributes{' '}
        <span className="rs-num rs-strong">
          {contributes === undefined ? '—' : formatCategoryScore(contributes)}
        </span>
      </span>
    </div>
  );

  const issueTable = (
    title: string,
    prefix: string,
    score: number | undefined,
    issues: ScorecardIssueSummary[],
  ) => {
    const issueWeightTotal = issues.reduce((total, issue) => total + issue.weight, 0);
    return (
      <div className="rs-table">
        <div className="rs-table-head">
          <span className="rs-table-title">{title}</span>
          <span className="rs-num rs-strong">
            {score === undefined ? '—' : formatCategoryScore(score)} / 5
          </span>
        </div>
        {issues.length ? (
          <>
            <div className="rs-row rs-row-head">
              <span>ISSUE</span>
              <span className="rs-right">ACT/TGT</span>
              <span />
              <span className="rs-right">SCORE</span>
              <span className="rs-right">WT</span>
            </div>
            {issues.map((issue, index) => {
              const pct = issue.target ? issue.actual / issue.target : 0;
              const tone = issueTone(pct);
              return (
                <div key={issue.code} className="rs-row">
                  <span className="rs-issue">
                    <span className="rs-code rs-num">
                      {prefix}
                      {index + 1}
                    </span>
                    <span className="rs-issue-name" title={issue.name}>
                      {issue.name}
                    </span>
                  </span>
                  <span className="rs-num rs-right">
                    {formatIssuePoints(issue.actual)} / {formatIssuePoints(issue.target)}
                  </span>
                  <span className="rs-track">
                    <span
                      className={`rs-fill ${tone}`}
                      style={{ width: `${Math.min(100, pct * 100).toFixed(1)}%` }}
                    />
                  </span>
                  <span className={`rs-num rs-right rs-score ${tone === 'full' ? '' : 'short'}`}>
                    {formatCategoryScore(issue.score)}
                  </span>
                  <span className="rs-num rs-right rs-muted">
                    {issueWeightTotal ? Math.round((issue.weight / issueWeightTotal) * 100) : 0}%
                  </span>
                </div>
              );
            })}
          </>
        ) : (
          <p className="rs-muted rs-pad">Issue scores appear after a scorecard is submitted.</p>
        )}
      </div>
    );
  };

  return (
    <section className="rs">
      <div className="rs-strip">
        <div className="rs-meta">
          <span className="rs-kicker">CANDIDATE</span>
          <strong>{caseDetail.employeeName}</strong>
        </div>
        <div className="rs-meta">
          <span className="rs-kicker">ROLE · DEPARTMENT</span>
          <strong>
            {caseDetail.targetRole} · {caseDetail.department}
          </strong>
        </div>
        <div className="rs-meta">
          <span className="rs-kicker">ASSESSOR(S)</span>
          <strong>
            {submittedNames || 'Pending score submission'}
            {assessors.length > 0 && (
              <span className="rs-muted rs-normal">
                {' '}
                · {submitted.length} of {assessors.length} submitted
              </span>
            )}
          </strong>
        </div>
        <div className="rs-meta">
          <span className="rs-kicker">ASSESSMENT DATE</span>
          <strong>{summaryDate(latestSubmission ?? caseDetail.requestedAt)}</strong>
        </div>
        <div className="rs-meta">
          <span className="rs-kicker">PANEL DECISION</span>
          <strong className={finalizedAt ? '' : 'rs-warn'}>{summaryDate(finalizedAt)}</strong>
        </div>
      </div>

      <div className="rs-hero">
        <div className="rs-overall">
          <span className="rs-kicker rs-on-dark">OVERALL WEIGHTED SCORE</span>
          <div className="rs-big">
            <span className="rs-num rs-overall-value">
              {summary.overall === undefined ? '—' : formatCategoryScore(summary.overall)}
            </span>
            <span className="rs-num rs-overall-max">/ 5</span>
            <span className={`rs-pill ${resultCode.toLowerCase()}`}>
              {resultCodeLabel(resultCode)}
            </span>
          </div>
          <div className="rs-scale">
            <div className="rs-scale-fill" style={{ width: pctOf(summary.overall) }} />
            <span className="rs-scale-mark" style={{ left: '60%' }} />
            <span className="rs-scale-mark" style={{ left: '80%' }} />
          </div>
          <div className="rs-scale-labels rs-num">
            <span style={{ left: 0 }}>0</span>
            <span style={{ left: '60%', transform: 'translateX(-50%)' }}>3 · with development</span>
            <span style={{ left: '80%', transform: 'translateX(-10%)' }}>4 · ready now</span>
          </div>
          {technicalContribution !== undefined && behavioralContribution !== undefined && (
            <span className="rs-num rs-equation">
              {formatCategoryScore(technicalContribution)} technical +{' '}
              {formatCategoryScore(behavioralContribution)} behavioral ={' '}
              {formatCategoryScore(technicalContribution + behavioralContribution)}
            </span>
          )}
        </div>
        {sectionCard(
          'TECHNICAL',
          summary.technicalWeight,
          summary.technical,
          technicalContribution,
        )}
        {sectionCard(
          'BEHAVIORAL',
          summary.behavioralWeight,
          summary.behavioral,
          behavioralContribution,
        )}
        <div className="rs-card">
          <span className="rs-kicker">KNOCKOUT</span>
          {summary.knockout ? (
            <>
              <span className="rs-ko triggered">Triggered</span>
              {summary.knockoutChecks
                .filter((check) => check.triggered)
                .map((check) => (
                  <span key={`${check.issueName}-${check.code}`} className="rs-muted">
                    {check.issueName} · {check.name} — flagged by {check.actual ?? 0}
                  </span>
                ))}
            </>
          ) : (
            <>
              <span className="rs-ko clear">Clear</span>
              <span className="rs-muted">No knockout flagged by any assessor.</span>
            </>
          )}
        </div>
      </div>

      <div className="rs-tables">
        {issueTable('Technical issues', 'T', summary.technical, summary.technicalIssues)}
        {issueTable('Behavioral issues', 'B', summary.behavioral, summary.behavioralIssues)}
      </div>

      <div className="rs-panel">
        <div className="rs-panel-head">
          <span className="rs-panel-title">Recommendation</span>
          <span className="rs-muted">
            Pre-selected from the score. A knockout always forces Not appointable.
          </span>
        </div>
        {editable && onRecommendationChange ? (
          <>
            <div className="rs-recos">
              {RECOMMENDATION_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className="rs-reco"
                  aria-pressed={recommendationText === option.label}
                  onClick={() => onRecommendationChange(option.label)}
                >
                  <span className="rs-reco-top">
                    <span className="rs-reco-label">{option.label}</span>
                    {suggested === option.label && <span className="rs-tag">From score</span>}
                  </span>
                  <span className="rs-num rs-muted">{option.band}</span>
                </button>
              ))}
            </div>
            <label className="rs-field">
              Recommendation wording (optional)
              <input
                type="text"
                value={isPreset ? '' : recommendationText}
                placeholder="e.g. Strong – ready for the target role now"
                onChange={(event) => onRecommendationChange(event.target.value || suggested || '')}
              />
            </label>
          </>
        ) : (
          <strong className="rs-reco-readonly">
            {assessorRecommendationText(recommendationCode) ?? recommendationLabel(summary)}
          </strong>
        )}
        <div className="rs-people">
          <div className="rs-meta">
            <span className="rs-kicker">LEAD ASSESSOR</span>
            <strong>{submittedNames || 'Pending'}</strong>
          </div>
          <div className="rs-meta">
            <span className="rs-kicker">PANEL CHAIR · FINALIZED BY</span>
            <strong className={finalizedBy ? '' : 'rs-warn'}>
              {finalizedBy ?? 'Pending panel decision'}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}

export const AssessorScorecard = memo(AssessorScorecardInner);
export const AssessmentSummary = memo(AssessmentSummaryInner);
