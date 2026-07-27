import { describe, expect, it } from 'vitest';
import { resolveLocalized, type LocalizedText } from './localized.js';

describe('resolveLocalized', () => {
  it('returns the requested locale when present', () => {
    const text: LocalizedText = { ko: '더하기', en: 'Addition' };
    expect(resolveLocalized(text, 'en')).toBe('Addition');
    expect(resolveLocalized(text, 'ko')).toBe('더하기');
  });

  it('falls back to ko when a translation is missing (PLAN.md §6.2)', () => {
    const text: LocalizedText = { ko: '더하기' };
    expect(resolveLocalized(text, 'en')).toBe('더하기');
  });
});
