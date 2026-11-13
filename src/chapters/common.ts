import type * as Phaser from 'phaser';
import { C } from '../config';
import type { StoryScene } from '../scenes/StoryScene';
import { services } from '../services';

/** Un voile léger derrière les objets du problème : l'ambiance se calme pendant la recherche (9.1). */
export function calmVeil(s: StoryScene, on: boolean): Phaser.GameObjects.Rectangle {
  let veil = s.children.getByName('calm-veil') as Phaser.GameObjects.Rectangle | null;
  if (!veil) veil = s.add.rectangle(960, 540, 1920, 1080, 0x101a33, 0).setDepth(25).setName('calm-veil');
  s.tweens.add({ targets: veil, fillAlpha: on ? 0.3 : 0, duration: 500 });
  return veil;
}

/** Micro-surprise « Les papiers récalcitrants » (9.2) : une feuille glisse, le Collègue la rattrape. */
export function papersSurprise(s: StoryScene): { id: string; play: () => Promise<void> } {
  return {
    id: 'papiers',
    play: async () => {
      const c = s.char('collegue');
      const sheet = s.add.rectangle(c.x - 40, c.y - 300, 70, 90, C.cream).setStrokeStyle(3, C.ink).setDepth(22);
      services.sfx.paper();
      await s.tween({ targets: sheet, x: c.x - 260, y: c.y - 60, angle: -200, duration: 900, ease: 'Sine.InOut' });
      await s.say('ms_papiers');
      await s.tween({ targets: sheet, x: c.x - 40, y: c.y - 300, angle: 0, alpha: 0, duration: 500 });
      sheet.destroy();
    },
  };
}
