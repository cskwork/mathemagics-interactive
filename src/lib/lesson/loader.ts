/**
 * 레슨 로더 — content/lessons/*.json → 검증 → 구체적 {@link Lesson}. docs/briefs/M2.md 산출물 1.
 *
 * 스키마 검증은 **직접 작성한 타입가드**로 한다(zod 미도입 사유: 의존성 0 정책(M0~M1) 유지 —
 * 검증 범위가 좁고 타입가드로 충분히 커버 가능. zod 는 약 45KB 런타임 비용).
 *
 * 문제는 {@link ProblemSet}(시드+생성파라미터)로 정의되고, {@link buildLesson}이 M1 생성기로
 * 구체적 {@link Problem}[] 로 펼친다(하드코딩된 피연산자 없음 — 브리프 §2-5).
 *
 * 로케일 폴백: LocalizedText 의 en 이 빠지면 content/localized.ts 의 resolveLocalized 가
 * ko 로 폴백한다(별도 검증 불필요 — en 은 선택 필드).
 */
import { generateProblems } from '../engine/generate.js';
import type { Method, Op, Problem } from '../engine/types.js';
import type { Lesson, LessonFile, ProblemSet, StrategyChoice } from './types.js';

// ── 원시 타입 가드 ────────────────────────────────────────────────────────────

function isString(v: unknown): v is string {
  return typeof v === 'string';
}
function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/** LocalizedText = { ko: string } + (선택) en: string. ko 필수. */
function isLocalizedText(v: unknown): v is { ko: string; en?: string } {
  if (!isObject(v)) return false;
  const ko = v['ko'];
  if (typeof ko !== 'string') return false;
  if ('en' in v && typeof v['en'] !== 'string') return false;
  return true;
}

const OPS: readonly Op[] = ['add', 'sub', 'mul', 'div', 'est', 'sqrt'];
const METHODS: readonly Method[] = [
  'ltr',
  'rtl',
  'mul-running',
  'mul-add',
  'mul-sub',
  'mul-factor',
  'mul-11',
  'square',
  'div-1',
  'est-digit',
  'est-band',
  'paper-column-add',
  'paper-cross-mult',
  'paper-sqrt',
  'mod-sum-check',
  'square-4digit',
  'mul-3x2',
  'square-5digit',
  'mul-3x3',
  'mul-5x5'
];
const STRATEGIES: readonly StrategyChoice[] = ['this-technique', 'other-technique', 'just-knew'];
const EST_OFS: readonly string[] = ['add', 'sub', 'mul', 'div'];

function isOp(v: unknown): v is Op {
  return isString(v) && (OPS as readonly string[]).includes(v);
}
function isMethod(v: unknown): v is Method {
  return isString(v) && (METHODS as readonly string[]).includes(v);
}

/** ProblemSet 검증(시드 포함). */
function isProblemSet(v: unknown): v is ProblemSet {
  if (!isObject(v)) return false;
  if (!(isOp(v['op']) && isMethod(v['method']))) return false;
  if (!isNumber(v['digits']) || (v['digits'] | 0) !== v['digits'] || v['digits'] < 1) return false;
  if (!isBoolean(v['carry'])) return false;
  if (!isNumber(v['count']) || (v['count'] | 0) !== v['count'] || v['count'] < 1) return false;
  if (!isNumber(v['seed']) || (v['seed'] | 0) !== v['seed']) return false;
  // estOf: 선택 필드(op='est' 권장). 값이면 add/sub/mul/div 중 하나.
  if ('estOf' in v && v['estOf'] !== undefined && !(isString(v['estOf']) && EST_OFS.includes(v['estOf']))) {
    return false;
  }
  // operandCount: 선택(paper-column-add). 정수 ≥2.
  if (
    'operandCount' in v &&
    v['operandCount'] !== undefined &&
    (!isNumber(v['operandCount']) || (v['operandCount'] | 0) !== v['operandCount'] || v['operandCount'] < 2)
  ) {
    return false;
  }
  return true;
}

/** LessonFile 전체 검증(손으로 쓴 타입가드). */
export function isLessonFile(v: unknown): v is LessonFile {
  if (!isObject(v)) return false;
  // 최상위 스칼라
  if (!isString(v['id']) || !isString(v['skillId'])) return false;
  if (!isNumber(v['chapter']) || !isNumber(v['order'])) return false;
  if (!isStringArray(v['prerequisites'])) return false;
  if (!isLocalizedText(v['title']) || !isLocalizedText(v['subtitle'])) return false;
  if (!isLocalizedText(v['rule'])) return false;

  // hook
  const hook = v['hook'];
  if (!isObject(hook)) return false;
  if (!isProblemSet(hook['problemSet'])) return false;
  if (!isLocalizedText(hook['intro']) || !isLocalizedText(hook['outro'])) return false;
  if (!isNumber(hook['autoPlayMs']) || hook['autoPlayMs'] <= 0) return false;

  // example
  const example = v['example'];
  if (!isObject(example) || !isProblemSet(example['problemSet'])) return false;
  if (!isLocalizedText(example['intro'])) return false;

  // fading
  const fading = v['fading'];
  if (!isObject(fading) || !isProblemSet(fading['problemSet'])) return false;
  if (!isLocalizedText(fading['intro'])) return false;

  // practice + 힌트 사다리
  const practice = v['practice'];
  if (!isObject(practice) || !isProblemSet(practice['problemSet'])) return false;
  if (!isLocalizedText(practice['intro'])) return false;
  if (!isNumber(practice['passAccuracy']) || practice['passAccuracy'] < 0 || practice['passAccuracy'] > 1) {
    return false;
  }
  const hints = practice['hints'];
  if (!isObject(hints)) return false;
  if (!isLocalizedText(hints['point']) || !isLocalizedText(hints['teach']) || !isLocalizedText(hints['bottomOut'])) {
    return false;
  }

  // 전략 카드
  const strat = v['strategyCards'];
  if (!isObject(strat)) return false;
  if (
    !isLocalizedText(strat['thisTechnique']) ||
    !isLocalizedText(strat['otherTechnique']) ||
    !isLocalizedText(strat['justKnew'])
  ) {
    return false;
  }

  // strategy choice 키 검증은 런타임 값이 아니라 타입 — 디스크엔 값이 아닌 키가 올 수 없으므로 생략.
  void STRATEGIES;
  return true;
}

// ── 빌드 ────────────────────────────────────────────────────────────────────

/** ProblemSet → 구체적 Problem[](M1 생성기). 중복 없이 count 개. */
function expand(set: ProblemSet): Problem[] {
  const base = { op: set.op, method: set.method, digits: set.digits, carry: set.carry };
  const opts =
    set.estOf !== undefined
      ? { ...base, estOf: set.estOf }
      : set.operandCount !== undefined
        ? { ...base, operandCount: set.operandCount }
        : base;
  return generateProblems(set.seed, opts, set.count);
}

/** 검증된 LessonFile → 런타임 Lesson(문제 세트 전개). */
export function buildLesson(file: LessonFile): Lesson {
  return {
    file,
    hookProblems: expand(file.hook.problemSet),
    exampleProblems: expand(file.example.problemSet),
    fadingProblems: expand(file.fading.problemSet),
    practiceProblems: expand(file.practice.problemSet)
  };
}

/**
 * 임의의 파싱된 JSON → Lesson. 검증 실패 시 throw.
 * 단위테스트 진입점(inline JSON 으로 호출 가능 — 파일시스템 의존 없음).
 */
export function loadLessonFromRaw(raw: unknown): Lesson {
  if (!isLessonFile(raw)) {
    throw new Error('Invalid lesson file: schema validation failed');
  }
  return buildLesson(raw);
}

// ── 앱 진입점: content/lessons/*.json 을 glob 으로 읽어 정렬 ──────────────────

// Vite/Vitest 양쪽에서 동작 — `/content/...` 는 프로젝트 루트 기준. eager 로 JSON 파싱.
const modules = import.meta.glob<{ default: unknown }>('/content/lessons/*.json', { eager: true });

/** 모든 레슨을 로드하여 chapter/order 순으로 정렬. 잘못된 파일은 throw(앱 부팅 실패가 곧 발견). */
export function loadAllLessons(): Lesson[] {
  const lessons: Lesson[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    const raw = mod?.default;
    if (!isLessonFile(raw)) {
      throw new Error(`Invalid lesson file at ${path}: schema validation failed`);
    }
    lessons.push(buildLesson(raw));
  }
  lessons.sort((a, b) =>
    a.file.chapter !== b.file.chapter
      ? a.file.chapter - b.file.chapter
      : a.file.order - b.file.order
  );
  return lessons;
}

/** skillId → Lesson 조회 헬퍼. */
export function findLesson(skillId: string): Lesson | undefined {
  return loadAllLessons().find((l) => l.file.skillId === skillId);
}
