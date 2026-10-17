import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorBanner, LoadingRows } from '../components/ui';
import { api } from '../lib/api';
import Calibration from './calibration-view/Calibration';
import { describeAxes, mapCalibrationCandidates } from './calibration-view/calibrationData';

export function CalibrationPage() {
  const matrixQuery = useQuery({
    queryKey: ['calibration-matrix'],
    queryFn: () => api.getCalibrationMatrix(),
    staleTime: 30_000,
  });

  const candidates = useMemo(
    () => (matrixQuery.data ? mapCalibrationCandidates(matrixQuery.data) : []),
    [matrixQuery.data],
  );

  if (matrixQuery.isLoading) return <LoadingRows />;
  if (matrixQuery.isError || !matrixQuery.data) {
    return (
      <ErrorBanner
        message="Calibration data could not load."
        onRetry={() => void matrixQuery.refetch()}
      />
    );
  }

  return (
    <Calibration
      candidates={candidates}
      title={matrixQuery.data.cohortName}
      axesNote={describeAxes(matrixQuery.data)}
    />
  );
}

export default CalibrationPage;
