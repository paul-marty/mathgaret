import * as Phaser from 'phaser';
import { C, textStyle } from '../config';
import { makeValidate, type AnswerUI } from '../engine/answers';
import { RADIO_MAX, type Profile } from '../math/families';
import { services } from '../services';
import type { Button } from './Button';
import type { Focusable, Rect } from './focus';
import { fit } from './assets';
import { tweenAsync } from './tweens';
import { drawTensUnits } from './widgets';
import { pill } from './widgets-c2';

/**
 * Le grand test (C2.3) : chaque phase du vol a son objet, dessiné dans l'écran de simulation.
 * - le plein : deux réservoirs se vident dans la fusée (addition) ;
 * - la radio de Houston : un cadran à tourner jusqu'au bon canal (compléter) ;
 * - les étoiles repères : on les relie de la plus petite à la plus grande (ranger) ;
 * - le freinage : le moteur brûle une partie du carburant (retirer).
 */

const wait = (ms: number) => services.clock.wait(ms);
type Pt = { x: number; y: number };
type GO = Phaser.GameObjects.GameObject;
type Cell = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;

/** Unités du premier réservoir (carrés violets) et du deuxième (ronds bleus) : la couleur est doublée par la forme (P15). */
const VIOLET = 0x9b7fd1;
const TINT_A = 0xd9cdf2;
const TINT_B = 0xcfe5f1;
const WINDOW = 0x2a3348;

// ---------------------------------------------------------------------------
// Cases de carburant : colonnes de 5 (début, milieu) ou de 10 (fin), remplies de bas en haut.
// ---------------------------------------------------------------------------

interface Geom {
  per: number;
  size: number;
  gap: number;
  groupEvery: number;
  groupGap: number;
}

const GEOM: Record<Profile, Geom> = {
  debut: { per: 5, size: 52, gap: 8, groupEvery: 2, groupGap: 0 },
  milieu: { per: 5, size: 42, gap: 6, groupEvery: 2, groupGap: 14 },
  fin: { per: 10, size: 24, gap: 3, groupEvery: 5, groupGap: 10 },
};

/** Colonnes de la jauge de la fusée : 10, 20 ou 100 unités. */
const GAUGE_COLS: Record<Profile, number> = { debut: 2, milieu: 4, fin: 10 };

const colsFor = (n: number, g: Geom) => Math.max(1, Math.ceil(n / g.per));
const gridW = (cols: number, g: Geom) => cols * (g.size + g.gap) - g.gap + Math.floor((cols - 1) / g.groupEvery) * g.groupGap;
const gridH = (g: Geom) => g.per * (g.size + g.gap) - g.gap;

/** Centre de la case `k` d'une grille dont le coin bas-gauche est (left, bottom). */
function slotAt(k: number, g: Geom, left: number, bottom: number): Pt {
  const c = Math.floor(k / g.per);
  const r = k % g.per;
  return {
    x: left + c * (g.size + g.gap) + Math.floor(c / g.groupEvery) * g.groupGap + g.size / 2,
    y: bottom - r * (g.size + g.gap) - g.size / 2,
  };
}

function makeCell(scene: Phaser.Scene, p: Pt, size: number, round: boolean, color: number): Cell {
  const c = round ? scene.add.circle(p.x, p.y, size / 2 - 1, color) : scene.add.rectangle(p.x, p.y, size - 2, size - 2, color);
  c.setStrokeStyle(Math.max(2, Math.round(size * 0.08)), C.ink, 1);
  return c;
}

function slotOutlines(gfx: Phaser.GameObjects.Graphics, n: number, g: Geom, left: number, bottom: number): void {
  gfx.lineStyle(2, C.mint, 0.35);
  for (let k = 0; k < n; k++) {
    const p = slotAt(k, g, left, bottom);
    gfx.strokeRect(p.x - g.size / 2, p.y - g.size / 2, g.size, g.size);
  }
}

interface GaugeShape {
  gfx: Phaser.GameObjects.Graphics;
  left: number;
  bottom: number;
  /** Sommet de la pointe. */
  top: number;
  /** Demi-largeur du corps. */
  half: number;
  nozzle: Pt;
}

/** Fusée-jauge : un corps de fusée dont la fenêtre contient les colonnes de carburant. */
function drawRocketGauge(scene: Phaser.Scene, cx: number, cy: number, g: Geom, cols: number): GaugeShape {
  const w = gridW(cols, g);
  const h = gridH(g);
  const bx = cx - w / 2 - 30;
  const by = cy - h / 2 - 30;
  const bw = w + 60;
  const bh = h + 60;
  const noseH = Math.min(130, bw * 0.75);
  const gfx = scene.add.graphics();
  gfx.fillStyle(C.brick, 1);
  gfx.fillTriangle(bx + 6, by + bh - 120, bx - 60, by + bh + 34, bx + 6, by + bh);
  gfx.fillTriangle(bx + bw - 6, by + bh - 120, bx + bw + 60, by + bh + 34, bx + bw - 6, by + bh);
  gfx.fillStyle(0x5d6270, 1);
  gfx.fillPoints(
    [
      { x: cx - 40, y: by + bh - 4 },
      { x: cx + 40, y: by + bh - 4 },
      { x: cx + 62, y: by + bh + 44 },
      { x: cx - 62, y: by + bh + 44 },
    ],
    true,
  );
  gfx.fillStyle(0xe9edf2, 1);
  gfx.fillRoundedRect(bx, by, bw, bh, 34);
  gfx.lineStyle(6, C.ink, 1);
  gfx.strokeRoundedRect(bx, by, bw, bh, 34);
  gfx.fillStyle(C.brick, 1);
  gfx.fillTriangle(bx + 12, by + 4, bx + bw - 12, by + 4, cx, by - noseH);
  gfx.lineStyle(6, C.ink, 1);
  gfx.strokeTriangle(bx + 12, by + 4, bx + bw - 12, by + 4, cx, by - noseH);
  gfx.fillStyle(WINDOW, 1);
  gfx.fillRoundedRect(cx - w / 2 - 12, cy - h / 2 - 12, w + 24, h + 24, 14);
  const left = cx - w / 2;
  const bottom = cy + h / 2;
  slotOutlines(gfx, cols * g.per, g, left, bottom);
  return { gfx, left, bottom, top: by - noseH, half: bw / 2, nozzle: { x: cx, y: by + bh + 44 } };
}

/** Réservoir du plein : une cuve teintée, un bouchon, une fenêtre. */
function drawTank(scene: Phaser.Scene, cx: number, cy: number, g: Geom, cols: number, tint: number): { gfx: Phaser.GameObjects.Graphics; left: number; bottom: number } {
  const w = gridW(cols, g);
  const h = gridH(g);
  const gfx = scene.add.graphics();
  gfx.fillStyle(0x8a93a6, 1);
  gfx.fillRect(cx - 26, cy - h / 2 - 46, 52, 26);
  gfx.lineStyle(4, C.ink, 1);
  gfx.strokeRect(cx - 26, cy - h / 2 - 46, 52, 26);
  gfx.fillStyle(tint, 1);
  gfx.fillRoundedRect(cx - w / 2 - 22, cy - h / 2 - 22, w + 44, h + 44, 26);
  gfx.lineStyle(5, C.ink, 1);
  gfx.strokeRoundedRect(cx - w / 2 - 22, cy - h / 2 - 22, w + 44, h + 44, 26);
  gfx.fillStyle(WINDOW, 1);
  gfx.fillRoundedRect(cx - w / 2 - 10, cy - h / 2 - 10, w + 20, h + 20, 12);
  const left = cx - w / 2;
  const bottom = cy + h / 2;
  slotOutlines(gfx, cols * g.per, g, left, bottom);
  return { gfx, left, bottom };
}

/**
 * Repère de comptage : le nombre est écrit dans la case (cases assez grandes) ; sinon la case est entourée
 * et le compte s'écrit à la place de la réponse.
 */
function countMark(scene: Phaser.Scene, p: Pt, size: number, v: number, color: number): GO[] {
  if (size >= 40) {
    return [
      scene.add.circle(p.x, p.y, size * 0.42, color),
      scene.add.text(p.x, p.y + 1, String(v), textStyle(Math.round(size * 0.45), { color: '#3a2a20' })).setOrigin(0.5),
    ];
  }
  return [ring(scene, p, size, color)];
}

function ring(scene: Phaser.Scene, p: Pt, size: number, color: number = C.orange): Phaser.GameObjects.Graphics {
  const r = scene.add.graphics();
  r.lineStyle(Math.max(4, size * 0.14), color, 1);
  r.strokeCircle(p.x, p.y, size * 0.62);
  return r;
}

/** Contour des colonnes d'une collection (les colonnes pleines en jaune : des groupes de 5 ou des dizaines). */
function outlineColumns(scene: Phaser.Scene, cells: Pt[], g: Geom): Phaser.GameObjects.Graphics {
  const out = scene.add.graphics();
  for (let c = 0; c * g.per < cells.length; c++) {
    const col = cells.slice(c * g.per, (c + 1) * g.per);
    const top = col[col.length - 1];
    const bot = col[0];
    const full = col.length === g.per;
    out.lineStyle(Math.max(4, g.size * 0.14), full ? C.mustard : C.white, 1);
    out.strokeRoundedRect(bot.x - g.size / 2 - 5, top.y - g.size / 2 - 5, g.size + 10, bot.y - top.y + g.size + 10, 8);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Le plein (addition) : deux réservoirs se vident dans la fusée.
// ---------------------------------------------------------------------------

export class FuelBoard extends Phaser.GameObjects.Container {
  private g: Geom;
  private cells: Cell[] = [];
  private homes: Pt[] = [];
  private gauge: GaugeShape;
  private marks: GO[] = [];
  private result: Phaser.GameObjects.Container;
  private pillA: Phaser.GameObjects.Container;
  private resultPos: Pt;
  private inGauge = 0;
  private cap: number;
  private counter: Phaser.GameObjects.Container | null = null;
  private resultShown = true;

  constructor(
    scene: Phaser.Scene,
    profile: Profile,
    readonly a: number,
    readonly b: number,
  ) {
    super(scene, 0, 0);
    const g = (this.g = GEOM[profile]);
    const colsA = colsFor(a, g);
    const colsB = colsFor(b, g);
    const colsR = GAUGE_COLS[profile];
    this.cap = colsR * g.per;
    const wA = gridW(colsA, g) + 44;
    const wB = gridW(colsB, g) + 44;
    const wR = gridW(colsR, g) + 60 + 120;
    const gapPlus = 110;
    const gapArrow = 150;
    let x = 1040 - (wA + gapPlus + wB + gapArrow + wR) / 2;
    const xA = x + wA / 2;
    x += wA + gapPlus;
    const xB = x + wB / 2;
    x += wB + gapArrow;
    const xR = x + wR / 2;
    const cy = 560;
    const h = gridH(g);

    // Tuyaux (derrière) : des réservoirs vers la fusée.
    const pipes = scene.add.graphics();
    const yp = cy + h / 2 + 62;
    pipes.lineStyle(14, 0x5d6270, 1);
    pipes.lineBetween(xA, cy + h / 2 + 20, xA, yp);
    pipes.lineBetween(xB, cy + h / 2 + 20, xB, yp);
    pipes.lineBetween(xA - 7, yp, xR - gridW(colsR, g) / 2, yp);
    pipes.lineBetween(xR - gridW(colsR, g) / 2, yp + 7, xR - gridW(colsR, g) / 2, cy + h / 2 + 20);
    this.add(pipes);

    const tankA = drawTank(scene, xA, cy, g, colsA, TINT_A);
    const tankB = drawTank(scene, xB, cy, g, colsB, TINT_B);
    this.gauge = drawRocketGauge(scene, xR, cy, g, colsR);
    this.add([tankA.gfx, tankB.gfx, this.gauge.gfx]);
    this.add(scene.add.text((xA + wA / 2 + xB - wB / 2) / 2, cy, '+', textStyle(110, { color: '#f6ecd9' })).setOrigin(0.5));
    const arrow = scene.add.graphics();
    const ax = xB + wB / 2 + gapArrow / 2 - 10;
    arrow.fillStyle(C.cream, 1);
    arrow.fillRect(ax - 50, cy - 12, 60, 24);
    arrow.fillTriangle(ax + 10, cy - 34, ax + 10, cy + 34, ax + 52, cy);
    this.add(arrow);

    for (let k = 0; k < a; k++) this.homes.push(slotAt(k, g, tankA.left, tankA.bottom));
    for (let k = 0; k < b; k++) this.homes.push(slotAt(k, g, tankB.left, tankB.bottom));
    this.cells = this.homes.map((p, i) => makeCell(scene, p, g.size, i >= a, i < a ? VIOLET : C.sky));
    this.add(this.cells);

    this.pillA = pill(scene, xA, cy - h / 2 - 96, String(a), TINT_A);
    const pillB = pill(scene, xB, cy - h / 2 - 96, String(b), TINT_B);
    this.resultPos = { x: xR, y: this.gauge.top - 44 };
    this.result = pill(scene, this.resultPos.x, this.resultPos.y, '?');
    this.add([this.pillA, pillB, this.result]);
    scene.add.existing(this);
  }

  get total(): number {
    return this.a + this.b;
  }

  private gaugeSlot(k: number): Pt {
    return slotAt(k, this.g, this.gauge.left, this.gauge.bottom);
  }

  /**
   * Effet de la réponse : `n` unités passent dans la fusée (le premier réservoir, puis le deuxième).
   * Trop peu : des unités restent dans les réservoirs. Trop : des places de la fusée restent vides.
   */
  async pour(n: number): Promise<{ missing: number; extra: number }> {
    const m = Math.min(n, this.cells.length);
    const fast = this.cells.length > 20;
    const moves: Promise<void>[] = [];
    for (let k = this.inGauge; k < m; k++) {
      const c = this.cells[k];
      const to = this.gaugeSlot(k);
      this.scene.tweens.killTweensOf(c);
      if (fast) {
        const rank = k;
        moves.push(
          tweenAsync(this.scene, {
            targets: c,
            x: to.x,
            y: to.y,
            duration: 300,
            delay: (k - this.inGauge) * 30,
            ease: 'Cubic.InOut',
            onStart: () => {
              if (rank % 10 === 9) services.sfx.pop(Math.floor(rank / 10) + 2);
            },
          }),
        );
      } else {
        await tweenAsync(this.scene, { targets: c, x: to.x, y: to.y, duration: 210, ease: 'Cubic.InOut' });
        services.sfx.pop(k);
      }
    }
    await Promise.all(moves);
    this.inGauge = m;
    const missing = Math.max(0, this.total - n);
    const extra = Math.max(0, n - this.total);
    for (let k = m; k < this.cells.length; k++) this.mark(ring(this.scene, this.homes[k], this.g.size));
    if (extra > 0) {
      const ghost = this.scene.add.graphics();
      for (let k = this.total; k < Math.min(n, this.cap); k++) {
        const p = this.gaugeSlot(k);
        ghost.fillStyle(C.orange, 0.35);
        ghost.fillRect(p.x - this.g.size / 2, p.y - this.g.size / 2, this.g.size, this.g.size);
        ghost.lineStyle(4, C.orange, 1);
        ghost.strokeRect(p.x - this.g.size / 2, p.y - this.g.size / 2, this.g.size, this.g.size);
      }
      this.mark(ghost);
    }
    return { missing, extra };
  }

  private mark(o: GO): void {
    this.add(o);
    this.marks.push(o);
  }

  clearMarks(): void {
    for (const m of this.marks) m.destroy();
    this.marks = [];
    this.counter = null;
    this.result.setVisible(this.resultShown);
  }

  /** Après une erreur : les unités retournent dans leurs réservoirs, les données restent. */
  resetMarks(): void {
    this.clearMarks();
    for (let k = 0; k < this.inGauge; k++) {
      const c = this.cells[k];
      this.scene.tweens.killTweensOf(c);
      this.scene.tweens.add({ targets: c, x: this.homes[k].x, y: this.homes[k].y, duration: 350, ease: 'Cubic.InOut' });
    }
    this.inGauge = 0;
  }

  /** Aide « matérialiser » : les colonnes des deux réservoirs (groupes de cinq, ou dizaines) sont entourées. */
  showGroups(): void {
    this.mark(outlineColumns(this.scene, this.homes.slice(0, this.a), this.g));
    this.mark(outlineColumns(this.scene, this.homes.slice(this.a), this.g));
  }

  /** Aide « compter » : on part du premier nombre et on continue avec le deuxième réservoir (par dizaines s'il y en a). */
  async countOn(): Promise<void> {
    this.scene.tweens.add({ targets: this.pillA, scale: 1.25, duration: 220, yoyo: true });
    if (this.g.size < 40) this.showCount(this.a);
    await services.voice.sayNumber(this.a);
    await wait(300);
    const byTens = this.g.per === 10 && this.b >= 10;
    let v = this.a;
    for (let k = 0; k < this.b; k++) {
      v++;
      const endOfColumn = (k + 1) % this.g.per === 0;
      if (byTens && !endOfColumn && k !== this.b - 1) continue;
      for (const o of countMark(this.scene, this.homes[this.a + k], this.g.size, v, C.mustard)) this.mark(o);
      if (this.g.size < 40) this.showCount(v);
      await services.voice.sayNumber(v);
      await wait(byTens ? 350 : 160);
    }
  }

  /** Le compte en cours s'écrit à la place de la réponse. */
  private showCount(v: number): void {
    this.result.setVisible(false);
    this.counter?.destroy();
    this.counter = pill(this.scene, this.resultPos.x, this.resultPos.y, String(v), C.mustard);
    this.mark(this.counter);
  }

  /** Bonne réponse : tout le carburant passe dans la fusée, le total s'affiche. */
  async fill(): Promise<void> {
    this.clearMarks();
    await this.pour(this.total);
    this.result.destroy();
    this.result = pill(this.scene, this.resultPos.x, this.resultPos.y, String(this.total), C.green);
    this.add(this.result);
    await tweenAsync(this.scene, { targets: this.result, scale: { from: 0.4, to: 1 }, duration: 300, ease: 'Back.Out' });
  }
}

// ---------------------------------------------------------------------------
// Le freinage (retirer) : le moteur brûle une partie du carburant.
// ---------------------------------------------------------------------------

export class BrakeGauge extends Phaser.GameObjects.Container {
  private g: Geom;
  private cells: Cell[] = [];
  private gauge: GaugeShape;
  private cap: number;
  private marks: GO[] = [];
  private result: Phaser.GameObjects.Container;
  private resultPos: Pt;
  private info: GO[] = [];
  private infoX: number;
  private counter: Phaser.GameObjects.Container | null = null;
  private resultShown = false;

  constructor(
    scene: Phaser.Scene,
    profile: Profile,
    readonly total: number,
    readonly minus: number,
  ) {
    super(scene, 0, 0);
    const g = (this.g = GEOM[profile]);
    const cols = GAUGE_COLS[profile];
    this.cap = cols * g.per;
    const cx = 860;
    const cy = 560;
    this.gauge = drawRocketGauge(scene, cx, cy, g, cols);
    this.add(this.gauge.gfx);
    for (let k = 0; k < total; k++) this.cells.push(makeCell(scene, this.slot(k), g.size, false, C.mustard));
    this.add(this.cells);
    this.add(pill(scene, cx, this.gauge.top - 44, String(total)));
    this.infoX = cx + this.gauge.half + 120;
    this.resultPos = { x: this.infoX + 110, y: cy + 90 };
    this.result = pill(scene, this.resultPos.x, this.resultPos.y, '?');
    this.result.setVisible(false);
    this.add(this.result);
    scene.add.existing(this);
  }

  get rest(): number {
    return this.total - this.minus;
  }

  private slot(k: number): Pt {
    return slotAt(k, this.g, this.gauge.left, this.gauge.bottom);
  }

  /** Le moteur brûle `minus` unités : le niveau baisse, leurs places restent visibles, vides. */
  async burn(): Promise<void> {
    services.sfx.rumble(1.6);
    const fast = this.minus > 12;
    const hollow = this.scene.add.graphics();
    this.add(hollow);
    const moves: Promise<void>[] = [];
    for (let i = 0; i < this.minus; i++) {
      const k = this.total - 1 - i;
      const c = this.cells[k];
      const p = this.slot(k);
      hollow.lineStyle(3, C.cream, 0.7);
      hollow.strokeRect(p.x - this.g.size / 2 + 3, p.y - this.g.size / 2 + 3, this.g.size - 6, this.g.size - 6);
      c.setFillStyle(C.orange);
      const move = tweenAsync(this.scene, {
        targets: c,
        x: this.gauge.nozzle.x + (Math.random() - 0.5) * 40,
        y: this.gauge.nozzle.y + 40,
        scale: 0.3,
        alpha: 0,
        duration: 420,
        delay: fast ? i * 35 : 0,
        ease: 'Cubic.In',
      });
      if (fast) moves.push(move);
      else {
        await move;
        services.sfx.pop(Math.max(0, 8 - i));
      }
    }
    await Promise.all(moves);
    // Ce que le moteur a brûlé reste écrit à côté de la fusée.
    const flame = this.scene.add.graphics();
    const fx = this.infoX;
    const fy = 560 - 60;
    flame.fillStyle(C.orange, 1);
    flame.fillTriangle(fx - 30, fy + 10, fx + 30, fy + 10, fx, fy - 60);
    flame.fillCircle(fx, fy + 14, 30);
    flame.fillStyle(C.mustard, 1);
    flame.fillCircle(fx, fy + 18, 16);
    const used = pill(this.scene, fx + 110, fy, `− ${this.minus}`, C.cream);
    const fuel = makeCell(this.scene, { x: fx, y: this.resultPos.y }, 46, false, C.mustard);
    this.info.push(flame, used, fuel);
    this.add([flame, used, fuel]);
    this.bringToTop(this.result);
    this.resultShown = true;
    this.result.setVisible(true);
  }

  private mark(o: GO): void {
    this.add(o);
    this.marks.push(o);
  }

  /** Effet de la réponse : les unités comptées sont repérées ; celles oubliées, ou les places vides comptées en trop, en orange. */
  async countAnswer(a: number): Promise<{ missing: number; extra: number }> {
    const r = this.rest;
    const missing = Math.max(0, r - a);
    const extra = Math.max(0, a - r);
    for (let k = 0; k < Math.min(a, r); k++) {
      const c = this.cells[k];
      this.scene.tweens.add({ targets: c, scale: 1.18, duration: 120, yoyo: true, delay: Math.min(k, 30) * 25 });
    }
    await wait(Math.min(a, 30) * 25 + 250);
    for (let k = a; k < r; k++) this.mark(ring(this.scene, this.slot(k), this.g.size));
    if (extra > 0) {
      const ghost = this.scene.add.graphics();
      for (let k = r; k < Math.min(a, this.cap); k++) {
        const p = this.slot(k);
        ghost.fillStyle(C.orange, 0.4);
        ghost.fillRect(p.x - this.g.size / 2, p.y - this.g.size / 2, this.g.size, this.g.size);
      }
      this.mark(ghost);
    }
    return { missing, extra };
  }

  clearMarks(): void {
    for (const m of this.marks) m.destroy();
    this.marks = [];
    this.counter = null;
    this.result.setVisible(this.resultShown);
  }

  /** Aide « matérialiser » : les unités qui restent sont entourées, par colonnes. */
  showRest(): void {
    this.mark(outlineColumns(this.scene, this.cells.slice(0, this.rest).map((c) => ({ x: c.x, y: c.y })), this.g));
  }

  /** Aide « compter » : les unités qui restent sont comptées (par dizaines en fin de CP). */
  async countRest(): Promise<void> {
    this.showRest();
    const byTens = this.g.per === 10 && this.rest > 12;
    for (let k = 0; k < this.rest; k++) {
      const v = k + 1;
      if (byTens && v % 10 !== 0 && v !== this.rest) continue;
      for (const o of countMark(this.scene, this.slot(k), this.g.size, v, C.white)) this.mark(o);
      if (this.g.size < 40) this.showCount(v);
      await services.voice.sayNumber(v);
      await wait(byTens ? 350 : 160);
    }
  }

  /** Le compte en cours s'écrit à la place de la réponse. */
  private showCount(v: number): void {
    this.result.setVisible(false);
    this.counter?.destroy();
    this.counter = pill(this.scene, this.resultPos.x, this.resultPos.y, String(v), C.mustard);
    this.mark(this.counter);
  }

  /** Bonne réponse : ce qui reste brille, le nombre s'affiche. */
  async settle(): Promise<void> {
    this.clearMarks();
    const rest = this.cells.slice(0, this.rest);
    this.scene.tweens.add({ targets: rest, scale: 1.2, duration: 200, yoyo: true });
    this.result.destroy();
    this.result = pill(this.scene, this.resultPos.x, this.resultPos.y, String(this.rest), C.green);
    this.add(this.result);
    await tweenAsync(this.scene, { targets: this.result, scale: { from: 0.4, to: 1 }, duration: 300, ease: 'Back.Out' });
  }
}

// ---------------------------------------------------------------------------
// La radio de Houston (compléter) : tourner le bouton, cran par cran, jusqu'au canal de Houston.
// ---------------------------------------------------------------------------

export class RadioDial extends Phaser.GameObjects.Container {
  readonly max: number;
  private cx = 1250;
  private cy = 574;
  private R = 196;
  private needle: Phaser.GameObjects.Graphics;
  private valuePill: Phaser.GameObjects.Container | null = null;
  private houston: Phaser.GameObjects.Container;
  private waves: Phaser.GameObjects.Graphics;
  private noise: Phaser.GameObjects.Graphics;
  private marks: GO[] = [];
  private at: number;

  constructor(
    scene: Phaser.Scene,
    profile: Profile,
    readonly deja: number,
    readonly total: number,
  ) {
    super(scene, 0, 0);
    this.max = RADIO_MAX[profile];
    this.at = deja;
    const { cx, cy, R } = this;

    // Le poste de radio : coffret de bois, antenne, haut-parleur.
    const box = scene.add.graphics();
    box.lineStyle(8, 0x5d6270, 1);
    box.lineBetween(690, 254, 630, 150);
    box.fillStyle(C.brick, 1);
    box.fillCircle(630, 150, 13);
    box.fillStyle(0x8a6346, 1);
    box.fillRoundedRect(560, 250, 960, 580, 48);
    box.lineStyle(7, C.ink, 1);
    box.strokeRoundedRect(560, 250, 960, 580, 48);
    box.fillStyle(C.cream, 1);
    box.fillRoundedRect(590, 280, 900, 520, 34);
    const sx = 800;
    const sy = 570;
    box.fillStyle(0x6b4a33, 1);
    box.fillCircle(sx, sy, 150);
    box.lineStyle(5, C.ink, 1);
    box.strokeCircle(sx, sy, 150);
    box.lineStyle(6, C.cream, 0.45);
    for (let y = -120; y <= 120; y += 24) {
      const half = Math.sqrt(150 * 150 - y * y) * 0.82;
      box.lineBetween(sx - half, sy + y, sx + half, sy + y);
    }
    this.add(box);
    this.noise = scene.add.graphics();
    this.waves = scene.add.graphics().setVisible(false);
    this.waves.lineStyle(10, C.green, 1);
    for (let k = 0; k < 3; k++) {
      this.waves.beginPath();
      this.waves.arc(sx, sy, 172 + k * 34, Phaser.Math.DegToRad(-150), Phaser.Math.DegToRad(-110));
      this.waves.strokePath();
    }
    this.add([this.noise, this.waves]);

    // Le cadran : graduations, nombres.
    const dial = scene.add.graphics();
    dial.fillStyle(0xfaf3e4, 1);
    dial.fillCircle(cx, cy, R);
    dial.lineStyle(6, C.ink, 1);
    dial.strokeCircle(cx, cy, R);
    this.add(dial);
    const labelEvery = this.max <= 20 ? 1 : 10;
    const labels: Phaser.GameObjects.Text[] = [];
    const font = this.max <= 10 ? 34 : this.max <= 20 ? 24 : 30;
    for (let v = 0; v <= this.max; v++) {
      const long = this.max <= 10 || v % (this.max <= 20 ? 5 : 10) === 0;
      const mid = !long && this.max > 20 && v % 5 === 0;
      const a = this.ang(v);
      const r0 = R - (long ? 34 : mid ? 26 : 18);
      dial.lineStyle(long ? 5 : 3, C.ink, 1);
      dial.lineBetween(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
      if (v % labelEvery === 0) {
        const p = this.pt(v, R - (this.max <= 10 ? 62 : 56));
        labels.push(scene.add.text(p.x, p.y, String(v), textStyle(font, { color: '#3a2a20' })).setOrigin(0.5));
      }
    }

    // Le canal de Houston : un repère vert et son nombre, hors du cadran.
    this.houston = scene.add.container(0, 0);
    const hp = this.pt(total, R + 14);
    const a = this.ang(total);
    const hm = scene.add.graphics();
    hm.fillStyle(C.green, 1);
    const tip = this.pt(total, R - 4);
    const side = (d: number) => ({ x: hp.x + Math.cos(a + Math.PI / 2) * d + Math.cos(a) * 26, y: hp.y + Math.sin(a + Math.PI / 2) * d + Math.sin(a) * 26 });
    hm.fillTriangle(tip.x, tip.y, side(16).x, side(16).y, side(-16).x, side(-16).y);
    hm.lineStyle(3, C.ink, 1);
    hm.strokeTriangle(tip.x, tip.y, side(16).x, side(16).y, side(-16).x, side(-16).y);
    const lp = this.pt(total, R + 70);
    this.houston.add([hm, pill(scene, lp.x, lp.y, String(total), C.mint)]);
    this.add(this.houston);

    // L'aiguille et le gros bouton (ils tournent ensemble).
    this.needle = scene.add.graphics({ x: cx, y: cy });
    this.needle.fillStyle(C.brick, 1);
    this.needle.fillRect(-20, -6, R - 40, 12);
    this.needle.fillTriangle(R - 46, -16, R - 46, 16, R - 14, 0);
    this.needle.fillStyle(0x3a4256, 1);
    this.needle.fillCircle(0, 0, 50);
    this.needle.lineStyle(4, C.ink, 1);
    this.needle.strokeCircle(0, 0, 50);
    this.needle.lineStyle(5, 0x8a93a6, 1);
    for (let k = 0; k < 8; k++) {
      const t = (k * Math.PI) / 4;
      this.needle.lineBetween(Math.cos(t) * 26, Math.sin(t) * 26, Math.cos(t) * 44, Math.sin(t) * 44);
    }
    this.add(this.needle);
    // Les nombres du cadran restent lisibles quand l'aiguille passe dessus.
    this.add(labels);
    this.setValue(deja);
    this.drawNoise(true);
    scene.add.existing(this);
  }

  private ang(v: number): number {
    return Phaser.Math.DegToRad(135 + (270 * v) / this.max);
  }

  private pt(v: number, r: number): Pt {
    const a = this.ang(v);
    return { x: this.cx + Math.cos(a) * r, y: this.cy + Math.sin(a) * r };
  }

  private setValue(v: number): void {
    this.needle.setRotation(this.ang(v));
    this.valuePill?.destroy();
    const p = this.pt(v, this.R + 70);
    this.valuePill = pill(this.scene, p.x, p.y, String(Math.round(v)));
    this.add(this.valuePill);
  }

  /** Grésillement dessiné devant le haut-parleur (radio mal réglée). */
  private drawNoise(on: boolean): void {
    const g = this.noise;
    g.clear();
    if (!on) return;
    g.lineStyle(5, C.grey, 0.9);
    for (let k = 0; k < 3; k++) {
      const y0 = 350 + k * 28;
      g.beginPath();
      g.moveTo(660, y0);
      for (let i = 1; i <= 8; i++) g.lineTo(660 + i * 14, y0 + (i % 2 ? -10 : 10));
      g.strokePath();
    }
  }

  /** Effet de la réponse : l'aiguille tourne de `n` crans, un par un. */
  async turn(n: number, to: number): Promise<{ stop: number; missing: number; extra: number }> {
    const from = this.at;
    const stop = Math.min(this.max, from + n);
    const step = n > 12 ? 45 : 120;
    for (let v = from + 1; v <= stop; v++) {
      const c = { v: v - 1 };
      await tweenAsync(this.scene, { targets: c, v, duration: step, ease: 'Sine.Out', onUpdate: () => this.needle.setRotation(this.ang(c.v)) });
      this.setValue(v);
      services.sfx.notch();
    }
    this.at = stop;
    const missing = Math.max(0, to - stop);
    const extra = Math.max(0, from + n - to);
    if (extra > 0) this.arc(to, Math.min(this.max, from + n), C.orange, 0.9);
    if (stop !== to) services.sfx.crackle(0.9);
    return { stop, missing, extra };
  }

  private arc(from: number, to: number, color: number, alpha: number): void {
    const g = this.scene.add.graphics();
    g.lineStyle(16, color, alpha);
    g.beginPath();
    g.arc(this.cx, this.cy, this.R - 18, this.ang(from), this.ang(to), false);
    g.strokePath();
    this.addAt(g, this.getIndex(this.needle));
    this.marks.push(g);
  }

  /** Aide « matérialiser » : le chemin de l'aiguille jusqu'à Houston est éclairé. */
  showPath(): void {
    this.arc(this.deja, this.total, C.mustard, 0.55);
  }

  /** Aide « compter » : les crans sont comptés un à un (le compte s'affiche au centre du bouton). */
  async countPath(): Promise<void> {
    this.showPath();
    const span = this.total - this.deja;
    const counter = this.scene.add.text(this.cx, this.cy + 2, '', textStyle(40, { color: '#ffffff' })).setOrigin(0.5);
    this.add(counter);
    this.marks.push(counter);
    const dots = this.scene.add.graphics();
    this.addAt(dots, this.getIndex(this.needle));
    this.marks.push(dots);
    for (let k = 1; k <= span; k++) {
      const p = this.pt(this.deja + k, this.R - 18);
      dots.fillStyle(C.orange, 1);
      dots.fillCircle(p.x, p.y, this.max > 20 ? 6 : 10);
      counter.setText(String(k));
      services.sfx.notch();
      if (span <= 12 || k % 10 === 0 || k === span) {
        await services.voice.sayNumber(k);
        await wait(140);
      } else await wait(90);
    }
  }

  clearMarks(): void {
    for (const m of this.marks) m.destroy();
    this.marks = [];
  }

  /** Après une erreur : l'aiguille revient sur le canal de départ. */
  reset(): void {
    this.clearMarks();
    this.at = this.deja;
    this.setValue(this.deja);
  }

  /** Bonne réponse : la radio est réglée, le haut-parleur émet clairement. */
  async tuned(): Promise<void> {
    this.drawNoise(false);
    this.waves.setVisible(true).setAlpha(0);
    services.sfx.beeps(2);
    this.scene.tweens.add({ targets: this.waves, alpha: 1, duration: 300, yoyo: true, repeat: 2 });
    await tweenAsync(this.scene, { targets: this.houston, scale: 1, duration: 600 });
    this.waves.setAlpha(1);
  }
}

// ---------------------------------------------------------------------------
// Les étoiles repères (ranger) : relier les étoiles de la plus petite à la plus grande.
// ---------------------------------------------------------------------------

/** Sous la trajectoire du vol, pour ne pas cacher la fusée. */
export const STAR_POS: Pt[] = [
  { x: 800, y: 470 },
  { x: 1090, y: 680 },
  { x: 1380, y: 470 },
];
export const STAR_START: Pt = { x: 580, y: 700 };

export class StarOption extends Phaser.GameObjects.Container implements Focusable {
  selected = false;
  label?: string;
  readonly reps: Phaser.GameObjects.Graphics;
  private halo: Phaser.GameObjects.Graphics;
  private shape: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly value: number,
    private onPress: () => void,
  ) {
    super(scene, x, y);
    this.halo = scene.add.graphics().setVisible(false);
    this.halo.lineStyle(10, C.mint, 1);
    this.halo.strokeCircle(0, 0, 128);
    this.shape = scene.add.graphics();
    this.drawStar(C.mustard);
    const t = scene.add.text(0, 10, String(value), textStyle(value >= 10 ? 54 : 64, { color: '#3a2a20' })).setOrigin(0.5);
    // Sous l'étoile, sa quantité en dizaines et unités (aide visuelle, P5).
    this.reps = drawTensUnits(scene, value, 200).setPosition(0, 168).setScale(0.62);
    this.add([this.halo, this.shape, t, this.reps]);
    this.setSize(240, 240);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      services.input.noteInteraction({ source: 'pointer', trusted: true });
      services.focus.press(this);
    });
    scene.add.existing(this);
  }

  drawStar(color: number): void {
    const pts: Pt[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 50 : 112;
      const a = Phaser.Math.DegToRad(-90 + i * 36);
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    this.shape.clear();
    this.shape.fillStyle(color, 1);
    this.shape.fillPoints(pts, true);
    this.shape.lineStyle(6, C.ink, 1);
    this.shape.strokePoints(pts, true);
  }

  setSelected(on: boolean): void {
    this.selected = on;
    this.halo.setVisible(on);
  }

  bounds(): Rect {
    return { x: this.x - 120, y: this.y - 120, width: 240, height: 240 };
  }

  isEnabled(): boolean {
    return this.visible;
  }

  activate(): void {
    this.onPress();
  }
}

/**
 * Relier les étoiles : toucher une étoile la relie au chemin ; toucher une étoile déjà reliée
 * la retire du chemin, avec celles qui la suivent (correction libre, P3).
 */
export class StarPathAnswer implements AnswerUI<number[]> {
  validateButton: Button;
  private path: number[] = [];
  private lines: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private stars: StarOption[],
    private start: Pt,
    depth: number,
    onValidate: () => void,
  ) {
    this.lines = scene.add.graphics().setDepth(depth - 1);
    this.validateButton = makeValidate(scene, 1400, onValidate);
  }

  toggle(i: number): void {
    const at = this.path.indexOf(i);
    if (at >= 0) this.path = this.path.slice(0, at);
    else if (this.path.length < this.stars.length) this.path.push(i);
    services.sfx.select();
    this.redraw();
  }

  private redraw(): void {
    const g = this.lines;
    g.clear();
    let from = this.start;
    for (const i of this.path) {
      const to = { x: this.stars[i].x, y: this.stars[i].y };
      g.lineStyle(10, C.mint, 1);
      const d = Phaser.Math.Distance.BetweenPoints(from, to);
      // Pointillés
      for (let s = 0; s < d; s += 34) {
        const t0 = s / d;
        const t1 = Math.min(1, (s + 20) / d);
        g.lineBetween(from.x + (to.x - from.x) * t0, from.y + (to.y - from.y) * t0, from.x + (to.x - from.x) * t1, from.y + (to.y - from.y) * t1);
      }
      from = to;
    }
    this.stars.forEach((s, i) => s.setSelected(this.path.includes(i)));
  }

  /** Les points du chemin choisi (départ compris). */
  points(): Pt[] {
    return [this.start, ...this.path.map((i) => ({ x: this.stars[i].x, y: this.stars[i].y }))];
  }

  chosen(): number[] {
    return [...this.path];
  }

  value(): number[] | null {
    return this.path.length === this.stars.length ? this.path.map((i) => this.stars[i].value) : null;
  }

  set(v: number[]): void {
    this.path = v.map((value) => this.stars.findIndex((s) => s.value === value)).filter((i) => i >= 0);
    this.redraw();
  }

  reset(): void {
    this.path = [];
    this.redraw();
  }

  focusables(): Focusable[] {
    return [...this.stars, this.validateButton];
  }

  first(): Focusable {
    return this.stars[0];
  }

  destroy(): void {
    this.validateButton.destroy();
    this.lines.destroy();
  }
}

/** Petite fusée qui suit le chemin des étoiles. */
export function pathRocket(scene: Phaser.Scene, at: Pt, depth: number): Phaser.GameObjects.Image {
  return fit(scene.add.image(at.x, at.y, 'fusee_sim'), 70, 100).setAngle(90).setDepth(depth);
}
