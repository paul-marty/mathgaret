import * as Phaser from 'phaser';
import { C, SCENES, textStyle, URLP } from '../config';
import { MOT_PARENTS } from '../content/note-parents';
import type { Dir } from '../core/input';
import { mapKey } from '../core/keyboardMap';
import { services } from '../services';
import { cover, fit } from '../view/assets';

/** Code caché « commencer à un chapitre » : haut, haut, bas, bas (flèches, télécommande ou croix de la manette). */
const CODE: Dir[] = ['up', 'up', 'down', 'down'];
/** Sur tablette : un appui long sur le mot « Mathgaret ». */
const HOLD_MS = 1500;

/**
 * Écran de lancement : le mot aux parents, puis « Appuie sur une touche » (le son et la manette n'existent pour
 * le navigateur qu'après une première action de l'utilisateur). Accès caché au choix du chapitre de départ.
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

    const title = this.add.text(960, 112, 'Mathgaret', textStyle(120, { color: '#f2c14e', stroke: '#3a2a20', strokeThickness: 11 })).setOrigin(0.5);
    this.add.text(960, 212, 'Avec Margaret, prépare la mission Apollo 11', textStyle(40)).setOrigin(0.5);

    const cardBottom = this.parentsCard(258);

    // Pictogramme « appuie » : une main sur un gros bouton, qui clignote.
    const hint = this.add.container(960, cardBottom + 78).setScale(0.6);
    const g = this.add.graphics();
    g.fillStyle(C.green, 1);
    g.fillCircle(0, 0, 90);
    g.lineStyle(8, C.ink, 1);
    g.strokeCircle(0, 0, 90);
    g.fillStyle(C.white, 1);
    g.fillTriangle(-26, -40, -26, 40, 44, 0);
    hint.add(g);
    this.add.text(960, cardBottom + 168, 'Appuie sur une touche', textStyle(40)).setOrigin(0.5);
    this.tweens.add({ targets: hint, scale: 0.68, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // N'importe quelle touche, un toucher ou un bouton de manette lance le jeu, sauf le code caché en cours de saisie.
    let pos = 0;
    const arrow = (dir: Dir) => {
      if (dir !== CODE[pos]) return this.start();
      if (++pos === CODE.length) this.startAt();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const intent = mapKey(e);
      if (intent?.type === 'nav') arrow(intent.dir);
      else this.start();
    };
    window.addEventListener('keydown', onKey);
    const offPad = services.input.on((intent, source) => {
      if (source !== 'gamepad') return;
      if (intent.type === 'nav') arrow(intent.dir);
      else this.start();
    });

    title.setInteractive();
    let hold: Phaser.Time.TimerEvent | null = null;
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!over.includes(title)) return this.start();
      hold = this.time.delayedCall(HOLD_MS, () => this.startAt());
    });
    this.input.on('pointerup', () => {
      if (!hold) return;
      hold.remove();
      hold = null;
      this.start();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
      offPad();
    });
  }

  /** Le mot aux parents, dans un cadre sombre au centre ; renvoie le bas du cadre. */
  private parentsCard(top: number): number {
    const w = 760;
    const pad = 28;
    const heading = this.add.text(960, top + pad, MOT_PARENTS.title, textStyle(32, { color: '#f2c14e' })).setOrigin(0.5, 0);
    const body = this.add
      .text(960 - w / 2 + pad, heading.y + heading.height + 12, MOT_PARENTS.paragraphs.join('\n\n'), textStyle(24, { wordWrap: { width: w - 2 * pad }, lineSpacing: 3 }))
      .setOrigin(0, 0);
    const more = this.add
      .text(960, body.y + body.height + 14, MOT_PARENTS.more, textStyle(22, { color: '#c9d6e8', wordWrap: { width: w - 2 * pad }, align: 'center' }))
      .setOrigin(0.5, 0);
    const bottom = more.y + more.height + pad;
    const panel = this.add.graphics();
    panel.fillStyle(C.nightDeep, 0.85);
    panel.fillRoundedRect(960 - w / 2, top, w, bottom - top, 26);
    panel.lineStyle(3, C.mustard, 0.6);
    panel.strokeRoundedRect(960 - w / 2, top, w, bottom - top, 26);
    panel.setDepth(1);
    for (const t of [heading, body, more]) t.setDepth(2);
    return bottom;
  }

  private leave(then: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    services.sfx.select();
    this.cameras.main.fadeOut(300 / URLP.speed);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, then);
  }

  private start(): void {
    this.leave(() => this.scene.start(SCENES.Menu));
  }

  /** Accès caché : l'accueil s'ouvre sur le choix du chapitre de départ. */
  private startAt(): void {
    this.leave(() => this.scene.start(SCENES.Menu, { screen: 'chapitre' }));
  }
}
