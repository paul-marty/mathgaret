import * as Phaser from 'phaser';
import { C, textStyle } from '../config';
import { makeValidate, Option, type AnswerUI } from '../engine/answers';
import type { Profile, SystemKind } from '../math/families';
import { services } from '../services';
import { Button } from './Button';
import type { Focusable } from './focus';
import { drawCheck, pill } from './widgets-c2';

/**
 * Chapitre 3.
 * - C3.2, les dernières vérifications : un tableau de contrôle par système, chacun avec son objet
 *   (cadrans de navigation, prises des lignes radio, batteries, voyants de l'ordinateur de guidage) ;
 *   l'ordinateur de guidage se règle sur son propre clavier.
 * - C3.3, le signal mystérieux : la réserve d'énergie de la simulation et trois batteries au choix.
 */

const wait = (ms: number) => services.clock.wait(ms);
type G = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };

const STEEL = 0x5b6577;
const STEEL_DARK = 0x3d4452;
const SOCKET = 0x262c38;
const ENERGY = C.mustard;

// ---------------------------------------------------------------------------
// C3.2 — Un contrôle (cadran, prise, batterie ou voyant) et le tableau d'un système
// ---------------------------------------------------------------------------

interface BoardGeom {
  cols: number;
  size: number;
  gap: number;
  /** Écart supplémentaire après le cinquième contrôle d'une ligne de dix. */
  groupGap: number;
}

const BOARD: Record<Profile, BoardGeom> = {
  debut: { cols: 5, size: 104, gap: 24, groupGap: 0 },
  milieu: { cols: 10, size: 68, gap: 14, groupGap: 30 },
  fin: { cols: 10, size: 50, gap: 10, groupGap: 26 },
};

export type CheckState = 'pending' | 'done';

/** Un contrôle du tableau. Son allure dépend du système ; « fait » se voit aussi à la forme (P15). */
export class CheckItem extends Phaser.GameObjects.Container {
  status: CheckState = 'pending';
  private shape: G;
  private needle: G | null = null;
  private ring: G;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private kind: SystemKind,
    private size: number,
  ) {
    super(scene, x, y);
    this.ring = scene.add.graphics();
    this.shape = scene.add.graphics();
    this.add([this.ring, this.shape]);
    if (kind === 'navigation') {
      this.needle = scene.add.graphics();
      const r = size * 0.4;
      this.needle.lineStyle(Math.max(3, size * 0.08), C.ink, 1);
      this.needle.lineBetween(0, 0, r * 0.85, 0);
      this.needle.fillStyle(C.brick, 1);
      this.needle.fillCircle(0, 0, Math.max(3, size * 0.07));
      this.add(this.needle);
    }
    this.draw();
  }

  /** Repère autour du contrôle : orange (à corriger), menthe (aide) ou rien. */
  mark(color: number | null): void {
    const s = this.size;
    this.ring.clear();
    if (color === null) return;
    this.ring.lineStyle(Math.max(4, s * 0.09), color, 1);
    this.ring.strokeRoundedRect(-s * 0.56, -s * 0.56, s * 1.12, s * 1.12, s * 0.2);
  }

  /** Passe à l'état demandé, avec une petite animation propre au système. */
  async set(state: CheckState, animate = true): Promise<void> {
    if (this.status === state) return;
    this.status = state;
    this.draw();
    if (!animate) return;
    if (this.needle) {
      // Le cadran : l'aiguille rejoint la zone verte.
      this.needle.setAngle(state === 'done' ? 160 : -40);
      await tween(this.scene, { targets: this.needle, angle: state === 'done' ? -40 : 160, duration: 260, ease: 'Back.Out' });
    } else {
      this.shape.setScale(0.6);
      await tween(this.scene, { targets: this.shape, scale: 1, duration: 200, ease: 'Back.Out' });
    }
  }

  private draw(): void {
    const g = this.shape;
    const s = this.size;
    const done = this.status === 'done';
    g.clear();
    const lw = Math.max(3, s * 0.06);
    switch (this.kind) {
      case 'navigation': {
        // Cadran : éteint (gris, aiguille au repos) ou vérifié (allumé, aiguille dans la zone verte).
        const r = s * 0.46;
        g.fillStyle(done ? 0xe4f6e2 : 0x9aa0ab, 1);
        g.fillCircle(0, 0, r);
        g.lineStyle(r * 0.28, done ? C.green : 0x7d838f, 1);
        g.beginPath();
        g.arc(0, 0, r * 0.72, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(-10));
        g.strokePath();
        g.lineStyle(lw, C.ink, 1);
        g.strokeCircle(0, 0, r);
        this.needle?.setAngle(done ? -40 : 160);
        break;
      }
      case 'communications': {
        // Prise : vide (sombre), ou branchée (fiche rouge, câble, petite lampe verte).
        g.fillStyle(STEEL_DARK, 1);
        g.fillRoundedRect(-s * 0.46, -s * 0.46, s * 0.92, s * 0.92, s * 0.16);
        g.fillStyle(SOCKET, 1);
        g.fillCircle(0, s * 0.06, s * 0.27);
        g.lineStyle(lw, C.grey, 1);
        g.strokeCircle(0, s * 0.06, s * 0.27);
        if (done) {
          g.lineStyle(s * 0.12, C.ink, 1);
          g.beginPath();
          g.moveTo(0, s * 0.06);
          g.lineTo(s * 0.18, -s * 0.3);
          g.lineTo(s * 0.4, -s * 0.5);
          g.strokePath();
          g.fillStyle(C.brick, 1);
          g.fillCircle(0, s * 0.06, s * 0.21);
          g.lineStyle(lw, C.ink, 1);
          g.strokeCircle(0, s * 0.06, s * 0.21);
          g.fillStyle(C.green, 1);
          g.fillCircle(-s * 0.3, -s * 0.3, s * 0.09);
        }
        break;
      }
      case 'alimentation': {
        // Batterie : vide, ou pleine (verte, avec un éclair).
        const w = s * 0.56;
        const h = s * 0.84;
        g.fillStyle(C.ink, 1);
        g.fillRect(-w * 0.22, -h / 2 - s * 0.08, w * 0.44, s * 0.1);
        g.fillStyle(done ? C.green : SOCKET, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, s * 0.08);
        if (done) {
          g.fillStyle(C.white, 1);
          g.fillPoints(
            [
              { x: s * 0.06, y: -h * 0.36 },
              { x: -s * 0.14, y: s * 0.04 },
              { x: 0, y: s * 0.04 },
              { x: -s * 0.06, y: h * 0.36 },
              { x: s * 0.14, y: -s * 0.04 },
              { x: 0, y: -s * 0.04 },
            ],
            true,
          );
        }
        g.lineStyle(lw, C.ink, 1);
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, s * 0.08);
        break;
      }
      case 'guidage': {
        // Voyant de test : éteint, ou allumé (vert, avec une coche).
        if (done) {
          g.fillStyle(C.mint, 0.35);
          g.fillCircle(0, 0, s * 0.55);
        }
        g.fillStyle(done ? C.green : 0x3b4152, 1);
        g.fillRoundedRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8, s * 0.14);
        g.lineStyle(lw, C.ink, 1);
        g.strokeRoundedRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8, s * 0.14);
        if (done) drawCheck(g, 0, 0, s * 0.5, C.white);
        break;
      }
    }
  }
}

function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => scene.tweens.add({ ...config, onComplete: () => resolve() }));
}

/** Pictogramme d'un système (en tête du tableau). */
function drawSystemIcon(g: G, kind: SystemKind, x: number, y: number, s: number): void {
  g.fillStyle(C.cream, 1);
  g.fillCircle(x, y, s / 2);
  g.lineStyle(5, C.ink, 1);
  g.strokeCircle(x, y, s / 2);
  g.lineStyle(6, C.ink, 1);
  g.fillStyle(C.ink, 1);
  switch (kind) {
    case 'navigation':
      g.fillStyle(C.brick, 1);
      g.fillTriangle(x - 8, y, x + 8, y, x, y - s * 0.34);
      g.fillStyle(C.ink, 1);
      g.fillTriangle(x - 8, y, x + 8, y, x, y + s * 0.34);
      break;
    case 'communications':
      g.lineBetween(x, y + s * 0.32, x, y - s * 0.1);
      g.fillCircle(x, y - s * 0.12, 7);
      g.beginPath();
      g.arc(x, y - s * 0.12, s * 0.2, Phaser.Math.DegToRad(-150), Phaser.Math.DegToRad(-30));
      g.strokePath();
      g.beginPath();
      g.arc(x, y - s * 0.12, s * 0.32, Phaser.Math.DegToRad(-145), Phaser.Math.DegToRad(-35));
      g.strokePath();
      break;
    case 'alimentation':
      g.fillStyle(C.mustard, 1);
      g.fillPoints(
        [
          { x: x + s * 0.08, y: y - s * 0.34 },
          { x: x - s * 0.16, y: y + s * 0.04 },
          { x: x, y: y + s * 0.04 },
          { x: x - s * 0.08, y: y + s * 0.34 },
          { x: x + s * 0.16, y: y - s * 0.04 },
          { x: x, y: y - s * 0.04 },
        ],
        true,
      );
      break;
    case 'guidage':
      g.fillStyle(STEEL_DARK, 1);
      g.fillRect(x - s * 0.22, y - s * 0.22, s * 0.44, s * 0.44);
      for (let i = -1; i <= 1; i++) {
        g.lineBetween(x + i * s * 0.12, y - s * 0.34, x + i * s * 0.12, y - s * 0.22);
        g.lineBetween(x + i * s * 0.12, y + s * 0.22, x + i * s * 0.12, y + s * 0.34);
      }
      break;
  }
}

/**
 * Le tableau de contrôle d'un système (C3.2) : `total` contrôles, dont `deja` déjà faits (verts).
 * L'enfant dit combien il en reste ; la réponse se voit sur le tableau.
 */
export class CheckBoard extends Phaser.GameObjects.Container {
  readonly items: CheckItem[] = [];
  private lamp: G;
  private ghosts: G;
  private extras: Phaser.GameObjects.GameObject[] = [];
  private geom: BoardGeom;
  private left: number;
  private top: number;
  readonly panelW: number;
  readonly panelH: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly kind: SystemKind,
    profile: Profile,
    readonly total: number,
    readonly deja: number,
  ) {
    super(scene, x, y);
    const g = (this.geom = BOARD[profile]);
    const rows = Math.ceil(total / g.cols);
    const gridW = g.cols * (g.size + g.gap) - g.gap + (g.cols === 10 ? g.groupGap : 0);
    const gridH = rows * (g.size + g.gap) - g.gap;
    this.panelW = Math.max(560, gridW + 120);
    this.panelH = gridH + 230;
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.25);
    bg.fillRoundedRect(-this.panelW / 2 + 8, -this.panelH / 2 + 12, this.panelW, this.panelH, 30);
    bg.fillStyle(STEEL, 1);
    bg.fillRoundedRect(-this.panelW / 2, -this.panelH / 2, this.panelW, this.panelH, 30);
    bg.lineStyle(8, C.ink, 1);
    bg.strokeRoundedRect(-this.panelW / 2, -this.panelH / 2, this.panelW, this.panelH, 30);
    // Rivets dans les coins, plaque sombre sous les contrôles.
    bg.fillStyle(0xaab3c2, 1);
    for (const [rx, ry] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      bg.fillCircle(rx * (this.panelW / 2 - 24), ry * (this.panelH / 2 - 24), 7);
    bg.fillStyle(STEEL_DARK, 1);
    bg.fillRoundedRect(-gridW / 2 - 30, -this.panelH / 2 + 130, gridW + 60, gridH + 60, 20);
    drawSystemIcon(bg, kind, -this.panelW / 2 + 80, -this.panelH / 2 + 66, 84);
    this.lamp = scene.add.graphics();
    this.ghosts = scene.add.graphics();
    this.add([bg, this.lamp, this.ghosts]);
    this.setLamp('off');
    this.left = -gridW / 2;
    this.top = -this.panelH / 2 + 160;
    for (let k = 0; k < total; k++) {
      const p = this.slot(k);
      const item = new CheckItem(scene, p.x, p.y, kind, g.size);
      if (k < deja) void item.set('done', false);
      this.items.push(item);
      this.add(item);
    }
    scene.add.existing(this);
  }

  private slot(k: number): Pt {
    const g = this.geom;
    const r = Math.floor(k / g.cols);
    const c = k % g.cols;
    return {
      x: this.left + c * (g.size + g.gap) + (g.cols === 10 && c >= 5 ? g.groupGap : 0) + g.size / 2,
      y: this.top + r * (g.size + g.gap) + g.size / 2,
    };
  }

  /** Lampe d'état du système, en haut à droite : éteinte, orange (à corriger) ou verte (validé). */
  setLamp(state: 'off' | 'orange' | 'green'): void {
    const x = this.panelW / 2 - 70;
    const y = -this.panelH / 2 + 66;
    const g = this.lamp;
    g.clear();
    const color = state === 'green' ? C.green : state === 'orange' ? C.orange : 0x2f3542;
    if (state !== 'off') {
      g.fillStyle(color, 0.35);
      g.fillCircle(x, y, 50);
    }
    g.fillStyle(color, 1);
    g.fillCircle(x, y, 32);
    g.lineStyle(6, C.ink, 1);
    g.strokeCircle(x, y, 32);
    // La forme double la couleur : un point d'exclamation (orange) ou une coche (vert).
    if (state === 'green') drawCheck(g, x, y, 34, C.white);
    if (state === 'orange') {
      g.fillStyle(C.white, 1);
      g.fillRoundedRect(x - 4, y - 18, 8, 22, 3);
      g.fillCircle(x, y + 13, 4.5);
    }
  }

  /** Les contrôles déjà faits clignotent une fois (ils sont nommés dans la consigne). */
  async showDone(): Promise<void> {
    const done = this.items.filter((i) => i.status === 'done');
    await tween(this.scene, { targets: done, scale: 1.15, duration: 180, yoyo: true });
  }

  get pending(): CheckItem[] {
    return this.items.filter((i) => i.status === 'pending');
  }

  /** Réponse fausse : on vérifie `n` contrôles et l'on voit ce qui manque, ou ce qui est en trop. */
  async tryAnswer(n: number): Promise<{ missing: number; extra: number }> {
    const rest = this.total - this.deja;
    const todo = this.items.slice(this.deja, this.deja + Math.min(n, rest));
    for (const [i, item] of todo.entries()) {
      void item.set('done');
      services.sfx.pop(i);
      await wait(130);
    }
    await wait(250);
    if (n < rest) {
      for (const item of this.items.slice(this.deja + n)) item.mark(C.orange);
    } else if (n > rest) {
      // Des contrôles qui n'existent pas : des places fantômes en pointillés orange, après le tableau.
      const g = this.ghosts;
      const s = this.geom.size;
      g.lineStyle(Math.max(3, s * 0.07), C.orange, 1);
      for (let k = this.total; k < this.total + (n - rest); k++) {
        const p = this.slot(k);
        g.strokeRoundedRect(p.x - s * 0.44, p.y - s * 0.44, s * 0.88, s * 0.88, s * 0.16);
      }
      this.extras.push(pill(this.scene, this.panelW / 2 - 70, this.panelH / 2 - 40, `+${n - rest}`, C.orange));
      this.add(this.extras[this.extras.length - 1]);
    }
    this.setLamp('orange');
    return { missing: Math.max(0, rest - n), extra: Math.max(0, n - rest) };
  }

  /** Retour à l'état de la consigne (les contrôles faits par la réponse fausse sont défaits). */
  resetMarks(): void {
    for (const item of this.items.slice(this.deja)) {
      void item.set('pending', false);
      item.mark(null);
    }
    this.ghosts.clear();
    for (const e of this.extras) e.destroy();
    this.extras = [];
    this.setLamp('off');
  }

  /** Aide : les contrôles qui attendent encore sont entourés. */
  showRest(): void {
    for (const item of this.pending) item.mark(C.mint);
  }

  /** Aide : on compte ensemble les contrôles qui attendent. */
  async countRest(): Promise<void> {
    const counter = pill(this.scene, 0, this.panelH / 2 - 40, '0', C.mint);
    this.add(counter);
    for (const [i, item] of this.pending.entries()) {
      item.mark(C.mint);
      (counter.list[1] as Phaser.GameObjects.Text).setText(String(i + 1));
      services.sfx.pop(i);
      void tween(this.scene, { targets: item, scale: 1.2, duration: 150, yoyo: true });
      await services.voice.sayNumber(i + 1);
      await wait(250);
    }
    await wait(500);
    counter.destroy();
  }

  /** Bonne réponse : les contrôles restants se font un à un, la lampe passe au vert. */
  async complete(): Promise<void> {
    this.ghosts.clear();
    for (const item of this.items) item.mark(null);
    const step = Math.max(60, Math.min(220, 2400 / Math.max(1, this.pending.length)));
    for (const [i, item] of this.pending.entries()) {
      void item.set('done');
      if (this.kind === 'communications' || this.kind === 'navigation') services.sfx.notch();
      else services.sfx.pop(i);
      await wait(step);
    }
    await wait(250);
    this.setLamp('green');
    await tween(this.scene, { targets: this, scale: 1.04, duration: 160, yoyo: true });
  }
}

// ---------------------------------------------------------------------------
// C3.2 — Le clavier de l'ordinateur de guidage : on y tape sa réponse
// ---------------------------------------------------------------------------

/** Entre le tableau de contrôle et le Collègue, qui reste visible. */
const PAD_X = 1290;

/** Réponse tapée sur un clavier à chiffres, comme celui de l'ordinateur de guidage. */
export class KeypadAnswer implements AnswerUI<number> {
  validateButton: Button;
  private v: number | null = null;
  private casing: Phaser.GameObjects.Container;
  private display: Phaser.GameObjects.Text;
  private keys: Button[] = [];

  constructor(
    private scene: Phaser.Scene,
    private max: number,
    onValidate: () => void,
    depth = 40,
  ) {
    const cx = PAD_X;
    this.casing = scene.add.container(cx, 0).setDepth(depth - 1);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(-215 + 8, 215, 430, 610, 30);
    g.fillStyle(0x8f97a5, 1);
    g.fillRoundedRect(-215, 205, 430, 610, 30);
    g.lineStyle(8, C.ink, 1);
    g.strokeRoundedRect(-215, 205, 430, 610, 30);
    // Écran à chiffres verts.
    g.fillStyle(0x10261a, 1);
    g.fillRoundedRect(-170, 235, 340, 120, 16);
    g.lineStyle(5, C.ink, 1);
    g.strokeRoundedRect(-170, 235, 340, 120, 16);
    this.display = scene.add.text(0, 297, '– –', textStyle(92, { color: '#7dffa8' })).setOrigin(0.5);
    this.casing.add([g, this.display]);
    const layout: (number | 'effacer')[][] = [
      [7, 8, 9],
      [4, 5, 6],
      [1, 2, 3],
      ['effacer', 0],
    ];
    layout.forEach((row, r) =>
      row.forEach((k, c) => {
        const x = cx + (c - 1) * 128;
        const y = 425 + r * 106;
        const b =
          k === 'effacer'
            ? new Button(scene, { x, y, w: 112, h: 92, icon: 'cross', iconSize: 46, fill: 0xe7c9a8, onPress: () => this.erase() })
            : new Button(scene, { x, y, w: 112, h: 92, text: String(k), textSize: 56, fill: 0xe3e7ee, onPress: () => this.type(k) });
        b.setDepth(depth);
        this.keys.push(b);
      }),
    );
    this.validateButton = makeValidate(scene, cx, onValidate);
  }

  private show(v: number | null): void {
    this.v = v;
    this.display.setText(v === null ? '– –' : String(v));
    this.scene.tweens.add({ targets: this.display, scale: { from: 1.15, to: 1 }, duration: 150 });
  }

  /** Comme une calculatrice : 1 puis 5 font 15 (si le nombre reste possible). */
  private type(d: number): void {
    const joined = this.v !== null && this.v !== 0 && this.v < 10 ? this.v * 10 + d : null;
    const v = joined !== null && joined <= this.max ? joined : d;
    this.show(v);
    services.sfx.step(true);
    void services.voice.sayNumber(v);
  }

  private erase(): void {
    services.sfx.step(false);
    this.show(null);
  }

  onDigit(d: number): void {
    this.type(d);
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
    return [...this.keys, this.validateButton];
  }

  first(): Focusable {
    return this.keys[0];
  }

  destroy(): void {
    for (const k of this.keys) k.destroy();
    this.validateButton.destroy();
    this.casing.destroy();
  }
}

// ---------------------------------------------------------------------------
// C3.3 — La réserve d'énergie de la simulation et les batteries proposées
// ---------------------------------------------------------------------------

interface CellGeom {
  cols: number;
  size: number;
  gap: number;
}

const RESERVE: Record<Profile, CellGeom> = {
  debut: { cols: 10, size: 64, gap: 10 },
  milieu: { cols: 10, size: 56, gap: 9 },
  fin: { cols: 10, size: 40, gap: 7 },
};

/** Une unité d'énergie : un carré jaune avec un éclair (pleine) ou une case vide (utilisée). */
export function drawUnit(g: G, x: number, y: number, s: number, full: boolean): void {
  g.fillStyle(full ? ENERGY : SOCKET, 1);
  g.fillRoundedRect(x - s / 2, y - s / 2, s, s, s * 0.18);
  g.lineStyle(Math.max(2, s * 0.07), C.ink, 1);
  g.strokeRoundedRect(x - s / 2, y - s / 2, s, s, s * 0.18);
  if (full && s >= 30) {
    g.fillStyle(C.white, 0.9);
    g.fillTriangle(x + s * 0.08, y - s * 0.3, x - s * 0.14, y + s * 0.05, x + s * 0.02, y + s * 0.05);
    g.fillTriangle(x - s * 0.06, y + s * 0.3, x + s * 0.14, y - s * 0.05, x - s * 0.02, y - s * 0.05);
  }
}

/** La réserve d'énergie de la simulation : `total` unités en lignes de dix, que les tests consomment. */
export class EnergyReserve extends Phaser.GameObjects.Container {
  /** Unités encore pleines. */
  lit: number;
  private cells: G;
  private marks: G;
  private geom: CellGeom;
  private origin: Pt;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    profile: Profile,
    readonly total: number,
  ) {
    super(scene, x, y);
    this.lit = total;
    const g = (this.geom = RESERVE[profile]);
    const cols = Math.min(g.cols, total);
    const rows = Math.ceil(total / g.cols);
    const w = cols * (g.size + g.gap) - g.gap;
    const h = rows * (g.size + g.gap) - g.gap;
    this.origin = { x: -w / 2 + g.size / 2, y: -h / 2 + g.size / 2 };
    // Grande pile couchée : corps, borne à droite.
    const body = scene.add.graphics();
    body.fillStyle(STEEL_DARK, 1);
    body.fillRoundedRect(-w / 2 - 34, -h / 2 - 30, w + 68, h + 60, 24);
    body.lineStyle(7, C.ink, 1);
    body.strokeRoundedRect(-w / 2 - 34, -h / 2 - 30, w + 68, h + 60, 24);
    body.fillStyle(C.ink, 1);
    body.fillRoundedRect(w / 2 + 34, -26, 26, 52, 8);
    this.cells = scene.add.graphics();
    this.marks = scene.add.graphics();
    this.add([body, this.cells, this.marks]);
    this.redraw();
    scene.add.existing(this);
  }

  private at(k: number): Pt {
    const g = this.geom;
    return { x: this.origin.x + (k % g.cols) * (g.size + g.gap), y: this.origin.y + Math.floor(k / g.cols) * (g.size + g.gap) };
  }

  private redraw(): void {
    this.cells.clear();
    for (let k = 0; k < this.total; k++) {
      const p = this.at(k);
      drawUnit(this.cells, p.x, p.y, this.geom.size, k < this.lit);
    }
  }

  /** Le test consomme `n` unités : elles clignotent en orange, puis se vident (les dernières d'abord). */
  async use(n: number): Promise<void> {
    const from = this.lit - n;
    const s = this.geom.size;
    for (let blink = 0; blink < 2; blink++) {
      this.marks.clear();
      this.marks.lineStyle(Math.max(4, s * 0.1), C.orange, 1);
      for (let k = from; k < this.lit; k++) {
        const p = this.at(k);
        this.marks.strokeRoundedRect(p.x - s / 2 - 4, p.y - s / 2 - 4, s + 8, s + 8, s * 0.2);
      }
      await wait(260);
      this.marks.clear();
      await wait(160);
    }
    const step = Math.max(40, Math.min(160, 1600 / n));
    for (let k = this.lit - 1; k >= from; k--) {
      this.lit = k;
      this.redraw();
      services.sfx.step(false);
      await wait(step);
    }
  }

  /** Repère sur des unités : celles qui restent (aide) ou celles utilisées (erreur). */
  mark(which: 'rest' | 'used', color: number, used = 0): void {
    const s = this.geom.size;
    this.marks.clear();
    this.marks.lineStyle(Math.max(4, s * 0.1), color, 1);
    const [a, b] = which === 'rest' ? [0, this.lit] : [this.lit, this.lit + used];
    for (let k = a; k < b; k++) {
      const p = this.at(k);
      this.marks.strokeRoundedRect(p.x - s / 2 - 4, p.y - s / 2 - 4, s + 8, s + 8, s * 0.2);
    }
  }

  clearMarks(): void {
    this.marks.clear();
  }

  /** Aide : on compte ensemble les unités qui restent. */
  async countRest(): Promise<void> {
    const s = this.geom.size;
    for (let k = 0; k < this.lit; k++) {
      const p = this.at(k);
      this.marks.lineStyle(Math.max(4, s * 0.1), C.mint, 1);
      this.marks.strokeRoundedRect(p.x - s / 2 - 4, p.y - s / 2 - 4, s + 8, s + 8, s * 0.2);
      services.sfx.pop(k);
      await services.voice.sayNumber(k + 1);
      await wait(200);
    }
  }
}

/** Une batterie proposée (C3.3) : son niveau en unités, et son nombre ; lu à voix haute quand on la sélectionne. */
export class BatteryOption extends Option {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly value: number,
    profile: Profile,
    onPress: () => void,
  ) {
    super(scene, x, y, 330, 250, onPress, C.cream);
    const cols = profile === 'debut' ? 5 : 10;
    const size = profile === 'debut' ? 34 : profile === 'milieu' ? 22 : 20;
    const gap = 4;
    const cap = Math.max(cols, Math.ceil(value / cols) * cols);
    const rows = Math.ceil(cap / cols);
    const w = cols * (size + gap) - gap;
    const h = rows * (size + gap) - gap;
    const cy = -30;
    const g = scene.add.graphics();
    g.fillStyle(STEEL_DARK, 1);
    g.fillRoundedRect(-w / 2 - 16, cy - h / 2 - 14, w + 32, h + 28, 14);
    g.lineStyle(5, C.ink, 1);
    g.strokeRoundedRect(-w / 2 - 16, cy - h / 2 - 14, w + 32, h + 28, 14);
    g.fillStyle(C.ink, 1);
    g.fillRoundedRect(w / 2 + 16, cy - 14, 12, 28, 4);
    for (let k = 0; k < cap; k++) {
      const x0 = -w / 2 + (k % cols) * (size + gap) + size / 2;
      const y0 = cy - h / 2 + Math.floor(k / cols) * (size + gap) + size / 2;
      drawUnit(g, x0, y0, size, k < value);
    }
    const t = scene.add.text(0, 88, String(value), textStyle(56, { color: '#3a2a20' })).setOrigin(0.5);
    this.add([g, t]);
    this.finalize();
  }

  /** Arrivée de la sélection : le nombre est lu (l'enfant lit peu). */
  onFocus(): void {
    void services.voice.sayNumber(this.value);
  }
}

/** Écran du test : des chiffres qui défilent (signal étrange), puis se stabilisent sur un nombre. */
export class SignalScreen extends Phaser.GameObjects.Container {
  private text: Phaser.GameObjects.Text;
  private timer: Phaser.Time.TimerEvent | null = null;
  private lamp: G;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const g = scene.add.graphics();
    g.fillStyle(0x0d1f16, 1);
    g.fillRoundedRect(-300, -60, 600, 120, 18);
    g.lineStyle(6, C.ink, 1);
    g.strokeRoundedRect(-300, -60, 600, 120, 18);
    this.text = scene.add.text(-30, 2, '', textStyle(70, { color: '#ffb366' })).setOrigin(0.5);
    this.lamp = scene.add.graphics();
    this.add([g, this.text, this.lamp]);
    this.setLamp(C.orange);
    scene.add.existing(this);
  }

  setLamp(color: number): void {
    this.lamp.clear();
    this.lamp.fillStyle(color, 0.35);
    this.lamp.fillCircle(240, 0, 44);
    this.lamp.fillStyle(color, 1);
    this.lamp.fillCircle(240, 0, 28);
    this.lamp.lineStyle(5, C.ink, 1);
    this.lamp.strokeCircle(240, 0, 28);
  }

  scramble(on: boolean): void {
    this.timer?.remove();
    this.timer = null;
    if (!on) return;
    this.text.setColor('#ffb366');
    this.setLamp(C.orange);
    this.timer = this.scene.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => this.text.setText(String(Math.floor(Math.random() * 90000) + 10000)),
    });
  }

  /** Les chiffres s'arrêtent sur la bonne valeur, le voyant repasse au vert. */
  stabilize(value: number): void {
    this.scramble(false);
    this.text.setText(String(value)).setColor('#7dffa8');
    this.setLamp(C.green);
  }

  override destroy(fromScene?: boolean): void {
    this.timer?.remove();
    super.destroy(fromScene);
  }
}
