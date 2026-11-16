import * as Phaser from 'phaser';
import { C, textStyle } from '../config';
import { ChoiceAnswer, NumberPicker } from '../engine/answers';
import { runChallenge, type ChallengeSpec } from '../engine/challenge';
import { signal, signalFollowUp, SYSTEM_MAX, systems, type SignalParams, type SystemParams } from '../math/families';
import type { StoryScene } from '../scenes/StoryScene';
import { services } from '../services';
import type { LoopHandle } from '../audio/Sfx';
import { fit } from '../view/assets';
import { Hotspot } from '../view/Hotspot';
import { drawIcon } from '../view/icons';
import { MAP_PINS, PAD } from '../view/placeholders-c3';
import { drawCheck, SimFrame, zoneOf } from '../view/widgets-c2';
import { BatteryOption, CheckBoard, EnergyReserve, KeypadAnswer, SignalScreen } from '../view/widgets-c3';
import { calmVeil, papersSurprise } from './common';
import type { ChapterScript, SceneScript } from './types';

/**
 * Chapitre 3 — Apollo 11, le grand décollage (document de référence, section 8).
 * Le grand jour, les dernières vérifications, le signal mystérieux, le lancement, un message depuis l'espace.
 */

const sfx = () => services.sfx;
type Img = Phaser.GameObjects.Image;
type GO = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;

// ---------------------------------------------------------------------------
// Le laboratoire du MIT, jour du lancement : le poste et l'écran de communication
// ---------------------------------------------------------------------------

interface Lab3 {
  poste: Img;
  ecran: Img;
  /** Contenu de l'écran de communication (ingénieur, image du test…). */
  screen: Phaser.GameObjects.Container;
  hum: LoopHandle;
  /** Montre ou cache tout le laboratoire (cinématiques) ; le ronronnement des machines s'arrête hors du laboratoire. */
  show(on: boolean): void;
}

const labs = new WeakMap<StoryScene, Lab3>();

export function lab3(s: StoryScene): Lab3 {
  const existing = labs.get(s);
  if (existing) return existing;
  void s.setBg('labo');
  const poste = s.prop('poste_travail', 600, 700, 380, 320, 11);
  const ecran = s.prop('ecran_simulation', 1240, 450, 480, 400, 9);
  const z = zoneOf(ecran, 'ecran');
  const screen = s.add.container(z.x, z.y).setDepth(10);
  const off = s.add.graphics();
  off.fillStyle(0x16324a, 1);
  off.fillRoundedRect(-z.w / 2, -z.h / 2, z.w, z.h, 22);
  screen.add(off);
  let humming = true;
  const l: Lab3 = {
    poste,
    ecran,
    screen,
    hum: sfx().hum(),
    show(on) {
      for (const o of [s.bg, poste, ecran, screen, s.chars.margaret, s.chars.collegue] as (GO | null | undefined)[]) o?.setVisible(on);
      if (on && !humming) l.hum = sfx().hum();
      else if (!on && humming) l.hum.stop();
      humming = on;
    },
  };
  s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => l.hum.stop());
  labs.set(s, l);
  s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => labs.delete(s));
  return l;
}

/** L'ingénieur du centre de contrôle apparaît sur l'écran de communication (convention de dessin animé). */
async function engineerOn(s: StoryScene, l: Lab3): Promise<Img> {
  const z = zoneOf(l.ecran, 'ecran');
  const eng = fit(s.add.image(0, 10, 'ingenieur'), z.w * 0.8, z.h * 0.9);
  const lines = s.add.graphics();
  lines.lineStyle(2, C.white, 0.08);
  for (let y = -z.h / 2 + 6; y < z.h / 2; y += 8) lines.lineBetween(-z.w / 2 + 6, y, z.w / 2 - 6, y);
  l.screen.add([eng, lines]);
  eng.setAlpha(0).setScale(eng.scale * 0.9);
  sfx().beeps(2);
  await s.tween({ targets: eng, alpha: 1, scale: eng.scale / 0.9, duration: 400, ease: 'Back.Out' });
  return eng;
}

async function screenOff(s: StoryScene, l: Lab3): Promise<void> {
  const extra = l.screen.list.slice(1);
  await s.tween({ targets: extra, alpha: 0, duration: 300 });
  for (const o of extra) o.destroy();
}

/**
 * Le pas de tir : le décor `kennedy_aube` (agrandi `zoom` fois) dont le pied de la tour arrive en (`x`, `y`),
 * et Saturn V posée à côté de la tour, à la même échelle.
 */
function launchPad(s: StoryScene, zoom: number, x: number, y: number): { pad: Img; rocket: Img } {
  const pad = s.add.image(0, 0, 'kennedy_aube').setDepth(11);
  const k = Math.max(1920 / pad.width, 1080 / pad.height) * zoom;
  pad.setScale(k);
  pad.setPosition(x - (PAD.x - 0.5) * pad.width * k, y - (PAD.y - 0.5) * pad.height * k);
  const h = PAD.h * pad.height * k;
  const rocket = s.prop('saturn_v', x, 0, h, h, 13);
  rocket.setY(y - rocket.displayHeight / 2);
  // Le décor doit couvrir tout l'écran : si besoin, décor et fusée glissent ensemble.
  const dx = Phaser.Math.Clamp(pad.x, 1920 - pad.displayWidth / 2, pad.displayWidth / 2) - pad.x;
  const dy = Phaser.Math.Clamp(pad.y, 1080 - pad.displayHeight / 2, pad.displayHeight / 2) - pad.y;
  pad.setPosition(pad.x + dx, pad.y + dy);
  rocket.setPosition(rocket.x + dx, rocket.y + dy);
  return { pad, rocket };
}

// ---------------------------------------------------------------------------
// C3.1 — Le grand jour est arrivé (lancement historique, dialogues romancés)
// ---------------------------------------------------------------------------

/** Repère de lieu sur la carte : une pastille avec un pictogramme. */
function mapPin(s: StoryScene, x: number, y: number, kind: 'fusee' | 'radio' | 'labo'): Phaser.GameObjects.Container {
  const g = s.add.graphics();
  const color = kind === 'fusee' ? C.brick : kind === 'radio' ? C.mint : C.mustard;
  g.fillStyle(0x000000, 0.25);
  g.fillCircle(4, 8, 46);
  g.fillStyle(color, 1);
  g.fillCircle(0, 0, 46);
  g.lineStyle(6, C.ink, 1);
  g.strokeCircle(0, 0, 46);
  const icon = s.add.graphics();
  if (kind === 'fusee') drawIcon(icon, 'rocket', 58, C.white);
  else if (kind === 'radio') {
    icon.lineStyle(6, C.ink, 1);
    icon.lineBetween(0, 22, 0, -6);
    icon.fillStyle(C.ink, 1);
    icon.fillCircle(0, -8, 6);
    icon.beginPath();
    icon.arc(0, -8, 18, Phaser.Math.DegToRad(-150), Phaser.Math.DegToRad(-30));
    icon.strokePath();
  } else {
    // Le laboratoire : un petit ordinateur.
    icon.fillStyle(C.cream, 1);
    icon.fillRoundedRect(-22, -20, 44, 34, 6);
    icon.lineStyle(5, C.ink, 1);
    icon.strokeRoundedRect(-22, -20, 44, 34, 6);
    icon.fillStyle(C.ink, 1);
    icon.fillRect(-14, 18, 28, 6);
  }
  return s.add.container(x, y, [g, icon]).setDepth(32).setScale(0);
}

const ASTRONAUTS = [
  { image: 'astronaute_1', line: 'c3_1_armstrong' },
  { image: 'astronaute_2', line: 'c3_1_aldrin' },
  { image: 'astronaute_3', line: 'c3_1_collins' },
] as const;

const c3_1: SceneScript = {
  id: 'c3.1',
  estMs: 80_000,
  async run(s) {
    const cam = s.cameras.main;
    const gentle = services.save.data.settings.gentle;
    // Écran noir. Une radio grésille.
    services.music.stop(0.2);
    cam.setAlpha(0);
    await s.wait(500);
    sfx().crackle(1.4);
    await s.wait(700);
    await s.say('c3_1_radio');

    // Survol du centre spatial Kennedy au début de la journée.
    const view = launchPad(s, 1.3, 1920 * PAD.x, 1080 * PAD.y + 40);
    services.music.play('mystere');
    // Le survol part du lever du soleil et découvre la tour puis la fusée, d'un bord du décor à l'autre.
    const half = view.pad.displayWidth / 2;
    const from = half - view.pad.x;
    const to = 1920 - half - view.pad.x;
    view.pad.x += from;
    view.rocket.x += from;
    await s.tween({ targets: cam, alpha: 1, duration: 1400 });
    const flyover = s.tween({ targets: [view.pad, view.rocket], x: `-=${from - to}`, duration: 6500, ease: 'Sine.InOut' });
    await s.say('c3_1_date');
    await flyover;
    view.pad.destroy();
    view.rocket.destroy();

    // La caméra découvre l'immense Saturn V, puis remonte lentement le long de sa structure.
    await s.tween({ targets: cam, alpha: 0, duration: 500 });
    cam.setZoom(1).setScroll(0, 0);
    const sky = s.add.rectangle(960, 540, 1920, 1080, 0x5d6fa0, 0.82).setDepth(11);
    const rocket = s.prop('saturn_v', 960, 0, 1400, 2800, 12);
    rocket.setY(1080 - rocket.displayHeight / 2 + 40);
    await s.tween({ targets: cam, alpha: 1, duration: 600 });
    const climb = s.tween({ targets: rocket, y: rocket.displayHeight / 2 - 60, duration: 7000, ease: 'Sine.InOut' });
    await s.say('c3_1_saturn');
    await climb;
    await s.say('c3_1_rendscompte');

    // Retour au laboratoire du MIT.
    await s.tween({ targets: cam, alpha: 0, duration: 500 });
    sky.destroy();
    rocket.destroy();
    const l = lab3(s);
    const margaret = s.char('margaret', 'neutre');
    const collegue = s.char('collegue', 'enthousiaste');
    services.music.play('leger');
    await s.tween({ targets: cam, alpha: 1, duration: 600 });

    // Une carte très simple situe les trois lieux.
    calmVeil(s, true);
    const map = s.prop('carte_usa', 980, 440, 900, 560, 31).setAlpha(0);
    await s.tween({ targets: map, alpha: 1, duration: 400 });
    const pinAt = (f: { x: number; y: number }) => ({
      x: map.x - map.displayWidth / 2 + f.x * map.displayWidth,
      y: map.y - map.displayHeight / 2 + f.y * map.displayHeight,
    });
    const pins: Phaser.GameObjects.Container[] = [];
    for (const [key, kind, line] of [
      ['floride', 'fusee', 'c3_1_carte_floride'],
      ['houston', 'radio', 'c3_1_carte_houston'],
      ['mit', 'labo', 'c3_1_carte_mit'],
    ] as const) {
      const p = pinAt(MAP_PINS[key]);
      const pin = mapPin(s, p.x, p.y, kind);
      pins.push(pin);
      sfx().pop(pins.length * 2);
      await s.tween({ targets: pin, scale: 1, duration: 300, ease: 'Back.Out' });
      await s.say(line);
    }
    await s.wait(500);
    await s.tween({ targets: [map, ...pins], alpha: 0, duration: 400 });
    map.destroy();
    for (const p of pins) p.destroy();
    calmVeil(s, false);

    // Une interaction sur le poste ouvre les contrôles.
    collegue.setPose('explique');
    const poste = new Hotspot(s, l.poste);
    poste.highlight(true);
    const pressed = s.waitForPress([poste], { reminder: 'c3_1_toucher', reminderMs: 9000 });
    await s.say('c3_1_poste');
    await pressed;
    poste.highlight(false);
    poste.destroy();
    sfx().select();
    sfx().beeps(3);

    // Les trois astronautes, nommés à voix haute quand l'enfant les touche.
    calmVeil(s, true);
    // Chaque astronaute sur sa carte ; une coche quand il a été nommé.
    const cards = ASTRONAUTS.map((_, i) => {
      const g = s.add.graphics().setDepth(30).setAlpha(0);
      const x = 600 + i * 360;
      g.fillStyle(0x000000, 0.25);
      g.fillRoundedRect(x - 160 + 8, 200 + 10, 320, 540, 28);
      g.fillStyle(0x2c4a72, 1);
      g.fillRoundedRect(x - 160, 200, 320, 540, 28);
      g.lineStyle(8, C.ink, 1);
      g.strokeRoundedRect(x - 160, 200, 320, 540, 28);
      return g;
    });
    const portraits = ASTRONAUTS.map((a, i) => s.prop(a.image, 600 + i * 360, 470, 290, 510, 31).setAlpha(0));
    await s.tween({ targets: [...cards, ...portraits], alpha: 1, duration: 500 });
    margaret.setPose('surprise');
    await s.say('c3_1_equipage');
    margaret.setPose('neutre');
    let remaining = ASTRONAUTS.map((a, i) => ({ ...a, img: portraits[i], h: new Hotspot(s, portraits[i]) }));
    while (remaining.length > 0) {
      for (const r of remaining) r.h.highlight(true);
      // Sans choix, le récit nomme lui-même l'astronaute suivant : les trois sont toujours présentés.
      const chosen = await s.choose(
        remaining.map((r) => r.h),
        { timeoutMs: 15_000 },
      );
      for (const r of remaining) r.h.highlight(false);
      const r = remaining.find((x) => x.h === chosen) ?? remaining[0];
      remaining = remaining.filter((x) => x !== r);
      sfx().select();
      s.tweens.add({ targets: r.img, scale: r.img.scale * 1.06, duration: 180, yoyo: true });
      const check = s.add.graphics().setDepth(32);
      check.fillStyle(C.green, 1);
      check.fillCircle(r.img.x + 120, 250, 40);
      check.lineStyle(6, C.ink, 1);
      check.strokeCircle(r.img.x + 120, 250, 40);
      drawCheck(check, r.img.x + 120, 250, 44, C.white);
      cards.push(check);
      await s.say(r.line);
      r.h.destroy();
    }
    await s.wait(400);
    await s.tween({ targets: [...cards, ...portraits], alpha: 0, duration: 400 });
    for (const p of [...cards, ...portraits]) p.destroy();
    calmVeil(s, false);
    collegue.setPose('enthousiaste');
    if (!gentle) collegue.hop();
    await s.say('c3_1_fin');
    collegue.setPose('neutre');
  },
};

// ---------------------------------------------------------------------------
// C3.2 — Les dernières vérifications : un système à la fois (soustraire, compléter)
// ---------------------------------------------------------------------------

function systemsSpec(s: StoryScene): ChallengeSpec<SystemParams, number> {
  let board: CheckBoard | null = null;
  const fin = s.profile === 'fin';
  return {
    id: 'c3_verifications',
    family: systems,
    gesture: (p) => (p.kind === 'guidage' ? 'tuto_clavier' : 'tuto_reponse'),
    nextIntro: 'c3_2_suivant',
    maxProblems: 4,
    async build(p) {
      calmVeil(s, true);
      // L'ordinateur de guidage laisse la place à son clavier, à droite.
      board = new CheckBoard(s, p.kind === 'guidage' ? 630 : 960, 440, p.kind, s.profile, p.total, p.deja).setDepth(30).setAlpha(0);
      await s.tween({ targets: board, alpha: 1, duration: 350 });
      await board.showDone();
    },
    consigne: (p) => ({ id: `c3_2_${p.kind}`, vars: { total: p.total, deja: p.deja } }),
    answer: (p, onValidate) =>
      p.kind === 'guidage'
        ? new KeypadAnswer(s, SYSTEM_MAX[s.profile], onValidate)
        : new NumberPicker(s, { max: SYSTEM_MAX[s.profile], tens: fin, onValidate }),
    async success() {
      await board!.complete();
      s.char('collegue', 'enthousiaste');
      await s.say('c3_2_valide');
      s.char('collegue', 'explique');
    },
    async error(_p, a) {
      // Le contrôle reste orange ; ce qui manque (ou ce qui est en trop) se voit sur le tableau.
      const { missing, extra } = await board!.tryAnswer(a);
      s.char('collegue', 'inquiet');
      if (missing > 0) await s.say(missing === 1 ? 'c3_2_peu_1' : 'c3_2_peu', { n: a, k: missing });
      else await s.say(extra === 1 ? 'c3_2_trop_1' : 'c3_2_trop', { n: a, k: extra });
      s.char('collegue', 'explique');
    },
    resetAfterError() {
      board?.resetMarks();
    },
    async help(p, level, ui) {
      s.char('collegue', 'explique');
      const answer = p.total - p.deja;
      if (level === 1) await s.say('c3_2_aide_1', { total: p.total, deja: p.deja });
      else if (level === 2) {
        board!.showRest();
        await s.say(fin ? 'c3_2_aide_2_fin' : 'c3_2_aide_2');
      } else if (level === 3) {
        await s.say('gen_compter');
        await board!.countRest();
      } else {
        ui.set(answer);
        await s.say(p.kind === 'guidage' ? 'c3_2_aide_4_clavier' : 'c3_2_aide_4', { answer });
        services.focus.focus(ui.validateButton, { silent: true });
      }
    },
    async clear() {
      if (!board) return;
      const old = board;
      board = null;
      await s.tween({ targets: old, alpha: 0, y: old.y - 30, duration: 350 });
      old.destroy();
    },
  };
}

const c3_2: SceneScript = {
  id: 'c3.2',
  estMs: 45_000,
  challenge: { id: 'c3_verifications', family: 'systemes' },
  async run(s) {
    const l = lab3(s);
    const collegue = s.char('collegue', 'neutre');
    const margaret = s.char('margaret', 'neutre');
    services.music.play('leger');
    // Un ingénieur apparaît sur l'écran de communication.
    await engineerOn(s, l);
    await s.say('c3_2_ingenieur');
    collegue.setPose('explique');
    await s.say('c3_2_systemes');
    await screenOff(s, l);
    s.surprises = [papersSurprise(s)];
    await runChallenge(s, systemsSpec(s));
    calmVeil(s, false);

    // La synthèse des contrôles conduit au dernier test du laboratoire.
    services.music.play('leger');
    sfx().chord();
    margaret.setPose('joie');
    collegue.setPose('enthousiaste');
    await s.say('c3_2_cloture');
    await engineerOn(s, l);
    await s.say('c3_2_recu');
    await screenOff(s, l);
    margaret.setPose('neutre');
    collegue.setPose('neutre');
  },
};

// ---------------------------------------------------------------------------
// C3.3 — Le signal mystérieux : régler la réserve d'énergie de la simulation (choisir la bonne batterie)
// ---------------------------------------------------------------------------

const RESERVE_Y = 470;
const OPTIONS_Y = 715;

function signalSpec(s: StoryScene, screen: SignalScreen): ChallengeSpec<SignalParams, number> {
  let reserve: EnergyReserve | null = null;
  let options: BatteryOption[] = [];
  let choice: ChoiceAnswer | null = null;
  /** Deuxièmes retraits (fin de CP) : la réserve de la première étape reste affichée. */
  const seconds = new WeakSet<SignalParams>();

  const dropOptions = async () => {
    const old = options;
    options = [];
    await s.tween({ targets: old, alpha: 0, duration: 250 });
    for (const o of old) o.destroy();
  };

  return {
    id: 'c3_signal',
    family: signal,
    gesture: 'tuto_batterie',
    nextIntro: 'c3_3_autre',
    maxProblems: 4,
    followUp(p) {
      const next = signalFollowUp(p, services.rng);
      if (next) seconds.add(next);
      return next;
    },
    async build(p) {
      calmVeil(s, true);
      screen.scramble(true);
      if (!seconds.has(p) || !reserve) {
        reserve = new EnergyReserve(s, 960, RESERVE_Y, s.profile, p.total).setDepth(31).setAlpha(0);
        await s.tween({ targets: reserve, alpha: 1, duration: 350 });
        await s.wait(300);
      }
      // Le test consomme sa part de la réserve : la transformation se voit avant la question.
      sfx().beeps(1, true);
      await reserve.use(p.minus);
      options = p.options.map((v, i) =>
        new BatteryOption(s, 610 + i * 350, OPTIONS_Y, v, s.profile, () => choice?.select(i)).setDepth(32).setAlpha(0),
      );
      await s.tween({ targets: options, alpha: 1, duration: 300 });
    },
    consigne: (p) =>
      seconds.has(p)
        ? { id: 'c3_3_reserve_2', vars: { minus: p.minus } as Record<string, number> }
        : { id: 'c3_3_reserve', vars: { total: p.total, minus: p.minus } },
    answer: (_p, onValidate) => (choice = new ChoiceAnswer(s, options, onValidate)),
    async success(p) {
      reserve!.clearMarks();
      const right = p.total - p.minus;
      // Les chiffres se stabilisent sur la bonne réserve ; le voyant repasse au vert.
      screen.stabilize(right);
      for (const o of options) if (o.value !== right) o.setAlpha(0.35);
      sfx().chord();
      await s.wait(500);
      if (!p.then) await s.say('c3_3_stable');
      await dropOptions();
    },
    async error(p, a) {
      // Le voyant reste orange ; le Collègue propose de vérifier les unités utilisées.
      s.char('collegue', 'inquiet');
      reserve!.mark('used', C.orange, p.minus);
      await s.say('c3_3_erreur', { n: p.options[a] });
      reserve!.clearMarks();
      s.char('collegue', 'explique');
    },
    resetAfterError() {
      for (const o of options) o.setSelected(false);
    },
    async help(p, level, ui) {
      s.char('collegue', 'explique');
      const answer = p.total - p.minus;
      if (level === 1) await s.say('c3_3_aide_1', { total: p.total, minus: p.minus });
      else if (level === 2) {
        reserve!.mark('rest', C.mint);
        await s.say('c3_3_aide_2');
      } else if (level === 3) {
        await s.say('gen_compter');
        await reserve!.countRest();
      } else {
        ui.set(signal.answer(p));
        await s.say('c3_3_aide_4', { answer });
        services.focus.focus(ui.validateButton, { silent: true });
      }
    },
    async clear() {
      await dropOptions();
      if (!reserve) return;
      const old = reserve;
      reserve = null;
      await s.tween({ targets: old, alpha: 0, duration: 300 });
      old.destroy();
    },
  };
}

const c3_3: SceneScript = {
  id: 'c3.3',
  estMs: 45_000,
  challenge: { id: 'c3_signal', family: 'signal' },
  async run(s) {
    const l = lab3(s);
    const cam = s.cameras.main;
    const gentle = services.save.data.settings.gentle;
    const margaret = s.char('margaret', 'neutre');
    const collegue = s.char('collegue', 'neutre');
    // Les lumières du laboratoire vacillent brièvement. « Bip… bip… bip ! » Un voyant orange apparaît.
    services.music.stop(0.3);
    const dim = s.add.rectangle(960, 540, 1920, 1080, 0x000000, 0).setDepth(24);
    for (let i = 0; i < 3; i++) {
      dim.setFillStyle(0x000000, gentle ? 0.25 : 0.5);
      await s.wait(110);
      dim.setFillStyle(0x000000, 0);
      await s.wait(160);
    }
    dim.destroy();
    sfx().beeps(3);
    // Le cadre de la simulation laisse voir Margaret et le Collègue de part et d'autre.
    const frame = new SimFrame(s, 960, 485, 1220, 770).setDepth(29);
    const screen = new SignalScreen(s, 960, 285).setDepth(31);
    screen.scramble(true);
    await frame.appear();
    services.music.play('mystere');
    collegue.setPose('stupefait');
    margaret.setPose('surprise');
    await s.say('c3_3_etrange');
    // L'alarme s'arrête avant le raisonnement.
    sfx().alarm();
    if (!gentle) cam.shake(200, 0.002);
    await s.wait(1200);
    collegue.setPose('explique');
    margaret.setPose('reflechit');
    await s.say('sim_regardons');
    s.surprises = [papersSurprise(s)];
    await runChallenge(s, signalSpec(s, screen));
    calmVeil(s, false);

    // Clôture : la simulation est validée.
    services.music.play('leger');
    sfx().success();
    collegue.setPose('applaudit');
    margaret.setPose('joie');
    await s.say('c3_3_valide');
    await s.tween({ targets: [frame, screen], alpha: 0, duration: 400 });
    frame.destroy();
    screen.destroy();
    collegue.setPose('neutre');
    margaret.setPose('neutre');
    void l;
  },
};

// ---------------------------------------------------------------------------
// C3.4 — Trois… deux… un… (montage du lancement, sans action chronométrée)
// ---------------------------------------------------------------------------

const c3_4: SceneScript = {
  id: 'c3.4',
  estMs: 45_000,
  async run(s) {
    const l = lab3(s);
    const cam = s.cameras.main;
    const gentle = services.save.data.settings.gentle;
    await s.tween({ targets: cam, alpha: 0, duration: 500 });
    l.show(false);
    // La caméra retrouve Saturn V sur son pas de tir. La musique se retire.
    services.music.stop(1);
    const objs: Phaser.GameObjects.GameObject[] = [];
    const { pad, rocket } = launchPad(s, 1.7, 1060, 1000);
    const smoke = s.add.graphics().setDepth(14);
    const flames = s.add.graphics().setDepth(12);
    const big = s.add
      .text(420, 420, '', textStyle(300, { color: '#f6ecd9', stroke: '#3a2a20', strokeThickness: 18 }))
      .setOrigin(0.5)
      .setDepth(30);
    objs.push(pad, rocket, smoke, flames, big);
    await s.tween({ targets: cam, alpha: 1, duration: 700 });
    await s.wait(500);

    const base = { x: rocket.x, y: rocket.y + rocket.displayHeight / 2 };
    const puffs: { x: number; y: number; r: number }[] = [];
    const drawFire = (power: number) => {
      flames.clear();
      flames.fillStyle(C.orange, 0.9);
      flames.fillEllipse(base.x, base.y + 40 * power, 120 * power, 160 * power);
      flames.fillStyle(C.mustard, 1);
      flames.fillEllipse(base.x, base.y + 30 * power, 70 * power, 100 * power);
      smoke.clear();
      smoke.fillStyle(0xe8e4dc, 0.9);
      for (const p of puffs) smoke.fillCircle(p.x, p.y, p.r);
    };
    for (let n = 10; n >= 1; n--) {
      big.setText(String(n)).setScale(1.25).setAlpha(1);
      s.tweens.add({ targets: big, scale: 1, duration: 300, ease: 'Back.Out' });
      // Les moteurs s'allument avant la fin du compte à rebours ; la fumée s'accumule à la base.
      if (n <= 7) {
        for (let k = 0; k < 4; k++) puffs.push({ x: base.x + (Math.random() - 0.5) * (12 - n) * 70, y: base.y + 10 + Math.random() * 60, r: 40 + (10 - n) * 9 });
        drawFire(Math.min(1, (8 - n) / 5));
        if (n === 7) sfx().whoosh();
      }
      await s.say(`c3_4_compte_${n}`);
      await s.wait(250);
    }
    big.setText('');
    // Une suspension sonore très brève précède le grondement.
    await s.wait(700);
    sfx().rumble(5);
    services.music.play('ample');
    if (!gentle) cam.shake(1800, 0.005);
    drawFire(1.3);
    const lift = s.tween({ targets: rocket, y: rocket.y - 1500, duration: 4600, ease: 'Quad.In' });
    s.tweens.add({ targets: flames, y: -1500, duration: 4600, ease: 'Quad.In' });
    await lift;

    // La caméra accompagne la montée, traverse les nuages puis révèle la courbure de la Terre.
    for (const o of objs) o.destroy();
    const high = s.add.graphics().setDepth(11);
    high.fillGradientStyle(0x0b1230, 0x0b1230, 0x5d8fc8, 0x5d8fc8, 1);
    high.fillRect(0, 0, 1920, 1080);
    const earth = s.add.circle(960, 3600, 2500, 0x3d7fb8).setStrokeStyle(30, 0x9fd3ec, 0.6).setDepth(12);
    const ship = s.prop('saturn_v', 960, 520, 160, 420, 14);
    const clouds = [0, 1, 2, 3, 4].map((i) => s.add.ellipse(300 + i * 360, -150 - i * 140, 420, 130, C.white, 0.9).setDepth(15));
    s.tweens.add({ targets: clouds, y: '+=1500', duration: 2600, ease: 'Sine.In' });
    s.tweens.add({ targets: earth, y: 3300, duration: 5000, ease: 'Sine.Out' });
    await s.wait(1600);
    // Des ellipses montrent les séparations des étages.
    const sepNarration = s.say('c3_4_etages');
    // Premier étage : 42 m sur 111 ; deuxième : 25 m. L'étage lâché est la partie basse de la même image.
    let kept = 1;
    for (const keep of [0.62, 0.39]) {
      await s.wait(900);
      const stage = s.add
        .image(ship.x, ship.y, 'saturn_v')
        .setScale(ship.scaleX, ship.scaleY)
        .setDepth(13)
        .setCrop(0, ship.height * keep, ship.width, ship.height * (kept - keep));
      ship.setCrop(0, 0, ship.width, ship.height * keep);
      kept = keep;
      sfx().whoosh();
      s.tweens.add({ targets: stage, y: stage.y + 560, angle: 25, alpha: 0, duration: 1800, ease: 'Sine.In' });
      // La fusée, plus légère, file un peu plus haut.
      s.tweens.add({ targets: ship, y: ship.y - 90, duration: 900, ease: 'Sine.Out' });
    }
    await sepNarration;
    await s.wait(800);

    // Retour au laboratoire.
    await s.tween({ targets: cam, alpha: 0, duration: 600 });
    for (const o of [high, earth, ship, ...clouds]) o.destroy();
    l.show(true);
    const margaret = s.char('margaret', 'joie');
    const collegue = s.char('collegue', 'stupefait');
    await s.tween({ targets: cam, alpha: 1, duration: 600 });
    await s.wait(500);
    collegue.setPose('enthousiaste');
    await s.say('c3_4_parti');
    margaret.setPose('neutre');
    collegue.setPose('neutre');
  },
};

// ---------------------------------------------------------------------------
// C3.5 — Un message depuis l'espace (voyage réel, dialogue romancé)
// ---------------------------------------------------------------------------

const c3_5: SceneScript = {
  id: 'c3.5',
  estMs: 40_000,
  async run(s) {
    const l = lab3(s);
    const cam = s.cameras.main;
    const margaret = s.char('margaret', 'neutre');
    const collegue = s.char('collegue', 'neutre');
    // Le grondement laisse place à la radio.
    services.music.play('calme');
    sfx().crackle(1);
    await s.wait(900);
    await s.say('c3_5_message');
    margaret.setPose('joie');
    collegue.setPose('soulage');
    await s.wait(900);

    // Ellipse : la mise en route vers la Lune, Columbia et Eagle assemblés, plusieurs jours qui passent.
    await s.tween({ targets: cam, alpha: 0, duration: 500 });
    l.show(false);
    const space = s.add.rectangle(960, 540, 1920, 1080, C.nightDeep).setDepth(11);
    const stars = s.add.graphics().setDepth(11);
    stars.fillStyle(C.cream, 0.9);
    for (let i = 0; i < 90; i++) stars.fillCircle((i * 397) % 1920, (i * 233) % 1080, 1.5 + (i % 3));
    const earth = s.add.circle(170, 880, 150, 0x3d7fb8).setStrokeStyle(8, 0x9fd3ec).setDepth(12);
    const moon = s.add.circle(1720, 300, 70, 0xd9d6cf).setStrokeStyle(6, 0xa9a59c).setDepth(12);
    const ship = s.prop('columbia_eagle', 380, 760, 260, 140, 13).setAngle(-18);
    // Trois soleils en bas de l'écran : un par jour de voyage, ils s'allument l'un après l'autre.
    const days = [0, 1, 2].map((i) => {
      const g = s.add.graphics().setDepth(14).setPosition(840 + i * 120, 980).setAlpha(0.3);
      g.lineStyle(6, C.mustard, 1);
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        g.lineBetween(Math.cos(a) * 30, Math.sin(a) * 30, Math.cos(a) * 44, Math.sin(a) * 44);
      }
      g.fillStyle(C.mustard, 1);
      g.fillCircle(0, 0, 22);
      return g;
    });
    await s.tween({ targets: cam, alpha: 1, duration: 600 });
    const travel = s.tween({ targets: ship, x: 1450, y: 380, duration: 9000, ease: 'Sine.InOut' });
    days.forEach((d, i) =>
      s.time.delayedCall(800 + i * 2800, () => {
        d.setAlpha(1).setScale(1.3);
        s.tweens.add({ targets: d, scale: 1, duration: 300, ease: 'Back.Out' });
        sfx().pop(4 + i);
      }),
    );
    s.tweens.add({ targets: moon, scale: 1.6, duration: 9000, ease: 'Sine.In' });
    await s.say('c3_5_columbia');
    await s.say('c3_5_voyage');
    await travel;

    // La radio grésille légèrement. La Lune apparaît au loin ; la musique laisse une attente douce.
    sfx().crackle(0.8);
    await s.wait(600);
    await s.say('c3_5_etape');
    await s.wait(1200);
    await s.tween({ targets: cam, alpha: 0, duration: 600 });
    for (const o of [space, stars, earth, moon, ship, ...days]) o.destroy();
    l.show(true);
    margaret.setPose('neutre');
    collegue.setPose('neutre');
    await s.tween({ targets: cam, alpha: 1, duration: 500 });
  },
};

export const chapter3: ChapterScript = { id: 'c3', scenes: [c3_1, c3_2, c3_3, c3_4, c3_5] };
