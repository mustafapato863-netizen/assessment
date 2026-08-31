import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  History,
  Inbox,
  Languages,
  LayoutDashboard,
  ListTodo,
  LoaderCircle,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  createCaseSchema,
  type AssessmentCaseDetail,
  type AssessmentCaseSummary,
  type CreateCaseInput,
} from '@assessflow/contracts';
import { api, ApiRequestError } from './api';

type View =
  'overview' | 'tasks' | 'cases' | 'employees' | 'development' | 'insights' | 'admin' | 'case';
type Locale = 'en' | 'ar';

const copy = {
  en: {
    overview: 'Overview',
    tasks: 'My work',
    cases: 'Assessments',
    employees: 'Employees',
    development: 'Development',
    insights: 'Insights',
    admin: 'Administration',
    workspace: 'Assessment Workspace',
    cycle: 'FY26 Talent Cycle · Egypt',
    search: 'Search cases, employees, tasks…',
    greeting: 'Good morning, Sarah',
    subtitle: 'Here is what needs your attention today.',
    newRequest: 'New assessment',
    viewAll: 'View all',
    active: 'Active assessments',
    pendingEligibility: 'Pending eligibility',
    pendingApprovals: 'Pending approvals',
    overdue: 'Overdue follow-up',
    attention: 'Your attention',
    pipeline: 'Workflow pipeline',
    recent: 'Recent assessment cases',
    open: 'Open',
    request: 'Request',
    language: 'العربية',
    signOut: 'Sign out',
  },
  ar: {
    overview: 'نظرة عامة',
    tasks: 'مهامي',
    cases: 'التقييمات',
    employees: 'الموظفون',
    development: 'التطوير',
    insights: 'التحليلات',
    admin: 'الإدارة',
    workspace: 'مساحة التقييم',
    cycle: 'دورة المواهب FY26 · مصر',
    search: 'ابحث عن الحالات والموظفين والمهام…',
    greeting: 'صباح الخير، سارة',
    subtitle: 'إليك ما يحتاج إلى اهتمامك اليوم.',
    newRequest: 'تقييم جديد',
    viewAll: 'عرض الكل',
    active: 'التقييمات النشطة',
    pendingEligibility: 'بانتظار الأهلية',
    pendingApprovals: 'بانتظار الاعتماد',
    overdue: 'متابعات متأخرة',
    attention: 'يحتاج إلى اهتمامك',
    pipeline: 'مسار سير العمل',
    recent: 'أحدث حالات التقييم',
    open: 'فتح',
    request: 'طلب',
    language: 'English',
    signOut: 'تسجيل الخروج',
  },
} as const;
type Copy = { [Key in keyof (typeof copy)['en']]: string };

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_ELIGIBILITY: 'Pending eligibility',
  NOT_ELIGIBLE: 'Not eligible',
  READY_FOR_PLANNING: 'Ready for planning',
  PLANNING: 'Planning',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  PENDING_RESULT: 'Pending result',
  RESULT_FINALIZED: 'Result finalized',
  PENDING_RECOMMENDATION: 'Pending recommendation',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  DEVELOPMENT_IN_PROGRESS: 'Development in progress',
  REASSESSMENT_DUE: 'Reassessment due',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

const reasonLabels: Record<string, string> = {
  PROMOTION: 'Promotion',
  INTERNAL_MOBILITY: 'Internal mobility',
  ROLE_REALIGNMENT: 'Role realignment',
};

function statusTone(status: string) {
  if (['APPROVED', 'RESULT_FINALIZED', 'READY_FOR_PLANNING'].includes(status)) return 'success';
  if (['NOT_ELIGIBLE', 'CANCELLED'].includes(status)) return 'danger';
  if (['PENDING_ELIGIBILITY', 'PENDING_APPROVAL', 'REASSESSMENT_DUE'].includes(status))
    return 'warning';
  if (['PENDING_RECOMMENDATION'].includes(status)) return 'decision';
  if (['DEVELOPMENT_IN_PROGRESS', 'SCHEDULED'].includes(status)) return 'teal';
  return 'info';
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'danger'
        ? XCircle
        : tone === 'warning'
          ? AlertTriangle
          : tone === 'decision'
            ? Sparkles
            : tone === 'teal'
              ? ShieldCheck
              : CircleDashed;
  return (
    <span className={`status-badge ${tone}`}>
      <Icon size={13} strokeWidth={2.4} />
      {statusLabels[status] ?? status}
    </span>
  );
}

function App() {
  const [view, setView] = useState<View>('overview');
  const [locale, setLocale] = useState<Locale>('en');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const t = copy[locale];
  const queryClient = useQueryClient();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectView = (next: View) => {
    setView(next);
    setSelectedCaseId(null);
    setMobileMenuOpen(false);
  };

  const openCase = (id: string) => {
    setSelectedCaseId(id);
    setView('case');
    setMobileMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        view={view}
        t={t}
        onSelect={selectView}
        onClose={() => setMobileMenuOpen(false)}
      />
      <div className="app-main">
        <Topbar
          t={t}
          onOpenMenu={() => setMobileMenuOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
          collapsed={sidebarCollapsed}
          locale={locale}
          onLocale={() => setLocale((value) => (value === 'en' ? 'ar' : 'en'))}
        />
        <main className="page-content">
          {view === 'overview' && (
            <OverviewPage t={t} onOpenCase={openCase} onNew={() => setNewRequestOpen(true)} />
          )}
          {view === 'tasks' && <TasksPage t={t} onOpenCase={openCase} />}
          {view === 'cases' && (
            <CasesPage t={t} onOpenCase={openCase} onNew={() => setNewRequestOpen(true)} />
          )}
          {view === 'case' && selectedCaseId && (
            <CasePage
              caseId={selectedCaseId}
              t={t}
              onBack={() => selectView('cases')}
              onToast={setToast}
            />
          )}
          {view !== 'overview' && view !== 'tasks' && view !== 'cases' && view !== 'case' && (
            <PlaceholderPage view={view} t={t} />
          )}
        </main>
      </div>
      {newRequestOpen && (
        <NewRequestDrawer
          t={t}
          onClose={() => setNewRequestOpen(false)}
          onCreated={(created) => {
            setNewRequestOpen(false);
            openCase(created.id);
            setToast('Assessment request created as a draft.');
            queryClient.invalidateQueries({ queryKey: ['cases'] });
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button aria-label="Dismiss" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({
  collapsed,
  mobileOpen,
  view,
  t,
  onSelect,
  onClose,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  view: View;
  t: Copy;
  onSelect: (view: View) => void;
  onClose: () => void;
}) {
  const items: Array<{ id: View; label: string; icon: typeof LayoutDashboard; count?: string }> = [
    { id: 'overview', label: t.overview, icon: LayoutDashboard },
    { id: 'tasks', label: t.tasks, icon: ListTodo, count: '6' },
    { id: 'cases', label: t.cases, icon: ClipboardCheck, count: '12' },
    { id: 'employees', label: t.employees, icon: Users },
    { id: 'development', label: t.development, icon: Sparkles, count: '3' },
    { id: 'insights', label: t.insights, icon: BarChart3 },
  ];
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="brand-mark">
          A<span />
        </div>
        <div className="brand-copy">
          <strong>AssessFlow</strong>
          <small>Talent Assessment OS</small>
        </div>
        <button
          className="icon-button mobile-close"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="workspace-switch">
        <div className="workspace-icon">
          <Sparkles size={19} />
        </div>
        <div className="workspace-copy">
          <strong>{t.workspace}</strong>
          <small>{t.cycle}</small>
        </div>
        <span className="online-dot" />
      </div>
      <nav className="nav-groups" aria-label="Main navigation">
        <span className="nav-label">WORKSPACE</span>
        {items.slice(0, 4).map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={view === item.id}
            collapsed={collapsed}
            onClick={() => onSelect(item.id)}
          />
        ))}
        <span className="nav-label nav-label-spaced">INSIGHTS</span>
        {items.slice(4).map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={view === item.id}
            collapsed={collapsed}
            onClick={() => onSelect(item.id)}
          />
        ))}
        <span className="nav-label nav-label-spaced">SYSTEM</span>
        <NavItem
          item={{ id: 'admin', label: t.admin, icon: Settings2 }}
          active={view === 'admin'}
          collapsed={collapsed}
          onClick={() => onSelect('admin')}
        />
      </nav>
      {!collapsed && (
        <div className="sidebar-cycle">
          <div className="cycle-orb orb-one" />
          <div className="cycle-orb orb-two" />
          <span>LIVE CYCLE</span>
          <strong>Leadership assessment</strong>
          <div className="cycle-footer">
            <small>FY26</small>
            <b>68%</b>
          </div>
          <div className="cycle-progress">
            <i />
          </div>
        </div>
      )}
      {!collapsed && (
        <div className="sidebar-user">
          <div className="avatar avatar-purple">SJ</div>
          <div>
            <strong>Sarah Johnson</strong>
            <small>HR Business Partner</small>
          </div>
          <ChevronDown size={15} />
        </div>
      )}
      <button
        className="collapse-button"
        aria-label="Toggle sidebar"
        onClick={() => document.querySelector<HTMLButtonElement>('[data-sidebar-toggle]')?.click()}
      >
        <PanelLeftClose size={17} />
        <span>Collapse sidebar</span>
      </button>
    </aside>
  );
}

function NavItem({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: { id: View; label: string; icon: typeof LayoutDashboard; count?: string };
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
    >
      <Icon size={18} />
      <span>{item.label}</span>
      {item.count && !collapsed && <b>{item.count}</b>}
    </button>
  );
}

function Topbar({
  t,
  onOpenMenu,
  onToggleSidebar,
  collapsed,
  locale,
  onLocale,
}: {
  t: Copy;
  onOpenMenu: () => void;
  onToggleSidebar: () => void;
  collapsed: boolean;
  locale: Locale;
  onLocale: () => void;
}) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onOpenMenu} aria-label="Open navigation">
        <Menu size={21} />
      </button>
      <button
        data-sidebar-toggle
        className="icon-button desktop-toggle"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
      </button>
      <div className="global-search">
        <Search size={18} />
        <input aria-label={t.search} placeholder={t.search} />
        <kbd>⌘ K</kbd>
      </div>
      <div className="topbar-actions">
        <button
          className="icon-button locale-button"
          onClick={onLocale}
          aria-label="Change language"
        >
          <Languages size={18} />
          <span>{locale === 'en' ? 'AR' : 'EN'}</span>
        </button>
        <button className="icon-button notification-button" aria-label="Notifications">
          <Bell size={19} />
          <i />
        </button>
        <div className="topbar-profile">
          <div className="avatar avatar-purple">SJ</div>
          <div>
            <strong>Sarah Johnson</strong>
            <small>HR Business Partner</small>
          </div>
        </div>
      </div>
    </header>
  );
}

function OverviewPage({
  t,
  onOpenCase,
  onNew,
}: {
  t: Copy;
  onOpenCase: (id: string) => void;
  onNew: () => void;
}) {
  const { data, isLoading, isError } = useQuery({ queryKey: ['overview'], queryFn: api.overview });
  const { data: cases } = useQuery({ queryKey: ['cases'], queryFn: () => api.cases() });
  return (
    <>
      <PageHeading
        eyebrow="ASSESSMENT WORKSPACE"
        title={t.greeting}
        subtitle={t.subtitle}
        action={
          <button className="primary-button" onClick={onNew}>
            <Plus size={17} />
            {t.newRequest}
          </button>
        }
      />
      {isError && (
        <ErrorBanner message="The overview could not load. Check that the API is running, then retry." />
      )}
      <section className="metric-grid" aria-label="Assessment metrics">
        {isLoading
          ? [1, 2, 3, 4].map((key) => <SkeletonMetric key={key} />)
          : data?.metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>
      <div className="content-grid dashboard-grid">
        <section className="panel task-panel">
          <PanelHeader
            icon={<ListTodo size={17} />}
            title={t.attention}
            action={
              <button className="link-button" onClick={() => onOpenCase(cases?.[0]?.id ?? '')}>
                {t.viewAll}
                <ArrowUpRight size={14} />
              </button>
            }
          />
          <div className="task-list">
            {data?.tasks.map((task) => (
              <button
                className="task-row"
                key={task.id}
                onClick={() => {
                  const match = cases?.find((item) => item.caseCode === task.caseCode);
                  if (match) onOpenCase(match.id);
                }}
              >
                <div className={`priority-dot ${task.priority.toLowerCase()}`} />
                <div className="task-content">
                  <strong>{task.title}</strong>
                  <span>
                    {task.caseCode} · {task.dueLabel}
                  </span>
                </div>
                <MoreHorizontal size={17} />
              </button>
            ))}
          </div>
        </section>
        <section className="panel pipeline-panel">
          <PanelHeader
            icon={<BarChart3 size={17} />}
            title={t.pipeline}
            action={
              <button className="filter-button">
                <CalendarDays size={14} />
                FY26 <ChevronDown size={14} />
              </button>
            }
          />
          <div className="pipeline-list">
            {data?.pipeline.map((item) => (
              <div className="pipeline-row" key={item.label}>
                <div className="pipeline-label">
                  <span>{item.label}</span>
                  <b>{item.value}</b>
                </div>
                <div className="pipeline-bar">
                  <i className={item.tone} style={{ width: `${Math.max(item.value * 26, 12)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="pipeline-note">
            <Sparkles size={15} />
            <span>Eligibility is the next decision gate for your current queue.</span>
          </div>
        </section>
      </div>
      <section className="panel recent-panel">
        <PanelHeader
          icon={<History size={17} />}
          title={t.recent}
          action={
            <button className="link-button" onClick={() => onOpenCase(cases?.[0]?.id ?? '')}>
              {t.viewAll}
              <ArrowUpRight size={14} />
            </button>
          }
        />
        <CaseTable cases={cases ?? []} onOpen={onOpenCase} />
      </section>
    </>
  );
}

function TasksPage({ t, onOpenCase }: { t: Copy; onOpenCase: (id: string) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['overview'], queryFn: api.overview });
  const { data: cases } = useQuery({ queryKey: ['cases'], queryFn: () => api.cases() });
  return (
    <>
      <PageHeading
        eyebrow="MY WORK"
        title={t.tasks}
        subtitle="Your assigned decisions, follow-ups, and time-sensitive actions."
      />
      <section className="panel">
        <PanelHeader
          icon={<Inbox size={17} />}
          title="Assigned tasks"
          action={<span className="soft-count">{data?.tasks.length ?? 0} open</span>}
        />
        {isLoading ? (
          <LoadingRows />
        ) : (
          <div className="task-list large-task-list">
            {data?.tasks.map((task) => {
              const match = cases?.find((item) => item.caseCode === task.caseCode);
              return (
                <button
                  className="task-row task-row-large"
                  key={task.id}
                  onClick={() => match && onOpenCase(match.id)}
                >
                  <div className={`task-icon ${task.priority.toLowerCase()}`}>
                    <Clock3 size={17} />
                  </div>
                  <div className="task-content">
                    <strong>{task.title}</strong>
                    <span>
                      {task.caseCode} · {task.dueLabel}
                    </span>
                  </div>
                  <StatusBadge
                    status={task.priority === 'HIGH' ? 'PENDING_ELIGIBILITY' : 'PENDING_APPROVAL'}
                  />
                  <ArrowUpRight size={17} />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function CasesPage({
  t,
  onOpenCase,
  onNew,
}: {
  t: Copy;
  onOpenCase: (id: string) => void;
  onNew: () => void;
}) {
  const [search, setSearch] = useState('');
  const {
    data: cases,
    isLoading,
    isError,
  } = useQuery({ queryKey: ['cases', search], queryFn: () => api.cases(search) });
  return (
    <>
      <PageHeading
        eyebrow="ASSESSMENTS"
        title="Assessment cases"
        subtitle="Track every request from eligibility through follow-up."
        action={
          <button className="primary-button" onClick={onNew}>
            <Plus size={17} />
            {t.newRequest}
          </button>
        }
      />
      <section className="panel cases-panel">
        <div className="case-toolbar">
          <div className="inline-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search case, employee, department…"
            />
          </div>
          <button className="secondary-button">
            <FileText size={16} />
            Export
          </button>
        </div>
        {isError && <ErrorBanner message="Cases could not load." />}
        {isLoading ? <LoadingRows /> : <CaseTable cases={cases ?? []} onOpen={onOpenCase} />}
      </section>
    </>
  );
}

function CasePage({
  caseId,
  t,
  onBack,
  onToast,
}: {
  caseId: string;
  t: Copy;
  onBack: () => void;
  onToast: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const {
    data: caseDetail,
    isLoading,
    isError,
    error,
  } = useQuery({ queryKey: ['case', caseId], queryFn: () => api.caseDetail(caseId) });
  const [decisionReason, setDecisionReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const decision = useMutation({
    mutationFn: (payload: {
      decision: 'ELIGIBLE' | 'NOT_ELIGIBLE';
      reason?: string;
      expectedVersion: number;
    }) => api.decideEligibility(caseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setShowReject(false);
      setDecisionReason('');
      onToast('Eligibility decision saved and the next task was created.');
    },
  });
  const override = useMutation({
    mutationFn: (reason: string) => api.requestOverride(caseId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      onToast('Override request sent for governance review.');
    },
  });
  if (isLoading)
    return (
      <>
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to cases
        </button>
        <div className="case-loading">
          <div className="loader-ring" />
          <strong>Loading case workspace</strong>
          <span>Preparing the latest policy and activity context.</span>
        </div>
      </>
    );
  if (isError || !caseDetail)
    return (
      <>
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to cases
        </button>
        <ErrorBanner message={(error as Error)?.message ?? 'Case could not load.'} />
      </>
    );
  const activeIndex = [
    'REQUEST',
    'ELIGIBILITY',
    'PLANNING',
    'ASSESSMENT',
    'RESULT',
    'RECOMMENDATION',
    'APPROVAL',
    'FOLLOW_UP',
  ].indexOf(caseDetail.stage);
  return (
    <>
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to cases
      </button>
      <section className="case-header panel">
        <div>
          <div className="case-code">
            {caseDetail.caseCode} <span>·</span> {reasonLabels[caseDetail.assessmentReason]}
          </div>
          <h1>{caseDetail.employeeName}</h1>
          <p>
            {caseDetail.currentRole} <span className="muted-separator">→</span>{' '}
            {caseDetail.targetRole} · {caseDetail.targetLevel}
          </p>
        </div>
        <div className="case-header-side">
          <StatusBadge status={caseDetail.status} />
          <span className="owner-label">
            <UserRound size={14} />
            {caseDetail.owner}
          </span>
          <button className="icon-button">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </section>
      <section className="stepper panel" aria-label="Assessment progress">
        {['Request', 'Eligibility', 'Plan', 'Assessment', 'Result', 'Decision', 'Follow-up'].map(
          (label, index) => (
            <div
              className={`step ${index < activeIndex ? 'complete' : index === activeIndex ? 'current' : ''}`}
              key={label}
            >
              <div className="step-marker">
                {index < activeIndex ? <Check size={14} /> : index + 1}
              </div>
              <span>{label}</span>
              {index < 6 && <i />}
            </div>
          ),
        )}
      </section>
      <div className="case-layout">
        <div className="case-main">
          <section className="panel case-summary">
            <PanelHeader
              icon={<FileCheck2 size={17} />}
              title="Case overview"
              action={
                <span className="privacy-label">
                  <LockKeyhole size={14} />
                  Policy-protected
                </span>
              }
            />
            <div className="summary-grid">
              <InfoItem
                label="Employee"
                value={caseDetail.employeeName}
                icon={<UserRound size={15} />}
              />
              <InfoItem
                label="Department"
                value={caseDetail.department}
                icon={<Building2 size={15} />}
              />
              <InfoItem
                label="Assessment reason"
                value={reasonLabels[caseDetail.assessmentReason] ?? 'Assessment'}
                icon={<Sparkles size={15} />}
              />
              <InfoItem
                label="Target role"
                value={`${caseDetail.targetRole} · ${caseDetail.targetLevel}`}
                icon={<ArrowUpRight size={15} />}
              />
            </div>
            <div className="justification">
              <span>Business justification</span>
              <p>{caseDetail.justification}</p>
            </div>
          </section>
          {caseDetail.status === 'PENDING_ELIGIBILITY' && (
            <section className="panel decision-panel">
              <PanelHeader
                icon={<ShieldCheck size={17} />}
                title="Eligibility review"
                action={
                  <span className="policy-chip">
                    Policy {caseDetail.eligibility?.policyVersion}
                  </span>
                }
              />
              <p className="panel-intro">
                Confirm the policy criteria before this case can move to assessment planning. Every
                decision is recorded in the audit history.
              </p>
              <div className="criteria-table">
                {caseDetail.eligibility?.criteria.map((criterion) => (
                  <div className="criterion-row" key={criterion.code}>
                    <div>
                      <strong>{criterion.label}</strong>
                      <span>
                        {criterion.blocking ? 'Blocking criterion' : 'Non-blocking criterion'}
                      </span>
                    </div>
                    <span className={`criterion-result ${criterion.result.toLowerCase()}`}>
                      {criterion.result === 'MET' ? (
                        <Check size={14} />
                      ) : (
                        <CircleDashed size={14} />
                      )}
                      {criterion.result.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="decision-actions">
                {showReject && (
                  <div className="reason-field">
                    <label htmlFor="eligibility-reason">Decision reason</label>
                    <textarea
                      id="eligibility-reason"
                      value={decisionReason}
                      onChange={(event) => setDecisionReason(event.target.value)}
                      placeholder="Explain the blocking policy reason…"
                    />
                  </div>
                )}
                <div className="action-row">
                  <button
                    className="secondary-button"
                    onClick={() => setShowReject((value) => !value)}
                  >
                    <XCircle size={16} />
                    {showReject ? 'Cancel' : 'Mark not eligible'}
                  </button>
                  {showReject ? (
                    <button
                      className="danger-button"
                      disabled={decision.isPending || !decisionReason.trim()}
                      onClick={() =>
                        decision.mutate({
                          decision: 'NOT_ELIGIBLE',
                          reason: decisionReason,
                          expectedVersion: caseDetail.version,
                        })
                      }
                    >
                      {decision.isPending ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <ShieldAlert size={16} />
                      )}
                      Confirm decision
                    </button>
                  ) : (
                    <button
                      className="primary-button"
                      disabled={decision.isPending}
                      onClick={() =>
                        decision.mutate({
                          decision: 'ELIGIBLE',
                          expectedVersion: caseDetail.version,
                        })
                      }
                    >
                      {decision.isPending ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      Mark eligible
                    </button>
                  )}
                </div>
              </div>
              {decision.isError && <InlineError error={decision.error} />}
            </section>
          )}
          {caseDetail.status === 'NOT_ELIGIBLE' && (
            <section className="panel override-panel">
              <PanelHeader
                icon={<ShieldAlert size={17} />}
                title="Eligibility exception"
                action={<span className="status-badge danger">Governance required</span>}
              />
              <p className="panel-intro">
                This case is blocked by the eligibility policy. A separate governance decision is
                required before planning can continue.
              </p>
              <div className="restricted-callout">
                <LockKeyhole size={18} />
                <div>
                  <strong>Override requires a reason and audit trail</strong>
                  <span>Only authorized HR governance users can approve an exception.</span>
                </div>
              </div>
              <button
                className="secondary-button"
                disabled={override.isPending}
                onClick={() =>
                  override.mutate('Business-critical role need; HR governance review requested.')
                }
              >
                {override.isPending ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <RotateCcw size={16} />
                )}
                Request override review
              </button>
              {override.isError && <InlineError error={override.error} />}
            </section>
          )}
          {caseDetail.status !== 'PENDING_ELIGIBILITY' && caseDetail.status !== 'NOT_ELIGIBLE' && (
            <section className="panel next-panel">
              <PanelHeader
                icon={<Sparkles size={17} />}
                title="Next action"
                action={<StatusBadge status={caseDetail.status} />}
              />
              <div className="next-action-body">
                <div className="next-action-icon">
                  <ArrowUpRight size={20} />
                </div>
                <div>
                  <strong>{caseDetail.availableActions[0]?.label ?? 'Review case'}</strong>
                  <p>
                    The server has assigned this case to <b>{caseDetail.owner}</b>. Continue from
                    the current workflow gate.
                  </p>
                </div>
                <button className="primary-button">Open workspace</button>
              </div>
            </section>
          )}
        </div>
        <aside className="case-rail">
          <section className="panel">
            <PanelHeader icon={<ListTodo size={17} />} title="Case context" />
            <div className="rail-list">
              <RailItem label="Current owner" value={caseDetail.owner} />
              <RailItem label="Requested" value="18 Aug 2026" />
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
              action={<button className="link-button">View audit</button>}
            />
            <div className="activity-list">
              {caseDetail.activity.slice(0, 5).map((event) => (
                <div className="activity-item" key={event.id}>
                  <div className={`activity-dot ${event.tone}`} />
                  <div>
                    <strong>{event.action}</strong>
                    <span>
                      {event.actor} ·{' '}
                      {new Date(event.timestamp).toLocaleTimeString(localeFromDirection(), {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function localeFromDirection() {
  return document.documentElement.lang || 'en';
}

function NewRequestDrawer({
  t,
  onClose,
  onCreated,
}: {
  t: Copy;
  onClose: () => void;
  onCreated: (created: AssessmentCaseDetail) => void;
}) {
  const [form, setForm] = useState<CreateCaseInput>({
    employeeId: 'emp-new',
    employeeName: '',
    department: '',
    currentRole: '',
    assessmentReason: 'PROMOTION',
    targetRole: '',
    targetLevel: 'L4',
    justification: '',
    priority: 'NORMAL',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useMutation({ mutationFn: () => api.createCase(form), onSuccess: onCreated });
  const update = (key: keyof CreateCaseInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }) as CreateCaseInput);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = createCaseSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([key, value]) => [
            key,
            value?.[0] ?? 'Required',
          ]),
        ),
      );
      return;
    }
    setErrors({});
    mutation.mutate();
  };
  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        className="request-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-request-title"
      >
        <div className="drawer-header">
          <div>
            <span className="eyebrow">NEW WORKFLOW</span>
            <h2 id="new-request-title">{t.newRequest}</h2>
            <p>Capture the business need before the eligibility gate.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </div>
        <form onSubmit={submit} className="drawer-form">
          <div className="form-section">
            <span className="form-section-title">Employee context</span>
            <div className="form-grid">
              <Field
                label="Employee name"
                required
                value={form.employeeName}
                onChange={(value) => update('employeeName', value)}
                error={errors.employeeName}
                placeholder="Search employee"
              />
              <Field
                label="Department"
                required
                value={form.department}
                onChange={(value) => update('department', value)}
                error={errors.department}
                placeholder="e.g. Product"
              />
              <Field
                label="Current role"
                required
                value={form.currentRole}
                onChange={(value) => update('currentRole', value)}
                error={errors.currentRole}
                placeholder="Current position"
              />
            </div>
          </div>
          <div className="form-section">
            <span className="form-section-title">Assessment request</span>
            <div className="form-grid">
              <label className="field">
                <span>
                  Assessment reason <b>*</b>
                </span>
                <select
                  value={form.assessmentReason}
                  onChange={(event) => update('assessmentReason', event.target.value)}
                >
                  <option value="PROMOTION">Promotion</option>
                  <option value="INTERNAL_MOBILITY">Internal mobility</option>
                  <option value="ROLE_REALIGNMENT">Role realignment</option>
                </select>
              </label>
              <Field
                label="Target role"
                required
                value={form.targetRole}
                onChange={(value) => update('targetRole', value)}
                error={errors.targetRole}
                placeholder="Target position"
              />
              <Field
                label="Target level"
                required
                value={form.targetLevel}
                onChange={(value) => update('targetLevel', value)}
                error={errors.targetLevel}
                placeholder="L4"
              />
            </div>
            <label className="field">
              <span>
                Business justification <b>*</b>
              </span>
              <textarea
                value={form.justification}
                onChange={(event) => update('justification', event.target.value)}
                placeholder="Explain the business context, target scope, and reason for review…"
                rows={5}
              />
              {errors.justification && (
                <small className="field-error">{errors.justification}</small>
              )}
            </label>
          </div>
          {mutation.isError && <InlineError error={mutation.error} />}
          <div className="drawer-footer">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Send size={16} />
              )}
              {mutation.isPending ? 'Creating…' : 'Save draft'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function Field({
  label,
  required,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>
        {label} {required && <b>*</b>}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

function PlaceholderPage({
  view,
  t,
}: {
  view: Exclude<View, 'overview' | 'tasks' | 'cases' | 'case'>;
  t: Copy;
}) {
  const labels: Record<string, string> = {
    employees: t.employees,
    development: t.development,
    insights: t.insights,
    admin: t.admin,
  };
  return (
    <div className="empty-page panel">
      <div className="empty-icon">
        <Sparkles size={24} />
      </div>
      <span className="eyebrow">ASSESSFLOW MODULE</span>
      <h1>{labels[view] ?? view}</h1>
      <p>
        This workspace is part of the approved MVP route map. Its API contract and permission states
        are next in the implementation sequence.
      </p>
      <span className="soft-chip">Foundation connected</span>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function PanelHeader({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-header">
      <div className="panel-title">
        <span className="panel-icon">{icon}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
function MetricCard({
  metric,
}: {
  metric: { label: string; value: number; context: string; trend: string; tone: string };
}) {
  const Icon =
    metric.tone === 'danger'
      ? AlertTriangle
      : metric.tone === 'warning'
        ? Clock3
        : metric.tone === 'positive'
          ? CheckCircle2
          : FileText;
  return (
    <article className={`metric-card ${metric.tone}`}>
      <div className="metric-top">
        <span>{metric.label}</span>
        <span className="metric-icon">
          <Icon size={17} />
        </span>
      </div>
      <strong>{metric.value}</strong>
      <div className="metric-bottom">
        <b>{metric.trend}</b>
        <span>{metric.context}</span>
      </div>
      <div className="metric-spark">
        <i />
      </div>
    </article>
  );
}
function SkeletonMetric() {
  return (
    <article className="metric-card skeleton-card">
      <div className="skeleton-line short" />
      <div className="skeleton-line number" />
      <div className="skeleton-line" />
    </article>
  );
}
function InfoItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="info-item">
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
function RailItem({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rail-item">
      <span>{label}</span>
      <strong className={tone ?? ''}>{value}</strong>
    </div>
  );
}
function CaseTable({
  cases,
  onOpen,
}: {
  cases: AssessmentCaseSummary[];
  onOpen: (id: string) => void;
}) {
  if (!cases.length)
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Search size={21} />
        </div>
        <strong>No cases found</strong>
        <span>Try changing the search or create a new assessment request.</span>
      </div>
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Case / employee</th>
            <th>Reason</th>
            <th>Stage / status</th>
            <th>Owner</th>
            <th>Requested</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {cases.map((item) => (
            <tr key={item.id} onClick={() => onOpen(item.id)}>
              <td>
                <div className="table-person">
                  <div className="avatar avatar-small">
                    {item.employeeName
                      .split(' ')
                      .map((name) => name[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div>
                    <strong>{item.caseCode}</strong>
                    <span>
                      {item.employeeName} · {item.department}
                    </span>
                  </div>
                </div>
              </td>
              <td>
                <span className="reason-label">{reasonLabels[item.assessmentReason]}</span>
                <small>{item.targetRole}</small>
              </td>
              <td>
                <div className="table-status">
                  <span>{item.stage}</span>
                  <StatusBadge status={item.status} />
                </div>
              </td>
              <td>{item.owner}</td>
              <td>
                <span>
                  {new Date(item.requestedAt).toLocaleDateString(localeFromDirection(), {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
                <small>{item.ageLabel}</small>
              </td>
              <td>
                <button
                  className="row-action"
                  aria-label={`Open ${item.caseCode}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(item.id);
                  }}
                >
                  <ArrowUpRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function LoadingRows() {
  return (
    <div className="loading-list">
      <div className="loader-ring" />
      <span>Loading workspace data…</span>
    </div>
  );
}
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="error-banner" role="alert">
      <ShieldAlert size={18} />
      <span>{message}</span>
    </div>
  );
}
function InlineError({ error }: { error: unknown }) {
  const apiError = error as ApiRequestError;
  return (
    <div className="inline-error">
      <AlertTriangle size={16} />
      {apiError?.message ?? 'The action could not be completed.'}
    </div>
  );
}

export { App };
