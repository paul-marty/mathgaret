import { chapter1 } from './c1';
import { chapter2 } from './c2';
import { chapter3 } from './c3';
import { chapter4 } from './c4';
import { chapter5 } from './c5';
import type { ChapterScript } from './types';

/** Chapitres réalisés (les cinq). */
export const SCRIPTS: Record<string, ChapterScript> = {
  c1: chapter1,
  c2: chapter2,
  c3: chapter3,
  c4: chapter4,
  c5: chapter5,
};
