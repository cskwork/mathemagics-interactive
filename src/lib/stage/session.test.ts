import { describe, expect, it } from 'vitest';
import { generateProblem } from '../engine/generate.js';
import type { Problem } from '../engine/types.js';
import { loadAllLessons } from '../lesson/loader.js';
import { isStageReadyLesson, stageProgressDelta, stageQuestion } from './session.js';

describe('Stage question model', () => {
  it('accounts for every submitted answer without turning misses into correct solves', () => {
    expect(stageProgressDelta(5, 1)).toEqual({
      practiceAttempts: 6,
      practiceCorrect: 5
    });
  });

  it('renders and answers every current lesson practice shape', () => {
    const lessons = loadAllLessons();
    const numericLessons = lessons.filter((lesson) => lesson.file.skillId !== 'divisibility');

    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.filter(isStageReadyLesson)).toHaveLength(numericLessons.length);
    for (const lesson of numericLessons) {
      for (const problem of lesson.practiceProblems) {
        const question = stageQuestion(problem);
        expect(question, lesson.file.skillId).toBeDefined();
        expect(question?.expression.length, lesson.file.skillId).toBeGreaterThan(0);
        expect(Number.isSafeInteger(question?.answer), lesson.file.skillId).toBe(true);
      }
    }
    const divisibility = lessons.find((lesson) => lesson.file.skillId === 'divisibility');
    expect(divisibility).toBeDefined();
    if (divisibility) expect(isStageReadyLesson(divisibility)).toBe(false);
  });

  it('keeps multi-addend, square-root, quotient, and estimate prompts truthful', () => {
    const columnAdd: Problem = {
      op: 'add', operands: [12, 23, 34], method: 'paper-column-add', level: 1
    };
    const squareRoot: Problem = {
      op: 'sqrt', operands: [144], method: 'paper-sqrt', level: 1
    };
    const division = generateProblem(44, {
      op: 'div', method: 'div-1', digits: 2, carry: true
    });
    const estimate: Problem = {
      op: 'est', operands: [1_234, 5_678], method: 'est-digit', level: 1, estOf: 'add'
    };

    expect(stageQuestion(columnAdd)).toEqual({
      expression: '12 + 23 + 34', answer: 69, answerKind: 'value'
    });
    expect(stageQuestion(squareRoot)).toEqual({
      expression: '√144', answer: 12, answerKind: 'value'
    });
    expect(stageQuestion(division)).toMatchObject({
      expression: `${division.operands[0]} ÷ ${division.operands[1]}`,
      answer: Math.floor((division.operands[0] ?? 0) / (division.operands[1] ?? 1)),
      answerKind: 'quotient'
    });
    expect(stageQuestion(estimate)).toEqual({
      expression: '1200 + 5700', answer: 6900, answerKind: 'value'
    });
  });

  it('rejects shapes the Stage keypad cannot answer', () => {
    expect(stageQuestion({ op: 'sub', operands: [2, 3], method: 'ltr', level: 1 })).toBeUndefined();
    expect(stageQuestion({ op: 'div', operands: [10, 0], method: 'div-1', level: 1 })).toBeUndefined();
    expect(stageQuestion({ op: 'add', operands: [1.5, 2], method: 'ltr', level: 1 })).toBeUndefined();
    expect(stageQuestion({ op: 'add', operands: [1, 2, 3], method: 'ltr', level: 1 })).toBeUndefined();
    expect(stageQuestion({ op: 'mul', operands: [12, 13], method: 'square', level: 1 })).toBeUndefined();
    expect(stageQuestion({ op: 'div', operands: [123, 3], method: 'divisibility', level: 1 })).toBeUndefined();
  });
});
