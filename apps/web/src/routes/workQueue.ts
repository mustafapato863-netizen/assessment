// workQueue.js — منطق صفحة My work (من غير أي UI)

const DAY = 86400000;
const startOfDay = (d: Date | string) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

export interface WorkItem {
  id: string;
  caseId: string;
  name: string;
  department: string;
  stage: string;
  dueDate: string | null;
  statusLabel: string;
  type: 'task' | 'approval' | 'evaluation';
  action: { label: string; href: string };
}

// آخر 6 حروف من رقم الحالة: "XLSX26-C4B9C2F98ED00CF3C57C" -> "…3C57C"
export function formatCaseId(id = ''): string {
  return id.length > 8 ? `…${id.slice(-6)}` : id;
}

// عدد أيام التأخير: 0 = مستحقة النهاردة، رقم موجب = متأخرة، null = مفيش موعد
export function daysOverdue(dueDate: string | null | undefined, now = new Date()): number | null {
  if (!dueDate) return null;
  return Math.round((startOfDay(now) - startOfDay(dueDate)) / DAY);
}

// نص الـ chip: واحد بس لكل صف
export function getStatusChip(item: Pick<WorkItem, 'dueDate' | 'statusLabel'>, now = new Date()) {
  const late = daysOverdue(item.dueDate, now);
  if (late === null) return { tone: 'neutral', text: item.statusLabel || 'No due date' };
  if (late > 0) return { tone: 'overdue', text: `Overdue · ${late}d` };
  if (late === 0) return { tone: 'today', text: 'Due today' };
  return { tone: 'neutral', text: `Due in ${-late}d` };
}

// الترتيب: المتأخر الأول (الأكتر تأخيراً)، بعدين الأقرب موعداً، بعدين من غير موعد
export function sortWorkItems<T extends Pick<WorkItem, 'dueDate' | 'name'>>(
  items: readonly T[],
  now = new Date(),
): T[] {
  const rank = (it: T) => {
    const late = daysOverdue(it.dueDate, now);
    if (late === null) return [2, 0];
    if (late >= 0) return [0, -late];
    return [1, -late]; // late سالب = لسه فاضل وقت
  };
  return [...items].sort((a, b) => {
    const [ga = 0, va = 0] = rank(a);
    const [gb = 0, vb = 0] = rank(b);
    return ga - gb || va - vb || a.name.localeCompare(b.name);
  });
}

// أرقام الكروت: كلها من نفس القايمة، فمستحيل تتضارب
export function getKpis(items: readonly WorkItem[], now = new Date()) {
  const overdue = items.filter((i) => (daysOverdue(i.dueDate, now) ?? -1) > 0).length;
  return {
    openCases: new Set(items.map((i) => i.caseId)).size,
    tasks: items.length,
    overdue,
    approvals: items.filter((i) => i.type === 'approval').length,
    evaluations: items.filter((i) => i.type === 'evaluation').length,
  };
}

export function countByStage(items: readonly Pick<WorkItem, 'stage'>[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.stage] = (acc[item.stage] || 0) + 1;
    return acc;
  }, {});
}
