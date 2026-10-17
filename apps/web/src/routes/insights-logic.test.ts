import { describe, expect, it } from 'vitest';
import {
  aggregatesToCsv,
  applyFilters,
  byDepartment,
  byReason,
  byStage,
  byStatus,
  countBy,
  insightsKpis,
  type InsightCase,
} from './insights-logic';

const sampleCases: InsightCase[] = [
  {
    id: '1',
    caseId: 'AF-000001',
    employeeName: 'Private name one',
    department: 'Finance',
    position: 'Analyst',
    reason: 'Promotion',
    stage: 'assessment',
    statusLabel: 'In progress',
    requestedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: '2',
    caseId: 'AF-000002',
    employeeName: 'Private name two',
    department: 'Finance',
    position: 'Manager',
    reason: 'Promotion',
    stage: 'decision',
    statusLabel: 'Pending approval',
    requestedAt: '2026-09-02T00:00:00.000Z',
  },
  {
    id: '3',
    caseId: 'AF-000003',
    employeeName: 'Private name three',
    department: 'Operations',
    position: 'Lead',
    reason: 'Role realignment',
    stage: 'closed',
    statusLabel: 'Closed',
    requestedAt: '2026-09-03T00:00:00.000Z',
  },
];

describe('insightsLogic', () => {
  it('counts rows, includes requested empty keys, and calculates percentages', () => {
    const rows = countBy(sampleCases, (item) => item.department, {
      includeKeys: ['People'],
    });

    expect(rows.map(({ label, count, percent }) => [label, count, percent])).toEqual([
      ['Finance', 2, 67],
      ['Operations', 1, 33],
      ['People', 0, 0],
    ]);
  });

  it('applies all selected filters together', () => {
    expect(
      applyFilters(sampleCases, {
        reason: 'Promotion',
        dept: 'Finance',
        stage: 'decision',
        status: 'Pending approval',
      }).map((item) => item.id),
    ).toEqual(['2']);
  });

  it('counts closed, active, and pending cases and uses the supplied active plan count', () => {
    expect(insightsKpis(sampleCases, { developmentCount: 4 })).toEqual({
      total: 3,
      active: 2,
      pending: 1,
      inDevelopment: 4,
    });
  });

  it('keeps each breakdown total aligned and includes Closed in status and stage', () => {
    const sections = [
      byStatus(sampleCases),
      byReason(sampleCases, ['Promotion', 'Role realignment']),
      byStage(sampleCases),
      byDepartment(sampleCases),
    ];

    expect(sections.map((rows) => rows.reduce((total, row) => total + row.count, 0))).toEqual([
      sampleCases.length,
      sampleCases.length,
      sampleCases.length,
      sampleCases.length,
    ]);
    expect(byStatus(sampleCases).find((row) => row.label === 'Closed')?.count).toBe(1);
    expect(byStage(sampleCases).find((row) => row.key === 'closed')?.count).toBe(1);
  });

  it('exports aggregate rows only and safely quotes CSV values', () => {
    const csv = aggregatesToCsv([
      {
        title: 'By department',
        rows: [{ label: 'Finance, North', count: 2, percent: 67 }],
      },
    ]);

    expect(csv).toContain('"Section","Label","Count","Percent"');
    expect(csv).toContain('"By department","Finance, North","2","67%"');
    expect(csv).not.toContain('Private name');
    expect(csv).not.toContain('evidence');
  });
});
