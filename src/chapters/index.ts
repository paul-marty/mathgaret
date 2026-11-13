import { chapter1 } from './c1';
import { chapter2 } from './c2';
import type { ChapterScript } from './types';

/** Chapitres réalisés. Les autres sont annoncés « bientôt » au bilan. */
export const SCRIPTS: Record<string, ChapterScript> = {
  c1: chapter1,
  c2: chapter2,
};
