import { computeAnswer } from '../engine/derive.js';
import { estimationBand } from '../engine/derive-est.js';
import type { Problem } from '../engine/types.js';
import type { Lesson } from '../lesson/types.js';

export interface StageQuestion {
  readonly expression: string;
  readonly answer: number;
  readonly answerKind: 'value' | 'quotient';
}

const SQUARE_METHODS = new Set<Problem['method']>(['square', 'square-4digit', 'square-5digit']);

/**
 * Turns a semantic lesson problem into the Stage's digit-only question shape.
 * Unsupported numeric shapes return undefined so they cannot be offered on Stage.
 */
export function stageQuestion(problem: Problem): StageQuestion | undefined {
  if (
    problem.method === 'divisibility' ||
    problem.operands.length === 0 ||
    problem.operands.some((operand) => !Number.isSafeInteger(operand) || operand < 0)
  ) {
    return undefined;
  }

  const [a, b] = problem.operands;
  let expression: string;
  let answerKind: StageQuestion['answerKind'] = 'value';
  let answer: number;

  switch (problem.op) {
    case 'add':
      if (
        problem.operands.length < 2 ||
        (problem.method !== 'paper-column-add' && problem.operands.length !== 2)
      ) return undefined;
      expression = problem.operands.join(' + ');
      answer = computeAnswer(problem);
      break;
    case 'sub':
      if (b === undefined || problem.operands.length !== 2) return undefined;
      expression = `${a} − ${b}`;
      answer = computeAnswer(problem);
      break;
    case 'mul':
      if (
        b === undefined ||
        problem.operands.length !== 2 ||
        (SQUARE_METHODS.has(problem.method) && a !== b)
      ) return undefined;
      expression = SQUARE_METHODS.has(problem.method) ? `${a}²` : `${a} × ${b}`;
      answer = computeAnswer(problem);
      break;
    case 'div':
      if (b === undefined || b === 0 || problem.operands.length !== 2) return undefined;
      expression = `${a} ÷ ${b}`;
      answer = computeAnswer(problem);
      answerKind = 'quotient';
      break;
    case 'est': {
      if (b === undefined || problem.operands.length !== 2) return undefined;
      const band = estimationBand(problem);
      expression = band.roundingNote.ko;
      answer = band.estimate;
      break;
    }
    case 'sqrt':
      if (problem.operands.length !== 1) return undefined;
      expression = `√${a}`;
      answer = computeAnswer(problem);
      break;
  }

  if (!Number.isSafeInteger(answer) || answer < 0) return undefined;
  return { expression, answer, answerKind };
}

/** A lesson is Stage-ready only when all of its live practice shapes fit digit-only input. */
export function isStageReadyLesson(lesson: Pick<Lesson, 'practiceProblems'>): boolean {
  return lesson.practiceProblems.length > 0 && lesson.practiceProblems.every((problem) => stageQuestion(problem) !== undefined);
}

/** Stage attempts count every submitted answer; only solved problems count as correct. */
export function stageProgressDelta(solved: number, wrong: number): {
  practiceAttempts: number;
  practiceCorrect: number;
} {
  return {
    practiceAttempts: solved + wrong,
    practiceCorrect: solved
  };
}
