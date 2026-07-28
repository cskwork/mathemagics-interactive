import { describe, expect, it } from 'vitest';
import {
  buildSkillNodes,
  CHAPTER_MAGIC_SLOTS,
  isChapterComplete,
  isMagicUnlocked,
  MENTAL_MATH_TRACK
} from './skill-tree.js';
import { loadAllLessons } from './loader.js';

const lessons = loadAllLessons();
const nodes = buildSkillNodes(lessons);

describe('skill-tree — structure', () => {
  it('builds nodes for all loaded lessons (Ch1-5)', () => {
    expect(nodes.length).toBe(lessons.length);
    expect(nodes.some((n) => n.chapter === 2)).toBe(true);
    expect(nodes.some((n) => n.chapter === 5)).toBe(true);
  });

  it('nodes are sorted by chapter then order', () => {
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1]!;
      const b = nodes[i]!;
      const ok = a.chapter < b.chapter || (a.chapter === b.chapter);
      expect(ok).toBe(true);
    }
  });

  it('mental math track covers chapters 1-5', () => {
    expect(MENTAL_MATH_TRACK.chapters).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('skill-tree — chapter completion & magic unlock', () => {
  it('isChapterComplete true only when ALL chapter lessons done', () => {
    const ch2Ids = nodes.filter((n) => n.chapter === 2).map((n) => n.skillId);
    expect(ch2Ids.length).toBeGreaterThan(0);
    const first = ch2Ids[0]!;
    // 아무것도 완료 안 함 → false
    expect(isChapterComplete(2, nodes, new Set<string>())).toBe(false);
    // 일부만 → false
    expect(isChapterComplete(2, nodes, new Set<string>([first]))).toBe(false);
    // 전부 → true
    expect(isChapterComplete(2, nodes, new Set<string>(ch2Ids))).toBe(true);
  });

  it('magic slots defined for chapters 2-5 (M5 content)', () => {
    expect(CHAPTER_MAGIC_SLOTS[2]).toBeDefined();
    expect(CHAPTER_MAGIC_SLOTS[3]).toBeDefined();
    expect(CHAPTER_MAGIC_SLOTS[4]).toBeDefined();
    expect(CHAPTER_MAGIC_SLOTS[5]).toBeDefined();
  });

  it('isMagicUnlocked mirrors chapter completion', () => {
    const ch3Ids = nodes.filter((n) => n.chapter === 3).map((n) => n.skillId);
    expect(isMagicUnlocked(3, nodes, new Set<string>())).toBe(false);
    expect(isMagicUnlocked(3, nodes, new Set<string>(ch3Ids))).toBe(true);
  });
});

describe('skill-tree — dependency chain (PLAN §3.2)', () => {
  it('2×2 methods depend on 3×1 (mul-3x1)', () => {
    const add = nodes.find((n) => n.skillId === 'mul-2x2-add');
    expect(add?.prerequisites).toContain('mul-3x1');
  });

  it('3-digit square depends on 2-digit square', () => {
    const sq3 = nodes.find((n) => n.skillId === 'square-3digit');
    expect(sq3?.prerequisites).toContain('square-2digit');
  });

  it('estimation depends on addition (early-placement per §4-4)', () => {
    const est = nodes.find((n) => n.skillId === 'est-digit');
    expect(est?.prerequisites).toContain('ltr-addition');
  });
});
