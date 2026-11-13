import type { StoryScene } from '../scenes/StoryScene';

/** Une scène du scénario (C1.1, C1.2…). */
export interface SceneScript {
  id: string;
  /** Durée estimée de la narration essentielle de la scène (ms), hors problèmes. */
  estMs: number;
  /** Challenge de la scène, pour réserver sa participation indispensable dans le budget (P9). */
  challenge?: { id: string; family: string };
  run(s: StoryScene): Promise<void>;
}

export interface ChapterScript {
  id: string;
  scenes: SceneScript[];
}
