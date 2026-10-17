import type {
  CalibrationCandidate as ApiCalibrationCandidate,
  CalibrationMatrixResponse,
} from '@assessflow/contracts';
import type { CalibrationCandidate } from './calibrationLogic';

function mapCandidate(candidate: ApiCalibrationCandidate): CalibrationCandidate {
  const hasCompletedEvaluation = Boolean(candidate.resultCode);
  const isDemoCandidate = candidate.caseId.startsWith('mock-case-');

  return {
    id: candidate.id,
    name: candidate.displayName || candidate.caseCode,
    department: candidate.department || 'Unassigned',
    currentLevel: candidate.currentLevel,
    targetLevel: candidate.targetLevel,
    currentRole: candidate.currentRole,
    targetRole: candidate.targetRole,
    readiness: candidate.readinessLabel,
    // The API defaults unevaluated cases to MEDIUM/MEDIUM and Box 5. Don't present
    // those fallback values as a real placement until a result has been recorded.
    box: hasCompletedEvaluation ? candidate.boxIndex : null,
    performance: hasCompletedEvaluation ? candidate.performanceBand.toLowerCase() : null,
    potential: hasCompletedEvaluation ? candidate.potentialBand.toLowerCase() : null,
    href:
      !isDemoCandidate && candidate.caseId
        ? `#/cases/${encodeURIComponent(candidate.caseId)}`
        : undefined,
  };
}

export function mapCalibrationCandidates(
  matrix: CalibrationMatrixResponse,
): CalibrationCandidate[] {
  return matrix.grid.flatMap((cell) => cell.candidates.map(mapCandidate));
}
