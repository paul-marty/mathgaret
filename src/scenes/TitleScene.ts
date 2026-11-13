import * as Phaser from 'phaser';
import { C, SCENES, textStyle, URLP } from '../config';
import { services } from '../services';
import { cover, fit } from '../view/assets';

/**
 * « Appuie sur une touche » : le son et la manette n'existent pour le navigateur
 * qu'après une première action de l'utilisateur.
 */
export class TitleScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super(SCENES.Title);
  }

  create(): void {
    this.leaving = false;
    this.tweens.timeScale = URLP.speed;
    cover(this.add.image(960, 540, 'labo_soir'));
    this.add.rectangle(960, 540, 1920, 1080, C.nightDeep, 0.35);
    const rocket = fit(this.add.image(1500, 600, 'maquette_saturn'), 260, 640);
    this.tweens.add({ targets: rocket, y: 585, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    fit(this.add.image(420, 1040, 'margaret_neutre').setOrigin(0.5, 1), 420, 560);

    this.add.text(960, 260, 'Mathgaret', textStyle(170, { color: '#f2c14e', stroke: '#3a2a20', strokeThickness: 14 })).setOrigin(0.5);
    this.add.text(960, 400, 'Avec Margaret, prépare la mission Apollo 11', textStyle(46)).setOrigin(0.5);

    // Pictogramme « appuie » : une main sur un gros bouton, qui clignote.
    const hint = this.add.container(960, 760);
    const g = this.add.graphics();
    g.fillStyle(C.green, 1);
    g.fillCircle(0, 0, 90);
    g.lineStyle(8, C.ink, 1);
    g.strokeCircle(0, 0, 90);
    g.fillStyle(C.white, 1);
    g.fillTriangle(-26, -40, -26, 40, 44, 0);
    hint.add(g);
    this.add.text(960, 905, 'Appuie sur une touche', textStyle(48)).setOrigin(0.5);
    this.tweens.add({ targets: hint, scale: 1.12, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // N'importe quelle touche, un toucher ou un bouton de manette.
    const go = () => this.start();
    window.addEventListener('keydown', go, { once: true });
    this.input.once('pointerdown', go);
    const offPad = services.input.on((_intent, source) => source === 'gamepad' && go());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', go);
      offPad();
    });
  }

  private start(): void {
    if (this.leaving) return;
    this.leaving = true;
    services.sfx.select();
    this.cameras.main.fadeOut(300 / URLP.speed);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENES.Menu));
  }
}
