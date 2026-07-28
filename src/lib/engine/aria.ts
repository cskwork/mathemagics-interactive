/**
 * 셀 접근성 라벨 생성(PLAN §5.3 / 리서치 §1.5) — 순수 함수.
 *
 * ColumnGrid 컴포넌트 안에 두면 DOM 없이 테스트할 수 없어, 로직을 분리했다.
 * 각 셀은 자릿값(place value) 기반 `aria-label` 을 갖는다(예: "십의 자리, 7",
 * "백의 자리 받아올림 1", "일의 자리 답 칸"). 부호 셀은 연산 이름.
 *
 * 텍스트는 Paraglide 컴파일 메시지(m.*)에서 온다 — 하드코딩된 UI 문자열 없음(규약 §4).
 * 테스트 환경에서는 baseLocale(ko) 기본값이 쓰인다.
 */
import { m } from '../paraglide/messages.js';
import type { Op, RowId } from './types.js';

const PLACE_LABELS: Record<number, () => string> = {
  0: m.place_units,
  1: m.place_tens,
  2: m.place_hundreds,
  3: m.place_thousands
};

function placeLabel(place: number): string {
  return (PLACE_LABELS[place] ?? m.place_units)();
}

/**
 * 셀의 aria-label 을 组立.
 * @param rowId 행(carry/op1/op2/answer)
 * @param place 자릿값(0=일의 자리, …); 부호 열은 -1
 * @param value 표시 중인 글자(없으면 '')
 * @param op 연산(부호 셔 판별용)
 */
export function cellAriaLabel(rowId: RowId, place: number, value: string, op: Op): string {
  if (place < 0) {
    // 부호 열(op2.c1)
    if (rowId === 'op2') return op === 'sub' ? m.aria_sign_sub() : m.aria_sign_add();
    return '';
  }
  const placeName = placeLabel(place);
  if (rowId === 'answer') {
    return value
      ? m.aria_answer_filled({ place: placeName, digit: value })
      : m.aria_answer_empty({ place: placeName });
  }
  if (rowId === 'carry') {
    return value ? m.aria_carry({ place: placeName, digit: value }) : placeName;
  }
  // op1 / op2 자릿값
  return value ? m.aria_operand_digit({ place: placeName, digit: value }) : placeName;
}
