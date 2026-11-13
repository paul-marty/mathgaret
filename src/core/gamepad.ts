import type { Dir, InputHub } from './input';

/** Indices du « standard mapping » de la Gamepad API (manette Shield, Xbox, PlayStation…). */
const BTN = { A: 0, B: 1, X: 2, Y: 3, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;
const DPAD: [Dir, number][] = [
  ['up', BTN.UP],
  ['down', BTN.DOWN],
  ['left', BTN.LEFT],
  ['right', BTN.RIGHT],
];
const REPEAT_DELAY = 420;
const REPEAT_INTERVAL = 160;
/** Le stick sert de flèches : seuil d'enclenchement et de relâchement (hystérésis). */
const STICK_ON = 0.6;
const STICK_OFF = 0.35;

/**
 * Manette : croix ou stick = flèches, A = OK, B / Start / Select = retour (sans effet pendant l'aventure),
 * Y = réécouter la consigne, X = aide.
 * Les navigateurs n'exposent une manette qu'après l'appui sur un de ses boutons.
 */
export class GamepadSource {
  /** Instant du dernier appui sur B (Android peut aussi le traduire en « Retour »). */
  lastBPressAt = -Infinity;

  private prev = new Map<number, boolean[]>();
  private nextRepeat = new Map<string, number>();
  private stickDir = new Map<number, Dir | null>();

  constructor(private hub: InputHub) {}

  poll(now: number = performance.now()): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const prev = this.prev.get(pad.index) ?? [];
      const pressed = pad.buttons.map((b) => b.pressed || b.value > 0.5);
      const edge = (i: number) => pressed[i] === true && prev[i] !== true;

      if (pressed.some((p, i) => p && prev[i] !== true)) this.hub.noteInteraction({ source: 'gamepad', trusted: false });
      if (edge(BTN.A)) this.hub.handle({ type: 'ok' }, 'gamepad');
      if (edge(BTN.B)) {
        this.lastBPressAt = now;
        this.hub.handle({ type: 'back' }, 'gamepad');
      }
      if (edge(BTN.START) || edge(BTN.SELECT)) this.hub.handle({ type: 'back' }, 'gamepad');
      if (edge(BTN.Y)) this.hub.handle({ type: 'shortcut', name: 'reecouter' }, 'gamepad');
      if (edge(BTN.X)) this.hub.handle({ type: 'shortcut', name: 'aide' }, 'gamepad');

      // Stick gauche transformé en flèche (une seule direction à la fois).
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      let stick = this.stickDir.get(pad.index) ?? null;
      const mag = Math.max(Math.abs(ax), Math.abs(ay));
      if (stick && mag < STICK_OFF) stick = null;
      else if (!stick && mag > STICK_ON) stick = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
      this.stickDir.set(pad.index, stick);

      for (const [dir, index] of DPAD) {
        const held = pressed[index] === true || stick === dir;
        const key = `${pad.index}:${dir}`;
        if (!held) {
          this.nextRepeat.delete(key);
          continue;
        }
        const due = this.nextRepeat.get(key);
        if (due === undefined) {
          this.nextRepeat.set(key, now + REPEAT_DELAY);
          this.hub.handle({ type: 'nav', dir }, 'gamepad');
        } else if (now >= due) {
          this.nextRepeat.set(key, now + REPEAT_INTERVAL);
          this.hub.handle({ type: 'nav', dir }, 'gamepad');
        }
      }
      this.prev.set(pad.index, pressed);
    }
  }
}

/**
 * Intercepte le bouton Retour (télécommande, manette, geste Android, bouton du navigateur) :
 * on ajoute une entrée dans l'historique ; « Retour » la consomme, on la remet aussitôt
 * et on transmet `back` au jeu au lieu de quitter la page.
 * Chrome ignore les entrées ajoutées sans geste de l'utilisateur : on attend la première interaction réelle.
 */
export class BackGuard {
  private armed = false;
  private releasing = false;

  constructor(
    private hub: InputHub,
    private gamepad: GamepadSource,
  ) {}

  arm(): void {
    if (this.armed || this.releasing) return;
    this.armed = true;
    history.pushState({ mathgaretGuard: true }, '');
    window.addEventListener('popstate', this.onPopState);
  }

  private onPopState = () => {
    if (this.releasing) return;
    history.pushState({ mathgaretGuard: true }, '');
    // Sur Android, B peut produire à la fois un appui manette et un « Retour » : un seul suffit.
    if (performance.now() - this.gamepad.lastBPressAt < 400) return;
    this.hub.handle({ type: 'back' }, 'system');
  };
}
