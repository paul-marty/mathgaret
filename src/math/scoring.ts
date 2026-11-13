import type { Profile } from './families';

/**
 * Barème P8.
 * - Étoile de mission : une par chapitre terminé, une seule fois.
 * - Efficacité : un point par problème terminé si chaque consigne n'a été réécoutée
 *   qu'une fois au plus (la première réécoute est gratuite). Erreurs, aides, jetons et
 *   temps de réflexion n'y changent rien.
 */
export interface ProblemRecord {
  chapterId: string;
  challengeId: string;
  family: string;
  profile: Profile;
  /** Durée active du problème, aides et corrections comprises (ms). */
  ms: number;
  efficient: boolean;
  errors: number;
  helps: number;
}

/** Taux d'efficacité d'un chapitre, ou null s'il n'a encore aucun problème terminé (« en cours »). */
export function chapterRate(records: ProblemRecord[], chapterId: string): number | null {
  const mine = records.filter((r) => r.chapterId === chapterId);
  if (mine.length === 0) return null;
  return mine.filter((r) => r.efficient).length / mine.length;
}

/** « Partie entière de cinq fois le taux » : 80 % → 4 étoiles. */
export function starsFromRate(rate: number): number {
  return Math.max(0, Math.min(5, Math.floor(5 * rate + 1e-9)));
}

/** Bilan général : moyenne des taux des chapitres terminés, chaque chapitre pesant autant. */
export function globalRate(rates: (number | null)[]): number | null {
  const done = rates.filter((r): r is number => r !== null);
  if (done.length === 0) return null;
  return done.reduce((a, b) => a + b, 0) / done.length;
}

/**
 * Compteur de réécoutes d'un problème. Chaque consigne d'étape a sa première réécoute gratuite.
 * Les relectures automatiques (aide, reprise après une absence) ne comptent pas.
 */
export class RereadCounter {
  private perStep = new Map<number, number>();

  request(step = 0): { free: boolean } {
    const n = (this.perStep.get(step) ?? 0) + 1;
    this.perStep.set(step, n);
    return { free: n <= 1 };
  }

  get efficient(): boolean {
    return [...this.perStep.values()].every((n) => n <= 1);
  }
}
