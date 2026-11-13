import * as Phaser from 'phaser';
import { C, textStyle } from '../config';
import { services } from '../services';
import { fit } from './assets';
import { Button } from './Button';
import type { Focusable } from './focus';
import { tweenAsync } from './tweens';

const wait = (ms: number) => services.clock.wait(ms);

// ---------------------------------------------------------------------------
// Panneau de voyants (C1.2) : `total` emplacements, dont `lit` déjà allumés.
// Rangées de 10 (dizaines), avec un écart après 5 (regroupement simple).
// ---------------------------------------------------------------------------

type LightState = 'off' | 'on' | 'missing' | 'extra';

export class LightPanel extends Phaser.GameObjects.Container {
  private lights: Phaser.GameObjects.Image[] = [];
  private marks: Phaser.GameObjects.Graphics;
  private extras: Phaser.GameObjects.Image[] = [];
  private states: LightState[] = [];
  private size: number;
  private positions: { x: number; y: number }[] = [];
  private panelW: number;
  private panelH: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    public total: number,
    public lit: number,
  ) {
    super(scene, x, y);
    const rows = Math.ceil(total / 10);
    const cols = Math.min(10, total);
    this.size = total <= 10 ? 92 : total <= 20 ? 76 : 58;
    const gap = this.size * 0.28;
    const groupGap = this.size * 0.45;
    const gridW = cols * this.size + (cols - 1) * gap + (cols > 5 ? groupGap : 0);
    const gridH = rows * this.size + (rows - 1) * gap;
    this.panelW = Math.max(520, gridW + 140);
    this.panelH = gridH + 130;
    const panel = scene.add.image(0, 0, 'panneau');
    panel.setDisplaySize(this.panelW, this.panelH);
    this.add(panel);
    for (let i = 0; i < total; i++) {
      const r = Math.floor(i / 10);
      const c = i % 10;
      const px = -gridW / 2 + this.size / 2 + c * (this.size + gap) + (c >= 5 ? groupGap : 0);
      const py = -gridH / 2 + this.size / 2 + r * (this.size + gap);
      this.positions.push({ x: px, y: py });
      const img = scene.add.image(px, py, i < lit ? 'voyant_vert' : 'voyant_eteint');
      fit(img, this.size, this.size);
      this.lights.push(img);
      this.states.push(i < lit ? 'on' : 'off');
      this.add(img);
    }
    this.marks = scene.add.graphics();
    this.add(this.marks);
    scene.add.existing(this);
  }

  get width_(): number {
    return this.panelW;
  }

  get height_(): number {
    return this.panelH;
  }

  private setLight(i: number, s: LightState): void {
    this.states[i] = s;
    this.lights[i].setTexture(s === 'on' ? 'voyant_vert' : 'voyant_eteint');
    fit(this.lights[i], this.size, this.size);
  }

  /** Effet de la réponse : `n` voyants s'allument un par un, au-delà des voyants déjà allumés. */
  async fill(n: number): Promise<{ missing: number; extra: number }> {
    const free = this.total - this.lit;
    for (let k = 0; k < Math.min(n, free); k++) {
      const i = this.lit + k;
      this.setLight(i, 'on');
      this.scene.tweens.add({ targets: this.lights[i], scale: { from: this.lights[i].scale * 1.3, to: this.lights[i].scale }, duration: 200 });
      services.sfx.pop(k);
      await wait(n > 20 ? 70 : 220);
    }
    const extra = Math.max(0, n - free);
    // Voyants en trop : ils apparaissent en orange, hors du panneau.
    for (let k = 0; k < extra; k++) {
      const col = k % 10;
      const row = Math.floor(k / 10);
      const img = this.scene.add.image(this.panelW / 2 + 70 + row * (this.size * 0.9), -this.panelH / 2 + 60 + col * (this.size * 0.8), 'voyant_orange');
      fit(img, this.size * 0.75, this.size * 0.75);
      this.add(img);
      this.extras.push(img);
      services.sfx.pop(k + 3);
      await wait(n > 20 ? 70 : 220);
    }
    const missing = Math.max(0, free - n);
    if (missing > 0) this.showMissing(C.orange);
    return { missing, extra };
  }

  /** Entoure les places encore vides (erreur « trop peu » ou aide « matérialiser »). */
  showMissing(color: number = C.mustard): void {
    this.marks.clear();
    this.marks.lineStyle(8, color, 1);
    this.states.forEach((s, i) => {
      if (s === 'on') return;
      const p = this.positions[i];
      this.marks.strokeCircle(p.x, p.y, this.size * 0.58);
    });
    this.scene.tweens.add({ targets: this.marks, alpha: { from: 0.3, to: 1 }, duration: 400, yoyo: true, repeat: 2 });
  }

  /** Aide « compter » : chaque place vide est montrée et son rang est dit. */
  async countMissing(): Promise<void> {
    let k = 0;
    for (let i = 0; i < this.total; i++) {
      if (this.states[i] === 'on') continue;
      k++;
      const p = this.positions[i];
      const label = this.scene.add.text(p.x, p.y, String(k), textStyle(this.size * 0.55, { color: '#3a2a20' })).setOrigin(0.5);
      this.add(label);
      this.scene.tweens.add({ targets: label, scale: { from: 1.6, to: 1 }, duration: 200 });
      await services.voice.sayNumber(k);
      await wait(250);
      this.scene.time.delayedCall(2500, () => label.destroy());
    }
  }

  /** Après une erreur : on revient à l'état de départ (les données de la consigne sont conservées). */
  reset(): void {
    for (let i = this.lit; i < this.total; i++) this.setLight(i, 'off');
    for (const e of this.extras) e.destroy();
    this.extras = [];
    this.marks.clear();
  }

  allOn(): void {
    for (let i = 0; i < this.total; i++) this.setLight(i, 'on');
  }
}

// ---------------------------------------------------------------------------
// Plateau d'équipements (C1.3) : objets rangés par lignes de 5.
// ---------------------------------------------------------------------------

export function layoutItems(n: number, perRow: number, size: number, gap: number): { x: number; y: number }[] {
  const rows = Math.ceil(n / perRow);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    const inRow = Math.min(perRow, n - r * perRow);
    const rowW = perRow * size + (perRow - 1) * gap;
    out.push({
      x: -rowW / 2 + size / 2 + c * (size + gap) + 0 * inRow,
      y: -((rows - 1) * (size + gap)) / 2 + r * (size + gap),
    });
  }
  return out;
}

export class ItemGroup extends Phaser.GameObjects.Container {
  items: Phaser.GameObjects.Image[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    public n: number,
    texture: string,
    private itemSize: number,
  ) {
    super(scene, x, y);
    const pos = layoutItems(n, 5, itemSize, itemSize * 0.18);
    for (const p of pos) {
      const img = scene.add.image(p.x, p.y, texture);
      fit(img, itemSize, itemSize);
      this.items.push(img);
      this.add(img);
    }
    scene.add.existing(this);
  }

  /** Aide « matérialiser » : une seule ligne, alignée à gauche, pour comparer un à un. */
  lineUp(width: number): Promise<void> {
    const size = Math.min(this.itemSize, (width - 20) / this.n);
    return Promise.all(
      this.items.map((img, i) =>
        tweenAsync(this.scene, {
          targets: img,
          x: -width / 2 + size / 2 + i * size,
          y: 0,
          scale: (img.scale * size) / this.itemSize,
          duration: 500,
          ease: 'Cubic.Out',
        }),
      ),
    ).then(() => undefined);
  }

  /** Aide « compter » : les objets sont montrés un par un, et leur rang est dit. */
  async countAloud(): Promise<void> {
    for (let i = 0; i < this.items.length; i++) {
      const img = this.items[i];
      this.scene.tweens.add({ targets: img, scale: { from: img.scale * 1.35, to: img.scale }, duration: 220 });
      await services.voice.sayNumber(i + 1);
      await wait(200);
    }
  }

  /** Désordre : les objets tremblent (erreur) ou se calment. */
  shake(on: boolean): void {
    for (const img of this.items) {
      this.scene.tweens.killTweensOf(img);
      if (on) this.scene.tweens.add({ targets: img, angle: { from: -8, to: 8 }, duration: 90, yoyo: true, repeat: 5 });
      else img.setAngle(0);
    }
  }
}

// ---------------------------------------------------------------------------
// Carte de nombre (fin de CP) : le nombre et sa représentation en dizaines et unités.
// ---------------------------------------------------------------------------

export function drawTensUnits(scene: Phaser.Scene, value: number, width: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const tens = Math.floor(value / 10);
  const units = value % 10;
  const barW = 16;
  const barH = 92;
  const total = tens * (barW + 8) + (units ? 14 + Math.ceil(units / 5) * 20 : 0);
  let x = -Math.min(total, width) / 2;
  for (let t = 0; t < tens; t++) {
    g.fillStyle(C.sky, 1);
    g.fillRect(x, -barH / 2, barW, barH);
    g.lineStyle(2, C.ink, 1);
    for (let k = 1; k < 10; k++) g.lineBetween(x, -barH / 2 + (k * barH) / 10, x + barW, -barH / 2 + (k * barH) / 10);
    g.strokeRect(x, -barH / 2, barW, barH);
    x += barW + 8;
  }
  x += 6;
  for (let u = 0; u < units; u++) {
    g.fillStyle(C.orange, 1);
    g.fillRect(x + Math.floor(u / 5) * 20, -barH / 2 + (u % 5) * 19, 15, 15);
    g.lineStyle(2, C.ink, 1);
    g.strokeRect(x + Math.floor(u / 5) * 20, -barH / 2 + (u % 5) * 19, 15, 15);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Jetons numériques (P17) : deux cadres de dix, + et −. Gratuit, sans effet sur les étoiles.
// ---------------------------------------------------------------------------

export class TokenTray extends Phaser.GameObjects.Container {
  value = 0;
  readonly buttons: Button[];
  private tokens: Phaser.GameObjects.Image[] = [];
  private cells: { x: number; y: number }[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene, 360, 300);
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.25);
    bg.fillRoundedRect(-262, -152, 530, 300, 28);
    bg.fillStyle(0x6b4a33, 1);
    bg.fillRoundedRect(-266, -160, 530, 300, 28);
    bg.lineStyle(6, C.ink, 1);
    bg.strokeRoundedRect(-266, -160, 530, 300, 28);
    this.add(bg);
    // deux cadres de dix (2 × 5)
    const cell = 72;
    for (let f = 0; f < 2; f++) {
      for (let i = 0; i < 10; i++) {
        const x = -220 + (i % 5) * cell + 36;
        const y = -140 + f * 160 + Math.floor(i / 5) * cell + 36;
        this.cells.push({ x, y });
        bg.lineStyle(3, C.cream, 0.7);
        bg.strokeRect(x - cell / 2, y - cell / 2, cell, cell);
      }
    }
    const minus = new Button(scene, { x: 360 + 330, y: 300 - 70, w: 110, h: 110, icon: 'minus', iconSize: 60, onPress: () => this.change(-1) });
    const plus = new Button(scene, { x: 360 + 330, y: 300 + 60, w: 110, h: 110, icon: 'plus', iconSize: 60, onPress: () => this.change(1) });
    this.buttons = [minus, plus];
    scene.add.existing(this);
    this.setVisible(false);
    for (const b of this.buttons) b.setVisible(false);
  }

  get focusables(): Focusable[] {
    return this.buttons;
  }

  show(on: boolean): void {
    this.setVisible(on);
    for (const b of this.buttons) b.setVisible(on);
  }

  change(d: number): void {
    const next = Phaser.Math.Clamp(this.value + d, 0, 20);
    if (next === this.value) return;
    if (d > 0) {
      const p = this.cells[this.value];
      const img = this.scene.add.image(p.x, p.y - 40, 'jeton');
      fit(img, 60, 60);
      this.add(img);
      this.tokens.push(img);
      this.scene.tweens.add({ targets: img, y: p.y, duration: 200, ease: 'Bounce.Out' });
    } else {
      this.tokens.pop()?.destroy();
    }
    this.value = next;
    services.sfx.pop(next);
    void services.voice.sayNumber(next);
  }

  clear(): void {
    for (const t of this.tokens) t.destroy();
    this.tokens = [];
    this.value = 0;
  }

  override destroy(fromScene?: boolean): void {
    for (const b of this.buttons) b.destroy();
    super.destroy(fromScene);
  }
}
