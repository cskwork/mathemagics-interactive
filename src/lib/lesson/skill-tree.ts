/**
 * 스킬 트리 구조 — PLAN §3.2 의존성 + 마술 해금 슬롯. 순수 데이터/함수.
 *
 * 레슨의 prerequisites(잠금 사슬)는 각 레슨 JSON 이 들고 있고, isLessonUnlocked 가 판정한다.
 * 이 모듈은 **트리 뷰용 구조**(트랙 분할·마술 해금 슬롯·챕터 그룹핑)를 제공한다.
 * 마술 해금 슬롯의 내용물은 M5(9장 마술). 지금은 자리만 표시.
 */
import type { LessonFile } from '../lesson/types.js';

/** 스킬 트리의 한 노드(레슨 1개). */
export interface SkillNode {
  readonly skillId: string;
  readonly chapter: number;
  readonly title: { ko: string; en?: string };
  readonly prerequisites: readonly string[];
  /** 이 레슨 완료 시 해금되는 마술 슬롯(있으면). 내용물은 M5. */
  readonly magicUnlock?: string;
}

/** 트리의 한 트랙(장 그룹). PLAN §3.1 의 4 트랙 중 M4 는 A(암산 메인) 2~5장. */
export interface SkillTrack {
  readonly id: string;
  readonly labelKey: string;
  readonly chapters: readonly number[];
}

/** 암산 메인 트랙(1~5장). M4 가 2~5장을 채운다. */
export const MENTAL_MATH_TRACK: SkillTrack = {
  id: 'main',
  labelKey: 'tree_track_main',
  chapters: [1, 2, 3, 4, 5]
};

/**
 * 레슨 목록 → 트리 노드 목록(챕터/순서 정렬). 순수 함수.
 * 마술 해금 슬롯 매핑: 챕터 완료 시점에 해금되는 보상 슬롯을 레슨에 붙인다(데이터는 M5).
 */
export function buildSkillNodes(lessons: readonly { file: LessonFile }[]): readonly SkillNode[] {
  return [...lessons]
    .sort((a, b) =>
      a.file.chapter !== b.file.chapter
        ? a.file.chapter - b.file.chapter
        : a.file.order - b.file.order
    )
    .map((l) => ({
      skillId: l.file.skillId,
      chapter: l.file.chapter,
      title: l.file.title,
      prerequisites: l.file.prerequisites
    }));
}

/**
 * 챕터별 마술 해금 슬롯. 각 챕터(2~5장)의 마지막 레슨을 끝내면 마술 1개가 열린다(PLAN §3.2 —
 * "마술: 해당 스킬 달성 시 해금"). 실제 마술 콘텐츠는 M5. 지금은 자리표.
 */
export const CHAPTER_MAGIC_SLOTS: Readonly<Record<number, string>> = {
  2: 'psychic-math',
  3: 'magic-1089',
  4: 'missing-digit',
  5: 'leapfrog'
};

/** 한 챕터의 모든 레슨이 완료됐는지(마술 해금 조건). 순수 함수. */
export function isChapterComplete(
  chapter: number,
  nodes: readonly SkillNode[],
  completedSkillIds: ReadonlySet<string>
): boolean {
  const chapterNodes = nodes.filter((n) => n.chapter === chapter);
  if (chapterNodes.length === 0) return false;
  return chapterNodes.every((n) => completedSkillIds.has(n.skillId));
}

/** 마술 슬롯이 잠금 해제됐는지(해당 챕터 전체 완료 시). */
export function isMagicUnlocked(
  chapter: number,
  nodes: readonly SkillNode[],
  completedSkillIds: ReadonlySet<string>
): boolean {
  return isChapterComplete(chapter, nodes, completedSkillIds);
}
