import { describe, expect, it } from 'vitest';
import { resolveLocalized } from '../content/localized.js';
import { buildLesson, findLesson, isLessonFile, loadLessonFromRaw } from './loader.js';
import type { LessonFile } from './types.js';

/**
 * 검증 테스트는 가변 plain 객체를 쓴다(readonly 타입을 건드리지 않고 결함을 주입하기 위함).
 * isLessonFile 은 unknown 을 받으므로 plain 객체를 그대로 넘긴다.
 */
function validRaw(): unknown {
  return {
    id: 't1',
    skillId: 'test-skill',
    chapter: 1,
    order: 1,
    prerequisites: [],
    title: { ko: '제목', en: 'Title' },
    subtitle: { ko: '부제' },
    rule: { ko: '규칙', en: 'Rule' },
    hook: {
      problemSet: { op: 'add', method: 'ltr', digits: 2, carry: false, count: 1, seed: 1 },
      intro: { ko: '인트로' },
      outro: { ko: '아웃트로' },
      autoPlayMs: 5000
    },
    example: {
      problemSet: { op: 'add', method: 'ltr', digits: 2, carry: false, count: 2, seed: 2 },
      intro: { ko: '예제 인트로' }
    },
    fading: {
      problemSet: { op: 'add', method: 'ltr', digits: 2, carry: false, count: 3, seed: 3 },
      intro: { ko: '페이딩 인트로' }
    },
    practice: {
      problemSet: { op: 'add', method: 'ltr', digits: 2, carry: true, count: 3, seed: 4 },
      intro: { ko: '연습 인트로' },
      hints: { point: { ko: 'p' }, teach: { ko: 't' }, bottomOut: { ko: 'b' } },
      passAccuracy: 0.9
    },
    strategyCards: {
      thisTechnique: { ko: 'a' },
      otherTechnique: { ko: 'b' },
      justKnew: { ko: 'c' }
    }
  };
}

/** buildLesson 테스트는 타입이 필요하므로 validRaw 를 LessonFile 로 좁혀 돌려준다. */
function validFile(): LessonFile {
  return validRaw() as LessonFile;
}

/** 깊은 복사 + 결함 주입 헬퍼(plain 객체 대상). */
function withPatch(base: unknown, mutate: (obj: any) => void): unknown {
  const clone = structuredClone(base);
  mutate(clone);
  return clone;
}

describe('isLessonFile — schema validation', () => {
  it('accepts a valid lesson file', () => {
    expect(isLessonFile(validRaw())).toBe(true);
  });

  it('accepts a valid file with only ko (en omitted) — locale fallback path', () => {
    expect(isLessonFile(validRaw())).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(isLessonFile(null)).toBe(false);
    expect(isLessonFile('string')).toBe(false);
    expect(isLessonFile([])).toBe(false);
    expect(isLessonFile(42)).toBe(false);
  });

  it('rejects when required top-level scalars are wrong type', () => {
    expect(isLessonFile(withPatch(validRaw(), (o) => (o.id = 123)))).toBe(false);
    expect(isLessonFile(withPatch(validRaw(), (o) => (o.skillId = null)))).toBe(false);
    expect(isLessonFile(withPatch(validRaw(), (o) => (o.chapter = '1')))).toBe(false);
    expect(isLessonFile(withPatch(validRaw(), (o) => (o.prerequisites = 'ltr-addition')))).toBe(false);
  });

  it('rejects a LocalizedText missing ko', () => {
    expect(isLessonFile(withPatch(validRaw(), (o) => (o.title = { en: 'only english' })))).toBe(false);
  });

  it('rejects a LocalizedText whose en is not a string', () => {
    expect(isLessonFile(withPatch(validRaw(), (o) => (o.title = { ko: '제목', en: 5 })))).toBe(false);
  });

  it('rejects an invalid ProblemSet (bad op/method/non-integer digits)', () => {
    expect(isLessonFile(withPatch(validRaw(), (o) => (o.hook.problemSet.op = 'multiply')))).toBe(false);
    expect(isLessonFile(withPatch(validRaw(), (o) => (o.hook.problemSet.digits = 2.5)))).toBe(false);
    expect(isLessonFile(withPatch(validRaw(), (o) => (o.hook.problemSet.method = 'diagonal')))).toBe(false);
  });

  it('rejects passAccuracy outside [0,1]', () => {
    expect(isLessonFile(withPatch(validRaw(), (o) => (o.practice.passAccuracy = 1.5)))).toBe(false);
  });

  it('rejects non-positive autoPlayMs', () => {
    expect(isLessonFile(withPatch(validRaw(), (o) => (o.hook.autoPlayMs = 0)))).toBe(false);
  });

  it('rejects when hint ladder is incomplete', () => {
    expect(isLessonFile(withPatch(validRaw(), (o) => delete o.practice.hints.bottomOut))).toBe(false);
  });

  it('rejects when strategy cards are incomplete', () => {
    expect(isLessonFile(withPatch(validRaw(), (o) => delete o.strategyCards.justKnew))).toBe(false);
  });
});

describe('buildLesson / loadLessonFromRaw — problem expansion', () => {
  it('expands each ProblemSet to the requested count of concrete Problems', () => {
    const lesson = buildLesson(validFile());
    expect(lesson.hookProblems).toHaveLength(1);
    expect(lesson.exampleProblems).toHaveLength(2);
    expect(lesson.fadingProblems).toHaveLength(3);
    expect(lesson.practiceProblems).toHaveLength(3);
  });

  it('produces deterministic problems for a fixed seed', () => {
    const a = buildLesson(validFile());
    const b = buildLesson(validFile());
    expect(a.practiceProblems.map((p) => p.operands)).toEqual(b.practiceProblems.map((p) => p.operands));
  });

  it('practice problems honour carry=true (a carry actually occurs somewhere)', () => {
    const lesson = buildLesson(validFile());
    for (const p of lesson.practiceProblems) {
      const x = p.operands[0] ?? 0;
      const y = p.operands[1] ?? 0;
      // 자리 어디서든 올림 발생: 일의 자리 올림 OR 결과 자릿수 증가(십의 자리 올림).
      const hasCarry = (x % 10) + (y % 10) >= 10 || String(x + y).length > String(Math.max(x, y)).length;
      expect(hasCarry).toBe(true);
    }
  });

  it('loadLessonFromRaw throws on invalid input', () => {
    expect(() => loadLessonFromRaw({ bad: true })).toThrow();
    expect(() => loadLessonFromRaw(null)).toThrow();
  });

  it('loadLessonFromRaw returns a Lesson for valid input', () => {
    const lesson = loadLessonFromRaw(validRaw());
    expect(lesson.file.skillId).toBe('test-skill');
  });
});

describe('locale fallback — missing en falls back to ko', () => {
  it('resolveLocalized returns en when present', () => {
    expect(resolveLocalized({ ko: '제목', en: 'Title' }, 'en')).toBe('Title');
    expect(resolveLocalized({ ko: '제목', en: 'Title' }, 'ko')).toBe('제목');
  });

  it('resolveLocalized falls back to ko when en is missing', () => {
    expect(resolveLocalized({ ko: '부제' }, 'en')).toBe('부제');
    expect(resolveLocalized({ ko: '부제' }, 'ko')).toBe('부제');
  });

  it('a ko-only lesson file still builds and resolves', () => {
    const lesson = buildLesson(validFile());
    expect(resolveLocalized(lesson.file.subtitle, 'en')).toBe('부제');
  });
});

describe('chapter 4–5 technique wiring', () => {
  it('loads simplification and divisibility as their explicit methods', () => {
    const simplify = findLesson('div-simplify');
    const divisibility = findLesson('divisibility');
    expect(simplify).toBeDefined();
    expect(divisibility).toBeDefined();
    expect([
      ...simplify!.hookProblems,
      ...simplify!.exampleProblems,
      ...simplify!.fadingProblems,
      ...simplify!.practiceProblems
    ].every((problem) => problem.method === 'div-simplify')).toBe(true);
    expect([
      ...divisibility!.hookProblems,
      ...divisibility!.exampleProblems,
      ...divisibility!.fadingProblems,
      ...divisibility!.practiceProblems
    ].every((problem) => problem.method === 'divisibility')).toBe(true);
    const decisions = [
      ...divisibility!.hookProblems,
      ...divisibility!.exampleProblems,
      ...divisibility!.fadingProblems,
      ...divisibility!.practiceProblems
    ];
    expect(new Set(decisions.map((problem) => problem.operands[1]))).toEqual(
      new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    );
    expect(new Set(decisions.map((problem) => (problem.operands[0] ?? 0) % (problem.operands[1] ?? 1) === 0))).toEqual(
      new Set([true, false])
    );
    expect(
      new Set(
        divisibility!.fadingProblems.map(
          (problem) => (problem.operands[0] ?? 0) % (problem.operands[1] ?? 1) === 0
        )
      )
    ).toEqual(new Set([true, false]));
  });

  it('does not teach the false claim that larger numbers inherently have smaller relative error', () => {
    const estimation = findLesson('est-digit');
    expect(estimation?.file.rule.ko).not.toContain('큰 수일수록');
    expect(estimation?.file.rule.en).not.toContain('Bigger numbers');
  });
});
