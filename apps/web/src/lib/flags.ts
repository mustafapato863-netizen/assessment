export const PILOT_FLAGS = {
  /**
   * UX-18 / Phase 2 Calibration Workspace.
   * The web Dockerfile, Playwright, and `.env.example` set
   * VITE_FEATURE_CALIBRATION=true. Any other value hides the module.
   */
  calibration: import.meta.env.VITE_FEATURE_CALIBRATION === 'true',
} as const;
