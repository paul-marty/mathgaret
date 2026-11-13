import type { TimeObservation } from '../math/budget';
import type { Profile } from '../math/families';
import type { ProblemRecord } from '../math/scoring';

export const SAVE_KEY = 'mathgaret.v1';

export type DurationMin = 30 | 45 | 60;

export interface Settings {
  profile: Profile;
  durationMin: DurationMin;
  /** « Mes jetons sont prêts » : active seulement des suggestions orales (P17). */
  tokensReady: boolean;
  /** Intensité douce (P15) : moins de secousses, de flashs, alertes atténuées. */
  gentle: boolean;
  /** Sous-titres (pour l'adulte) : désactivés par défaut, l'enfant ne lit pas. */
  subtitles: boolean;
}

/** Partie en cours : de quoi reprendre exactement où l'on était (P2). */
export interface RunState {
  mode: 'aventure' | 'rejeu';
  profile: Profile;
  durationMin: DurationMin;
  targetMs: number;
  activeMs: number;
  chapterId: string;
  sceneIndex: number;
  records: ProblemRecord[];
  /** Problèmes déjà terminés par challenge (un élément validé demeure validé). */
  challengeDone: Record<string, number>;
}

export interface ChapterProgress {
  missionStar: boolean;
  /** Meilleur taux d'efficacité par profil, avec la durée choisie (P8). */
  best: Partial<Record<Profile, { rate: number; durationMin: DurationMin }>>;
}

export interface SaveData {
  version: 1;
  settings: Settings;
  run: RunState | null;
  /** Durées observées des problèmes, pour estimer les suivants (P9). */
  times: TimeObservation[];
  chapters: Record<string, ChapterProgress>;
  /** Explications déjà données (réécoute gratuite, jetons, gestes…). */
  told: Record<string, boolean>;
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    settings: { profile: 'debut', durationMin: 60, tokensReady: false, gentle: false, subtitles: false },
    run: null,
    times: [],
    chapters: {},
    told: {},
  };
}

/** localStorage peut être absent ou bloqué (navigation privée, aperçu) : le jeu tourne quand même. */
function storage(): Storage | null {
  try {
    const s = window.localStorage;
    s.getItem(SAVE_KEY);
    return s;
  } catch {
    return null;
  }
}

export class SaveStore {
  data: SaveData = defaultSave();

  load(): SaveData {
    const raw = storage()?.getItem(SAVE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        if (parsed.version === 1) {
          const d = defaultSave();
          this.data = {
            ...d,
            ...parsed,
            settings: { ...d.settings, ...parsed.settings },
            chapters: parsed.chapters ?? {},
            told: parsed.told ?? {},
            times: parsed.times ?? [],
          } as SaveData;
        }
      } catch (err) {
        console.warn('[sauvegarde] illisible, on repart de zéro', err);
      }
    }
    return this.data;
  }

  save(): void {
    try {
      storage()?.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('[sauvegarde] impossible d’écrire', err);
    }
  }

  update(fn: (d: SaveData) => void): void {
    fn(this.data);
    this.data.times = this.data.times.slice(-200);
    this.save();
  }

  chapter(id: string): ChapterProgress {
    return (this.data.chapters[id] ??= { missionStar: false, best: {} });
  }
}
