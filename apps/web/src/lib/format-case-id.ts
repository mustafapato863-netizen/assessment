/** Shortens long case codes while preserving their recognizable prefix and suffix. */
export function formatCaseId(caseId: string): string {
  const segments = caseId.split('-');
  const hasYearSegment = /^\d{4}$/.test(segments[1] ?? '');
  const prefixSegmentCount = hasYearSegment ? 2 : 1;
  const prefix = segments.slice(0, prefixSegmentCount).join('-');
  const suffix = segments.slice(prefixSegmentCount).join('-');

  if (!prefix || suffix.length <= 6) return caseId;
  return `${prefix}-…${suffix.slice(-6)}`;
}
