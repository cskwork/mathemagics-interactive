/**
 * Safari ITP 7일 축출 대응 (PLAN.md §10-4, architecture-hosting.md §1.3).
 *
 * `navigator.storage.persist()` 가 ITP 타이머를 확실히 이긴다는 공식 문서는 **없다**.
 * 호출 비용이 0이므로 부팅 시 항상 요청하되, 유일한 방어선으로 삼지 않는다
 * (주 방어선은 PWA 홈 화면 설치 유도).
 */
export type PersistenceState = 'granted' | 'denied' | 'unsupported';

export async function requestPersistentStorage(): Promise<PersistenceState> {
  const storage = globalThis.navigator?.storage;
  if (!storage?.persist || !storage.persisted) return 'unsupported';
  try {
    if (await storage.persisted()) return 'granted';
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}
