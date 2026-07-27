/**
 * vitest 전역 셋업.
 * fake-indexeddb/auto 가 globalThis 에 indexedDB / IDBKeyRange 를 심어 주므로
 * DexieAdapter 를 node 환경(=jsdom 의존성 없이)에서 그대로 계약 테스트할 수 있다.
 */
import 'fake-indexeddb/auto';
