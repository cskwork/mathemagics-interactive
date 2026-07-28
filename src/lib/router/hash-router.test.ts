import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash, ROUTES } from './hash-router.svelte.js';

describe('parseHash', () => {
  it('maps the declared routes', () => {
    expect(parseHash('')).toBe('profiles');
    expect(parseHash('#/')).toBe('profiles');
    expect(parseHash('#/home')).toBe('home');
    expect(parseHash('#/settings')).toBe('settings');
    expect(parseHash('#/dev/playground')).toBe('playground');
    expect(parseHash('#/lessons')).toBe('lessons');
    expect(parseHash('#/lesson')).toBe('lesson');
    expect(parseHash('#/practice')).toBe('practice');
    expect(parseHash('#/progress')).toBe('progress');
    expect(parseHash('#/report')).toBe('report');
    expect(parseHash('#/stage')).toBe('stage');
    expect(parseHash('#/magic')).toBe('magic');
    expect(parseHash('#/catch')).toBe('catch');
  });

  it('ignores a query string and a trailing slash', () => {
    expect(parseHash('#/home?from=profiles')).toBe('home');
    expect(parseHash('#/settings/')).toBe('settings');
    expect(parseHash('#/dev/playground?op=add')).toBe('playground');
    expect(parseHash('#/lesson?id=ltr-addition')).toBe('lesson');
    expect(parseHash('#/magic?id=psychic-math')).toBe('magic');
    expect(parseHash('#/stage?skill=mul-2x2-add')).toBe('stage');
  });

  it('returns undefined for unknown paths so the app can show "not found"', () => {
    expect(parseHash('#/nope')).toBeUndefined();
    expect(parseHash('#/home/extra')).toBeUndefined();
  });
});

describe('routeToHash', () => {
  it('round-trips every declared route', () => {
    for (const route of ROUTES) {
      expect(parseHash(routeToHash(route))).toBe(route);
    }
  });
});
