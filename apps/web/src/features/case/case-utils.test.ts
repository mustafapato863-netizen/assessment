import { describe, expect, it } from 'vitest';
import { appendSynthesis } from './case-utils';

describe('appendSynthesis', () => {
  it('sets the summary when empty', () => {
    expect(appendSynthesis('', ' Draft. ')).toBe('Draft.');
  });
  it('does not append the same synthesis twice', () => {
    const once = appendSynthesis('', 'Draft.');
    expect(appendSynthesis(once, 'Draft.')).toBe('Draft.');
  });
  it('appends a different synthesis after existing text', () => {
    expect(appendSynthesis('Mine.', 'Draft.')).toBe('Mine.\n\nDraft.');
  });
});
