/**
 * Theme store — light is default, dark is switchable.
 * Persists to localStorage('mathemagics.theme').
 * Applies `data-theme` attribute on <html> for CSS token override.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mathemagics.theme';

let current = $state<Theme>('light');

function apply(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function initTheme(): void {
  // Determine initial theme
  let theme: Theme = 'light'; // default to light
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

export function getTheme(): Theme {
  return current;
}

export function setTheme(theme: Theme): void {
  current = theme;
  apply(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function toggleTheme(): void {
  setTheme(current === 'light' ? 'dark' : 'light');
}
