import * as Phaser from 'phaser';
import { C, textStyle } from '../config';
import { CONTROLS_PLAN, orbitWindow, type Profile } from '../math/families';
import { services } from '../services';
import { fit } from './assets';
import { tweenAsync } from './tweens';
import { drawTensUnits } from './widgets';
import { drawCheck, pill } from './widgets-c2';
import { drawControl } from './widgets-c4';

/**
 * Chapitre 5.
 * - C5.1, il faut rentrer à la maison : la planchette des vérifications du départ (pages de dix lignes).
 * - C5.2, les retrouvailles : la piste de balises sur l'orbite, d'Eagle au repère d'amarrage de Columbia.
 * - C5.3, le grand silence : l'onde radio de la simulation, faite de morceaux (une vague entière = dix morceaux).
 */

const wait = (ms: number) => services.clock.wait(ms);
type G = Phaser.GameObjects.Graphics;
type Img = Phaser.GameObjects.Image;
type Pt = { x: number; y: number };

const PAPER = 0xfbf6ea;
const BOARD = 0x8a5a3a;

// ---------------------------------------------------------------------------
// C5.1 — La planchette des vérifications
// ---------------------------------------------------------------------------

export class Clipboard extends Phaser.GameObjects.Container {
  readonly total: number;
  checked: number;
  private lines: Pt[] = [];
  private lineH: number;
  private pageW: number;
  private ticks: G;
  private marks: G;
  private extras: Phaser.GameObjects.GameObject[] = [];
  private readonly grouped: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, profile: Profile, total: number, deja: number) {
    super(scene, x, y);
    this.total = total;
    this.checked = deja;
    this.grouped = profile === 'fin';
    const pages = profile === 'debut' ? 1 : Math.ceil(total / 10);
    const perPage = profile === 'debut' ? total : 10;
    this.lineH = profile === 'debut' ? 62 : profile === 'milieu' ? 48 : 42;
    this.pageW = profile === 'debut' ? 420 : profile === 'milieu' ? 320 : 196;
    const gap = 22;
    const innerW = pages * this.pageW + (pages - 1) * gap;
    const innerH = perPage * this.lineH + 30;
    const g = scene.add.graphics();
    // La planchette, sa pince, puis les pages de dix lignes.
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(-innerW / 2 - 36 + 10, -innerH / 2 - 50 + 12, innerW + 72, innerH + 86, 26);
    g.fillStyle(BOARD, 1);
    g.fillRoundedRect(-innerW / 2 - 36, -innerH / 2 - 50, innerW + 72, innerH + 86, 26);
    g.lineStyle(6, C.ink, 1);
    g.strokeRoundedRect(-innerW / 2 - 36, -innerH / 2 - 50, innerW + 72, innerH + 86, 26);
    for (let p = 0; p < pages; p++) {
      const px = -innerW / 2 + p * (this.pageW + gap);
      const py = -innerH / 2 - 14;
      g.fillStyle(PAPER, 1);
      g.fillRect(px, py, this.pageW, innerH);
      g.lineStyle(3, C.ink, 1);
      g.strokeRect(px, py, this.pageW, innerH);
      for (let i = 0; i < perPage; i++) {
        const n = p * perPage + i;
        if (n >= total) break;
        const cy = py + 15 + this.lineH * (i + 0.5);
        g.lineStyle(2, 0xb9c7d6, 1);
        g.lineBetween(px + 10, cy + this.lineH / 2, px + this.pageW - 10, cy + this.lineH / 2);
        // Le pictogramme de l'équipement, puis la case à cocher.
        const pic = scene.add.graphics().setPosition(px + this.lineH * 0.55, cy);
        drawControl(pic, CONTROLS_PLAN[n % CONTROLS_PLAN.length], this.lineH * 0.72);
        this.add(pic);
        const bx = px + this.pageW - this.lineH * 0.6;
        g.fillStyle(C.white, 1);
        g.fillRect(bx - this.lineH * 0.3, cy - this.lineH * 0.3, this.lineH * 0.6, this.lineH * 0.6);
        g.lineStyle(3, C.ink, 1);
        g.strokeRect(bx - this.lineH * 0.3, cy - this.lineH * 0.3, this.lineH * 0.6, this.lineH * 0.6);
        this.lines.push({ x: bx, y: cy });
      }
    }
    // La pince en métal.
    g.fillStyle(0xb9bec8, 1);
    g.fillRoundedRect(-90, -innerH / 2 - 70, 180, 50, 14);
    g.lineStyle(5, C.ink, 1);
    g.strokeRoundedRect(-90, -innerH / 2 - 70, 180, 50, 14);
    this.addAt(g, 0);
    this.ticks = scene.add.graphics();
    this.marks = scene.add.graphics();
    this.add([this.ticks, this.marks]);
    for (let i = 0; i < deja; i++) this.drawTick(this.ticks, i, C.green);
    scene.add.existing(this);
  }

  get remaining(): number {
    return this.total - this.checked;
  }

  private drawTick(g: G, i: number, color: number): void {
    const p = this.lines[i];
    drawCheck(g, p.x, p.y, this.lineH * 0.75, color);
  }

  /** Coche `n` lignes après celles déjà cochées (orange : la proposition de l'enfant). Renvoie le nombre de coches en trop. */
  async tick(n: number, color: number): Promise<number> {
    const target = color === C.green ? this.ticks : this.marks;
    const fits = Math.min(n, this.remaining);
    const step = this.grouped ? 45 : 110;
    for (let k = 0; k < fits; k++) {
      this.drawTick(target, this.checked + k, color);
      services.sfx.pop(k % 10);
      await wait(step);
    }
    if (color === C.green) this.checked += fits;
    const extra = n - fits;
    if (extra > 0) {
      // Les coches qui n'ont plus de ligne sortent de la planchette, à droite.
      const b = this.getBounds();
      const x0 = b.right - this.x + 50;
      const shown = Math.min(extra, 10);
      for (let k = 0; k < shown; k++) {
        const t = this.scene.add.graphics();
        drawCheck(t, x0 + (k % 2) * 46, -150 + Math.floor(k / 2) * 52, 46, C.orange);
        this.add(t);
        this.extras.push(t);
        services.sfx.pop(k);
        await wait(step);
      }
      const label = pill(this.scene, x0 + 24, -210, `+${extra}`, C.orange);
      this.add(label);
      this.extras.push(label);
    }
    return extra;
  }

  /** Retire la proposition de l'enfant (coches orange et coches en trop). */
  clearTemp(): void {
    this.marks.clear();
    for (const e of this.extras) e.destroy();
    this.extras = [];
  }

  /** Aide : les lignes encore sans coche sont entourées. */
  circleUnchecked(): void {
    this.marks.clear();
    this.marks.lineStyle(5, C.mint, 1);
    for (let i = this.checked; i < this.total; i++) {
      const p = this.lines[i];
      this.marks.strokeRoundedRect(p.x - this.lineH * 0.42, p.y - this.lineH * 0.42, this.lineH * 0.84, this.lineH * 0.84, 8);
    }
  }

  /** Aide : on compte les lignes sans coche (une page entière sans coche compte pour dix en fin de CP). */
  async countUnchecked(): Promise<void> {
    this.marks.clear();
    this.marks.lineStyle(5, C.mint, 1);
    let count = 0;
    let i = this.checked;
    while (i < this.total) {
      if (this.grouped && i % 10 === 0 && i + 10 <= this.total) {
        const a = this.lines[i];
        const b = this.lines[i + 9];
        this.marks.strokeRoundedRect(a.x - this.pageW + 20, a.y - this.lineH / 2, this.pageW - 10, b.y - a.y + this.lineH, 10);
        count += 10;
        i += 10;
        services.sfx.pop(count / 10);
        await services.voice.sayNumber(count);
        await wait(200);
        continue;
      }
      const p = this.lines[i];
      this.marks.strokeRoundedRect(p.x - this.lineH * 0.42, p.y - this.lineH * 0.42, this.lineH * 0.84, this.lineH * 0.84, 8);
      count++;
      i++;
      services.sfx.pop(count % 10);
      await services.voice.sayNumber(count);
      await wait(120);
    }
  }
}

// ---------------------------------------------------------------------------
// C5.2 — La piste de balises sur l'orbite
// ---------------------------------------------------------------------------

export class OrbitTrack extends Phaser.GameObjects.Container {
  readonly lo: number;
  readonly hi: number;
  private pos = new Map<number, Pt>();
  private r: number;
  private marks: G;
  private extras: Phaser.GameObjects.GameObject[] = [];
  readonly eagle: Img;
  readonly columbia: Img;
  private ring: G;
  private at: number;
  private readonly grouped: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, profile: Profile, from: number, to: number) {
    super(scene, x, y);
    const { lo, hi } = orbitWindow(profile, from);
    this.lo = lo;
    this.hi = hi;
    this.at = from;
    this.grouped = profile === 'fin';
    const n = hi - lo;
    this.r = profile === 'debut' ? 26 : profile === 'milieu' ? 19 : 15;
    // Un arc d'orbite au-dessus de la Lune (en bas du cadre).
    const g = scene.add.graphics();
    g.fillStyle(0x9c9a94, 1);
    g.fillEllipse(0, 330, 1000, 150);
    g.fillStyle(0xc4c1b9, 0.6);
    g.fillEllipse(-90, 290, 380, 34);
    const rx = 520;
    const ry = 330;
    const cy = 240;
    const a0 = Math.PI + 0.22;
    const a1 = 2 * Math.PI - 0.22;
    g.lineStyle(4, C.mint, 0.35);
    g.beginPath();
    for (let k = 0; k <= 60; k++) {
      const a = a0 + ((a1 - a0) * k) / 60;
      const px = rx * Math.cos(a);
      const py = cy + ry * Math.sin(a);
      if (k === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
    this.add(g);
    for (let v = lo; v <= hi; v++) {
      const a = a0 + ((a1 - a0) * (v - lo)) / n;
      const p = { x: rx * Math.cos(a), y: cy + ry * Math.sin(a) };
      this.pos.set(v, p);
      const ten = this.grouped && v % 10 === 0;
      const rr = ten ? this.r + 6 : this.r;
      g.fillStyle(ten ? C.mustard : 0x1d4260, 1);
      g.fillCircle(p.x, p.y, rr);
      g.lineStyle(3, C.mint, 0.9);
      g.strokeCircle(p.x, p.y, rr);
      // Les numéros sous l'arc (côté Lune) ; en fin de CP, les dizaines plus grosses.
      const size = profile === 'debut' ? 34 : profile === 'milieu' ? 26 : ten ? 28 : 20;
      const ox = (p.x / rx) * (rr + 20);
      const oy = ((p.y - cy) / ry) * (rr + 20);
      this.add(scene.add.text(p.x - ox, p.y - oy, String(v), textStyle(size, { color: ten ? '#f2c14e' : '#f6ecd9' })).setOrigin(0.5));
    }
    this.marks = scene.add.graphics();
    this.add(this.marks);
    // Le repère d'amarrage de Columbia (un anneau), Columbia au-dessus ; Eagle sur sa case.
    const t = this.pos.get(to)!;
    this.ring = scene.add.graphics().setPosition(t.x, t.y);
    this.ring.lineStyle(7, C.mustard, 1);
    this.ring.strokeCircle(0, 0, this.r + 14);
    this.add(this.ring);
    scene.tweens.add({ targets: this.ring, scale: 1.15, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.columbia = fit(scene.add.image(t.x, t.y - this.r - 56, 'columbia'), 170, 80);
    const f = this.pos.get(from)!;
    this.eagle = fit(scene.add.image(f.x, f.y - this.r - 56, 'eagle_montee'), 130, 112);
    this.add([this.columbia, this.eagle]);
    scene.add.existing(this);
  }

  private place(v: number): Pt {
    const clamped = Phaser.Math.Clamp(v, this.lo, this.hi);
    const p = this.pos.get(clamped)!;
    return { x: p.x, y: p.y - this.r - 56 };
  }

  /** Eagle avance de `a` cases depuis sa case de départ, et reste où il s'arrête. */
  async advance(from: number, a: number, to: number): Promise<{ stop: number; missing: number; extra: number }> {
    this.clearTemp();
    if (this.at !== from) await this.returnTo(from);
    const stop = from + a;
    const step = this.grouped ? 70 : 150;
    for (let v = from + 1; v <= Math.min(stop, this.hi); v++) {
      const p = this.place(v);
      services.sfx.notch();
      await tweenAsync(this.scene, { targets: this.eagle, x: p.x, y: p.y, duration: step, ease: 'Sine.Out' });
      this.at = v;
    }
    const missing = Math.max(0, to - stop);
    const extra = Math.max(0, stop - to);
    this.marks.clear();
    if (missing > 0) {
      // Les cases qui manquent, en pointillés orange.
      this.marks.lineStyle(5, C.orange, 1);
      for (let v = stop + 1; v <= to; v++) {
        const p = this.pos.get(v)!;
        for (let k = 0; k < 8; k += 2) this.marks.beginPath(), this.marks.arc(p.x, p.y, this.r + 7, (k * Math.PI) / 4, ((k + 1) * Math.PI) / 4), this.marks.strokePath();
      }
    } else if (extra > 0) {
      // Le dépassement : les cases au-delà de Columbia, en orange plein.
      this.marks.fillStyle(C.orange, 0.85);
      for (let v = to + 1; v <= Math.min(stop, this.hi); v++) {
        const p = this.pos.get(v)!;
        this.marks.fillCircle(p.x, p.y, this.r - 2);
      }
      if (stop > this.hi) {
        const p = this.pos.get(this.hi)!;
        const label = pill(this.scene, p.x - 40, p.y - 140, `+${stop - this.hi}`, C.orange);
        this.add(label);
        this.extras.push(label);
      }
    }
    return { stop, missing, extra };
  }

  /** Eagle revient sur sa case de départ (avant un nouvel essai). */
  async returnTo(from: number): Promise<void> {
    this.marks.clear();
    const p = this.place(from);
    services.sfx.whoosh();
    await tweenAsync(this.scene, { targets: this.eagle, x: p.x, y: p.y, duration: 450, ease: 'Sine.InOut' });
    this.at = from;
  }

  clearTemp(): void {
    for (const e of this.extras) e.destroy();
    this.extras = [];
  }

  /** Aide : le chemin d'Eagle jusqu'à Columbia s'allume. */
  showPath(from: number, to: number): void {
    this.marks.clear();
    this.marks.lineStyle(6, C.mint, 1);
    for (let v = from + 1; v <= to; v++) {
      const p = this.pos.get(v)!;
      this.marks.strokeCircle(p.x, p.y, this.r + 7);
    }
  }

  /** Aide : on compte les cases du chemin (par dizaines entières en fin de CP). */
  async countPath(from: number, to: number): Promise<void> {
    this.marks.clear();
    this.marks.lineStyle(6, C.mint, 1);
    let count = 0;
    let v = from;
    while (v < to) {
      if (this.grouped && v % 10 === 0 && v + 10 <= to) {
        for (let k = v + 1; k <= v + 10; k++) {
          const p = this.pos.get(k)!;
          this.marks.strokeCircle(p.x, p.y, this.r + 7);
        }
        v += 10;
        count += 10;
        services.sfx.pop(count / 10);
        await services.voice.sayNumber(count);
        await wait(200);
        continue;
      }
      v++;
      count++;
      const p = this.pos.get(v)!;
      this.marks.strokeCircle(p.x, p.y, this.r + 7);
      services.sfx.pop(count % 10);
      await services.voice.sayNumber(count);
      await wait(120);
    }
  }

  /** Bonne réponse : Eagle arrive sur le repère, l'anneau passe au vert. */
  async docked(): Promise<void> {
    this.scene.tweens.killTweensOf(this.ring);
    this.ring.setScale(1).clear();
    this.ring.lineStyle(8, C.green, 1);
    this.ring.strokeCircle(0, 0, this.r + 14);
    await tweenAsync(this.scene, { targets: this.eagle, y: this.eagle.y - 20, duration: 250, yoyo: true, ease: 'Sine.Out' });
  }
}

// ---------------------------------------------------------------------------
// C5.3 — L'onde radio de la simulation, faite de morceaux
// ---------------------------------------------------------------------------

const WAVE_W = 1000;
const WAVE_A = 70;

export class RadioWave extends Phaser.GameObjects.Container {
  readonly total: number;
  have = 0;
  private period: number;
  private pieceW: number;
  private base: G;
  private full: G;
  private marks: G;
  private extras: Phaser.GameObjects.GameObject[] = [];
  private piles: Phaser.GameObjects.Container[] = [];
  private readonly grouped: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, profile: Profile, total: number) {
    super(scene, x, y);
    this.total = total;
    this.grouped = profile === 'fin';
    // Une vague entière = dix morceaux (au début de CP, toute l'onde forme une seule vague).
    this.period = profile === 'debut' ? total : 10;
    this.pieceW = WAVE_W / total;
    this.base = scene.add.graphics();
    this.full = scene.add.graphics();
    this.marks = scene.add.graphics();
    this.add([this.base, this.full, this.marks]);
    // L'onde attendue, en pointillés gris ; une encoche sous chaque vague entière.
    for (let i = 0; i < total; i++) this.drawPiece(this.base, i, 0x59606d, 5, true);
    if (this.period < total) {
      this.base.lineStyle(4, C.mint, 0.6);
      for (let k = this.period; k < total; k += this.period) {
        const px = this.xOf(k);
        this.base.lineBetween(px, WAVE_A + 26, px, WAVE_A + 46);
      }
    }
    scene.add.existing(this);
  }

  private xOf(i: number): number {
    return -WAVE_W / 2 + i * this.pieceW;
  }

  private yAt(t: number): number {
    return -WAVE_A * Math.sin((2 * Math.PI * t) / this.period);
  }

  /** Le morceau `i` (en pièce de l'onde) ; au-delà de la fin, il « déborde » à droite. */
  private drawPiece(g: G, i: number, color: number, width: number, dotted = false): void {
    g.lineStyle(width, color, 1);
    const steps = 6;
    const gapFrac = dotted ? 0.35 : 0.08;
    g.beginPath();
    for (let k = 0; k <= steps; k++) {
      const t = i + gapFrac / 2 + ((1 - gapFrac) * k) / steps;
      const px = this.xOf(0) + t * this.pieceW;
      const py = this.yAt(t);
      if (k === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
  }

  /** Des morceaux s'ajoutent (vert : réparés ; orange : la proposition de l'enfant). Renvoie ceux en trop. */
  async addPieces(n: number, color: number): Promise<number> {
    const target = color === C.green ? this.full : this.marks;
    const fits = Math.min(n, this.total - this.have);
    const step = this.grouped ? 35 : 110;
    for (let k = 0; k < fits; k++) {
      this.drawPiece(target, this.have + k, color === C.green ? C.mint : color, 10);
      services.sfx.pop(k % 10);
      await wait(step);
    }
    if (color === C.green) this.have += fits;
    const extra = n - fits;
    if (extra > 0) {
      // L'onde déborde : les morceaux en trop sortent du cadre de l'onde, à droite.
      for (let k = 0; k < Math.min(extra, 10); k++) {
        const t = this.scene.add.graphics();
        t.fillStyle(C.orange, 1);
        t.fillRoundedRect(WAVE_W / 2 + 30 + (k % 5) * 26, -60 + Math.floor(k / 5) * 40, 18, 30, 6);
        this.add(t);
        this.extras.push(t);
        services.sfx.pop(k);
        await wait(step);
      }
      const label = pill(this.scene, WAVE_W / 2 + 90, -130, `+${extra}`, C.orange);
      this.add(label);
      this.extras.push(label);
    }
    return extra;
  }

  /** Les morceaux déjà là apparaissent d'un coup. */
  setHave(n: number): void {
    this.full.clear();
    this.have = Math.min(n, this.total);
    for (let i = 0; i < this.have; i++) this.drawPiece(this.full, i, C.mint, 10);
  }

  clearTemp(): void {
    this.marks.clear();
    for (const e of this.extras) e.destroy();
    this.extras = [];
  }

  /** Aide : les morceaux qui manquent sont soulignés. */
  showMissing(): void {
    this.marks.clear();
    for (let i = this.have; i < this.total; i++) this.drawPiece(this.marks, i, C.mustard, 6, true);
  }

  /** Aide : on compte les morceaux qui manquent (une vague entière compte pour dix en fin de CP). */
  async countMissing(): Promise<void> {
    this.marks.clear();
    let count = 0;
    let i = this.have;
    while (i < this.total) {
      if (this.grouped && i % this.period === 0 && i + this.period <= this.total) {
        for (let k = i; k < i + this.period; k++) this.drawPiece(this.marks, k, C.mustard, 8);
        i += this.period;
        count += this.period;
        services.sfx.pop(count / 10);
        await services.voice.sayNumber(count);
        await wait(200);
        continue;
      }
      this.drawPiece(this.marks, i, C.mustard, 8);
      i++;
      count++;
      services.sfx.pop(count % 10);
      await services.voice.sayNumber(count);
      await wait(120);
    }
  }

  // --- Étape « somme » (fin de CP) : deux tas de morceaux apportés par l'équipe ---

  showPiles(a: number, b: number): void {
    this.clearPiles();
    for (const [i, v] of [a, b].entries()) {
      const c = this.scene.add.container(i === 0 ? -260 : 260, 300);
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x0d1f30, 0.9);
      bg.fillRoundedRect(-220, -110, 440, 220, 24);
      bg.lineStyle(4, C.mint, 0.8);
      bg.strokeRoundedRect(-220, -110, 440, 220, 24);
      c.add(bg);
      c.add(drawTensUnits(this.scene, v, 260).setPosition(0, 20).setScale(1.5));
      c.add(this.scene.add.text(0, -76, String(v), textStyle(44)).setOrigin(0.5));
      this.add(c);
      this.piles.push(c);
    }
  }

  /** Aide : les deux tas, rangés l'un après l'autre, sont entourés. */
  highlightPiles(): void {
    for (const p of this.piles) this.scene.tweens.add({ targets: p, scale: 1.08, duration: 220, yoyo: true, repeat: 1 });
  }

  /** Aide : on compte à partir du premier tas. */
  async countPiles(a: number, b: number): Promise<void> {
    this.highlightPiles();
    await services.voice.sayNumber(a);
    await wait(250);
    let count = a;
    let rest = b;
    while (rest > 0) {
      const d = rest >= 10 && this.grouped ? 10 : 1;
      count += d;
      rest -= d;
      services.sfx.pop(count % 10);
      await services.voice.sayNumber(count);
      await wait(150);
    }
  }

  /** Les deux tas rejoignent l'onde : leurs morceaux la remplissent depuis le début. */
  async mergePiles(n: number): Promise<void> {
    const piles = this.piles;
    this.piles = [];
    await tweenAsync(this.scene, { targets: piles, y: 0, alpha: 0, scale: 0.4, duration: 450, ease: 'Sine.In' });
    for (const p of piles) p.destroy();
    await this.addPieces(n, C.green);
  }

  shakePiles(): void {
    for (const p of this.piles) this.scene.tweens.add({ targets: p, angle: { from: -4, to: 4 }, duration: 80, yoyo: true, repeat: 3, onComplete: () => p.setAngle(0) });
  }

  clearPiles(): void {
    for (const p of this.piles) p.destroy();
    this.piles = [];
  }

  /** Le signal revient : toute l'onde s'illumine et ondule. */
  async alive(): Promise<void> {
    this.full.clear();
    for (let i = 0; i < this.total; i++) this.drawPiece(this.full, i, C.green, 12);
    await tweenAsync(this.scene, { targets: [this.full, this.base], scaleY: 1.25, duration: 300, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
  }
}
