import { describe, expect, it } from 'vitest';
import { DEFAULT_SRS_CONFIG } from './config.js';
import {
  adjustBand,
  bandToParams,
  paramsToBand,
  adjustFromAccuracy,
  type GenParams
} from './difficulty.js';

describe('bandToParams / paramsToParams (밴드 ↔ 생성 파라미터)', () => {
  it('band 0 = 2자리 올림없음, band 1 = 2자리 올림, band 2 = 3자리 올림, band 3+ = 4자리 올림', () => {
    const c = DEFAULT_SRS_CONFIG;
    expect(bandToParams(0, c)).toEqual({ digits: 2, carry: false });
    expect(bandToParams(1, c)).toEqual({ digits: 2, carry: true });
    expect(bandToParams(2, c)).toEqual({ digits: 3, carry: true });
    expect(bandToParams(3, c)).toEqual({ digits: 4, carry: true });
    expect(bandToParams(4, c)).toEqual({ digits: 4, carry: true });
  });

  it('밴드 상한 클램프 (maxDifficultyBand 초과 불가)', () => {
    const c = DEFAULT_SRS_CONFIG;
    expect(bandToParams(99, c)).toEqual(bandToParams(c.maxDifficultyBand, c));
  });

  it('paramsToBand: {2,false}→0, {2,true}→1, {3,true}→2, {4,true}→3', () => {
    const cases: Array<[GenParams, number]> = [
      [{ digits: 2, carry: false }, 0],
      [{ digits: 2, carry: true }, 1],
      [{ digits: 3, carry: true }, 2],
      [{ digits: 4, carry: true }, 3]
    ];
    for (const [p, expected] of cases) {
      expect(paramsToBand(p)).toBe(expected);
    }
  });
});

describe('adjustBand (ZPD 80–90%)', () => {
  it('accuracy < 0.8 → 한 눈금 하향(더 쉽게)', () => {
    const c = DEFAULT_SRS_CONFIG;
    expect(adjustBand(0.5, 2, c)).toBe(1);
    expect(adjustBand(0.79, 3, c)).toBe(2);
  });

  it('accuracy > 0.9 → 한 눈금 상향(더 어렵게)', () => {
    const c = DEFAULT_SRS_CONFIG;
    expect(adjustBand(0.95, 1, c)).toBe(2);
    expect(adjustBand(1.0, 0, c)).toBe(1);
  });

  it('0.8 ≤ accuracy ≤ 0.9 → 유지(ZPD)', () => {
    const c = DEFAULT_SRS_CONFIG;
    expect(adjustBand(0.8, 2, c)).toBe(2);
    expect(adjustBand(0.85, 2, c)).toBe(2);
    expect(adjustBand(0.9, 2, c)).toBe(2);
  });

  it('하단(0) 에서 더 하향 불가 — 고정', () => {
    expect(adjustBand(0.3, 0, DEFAULT_SRS_CONFIG)).toBe(0);
  });

  it('상단(maxBand) 에서 더 상향 불가 — 고정', () => {
    const c = DEFAULT_SRS_CONFIG;
    expect(adjustBand(1.0, c.maxDifficultyBand, c)).toBe(c.maxDifficultyBand);
  });

  it('잘못된 accuracy(NaN/음수/초과) 는 유지(판단 보류)', () => {
    const c = DEFAULT_SRS_CONFIG;
    expect(adjustBand(NaN, 2, c)).toBe(2);
    expect(adjustBand(-0.1, 2, c)).toBe(2);
    expect(adjustBand(1.5, 2, c)).toBe(2);
  });
});

describe('adjustFromAccuracy', () => {
  it('direction 방향 보고', () => {
    const c = DEFAULT_SRS_CONFIG;
    expect(adjustFromAccuracy(0.5, 2, c).direction).toBe('easier');
    expect(adjustFromAccuracy(1.0, 1, c).direction).toBe('harder');
    expect(adjustFromAccuracy(0.85, 2, c).direction).toBe('same');
  });

  it('params 갱신이 direction 과 일치', () => {
    const c = DEFAULT_SRS_CONFIG;
    const easier = adjustFromAccuracy(0.5, 2, c);
    expect(easier.params.digits).toBeLessThanOrEqual(3);
    const harder = adjustFromAccuracy(1.0, 1, c);
    expect(harder.params).toEqual(bandToParams(2, c));
  });
});
