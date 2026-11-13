import type { Profile } from './families';

/**
 * Adaptation à la durée globale (P9).
 *
 * À chaque problème terminé :
 *   disponible = cible − temps actif − (narration essentielle restante + participations indispensables à venir)
 * Si disponible ≤ 0 : on conclut le challenge. Sinon, le temps des variantes est réparti entre les chapitres
 * encore ouverts au prorata de leurs poids (10, 12, 10, 16, 12), puis à égalité entre les challenges
 * ouverts du chapitre courant. Une variante n'est proposée que si elle tient dans la part du challenge.
 *
 * Interprétation retenue : les parts sont calculées sur le temps de variantes « avant dépenses » du chapitre
 * (disponible + variantes déjà jouées dans ce chapitre). Sans cela, la part se reconstituerait après chaque
 * problème et le premier chapitre absorberait peu à peu le temps des suivants.
 */
export interface BudgetInput {
  targetMs: number;
  activeMs: number;
  essentialRemainingMs: number;
  currentWeight: number;
  /** Poids de tous les chapitres encore ouverts, chapitre courant compris. */
  openWeights: number[];
  /** Challenges encore ouverts dans le chapitre courant, challenge courant compris. */
  openChallenges: number;
  nextEstimateMs: number;
  /** Temps des variantes déjà jouées dans le challenge courant (hors première participation). */
  spentCurrentMs?: number;
  /** Temps des variantes jouées dans les challenges déjà conclus du chapitre. */
  spentClosedMs?: number;
}

export interface BudgetDecision {
  offer: boolean;
  availableMs: number;
  shareMs: number;
}

export function decideVariant(i: BudgetInput): BudgetDecision {
  const spentCurrent = i.spentCurrentMs ?? 0;
  const spentClosed = i.spentClosedMs ?? 0;
  const availableMs = i.targetMs - i.activeMs - i.essentialRemainingMs;
  if (availableMs <= 0) return { offer: false, availableMs, shareMs: 0 };
  const totalWeight = i.openWeights.reduce((a, b) => a + b, 0) || 1;
  const chapterPool = ((availableMs + spentCurrent + spentClosed) * i.currentWeight) / totalWeight;
  const shareMs = (chapterPool - spentClosed) / Math.max(1, i.openChallenges);
  return { offer: spentCurrent + i.nextEstimateMs <= shareMs, availableMs, shareMs };
}

/** Temps des variantes (tout problème après le premier) d'un challenge, d'après les durées dans l'ordre. */
export function extraMs(durations: number[]): number {
  return durations.slice(1).reduce((a, b) => a + b, 0);
}

/** Estimation de conception au tout premier passage : 2 min, à recalibrer lors des essais. */
export const DEFAULT_PROBLEM_MS = 120_000;

export interface TimeObservation {
  family: string;
  profile: Profile;
  ms: number;
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Durée probable du prochain problème : médiane des 5 derniers problèmes de la même famille
 * dans le même profil, sinon médiane des problèmes du profil, sinon 2 min.
 */
export function estimateNext(history: TimeObservation[], family: string, profile: Profile): number {
  const sameFamily = history.filter((h) => h.family === family && h.profile === profile).slice(-5);
  if (sameFamily.length > 0) return median(sameFamily.map((h) => h.ms));
  const sameProfile = history.filter((h) => h.profile === profile);
  if (sameProfile.length > 0) return median(sameProfile.map((h) => h.ms));
  return DEFAULT_PROBLEM_MS;
}
