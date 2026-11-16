import * as Phaser from 'phaser';
import { C, textStyle } from '../config';
import { makeValidate, Option, type AnswerUI } from '../engine/answers';
import type { ControlKind, Profile, TaskKind } from '../math/families';
import { services } from '../services';
import { Button } from './Button';
import type { Focusable } from './focus';
import { drawIcon } from './icons';
import { tweenAsync } from './tweens';
import { drawCheck } from './widgets-c2';
import { drawUnit } from './widgets-c3';

/**
 * Chapitre 4.
 * - C4.1, la Lune approche : la vue de descente, la jauge d'énergie de la simulation et son repère de prévision,
 *   la carte du prochain contrôle et les voyants du tableau.
 * - C4.2, l'alarme 1202 : l'affichage de l'ordinateur et les fenêtres d'alerte.
 * - C4.3, sauver les tâches essentielles : le plateau de travail de l'ordinateur, les tâches (pictogrammes),
 *   la zone d'attente et le compteur à rouleaux.
 */

const wait = (ms: number) => services.clock.wait(ms);
type G = Phaser.GameObjects.Graphics;
type Img = Phaser.GameObjects.Image;
type Pt = { x: number; y: number };

const STEEL = 0x5b6577;
const STEEL_DARK = 0x3d4452;
const SOCKET = 0x262c38;
const ENERGY = C.mustard;

// ---------------------------------------------------------------------------
// Pictogrammes
// ---------------------------------------------------------------------------

/** Pictogramme d'un contrôle de la descente, centré en (0, 0) dans un carré de côté `s`. */
export function drawControl(g: G, kind: ControlKind, s: number): void {
  const u = s / 100;
  const lw = 6 * u;
  switch (kind) {
    case 'radar': {
      // Antenne parabolique tournée vers le sol, avec ses ondes.
      g.fillStyle(C.cream, 1);
      g.lineStyle(lw, C.ink, 1);
      g.beginPath();
      g.arc(-6 * u, -6 * u, 34 * u, Phaser.Math.DegToRad(-20), Phaser.Math.DegToRad(160), false);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.lineBetween(-6 * u, -6 * u, 14 * u, 40 * u);
      g.fillStyle(C.ink, 1);
      g.fillRect(-4 * u, 36 * u, 36 * u, 8 * u);
      g.lineStyle(lw * 0.8, C.mint, 1);
      for (const r of [16, 28]) {
        g.beginPath();
        g.arc(-6 * u, -6 * u, (34 + r) * u, Phaser.Math.DegToRad(-140), Phaser.Math.DegToRad(-80), false);
        g.strokePath();
      }
      break;
    }
    case 'moteur': {
      // Tuyère et flamme du moteur de descente.
      g.fillStyle(STEEL, 1);
      g.lineStyle(lw, C.ink, 1);
      const nozzle = [
        { x: -14 * u, y: -40 * u },
        { x: 14 * u, y: -40 * u },
        { x: 30 * u, y: 4 * u },
        { x: -30 * u, y: 4 * u },
      ];
      g.fillPoints(nozzle, true);
      g.strokePoints(nozzle, true);
      g.fillStyle(C.orange, 1);
      g.fillTriangle(-26 * u, 8 * u, 26 * u, 8 * u, 0, 46 * u);
      g.fillStyle(ENERGY, 1);
      g.fillTriangle(-13 * u, 8 * u, 13 * u, 8 * u, 0, 32 * u);
      break;
    }
    case 'antenne': {
      // Mât et ondes radio vers la Terre.
      g.lineStyle(lw, C.ink, 1);
      g.lineBetween(0, 40 * u, 0, -14 * u);
      g.lineBetween(-20 * u, 40 * u, 20 * u, 40 * u);
      g.fillStyle(C.brick, 1);
      g.fillCircle(0, -20 * u, 10 * u);
      g.strokeCircle(0, -20 * u, 10 * u);
      g.lineStyle(lw * 0.8, C.mint, 1);
      for (const r of [22, 36]) {
        g.beginPath();
        g.arc(0, -20 * u, r * u, Phaser.Math.DegToRad(-150), Phaser.Math.DegToRad(-30), false);
        g.strokePath();
      }
      break;
    }
    case 'cap': {
      // Boussole : l'aiguille garde la direction.
      g.fillStyle(C.cream, 1);
      g.lineStyle(lw, C.ink, 1);
      g.fillCircle(0, 0, 40 * u);
      g.strokeCircle(0, 0, 40 * u);
      g.fillStyle(C.brick, 1);
      g.fillTriangle(-9 * u, 0, 9 * u, 0, 0, -32 * u);
      g.fillStyle(STEEL, 1);
      g.fillTriangle(-9 * u, 0, 9 * u, 0, 0, 32 * u);
      g.fillStyle(C.ink, 1);
      g.fillCircle(0, 0, 5 * u);
      break;
    }
  }
}

/** Couleur de chaque tâche de l'ordinateur (en plus de son pictogramme et de la forme de ses unités, P15). */
export const TASK_COLOR: Record<TaskKind, number> = {
  guidage: 0x5b8def,
  controle: 0xa97be0,
  rapport: 0xe0a458,
  affichage: 0xe48bb5,
};

export const isEssential = (t: TaskKind): boolean => t === 'guidage' || t === 'controle';

/** Pictogramme d'une tâche de l'ordinateur, centré en (0, 0) dans un carré de côté `s`. */
export function drawTask(g: G, kind: TaskKind, s: number): void {
  const u = s / 100;
  const lw = 6 * u;
  g.lineStyle(lw, C.ink, 1);
  switch (kind) {
    case 'guidage': {
      // Une cible et la flèche qui y mène : le guidage dit où aller.
      g.fillStyle(C.white, 1);
      g.fillCircle(12 * u, -10 * u, 30 * u);
      g.strokeCircle(12 * u, -10 * u, 30 * u);
      g.fillStyle(C.brick, 1);
      g.fillCircle(12 * u, -10 * u, 17 * u);
      g.fillStyle(C.white, 1);
      g.fillCircle(12 * u, -10 * u, 7 * u);
      g.lineStyle(lw * 1.4, C.ink, 1);
      g.lineBetween(-38 * u, 38 * u, 4 * u, -2 * u);
      g.fillStyle(C.ink, 1);
      g.fillTriangle(10 * u, -8 * u, -12 * u, -4 * u, 6 * u, 14 * u);
      break;
    }
    case 'controle': {
      // Manche de pilotage : le contrôle du vol garde le module bien droit.
      g.fillStyle(STEEL, 1);
      g.fillRoundedRect(-34 * u, 18 * u, 68 * u, 24 * u, 8 * u);
      g.strokeRoundedRect(-34 * u, 18 * u, 68 * u, 24 * u, 8 * u);
      g.lineStyle(lw * 1.6, C.ink, 1);
      g.lineBetween(0, 20 * u, 8 * u, -22 * u);
      g.fillStyle(C.brick, 1);
      g.lineStyle(lw, C.ink, 1);
      g.fillCircle(9 * u, -28 * u, 14 * u);
      g.strokeCircle(9 * u, -28 * u, 14 * u);
      break;
    }
    case 'rapport': {
      // Une feuille de compte rendu.
      g.fillStyle(C.white, 1);
      const sheet = [
        { x: -28 * u, y: -40 * u },
        { x: 14 * u, y: -40 * u },
        { x: 30 * u, y: -24 * u },
        { x: 30 * u, y: 40 * u },
        { x: -28 * u, y: 40 * u },
      ];
      g.fillPoints(sheet, true);
      g.strokePoints(sheet, true);
      g.lineStyle(lw * 0.8, C.grey, 1);
      for (const y of [-18, -4, 10, 24]) g.lineBetween(-18 * u, y * u, 20 * u, y * u);
      break;
    }
    case 'affichage': {
      // Un petit écran et ses barres : un affichage secondaire.
      g.fillStyle(0x10261a, 1);
      g.fillRoundedRect(-40 * u, -32 * u, 80 * u, 58 * u, 8 * u);
      g.strokeRoundedRect(-40 * u, -32 * u, 80 * u, 58 * u, 8 * u);
      g.fillStyle(C.mint, 1);
      [16, 30, 22, 38].forEach((h, i) => g.fillRect(-28 * u + i * 16 * u, 18 * u - h * u, 10 * u, h * u));
      g.fillStyle(C.ink, 1);
      g.fillRect(-8 * u, 26 * u, 16 * u, 10 * u);
      g.fillRect(-20 * u, 36 * u, 40 * u, 6 * u);
      break;
    }
  }
}

/** Une unité de travail d'une tâche : sa couleur, et une marque propre à la tâche (P15). */
function drawTaskUnit(g: G, x: number, y: number, s: number, task: TaskKind, alpha = 1): void {
  g.fillStyle(TASK_COLOR[task], alpha);
  g.fillRoundedRect(x - s / 2, y - s / 2, s, s, s * 0.18);
  g.lineStyle(Math.max(2, s * 0.07), C.ink, alpha);
  g.strokeRoundedRect(x - s / 2, y - s / 2, s, s, s * 0.18);
  g.fillStyle(C.white, 0.85 * alpha);
  const r = s * 0.2;
  switch (task) {
    case 'guidage':
      g.fillCircle(x, y, r);
      break;
    case 'controle':
      g.fillPoints(
        [
          { x, y: y - r * 1.3 },
          { x: x + r * 1.3, y },
          { x, y: y + r * 1.3 },
          { x: x - r * 1.3, y },
        ],
        true,
      );
      break;
    default:
      g.fillRect(x - r * 1.4, y - r * 0.9, r * 2.8, r * 0.6);
      g.fillRect(x - r * 1.4, y + r * 0.3, r * 2.8, r * 0.6);
  }
}

function dashed(g: G, x1: number, x2: number, y: number, dash = 16, gapLen = 10): void {
  for (let x = x1; x < x2; x += dash + gapLen) g.lineBetween(x, y, Math.min(x2, x + dash), y);
}

// ---------------------------------------------------------------------------
// C4.1 — La vue de descente : la surface de la Lune, qui grossit par étapes
// ---------------------------------------------------------------------------

/**
 * Une fenêtre sur le décor `lune_surface` : l'image est recadrée sur la zone de pose (`target`, fractions
 * de l'image) et agrandie `zoom` fois. Sans masque : le recadrage marche avec tous les moteurs de rendu.
 */
export class DescentWindow {
  readonly img: Img;
  private frame: G;
  private z: number;

  constructor(
    private scene: Phaser.Scene,
    private x: number,
    private y: number,
    private w: number,
    private h: number,
    depth: number,
    private target: Pt = { x: 0.5, y: 0.6 },
    zoom = 1,
  ) {
    this.img = scene.add.image(0, 0, 'lune_surface').setOrigin(0, 0).setDepth(depth);
    this.frame = scene.add.graphics().setDepth(depth + 0.5);
    this.frame.lineStyle(8, C.ink, 1);
    this.frame.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 18);
    this.z = zoom;
    this.apply();
  }

  get zoom(): number {
    return this.z;
  }

  private apply(): void {
    const img = this.img;
    const tw = img.width;
    const th = img.height;
    const k = Math.max(this.w / tw, this.h / th) * this.z;
    const cw = this.w / k;
    const ch = this.h / k;
    const cx = Phaser.Math.Clamp(this.target.x * tw - cw / 2, 0, tw - cw);
    const cy = Phaser.Math.Clamp(this.target.y * th - ch / 2, 0, th - ch);
    img.setScale(k).setCrop(cx, cy, cw, ch);
    img.setPosition(this.x - this.w / 2 - cx * k, this.y - this.h / 2 - cy * k);
  }

  /** La surface grossit (Eagle descend). */
  async zoomTo(zoom: number, ms: number): Promise<void> {
    const proxy = { z: this.z };
    await tweenAsync(this.scene, {
      targets: proxy,
      z: zoom,
      duration: ms,
      ease: 'Sine.InOut',
      onUpdate: () => {
        this.z = proxy.z;
        this.apply();
      },
    });
    this.z = zoom;
    this.apply();
  }

  setAlpha(a: number): this {
    this.img.setAlpha(a);
    this.frame.setAlpha(a);
    return this;
  }

  get parts(): Phaser.GameObjects.GameObject[] {
    return [this.img, this.frame];
  }

  destroy(): void {
    this.img.destroy();
    this.frame.destroy();
  }
}

// ---------------------------------------------------------------------------
// C4.1 — La jauge d'énergie de la simulation et son repère de prévision
// ---------------------------------------------------------------------------

const GAUGE_H = 580;
const GAUGE_W = 110;
const GAUGE_PAD = 14;

/**
 * Jauge verticale : `level` unités pleines sur une graduation de `max` (10, 20 ou 60).
 * Le repère en pointillés montre où l'enfant prévoit que la jauge s'arrêtera ; la part qui serait
 * consommée (entre le niveau et le repère) est hachurée.
 */
export class EnergyGauge extends Phaser.GameObjects.Container {
  level: number;
  cursor: number | null = null;
  private u: number;
  private cells: G;
  private chunk: G;
  private marks: G;
  private cursorG: G;
  private bubble: Phaser.GameObjects.Container;
  private bubbleText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly profile: Profile,
    readonly max: number,
    level: number,
  ) {
    super(scene, x, y);
    this.level = level;
    this.u = (GAUGE_H - 2 * GAUGE_PAD) / max;
    const body = scene.add.graphics();
    body.fillStyle(0x000000, 0.25);
    body.fillRoundedRect(-GAUGE_W / 2 + 8, -GAUGE_H / 2 + 10, GAUGE_W, GAUGE_H, 26);
    body.fillStyle(STEEL_DARK, 1);
    body.fillRoundedRect(-GAUGE_W / 2, -GAUGE_H / 2, GAUGE_W, GAUGE_H, 26);
    body.lineStyle(7, C.ink, 1);
    body.strokeRoundedRect(-GAUGE_W / 2, -GAUGE_H / 2, GAUGE_W, GAUGE_H, 26);
    // Éclair au pied de la jauge : c'est de l'énergie.
    const bolt = scene.add.graphics();
    bolt.fillStyle(ENERGY, 1);
    bolt.lineStyle(4, C.ink, 1);
    const pts = [
      { x: 6, y: GAUGE_H / 2 + 14 },
      { x: -14, y: GAUGE_H / 2 + 46 },
      { x: 0, y: GAUGE_H / 2 + 46 },
      { x: -6, y: GAUGE_H / 2 + 74 },
      { x: 14, y: GAUGE_H / 2 + 40 },
      { x: 0, y: GAUGE_H / 2 + 40 },
    ];
    bolt.fillPoints(pts, true);
    bolt.strokePoints(pts, true);
    this.cells = scene.add.graphics();
    this.chunk = scene.add.graphics();
    this.marks = scene.add.graphics();
    this.cursorG = scene.add.graphics();
    this.bubbleText = scene.add.text(0, 3, '?', textStyle(64, { color: '#3a2a20' })).setOrigin(0.5);
    const bubbleBg = scene.add.graphics();
    bubbleBg.fillStyle(C.white, 1);
    bubbleBg.fillRoundedRect(-58, -44, 116, 88, 22);
    bubbleBg.lineStyle(6, C.ink, 1);
    bubbleBg.strokeRoundedRect(-58, -44, 116, 88, 22);
    this.bubble = scene.add.container(GAUGE_W / 2 + 84, 0, [bubbleBg, this.bubbleText]);
    this.add([body, bolt, this.cells, this.chunk, this.marks, this.cursorG, this.bubble]);
    this.redraw();
    this.setCursor(null);
    scene.add.existing(this);
  }

  /** Ordonnée (locale) du haut de l'unité `v` (v unités en dessous). */
  yOf(v: number): number {
    return GAUGE_H / 2 - GAUGE_PAD - v * this.u;
  }

  /** Point du monde au niveau `v`, sur le bord droit de la jauge. */
  worldAt(v: number): Pt {
    return { x: this.x + GAUGE_W / 2, y: this.y + this.yOf(v) };
  }

  private get grouped(): boolean {
    return this.max > 20;
  }

  private redraw(): void {
    const g = this.cells;
    g.clear();
    const inner = GAUGE_W - 2 * GAUGE_PAD;
    if (!this.grouped) {
      // Une case par unité, comme la réserve du chapitre 3.
      const s = Math.min(inner, this.u - 4);
      for (let k = 0; k < this.max; k++) {
        const cy = this.yOf(k) - this.u / 2;
        if (s >= 30) drawUnit(g, 0, cy, s, k < this.level);
        else {
          g.fillStyle(k < this.level ? ENERGY : SOCKET, 1);
          g.fillRoundedRect(-inner / 2, cy - s / 2, inner, s, 5);
          g.lineStyle(3, C.ink, 1);
          g.strokeRoundedRect(-inner / 2, cy - s / 2, inner, s, 5);
        }
      }
      return;
    }
    // Fin de CP : une colonne continue, un trait par unité et un gros trait par dizaine.
    g.fillStyle(SOCKET, 1);
    g.fillRect(-inner / 2, this.yOf(this.max), inner, this.max * this.u);
    g.fillStyle(ENERGY, 1);
    g.fillRect(-inner / 2, this.yOf(this.level), inner, this.level * this.u);
    for (let k = 1; k < this.max; k++) {
      const ten = k % 10 === 0;
      g.lineStyle(ten ? 5 : 1.5, C.ink, ten ? 1 : 0.55);
      const half = ten ? inner / 2 + 10 : inner / 2;
      g.lineBetween(-half, this.yOf(k), half, this.yOf(k));
    }
    g.lineStyle(4, C.ink, 1);
    g.strokeRect(-inner / 2, this.yOf(this.max), inner, this.max * this.u);
  }

  /** Repère de prévision au niveau `v` (`null` : au niveau actuel, avec un point d'interrogation). */
  setCursor(v: number | null): void {
    this.cursor = v;
    const at = v ?? this.level;
    const y = this.yOf(at);
    const g = this.cursorG;
    g.clear();
    g.lineStyle(6, C.white, 1);
    dashed(g, -GAUGE_W / 2 - 18, GAUGE_W / 2 + 18, y);
    g.fillStyle(C.white, 1);
    g.lineStyle(4, C.ink, 1);
    const tri = [
      { x: GAUGE_W / 2 + 16, y },
      { x: GAUGE_W / 2 + 34, y: y - 14 },
      { x: GAUGE_W / 2 + 34, y: y + 14 },
    ];
    g.fillPoints(tri, true);
    g.strokePoints(tri, true);
    this.bubble.setY(Phaser.Math.Clamp(y, -GAUGE_H / 2 + 44, GAUGE_H / 2 - 44));
    this.bubbleText.setText(v === null ? '?' : String(v));
    // La part que le contrôle prendrait, si le repère est juste.
    const c = this.chunk;
    c.clear();
    if (v !== null && v < this.level) {
      const inner = GAUGE_W - 2 * GAUGE_PAD;
      const top = this.yOf(this.level);
      const h = (this.level - v) * this.u;
      c.fillStyle(C.white, 0.35);
      c.fillRect(-inner / 2, top, inner, h);
      c.lineStyle(3, C.ink, 0.45);
      for (let d = -h; d < inner; d += 18) {
        const x1 = Math.max(-inner / 2, -inner / 2 + d);
        const y1 = top + (x1 - (-inner / 2 + d));
        const x2 = Math.min(inner / 2, -inner / 2 + d + h);
        const y2 = top + (x2 - (-inner / 2 + d));
        c.lineBetween(x1, y1, x2, y2);
      }
    }
  }

  showCursor(on: boolean): void {
    this.cursorG.setVisible(on);
    this.chunk.setVisible(on);
    this.bubble.setVisible(on);
  }

  /** Cadre de couleur autour des unités [from, to[ (comptées depuis le bas). */
  mark(from: number, to: number, color: number): void {
    const inner = GAUGE_W - 2 * GAUGE_PAD;
    this.marks.clear();
    if (to <= from) return;
    this.marks.lineStyle(7, color, 1);
    this.marks.strokeRoundedRect(-inner / 2 - 8, this.yOf(to) - 4, inner + 16, (to - from) * this.u + 8, 10);
  }

  clearMarks(): void {
    this.marks.clear();
  }

  /** Le contrôle prend ses unités : la jauge descend jusqu'à `to`, une unité après l'autre. */
  async drain(to: number): Promise<void> {
    const n = this.level - to;
    const step = Math.max(30, Math.min(160, 1500 / Math.max(1, n)));
    while (this.level > to) {
      this.level--;
      this.redraw();
      services.sfx.step(false);
      await wait(step);
    }
  }

  /** Aide : on compte les unités qui resteront (par dizaines d'abord en fin de CP). */
  async countUnits(n: number): Promise<void> {
    const inner = GAUGE_W - 2 * GAUGE_PAD;
    this.marks.clear();
    this.marks.lineStyle(5, C.mint, 1);
    let k = 0;
    if (this.grouped) {
      for (; k + 10 <= n; k += 10) {
        this.marks.strokeRect(-inner / 2 - 6, this.yOf(k + 10), inner + 12, 10 * this.u);
        services.sfx.pop(k / 10);
        await services.voice.sayNumber(k + 10);
        await wait(200);
      }
    }
    for (; k < n; k++) {
      this.marks.strokeRect(-inner / 2 - 6, this.yOf(k + 1), inner + 12, this.u);
      services.sfx.pop(k % 10);
      await services.voice.sayNumber(k + 1);
      await wait(150);
    }
  }
}

/** Répondre en plaçant le repère de la jauge : ▲ ▼ (et dizaines en fin de CP), chiffres du clavier en option. */
export class GaugeAnswer implements AnswerUI<number> {
  validateButton: Button;
  private buttons: Button[] = [];
  private down: Button;
  private lastDigitAt = -Infinity;

  constructor(
    scene: Phaser.Scene,
    private gauge: EnergyGauge,
    x: number,
    tens: boolean,
    onValidate: () => void,
  ) {
    const mk = (y: number, icon: 'up' | 'down', d: number, small?: string) => {
      const b = new Button(scene, { x, y, w: 130, h: 120, icon, iconSize: small ? 62 : 80, onPress: () => this.change(d) }).setDepth(40);
      if (small) b.add(scene.add.text(0, icon === 'up' ? 34 : -34, small, textStyle(30, { color: '#3a2a20' })).setOrigin(0.5));
      this.buttons.push(b);
      return b;
    };
    const cy = gauge.y;
    if (tens) {
      mk(cy - 225, 'up', 10, '10');
      mk(cy - 80, 'up', 1);
      this.down = mk(cy + 80, 'down', -1);
      mk(cy + 225, 'down', -10, '10');
    } else {
      mk(cy - 110, 'up', 1);
      this.down = mk(cy + 110, 'down', -1);
    }
    this.validateButton = makeValidate(scene, 1400, onValidate);
    gauge.setCursor(null);
  }

  private change(d: number): void {
    const level = this.gauge.level;
    const before = this.gauge.cursor;
    const next = before === null && d > 0 ? level : Phaser.Math.Clamp((before ?? level) + d, 0, level);
    this.gauge.setCursor(next);
    if (next !== before) {
      services.sfx.step(d > 0);
      void services.voice.sayNumber(next);
    }
  }

  onDigit(d: number): void {
    const now = performance.now();
    const v = this.gauge.cursor;
    const joined = v !== null && now - this.lastDigitAt < 1500 ? v * 10 + d : d;
    this.lastDigitAt = now;
    const next = joined <= this.gauge.level ? joined : Math.min(d, this.gauge.level);
    this.gauge.setCursor(next);
    void services.voice.sayNumber(next);
  }

  onErase(): void {
    const v = this.gauge.cursor;
    this.gauge.setCursor(v !== null && v >= 10 ? Math.floor(v / 10) : null);
  }

  value(): number | null {
    return this.gauge.cursor;
  }

  set(v: number): void {
    this.gauge.setCursor(v);
  }

  focusables(): Focusable[] {
    return [...this.buttons, this.validateButton];
  }

  first(): Focusable {
    return this.down;
  }

  destroy(): void {
    for (const b of this.buttons) b.destroy();
    this.validateButton.destroy();
  }
}

/** Le prochain contrôle : son pictogramme et les unités d'énergie qu'il utilise (cases vides, puis allumées). */
export class ControlCard extends Phaser.GameObjects.Container {
  private cells: G;
  private ring: G;
  private badge: G;
  private pos: Pt[] = [];
  private size: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly kind: ControlKind,
    readonly units: number,
  ) {
    super(scene, x, y);
    const cols = units <= 5 ? units : 10;
    const rows = Math.ceil(units / cols);
    this.size = units <= 5 ? 50 : units <= 20 ? 34 : 24;
    const gap = units <= 20 ? 6 : 4;
    const gw = cols * (this.size + gap) - gap;
    const gh = rows * (this.size + gap) - gap;
    const w = Math.max(420, gw + 200);
    const h = Math.max(170, gh + 60);
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.25);
    bg.fillRoundedRect(-w / 2 + 8, -h / 2 + 10, w, h, 24);
    bg.fillStyle(0x9aa0ab, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 24);
    bg.lineStyle(7, C.ink, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 24);
    bg.fillStyle(C.cream, 1);
    bg.fillCircle(-w / 2 + 84, 0, 58);
    bg.lineStyle(6, C.ink, 1);
    bg.strokeCircle(-w / 2 + 84, 0, 58);
    const icon = scene.add.graphics().setPosition(-w / 2 + 84, 0);
    drawControl(icon, kind, 92);
    const x0 = -w / 2 + 170 + (w - 170 - 30 - gw) / 2;
    for (let k = 0; k < units; k++) {
      this.pos.push({ x: x0 + (k % cols) * (this.size + gap) + this.size / 2, y: -gh / 2 + Math.floor(k / cols) * (this.size + gap) + this.size / 2 });
    }
    this.cells = scene.add.graphics();
    this.ring = scene.add.graphics();
    this.badge = scene.add.graphics().setPosition(w / 2 - 12, -h / 2 + 12).setVisible(false);
    this.badge.fillStyle(C.green, 1);
    this.badge.fillCircle(0, 0, 32);
    this.badge.lineStyle(5, C.ink, 1);
    this.badge.strokeCircle(0, 0, 32);
    drawCheck(this.badge, 0, 2, 36, C.white);
    this.add([bg, icon, this.cells, this.ring, this.badge]);
    this.draw(0);
    scene.add.existing(this);
  }

  private draw(lit: number): void {
    this.cells.clear();
    this.pos.forEach((p, k) => drawUnit(this.cells, p.x, p.y, this.size, k < lit));
  }

  /** Les unités prises dans la jauge arrivent dans le contrôle : il s'allume. */
  async power(): Promise<void> {
    const step = Math.max(30, Math.min(120, 1200 / this.units));
    for (let k = 1; k <= this.units; k++) {
      this.draw(k);
      await wait(step);
    }
    this.badge.setVisible(true).setScale(0);
    await tweenAsync(this.scene, { targets: this.badge, scale: 1, duration: 250, ease: 'Back.Out' });
  }

  /** Repère autour des unités du contrôle (ce qu'il utilise vraiment). */
  mark(color: number | null): void {
    this.ring.clear();
    if (color === null) return;
    const s = this.size;
    this.ring.lineStyle(5, color, 1);
    for (const p of this.pos) this.ring.strokeRoundedRect(p.x - s / 2 - 4, p.y - s / 2 - 4, s + 8, s + 8, s * 0.2);
  }
}

/** Voyants du tableau de bord d'Eagle : chaque contrôle réussi en allume un. */
export class PanelLamps extends Phaser.GameObjects.Container {
  private lamps: G[] = [];
  private lit = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, n: number) {
    super(scene, x, y);
    const step = 62;
    const w = n * step + 30;
    const bg = scene.add.graphics();
    bg.fillStyle(STEEL_DARK, 1);
    bg.fillRoundedRect(-w / 2, -36, w, 72, 20);
    bg.lineStyle(6, C.ink, 1);
    bg.strokeRoundedRect(-w / 2, -36, w, 72, 20);
    this.add(bg);
    for (let i = 0; i < n; i++) {
      const g = scene.add.graphics().setPosition(-w / 2 + 15 + step / 2 + i * step, 0);
      this.lamps.push(g);
      this.add(g);
      this.drawLamp(g, false);
    }
    scene.add.existing(this);
  }

  private drawLamp(g: G, on: boolean): void {
    g.clear();
    if (on) {
      g.fillStyle(C.green, 0.35);
      g.fillCircle(0, 0, 30);
    }
    g.fillStyle(on ? C.green : 0x59606d, 1);
    g.fillCircle(0, 0, 21);
    g.lineStyle(4, C.ink, 1);
    g.strokeCircle(0, 0, 21);
  }

  async lightNext(): Promise<void> {
    const g = this.lamps[Math.min(this.lit, this.lamps.length - 1)];
    this.lit++;
    this.drawLamp(g, true);
    g.setScale(1.5);
    services.sfx.pop(4 + this.lit);
    await tweenAsync(this.scene, { targets: g, scale: 1, duration: 260, ease: 'Back.Out' });
  }
}

// ---------------------------------------------------------------------------
// C4.2 — L'alarme 1202 : l'affichage de l'ordinateur et les fenêtres d'alerte
// ---------------------------------------------------------------------------

/** Afficheur de l'ordinateur du module : le code d'alarme en gros chiffres verts, et un voyant. */
export class AlarmDisplay extends Phaser.GameObjects.Container {
  private lamp: G;
  private code: Phaser.GameObjects.Text;
  private blinkTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(-300 + 10, -170 + 12, 600, 340, 30);
    g.fillStyle(0x8f97a5, 1);
    g.fillRoundedRect(-300, -170, 600, 340, 30);
    g.lineStyle(8, C.ink, 1);
    g.strokeRoundedRect(-300, -170, 600, 340, 30);
    g.fillStyle(0x10261a, 1);
    g.fillRoundedRect(-250, -120, 380, 240, 18);
    g.lineStyle(5, C.ink, 1);
    g.strokeRoundedRect(-250, -120, 380, 240, 18);
    this.code = scene.add.text(-60, 4, '', textStyle(130, { color: '#7dffa8' })).setOrigin(0.5);
    this.lamp = scene.add.graphics().setPosition(215, 0);
    this.add([g, this.code, this.lamp]);
    this.setLamp(false);
    scene.add.existing(this);
  }

  private setLamp(on: boolean): void {
    const g = this.lamp;
    g.clear();
    if (on) {
      g.fillStyle(C.orange, 0.4);
      g.fillCircle(0, 0, 54);
    }
    g.fillStyle(on ? C.orange : 0x6b4a33, 1);
    g.fillCircle(0, 0, 36);
    g.lineStyle(5, C.ink, 1);
    g.strokeCircle(0, 0, 36);
  }

  /** Le code apparaît ; le voyant d'alarme clignote, puis reste allumé (la composition se stabilise). */
  alarm(code: string, blink: boolean): void {
    this.code.setText(code);
    this.blinkTimer?.remove();
    this.blinkTimer = null;
    if (!blink) {
      this.setLamp(true);
      return;
    }
    let on = false;
    this.blinkTimer = this.scene.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => {
        on = !on;
        this.setLamp(on);
      },
    });
  }

  override destroy(fromScene?: boolean): void {
    this.blinkTimer?.remove();
    super.destroy(fromScene);
  }
}

/** Une fenêtre d'alerte : barre de titre, triangle « attention », petit texte illisible (aucune lecture). */
export function alertWindow(scene: Phaser.Scene, x: number, y: number, depth: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const w = 220;
  const h = 140;
  g.fillStyle(0x000000, 0.25);
  g.fillRoundedRect(-w / 2 + 6, -h / 2 + 8, w, h, 12);
  g.fillStyle(C.cream, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
  g.fillStyle(C.orange, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, 32, { tl: 12, tr: 12, bl: 0, br: 0 });
  g.lineStyle(5, C.ink, 1);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
  g.fillStyle(C.mustard, 1);
  g.fillTriangle(-70, 50, -20, 50, -45, 2);
  g.lineStyle(4, C.ink, 1);
  g.strokeTriangle(-70, 50, -20, 50, -45, 2);
  g.fillStyle(C.ink, 1);
  g.fillRect(-48, 16, 6, 20);
  g.fillCircle(-45, 43, 3.5);
  g.lineStyle(6, C.grey, 1);
  for (const ly of [10, 28, 46]) g.lineBetween(0, ly, 80, ly);
  return scene.add.container(x, y, [g]).setDepth(depth);
}

// ---------------------------------------------------------------------------
// C4.3 — Le plateau de travail de l'ordinateur, les tâches, la zone d'attente
// ---------------------------------------------------------------------------

interface TrayGeom {
  cols: number;
  size: number;
  gap: number;
  /** Écart supplémentaire au milieu d'une ligne de dix. */
  groupGap: number;
}

const TRAY_GEOM: Record<Profile, TrayGeom> = {
  debut: { cols: 5, size: 92, gap: 14, groupGap: 0 },
  milieu: { cols: 10, size: 56, gap: 10, groupGap: 22 },
  fin: { cols: 10, size: 44, gap: 8, groupGap: 22 },
};

/** Le plateau : `cap` places, que les tâches occupent dans l'ordre. */
export class WorkTray extends Phaser.GameObjects.Container {
  readonly slots: (TaskKind | null)[];
  private geom: TrayGeom;
  private cellsG: G;
  private marks: G;
  private origin: Pt;
  /** Unités sans place (tentative qui dépasse) et unités fantômes de l'aide. */
  private extras: Phaser.GameObjects.GameObject[] = [];
  readonly boxW: number;
  readonly boxH: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    profile: Profile,
    readonly cap: number,
  ) {
    super(scene, x, y);
    this.slots = Array.from({ length: cap }, () => null);
    const g = (this.geom = TRAY_GEOM[profile]);
    const cols = Math.min(g.cols, cap);
    const rows = Math.ceil(cap / g.cols);
    const gw = cols * (g.size + g.gap) - g.gap + (cols > 5 ? g.groupGap : 0);
    const gh = rows * (g.size + g.gap) - g.gap;
    this.boxW = gw + 70;
    this.boxH = gh + 70;
    this.origin = { x: -gw / 2 + g.size / 2, y: -gh / 2 + g.size / 2 };
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.25);
    bg.fillRoundedRect(-this.boxW / 2 + 8, -this.boxH / 2 + 10, this.boxW, this.boxH, 26);
    bg.fillStyle(STEEL, 1);
    bg.fillRoundedRect(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH, 26);
    bg.lineStyle(7, C.ink, 1);
    bg.strokeRoundedRect(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH, 26);
    this.cellsG = scene.add.graphics();
    this.marks = scene.add.graphics();
    this.add([bg, this.cellsG, this.marks]);
    this.redraw();
    scene.add.existing(this);
  }

  /** Centre (local) de la place `k`. */
  at(k: number): Pt {
    const g = this.geom;
    const c = k % g.cols;
    return {
      x: this.origin.x + c * (g.size + g.gap) + (c >= 5 ? g.groupGap : 0),
      y: this.origin.y + Math.floor(k / g.cols) * (g.size + g.gap),
    };
  }

  get free(): number {
    return this.slots.filter((t) => t === null).length;
  }

  private get firstFree(): number {
    return this.slots.indexOf(null);
  }

  private redraw(): void {
    const g = this.cellsG;
    const s = this.geom.size;
    g.clear();
    this.slots.forEach((t, k) => {
      const p = this.at(k);
      if (t) drawTaskUnit(g, p.x, p.y, s, t);
      else {
        g.fillStyle(SOCKET, 1);
        g.fillRoundedRect(p.x - s / 2, p.y - s / 2, s, s, s * 0.18);
        g.lineStyle(Math.max(2, s * 0.06), 0x77808f, 1);
        g.strokeRoundedRect(p.x - s / 2, p.y - s / 2, s, s, s * 0.18);
      }
    });
  }

  /** Une tâche occupe `n` places : ses unités volent depuis `from` (point du monde) vers les premières places libres. */
  async fill(task: TaskKind, n: number, from: Pt): Promise<void> {
    const step = Math.max(25, Math.min(140, 1400 / n));
    for (let i = 0; i < n; i++) {
      const k = this.firstFree;
      if (k < 0) break;
      this.flyUnit(task, from, k);
      await wait(step);
    }
    await wait(260);
  }

  private flyUnit(task: TaskKind, from: Pt, k: number): void {
    const s = this.geom.size;
    const to = this.at(k);
    this.slots[k] = task;
    const g = this.scene.add.graphics().setDepth(this.depth + 1).setPosition(from.x, from.y);
    drawTaskUnit(g, 0, 0, s, task);
    services.sfx.pop(k % 10);
    this.scene.tweens.add({
      targets: g,
      x: this.x + to.x,
      y: this.y + to.y,
      duration: 240,
      ease: 'Cubic.Out',
      onComplete: () => {
        g.destroy();
        if (this.active) this.redraw();
      },
    });
  }

  /** Retire les `n` dernières unités de la tâche (après une tentative). */
  unfill(task: TaskKind, n: number): void {
    for (let k = this.slots.length - 1; k >= 0 && n > 0; k--) {
      if (this.slots[k] === task) {
        this.slots[k] = null;
        n--;
      }
    }
    this.redraw();
  }

  /**
   * Tentative qui dépasse la capacité : la tâche remplit les places libres ; ses autres unités restent
   * sur sa carte, entourées d'orange. Renvoie le nombre d'unités placées (à retirer ensuite).
   */
  async overflow(chip: TaskChip): Promise<number> {
    const placed = Math.min(chip.units, this.free);
    await this.fill(chip.task, placed, chip.source);
    chip.showUnits(placed, placed);
    services.sfx.softError();
    await wait(300);
    return placed;
  }

  /** Aide : une unité fantôme de la tâche sur chaque place libre ; celles de trop restent sur sa carte, en orange. */
  ghost(chip: TaskChip): void {
    const s = this.geom.size * 0.7;
    const free = this.slots.map((t, k) => (t === null ? k : -1)).filter((k) => k >= 0);
    const n = Math.min(chip.units, free.length);
    for (let i = 0; i < n; i++) {
      const p = this.at(free[i]);
      const g = this.scene.add.graphics().setDepth(this.depth + 1).setPosition(this.x + p.x, this.y + p.y);
      drawTaskUnit(g, 0, 0, s, chip.task, 0.6);
      this.extras.push(g);
    }
    chip.showUnits(0, n);
  }

  clearExtras(): void {
    for (const e of this.extras) e.destroy();
    this.extras = [];
  }

  /** Cadre de couleur autour de places : les `count` premières places libres (ou toutes). */
  markFree(color: number, count = Infinity): void {
    const s = this.geom.size;
    this.marks.clear();
    this.marks.lineStyle(Math.max(4, s * 0.1), color, 1);
    let left = count;
    this.slots.forEach((t, k) => {
      if (t !== null || left <= 0) return;
      left--;
      const p = this.at(k);
      this.marks.strokeRoundedRect(p.x - s / 2 - 5, p.y - s / 2 - 5, s + 10, s + 10, s * 0.22);
    });
  }

  /** Cadre autour des places libres à partir de la `skip`-ième (celles que l'enfant n'a pas comptées). */
  markFreeAfter(skip: number, color: number): void {
    const s = this.geom.size;
    this.marks.clear();
    this.marks.lineStyle(Math.max(4, s * 0.1), color, 1);
    let seen = 0;
    this.slots.forEach((t, k) => {
      if (t !== null) return;
      if (seen++ < skip) return;
      const p = this.at(k);
      this.marks.strokeRoundedRect(p.x - s / 2 - 5, p.y - s / 2 - 5, s + 10, s + 10, s * 0.22);
    });
  }

  clearMarks(): void {
    this.marks.clear();
  }

  /** Aide : on compte ensemble les places libres (une ligne de dix à la fois en fin de CP). */
  async countFree(byTens: boolean): Promise<void> {
    const s = this.geom.size;
    this.marks.clear();
    this.marks.lineStyle(Math.max(4, s * 0.1), C.mint, 1);
    const free = this.slots.map((t, k) => (t === null ? k : -1)).filter((k) => k >= 0);
    let i = 0;
    const box = (k: number) => {
      const p = this.at(k);
      this.marks.strokeRoundedRect(p.x - s / 2 - 5, p.y - s / 2 - 5, s + 10, s + 10, s * 0.22);
    };
    if (byTens) {
      // Lignes entièrement libres : une dizaine d'un coup.
      while (i + 10 <= free.length && free[i] % 10 === 0 && free[i + 9] === free[i] + 9) {
        for (let j = 0; j < 10; j++) box(free[i + j]);
        i += 10;
        services.sfx.pop(i / 10);
        await services.voice.sayNumber(i);
        await wait(200);
      }
    }
    for (; i < free.length; i++) {
      box(free[i]);
      services.sfx.pop(i % 10);
      await services.voice.sayNumber(i + 1);
      await wait(150);
    }
  }

  /** Les tâches indispensables brillent (bonne répartition). */
  async glow(): Promise<void> {
    await tweenAsync(this.scene, { targets: this.cellsG, alpha: 0.55, duration: 160, yoyo: true, repeat: 1 });
  }
}

/** Une tâche annoncée : son pictogramme, son nombre d'unités, et un badge (indispensable : étoile ; secondaire : sablier). */
export class TaskChip extends Phaser.GameObjects.Container {
  private unitsG: G;
  private pos: Pt[] = [];
  private s: number;
  readonly boxW: number;
  readonly boxH: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly task: TaskKind,
    readonly units: number,
  ) {
    super(scene, x, y);
    // Sans unités (présentation des tâches) : le pictogramme et le badge seulement.
    const cols = Math.max(1, Math.min(10, units));
    const rows = Math.ceil(units / 10);
    this.s = units <= 10 ? 18 : 14;
    const gap = 4;
    const gw = cols * (this.s + gap) - gap;
    const gh = rows * (this.s + gap) - gap;
    this.boxW = Math.max(250, gw + 40);
    this.boxH = units === 0 ? 130 : 150 + gh;
    const essential = isEssential(task);
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.22);
    bg.fillRoundedRect(-this.boxW / 2 + 6, -this.boxH / 2 + 8, this.boxW, this.boxH, 22);
    bg.fillStyle(C.cream, 1);
    bg.fillRoundedRect(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH, 22);
    bg.lineStyle(6, essential ? TASK_COLOR[task] : C.ink, 1);
    bg.strokeRoundedRect(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH, 22);
    bg.fillStyle(TASK_COLOR[task], 1);
    bg.fillCircle(-this.boxW / 2 + 64, -this.boxH / 2 + 62, 48);
    bg.lineStyle(5, C.ink, 1);
    bg.strokeCircle(-this.boxW / 2 + 64, -this.boxH / 2 + 62, 48);
    const icon = scene.add.graphics().setPosition(-this.boxW / 2 + 64, -this.boxH / 2 + 62);
    drawTask(icon, task, 80);
    const num = scene.add.text(-this.boxW / 2 + 160, -this.boxH / 2 + 64, String(units), textStyle(64, { color: '#3a2a20' })).setOrigin(0.5);
    // Badge : étoile (indispensable) ou sablier (peut attendre).
    const badge = scene.add.graphics().setPosition(this.boxW / 2 - 34, -this.boxH / 2 + 34);
    badge.fillStyle(essential ? C.mustard : C.white, 1);
    badge.fillCircle(0, 0, 26);
    badge.lineStyle(4, C.ink, 1);
    badge.strokeCircle(0, 0, 26);
    drawIcon(badge, essential ? 'star' : 'hourglass', 40, essential ? C.white : C.ink);
    for (let k = 0; k < units; k++) {
      this.pos.push({ x: -gw / 2 + (k % 10) * (this.s + gap) + this.s / 2, y: this.boxH / 2 - 20 - gh + Math.floor(k / 10) * (this.s + gap) + this.s / 2 });
    }
    this.unitsG = scene.add.graphics();
    this.add([bg, icon, num, badge, this.unitsG]);
    if (units === 0) num.setVisible(false);
    this.showUnits();
    scene.add.existing(this);
  }

  /** Point du monde d'où partent les unités. */
  get source(): Pt {
    return { x: this.x, y: this.y + this.boxH / 2 - 30 };
  }

  /** Les `moved` premières unités sont parties dans le plateau ; à partir de `flagFrom`, elles sont entourées d'orange. */
  showUnits(moved = 0, flagFrom = Infinity): void {
    const g = this.unitsG;
    g.clear();
    this.pos.forEach((p, k) => {
      if (k < moved) {
        g.lineStyle(2, C.ink, 0.4);
        g.strokeRoundedRect(p.x - this.s / 2, p.y - this.s / 2, this.s, this.s, 3);
        return;
      }
      drawTaskUnit(g, p.x, p.y, this.s, this.task);
      if (k >= flagFrom) {
        g.lineStyle(4, C.orange, 1);
        g.strokeRoundedRect(p.x - this.s / 2 - 4, p.y - this.s / 2 - 4, this.s + 8, this.s + 8, 4);
      }
    });
  }
}

/** La zone d'attente : un coin calme où les tâches secondaires attendent leur tour. */
export class WaitingZone extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
    super(scene, x, y);
    const g = scene.add.graphics();
    g.fillStyle(0x24344f, 0.85);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 26);
    g.lineStyle(5, C.mint, 0.9);
    // Bord en pointillés : une zone de rangement, pas une boîte de travail.
    const r = 26;
    const seg = (x1: number, y1: number, x2: number, y2: number) => {
      const len = Math.hypot(x2 - x1, y2 - y1);
      for (let d = 0; d < len; d += 30) {
        const a = d / len;
        const b = Math.min(1, (d + 18) / len);
        g.lineBetween(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b);
      }
    };
    seg(-w / 2 + r, -h / 2, w / 2 - r, -h / 2);
    seg(-w / 2 + r, h / 2, w / 2 - r, h / 2);
    seg(-w / 2, -h / 2 + r, -w / 2, h / 2 - r);
    seg(w / 2, -h / 2 + r, w / 2, h / 2 - r);
    const icon = scene.add.graphics().setPosition(-w / 2 + 46, -h / 2 + 46);
    icon.fillStyle(C.cream, 1);
    icon.fillCircle(0, 0, 32);
    drawIcon(icon, 'hourglass', 48, C.ink);
    this.add([g, icon]);
    scene.add.existing(this);
  }

  /** La tâche vient s'y ranger, plus petite et plus calme. */
  async receive(chip: TaskChip): Promise<void> {
    services.sfx.whoosh();
    await tweenAsync(this.scene, { targets: chip, x: this.x + 20, y: this.y + 24, scale: 0.72, alpha: 0.75, duration: 600, ease: 'Cubic.InOut' });
  }
}

/** Option du choix final : « dans le plateau » ou « dans la zone d'attente » (pictogramme, lue à la sélection). */
export class DestinationOption extends Option {
  constructor(scene: Phaser.Scene, x: number, y: number, kind: 'plateau' | 'attente', onPress: () => void) {
    super(scene, x, y, 300, 150, onPress, kind === 'plateau' ? 0xdfe5ee : 0xd6e6e0);
    this.label = kind === 'plateau' ? 'c4_3_opt_plateau' : 'c4_3_opt_attente';
    const g = scene.add.graphics();
    drawIcon(g, kind === 'plateau' ? 'tray' : 'hourglass', 110, C.ink);
    this.add(g);
    this.finalize();
  }
}

// ---------------------------------------------------------------------------
// C4.3 — Le compteur à rouleaux : une roue pour les dizaines, une pour les unités
// ---------------------------------------------------------------------------

/**
 * Compteur à rouleaux, comme ceux des appareils de l'époque : ▲ ajoute un, ▼ en retire un
 * (la roue des dizaines tourne quand il le faut) ; la roue des dizaines a ses propres flèches.
 */
export class CounterAnswer implements AnswerUI<number> {
  validateButton: Button;
  private v: number | null = null;
  private buttons: Button[] = [];
  private casing: Phaser.GameObjects.Container;
  private drums: Phaser.GameObjects.Text[] = [];
  private first_: Button;
  private lastDigitAt = -Infinity;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    private max: number,
    onValidate: () => void,
  ) {
    const two = max >= 10;
    const dx = two ? 75 : 0;
    this.casing = scene.add.container(x, y).setDepth(39);
    const w = two ? 300 : 160;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(-w / 2 + 8, -100 + 10, w, 200, 26);
    g.fillStyle(STEEL_DARK, 1);
    g.fillRoundedRect(-w / 2, -100, w, 200, 26);
    g.lineStyle(7, C.ink, 1);
    g.strokeRoundedRect(-w / 2, -100, w, 200, 26);
    this.casing.add(g);
    const centers = two ? [-dx, dx] : [0];
    for (const cx of centers) {
      const d = scene.add.graphics();
      // Rouleau clair (couleurs pleines : le rendu Canvas ne fait pas les dégradés), ombré en haut et en bas.
      d.fillStyle(0xf4f6f9, 1);
      d.fillRoundedRect(cx - 60, -80, 120, 160, 14);
      d.fillStyle(0xcfd5df, 1);
      d.fillRoundedRect(cx - 60, -80, 120, 26, { tl: 14, tr: 14, bl: 0, br: 0 });
      d.fillRoundedRect(cx - 60, 54, 120, 26, { tl: 0, tr: 0, bl: 14, br: 14 });
      d.lineStyle(5, C.ink, 1);
      d.strokeRoundedRect(cx - 60, -80, 120, 160, 14);
      const t = scene.add.text(cx, 4, '0', textStyle(110, { color: '#3a2a20' })).setOrigin(0.5).setAlpha(0.35);
      this.casing.add([d, t]);
      this.drums.push(t);
    }
    const mk = (bx: number, by: number, icon: 'up' | 'down', delta: number) => {
      const b = new Button(scene, { x: x + bx, y: y + by, w: 120, h: 100, icon, iconSize: 70, onPress: () => this.change(delta) }).setDepth(40);
      this.buttons.push(b);
      return b;
    };
    if (two) {
      mk(-dx, -165, 'up', 10);
      this.first_ = mk(dx, -165, 'up', 1);
      mk(-dx, 165, 'down', -10);
      mk(dx, 165, 'down', -1);
    } else {
      this.first_ = mk(0, -165, 'up', 1);
      mk(0, 165, 'down', -1);
    }
    this.validateButton = makeValidate(scene, 1400, onValidate);
  }

  private change(d: number): void {
    const before = this.v;
    const next = Phaser.Math.Clamp((this.v ?? 0) + d, 0, this.max);
    this.show(next, d);
    if (next !== before) {
      services.sfx.step(d > 0);
      void services.voice.sayNumber(next);
    }
  }

  /** Les roues tournent : celle qui change défile vers le haut ou vers le bas. */
  private show(v: number | null, dir = 0): void {
    const old = this.v;
    this.v = v;
    const digits = this.drums.length === 2 ? [Math.floor((v ?? 0) / 10), (v ?? 0) % 10] : [v ?? 0];
    const oldDigits = this.drums.length === 2 ? [Math.floor((old ?? 0) / 10), (old ?? 0) % 10] : [old ?? 0];
    this.drums.forEach((t, i) => {
      t.setText(String(digits[i])).setAlpha(v === null ? 0.35 : 1);
      if (v !== null && (digits[i] !== oldDigits[i] || old === null)) {
        this.scene.tweens.add({ targets: t, y: { from: dir >= 0 ? 40 : -32, to: 4 }, duration: 170, ease: 'Cubic.Out' });
      }
    });
  }

  onDigit(d: number): void {
    const now = performance.now();
    const joined = this.v !== null && this.v < 10 && now - this.lastDigitAt < 1500 ? this.v * 10 + d : d;
    this.lastDigitAt = now;
    const v = joined <= this.max ? joined : Math.min(d, this.max);
    this.show(v, 1);
    void services.voice.sayNumber(v);
  }

  onErase(): void {
    this.show(this.v !== null && this.v >= 10 ? Math.floor(this.v / 10) : null, -1);
  }

  value(): number | null {
    return this.v;
  }

  set(v: number): void {
    this.show(v, 1);
  }

  focusables(): Focusable[] {
    return [...this.buttons, this.validateButton];
  }

  first(): Focusable {
    return this.first_;
  }

  destroy(): void {
    for (const b of this.buttons) b.destroy();
    this.validateButton.destroy();
    this.casing.destroy();
  }
}
