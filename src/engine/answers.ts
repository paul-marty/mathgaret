import * as Phaser from 'phaser';
import { C, textStyle } from '../config';
import { services } from '../services';
import { Button } from '../view/Button';
import type { Focusable, Rect } from '../view/focus';

/**
 * Façons de répondre (P3) : la réponse se prépare librement, puis se confirme avec la grande coche.
 * Changer d'avis avant de valider n'est jamais une erreur.
 */
export interface AnswerUI<A> {
  value(): A | null;
  /** Montre la solution (dernière aide) : l'enfant n'a plus qu'à valider. */
  set(v: A): void;
  focusables(): Focusable[];
  /** Élément à sélectionner au départ. */
  first(): Focusable;
  validateButton: Button;
  onDigit?(d: number): void;
  onErase?(): void;
  destroy(): void;
}

const BAR_Y = 935;

/** Au-dessus du voile de calme et des objets du problème. */
const UI_DEPTH = 40;

export function makeValidate(scene: Phaser.Scene, x: number, onValidate: () => void): Button {
  return new Button(scene, {
    x,
    y: BAR_Y,
    w: 230,
    h: 170,
    icon: 'check',
    iconSize: 120,
    iconColor: C.white,
    fill: C.green,
    label: 'hud_valider',
    onPress: onValidate,
  }).setDepth(UI_DEPTH);
}

// ---------------------------------------------------------------------------
// Choisir un nombre : − / + (et −10 / +10 en fin de CP), chiffres du clavier en option.
// ---------------------------------------------------------------------------

export class NumberPicker implements AnswerUI<number> {
  validateButton: Button;
  private v: number | null = null;
  private max: number;
  private box: Phaser.GameObjects.Container;
  private text: Phaser.GameObjects.Text;
  private buttons: Button[] = [];
  private lastDigitAt = -Infinity;

  constructor(
    private scene: Phaser.Scene,
    opts: { max: number; tens: boolean; onValidate: () => void },
  ) {
    const { max, tens } = opts;
    const cx = tens ? 860 : 900;
    this.box = scene.add.container(cx, BAR_Y).setDepth(UI_DEPTH);
    const bg = scene.add.graphics();
    bg.fillStyle(C.white, 1);
    bg.fillRoundedRect(-120, -85, 240, 170, 30);
    bg.lineStyle(8, C.ink, 1);
    bg.strokeRoundedRect(-120, -85, 240, 170, 30);
    this.text = scene.add.text(0, 4, '?', textStyle(120, { color: '#3a2a20' })).setOrigin(0.5);
    this.box.add([bg, this.text]);

    const step = (d: number) => () => this.change(d, max);
    const mk = (x: number, icon: 'plus' | 'minus', d: number, small?: string) => {
      const b = new Button(scene, {
        x,
        y: BAR_Y,
        w: small ? 130 : 150,
        h: small ? 130 : 150,
        icon,
        iconSize: small ? 60 : 84,
        onPress: step(d),
      }).setDepth(UI_DEPTH);
      if (small) {
        const t = scene.add.text(0, 40, small, textStyle(30, { color: '#3a2a20' })).setOrigin(0.5);
        b.add(t);
      }
      this.buttons.push(b);
      return b;
    };
    if (tens) {
      mk(cx - 380, 'minus', -10, '10');
      mk(cx - 220, 'minus', -1);
      mk(cx + 220, 'plus', 1);
      mk(cx + 380, 'plus', 10, '10');
      this.validateButton = makeValidate(scene, cx + 640, opts.onValidate);
    } else {
      mk(cx - 220, 'minus', -1);
      mk(cx + 220, 'plus', 1);
      this.validateButton = makeValidate(scene, cx + 480, opts.onValidate);
    }
    this.max = max;
  }

  private change(d: number, max: number): void {
    const before = this.v;
    const base = this.v ?? 0;
    const next = this.v === null && d > 0 ? Math.min(max, d) : Phaser.Math.Clamp(base + d, 0, max);
    this.show(next);
    if (next !== before) {
      services.sfx.step(d > 0);
      void services.voice.sayNumber(next);
    }
  }

  private show(v: number | null): void {
    this.v = v;
    this.text.setText(v === null ? '?' : String(v));
    this.scene.tweens.add({ targets: this.text, scale: { from: 1.18, to: 1 }, duration: 160 });
  }

  onDigit(d: number): void {
    const now = performance.now();
    // Deux chiffres tapés à la suite forment un nombre (ex. 1 puis 5 → 15).
    const joined = this.v !== null && now - this.lastDigitAt < 1500 ? this.v * 10 + d : d;
    this.lastDigitAt = now;
    const v = joined <= this.max ? joined : d;
    this.show(v);
    void services.voice.sayNumber(v);
  }

  onErase(): void {
    this.show(this.v !== null && this.v >= 10 ? Math.floor(this.v / 10) : null);
  }

  value(): number | null {
    return this.v;
  }

  set(v: number): void {
    this.show(v);
  }

  focusables(): Focusable[] {
    return [...this.buttons, this.validateButton];
  }

  first(): Focusable {
    return this.buttons.find((b) => (b as Button).x > this.box.x) ?? this.buttons[0];
  }

  destroy(): void {
    for (const b of this.buttons) b.destroy();
    this.validateButton.destroy();
    this.box.destroy();
  }
}

// ---------------------------------------------------------------------------
// Option sélectionnable (plateau, carte) : un cadre qui contient ce que la scène y dessine.
// ---------------------------------------------------------------------------

export class Option extends Phaser.GameObjects.Container implements Focusable {
  selected = false;
  label?: string;
  private frame: Phaser.GameObjects.Graphics;
  private badge: Phaser.GameObjects.Container;
  private enabledFlag = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    public boxW: number,
    public boxH: number,
    private onPress: () => void,
    private fill: number = C.cream,
  ) {
    super(scene, x, y);
    this.frame = scene.add.graphics();
    this.add(this.frame);
    const w = boxW;
    const h = boxH;
    this.badge = scene.add.container(w / 2 - 10, -h / 2 + 10);
    const bg = scene.add.graphics();
    bg.fillStyle(C.green, 1);
    bg.fillCircle(0, 0, 34);
    bg.lineStyle(5, C.ink, 1);
    bg.strokeCircle(0, 0, 34);
    bg.lineStyle(9, C.white, 1);
    bg.beginPath();
    bg.moveTo(-15, 1);
    bg.lineTo(-4, 13);
    bg.lineTo(16, -11);
    bg.strokePath();
    this.badge.add(bg);
    this.badge.setVisible(false);
    this.draw();
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      services.input.noteInteraction({ source: 'pointer', trusted: true });
      services.focus.press(this);
    });
    scene.add.existing(this);
  }

  /** Le badge passe au premier plan (après ajout du contenu). */
  finalize(): this {
    this.bringToTop(this.badge);
    return this;
  }

  setSelected(on: boolean): void {
    this.selected = on;
    this.badge.setVisible(on);
    this.draw();
  }

  setFill(color: number): void {
    this.fill = color;
    this.draw();
  }

  setEnabled(on: boolean): void {
    this.enabledFlag = on;
  }

  bounds(): Rect {
    return { x: this.x - this.boxW / 2, y: this.y - this.boxH / 2, width: this.boxW, height: this.boxH };
  }

  isEnabled(): boolean {
    return this.enabledFlag && this.visible;
  }

  activate(): void {
    this.onPress();
  }

  private draw(): void {
    const w = this.boxW;
    const h = this.boxH;
    const g = this.frame;
    g.clear();
    g.fillStyle(0x000000, 0.2);
    g.fillRoundedRect(-w / 2 + 5, -h / 2 + 9, w, h, 26);
    g.fillStyle(this.fill, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 26);
    g.lineStyle(this.selected ? 12 : 6, this.selected ? C.green : C.ink, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 26);
  }
}

/** Choisir une option parmi plusieurs (plateaux…). */
export class ChoiceAnswer implements AnswerUI<number> {
  validateButton: Button;

  constructor(
    scene: Phaser.Scene,
    private options: Option[],
    onValidate: () => void,
  ) {
    this.validateButton = makeValidate(scene, 1400, onValidate);
  }

  select(index: number): void {
    this.options.forEach((o, i) => o.setSelected(i === index));
    services.sfx.select();
  }

  value(): number | null {
    const i = this.options.findIndex((o) => o.selected);
    return i >= 0 ? i : null;
  }

  set(v: number): void {
    this.select(v);
  }

  focusables(): Focusable[] {
    return [...this.options, this.validateButton];
  }

  first(): Focusable {
    return this.options[0];
  }

  onDigit(): void {
    /* pas de chiffres ici */
  }

  destroy(): void {
    this.validateButton.destroy();
  }
}

/**
 * Ranger des cartes dans l'ordre : toucher une carte la place dans la première case libre,
 * toucher une carte placée la remet à sa place (correction libre, P3).
 */
export class OrderAnswer implements AnswerUI<number[]> {
  validateButton: Button;
  private slots: (number | null)[];
  private home: { x: number; y: number }[];
  private slotPos: { x: number; y: number }[];

  constructor(
    private scene: Phaser.Scene,
    private cards: Option[],
    private values: number[],
    slotPositions: { x: number; y: number }[],
    onValidate: () => void,
  ) {
    this.slots = slotPositions.map(() => null);
    this.slotPos = slotPositions;
    this.home = cards.map((c) => ({ x: c.x, y: c.y }));
    this.validateButton = makeValidate(scene, 1400, onValidate);
  }

  toggle(cardIndex: number): void {
    const at = this.slots.indexOf(cardIndex);
    if (at >= 0) {
      this.slots[at] = null;
      this.move(cardIndex, this.home[cardIndex]);
      this.cards[cardIndex].setSelected(false);
    } else {
      const free = this.slots.indexOf(null);
      if (free < 0) return;
      this.slots[free] = cardIndex;
      this.move(cardIndex, this.slotPos[free]);
      this.cards[cardIndex].setSelected(true);
    }
    services.sfx.select();
  }

  private move(i: number, to: { x: number; y: number }): void {
    this.scene.tweens.add({ targets: this.cards[i], x: to.x, y: to.y, duration: 280, ease: 'Cubic.Out' });
  }

  value(): number[] | null {
    if (this.slots.some((s) => s === null)) return null;
    return this.slots.map((s) => this.values[s as number]);
  }

  set(v: number[]): void {
    this.slots.forEach((s, i) => {
      if (s !== null) {
        this.slots[i] = null;
        this.move(s, this.home[s]);
        this.cards[s].setSelected(false);
      }
    });
    v.forEach((value) => this.toggle(this.values.indexOf(value)));
  }

  /** Remet toutes les cartes à leur place (après une erreur). */
  reset(): void {
    this.slots.forEach((s, i) => {
      if (s !== null) {
        this.slots[i] = null;
        this.move(s, this.home[s]);
        this.cards[s].setSelected(false);
      }
    });
  }

  focusables(): Focusable[] {
    return [...this.cards, this.validateButton];
  }

  first(): Focusable {
    return this.cards[0];
  }

  destroy(): void {
    this.validateButton.destroy();
  }
}
