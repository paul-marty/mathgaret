import * as Phaser from 'phaser';
import { C, textStyle } from '../config';
import { pick } from '../core/rng';
import { ChoiceAnswer, NumberPicker, Option, OrderAnswer } from '../engine/answers';
import { runChallenge, type ChallengeSpec } from '../engine/challenge';
import { compare, complement, match, order, type CompareParams, type ComplementParams, type MatchParams, type OrderParams } from '../math/families';
import type { StoryScene } from '../scenes/StoryScene';
import { services } from '../services';
import { EQUIPMENT, fit } from '../view/assets';
import { Hotspot } from '../view/Hotspot';
import { drawTensUnits, ItemGroup, LightPanel } from '../view/widgets';
import { calmVeil, papersSurprise } from './common';
import type { ChapterScript, SceneScript } from './types';

/**
 * Chapitre 1 — Le grand rêve de Margaret (document de référence, section 8).
 * Arrivée au laboratoire, réveil de l'ordinateur, incident de l'imprimante, révélation lunaire.
 */

const sfx = () => services.sfx;

// ---------------------------------------------------------------------------
// Décor du laboratoire
// ---------------------------------------------------------------------------

interface Lab {
  poste: Phaser.GameObjects.Image;
  screen: Phaser.GameObjects.Graphics;
  imprimante: Phaser.GameObjects.Image;
  maquette: Phaser.GameObjects.Image;
  armoire: Phaser.GameObjects.Image;
  reels: Phaser.GameObjects.Image[];
  /** Pénombre du laboratoire endormi (réveillé petit à petit en C1.2). */
  sleep: Phaser.GameObjects.Rectangle;
}

const labs = new WeakMap<StoryScene, Lab>();

function lab(s: StoryScene, opts: { asleep?: boolean } = {}): Lab {
  const existing = labs.get(s);
  if (existing) return existing;
  void s.setBg('labo');
  const armoire = s.prop('armoire_bandes', 1215, 520, 220, 380, 9);
  // Bobines posées dans les deux cavités de l'armoire (mesurées sur l'image livrée, art/reperes.md).
  const reels = [0.27, 0.61].map((ry) => {
    const r = s.add.image(armoire.x, armoire.y - armoire.displayHeight / 2 + armoire.displayHeight * ry, 'bobine').setDepth(10);
    return fit(r, armoire.displayWidth * 0.49, armoire.displayWidth * 0.49);
  });
  const maquette = s.prop('maquette_saturn', 960, 590, 130, 430, 9);
  const poste = s.prop('poste_travail', 600, 700, 380, 320, 11);
  const screen = s.add.graphics().setDepth(12);
  const imprimante = s.prop('imprimante', 1390, 720, 300, 280, 11);
  const sleep = s.add.rectangle(960, 540, 1920, 1080, 0x0b1020, opts.asleep ? 0.5 : 0).setDepth(15);
  const l: Lab = { poste, screen, imprimante, maquette, armoire, reels, sleep };
  labs.set(s, l);
  // La scène Phaser relancée (reprise, console) détruit ces objets : ils seront recréés.
  s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => labs.delete(s));
  return l;
}

/** Écran rond du poste : éteint, allumé, ou plein de symboles étranges. */
function drawScreen(l: Lab, mode: 'off' | 'on' | 'weird'): void {
  const g = l.screen;
  g.clear();
  if (mode === 'off') return;
  const cx = l.poste.x - l.poste.displayWidth * 0.1;
  const cy = l.poste.y - l.poste.displayHeight * 0.13;
  const r = l.poste.displayWidth * 0.15;
  g.fillStyle(mode === 'on' ? 0x8fe3a8 : 0xf08a3c, 0.55);
  g.fillCircle(cx, cy, r);
  g.lineStyle(4, mode === 'on' ? 0x2f8f4e : 0xc4553a, 1);
  for (let i = 0; i < 4; i++) {
    const y = cy - r * 0.5 + i * r * 0.32;
    const w = mode === 'on' ? r * (0.5 + ((i * 37) % 5) / 10) : r * (0.3 + Math.random() * 0.8);
    g.lineBetween(cx - w / 2, y, cx + w / 2, y);
  }
}

async function wake(s: StoryScene, l: Lab, to: number): Promise<void> {
  await s.tween({ targets: l.sleep, fillAlpha: to, duration: 900 });
}

function spinReels(s: StoryScene, l: Lab, ms: number): void {
  sfx().reels(ms / 1000);
  for (const [i, r] of l.reels.entries()) s.tweens.add({ targets: r, angle: (i % 2 ? -1 : 1) * 720, duration: ms, ease: 'Sine.InOut' });
}

function labSurprises(s: StoryScene, l: Lab): void {
  s.surprises = [
    papersSurprise(s),
    {
      id: 'bip',
      play: async () => {
        sfx().beeps(1, true);
        drawScreen(l, 'weird');
        s.char('collegue', 'stupefait');
        await s.wait(500);
        await s.say('ms_bip');
        drawScreen(l, 'on');
        s.char('collegue', 'neutre');
      },
    },
    {
      id: 'petite_fusee',
      play: async () => {
        const r = fit(s.add.image(l.poste.x, l.poste.y - 160, 'petite_fusee'), 90, 90).setDepth(13).setAlpha(0);
        await s.tween({ targets: r, alpha: 1, duration: 200 });
        s.char('margaret', 'joie');
        await s.tween({ targets: r, angle: 360, x: r.x + 60, y: r.y - 60, duration: 900, ease: 'Sine.InOut', yoyo: true });
        await s.tween({ targets: r, alpha: 0, duration: 250 });
        r.destroy();
        s.char('margaret', 'neutre');
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// C1.1 — Une mission extraordinaire
// ---------------------------------------------------------------------------

const c1_1: SceneScript = {
  id: 'c1.1',
  estMs: 70_000,
  async run(s) {
    const cam = s.cameras.main;
    services.music.play('mystere');
    await s.setBg('c1_ville');
    await s.wait(800);
    await s.say('c1_1_date');
    // La caméra se rapproche du laboratoire et traverse la porte.
    await s.tween({ targets: cam, zoom: 2.4, scrollY: 150, duration: 3200, ease: 'Sine.InOut' });
    sfx().whoosh();
    await s.tween({ targets: cam, alpha: 0, duration: 400 });
    cam.setZoom(1).setScroll(0, 0);
    const l = lab(s, { asleep: true });
    const hum = sfx().hum();
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => hum.stop());
    const collegue = s.char('collegue', 'neutre');
    await s.tween({ targets: cam, alpha: 1, duration: 600 });
    sfx().beeps(2);
    await s.wait(500);
    const margaret = s.char('margaret', 'neutre');
    const entering = margaret.enter('left', 1600);
    await s.say('c1_1_intro');
    await entering;
    // Le Collègue interrompt son travail et montre la petite maquette.
    collegue.setPose('enthousiaste');
    collegue.hop();
    const maquette = new Hotspot(s, l.maquette);
    maquette.highlight(true);
    await s.say('c1_1_defi');
    maquette.highlight(false);
    maquette.destroy();
    margaret.setPose('joie');
    await s.say('c1_1_travail');
    margaret.setPose('neutre');
    collegue.setPose('explique');

    // Toucher le poste de travail indiqué.
    const poste = new Hotspot(s, l.poste);
    poste.highlight(true);
    // Le poste est déjà touchable pendant la réplique ; elle est redite une fois si rien ne se passe.
    const pressed = s.waitForPress([poste], { reminder: 'c1_1_poste', reminderMs: 12_000 });
    await s.say('c1_1_poste');
    await pressed;
    poste.highlight(false);
    poste.destroy();
    sfx().select();
    sfx().beeps(3);
    drawScreen(l, 'on');
    await wake(s, l, 0.38);
    margaret.setPose('joie');
    await s.tween({ targets: cam, zoom: 1.25, scrollX: -170, scrollY: 90, duration: 900, ease: 'Sine.InOut' });
    await s.wait(700);
    await s.tween({ targets: cam, zoom: 1, scrollX: 0, scrollY: 0, duration: 800, ease: 'Sine.InOut' });
    margaret.setPose('neutre');

    // Le tutoriel présente le Collègue, toujours disponible pour aider.
    collegue.setPose('neutre');
    services.ui.overlay?.setHud('challenge');
    services.ui.overlay?.setBusy(true);
    services.ui.overlay?.pulse('aide');
    await s.say('tuto_aide');
    services.ui.overlay?.pulse(null);
    services.ui.overlay?.setBusy(false);
    services.ui.overlay?.setHud('story');
  },
};

// ---------------------------------------------------------------------------
// C1.2 — Le premier défi : allumer les voyants (compléter une collection)
// ---------------------------------------------------------------------------

function voyantsSpec(s: StoryScene, l: Lab): ChallengeSpec<ComplementParams, number> {
  let panel: LightPanel | null = null;
  const max = s.profile === 'debut' ? 10 : s.profile === 'milieu' ? 20 : 60;
  return {
    id: 'c1_voyants',
    family: complement,
    gesture: 'tuto_reponse',
    nextIntro: 'c1_2_autre',
    async build(p) {
      calmVeil(s, true);
      panel = new LightPanel(s, 960, 430, p.total, p.deja).setDepth(30).setAlpha(0);
      await s.tween({ targets: panel, alpha: 1, duration: 400 });
    },
    consigne: (p) => ({ id: s.profile === 'fin' ? 'c1_2_consigne_fin' : 'c1_2_consigne', vars: { total: p.total, deja: p.deja } }),
    answer: (_p, onValidate) => new NumberPicker(s, { max, tens: s.profile === 'fin', onValidate }),
    async success(_p, a) {
      s.char('collegue', 'explique');
      await panel!.fill(a);
      sfx().chord();
      spinReels(s, l, 2600);
      s.char('collegue', 'enthousiaste');
      s.char('margaret', 'joie');
      // Le laboratoire se réveille progressivement.
      await wake(s, l, Math.max(0, l.sleep.fillAlpha - 0.15));
      await s.say('c1_2_succes');
      s.char('margaret', 'neutre');
    },
    async error(_p, a) {
      const { missing, extra } = await panel!.fill(a);
      s.char('collegue', 'inquiet');
      if (missing > 0) await s.say(missing === 1 ? 'c1_2_trop_peu_1' : 'c1_2_trop_peu', { n: a, k: missing });
      else await s.say(extra === 1 ? 'c1_2_trop_1' : 'c1_2_trop', { n: a, k: extra });
      s.char('collegue', 'explique');
    },
    resetAfterError() {
      panel?.reset();
    },
    async help(p, level, ui) {
      s.char('collegue', 'explique');
      if (level === 1) await s.say('c1_2_aide_1', { total: p.total, deja: p.deja });
      else if (level === 2) {
        panel!.showMissing();
        await s.say('c1_2_aide_2');
      } else if (level === 3) {
        await s.say('gen_compter');
        await panel!.countMissing();
      } else {
        const answer = p.total - p.deja;
        ui.set(answer);
        await s.say('c1_2_aide_4', { answer });
        services.focus.focus(ui.validateButton, { silent: true });
      }
    },
    async clear() {
      if (!panel) return;
      const old = panel;
      panel = null;
      await s.tween({ targets: old, alpha: 0, y: old.y - 40, duration: 350 });
      old.destroy();
    },
  };
}

const c1_2: SceneScript = {
  id: 'c1.2',
  estMs: 25_000,
  challenge: { id: 'c1_voyants', family: 'completer' },
  async run(s) {
    const l = lab(s, { asleep: true });
    if (l.sleep.fillAlpha > 0.4) l.sleep.fillAlpha = 0.38;
    drawScreen(l, 'on');
    s.char('margaret', 'neutre');
    s.char('collegue', 'explique');
    services.music.play('leger');
    labSurprises(s, l);
    await runChallenge(s, voyantsSpec(s, l));
    calmVeil(s, false);
    // Clôture : bref accord, le laboratoire est réveillé.
    services.music.play('leger');
    sfx().chord();
    await wake(s, l, 0);
    spinReels(s, l, 2000);
    await s.wait(1200);
  },
};

// ---------------------------------------------------------------------------
// C1.3 — Une étrange découverte, puis le laboratoire devient fou
// ---------------------------------------------------------------------------

/** Liste des équipements (en haut à droite) : une ligne rangée par problème réussi. */
class Checklist {
  private rows: { icon: Phaser.GameObjects.Image; mark: Phaser.GameObjects.Graphics; done: boolean }[] = [];
  private container: Phaser.GameObjects.Container;

  /** Autant de lignes que de problèmes possibles dans le challenge (réserve de variantes). */
  static readonly ROWS = 4;

  constructor(private s: StoryScene) {
    const n = Checklist.ROWS;
    const step = 70;
    const h = n * step + 40;
    this.container = s.add.container(1660, 200 + h / 2).setDepth(28);
    const bg = s.add.graphics();
    bg.fillStyle(C.cream, 1);
    bg.fillRoundedRect(-170, -h / 2, 340, h, 24);
    bg.lineStyle(6, C.ink, 1);
    bg.strokeRoundedRect(-170, -h / 2, 340, h, 24);
    this.container.add(bg);
    EQUIPMENT.slice(0, n).forEach((key, i) => {
      const y = -h / 2 + 20 + step / 2 + i * step;
      const icon = fit(s.add.image(-100, y, key), 56, 56);
      const line = s.add.graphics();
      line.lineStyle(6, 0xb8a888, 1);
      line.lineBetween(-50, y, 60, y);
      const mark = s.add.graphics();
      this.container.add([icon, line, mark]);
      this.rows.push({ icon, mark, done: false });
      s.tweens.add({ targets: icon, angle: { from: -10, to: 10 }, duration: 120 + i * 20, yoyo: true, repeat: -1 });
    });
  }

  /** Range la prochaine ligne : coche verte, l'équipement se calme. */
  tidyNext(): void {
    const row = this.rows.find((r) => !r.done) ?? this.rows[this.rows.length - 1];
    row.done = true;
    this.s.tweens.killTweensOf(row.icon);
    row.icon.setAngle(0);
    row.mark.clear();
    row.mark.lineStyle(10, C.green, 1);
    const y = row.icon.y;
    row.mark.beginPath();
    row.mark.moveTo(80, y);
    row.mark.lineTo(100, y + 18);
    row.mark.lineTo(136, y - 22);
    row.mark.strokePath();
  }

  /** Clôture : le programme est réparé, les lignes restantes se rangent d'elles-mêmes. */
  async tidyAll(): Promise<void> {
    while (this.rows.some((r) => !r.done)) {
      this.tidyNext();
      sfx().tick();
      await this.s.wait(220);
    }
  }

  /** Erreur : le désordre reste sur la ligne concernée. */
  shakeCurrent(): void {
    const row = this.rows.find((r) => !r.done);
    if (row) this.s.tweens.add({ targets: row.icon, scale: row.icon.scale * 1.3, duration: 120, yoyo: true, repeat: 2 });
  }

  destroy(): void {
    this.container.destroy();
  }
}

function traysSpec<P extends MatchParams | CompareParams>(s: StoryScene, list: Checklist): ChallengeSpec<P, number> {
  let options: Option[] = [];
  let groups: ItemGroup[] = [];
  let card: Phaser.GameObjects.Container | null = null;
  let choice: ChoiceAnswer | null = null;
  const isMatch = s.profile === 'debut';
  const family = (isMatch ? match : compare) as unknown as ChallengeSpec<P, number>['family'];
  const trays = (p: P) => (p as MatchParams).trays;

  return {
    id: 'c1_liste',
    family,
    gesture: 'tuto_choix',
    maxProblems: Checklist.ROWS,
    async build(p) {
      calmVeil(s, true);
      const key = pick(services.rng, EQUIPMENT);
      const values = trays(p);
      const size = Math.max(...values) > 10 ? 62 : 72;
      groups = [];
      options = values.map((n, i) => {
        const o = new Option(s, 700 + i * 520, 560, 460, 380, () => choice?.select(i)).setDepth(30);
        const g = new ItemGroup(s, 0, 0, n, key, size);
        o.add(g);
        o.finalize();
        groups.push(g);
        return o;
      });
      if (isMatch) {
        // Carte du nombre demandé : un contact relit le nombre.
        const target = (p as MatchParams).target;
        card = s.add.container(960, 205).setDepth(30);
        const bg = s.add.graphics();
        bg.fillStyle(C.white, 1);
        bg.fillRoundedRect(-130, -85, 260, 170, 26);
        bg.lineStyle(6, C.ink, 1);
        bg.strokeRoundedRect(-130, -85, 260, 170, 26);
        const t = s.add.text(-40, 4, String(target), textStyle(110, { color: '#3a2a20' })).setOrigin(0.5);
        const icon = fit(s.add.image(60, 0, key), 90, 90);
        card.add([bg, t, icon]);
        card.setSize(260, 170).setInteractive({ useHandCursor: true });
        card.on('pointerdown', () => void services.voice.sayNumber(target));
      }
      await s.tween({ targets: [...options, ...(card ? [card] : [])], alpha: { from: 0, to: 1 }, duration: 400 });
    },
    consigne: (p) =>
      isMatch
        ? { id: 'c1_3_consigne_debut', vars: { target: (p as MatchParams).target } }
        : { id: (p as CompareParams).ask === 'plus' ? 'c1_3_consigne_plus' : 'c1_3_consigne_moins' },
    answer: (_p, onValidate) => {
      choice = new ChoiceAnswer(s, options, onValidate);
      return choice;
    },
    async success(_p, a) {
      groups[a].shake(false);
      list.tidyNext();
      sfx().chord();
      s.char('collegue', 'soulage');
      await s.say('c1_3_succes');
    },
    async error(p, a) {
      groups[a].shake(true);
      list.shakeCurrent();
      s.char('collegue', 'inquiet');
      await s.say('c1_3_erreur_plateau', { n: trays(p)[a] });
      s.char('collegue', 'explique');
    },
    resetAfterError() {
      for (const o of options) o.setSelected(false);
    },
    async help(p, level, ui) {
      s.char('collegue', 'explique');
      if (level === 1) {
        if (isMatch) await s.say('c1_3_aide_1_debut', { target: (p as MatchParams).target });
        else await s.say((p as CompareParams).ask === 'plus' ? 'c1_3_aide_1_plus' : 'c1_3_aide_1_moins');
      } else if (level === 2) {
        // Mettre les objets en ligne, l'un en face de l'autre : la comparaison se voit.
        await s.say('c1_3_aide_2');
        await Promise.all(groups.map((g) => g.lineUp(420)));
      } else if (level === 3) {
        await s.say('gen_compter');
        for (const g of groups) await g.countAloud();
      } else {
        const answer = family.answer(p);
        ui.set(answer);
        await s.say('c1_3_aide_4');
        services.focus.focus(ui.validateButton, { silent: true });
      }
    },
    async clear() {
      const old = [...options, ...(card ? [card] : [])];
      options = [];
      groups = [];
      card = null;
      await s.tween({ targets: old, alpha: 0, duration: 300 });
      for (const o of old) o.destroy();
    },
  };
}

function orderSpec(s: StoryScene, list: Checklist): ChallengeSpec<OrderParams, number[]> {
  let cards: Option[] = [];
  let slots: Phaser.GameObjects.Graphics | null = null;
  let tens: Phaser.GameObjects.Graphics[] = [];
  let ans: OrderAnswer | null = null;
  const xs = [600, 960, 1320];

  return {
    id: 'c1_liste',
    family: order,
    gesture: 'tuto_ordre',
    maxProblems: Checklist.ROWS,
    async build(p) {
      calmVeil(s, true);
      slots = s.add.graphics().setDepth(29);
      xs.forEach((x, i) => {
        slots!.lineStyle(6, C.cream, 0.9);
        slots!.strokeRoundedRect(x - 150, 560, 300, 250, 26);
        // Pictogramme « du plus petit au plus grand » : des points de plus en plus gros.
        slots!.fillStyle(C.mustard, 1);
        slots!.fillCircle(x, 840, 10 + i * 8);
        if (i < 2) {
          slots!.fillTriangle(x + 175, 670, x + 175, 700, x + 200, 685);
        }
      });
      cards = p.cards.map((v, i) => {
        const o = new Option(s, xs[i], 320, 300, 250, () => ans?.toggle(i), C.white).setDepth(30);
        const t = s.add.text(0, -56, String(v), textStyle(96, { color: '#3a2a20' })).setOrigin(0.5);
        const g = drawTensUnits(s, v, 260).setPosition(0, 54).setScale(0.75);
        tens.push(g);
        o.add([t, g]);
        o.finalize();
        return o;
      });
      await s.tween({ targets: cards, alpha: { from: 0, to: 1 }, duration: 400 });
    },
    consigne: () => ({ id: 'c1_3_consigne_fin' }),
    answer: (p, onValidate) => {
      ans = new OrderAnswer(
        s,
        cards,
        p.cards,
        xs.map((x) => ({ x, y: 685 })),
        onValidate,
      );
      return ans;
    },
    async success() {
      list.tidyNext();
      sfx().chord();
      s.char('collegue', 'soulage');
      await s.say('c1_3_succes');
    },
    async error() {
      list.shakeCurrent();
      for (const c of cards) s.tweens.add({ targets: c, angle: { from: -4, to: 4 }, duration: 80, yoyo: true, repeat: 3 });
      s.char('collegue', 'inquiet');
      await s.say('c1_3_erreur_ordre');
      s.char('collegue', 'explique');
    },
    resetAfterError() {
      ans?.reset();
    },
    async help(p, level, ui) {
      s.char('collegue', 'explique');
      if (level === 1) await s.say('c1_3_aide_1_fin');
      else if (level === 2) {
        await s.say('c1_3_aide_2_fin');
        for (const g of tens) s.tweens.add({ targets: g, scale: 0.9, duration: 300, yoyo: true, repeat: 1 });
      } else if (level === 3) {
        await s.say('c1_3_aide_3_fin');
        for (let i = 0; i < p.cards.length; i++) {
          s.tweens.add({ targets: cards[i], scale: 1.08, duration: 200, yoyo: true });
          await services.voice.sayNumber(Math.floor(p.cards[i] / 10));
          await s.wait(400);
        }
      } else {
        ui.set(order.answer(p));
        await s.say('c1_3_aide_4_fin');
        services.focus.focus(ui.validateButton, { silent: true });
      }
    },
    async clear() {
      const old = [...cards];
      cards = [];
      tens = [];
      await s.tween({ targets: old, alpha: 0, duration: 300 });
      for (const o of old) o.destroy();
      slots?.destroy();
      slots = null;
    },
  };
}

/** Bande de papier listing qui sort de l'imprimante et finit sur les bras du Collègue. */
function paperStrip(s: StoryScene, l: Lab): Phaser.GameObjects.Graphics {
  const g = s.add.graphics().setDepth(21);
  const x0 = l.imprimante.x;
  const y0 = l.imprimante.y - l.imprimante.displayHeight * 0.38;
  let len = 0;
  const draw = () => {
    g.clear();
    const folds = Math.floor(len / 70);
    for (let i = 0; i <= folds; i++) {
      const h = i === folds ? len % 70 : 70;
      const x = x0 - 70 + (i % 2) * 14 + Math.min(i * 22, 220);
      const y = y0 - 70 - i * 6 + Math.max(0, i - 3) * 40;
      g.fillStyle(C.white, 1);
      g.fillRect(x, y, 140, h);
      g.fillStyle(0xdff0e3, 1);
      g.fillRect(x, y + h * 0.3, 140, h * 0.25);
      g.lineStyle(2, 0x9cc9a8, 1);
      g.strokeRect(x, y, 140, h);
    }
  };
  s.tweens.addCounter({ from: 0, to: 700, duration: 3000, onUpdate: (tw) => ((len = tw.getValue() ?? 0), draw()) });
  return g;
}

const c1_3: SceneScript = {
  id: 'c1.3',
  estMs: 70_000,
  challenge: { id: 'c1_liste', family: 'comparer' },
  async run(s) {
    const l = lab(s);
    l.sleep.fillAlpha = 0;
    drawScreen(l, 'on');
    const margaret = s.char('margaret', 'neutre');
    const collegue = s.char('collegue', 'neutre');
    services.music.play('leger');

    // Petite exploration guidée : poste, imprimante, maquette (sans obligation de tout visiter).
    const spots = [
      { h: new Hotspot(s, l.poste), line: 'c1_3_obj_poste', who: 'margaret' as const },
      { h: new Hotspot(s, l.imprimante), line: 'c1_3_obj_imprimante', who: 'collegue' as const },
      { h: new Hotspot(s, l.maquette), line: 'c1_3_obj_maquette', who: 'collegue' as const },
    ];
    await s.say('c1_3_explore');
    let remaining = [...spots];
    for (let visits = 0; visits < 2 && remaining.length > 0; visits++) {
      for (const sp of remaining) sp.h.highlight(true);
      // Transition guidée : sans choix, l'histoire continue d'elle-même (15 s, puis 10 s).
      const chosen = await s.choose(
        remaining.map((r) => r.h),
        { timeoutMs: visits === 0 ? 15_000 : 10_000 },
      );
      for (const sp of remaining) sp.h.highlight(false);
      if (!chosen) break;
      const sp = remaining.find((r) => r.h === chosen)!;
      remaining = remaining.filter((r) => r !== sp);
      sfx().select();
      s.char(sp.who, sp.who === 'margaret' ? 'parle' : 'explique');
      await s.say(sp.line);
      s.char(sp.who, 'neutre');
    }
    for (const sp of spots) sp.h.destroy();

    // L'incident : son étrange, symboles, l'imprimante s'emballe.
    services.music.stop(0.3);
    const gentle = services.save.data.settings.gentle;
    sfx().beeps(7, true);
    drawScreen(l, 'weird');
    if (!gentle) s.cameras.main.flash(200, 255, 200, 140);
    await s.wait(900);
    const printing = sfx().printer(3.4);
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => printing.stop());
    const strip = paperStrip(s, l);
    collegue.setPose('stupefait');
    if (!gentle) s.cameras.main.shake(300, 0.004);
    await s.tween({ targets: collegue, x: collegue.x - 90, duration: 900, ease: 'Sine.InOut', yoyo: true });
    await s.wait(1400);
    collegue.setPose('enseveli');
    strip.setVisible(false);
    margaret.setPose('surprise');
    // Un bref silence laisse voir son expression stupéfaite.
    await s.wait(1300);
    await s.say('c1_3_ohnon');
    collegue.setPose('explique');
    margaret.setPose('neutre');
    // Le tumulte s'apaise avant la consigne.
    drawScreen(l, 'on');
    await s.say('c1_3_liste');

    const list = new Checklist(s);
    // Reprise : les lignes déjà rangées le restent.
    for (let i = 0; i < (s.run.challengeDone['c1_liste'] ?? 0); i++) list.tidyNext();
    labSurprises(s, l);
    if (s.profile === 'fin') await runChallenge(s, orderSpec(s, list));
    else await runChallenge(s, traysSpec(s, list));
    calmVeil(s, false);

    // Clôture : le papier s'arrête, la liste se range, une petite fusée animée apparaît.
    printing.stop();
    await list.tidyAll();
    await s.wait(500);
    list.destroy();
    collegue.setPose('soulage');
    const rocket = fit(s.add.image(l.poste.x - 30, l.poste.y - 120, 'petite_fusee'), 110, 110).setDepth(13);
    const target = rocket.scale;
    rocket.setScale(0);
    await s.tween({ targets: rocket, scale: target, angle: 360, duration: 900, ease: 'Back.Out' });
    margaret.setPose('joie');
    await s.say('c1_3_papier');
    margaret.setPose('neutre');
    collegue.setPose('neutre');
    await s.tween({ targets: rocket, alpha: 0, duration: 500 });
    rocket.destroy();
  },
};

// ---------------------------------------------------------------------------
// C1.4 — La grande révélation
// ---------------------------------------------------------------------------

const c1_4: SceneScript = {
  id: 'c1.4',
  estMs: 35_000,
  async run(s) {
    const l = lab(s);
    l.sleep.fillAlpha = 0;
    const cam = s.cameras.main;
    const collegue = s.char('collegue', 'explique');
    const margaret = s.char('margaret', 'neutre');
    // Les machines deviennent silencieuses ; le soir tombe sur le laboratoire.
    services.music.stop(1);
    await s.wait(600);
    await s.setBg('labo_soir', 1500);
    services.music.play('ample');
    const maquette = new Hotspot(s, l.maquette);
    maquette.highlight(true);
    // Mouvement de caméra : de la fusée vers la Lune à la fenêtre.
    await s.tween({ targets: cam, zoom: 1.5, scrollX: 0, scrollY: 60, duration: 2200, ease: 'Sine.InOut' });
    maquette.highlight(false);
    maquette.destroy();
    await s.tween({ targets: cam, scrollY: -170, duration: 2600, ease: 'Sine.InOut' });
    await s.say('c1_4_lune');
    await s.tween({ targets: cam, zoom: 1, scrollX: 0, scrollY: 0, duration: 1800, ease: 'Sine.InOut' });
    collegue.setPose('enthousiaste');
    margaret.setPose('reflechit');
    await s.say('c1_4_probleme');
    margaret.setPose('joie');
    await s.wait(1500);
  },
};

export const chapter1: ChapterScript = { id: 'c1', scenes: [c1_1, c1_2, c1_3, c1_4] };
