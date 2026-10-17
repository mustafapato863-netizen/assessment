import type { AssessmentListCase } from './assessments-logic';

export interface EmployeeGroupCase {
  id?: string;
  caseId?: string;
  employeeId?: string;
  employeeName: string;
  department: string;
  position: string;
  requestedAt: string;
}

export interface EmployeeRecord<T extends EmployeeGroupCase = AssessmentListCase> {
  id: string;
  name: string;
  department: string;
  position: string;
  cases: T[];
  latest: T;
}

export function groupByEmployee<T extends EmployeeGroupCase>(cases: T[]): EmployeeRecord<T>[] {
  const employees = new Map<string, Omit<EmployeeRecord<T>, 'latest'>>();
  cases.forEach((item) => {
    const key = item.employeeId || item.employeeName;
    if (!employees.has(key)) {
      employees.set(key, {
        id: key,
        name: item.employeeName,
        department: item.department,
        position: item.position,
        cases: [],
      });
    }
    employees.get(key)!.cases.push(item);
  });

  return [...employees.values()]
    .map((employee) => {
      const sortedCases = [...employee.cases].sort(
        (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
      );
      const latest = sortedCases[0];
      return latest ? { ...employee, cases: sortedCases, latest } : null;
    })
    .filter((employee): employee is EmployeeRecord<T> => employee !== null);
}

export function sortEmployees<T extends EmployeeGroupCase>(list: EmployeeRecord<T>[]): EmployeeRecord<T>[] {
  return [...list].sort(
    (a, b) => b.cases.length - a.cases.length || a.name.localeCompare(b.name),
  );
}

export function searchEmployees<T extends EmployeeGroupCase>(
  list: EmployeeRecord<T>[],
  { q = '', dept = '' }: { q?: string; dept?: string },
): EmployeeRecord<T>[] {
  const needle = q.trim().toLowerCase();
  return list.filter((employee) => {
    if (dept && employee.department !== dept) return false;
    if (!needle) return true;
    return [
      employee.name,
      employee.position,
      employee.department,
      ...employee.cases.map((item) => item.caseId),
    ]
      .filter((value): value is string => typeof value === 'string')
      .some((value) => value.toLowerCase().includes(needle));
  });
}

export function employeeStats<T extends EmployeeGroupCase>(employees: EmployeeRecord<T>[]): {
  people: number;
  cases: number;
  multiCount: number;
  multiNames: string;
} {
  const multi = employees.filter((employee) => employee.cases.length > 1);
  return {
    people: employees.length,
    cases: employees.reduce((count, employee) => count + employee.cases.length, 0),
    multiCount: multi.length,
    multiNames: multi
      .slice(0, 3)
      .map((employee) => employee.name.split(' ')[0])
      .join(', '),
  };
}

export const caseLabel = (count: number) => (count === 1 ? '1 case' : `${count} cases`);

export function readSelected(hash = window.location.hash): string {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return new URLSearchParams(query).get('id') || '';
}

export function writeSelected(id: string): void {
  const base = window.location.hash.split('?')[0] || '#/employees';
  window.location.hash = id ? `${base}?id=${encodeURIComponent(id)}` : base;
}
