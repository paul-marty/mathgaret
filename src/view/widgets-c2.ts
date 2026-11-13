import * as Phaser from 'phaser';
import { C, textStyle } from '../config';
import type { Profile } from '../math/families';
import { services } from '../services';
import { EQUIPMENT, fit } from './assets';
import { ZONES } from './placeholders-c2';
import { tweenAsync } from './tweens';

/**
 * Éléments visuels du chapitre 2 : cadre des écrans de simulation (P1), fonctions de l'ordinateur,
 * tableau « disponibles / installés / restants », piste de la balise et vol simulé.
 */

const wait = (ms: number) => services.clock.wait(ms);
type Img = Phaser.GameObjects.Image;
type Pt = { x: number; y: number };

/** Rectangle (coordonnées du monde) d'une zone utile d'une image posée dans le décor. */
export function zoneOf(img: Img, zone: keyof typeof ZONES): { x: number; y: number; w: number; h: number } {
  const z = ZONES[zone];
  const w = img.displayWidth;
  const h = img.displayHeight;
  return { x: img.x - w * img.originX + w * z.cx, y: img.y - h * img.originY + h * z.cy, w: w * z.w, h: h * z.h };
}

/** Pastille de nombre (étiquette d'une zone, résultat conservé). */
export function pill(scene: Phaser.Scene, x: number, y: number, text: string, color: number = C.white): Phaser.GameObjects.Container {
  const t = scene.add.text(0, 2, text, textStyle(40, { color: '#3a2a20' })).setOrigin(0.5);
  const w = Math.max(70, t.width + 34);
  const bg = scene.add.graphics();
  bg.fillStyle(color, 1);
  bg.fillRoundedRect(-w / 2, -30, w, 60, 30);
  bg.lineStyle(5, C.ink, 1);
  bg.strokeRoundedRect(-w / 2, -30, w, 60, 30);
  return scene.add.container(x, y, [bg, t]);
}

/** Petite coche verte. */
export function drawCheck(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, color: number = C.green): void {
  g.lineStyle(Math.max(4, size * 0.18), color, 1);
  g.beginPath();
  g.moveTo(x - size * 0.4, y);
  g.lineTo(x - size * 0.1, y + size * 0.3);
  g.lineTo(x + size * 0.45, y - size * 0.35);
  g.strokePath();
}

// ---------------------------------------------------------------------------
// Cadre des écrans de simulation (P1) : bordure menthe et icône de maquette.
// ---------------------------------------------------------------------------

export class SimFrame extends Phaser.GameObjects.Container {
  readonly icon: Img;

  /** `iconInside` : icône dans l'angle (cadre plein écran, sinon elle sortirait de l'écran). */
  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, opts: { screen?: boolean; iconInside?: boolean } = {}) {
    super(scene, x, y);
    const g = scene.add.graphics();
    if (opts.screen !== false) {
      g.fillStyle(0x16324a, 0.94);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 30);
      g.lineStyle(2, C.mint, 0.13);
      for (let gx = -w / 2 + 60; gx < w / 2; gx += 60) g.lineBetween(gx, -h / 2 + 8, gx, h / 2 - 8);
      for (let gy = -h / 2 + 60; gy < h / 2; gy += 60) g.lineBetween(-w / 2 + 8, gy, w / 2 - 8, gy);
    }
    g.lineStyle(12, C.mint, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 30);
    g.lineStyle(3, C.cream, 0.8);
    g.strokeRoundedRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 22);
    this.add(g);
    const inset = opts.iconInside ? 64 : 8;
    this.icon = fit(scene.add.image(-w / 2 + inset, -h / 2 + inset, 'icone_maquette'), 84, 84);
    this.add(this.icon);
    scene.add.existing(this);
  }

  /** Apparition : l'icône de maquette sautille (repère de simulation, P1). */
  async appear(): Promise<void> {
    this.setAlpha(0);
    await tweenAsync(this.scene, { targets: this, alpha: 1, duration: 350 });
    await tweenAsync(this.scene, { targets: this.icon, scale: this.icon.scale * 1.25, duration: 180, yoyo: true });
  }
}

// ---------------------------------------------------------------------------
// Fonctions de l'ordinateur (C2.1) : une par sorte d'équipement préparée.
// ---------------------------------------------------------------------------

export type FunctionState = 'off' | 'on' | 'alert';

export class FunctionPanel extends Phaser.GameObjects.Container {
  static readonly COUNT = 6;
  private slots: { ring: Phaser.GameObjects.Graphics; icon: Img; state: FunctionState }[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const n = FunctionPanel.COUNT;
    const step = 98;
    const w = 130 + n * step;
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.2);
    bg.fillRoundedRect(-w / 2 + 6, -50, w, 104, 26);
    bg.fillStyle(0x9aa0ab, 1);
    bg.fillRoundedRect(-w / 2, -54, w, 104, 26);
    bg.lineStyle(6, C.ink, 1);
    bg.strokeRoundedRect(-w / 2, -54, w, 104, 26);
    this.add(bg);
    const computer = fit(scene.add.image(-w / 2 + 62, -2, 'ordinateur_apollo'), 84, 84);
    this.add(computer);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 140 + step / 2 + i * step - 10;
      const ring = scene.add.graphics();
      const icon = fit(scene.add.image(x, -2, EQUIPMENT[i % EQUIPMENT.length]), 58, 58);
      this.add([ring, icon]);
      this.slots.push({ ring, icon, state: 'off' });
      this.draw(i, 'off');
    }
    scene.add.existing(this);
  }

  private draw(i: number, state: FunctionState): void {
    const s = this.slots[i];
    s.state = state;
    const g = s.ring;
    g.clear();
    const x = s.icon.x;
    const fill = state === 'on' ? C.green : state === 'alert' ? C.orange : 0x5d6270;
    g.fillStyle(fill, 1);
    g.fillCircle(x, -2, 42);
    g.lineStyle(5, C.ink, 1);
    g.strokeCircle(x, -2, 42);
    s.icon.setAlpha(state === 'off' ? 0.35 : 1);
  }

  get lit(): number {
    return this.slots.filter((s) => s.state === 'on').length;
  }

  set(i: number, state: FunctionState): void {
    this.draw(Math.min(i, this.slots.length - 1), state);
  }

  /** Une fonction s'anime : elle s'allume, son icône bondit, l'ordinateur bipe. */
  async activate(i: number): Promise<void> {
    const k = Math.min(i, this.slots.length - 1);
    this.draw(k, 'on');
    services.sfx.beeps(2);
    const icon = this.slots[k].icon;
    await tweenAsync(this.scene, { targets: icon, scale: icon.scale * 1.4, angle: 360, duration: 500, yoyo: true, ease: 'Back.Out' });
    icon.setAngle(0);
  }

  /** Boutons qui s'éclairent dans un ordre doux (C2.1), puis s'éteignent. */
  async sweep(): Promise<void> {
    for (let i = 0; i < this.slots.length; i++) {
      const before = this.slots[i].state;
      this.draw(i, 'on');
      services.sfx.pop(i);
      await wait(180);
      this.draw(i, before);
    }
  }

  all(state: FunctionState): void {
    for (let i = 0; i < this.slots.length; i++) this.draw(i, state);
  }
}

// ---------------------------------------------------------------------------
// Tableau à trois zones (C2.1, C2.3) : disponibles en haut, installés (ou utilisés) en bas à gauche,
// restants en bas à droite. Les objets se déplacent d'une zone à l'autre ; le résultat reste affiché.
// ---------------------------------------------------------------------------

interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Places pour `n` objets dans une zone : lignes de dix, avec un écart après cinq (regroupement). */
function slotsIn(zone: Zone, n: number, maxSize: number): { pos: Pt[]; size: number } {
  const cols = Math.min(10, Math.max(1, n));
  const rows = Math.ceil(n / 10);
  const gapRatio = 0.2;
  const groupGap = cols > 5 ? 0.5 : 0;
  const byW = (zone.w - 40) / (cols + (cols - 1) * gapRatio + groupGap);
  const byH = (zone.h - 40) / (rows + (rows - 1) * gapRatio);
  const size = Math.min(maxSize, byW, byH);
  const gap = size * gapRatio;
  const gridW = cols * size + (cols - 1) * gap + groupGap * size;
  const gridH = rows * size + (rows - 1) * gap;
  const pos: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / 10);
    const c = i % 10;
    pos.push({
      x: zone.x - gridW / 2 + size / 2 + c * (size + gap) + (c >= 5 ? groupGap * size : 0),
      y: zone.y - gridH / 2 + size / 2 + r * (size + gap),
    });
  }
  return { pos, size };
}

export interface BoardOptions {
  w: number;
  h: number;
  total: number;
  texture: string;
  /** Zone des objets installés : compartiment de la fusée (C2.1) ou réserves utilisées (C2.3). */
  taken: 'compartiment' | 'utilisees';
  /** Places à prévoir dans les zones du bas. */
  capacity: number;
}

export class TransferBoard extends Phaser.GameObjects.Container {
  /** Objets encore à examiner (ceux dont on cherche le nombre). */
  pool: Img[] = [];
  private items: Img[] = [];
  private source: Zone;
  private takenZone: Zone;
  private restZone: Zone;
  private sourceSlots: { pos: Pt[]; size: number };
  private takenSlots: { pos: Pt[]; size: number };
  private restSlots: { pos: Pt[]; size: number };
  private takenCount = 0;
  private marks: Phaser.GameObjects.GameObject[] = [];
  private labels: Phaser.GameObjects.Container[] = [];
  private lamp: Phaser.GameObjects.Graphics;
  private lampTween: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private opts: BoardOptions,
  ) {
    super(scene, x, y);
    const { w, h } = opts;
    const topH = h * 0.44;
    const botH = h * 0.5;
    this.source = { x: 0, y: -h / 2 + topH / 2, w, h: topH };
    this.takenZone = { x: -w / 4 - 10, y: h / 2 - botH / 2, w: w / 2 - 20, h: botH };
    this.restZone = { x: w / 4 + 10, y: h / 2 - botH / 2, w: w / 2 - 20, h: botH };

    const g = scene.add.graphics();
    // disponibles : un plateau clair
    g.fillStyle(C.cream, 0.95);
    g.fillRoundedRect(this.source.x - w / 2, this.source.y - topH / 2, w, topH, 24);
    g.lineStyle(5, C.ink, 1);
    g.strokeRoundedRect(this.source.x - w / 2, this.source.y - topH / 2, w, topH, 24);
    // restants : un cadre en pointillés, à remplir
    const r = this.restZone;
    g.lineStyle(5, C.mint, 1);
    const dash = (x1: number, y1: number, x2: number, y2: number) => {
      const len = Math.hypot(x2 - x1, y2 - y1);
      for (let d = 0; d < len; d += 28) {
        const a = d / len;
        const b = Math.min(1, (d + 16) / len);
        g.lineBetween(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b);
      }
    };
    const rx = r.x - r.w / 2;
    const ry = r.y - r.h / 2;
    dash(rx, ry, rx + r.w, ry);
    dash(rx + r.w, ry, rx + r.w, ry + r.h);
    dash(rx + r.w, ry + r.h, rx, ry + r.h);
    dash(rx, ry + r.h, rx, ry);
    this.add(g);

    // installés : le compartiment ouvert de la fusée, ou la zone des réserves utilisées
    const t = this.takenZone;
    if (opts.taken === 'compartiment') {
      const img = scene.add.image(t.x, t.y, 'compartiment');
      img.setDisplaySize(t.w, t.h);
      this.add(img);
      const inner = ZONES.compartiment;
      this.takenZone = { x: t.x + (inner.cx - 0.5) * t.w, y: t.y + (inner.cy - 0.5) * t.h, w: t.w * inner.w, h: t.h * inner.h };
    } else {
      const box = scene.add.graphics();
      box.fillStyle(0x2c3140, 0.85);
      box.fillRoundedRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h, 22);
      box.lineStyle(5, C.ink, 1);
      box.strokeRoundedRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h, 22);
      this.add(box);
      const rocket = fit(scene.add.image(t.x - t.w / 2 + 34, t.y - t.h / 2 + 46, 'fusee_sim'), 50, 70).setAngle(-20);
      this.add(rocket);
      this.takenZone = { x: t.x + 20, y: t.y, w: t.w - 60, h: t.h };
    }
    // voyant d'état du compartiment : en attente (orange) ou prêt (vert)
    this.lamp = scene.add.graphics();
    this.add(this.lamp);

    this.sourceSlots = slotsIn(this.source, opts.total, 96);
    this.takenSlots = slotsIn(this.takenZone, opts.capacity, 72);
    this.restSlots = slotsIn(this.restZone, opts.capacity, 72);
    for (let i = 0; i < opts.total; i++) {
      const p = this.sourceSlots.pos[i];
      const img = fit(scene.add.image(p.x, p.y, opts.texture), this.sourceSlots.size, this.sourceSlots.size);
      this.items.push(img);
      this.add(img);
    }
    this.pool = [...this.items];
    scene.add.existing(this);
  }

  private label(zone: Zone, text: string, color: number = C.white, dx = 0): void {
    const l = pill(this.scene, zone.x + zone.w / 2 - 50 - dx, zone.y - zone.h / 2 - 6, text, color);
    this.add(l);
    this.labels.push(l);
    this.scene.tweens.add({ targets: l, scale: { from: 1.4, to: 1 }, duration: 250, ease: 'Back.Out' });
  }

  private setLamp(state: 'off' | 'wait' | 'ok'): void {
    this.lampTween?.stop();
    this.lampTween = null;
    this.lamp.clear().setAlpha(1);
    if (state === 'off') return;
    const t = this.takenZone;
    const x = t.x - t.w / 2 - 6;
    const y = t.y - t.h / 2 - 34;
    this.lamp.fillStyle(state === 'ok' ? C.green : C.orange, 1);
    this.lamp.fillCircle(x, y, 18);
    this.lamp.lineStyle(4, C.ink, 1);
    this.lamp.strokeCircle(x, y, 18);
    if (state === 'wait') this.lampTween = this.scene.tweens.add({ targets: this.lamp, alpha: 0.3, duration: 350, yoyo: true, repeat: -1 });
  }

  /** `n` objets partent dans la zone du bas à gauche (installés, ou utilisés par l'essai). */
  async take(n: number): Promise<void> {
    const moving = this.pool.slice(this.pool.length - n);
    this.pool = this.pool.slice(0, this.pool.length - n);
    const { pos, size } = this.takenSlots;
    const fast = n > 10;
    for (const img of moving) {
      const p = pos[this.takenCount++] ?? pos[pos.length - 1];
      const scale = img.scale * (size / this.sourceSlots.size);
      this.scene.tweens.add({ targets: img, x: p.x, y: p.y, scale, alpha: this.opts.taken === 'utilisees' ? 0.35 : 1, duration: 420, ease: 'Cubic.InOut' });
      services.sfx.pop(this.takenCount);
      await wait(fast ? 60 : 200);
    }
    await wait(450);
    this.label(this.takenZone, String(this.takenCount));
  }

  /** Deuxième étape (fin de CP) : `n` des objets restants sont contrôlés, ils reçoivent une coche. */
  async check(n: number): Promise<void> {
    const checked = this.pool.slice(this.pool.length - n);
    this.pool = this.pool.slice(0, this.pool.length - n);
    for (const img of checked) {
      const g = this.scene.add.graphics();
      drawCheck(g, img.x, img.y, img.displayWidth * 0.8);
      this.add(g);
      img.setAlpha(0.4);
      services.sfx.pop(2);
      await wait(90);
    }
    const lastLabel = this.labels[this.labels.length - 1];
    const pillG = pill(this.scene, this.restZone.x - this.restZone.w / 2 + 70, this.restZone.y - this.restZone.h / 2 - 6, `✓ ${n}`, C.green);
    this.add(pillG);
    this.labels.push(pillG);
    if (lastLabel) this.bringToTop(lastLabel);
  }

  /**
   * Effet de la réponse : les objets examinés reçoivent les numéros 1 à `a`.
   * Trop peu : ceux qui restent sans numéro sont entourés. Trop : des places vides numérotées apparaissent.
   */
  async countAnswer(a: number): Promise<{ missing: number; extra: number }> {
    this.clearMarks();
    const r = this.pool.length;
    const fast = a > 12;
    for (let k = 0; k < Math.min(a, r); k++) {
      this.badge(this.pool[k], k + 1, C.white);
      services.sfx.pop(k);
      await wait(fast ? 60 : 200);
    }
    const extra = Math.max(0, a - r);
    if (extra > 0) {
      // Places en trop : là où il n'y a plus rien à compter.
      const free = this.freePositions();
      for (let k = 0; k < extra; k++) {
        const p = free[k] ?? { x: free[free.length - 1].x + (k - free.length + 1) * 30, y: free[free.length - 1].y };
        const g = this.scene.add.graphics();
        const size = this.poolSize();
        g.lineStyle(5, C.orange, 1);
        g.strokeCircle(p.x, p.y, size * 0.5);
        this.add(g);
        this.marks.push(g);
        const t = this.scene.add.text(p.x, p.y, String(r + k + 1), textStyle(Math.max(22, size * 0.42), { color: '#f08a3c' })).setOrigin(0.5);
        this.add(t);
        this.marks.push(t);
        services.sfx.pop(r + k);
        await wait(fast ? 60 : 200);
      }
    }
    const missing = Math.max(0, r - a);
    if (missing > 0) this.ring(this.pool.slice(a), C.orange);
    this.setLamp('wait');
    return { missing, extra };
  }

  private poolSize(): number {
    return this.pool[0]?.displayWidth ?? this.sourceSlots.size;
  }

  /** Places libérées dans la zone des objets examinés (pour montrer ce qui a été compté en trop). */
  private freePositions(): Pt[] {
    const inSource = this.pool.length > 0 && this.pool[0].y < this.source.y + this.source.h / 2;
    const slots = inSource ? this.sourceSlots.pos : this.restSlots.pos;
    const used = new Set(this.pool.map((img) => `${Math.round(img.x)}:${Math.round(img.y)}`));
    const start = this.pool.length;
    return slots.slice(start).filter((p) => !used.has(`${Math.round(p.x)}:${Math.round(p.y)}`));
  }

  private badge(img: Img, n: number, color: number): void {
    const size = Math.max(30, img.displayWidth * 0.55);
    const g = this.scene.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(img.x + img.displayWidth * 0.32, img.y - img.displayHeight * 0.32, size / 2);
    g.lineStyle(3, C.ink, 1);
    g.strokeCircle(img.x + img.displayWidth * 0.32, img.y - img.displayHeight * 0.32, size / 2);
    const t = this.scene.add
      .text(img.x + img.displayWidth * 0.32, img.y - img.displayHeight * 0.32 + 1, String(n), textStyle(size * 0.62, { color: '#3a2a20' }))
      .setOrigin(0.5);
    this.add([g, t]);
    this.marks.push(g, t);
  }

  private ring(imgs: Img[], color: number): void {
    const g = this.scene.add.graphics();
    g.lineStyle(6, color, 1);
    for (const img of imgs) g.strokeCircle(img.x, img.y, img.displayWidth * 0.62);
    this.add(g);
    this.marks.push(g);
    this.scene.tweens.add({ targets: g, alpha: { from: 0.3, to: 1 }, duration: 400, yoyo: true, repeat: 2 });
  }

  /** Aide « matérialiser » : les objets à compter sont entourés. */
  showPool(): void {
    this.clearMarks();
    this.ring(this.pool, C.mustard);
  }

  /** Aide « compter » : les objets sont numérotés un par un (par lignes de dix au-delà de vingt). */
  async countPool(): Promise<void> {
    this.clearMarks();
    const n = this.pool.length;
    if (n > 20) {
      for (let k = 10; k <= n; k += 10) {
        const row = this.pool.slice(k - 10, k);
        this.ring(row, C.mustard);
        this.badge(row[9], k, C.mustard);
        await services.voice.sayNumber(k);
        await wait(300);
      }
      for (let k = Math.floor(n / 10) * 10 + 1; k <= n; k++) {
        this.badge(this.pool[k - 1], k, C.white);
        await services.voice.sayNumber(k);
        await wait(200);
      }
      return;
    }
    for (let k = 1; k <= n; k++) {
      this.badge(this.pool[k - 1], k, C.white);
      await services.voice.sayNumber(k);
      await wait(200);
    }
  }

  clearMarks(): void {
    for (const m of this.marks) m.destroy();
    this.marks = [];
  }

  /** Erreur corrigée : retour à l'état de la consigne (les données restent visibles). */
  resetMarks(): void {
    this.clearMarks();
  }

  /** Bonne réponse : les objets restants rejoignent la zone des restants, leur nombre reste affiché. */
  async settle(): Promise<void> {
    this.clearMarks();
    this.setLamp('off');
    const { pos, size } = this.restSlots;
    const inRest = this.pool.length > 0 && this.pool[0].x > this.restZone.x - this.restZone.w / 2;
    if (!inRest) {
      const step = this.pool.length > 10 ? 25 : 80;
      this.pool.forEach((img, i) => {
        const p = pos[i] ?? pos[pos.length - 1];
        const scale = Math.min(size / img.width, size / img.height);
        this.scene.tweens.add({ targets: img, x: p.x, y: p.y, scale, duration: 500, delay: i * step, ease: 'Cubic.InOut' });
      });
      await wait(600 + this.pool.length * step);
    } else {
      // Deuxième étape réussie : ceux qui restent à traiter sont entourés, le premier résultat reste affiché.
      const g = this.scene.add.graphics();
      g.lineStyle(5, C.mint, 1);
      for (const img of this.pool) g.strokeCircle(img.x, img.y, img.displayWidth * 0.6);
      this.add(g);
    }
    this.label(this.restZone, String(this.pool.length), C.mint, inRest ? -10 : 0);
  }

  /** Clôture du problème : le compartiment est prêt (voyant vert). */
  ready(): void {
    this.setLamp('ok');
  }
}

// ---------------------------------------------------------------------------
// Piste de la simulation (C2.2) : des cases numérotées, la fusée, la balise à rejoindre.
// En fin de CP, la piste est rangée en lignes de dix (piste groupée).
// ---------------------------------------------------------------------------

export class Track extends Phaser.GameObjects.Container {
  readonly mode: 'line' | 'grid';
  readonly firstCell: number;
  readonly lastCell: number;
  rocket: Img;
  private beacon: Img;
  private lamp: Phaser.GameObjects.Graphics;
  private cells = new Map<number, Pt>();
  private cell: number;
  private marks: Phaser.GameObjects.GameObject[] = [];
  private wobble: Phaser.Tweens.Tween | null = null;
  private at = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, profile: Profile) {
    super(scene, x, y);
    this.mode = profile === 'fin' ? 'grid' : 'line';
    this.firstCell = this.mode === 'grid' ? 1 : 0;
    this.lastCell = profile === 'debut' ? 10 : profile === 'milieu' ? 20 : 60;
    const g = scene.add.graphics();
    this.add(g);
    if (this.mode === 'line') {
      const n = this.lastCell + 1;
      this.cell = profile === 'debut' ? 104 : 70;
      const w = n * this.cell;
      for (let v = 0; v <= this.lastCell; v++) {
        const cx = -w / 2 + this.cell / 2 + v * this.cell;
        this.cells.set(v, { x: cx, y: 0 });
        g.fillStyle(v === 0 ? C.mint : v % 5 === 0 ? 0x24506e : 0x1d4260, 1);
        g.fillRect(cx - this.cell / 2 + 3, -this.cell / 2, this.cell - 6, this.cell);
        g.lineStyle(3, C.mint, 0.7);
        g.strokeRect(cx - this.cell / 2 + 3, -this.cell / 2, this.cell - 6, this.cell);
        this.add(scene.add.text(cx, this.cell / 2 + 26, String(v), textStyle(this.cell > 80 ? 40 : 30, { color: '#f6ecd9' })).setOrigin(0.5));
      }
    } else {
      this.cell = 62;
      const gap = 6;
      const groupGap = 12;
      const w = 10 * this.cell + 9 * gap + groupGap;
      const h = 6 * this.cell + 5 * gap;
      for (let v = 1; v <= this.lastCell; v++) {
        const r = Math.floor((v - 1) / 10);
        const c = (v - 1) % 10;
        const cx = -w / 2 + this.cell / 2 + c * (this.cell + gap) + (c >= 5 ? groupGap : 0);
        const cy = -h / 2 + this.cell / 2 + r * (this.cell + gap);
        this.cells.set(v, { x: cx, y: cy });
        g.fillStyle(v % 10 === 0 ? 0x24506e : 0x1d4260, 1);
        g.fillRoundedRect(cx - this.cell / 2, cy - this.cell / 2, this.cell, this.cell, 8);
        g.lineStyle(2, C.mint, 0.6);
        g.strokeRoundedRect(cx - this.cell / 2, cy - this.cell / 2, this.cell, this.cell, 8);
        this.add(scene.add.text(cx, cy + 2, String(v), textStyle(24, { color: '#f6ecd9' })).setOrigin(0.5).setAlpha(0.85));
      }
    }
    this.beacon = fit(scene.add.image(0, 0, 'balise'), this.cell * 1.1, this.cell * (this.mode === 'grid' ? 1.1 : 1.5)).setOrigin(0.5, 1);
    this.lamp = scene.add.graphics();
    this.rocket = fit(scene.add.image(0, 0, 'fusee_sim'), this.cell * 0.8, this.cell * 0.95).setAngle(90);
    this.add([this.beacon, this.lamp, this.rocket]);
    scene.add.existing(this);
  }

  pos(v: number): Pt {
    const c = Phaser.Math.Clamp(v, this.firstCell, this.lastCell);
    return this.cells.get(c) ?? { x: 0, y: 0 };
  }

  placeRocket(v: number): void {
    this.at = v;
    const p = this.pos(v);
    this.rocket.setPosition(p.x, p.y);
  }

  placeBeacon(v: number): void {
    const p = this.pos(v);
    const top = this.mode === 'grid' ? p.y + this.cell * 0.45 : p.y - this.cell / 2 - 4;
    this.beacon.setPosition(p.x + (this.mode === 'grid' ? this.cell * 0.18 : 0), top);
    this.setBeacon('orange');
  }

  setBeacon(color: 'orange' | 'green'): void {
    const z = ZONES.lampe;
    const b = this.beacon;
    const x = b.x - b.displayWidth * b.originX + b.displayWidth * z.cx;
    const y = b.y - b.displayHeight * b.originY + b.displayHeight * z.cy;
    this.lamp.clear();
    this.lamp.fillStyle(color === 'green' ? C.green : C.orange, 1);
    this.lamp.fillCircle(x, y, b.displayWidth * 0.17);
    this.lamp.lineStyle(3, C.ink, 1);
    this.lamp.strokeCircle(x, y, b.displayWidth * 0.17);
  }

  /** Le bug : la fusée vacille (elle ne tient pas sa direction). */
  setWobble(on: boolean): void {
    this.wobble?.stop();
    this.wobble = null;
    this.rocket.setAngle(90);
    if (on) this.wobble = this.scene.tweens.add({ targets: this.rocket, angle: { from: 70, to: 110 }, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  /** Effet de la réponse : la fusée avance de `n` cases, une à une. */
  async advance(n: number, to: number): Promise<{ stop: number; missing: number; extra: number }> {
    const from = this.at;
    const stop = Math.min(this.lastCell, from + n);
    const fast = n > 12;
    for (let v = from + 1; v <= stop; v++) {
      const p = this.pos(v);
      await tweenAsync(this.scene, { targets: this.rocket, x: p.x, y: p.y, duration: fast ? 70 : 170, ease: 'Sine.InOut' });
      services.sfx.pop(Math.min(v - from, 20));
    }
    this.at = stop;
    const missing = Math.max(0, to - stop);
    const extra = Math.max(0, from + n - to);
    if (extra > 0) this.markOvershoot(to, from + n);
    return { stop, missing, extra };
  }

  /** Dépassement : les cases au-delà de la balise sont repérées en orange. */
  private markOvershoot(to: number, end: number): void {
    const g = this.scene.add.graphics();
    g.lineStyle(6, C.orange, 1);
    for (let v = to + 1; v <= Math.min(end, this.lastCell); v++) {
      const p = this.pos(v);
      g.strokeRoundedRect(p.x - this.cell / 2 + 4, p.y - this.cell / 2 + 2, this.cell - 8, this.cell - 4, 8);
    }
    if (end > this.lastCell) {
      const p = this.pos(this.lastCell);
      this.add(this.scene.add.text(p.x + this.cell * 0.9, p.y, '→', textStyle(54, { color: '#f08a3c' })).setOrigin(0.5));
    }
    this.add(g);
    this.marks.push(g);
  }

  /** Aide « matérialiser » : le chemin jusqu'à la balise est éclairé. */
  showPath(from: number, to: number, color: number = C.mustard): void {
    const g = this.scene.add.graphics();
    g.fillStyle(color, 0.45);
    for (let v = from + 1; v <= to; v++) {
      const p = this.pos(v);
      g.fillRoundedRect(p.x - this.cell / 2 + 4, p.y - this.cell / 2 + 2, this.cell - 8, this.cell - 4, 8);
    }
    this.addAt(g, 1);
    this.marks.push(g);
  }

  /** Aide « compter » : les cases du chemin sont comptées (ligne par ligne sur la piste groupée). */
  async countPath(from: number, to: number): Promise<void> {
    this.showPath(from, to);
    let k = 0;
    const big = to - from > 12 && this.mode === 'grid';
    for (let v = from + 1; v <= to; v++) {
      k++;
      const endOfRow = this.mode === 'grid' && v % 10 === 0;
      if (big && !endOfRow && v !== to) continue;
      const p = this.pos(v);
      const t = this.scene.add.text(p.x, p.y, String(k), textStyle(this.cell * 0.5, { color: '#3a2a20' })).setOrigin(0.5);
      const bg = this.scene.add.circle(p.x, p.y, this.cell * 0.36, C.mustard);
      this.add([bg, t]);
      this.marks.push(bg, t);
      await services.voice.sayNumber(k);
      await wait(big ? 350 : 180);
    }
  }

  clearMarks(): void {
    for (const m of this.marks) m.destroy();
    this.marks = [];
  }

  /** Le test revient à son point de départ, avec les mêmes données. */
  async reset(from: number): Promise<void> {
    this.clearMarks();
    const p = this.pos(from);
    await tweenAsync(this.scene, { targets: this.rocket, x: p.x, y: p.y, duration: 500, ease: 'Cubic.InOut' });
    this.at = from;
  }
}

// ---------------------------------------------------------------------------
// Vol simulé (C2.3) : la Terre, la Lune, la trajectoire et la fusée, dans l'écran de simulation.
// ---------------------------------------------------------------------------

const P0 = { x: 380, y: 700 };
const P1 = { x: 820, y: -80 };
const P2 = { x: 1590, y: 340 };

function bezier(t: number): Pt {
  const u = 1 - t;
  return { x: u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x, y: u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y };
}

export class FlightView extends Phaser.GameObjects.Container {
  t = 0;
  rocket: Img;
  private trail: Phaser.GameObjects.Graphics;
  private flame: Phaser.GameObjects.Graphics;
  private holdMark: Phaser.GameObjects.Container;
  private holdTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    const g = scene.add.graphics();
    g.fillStyle(0x0f2235, 1);
    g.fillRect(0, 0, 1920, 1080);
    g.lineStyle(2, C.mint, 0.1);
    for (let x = 0; x < 1920; x += 80) g.lineBetween(x, 0, x, 1080);
    for (let y = 0; y < 1080; y += 80) g.lineBetween(0, y, 1920, y);
    g.fillStyle(C.white, 0.8);
    for (let i = 0; i < 70; i++) g.fillCircle((i * 277) % 1900 + 10, (i * 151) % 1060 + 10, (i % 3) + 1);
    // la Terre
    g.fillStyle(0x3d7fb8, 1);
    g.fillCircle(230, 900, 230);
    g.fillStyle(C.green, 0.9);
    g.fillEllipse(170, 820, 160, 90);
    g.fillEllipse(320, 930, 120, 140);
    g.fillEllipse(110, 990, 90, 60);
    g.lineStyle(6, C.mint, 0.8);
    g.strokeCircle(230, 900, 230);
    // la Lune
    g.fillStyle(0xe9e4d4, 1);
    g.fillCircle(1730, 360, 120);
    g.fillStyle(0xc9c2ad, 1);
    g.fillCircle(1690, 320, 22);
    g.fillCircle(1770, 400, 30);
    g.fillCircle(1740, 300, 12);
    g.lineStyle(6, C.mint, 0.8);
    g.strokeCircle(1730, 360, 120);
    // trajectoire prévue en pointillés
    g.fillStyle(C.cream, 0.55);
    for (let k = 0; k <= 60; k++) {
      const p = bezier(k / 60);
      g.fillCircle(p.x, p.y, 5);
    }
    this.add(g);
    this.trail = scene.add.graphics();
    this.flame = scene.add.graphics();
    this.rocket = fit(scene.add.image(P0.x, P0.y, 'fusee_sim'), 90, 130);
    this.holdMark = scene.add.container(0, 0).setVisible(false);
    const hm = scene.add.graphics();
    hm.lineStyle(7, C.orange, 1);
    hm.strokeCircle(0, 0, 90);
    hm.fillStyle(C.orange, 1);
    hm.fillRoundedRect(70, -100, 16, 46, 6);
    hm.fillRoundedRect(94, -100, 16, 46, 6);
    this.holdMark.add(hm);
    this.add([this.trail, this.flame, this.rocket, this.holdMark]);
    this.place(0);
    scene.add.existing(this);
  }

  private place(t: number): void {
    this.t = t;
    const p = bezier(t);
    const q = bezier(Math.min(1, t + 0.01));
    const back = bezier(Math.max(0, t - 0.01));
    const angle = Phaser.Math.RadToDeg(Math.atan2(q.y - back.y, q.x - back.x)) + 90;
    this.rocket.setPosition(p.x, p.y).setAngle(t === 0 ? 0 : angle);
    this.holdMark.setPosition(p.x, p.y);
    this.trail.clear();
    this.trail.lineStyle(8, C.mint, 1);
    this.trail.beginPath();
    this.trail.moveTo(P0.x, P0.y);
    for (let k = 1; k <= 40; k++) {
      const s = bezier((t * k) / 40);
      this.trail.lineTo(s.x, s.y);
    }
    this.trail.strokePath();
  }

  /** La fusée avance sur sa trajectoire jusqu'à `t` (0 : sur la Terre, 1 : autour de la Lune). */
  async flyTo(t: number, ms: number): Promise<void> {
    const from = this.t;
    const counter = { v: from };
    const onUpdate = () => {
      this.place(counter.v);
      const p = this.rocket;
      const a = Phaser.Math.DegToRad(p.angle + 90);
      this.flame.clear();
      this.flame.fillStyle(C.orange, 0.9);
      const fx = p.x + Math.cos(a) * 62;
      const fy = p.y + Math.sin(a) * 62;
      this.flame.fillCircle(fx, fy, 14 + Math.random() * 8);
      this.flame.fillStyle(C.mustard, 1);
      this.flame.fillCircle(fx, fy, 8);
    };
    await tweenAsync(this.scene, { targets: counter, v: t, duration: ms, ease: 'Sine.InOut', onUpdate });
    this.place(t);
    this.flame.clear();
  }

  /** Erreur : l'essai se met en attente au point concerné (cercle orange et signe pause). */
  hold(on: boolean): void {
    this.holdTween?.stop();
    this.holdTween = null;
    this.holdMark.setVisible(on).setAlpha(1);
    if (on) this.holdTween = this.scene.tweens.add({ targets: this.holdMark, alpha: 0.35, duration: 450, yoyo: true, repeat: -1 });
  }
}
