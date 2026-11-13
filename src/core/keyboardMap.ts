import type { Dir as Direction } from './input';

type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type KeyIntent =
  | { type: 'digit'; digit: Digit }
  | { type: 'erase' }
  | { type: 'activate' }
  | { type: 'back' }
  | { type: 'nav'; dir: Direction }
  | { type: 'fullscreen' };

export interface KeyLike {
  key: string;
  code: string;
  keyCode?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

const NAV_KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  // Anciennes télécommandes / navigateurs TV
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
};

const BACK_KEYS = new Set(['Escape', 'Esc', 'GoBack', 'BrowserBack', 'Back']);
// Codes « Retour » vus sur Android (4), navigateurs (166), webOS (461), Tizen (10009).
const BACK_KEYCODES = new Set([4, 166, 461, 10009]);

/**
 * Traduit une touche en intention. On lit d'abord `code` (position physique) :
 * sur un clavier AZERTY, la rangée du haut donne « & é " ' ( … » dans `key`,
 * mais `code` vaut bien Digit1, Digit2…
 */
export function mapKey(e: KeyLike): KeyIntent | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;

  const byCode = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
  if (byCode) return { type: 'digit', digit: Number(byCode[1]) as Digit };
  if (/^[0-9]$/.test(e.key)) return { type: 'digit', digit: Number(e.key) as Digit };
  const kc = e.keyCode ?? 0;
  if (!e.code && kc >= 48 && kc <= 57) return { type: 'digit', digit: (kc - 48) as Digit };
  if (kc >= 96 && kc <= 105) return { type: 'digit', digit: (kc - 96) as Digit };

  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Clear' || kc === 8) return { type: 'erase' };
  if (e.key === 'Enter' || e.code === 'NumpadEnter' || e.key === ' ' || e.key === 'Select' || e.key === 'Accept' || kc === 13) {
    return { type: 'activate' };
  }
  if (BACK_KEYS.has(e.key) || e.code === 'BrowserBack' || BACK_KEYCODES.has(kc)) return { type: 'back' };

  const dir = NAV_KEYS[e.key];
  if (dir) return { type: 'nav', dir };

  if (e.code === 'KeyF') return { type: 'fullscreen' };
  return null;
}
