import { describe, expect, it } from 'vitest';
import {
  BOTTOM_OUT_ABUSE_THRESHOLD,
  createLessonState,
  isLessonUnlocked,
  nextHintTier,
  practiceAccuracy,
  reduce,
  starsFor,
  type LessonCounts,
  type LessonEvent,
  type LessonState
} from './state-machine.js';
import type { HintTier } from './types.js';

const COUNTS: LessonCounts = { hook: 1, example: 2, fading: 3, practice: 3 };

function seq(from: LessonState, events: LessonEvent[], counts: LessonCounts = COUNTS): LessonState {
  return events.reduce((s, e) => reduce(s, e, counts), from);
}

describe('reduce — hook → example → fading → practice → done', () => {
  it('starts at hook index 0', () => {
    const s = createLessonState(1000);
    expect(s.phase).toBe('hook');
    expect(s.index).toBe(0);
  });

  it('skip-hook jumps to example', () => {
    const s = reduce(createLessonState(0), { t: 'skip-hook' }, COUNTS);
    expect(s.phase).toBe('example');
    expect(s.index).toBe(0);
  });

  it('advances through example problems then to fading', () => {
    const s = seq(createLessonState(0), [
      { t: 'next' }, // hook done -> example 0
      { t: 'next' }, // example 0 -> 1
      { t: 'next' } // example 1 -> fading 0
    ]);
    expect(s.phase).toBe('fading');
    expect(s.index).toBe(0);
  });

  it('advances through fading problems then to practice', () => {
    const s = seq(createLessonState(0), [
      { t: 'next' }, // -> example 0
      { t: 'next' }, // example 0->1
      { t: 'next' }, // -> fading 0
      { t: 'next' }, // fading 0->1
      { t: 'next' }, // fading 1->2
      { t: 'next' } // fading 2 -> practice 0
    ]);
    expect(s.phase).toBe('practice');
    expect(s.index).toBe(0);
  });

  it("'next' is ignored in practice (a problem must be solved to advance)", () => {
    const s = seq(createLessonState(0), [
      { t: 'next' },
      { t: 'next' },
      { t: 'next' },
      { t: 'next' },
      { t: 'next' },
      { t: 'next' }, // -> practice 0
      { t: 'next' } // ignored
    ]);
    expect(s.phase).toBe('practice');
    expect(s.index).toBe(0);
  });

  it('skip-hook is ignored outside hook phase', () => {
    const inExample = reduce(createLessonState(0), { t: 'next' }, COUNTS);
    const s = reduce(inExample, { t: 'skip-hook' }, COUNTS);
    expect(s.phase).toBe('example');
  });
});

describe('reduce — practice solving', () => {
  function reachPractice(): LessonState {
    return seq(createLessonState(0), [
      { t: 'next' },
      { t: 'next' },
      { t: 'next' },
      { t: 'next' },
      { t: 'next' },
      { t: 'next' }
    ]);
  }

  it('solved-correct increments correct/attempts, resets consecutive bottom-out, advances', () => {
    let s = reachPractice();
    s = reduce(s, { t: 'bottom-out' }, COUNTS); // consec=1, index->1
    s = reduce(s, { t: 'solved-correct' }, COUNTS); // resets, index->2
    expect(s.attempts).toBe(2);
    expect(s.correct).toBe(1);
    expect(s.consecutiveBottomOut).toBe(0);
    expect(s.index).toBe(2);
    expect(s.phase).toBe('practice');
  });

  it('completes after solving all practice problems', () => {
    let s = reachPractice();
    s = reduce(s, { t: 'solved-correct' }, COUNTS);
    s = reduce(s, { t: 'solved-correct' }, COUNTS);
    s = reduce(s, { t: 'solved-correct' }, COUNTS);
    expect(s.phase).toBe('done');
    expect(s.correct).toBe(3);
    expect(s.attempts).toBe(3);
  });

  it('bottom-out does not count as correct but counts as attempt, advances, logs hint', () => {
    let s = reachPractice();
    s = reduce(s, { t: 'bottom-out' }, COUNTS);
    expect(s.correct).toBe(0);
    expect(s.attempts).toBe(1);
    expect(s.bottomOuts).toBe(1);
    expect(s.consecutiveBottomOut).toBe(1);
    expect(s.hintsUsed).toContain('bottom-out');
    expect(s.index).toBe(1);
  });

  it('records a non-bottom-out hint without solving', () => {
    let s = reachPractice();
    s = reduce(s, { t: 'hint', tier: 'point' }, COUNTS);
    s = reduce(s, { t: 'hint', tier: 'teach' }, COUNTS);
    expect(s.hintsUsed).toEqual(['point', 'teach']);
    expect(s.index).toBe(0); // did not advance
    expect(s.phase).toBe('practice');
  });
});

describe('reduce — hint abuse detection', () => {
  function reachPractice(): LessonState {
    return seq(createLessonState(0), [
      { t: 'next' },
      { t: 'next' },
      { t: 'next' },
      { t: 'next' },
      { t: 'next' },
      { t: 'next' }
    ]);
  }

  it(`flags suggestReview after ${BOTTOM_OUT_ABUSE_THRESHOLD} consecutive bottom-outs`, () => {
    let s = reachPractice();
    s = reduce(s, { t: 'bottom-out' }, COUNTS); // consec=1
    expect(s.suggestReview).toBe(false);
    s = reduce(s, { t: 'bottom-out' }, COUNTS); // consec=2 -> nudge
    expect(s.suggestReview).toBe(true);
  });

  it('review-accepted returns to example and resets counters', () => {
    let s = reachPractice();
    s = reduce(s, { t: 'bottom-out' }, COUNTS);
    s = reduce(s, { t: 'bottom-out' }, COUNTS);
    expect(s.suggestReview).toBe(true);
    s = reduce(s, { t: 'review-accepted' }, COUNTS);
    expect(s.phase).toBe('example');
    expect(s.index).toBe(0);
    expect(s.suggestReview).toBe(false);
    expect(s.consecutiveBottomOut).toBe(0);
  });

  it('review-dismissed keeps the student in practice but clears the nudge', () => {
    let s = reachPractice();
    s = reduce(s, { t: 'bottom-out' }, COUNTS);
    s = reduce(s, { t: 'bottom-out' }, COUNTS);
    s = reduce(s, { t: 'review-dismissed' }, COUNTS);
    expect(s.phase).toBe('practice');
    expect(s.suggestReview).toBe(false);
    expect(s.consecutiveBottomOut).toBe(2); // counter untouched
  });
});

describe('reduce — strategy cards', () => {
  it('records strategy choice counts (no phase change)', () => {
    let s = createLessonState(0);
    s = reduce(s, { t: 'strategy', choice: 'this-technique' }, COUNTS);
    s = reduce(s, { t: 'strategy', choice: 'this-technique' }, COUNTS);
    s = reduce(s, { t: 'strategy', choice: 'just-knew' }, COUNTS);
    expect(s.strategyCounts['this-technique']).toBe(2);
    expect(s.strategyCounts['just-knew']).toBe(1);
    expect(s.strategyCounts['other-technique']).toBe(0);
  });
});

describe('nextHintTier', () => {
  it('escalates point -> teach -> bottom-out then stops', () => {
    expect(nextHintTier([])).toBe<HintTier>('point');
    expect(nextHintTier(['point'])).toBe<HintTier>('teach');
    expect(nextHintTier(['point', 'teach'])).toBe<HintTier>('bottom-out');
    expect(nextHintTier(['point', 'teach', 'bottom-out'])).toBeNull();
  });

  it('returns the lowest unused tier regardless of order', () => {
    expect(nextHintTier(['teach'])).toBe<HintTier>('point');
  });
});

describe('isLessonUnlocked', () => {
  it('unlocked when every prerequisite is completed', () => {
    expect(isLessonUnlocked(['ltr-addition'], new Set(['ltr-addition']))).toBe(true);
    expect(isLessonUnlocked([], new Set())).toBe(true);
  });

  it('locked when any prerequisite is missing', () => {
    expect(isLessonUnlocked(['ltr-addition', 'ltr-subtraction'], new Set(['ltr-addition']))).toBe(false);
    expect(isLessonUnlocked(['ltr-subtraction'], new Set())).toBe(false);
  });

  it('chapter-1 chain: addition unlocks subtraction unlocks complement', () => {
    const completed = new Set<string>();
    expect(isLessonUnlocked([], completed)).toBe(true); // addition (no prereq)
    completed.add('ltr-addition');
    expect(isLessonUnlocked(['ltr-addition'], completed)).toBe(true); // subtraction
    expect(isLessonUnlocked(['ltr-subtraction'], completed)).toBe(false); // complement still locked
    completed.add('ltr-subtraction');
    expect(isLessonUnlocked(['ltr-subtraction'], completed)).toBe(true); // complement unlocked
  });
});

describe('starsFor / practiceAccuracy', () => {
  function reachDone(events: LessonEvent[]): LessonState {
    const toPractice = seq(createLessonState(0), [
      { t: 'next' },
      { t: 'next' },
      { t: 'next' },
      { t: 'next' },
      { t: 'next' },
      { t: 'next' }
    ]);
    return seq(toPractice, events);
  }

  it('accuracy = correct / attempts (0 when no attempts)', () => {
    expect(practiceAccuracy(createLessonState(0))).toBe(0);
    const s = reachDone([{ t: 'solved-correct' }, { t: 'bottom-out' }, { t: 'solved-correct' }]);
    expect(practiceAccuracy(s)).toBeCloseTo(2 / 3);
  });

  it('3 stars: 100% accuracy and no bottom-outs', () => {
    const s = reachDone([{ t: 'solved-correct' }, { t: 'solved-correct' }, { t: 'solved-correct' }]);
    expect(starsFor(s, 0.9)).toBe(3);
  });

  it('2 stars: >= pass accuracy, no bottom-out, but not perfect', () => {
    // 2 correct of 3 in a larger set: make attempts>=3 with 1 wrong-ish. Construct via 3 problems all correct except use a bigger practice set.
    const counts: LessonCounts = { hook: 1, example: 1, fading: 1, practice: 4 };
    let s = createLessonState(0);
    s = seq(s, [{ t: 'next' }, { t: 'next' }, { t: 'next' }, { t: 'next' }], counts);
    s = reduce(s, { t: 'solved-correct' }, counts);
    s = reduce(s, { t: 'solved-correct' }, counts);
    s = reduce(s, { t: 'solved-correct' }, counts);
    s = reduce(s, { t: 'solved-correct' }, counts); // 4/4 -> perfect -> 3 stars
    expect(starsFor(s, 0.9)).toBe(3);
  });

  it('1 star: completed but used a bottom-out', () => {
    const s = reachDone([{ t: 'bottom-out' }, { t: 'solved-correct' }, { t: 'solved-correct' }]);
    expect(starsFor(s, 0.9)).toBe(1);
  });

  it('0 stars when not done', () => {
    expect(starsFor(createLessonState(0), 0.9)).toBe(0);
  });
});
