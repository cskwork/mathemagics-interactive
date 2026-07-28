import { describe, expect, it } from 'vitest';
import { cellAriaLabel } from './aria.js';

/**
 * 접근성 라벨 단위 테스트(PLAN §5.3 / 브리프 §3).
 * DOM 렌더링 없이 라벨 생성 로직을 검증한다(테스트 환경은 baseLocale=ko).
 * 셀 aria-label("십의 자리, 7"), 부호·받아올림·답 칸 변형, 자릿값 매핑을 확인.
 */
describe('cellAriaLabel', () => {
  it('operand digit: "<place>, <digit>"', () => {
    expect(cellAriaLabel('op1', 1, '7', 'add')).toBe('십의 자리, 7');
    expect(cellAriaLabel('op2', 0, '8', 'add')).toBe('일의 자리, 8');
    expect(cellAriaLabel('op1', 2, '3', 'sub')).toBe('백의 자리, 3');
    expect(cellAriaLabel('op1', 3, '9', 'add')).toBe('천의 자리, 9');
  });

  it('answer cell: empty → "<place> 답 칸", filled → "<place>, <digit>"', () => {
    expect(cellAriaLabel('answer', 0, '', 'add')).toBe('일의 자리 답 칸');
    expect(cellAriaLabel('answer', 1, '5', 'add')).toBe('십의 자리, 5');
  });

  it('carry cell: "<place> 받아올림 <digit>"', () => {
    expect(cellAriaLabel('carry', 2, '1', 'add')).toBe('백의 자리 받아올림 1');
    expect(cellAriaLabel('carry', 0, '', 'add')).toBe('일의 자리');
  });

  it('sign cell: add → "더하기", sub → "빼기"', () => {
    expect(cellAriaLabel('op2', -1, '+', 'add')).toBe('더하기');
    expect(cellAriaLabel('op2', -1, '−', 'sub')).toBe('빼기');
  });

  it('empty operand cell → place name only', () => {
    expect(cellAriaLabel('op1', 1, '', 'add')).toBe('십의 자리');
  });
});
