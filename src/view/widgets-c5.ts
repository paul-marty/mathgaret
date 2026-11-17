import * as Phaser from 'phaser';
import { C, textStyle } from '../config';
import { Option } from '../engine/answers';
import type { LoadKind, Profile } from '../math/families';
import { services } from '../services';
import { fit, type ImageId } from './assets';
import { tweenAsync } from './tweens';
import { drawTensUnits } from './widgets';
import { pill } from './widgets-c2';

/**
 * Chapitre 5.
 * - C5.1, il faut rentrer à la maison : la balance de la simulation et les objets à laisser sur la Lune.
 * - C5.2, les retrouvailles : le radar du rendez-vous et la bande imprimée de ses mesures.
 * - C5.3, le grand silence : l'onde radio de la simulation, faite de morceaux (une vague entière = dix morceaux).
 */

const wait = (ms: number) => services.clock.wait(ms);
type G = Phaser.GameObjects.Graphics;
type Img = Phaser.GameObjects.Image;
type Pt = { x: number; y: number };

const PAPER = 0xfbf6ea;

// ---------------------------------------------------------------------------
// C5.1 — Alléger Eagle : la balance de la simulation et les objets à laisser sur la Lune
// ---------------------------------------------------------------------------

const STEEL = 0x5b6577;
const STEEL_DARK = 0x3d4452;
const PAN = 0xb9bec8;

export const LOAD_IMAGE: Record<LoadKind, ImageId> = {
  sac: 'lune_sac',
  bottes: 'lune_bottes',
  appareil: 'lune_appareil',
  pelle: 'lune_pelle',
  marteau: 'lune_marteau',
};

/** Des kilos en petits carrés, par rangées de cinq ; en fin de CP, en barres de dix et petits carrés. */
function drawKilos(scene: Phaser.Scene, value: number, tens: boolean, size = 30): G {
  if (tens) return drawTensUnits(scene, value, 200).setScale(1.25);
  const g = scene.add.graphics();
  const gap = Math.round(size / 5);
  const cols = Math.min(value, 5);
  const rows = Math.ceil(value / 5);
  const w = cols * (size + gap) - gap;
  const h = rows * (size + gap) - gap;
  for (let k = 0; k < value; k++) {
    const x = -w / 2 + (k % 5) * (size + gap);
    const y = -h / 2 + Math.floor(k / 5) * (size + gap);
    g.fillStyle(C.orange, 1);
    g.fillRect(x, y, size, size);
    g.lineStyle(3, C.ink, 1);
    g.strokeRect(x, y, size, size);
  }
  return g;
}

/** Un objet qu'on peut laisser sur la Lune : son image et son poids ; le poids est lu quand on le sélectionne. */
export class LoadOption extends Option {
  private img: Img;
  private units: G | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly kind: LoadKind,
    readonly weight: number,
    onPress: () => void,
  ) {
    super(scene, x, y, 210, 230, onPress, C.cream);
    this.img = fit(scene.add.image(0, -28, LOAD_IMAGE[kind]), 165, 125);
    const t = scene.add.text(0, 80, `${weight} kg`, textStyle(46, { color: '#3a2a20' })).setOrigin(0.5);
    this.add([this.img, t]);
    this.finalize();
  }

  onFocus(): void {
    void services.voice.sayNumber(this.weight);
  }

  /** Aide : les kilos de l'objet en petits carrés (en fin de CP, en barres de dix), par-dessus son image. */
  showUnits(tens: boolean): void {
    if (this.units) return;
    this.img.setAlpha(0.25);
    this.units = drawKilos(this.scene, this.weight, tens, this.weight > 10 ? 24 : 30).setPosition(0, -28);
    this.add(this.units);
    this.finalize();
  }

  /** L'objet est laissé sur la Lune : il descend et disparaît. */
  async leave(): Promise<void> {
    await tweenAsync(this.scene, { targets: this, y: this.y + 60, alpha: 0, duration: 450, ease: 'Sine.In' });
  }
}

/**
 * La balance de la simulation (une balance de Roberval, comme à l'école) : la boîte de cailloux à gauche,
 * les objets choisis à droite. Elle reste bloquée pendant qu'on choisit (le cadenas) et ne pèse qu'à la validation :
 * l'enfant calcule, la balance vérifie.
 */
const ARM = 370;
const ROD = 64;
const TILT = 0.16;

export class MoonScale extends Phaser.GameObjects.Container {
  private beam: Phaser.GameObjects.Container;
  private left: Phaser.GameObjects.Container;
  private right: Phaser.GameObjects.Container;
  private lock: Phaser.GameObjects.Container;
  private box: Img;
  private load: Img[] = [];
  private temp: Phaser.GameObjects.GameObject[] = [];
  private result: Phaser.GameObjects.Container | null = null;
  private tilt = -TILT;
  private boxUnits: G | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly target: number,
  ) {
    super(scene, x, y);
    // Le pied et la colonne, sous le pivot (0, 0).
    const g = scene.add.graphics();
    g.fillStyle(STEEL_DARK, 1);
    g.fillRoundedRect(-150, 112, 300, 36, 14);
    g.fillStyle(STEEL, 1);
    g.fillRect(-18, 0, 36, 116);
    g.lineStyle(5, C.ink, 1);
    g.strokeRoundedRect(-150, 112, 300, 36, 14);
    g.strokeRect(-18, 0, 36, 116);
    this.add(g);

    // Les deux plateaux, toujours horizontaux, portés par une tige au bout du fléau.
    this.left = this.pan();
    this.right = this.pan();
    this.box = fit(scene.add.image(0, -80, 'boite_cailloux'), 220, 150);
    const tag = pill(scene, 0, -42, `${target} kg`, C.white);
    this.left.add([this.box, tag]);

    // Le fléau tourne autour du pivot.
    this.beam = scene.add.container(0, 0);
    const b = scene.add.graphics();
    b.fillStyle(PAN, 1);
    b.fillRoundedRect(-ARM - 24, -12, 2 * ARM + 48, 24, 12);
    b.lineStyle(5, C.ink, 1);
    b.strokeRoundedRect(-ARM - 24, -12, 2 * ARM + 48, 24, 12);
    b.fillStyle(C.mustard, 1);
    b.fillCircle(0, 0, 22);
    b.strokeCircle(0, 0, 22);
    this.beam.add(b);

    // Le cadenas : la balance attend qu'on pèse.
    this.lock = scene.add.container(0, 58);
    const l = scene.add.graphics();
    l.lineStyle(8, C.ink, 1);
    l.beginPath();
    l.arc(0, -14, 16, Math.PI, 0, false);
    l.strokePath();
    l.fillStyle(C.mustard, 1);
    l.fillRoundedRect(-24, -14, 48, 38, 8);
    l.lineStyle(4, C.ink, 1);
    l.strokeRoundedRect(-24, -14, 48, 38, 8);
    l.fillStyle(C.ink, 1);
    l.fillCircle(0, 4, 5);
    this.lock.add(l);

    this.add([this.beam, this.left, this.right, this.lock]);
    this.setTilt(-TILT);
    scene.add.existing(this);
  }

  private pan(): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0);
    const g = this.scene.add.graphics();
    g.fillStyle(STEEL, 1);
    g.fillRect(-7, 0, 14, ROD);
    g.fillStyle(PAN, 1);
    g.fillRoundedRect(-135, -8, 270, 22, 10);
    g.lineStyle(5, C.ink, 1);
    g.strokeRoundedRect(-135, -8, 270, 22, 10);
    g.strokeRect(-7, 14, 14, ROD - 14);
    c.add(g);
    return c;
  }

  private setTilt(a: number): void {
    this.tilt = a;
    this.beam.setRotation(a);
    const dx = ARM * Math.cos(a);
    const dy = ARM * Math.sin(a);
    this.left.setPosition(-dx, -dy - ROD);
    this.right.setPosition(dx, dy - ROD);
  }

  private async tiltTo(a: number, ms: number, ease = 'Sine.InOut'): Promise<void> {
    const from = { v: this.tilt };
    await tweenAsync(this.scene, { targets: from, v: a, duration: ms, ease, onUpdate: () => this.setTilt(from.v) });
  }

  /** Les objets choisis se posent sur le plateau de droite (la balance reste bloquée). */
  setLoad(items: { kind: LoadKind; w: number }[]): void {
    for (const im of this.load) im.destroy();
    const spots = [
      { x: -64, y: -52 },
      { x: 64, y: -52 },
      { x: 0, y: -132 },
      { x: -64, y: -205 },
      { x: 64, y: -205 },
    ];
    this.load = items.map((it, i) => fit(this.scene.add.image(spots[i].x, spots[i].y, LOAD_IMAGE[it.kind]), 120, 88));
    this.right.add(this.load);
  }

  /**
   * La balance pèse : le cadenas s'ouvre, le fléau penche du côté le plus lourd (ou reste droit),
   * et le calcul s'affiche sous les objets (« 3 + 2 = 5 »).
   */
  async weigh(parts: number[]): Promise<void> {
    const sum = parts.reduce((a, b) => a + b, 0);
    services.sfx.notch();
    await tweenAsync(this.scene, { targets: this.lock, alpha: 0, y: 40, duration: 250 });
    const to = sum === this.target ? 0 : sum < this.target ? -TILT : TILT;
    if (to === this.tilt) {
      // Pas assez lourd : le fléau se soulève un peu, puis retombe du côté des cailloux.
      await this.tiltTo(this.tilt * 0.55, 350, 'Sine.Out');
      await this.tiltTo(to, 500, 'Bounce.Out');
    } else await this.tiltTo(to, 900, 'Back.Out');
    const ok = sum === this.target;
    // Un seul objet : son poids ; plusieurs : le calcul.
    const label = parts.length === 1 ? `${sum} kg` : `${parts.join(' + ')} = ${sum}`;
    this.result = pill(this.scene, 270, 80, label, ok ? C.green : C.orange);
    this.add(this.result);
    if (ok) services.sfx.chord();
  }

  /** Après une erreur : le calcul s'efface, la balance revient penchée vers les cailloux et se bloque. */
  async relock(): Promise<void> {
    this.result?.destroy();
    this.result = null;
    await this.tiltTo(-TILT, 450);
    await tweenAsync(this.scene, { targets: this.lock, alpha: 1, y: 58, duration: 250 });
  }

  /** Aide : les kilos de la boîte de cailloux en petits carrés (en fin de CP, en barres de dix). */
  showUnits(tens: boolean): void {
    if (this.boxUnits) return;
    this.box.setAlpha(0.25);
    this.boxUnits = drawKilos(this.scene, this.target, tens, 24).setPosition(0, tens ? -120 : -100);
    this.left.add(this.boxUnits);
  }

  /**
   * Aide : on compte à partir du poids déjà posé jusqu'au poids des cailloux, par dizaines entières
   * quand c'est possible (fin de CP). Les kilos qui manquent s'empilent en vert à côté du plateau.
   */
  async countOn(from: number, to: number): Promise<void> {
    this.clearTemp();
    const g = this.scene.add.graphics();
    this.right.add(g);
    this.temp.push(g);
    let v = from;
    let tensDone = 0;
    let ones = 0;
    let k = 0;
    while (v < to) {
      const ten = to - v >= 10 && from >= 10;
      v += ten ? 10 : 1;
      g.lineStyle(3, C.ink, 1);
      if (ten) {
        // Une barre de dix, debout sur le plateau.
        const x = 12 + tensDone * 26;
        g.fillStyle(C.sky, 1);
        g.fillRect(x, -112, 20, 104);
        g.strokeRect(x, -112, 20, 104);
        tensDone++;
      } else {
        // Un kilo, en petits carrés verts par rangées de cinq.
        const x = 12 + tensDone * 26 + (ones % 5) * 25;
        const y = -30 - Math.floor(ones / 5) * 25;
        g.fillStyle(C.green, 1);
        g.fillRect(x, y, 22, 22);
        g.strokeRect(x, y, 22, 22);
        ones++;
      }
      k++;
      services.sfx.pop(k % 10);
      await services.voice.sayNumber(v);
      await wait(ten ? 250 : 120);
    }
  }

  clearTemp(): void {
    for (const t of this.temp) t.destroy();
    this.temp = [];
  }
}

// ---------------------------------------------------------------------------
// C5.2 — Le radar du rendez-vous : la distance jusqu'à Columbia, mesure après mesure
// ---------------------------------------------------------------------------

const RADAR_R = 255;
const RADAR_GREEN = 0x0f2b23;
/** Direction d'arrivée d'Eagle sur l'écran du radar (en haut à gauche, vers Columbia au centre). */
const RADAR_DIR = (-140 * Math.PI) / 180;

/**
 * L'écran rond du radar (Columbia au centre, Eagle sur un rayon, de plus en plus près) et la bande imprimée
 * des mesures, comme les imprimantes du laboratoire : trois nombres, puis la case de la mesure suivante.
 */
export class RadarScreen extends Phaser.GameObjects.Container {
  private readonly center = { x: -250, y: 10 };
  private readonly tape = { x: 330, y: 10 };
  private eagle: Img;
  private trail: G;
  private marks: G;
  private slot: Phaser.GameObjects.Text;
  private slotBox: G;
  private printed: Phaser.GameObjects.Text[] = [];
  private temp: Phaser.GameObjects.GameObject[] = [];
  private sweep: G;
  private readonly far: number;
  private readonly near: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private terms: number[],
    step: number,
  ) {
    super(scene, x, y);
    this.far = terms[0];
    this.near = terms[terms.length - 1] - 2 * step;
    const { x: cx, y: cy } = this.center;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.3);
    g.fillCircle(cx + 8, cy + 10, RADAR_R + 22);
    g.fillStyle(STEEL_DARK, 1);
    g.fillCircle(cx, cy, RADAR_R + 22);
    g.fillStyle(RADAR_GREEN, 1);
    g.fillCircle(cx, cy, RADAR_R);
    g.lineStyle(3, C.mint, 0.35);
    for (let k = 1; k <= 4; k++) g.strokeCircle(cx, cy, (RADAR_R * k) / 4);
    g.lineBetween(cx - RADAR_R, cy, cx + RADAR_R, cy);
    g.lineBetween(cx, cy - RADAR_R, cx, cy + RADAR_R);
    g.lineStyle(6, C.ink, 1);
    g.strokeCircle(cx, cy, RADAR_R + 22);
    this.add(g);

    // Le balayage du radar tourne doucement.
    this.sweep = scene.add.graphics().setPosition(cx, cy);
    this.sweep.fillStyle(C.mint, 0.16);
    this.sweep.slice(0, 0, RADAR_R, -0.5, 0, false);
    this.sweep.fillPath();
    this.sweep.lineStyle(4, C.mint, 0.7);
    this.sweep.lineBetween(0, 0, RADAR_R, 0);
    this.add(this.sweep);
    scene.tweens.add({ targets: this.sweep, angle: 360, duration: 4000, repeat: -1 });

    this.trail = scene.add.graphics();
    this.marks = scene.add.graphics();
    const columbia = fit(scene.add.image(cx, cy, 'columbia'), 120, 58);
    this.eagle = fit(scene.add.image(0, 0, 'eagle_montee'), 92, 80);
    this.add([this.trail, this.marks, columbia, this.eagle]);

    // La bande imprimée des mesures.
    const { x: tx, y: ty } = this.tape;
    const t = scene.add.graphics();
    t.fillStyle(0x000000, 0.25);
    t.fillRect(tx - 135 + 8, ty - 280 + 10, 270, 560);
    t.fillStyle(PAPER, 1);
    t.fillRect(tx - 135, ty - 280, 270, 560);
    t.fillStyle(0xd9d2c3, 1);
    for (let k = 0; k < 14; k++) {
      t.fillCircle(tx - 115, ty - 260 + k * 40, 6);
      t.fillCircle(tx + 115, ty - 260 + k * 40, 6);
    }
    t.lineStyle(5, C.ink, 1);
    t.strokeRect(tx - 135, ty - 280, 270, 560);
    this.add(t);
    this.slotBox = scene.add.graphics();
    this.add(this.slotBox);
    this.slot = scene.add.text(tx, this.rowY(terms.length), '?', textStyle(78, { color: '#3a2a20' })).setOrigin(0.5);
    this.add(this.slot);
    this.drawSlot(C.ink);
    this.placeEagle(terms[0]);
    scene.add.existing(this);
  }

  private rowY(i: number): number {
    return this.tape.y - 210 + i * 140;
  }

  private drawSlot(color: number): void {
    const y = this.rowY(this.terms.length);
    this.slotBox.clear();
    this.slotBox.lineStyle(6, color, 1);
    this.slotBox.strokeRoundedRect(this.tape.x - 90, y - 55, 180, 110, 18);
  }

  /**
   * Position d'Eagle sur le radar pour une distance : la première mesure près du bord, la mesure qui suivra
   * la réponse près de Columbia (au-delà : sur le bord, ou tout contre Columbia).
   */
  private spot(d: number): Pt {
    const r = Phaser.Math.Clamp(60 + ((RADAR_R - 85) * (d - this.near)) / (this.far - this.near), 34, RADAR_R - 18);
    return { x: this.center.x + r * Math.cos(RADAR_DIR), y: this.center.y + r * Math.sin(RADAR_DIR) };
  }

  private placeEagle(d: number): void {
    const p = this.spot(d);
    this.eagle.setPosition(p.x, p.y);
  }

  private async moveEagle(d: number): Promise<void> {
    const p = this.spot(d);
    services.sfx.whoosh();
    await tweenAsync(this.scene, { targets: this.eagle, x: p.x, y: p.y, duration: 700, ease: 'Sine.InOut' });
  }

  /** Les trois mesures s'impriment l'une après l'autre ; Eagle avance à chaque bip. */
  async print(): Promise<void> {
    for (const [i, v] of this.terms.entries()) {
      const t = this.scene.add.text(this.tape.x, this.rowY(i), String(v), textStyle(78, { color: '#3a2a20' })).setOrigin(0.5).setAlpha(0);
      this.add(t);
      this.printed.push(t);
      services.sfx.beeps(1);
      const p = this.spot(v);
      this.trail.fillStyle(C.mint, 0.8);
      this.trail.fillCircle(p.x, p.y, 9);
      if (i > 0) await this.moveEagle(v);
      await tweenAsync(this.scene, { targets: t, alpha: 1, duration: 250 });
      await wait(250);
    }
  }

  /** Bonne réponse : la mesure s'imprime en vert et Eagle se rapproche encore de Columbia. */
  async approach(n: number): Promise<void> {
    this.clearTemp();
    this.slot.setText(String(n)).setColor('#2f8f4e');
    this.drawSlot(C.green);
    services.sfx.beeps(1);
    const p = this.spot(n);
    this.trail.fillStyle(C.green, 1);
    this.trail.fillCircle(p.x, p.y, 10);
    await this.moveEagle(n);
  }

  /** Réponse fausse : la mesure s'imprime en orange et Eagle va là où elle le mettrait (trop loin, trop près). */
  async tryWrong(n: number): Promise<void> {
    this.clearTemp();
    this.slot.setText(String(n)).setColor('#c4553a');
    this.drawSlot(C.orange);
    const p = this.spot(n);
    this.marks.clear();
    this.marks.lineStyle(5, C.orange, 1);
    this.marks.strokeCircle(p.x, p.y, 40);
    await this.moveEagle(n);
  }

  /** Avant un nouvel essai : la case redevient « ? », Eagle revient à la dernière mesure. */
  async reset(): Promise<void> {
    this.marks.clear();
    this.slot.setText('?').setColor('#3a2a20');
    this.drawSlot(C.ink);
    await this.moveEagle(this.terms[this.terms.length - 1]);
  }

  /** Aide : les bonds entre les mesures (« − 2 »), et le bond suivant à faire. */
  showJumps(step: number): void {
    this.clearTemp();
    const g = this.scene.add.graphics();
    this.add(g);
    this.temp.push(g);
    const x = this.tape.x + 150;
    for (let i = 0; i < this.terms.length; i++) {
      const y0 = this.rowY(i) + 10;
      const y1 = this.rowY(i + 1) - 10;
      const last = i === this.terms.length - 1;
      g.lineStyle(6, last ? C.mustard : C.mint, 1);
      g.beginPath();
      g.arc(x - 20, (y0 + y1) / 2, (y1 - y0) / 2, -Math.PI / 2, Math.PI / 2, false);
      g.strokePath();
      const label = pill(this.scene, x + 70, (y0 + y1) / 2, `− ${step}`, last ? C.mustard : C.mint);
      this.add(label);
      this.temp.push(label);
    }
  }

  /** Aide : on compte à rebours depuis la dernière mesure, un par un, jusqu'à la suivante. */
  async countDown(from: number, to: number): Promise<void> {
    this.slot.setColor('#2f8f4e');
    for (let v = from - 1; v >= to; v--) {
      this.slot.setText(String(v));
      services.sfx.pop((from - v) % 10);
      await services.voice.sayNumber(v);
      await wait(120);
    }
  }

  clearTemp(): void {
    for (const t of this.temp) t.destroy();
    this.temp = [];
  }

  override destroy(fromScene?: boolean): void {
    this.scene?.tweens.killTweensOf(this.sweep);
    super.destroy(fromScene);
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
