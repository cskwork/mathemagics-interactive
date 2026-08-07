/**
 * Global toast notification store.
 * Components can call pushToast() to show transient notifications.
 */
export interface ToastEntry {
  id: number;
  message: string;
  icon?: import('../../components/Icon.svelte').IconName;
  variant?: 'default' | 'success' | 'achievement';
  duration?: number;
}

let nextId = 0;
let toasts = $state<ToastEntry[]>([]);

export function getToasts(): ToastEntry[] {
  return toasts;
}

export function pushToast(message: string, opts?: {
  icon?: import('../../components/Icon.svelte').IconName;
  variant?: 'default' | 'success' | 'achievement';
  duration?: number;
}): void {
  const id = nextId++;
  toasts = [...toasts, { id, message, ...opts }];
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
}
