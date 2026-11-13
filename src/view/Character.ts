import * as Phaser from 'phaser';
import { C } from '../config';
import { fit } from './assets';
import { tweenAsync } from './tweens';

export type CharacterId = 'margaret' | 'collegue' | 'lauren';

/**
 * Personnage « marionnette » : une image par pose (ChatGPT), animée par le jeu
 * (entrée, respiration, petit rebond quand il parle, changement de pose en fondu).
 */
export class Character extends Phaser.GameObjects.Container {
  pose = 'neutre';
  speaking = false;
  private img: Phaser.GameObjects.Image;
  private wave: Phaser.GameObjects.Graphics;
  private talkTween: Phaser.Tweens.Tween | null = null;
  private breathe: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    public readonly who: CharacterId,
    x: number,
    /** Position des pieds. */
    y: number,
    private heightPx = 600,
  ) {
    super(scene, x, y);
    this.img = this.makeImage(`${who}_neutre`);
    this.add(this.img);
    this.wave = scene.add.graphics();
    this.wave.setPosition(who === 'collegue' ? -70 : 70, -heightPx - 10);
    this.drawWave();
    this.wave.setVisible(false);
    this.add(this.wave);
    scene.add.existing(this);
    this.breathe = scene.tweens.add({
      targets: this.img,
      scaleY: { from: this.img.scaleY, to: this.img.scaleY * 1.012 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  private makeImage(key: string): Phaser.GameObjects.Image {
    const img = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
    fit(img, this.heightPx * 0.9, this.heightPx);
    return img;
  }

  setPose(pose: string): this {
    if (pose === this.pose) return this;
    const key = `${this.who}_${pose}`;
    if (!this.scene.textures.exists(key)) return this;
    this.pose = pose;
    const old = this.img;
    this.breathe.stop();
    const next = this.makeImage(key).setAlpha(0);
    this.addAt(next, this.getIndex(old) + 1);
    this.img = next;
    this.scene.tweens.add({ targets: next, alpha: 1, duration: 220 });
    this.scene.tweens.add({ targets: old, alpha: 0, duration: 220, onComplete: () => old.destroy() });
    this.breathe = this.scene.tweens.add({
      targets: next,
      scaleY: { from: next.scaleY, to: next.scaleY * 1.012 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    return this;
  }

  setSpeaking(on: boolean): void {
    if (on === this.speaking) return;
    this.speaking = on;
    this.wave.setVisible(on);
    this.talkTween?.stop();
    this.talkTween = null;
    this.y = Math.round(this.y);
    if (on) {
      const baseY = this.y;
      this.talkTween = this.scene.tweens.add({
        targets: this,
        y: baseY - 8,
        duration: 170,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
        onStop: () => (this.y = baseY),
      });
    }
  }

  /** Entre par un côté de l'écran. */
  enter(from: 'left' | 'right', ms = 900): Promise<void> {
    const targetX = this.x;
    this.x = from === 'left' ? -300 : 2220;
    return tweenAsync(this.scene, { targets: this, x: targetX, duration: ms, ease: 'Cubic.Out' });
  }

  /** Petit saut (surprise, joie). */
  hop(): void {
    this.scene.tweens.add({ targets: this.img, y: -30, duration: 160, yoyo: true, ease: 'Quad.Out' });
  }

  private drawWave(): void {
    const g = this.wave;
    g.lineStyle(7, C.mustard, 1);
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(0, 0, 16 + i * 16, -0.8, 0.8);
      g.strokePath();
    }
    if (this.who === 'collegue') g.setScale(-1, 1);
  }
}
