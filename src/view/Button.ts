import * as Phaser from 'phaser';
import { C, textStyle } from '../config';
import { services } from '../services';
import type { Focusable, Rect } from './focus';
import { drawIcon, type IconName } from './icons';

export interface ButtonOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  icon?: IconName;
  iconSize?: number;
  iconColor?: number;
  iconExtra?: number;
  text?: string;
  textSize?: number;
  fill?: number;
  /** Réplique lue quand la sélection arrive sur le bouton. */
  label?: string;
  onPress: () => void;
}

/** Gros bouton à pictogramme, sélectionnable aux flèches et touchable. */
export class Button extends Phaser.GameObjects.Container implements Focusable {
  label?: string;
  private bg: Phaser.GameObjects.Graphics;
  private iconG: Phaser.GameObjects.Graphics | null = null;
  private enabledFlag = true;
  private selectedFlag = false;
  private fill: number;

  constructor(
    scene: Phaser.Scene,
    private opts: ButtonOpts,
  ) {
    super(scene, opts.x, opts.y);
    this.label = opts.label;
    this.fill = opts.fill ?? C.cream;
    this.bg = scene.add.graphics();
    this.add(this.bg);
    if (opts.icon) {
      this.iconG = scene.add.graphics();
      const size = opts.iconSize ?? Math.min(opts.w, opts.h) * 0.62;
      const dx = opts.text ? -opts.w / 2 + size / 2 + 24 : 0;
      this.iconG.setPosition(dx, 0);
      drawIcon(this.iconG, opts.icon, size, opts.iconColor ?? C.ink, opts.iconExtra);
      this.add(this.iconG);
    }
    if (opts.text) {
      const hasIcon = Boolean(opts.icon);
      const size = opts.iconSize ?? Math.min(opts.w, opts.h) * 0.62;
      const t = scene.add
        .text(hasIcon ? -opts.w / 2 + size + 44 : 0, 0, opts.text, textStyle(opts.textSize ?? 40, { color: '#3a2a20' }))
        .setOrigin(hasIcon ? 0 : 0.5, 0.5);
      this.add(t);
    }
    this.redraw();
    this.setSize(opts.w, opts.h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      services.input.noteInteraction({ source: 'pointer', trusted: true });
      services.focus.press(this);
    });
    scene.add.existing(this);
  }

  /** Les Graphics n'ont pas de taille propre : la zone du bouton vient de ses dimensions. */
  bounds(): Rect {
    const { w, h } = this.opts;
    return { x: this.x - w / 2, y: this.y - h / 2, width: w, height: h };
  }

  isEnabled(): boolean {
    return this.enabledFlag && this.visible && this.active;
  }

  activate(): void {
    if (!this.isEnabled()) return;
    this.scene.tweens.add({ targets: this, scale: { from: 0.92, to: 1 }, duration: 160, ease: 'Back.Out' });
    this.opts.onPress();
  }

  setEnabled(on: boolean): this {
    this.enabledFlag = on;
    this.setAlpha(on ? 1 : 0.35);
    return this;
  }

  setSelected(on: boolean): this {
    this.selectedFlag = on;
    this.redraw();
    return this;
  }

  get selected(): boolean {
    return this.selectedFlag;
  }

  setFill(color: number): this {
    this.fill = color;
    this.redraw();
    return this;
  }

  private redraw(): void {
    const { w, h } = this.opts;
    const r = Math.min(28, h / 3);
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.22);
    this.bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 8, w, h, r);
    this.bg.fillStyle(this.selectedFlag ? C.mustard : this.fill, 1);
    this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    this.bg.lineStyle(6, C.ink, 1);
    this.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  }
}
