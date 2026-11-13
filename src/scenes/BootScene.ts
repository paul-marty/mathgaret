import * as Phaser from 'phaser';
import { SCENES, URLP } from '../config';
import { PROFILES, type Profile } from '../math/families';
import { services } from '../services';
import { makePlaceholders, queueImages } from '../view/assets';
import { findScene, prepareRun } from '../devtools';

/** Charge les images livrées, dessine les formes provisoires des autres, puis ouvre l'accueil. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.Boot);
  }

  preload(): void {
    queueImages(this);
  }

  async create(): Promise<void> {
    makePlaceholders(this);
    await services.ready;
    document.getElementById('boot-message')?.remove();
    this.scene.launch(SCENES.Overlay);

    // Accès direct à une scène pour le développement et les tests : ?scene=c1.2&niveau=milieu
    const found = URLP.scene ? findScene(URLP.scene) : null;
    if (found) {
      const profile = PROFILES.includes(URLP.profile as Profile) ? (URLP.profile as Profile) : undefined;
      prepareRun(found.chapterId, found.sceneIndex, { profile, fresh: true });
      this.scene.start(SCENES.Story, found);
      return;
    }
    this.scene.start(SCENES.Title);
  }
}
