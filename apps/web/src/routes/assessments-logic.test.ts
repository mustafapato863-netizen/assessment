import { describe, expect, it } from 'vitest';
import {
  filterCases,
  filtersToQuery,
  readFilters,
  type AssessmentListCase,
  type AssessmentStage,
} from './assessments-logic';

const make = (id: string, stage: AssessmentStage): AssessmentListCase => ({
  id,
  caseId: id,
  employeeName: id,
  department: 'Ops',
  position: 'Analyst',
  reason: '',
  stage,
  statusLabel: '',
  owner: '',
  requestedAt: '2026-11-01',
  href: `/cases/${id}`,
});

describe('assessment stage filter from the Overview cards', () => {
  const cases = [
    make('a', 'planning'),
    make('b', 'assessment'),
    make('c', 'planning'),
    make('d', 'closed'),
  ];

  it('reads the stage from the URL query (BrowserRouter, not the hash)', () => {
    expect(readFilters('?stage=planning').stage).toBe('planning');
    expect(readFilters('stage=planning').stage).toBe('planning');
    expect(readFilters('?stage=PLANNING').stage).toBe('planning');
    expect(readFilters('?stage=nonsense').stage).toBe('');
  });

  it('shows only the clicked stage, not every case', () => {
    const filtered = filterCases(cases, readFilters('?stage=planning'));
    expect(filtered.map((item) => item.id)).toEqual(['a', 'c']);
    expect(filterCases(cases, readFilters('')).length).toBe(4);
  });

  it('round-trips filters through the query string', () => {
    const filters = readFilters('?stage=closed&q=ann');
    expect(filtersToQuery(filters)).toBe('stage=closed&q=ann');
    expect(filtersToQuery(readFilters(''))).toBe('');
  });
});
