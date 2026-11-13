import * as Phaser from 'phaser';
import { C } from '../config';
import { services } from '../services';
import type { Focusable, Rect } from './focus';

/** Objet du décor qu'on peut désigner (aux flèches ou au doigt) : il s'illumine doucement. */
export class Hotspot implements Focusable {
  private glow: Phaser.GameObjects.Graphics;
  private pulse: Phaser.Tweens.Tween | null = null;
  private enabledFlag = true;
  private handler: () => void = () => undefined;

  constructor(
    private scene: Phaser.Scene,
    public target: Phaser.GameObjects.Image | Phaser.GameObjects.Container,
  ) {
    this.glow = scene.add.graphics().setDepth((target.depth ?? 0) - 1);
    target.setInteractive({ useHandCursor: true });
    target.on('pointerdown', this.onPointer);
  }

  private onPointer = (): void => {
    services.input.noteInteraction({ source: 'pointer', trusted: true });
    services.focus.press(this);
  };

  onPress(fn: () => void): this {
    this.handler = fn;
    return this;
  }

  /** Halo qui attire l'attention (sans lecture nécessaire). */
  highlight(on: boolean): void {
    this.pulse?.stop();
    this.glow.clear();
    if (!on) return;
    const b = this.target.getBounds();
    this.glow.fillStyle(C.mustard, 0.35);
    this.glow.fillRoundedRect(b.x - 24, b.y - 24, b.width + 48, b.height + 48, 40);
    this.pulse = this.scene.tweens.add({ targets: this.glow, alpha: { from: 0.35, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
  }

  setEnabled(on: boolean): void {
    this.enabledFlag = on;
  }

  bounds(): Rect {
    const b = this.target.getBounds();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }

  isEnabled(): boolean {
    return this.enabledFlag && this.target.visible;
  }

  activate(): void {
    this.handler();
  }

  destroy(): void {
    this.pulse?.stop();
    this.glow.destroy();
    // Le décor reste : on retire seulement ce que ce repère y avait ajouté.
    this.target.off('pointerdown', this.onPointer);
    this.target.disableInteractive();
  }
}
