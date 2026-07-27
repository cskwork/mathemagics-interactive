/**
 * "마지막에 쓴 프로필 id" 만 localStorage 에 둔다.
 *
 * PLAN.md §6.1: 실제 데이터는 전부 IndexedDB. localStorage 는 이런 소형 플래그 전용
 * (동기 API 라 메인 스레드를 막고, 용량/구조 모두 부족하므로).
 */
const KEY = 'mathemagics.lastProfileId';

export function readLastProfileId(): string | undefined {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? undefined;
  } catch {
    // Safari 프라이빗 모드 등에서 접근이 던질 수 있다 — 없는 것으로 취급.
    return undefined;
  }
}

export function writeLastProfileId(id: string | undefined): void {
  try {
    if (id === undefined) globalThis.localStorage?.removeItem(KEY);
    else globalThis.localStorage?.setItem(KEY, id);
  } catch {
    // 저장 실패는 치명적이지 않다 — 다음 부팅에 프로필 선택 화면이 뜰 뿐.
  }
}
