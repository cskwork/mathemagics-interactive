import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash, ROUTES } from './hash-router.svelte.js';

describe('parseHash', () => {
  it('maps the M0 routes', () => {
    expect(parseHash('')).toBe('profiles');
    expect(parseHash('#/')).toBe('profiles');
    expect(parseHash('#/home')).toBe('home');
    expect(parseHash('#/settings')).toBe('settings');
  });

  it('ignores a query string and a trailing slash', () => {
    expect(parseHash('#/home?from=profiles')).toBe('home');
    expect(parseHash('#/settings/')).toBe('settings');
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
