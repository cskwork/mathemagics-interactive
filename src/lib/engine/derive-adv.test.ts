import { describe, expect, it } from 'vitest';
import {
  square4Layout,
  mul3x2Layout,
  square5Layout,
  mul3x3Layout,
  mul5x5Layout,
  deriveAdvSteps
} from './derive-adv.js';
import { deriveSteps, computeAnswer } from './derive.js';
import { deriveGrid } from './derive-internals.js';
import { generateProblem } from './generate.js';
import type { Problem } from './types.js';

/** write 스텝(answer 칸)을 모아 오른쪽 정렬 → 최종 답. */
function answerFromSteps(problem: Problem): string {
  const grid = deriveGrid(problem);
  const steps = deriveSteps(problem);
  const cells = new Map<string, string>();
  for (const s of steps) {
    if (s.t === 'write' || s.t === 'reveal') {
      if (s.t === 'reveal') for (const c of s.cells) cells.set(c, s.value);
      else cells.set(s.cell, s.value);
    }
  }
  const digitCols = grid.cols.slice(1);
  let out = '';
  for (const col of digitCols) {
    const v = cells.get(`answer.${col}`);
    if (v !== undefined) out += v;
  }
  return out;
}

// ── 레이아웃: 독립 산술 대조 ──────────────────────────────────────────────────────

describe('square4Layout — A² = (A+d)(A−d) + d² matches A*A', () => {
  it('4267² = 18,207,289 (book-content-map §8-2 공식 예제)', () => {
    const lay = square4Layout(4267);
    expect(lay.answer).toBe(4267 * 4267);
    expect(lay.answer).toBe(18_207_289);
  });
  it('d² ≤ 250,000 (d ≤ 500) for 4-digit bases', () => {
    for (const base of [1234, 4267, 5000, 9999, 1001]) {
      const lay = square4Layout(base);
      expect(lay.d).toBeLessThanOrEqual(500);
      expect(lay.dSquared).toBeLessThanOrEqual(250_000);
    }
  });
  it('carry.willCarry correct vs (lowPart + d² ≥ 1e6)', () => {
    for (const base of [1234, 4267, 5500, 9999]) {
      const lay = square4Layout(base);
      expect(lay.carry.threshold).toBe(1_000_000);
      expect(lay.carry.willCarry).toBe(lay.carry.lowPart + lay.carry.addition >= 1_000_000);
    }
  });
});

describe('mul3x2Layout — a*b matches', () => {
  it('386 × 51 = 19,686 (덧셈법 예제)', () => {
    const lay = mul3x2Layout(386, 51);
    expect(lay.answer).toBe(386 * 51);
    expect(lay.tens).toBe(50);
    expect(lay.units).toBe(1);
    expect(lay.tensProduct).toBe(19_300);
  });
  it('5 random 3×2 match a*b', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const p = generateProblem(seed, { op: 'mul', method: 'mul-3x2', digits: 3, carry: true });
      const a = p.operands[0] ?? 0;
      const b = p.operands[1] ?? 0;
      expect(mul3x2Layout(a, b).answer).toBe(a * b);
    }
  });
});

describe('square5Layout — 3항 분해 matches A*A', () => {
  it('46,792² matches 46792*46792', () => {
    const lay = square5Layout(46792);
    expect(lay.answer).toBe(46792 * 46792);
    // 3항 전개: a²·1e6 + 2ab·1e3 + b²
    expect(lay.answer).toBe(lay.aSquared * 1_000_000 + lay.twoAB * 1000 + lay.bSquared);
  });
  it('5 random 5-digit squares match', () => {
    for (let seed = 3; seed <= 7; seed++) {
      const p = generateProblem(seed, { op: 'mul', method: 'square-5digit', digits: 5, carry: true });
      const a = p.operands[0] ?? 0;
      expect(square5Layout(a).answer).toBe(a * a);
    }
  });
});

describe('mul3x3Layout — 근접수법 (z+a)(z+b) matches a*b', () => {
  it('396 × 387 = 153,252 (book-content-map §8-8 예제)', () => {
    const lay = mul3x3Layout(396, 387);
    expect(lay.answer).toBe(396 * 387);
    expect(lay.answer).toBe(153_252);
    expect(lay.z).toBe(400);
    expect(lay.zTimesMid).toBe(153_200);
    expect(lay.deviationProduct).toBe(52);
  });
  it('107 × 111 = 11,877', () => {
    const lay = mul3x3Layout(107, 111);
    expect(lay.answer).toBe(107 * 111);
    expect(lay.answer).toBe(11_877);
  });
});

describe('mul5x5Layout — 4분할 matches a*b', () => {
  it('27,639 × 52,196 matches (book-content-map §8-11)', () => {
    const lay = mul5x5Layout(27, 639, 52, 196);
    expect(lay.answer).toBe(27639 * 52196);
  });
  it('5 random 5×5 match', () => {
    for (let seed = 11; seed <= 15; seed++) {
      const p = generateProblem(seed, { op: 'mul', method: 'mul-5x5', digits: 5, carry: true });
      const a = p.operands[0] ?? 0;
      const b = p.operands[1] ?? 0;
      const ah = Math.floor(a / 1000);
      const al = a % 1000;
      const bh = Math.floor(b / 1000);
      const bl = b % 1000;
      expect(mul5x5Layout(ah, al, bh, bl).answer).toBe(a * b);
    }
  });
});

// ── deriveSteps 전체: 답칸 write 가 정답과 일치 ─────────────────────────────────

describe('deriveAdvSteps — answer cells match independent computation', () => {
  for (const [method, seed, digits] of [
    ['square-4digit', 1, 4],
    ['mul-3x2', 2, 3],
    ['square-5digit', 3, 5],
    ['mul-3x3', 4, 3],
    ['mul-5x5', 5, 5]
  ] as const) {
    it(`${method}: steps produce correct answer`, () => {
      const p = generateProblem(seed, {
        op: 'mul',
        method,
        digits,
        carry: true
      });
      const a = p.operands[0] ?? 0;
      const b = p.operands[1] ?? 0;
      const expected = method.startsWith('square') ? a * a : a * b;
      expect(Number(answerFromSteps(p))).toBe(expected);
      expect(computeAnswer(p)).toBe(expected);
    });
  }

  it('square-4digit known: 4267² answer cells = 18207289', () => {
    const p: Problem = { op: 'mul', operands: [4267, 4267], method: 'square-4digit', level: 1 };
    expect(Number(answerFromSteps(p))).toBe(18_207_289);
  });

  it('mul-3x3 known: 396 × 387 = 153252', () => {
    const p: Problem = { op: 'mul', operands: [396, 387], method: 'mul-3x3', level: 1 };
    expect(Number(answerFromSteps(p))).toBe(153_252);
  });
});

// ── memory 스텝 + 자리올림 선예측 등장 ──────────────────────────────────────────

describe('deriveAdvSteps — memory steps + carry pre-prediction present', () => {
  it('square-4digit names the actual round anchor and states the exact no-carry bound', () => {
    const p: Problem = { op: 'mul', operands: [5546, 5546], method: 'square-4digit', level: 1 };
    const narrations = deriveAdvSteps(p)
      .filter((s) => s.t === 'highlight')
      .flatMap((s) => (s.narration ? [s.narration.ko] : []));

    expect(narrations[0]).toContain('6000');
    expect(narrations).toContainEqual(expect.stringContaining('758,116 < 1,000,000'));
    expect(narrations).not.toContainEqual(expect.stringContaining('758,116 < 750,000'));
  });

  it('square-4digit applies a carry before telling the learner to speak the leading part', () => {
    const p: Problem = { op: 'mul', operands: [7562, 7562], method: 'square-4digit', level: 1 };
    const narrations = deriveAdvSteps(p)
      .filter((s) => s.t === 'highlight' || s.t === 'memory')
      .map((s) => s.narration?.ko ?? '');
    const carryIndex = narrations.findIndex((text) => text.includes('≥ 1,000,000'));
    const speakIndex = narrations.findIndex((text) => text.includes('57 million') && text.includes('먼저 말해요'));

    expect(carryIndex).toBeGreaterThanOrEqual(0);
    expect(speakIndex).toBeGreaterThan(carryIndex);
    expect(narrations).not.toContainEqual(expect.stringContaining('56 million을(를) 먼저 말'));
  });

  it('square-4digit emits memory store/recall steps', () => {
    const p: Problem = { op: 'mul', operands: [4267, 4267], method: 'square-4digit', level: 1 };
    const mem = deriveAdvSteps(p).filter((s) => s.t === 'memory');
    expect(mem.length).toBeGreaterThanOrEqual(2);
    expect(mem.some((s) => s.t === 'memory' && s.action === 'store')).toBe(true);
    expect(mem.some((s) => s.t === 'memory' && s.action === 'recall')).toBe(true);
  });

  it('mul-3x2 emits memory store + recall (tens product held)', () => {
    const p: Problem = { op: 'mul', operands: [386, 51], method: 'mul-3x2', level: 1 };
    const mem = deriveAdvSteps(p).filter((s) => s.t === 'memory');
    expect(mem.length).toBeGreaterThanOrEqual(2);
  });

  it('square-5digit stores the middle term (2ab) in a slot', () => {
    const p: Problem = { op: 'mul', operands: [46792, 46792], method: 'square-5digit', level: 1 };
    const stored = deriveAdvSteps(p).filter(
      (s) => s.t === 'memory' && s.action === 'store'
    );
    expect(stored.length).toBeGreaterThanOrEqual(1);
  });
});
