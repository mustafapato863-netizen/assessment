import { describe, expect, it } from 'vitest';
import { CopilotService } from './copilot.service';

describe('CopilotService', () => {
  const fakePrisma: any = { enabled: false };
  const service = new CopilotService(fakePrisma);

  describe('checkBias', () => {
    it('detects gender-coded language and provides objective alternatives', () => {
      const result = service.checkBias({
        text: 'She is often abrasive and emotional in meetings.',
      });
      expect(result.clean).toBe(false);
      expect(result.findingsCount).toBeGreaterThanOrEqual(2);
      expect(result.warnings.some((w) => w.phrase.toLowerCase() === 'abrasive')).toBe(true);
      expect(result.warnings.some((w) => w.phrase.toLowerCase() === 'emotional')).toBe(true);
      expect(result.sanitizedSuggestion).toBeDefined();
    });

    it('detects age bias phrases', () => {
      const result = service.checkBias({
        text: 'A young and hungry engineer who brings high energy.',
      });
      expect(result.clean).toBe(false);
      expect(result.warnings.some((w) => w.category === 'AGE_BIAS')).toBe(true);
    });

    it('returns clean when evaluating objective behavioral evidence', () => {
      const result = service.checkBias({
        text: 'Candidate demonstrated systematic technical architecture review and delivered 3 major backend features on schedule.',
      });
      expect(result.clean).toBe(true);
      expect(result.findingsCount).toBe(0);
      expect(result.riskScore).toBe('LOW');
    });
  });

  describe('suggestActions', () => {
    it('generates SMART development actions with durations and evidence criteria', async () => {
      const result = await service.suggestActions('case-123', { limit: 3 });
      expect(result.actions).toHaveLength(3);
      const firstAction = result.actions[0];
      expect(firstAction?.title).toBeDefined();
      expect(firstAction?.targetWeeks).toBeGreaterThan(0);
      expect(firstAction?.suggestedEvidence).toBeDefined();
    });
  });

  describe('synthesize', () => {
    it('synthesizes executive summary with demonstrated strengths and gaps', async () => {
      const result = await service.synthesize('case-123', {});
      expect(result.caseId).toBe('case-123');
      expect(result.executiveSummary).toBeDefined();
      expect(result.demonstratedStrengths.length).toBeGreaterThan(0);
      expect(result.suggestedOutcome).toBeDefined();
    });
  });
});
