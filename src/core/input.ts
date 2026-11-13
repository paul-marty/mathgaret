import { mapKey } from './keyboardMap';

export type Dir = 'up' | 'down' | 'left' | 'right';
export type Shortcut = 'reecouter' | 'aide';

/**
 * Événements de jeu, identiques quelle que soit la source :
 * flèches / croix / stick → nav, Entrée / A / toucher → ok, Échap / B / Retour → back,
 * chiffres du clavier → digit (facultatif).
 */
export type Intent =
  | { type: 'nav'; dir: Dir }
  | { type: 'ok' }
  | { type: 'back' }
  | { type: 'digit'; digit: number }
  | { type: 'erase' }
  | { type: 'shortcut'; name: Shortcut };

export type Source = 'keyboard' | 'gamepad' | 'pointer' | 'system';

export interface Interaction {
  source: Source;
  /** Vrai si le navigateur considère l'événement comme un geste de l'utilisateur (déblocage du son). */
  trusted: boolean;
}

type Listener = (intent: Intent, source: Source) => void;

export class InputHub {
  lastSource: Source = 'keyboard';
  /** Historique court, pour le débogage et les tests. */
  history: { intent: Intent; source: Source }[] = [];

  private listeners: Listener[] = [];
  private interactionListeners: ((i: Interaction) => void)[] = [];
  private lastBackAt = -Infinity;

  on(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }

  onInteraction(fn: (i: Interaction) => void): void {
    this.interactionListeners.push(fn);
  }

  noteInteraction(i: Interaction): void {
    this.lastSource = i.source;
    for (const fn of this.interactionListeners) fn(i);
  }

  handle(intent: Intent, source: Source): void {
    if (intent.type === 'back') {
      // Un même appui peut arriver deux fois (touche + popstate) : on ne garde que le premier.
      const now = performance.now();
      if (now - this.lastBackAt < 300) return;
      this.lastBackAt = now;
    }
    this.lastSource = source;
    this.history.push({ intent, source });
    if (this.history.length > 60) this.history.shift();
    for (const fn of [...this.listeners]) fn(intent, source);
  }
}

/** Clavier : lu sur `keydown` (pas de champ de saisie, donc pas de clavier virtuel sur Android TV). */
export function installKeyboard(hub: InputHub, onFullscreen: () => void): void {
  window.addEventListener(
    'keydown',
    (e) => {
      const k = mapKey(e);
      if (!k) return;
      hub.noteInteraction({ source: 'keyboard', trusted: e.isTrusted });
      e.preventDefault();
      if (k.type === 'fullscreen') {
        if (!e.repeat) onFullscreen();
        return;
      }
      // Touche maintenue : on ne répète que les flèches.
      if (e.repeat && k.type !== 'nav') return;
      switch (k.type) {
        case 'digit':
          hub.handle({ type: 'digit', digit: k.digit }, 'keyboard');
          break;
        case 'erase':
          hub.handle({ type: 'erase' }, 'keyboard');
          break;
        case 'activate':
          hub.handle({ type: 'ok' }, 'keyboard');
          break;
        case 'back':
          hub.handle({ type: 'back' }, 'keyboard');
          break;
        case 'nav':
          hub.handle({ type: 'nav', dir: k.dir }, 'keyboard');
          break;
      }
    },
    { capture: true },
  );
}
