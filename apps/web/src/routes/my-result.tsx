import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, LockKeyhole } from 'lucide-react';
import { ErrorBanner, PageHeading, PanelHeader } from '../components/ui';
import { api } from '../lib/api';
import { getSession } from '../lib/auth';
import { formatDate } from '../lib/format';
import { reasonLabels, resultCodeLabels } from '../lib/labels';
import { queryKeys } from '../lib/query-keys';

export function MyResultsPage() {
  const user = getSession();
  const {
    data = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.myResults(),
    queryFn: api.myResults,
    enabled: Boolean(user),
  });

  return (
    <>
      <PageHeading
        eyebrow="EMPLOYEE SELF SERVICE"
        title={`My assessment results${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        subtitle="Your results appear here after your feedback conversation has taken place."
      />
      <section className="panel my-results-panel">
        <PanelHeader
          icon={<CheckCircle2 size={17} />}
          title="Released results"
          action={<span className="soft-count">{data.length} results</span>}
        />
        {isLoading ? (
          <div className="assessor-empty" role="status">
            <span className="loader-ring" />
            <p>Loading your results…</p>
          </div>
        ) : isError ? (
          <div className="assessor-empty">
            <ErrorBanner
              message={error instanceof Error ? error.message : 'Your results could not load.'}
              onRetry={() => void refetch()}
            />
          </div>
        ) : data.length ? (
          <div className="my-results-list">
            {data.map((result) => (
              <article key={result.caseId} className="my-result-card">
                <div>
                  <span className="assessor-case-code">{result.caseCode}</span>
                  <h2>{resultCodeLabels[result.resultCode] ?? result.resultCode}</h2>
                  <p>
                    {reasonLabels[result.assessmentReason] ?? result.assessmentReason} ·{' '}
                    {result.targetRole}
                    {result.targetLevel ? ` (${result.targetLevel})` : ''}
                  </p>
                </div>
                <span className="my-result-date">
                  <Clock3 size={14} /> {formatDate(result.finalizedAt)}
                </span>
                {result.rationale && <p className="my-result-rationale">{result.rationale}</p>}
              </article>
            ))}
          </div>
        ) : (
          <div className="assessor-empty">
            <LockKeyhole size={28} />
            <strong>Your results are not available yet</strong>
            <p>
              Released results appear here after your feedback conversation is completed and the
              Assessor marks them as viewable.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
