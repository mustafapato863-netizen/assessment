import type {
  CalibrationCandidate as ApiCalibrationCandidate,
  CalibrationMatrixResponse,
} from '@assessflow/contracts';
import type { CalibrationCandidate } from './calibrationLogic';

function mapCandidate(candidate: ApiCalibrationCandidate): CalibrationCandidate {
  // The API places a candidate only when a finalized result has a complete
  // scorecard; everyone else arrives with a null box and is shown as unplaced.
  const placed = candidate.boxIndex !== null && candidate.boxIndex !== undefined;
  const isDemoCandidate = candidate.caseId.startsWith('mock-case-');

  return {
    id: candidate.id,
    name: candidate.displayName || candidate.caseCode,
    department: candidate.department || 'Unassigned',
    currentLevel: candidate.currentLevel ?? null,
    targetLevel: candidate.targetLevel ?? null,
    currentRole: candidate.currentRole,
    targetRole: candidate.targetRole,
    readiness: candidate.readinessLabel,
    box: placed ? candidate.boxIndex : null,
    performance: placed ? (candidate.performanceBand?.toLowerCase() ?? null) : null,
    potential: placed ? (candidate.potentialBand?.toLowerCase() ?? null) : null,
    href:
      !isDemoCandidate && candidate.caseId
        ? `#/cases/${encodeURIComponent(candidate.caseId)}`
        : undefined,
  };
}

export function mapCalibrationCandidates(
  matrix: CalibrationMatrixResponse,
): CalibrationCandidate[] {
  return [
    ...matrix.grid.flatMap((cell) => cell.candidates.map(mapCandidate)),
    ...(matrix.unplaced ?? []).map(mapCandidate),
  ];
}

/** One-line explanation of how the axes are derived, shown above the grid. */
export function describeAxes(matrix: CalibrationMatrixResponse): string | undefined {
  if (!matrix.axes) return undefined;
  const { performance, potential, lowBelow, highFrom } = matrix.axes;
  return `Performance: ${performance}. Potential: ${potential}. Low below ${lowBelow}, high from ${highFrom} (0-5 scale).`;
}
