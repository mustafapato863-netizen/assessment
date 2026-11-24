import { useMemo, useRef, useState } from 'react';
import { History, ListTodo, X } from 'lucide-react';
import type { AssessmentCaseDetail } from '@assessflow/contracts';
import { PanelHeader, RailItem } from '../../components/ui';
import { formatDate, formatDateTime } from '../../lib/format';
import { useFocusTrap } from '../../hooks/use-focus-trap';

export function ActivityDrawer({
  isOpen,
  onClose,
  triggerRef,
  activity,
  caseCode,
}: {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  activity: AssessmentCaseDetail['activity'];
  caseCode: string;
}) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useFocusTrap(isOpen, drawerRef, onClose);

  const handleClose = () => {
    onClose();
    window.setTimeout(() => triggerRef.current?.focus({ preventScroll: true }), 16);
  };

  if (!isOpen) return null;

  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && handleClose()}
    >
      <aside
        ref={drawerRef}
        className="request-drawer activity-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-drawer-title"
      >
        <div className="drawer-header">
          <div>
            <span className="eyebrow">AUDIT TRAIL</span>
            <h2 id="activity-drawer-title">Activity history</h2>
            <p>
              {caseCode} · {activity.length} recorded events
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="icon-button"
            onClick={handleClose}
            aria-label="Close activity history"
          >
            <X size={19} />
          </button>
        </div>
        <div className="activity-drawer-body">
          <div
            className="activity-list timeline-scroll"
            style={{ maxHeight: 'calc(100vh - 160px)' }}
          >
            {activity.map((event) => (
              <div className="activity-item" key={event.id}>
                <div className={`activity-dot ${event.tone}`} />
                <div>
                  <strong>{event.action}</strong>
                  <span>
                    {event.actor} · {formatDateTime(event.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

export function CaseRail({ caseDetail }: { caseDetail: AssessmentCaseDetail }) {
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const viewAuditTriggerRef = useRef<HTMLButtonElement | null>(null);

  const sortedActivity = useMemo(() => {
    if (!caseDetail.activity) return [];
    return [...caseDetail.activity].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [caseDetail.activity]);

  return (
    <>
      <aside className="case-rail">
        <section className="panel">
          <PanelHeader icon={<ListTodo size={17} />} title="Case context" />
          <div className="rail-list">
            <RailItem label="Current owner" value={caseDetail.owner} />
            <RailItem label="Requested" value={formatDate(caseDetail.requestedAt)} />
            <RailItem
              label="Priority"
              value={caseDetail.priority}
              tone={caseDetail.priority === 'HIGH' ? 'danger' : undefined}
            />
            <RailItem label="Version" value={`v${caseDetail.version}`} />
          </div>
        </section>

        <section className="panel activity-panel">
          <PanelHeader
            icon={<History size={17} />}
            title="Activity"
            action={
              <button
                ref={viewAuditTriggerRef}
                type="button"
                className="link-button"
                onClick={() => setAuditDrawerOpen(true)}
              >
                View audit
              </button>
            }
          />
          <div className={`activity-list ${showFullHistory ? 'timeline-scroll' : ''}`}>
            {(showFullHistory ? sortedActivity : sortedActivity.slice(0, 5)).map((event) => (
              <div className="activity-item" key={event.id}>
                <div className={`activity-dot ${event.tone}`} />
                <div>
                  <strong>{event.action}</strong>
                  <span>
                    {event.actor} · {formatDateTime(event.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {sortedActivity.length > 5 && (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <button
                type="button"
                className="link-button"
                onClick={() => setShowFullHistory((prev) => !prev)}
              >
                {showFullHistory ? 'Show less' : `View full history (${sortedActivity.length})`}
              </button>
            </div>
          )}
        </section>
      </aside>

      <ActivityDrawer
        isOpen={auditDrawerOpen}
        onClose={() => setAuditDrawerOpen(false)}
        triggerRef={viewAuditTriggerRef}
        activity={sortedActivity}
        caseCode={caseDetail.caseCode}
      />
    </>
  );
}
