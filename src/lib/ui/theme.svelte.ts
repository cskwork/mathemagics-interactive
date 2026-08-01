/**
 * Theme store — light is default, dark is switchable.
 * Persists to localStorage('mathemagics.theme').
 * Applies `data-theme` attribute on <html> for CSS token override.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mathemagics.theme';

let current = $state<Theme>('light');

function apply(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export function initTheme(): void {
  let theme: Theme = 'light';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      theme = stored;
    }
  } catch {
    // localStorage not available
  }
  current = theme;
  apply(theme);
}

/** Update <html lang> attribute for screen readers / accessibility. */
export function setLangAttribute(lang: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', lang);
  }
}

export function theme(): Theme {
  return current;
}

export function setTheme(next: Theme): void {
  current = next;
  apply(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore
  }
}

export function toggleTheme(): void {
  setTheme(current === 'light' ? 'dark' : 'light');
}
