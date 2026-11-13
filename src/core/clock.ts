/**
 * Horloge du jeu. Elle avance avec la boucle de rendu (scène Overlay) et s'arrête quand l'application
 * passe en arrière-plan :
 * toutes les attentes du scénario passent par elle, jamais par setTimeout.
 *
 * Elle mesure aussi le « temps actif » (P9) : uniquement pendant l'aventure, hors arrière-plan et hors bilan.
 */
export class GameClock {
  /** Temps de jeu écoulé (ms). */
  now = 0;
  /** Temps actif cumulé (ms), compté seulement quand `counting` est vrai. */
  activeMs = 0;
  counting = false;
  paused = false;

  private timers: { at: number; resolve: () => void }[] = [];

  constructor(public speed = 1) {}

  tick(realDeltaMs: number): void {
    if (this.paused) return;
    // Un onglet en arrière-plan peut livrer un énorme delta : on le borne.
    const d = Math.min(realDeltaMs, 250) * this.speed;
    this.now += d;
    if (this.counting) this.activeMs += d;
    if (this.timers.length === 0) return;
    const due = this.timers.filter((t) => t.at <= this.now);
    if (due.length === 0) return;
    this.timers = this.timers.filter((t) => t.at > this.now);
    for (const t of due) t.resolve();
  }

  /** Attend `ms` millisecondes de temps de jeu (gelées en arrière-plan). */
  wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.timers.push({ at: this.now + Math.max(0, ms), resolve }));
  }

  /** Console de développement (mg.passer) : avance l'horloge jusqu'à la prochaine attente, qui se termine. */
  skipToNext(): boolean {
    if (this.timers.length === 0) return false;
    const at = Math.min(...this.timers.map((t) => t.at));
    const d = Math.max(0, at - this.now);
    this.now += d;
    if (this.counting) this.activeMs += d;
    const due = this.timers.filter((t) => t.at <= this.now);
    this.timers = this.timers.filter((t) => t.at > this.now);
    for (const t of due) t.resolve();
    return true;
  }

  /** Abandonne toutes les attentes en cours (changement de scène). Elles ne se résolvent jamais. */
  clearTimers(): void {
    this.timers = [];
  }
}
