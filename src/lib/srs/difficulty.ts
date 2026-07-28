/**
 * 적응 난이도 — 순수 함수. PLAN §4.2-7 / teaching-trends §2.1.
 *
 * 최근 성공률이 80–90%(ZPD) 밴드를 벗어나면 생성기 파라미터(자릿수·올림)를
 * 한 눈금 조정한다. 아동 ZPD 유지가 게이미피케이션 중 가장 일관되게 지지되는 요소.
 *
 * 난이도 밴드 → {digits, carry} 매핑(기법 무관, 자릿수+올림 2축):
 *   0: 2자리, 올림 없음
 *   1: 2자리, 올림 있음
 *   2: 3자리, 올림 있음
 *   3: 4자리, 올림 있음
 *   4: 4자리, 올림 있음(심화 — 더 큰 수)
 * 기법에 따라 시작 밴드가 다를 수 있다(레슨 practice digits 기반).
 */
import type { SrsConfig } from './config.js';

export interface GenParams {
  readonly digits: number;
  readonly carry: boolean;
}

/** 밴드 인덱스 → 생성 파라미터. */
export function bandToParams(band: number, config: SrsConfig): GenParams {
  const b = clampBand(band, config);
  switch (b) {
    case 0:
      return { digits: 2, carry: false };
    case 1:
      return { digits: 2, carry: true };
    case 2:
      return { digits: 3, carry: true };
    case 3:
      return { digits: 4, carry: true };
    default:
      return { digits: 4, carry: true };
  }
}

/** {digits, carry} → 가장 가까운 밴드 인덱스(레슨 practice 세트에서 시작 밴드 유도용). */
export function paramsToBand(params: GenParams): number {
  const { digits, carry } = params;
  if (digits <= 2 && !carry) return 0;
  if (digits <= 2 && carry) return 1;
  if (digits === 3) return 2;
  if (digits === 4 && !carry) return 2;
  return 3; // 4자리 올림
}

function clampBand(band: number, config: SrsConfig): number {
  return Math.min(config.maxDifficultyBand, Math.max(0, band));
}

/**
 * 최근 정확도를 보고 밴드를 한 눈금 조정한다.
 * - accuracy < zpdLow(0.8): 한 눈금 내린다(더 쉽게).
 * - accuracy > zpdHigh(0.9): 한 눈금 올린다(더 어렵게).
 * - 그 외(0.8~0.9): 유지(ZPD).
 *
 * @returns 새 밴드 인덱스. 경계 도달 시 더 이상 이동 않음(하단/상단 고정).
 * @param accuracy 최근 복습 정확도(0~1). 샘플 0이면 유지(판단 보류).
 * @param currentBand 현재 밴드.
 */
export function adjustBand(
  accuracy: number,
  currentBand: number,
  config: SrsConfig
): number {
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1) return clampBand(currentBand, config);
  if (accuracy < config.zpdLow) return clampBand(currentBand - 1, config);
  if (accuracy > config.zpdHigh) return clampBand(currentBand + 1, config);
  return clampBand(currentBand, config);
}

/**
 * 한 기법의 카드들이 일정 샘플 이상 복습됐을 때 밴드를 갱신할지, 그리고 새 파라미터를 준다.
 * 세션 종료 시 호출: 최근 정확도 → 새 밴드 → 새 {digits, carry}.
 * 순수 함수 — 부작용 없음.
 */
export interface BandAdjustment {
  readonly band: number;
  readonly params: GenParams;
  /** 이전 대비 변화 방향. */
  readonly direction: 'easier' | 'harder' | 'same';
}

export function adjustFromAccuracy(
  accuracy: number,
  currentBand: number,
  config: SrsConfig
): BandAdjustment {
  const next = adjustBand(accuracy, currentBand, config);
  const direction: BandAdjustment['direction'] =
    next < currentBand ? 'easier' : next > currentBand ? 'harder' : 'same';
  return { band: next, params: bandToParams(next, config), direction };
}
