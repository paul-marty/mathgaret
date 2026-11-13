import * as Phaser from 'phaser';
import { C, textStyle } from '../config';
import { NumberPicker, type AnswerUI } from '../engine/answers';
import { runChallenge, type ChallengeSpec } from '../engine/challenge';
import {
  advance,
  RADIO_MAX,
  remove,
  removeFollowUp,
  TRACK_MAX,
  voyage,
  type AdvanceParams,
  type Profile,
  type RemoveParams,
  type VoyageParams,
} from '../math/families';
import type { StoryScene } from '../scenes/StoryScene';
import { services } from '../services';
import { cover, EQUIPMENT, fit } from '../view/assets';
import { Hotspot } from '../view/Hotspot';
import { FlightView, FunctionPanel, SimFrame, Track, TransferBoard, zoneOf } from '../view/widgets-c2';
import { BrakeGauge, FuelBoard, pathRocket, RadioDial, STAR_POS, STAR_START, StarOption, StarPathAnswer } from '../view/widgets-voyage';
import type { LoopHandle } from '../audio/Sfx';
import { calmVeil, papersSurprise } from './common';
import type { ChapterScript, SceneScript } from './types';

/**
 * Chapitre 2 — L'ordinateur d'Apollo (document de référence, section 8 et P18).
 * Préparer les instructions, le souvenir de Lauren, le bug de la fusée simulée, puis le grand test.
 */

const sfx = () => services.sfx;
type Img = Phaser.GameObjects.Image;

// ---------------------------------------------------------------------------
// Le laboratoire du chapitre 2 : l'ordinateur d'Apollo et l'écran de simulation
// ---------------------------------------------------------------------------

interface Lab2 {
  ordinateur: Img;
  ecran: Img;
  imprimante: Img;
  /** Fusée miniature affichée sur l'écran de simulation. */
  simRocket: Img;
  functions: FunctionPanel;
  hum: LoopHandle;
}

const labs = new WeakMap<StoryScene, Lab2>();

function lab2(s: StoryScene): Lab2 {
  const existing = labs.get(s);
  if (existing) return existing;
  void s.setBg('labo');
  const ecran = s.prop('ecran_simulation', 1170, 500, 520, 430, 9);
  const ordinateur = s.prop('ordinateur_apollo', 600, 690, 380, 400, 11);
  const imprimante = s.prop('imprimante', 1420, 790, 250, 230, 11);
  const z = zoneOf(ecran, 'ecran');
  // Contenu de l'écran : un quadrillage et quelques étoiles, la Terre en bas.
  const screen = s.add.graphics().setDepth(10);
  screen.fillStyle(0x16324a, 1);
  screen.fillRoundedRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h, 24);
  screen.lineStyle(2, C.mint, 0.25);
  for (let x = z.x - z.w / 2 + 40; x < z.x + z.w / 2; x += 40) screen.lineBetween(x, z.y - z.h / 2 + 6, x, z.y + z.h / 2 - 6);
  for (let y = z.y - z.h / 2 + 40; y < z.y + z.h / 2; y += 40) screen.lineBetween(z.x - z.w / 2 + 6, y, z.x + z.w / 2 - 6, y);
  screen.fillStyle(0x3d7fb8, 1);
  screen.fillEllipse(z.x, z.y + z.h / 2 - 12, z.w * 0.8, 40);
  const simRocket = fit(s.add.image(z.x, z.y + z.h * 0.18, 'fusee_sim'), z.w * 0.16, z.h * 0.42).setDepth(11).setVisible(false);
  const functions = new FunctionPanel(s, 760, 128).setDepth(31);
  const hum = sfx().hum();
  s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => hum.stop());
  const l: Lab2 = { ordinateur, ecran, imprimante, simRocket, functions, hum };
  labs.set(s, l);
  // La scène Phaser relancée (reprise, console) détruit ces objets : ils seront recréés.
  s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => labs.delete(s));
  return l;
}

/** La fusée miniature apparaît sur l'écran de simulation. */
async function showSimRocket(s: StoryScene, l: Lab2): Promise<void> {
  const r = l.simRocket;
  if (r.visible) return;
  const target = r.scale;
  r.setVisible(true).setScale(0).setAngle(0);
  await s.tween({ targets: r, scale: target, duration: 500, ease: 'Back.Out' });
}

function labSurprises(s: StoryScene, l: Lab2, frame: SimFrame | null): void {
  s.surprises = [
    papersSurprise(s),
    {
      id: 'bip',
      play: async () => {
        sfx().beeps(1, true);
        const k = l.functions.lit;
        l.functions.all('alert');
        s.char('collegue', 'stupefait');
        await s.wait(500);
        await s.say('ms_bip');
        l.functions.all('off');
        for (let i = 0; i < k; i++) l.functions.set(i, 'on');
        s.char('collegue', 'explique');
      },
    },
    {
      id: 'rouleau',
      play: async () => {
        // Rappel maîtrisé de C1.3 : une courte bande, attrapée cette fois sans difficulté.
        const p = l.imprimante;
        const strip = s.add.rectangle(p.x, p.y - p.displayHeight * 0.38, 120, 10, C.white).setStrokeStyle(2, 0x9cc9a8).setOrigin(0.5, 1).setDepth(21);
        const printing = sfx().printer(1.1);
        await s.tween({ targets: strip, height: 150, duration: 1000 });
        printing.stop();
        const c = s.char('collegue', 'enthousiaste');
        await s.tween({ targets: strip, x: c.x - 120, y: c.y - 320, angle: -20, duration: 450, ease: 'Back.Out' });
        await s.say('ms_rouleau');
        await s.tween({ targets: strip, alpha: 0, duration: 300 });
        strip.destroy();
        s.char('collegue', 'explique');
      },
    },
    ...(frame ? [frameRocketSurprise(s, frame)] : []),
  ];
}

/** Micro-surprise « La petite fusée de l'écran » : un petit tour dans le cadre de la simulation. */
function frameRocketSurprise(s: StoryScene, frame: SimFrame): { id: string; play: () => Promise<void> } {
  return {
    id: 'petite_fusee',
    play: async () => {
      const x0 = frame.x - frame.getBounds().width / 2 + 120;
      const y0 = frame.y - frame.getBounds().height / 2 + 60;
      const r = fit(s.add.image(x0, y0, 'fusee_sim'), 60, 90).setDepth(frame.depth + 1).setAlpha(0);
      await s.tween({ targets: r, alpha: 1, duration: 200 });
      s.chars.margaret?.setPose('joie');
      await s.tween({ targets: r, angle: 360, x: x0 + 140, duration: 1000, ease: 'Sine.InOut', yoyo: true });
      await s.tween({ targets: r, alpha: 0, duration: 250 });
      r.destroy();
      s.chars.margaret?.setPose('neutre');
    },
  };
}

async function closeFrame(s: StoryScene, frame: SimFrame): Promise<void> {
  await s.tween({ targets: frame, alpha: 0, duration: 400 });
  frame.destroy();
}

const answerMax = (profile: Profile, fin: number) => (profile === 'debut' ? 10 : profile === 'milieu' ? 20 : fin);

// ---------------------------------------------------------------------------
// C2.1 — Une machine extraordinaire : préparer les équipements (retirer, deux étapes en fin de CP)
// ---------------------------------------------------------------------------

function instructionsSpec(s: StoryScene, l: Lab2): ChallengeSpec<RemoveParams, number> {
  let board: TransferBoard | null = null;
  let problem = 0;
  /** Deuxièmes étapes (fin de CP) : elles complètent le tableau de la première. */
  const seconds = new WeakSet<RemoveParams>();
  return {
    id: 'c2_instructions',
    family: remove,
    gesture: 'tuto_reponse',
    nextIntro: 'c2_1_autre',
    maxProblems: FunctionPanel.COUNT - 1,
    followUp(p) {
      const next = removeFollowUp(p);
      if (next) seconds.add(next);
      return next;
    },
    async build(p, index) {
      calmVeil(s, true);
      if (seconds.has(p) && board) {
        // Deuxième opération : le premier résultat reste affiché, puis certains restants sont contrôlés.
        await s.wait(300);
        await board.check(p.minus);
        return;
      }
      problem = index;
      board = new TransferBoard(s, 980, 535, {
        w: 860,
        h: 500,
        total: p.total,
        texture: EQUIPMENT[index % EQUIPMENT.length],
        taken: 'compartiment',
        capacity: Math.max(p.minus, p.total - p.minus),
      })
        .setDepth(30)
        .setAlpha(0);
      await s.tween({ targets: board, alpha: 1, duration: 350 });
      await s.wait(300);
      // La transformation se voit : une partie des équipements est installée dans le compartiment.
      await board.take(p.minus);
    },
    consigne: (p) => ({ id: seconds.has(p) ? 'c2_1_consigne_2' : 'c2_1_consigne', vars: { total: p.total, minus: p.minus } }),
    answer: (_p, onValidate) => new NumberPicker(s, { max: answerMax(s.profile, 40), tens: s.profile === 'fin', onValidate }),
    async success(p) {
      await board!.settle();
      if (removeFollowUp(p)) return;
      // Problème terminé : la fonction correspondante de l'ordinateur s'anime.
      board!.ready();
      s.char('collegue', 'enthousiaste');
      s.char('margaret', 'joie');
      await l.functions.activate(problem);
      await s.say('c2_1_succes');
      s.char('margaret', 'neutre');
      s.char('collegue', 'explique');
    },
    async error(_p, a) {
      // Le compartiment reste en attente ; les quantités à examiner sont montrées.
      const { missing, extra } = await board!.countAnswer(a);
      s.char('collegue', 'inquiet');
      if (missing > 0) await s.say(missing === 1 ? 'c2_1_peu_1' : 'c2_1_peu', { n: a, k: missing });
      else await s.say(extra === 1 ? 'c2_1_trop_1' : 'c2_1_trop', { n: a, k: extra });
      s.char('collegue', 'explique');
    },
    resetAfterError() {
      board?.resetMarks();
    },
    async help(p, level, ui) {
      s.char('collegue', 'explique');
      if (level === 1) await s.say(seconds.has(p) ? 'c2_1_aide_1_2' : 'c2_1_aide_1', { total: p.total, minus: p.minus });
      else if (level === 2) {
        board!.showPool();
        await s.say('c2_1_aide_2');
      } else if (level === 3) {
        await s.say('gen_compter');
        await board!.countPool();
      } else {
        const answer = p.total - p.minus;
        ui.set(answer);
        await s.say('c2_1_aide_4', { answer });
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

const c2_1: SceneScript = {
  id: 'c2.1',
  estMs: 55_000,
  challenge: { id: 'c2_instructions', family: 'retirer' },
  async run(s) {
    const l = lab2(s);
    const done = s.run.challengeDone['c2_instructions'] ?? 0;
    for (let i = 0; i < done; i++) l.functions.set(i, 'on');
    services.music.play('leger');
    const collegue = s.char('collegue', 'neutre');
    await s.wait(600);
    await s.say('c2_1_lieu');
    // Margaret retrouve le Collègue devant la machine.
    const margaret = s.char('margaret', 'neutre');
    await margaret.enter('left', 1300);
    // Des boutons s'éclairent dans un ordre doux. Une fusée miniature apparaît sur l'écran de simulation.
    await l.functions.sweep();
    await showSimRocket(s, l);
    collegue.setPose('enthousiaste');
    collegue.hop();
    const machine = new Hotspot(s, l.ordinateur);
    machine.highlight(true);
    await s.say('c2_1_machine');
    collegue.setPose('explique');
    // « Tu es prête ? » : l'enfant répond en touchant l'ordinateur (déjà possible pendant la question).
    const pressed = s.waitForPress([machine], { reminder: 'c2_1_toucher', reminderMs: 9000 });
    await s.say('c2_1_pret');
    await pressed;
    machine.highlight(false);
    machine.destroy();
    sfx().select();
    sfx().beeps(3);
    margaret.setPose('joie');
    await s.say('c2_1_liste');
    margaret.setPose('neutre');

    // Entrée dans la simulation (P1) : cadre distinctif, icône de maquette, annonce.
    calmVeil(s, true);
    const frame = new SimFrame(s, 980, 520, 920, 580).setDepth(29);
    await frame.appear();
    await s.say('sim_regardons');
    labSurprises(s, l, frame);
    await runChallenge(s, instructionsSpec(s, l));
    await closeFrame(s, frame);
    calmVeil(s, false);

    // Clôture : toutes les fonctions s'allument, on peut lancer un essai.
    services.music.play('leger');
    for (let i = l.functions.lit; i < FunctionPanel.COUNT; i++) {
      l.functions.set(i, 'on');
      sfx().pop(i);
      await s.wait(160);
    }
    sfx().chord();
    collegue.setPose('enthousiaste');
    await s.say('c2_1_cloture');
    collegue.setPose('neutre');
  },
};

// ---------------------------------------------------------------------------
// Souvenir de Lauren (P18) : entre C2.1 et C2.2
// ---------------------------------------------------------------------------

const c2_lauren: SceneScript = {
  id: 'c2.lauren',
  estMs: 45_000,
  async run(s) {
    const l = lab2(s);
    l.functions.all('on');
    const cam = s.cameras.main;
    const margaret = s.char('margaret', 'reflechit');
    const collegue = s.char('collegue', 'neutre');
    await s.wait(700);
    // Margaret regarde l'écran de simulation, pensive : on entre dans un souvenir.
    services.music.stop(0.8);
    sfx().memory();
    await s.tween({ targets: cam, alpha: 0, duration: 800 });

    // Le même laboratoire, quelques années plus tôt : couleurs chaudes, bords adoucis.
    const memory: Phaser.GameObjects.GameObject[] = [];
    const bg = cover(s.add.image(960, 540, 'labo')).setDepth(14);
    const warm = s.add.rectangle(960, 540, 1920, 1080, 0xc8955a, 0.3).setDepth(14);
    const ecran = s.prop('ecran_simulation', 1240, 450, 480, 400, 15);
    const z = zoneOf(ecran, 'ecran');
    const screen = s.add.graphics().setDepth(16);
    screen.fillStyle(0x16324a, 1);
    screen.fillRoundedRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h, 22);
    const flying = fit(s.add.image(z.x - z.w * 0.3, z.y + z.h * 0.2, 'fusee_sim'), z.w * 0.14, z.h * 0.36).setDepth(17).setAngle(45);
    const pupitre = s.prop('pupitre_simulateur', 1130, 830, 460, 320, 18);
    const vignette = s.add.graphics().setDepth(45);
    for (let i = 0; i < 30; i++) {
      vignette.lineStyle(18, 0x2a1a0a, 0.035);
      vignette.strokeRect(i * 9, i * 9, 1920 - i * 18, 1080 - i * 18);
    }
    memory.push(bg, warm, ecran, screen, flying, pupitre, vignette);
    collegue.setVisible(false);
    l.functions.setVisible(false);
    margaret.setPose('neutre').setX(520);
    const lauren = s.char('lauren', 'neutre').setX(1000);
    await s.tween({ targets: cam, alpha: 1, duration: 900 });
    services.music.play('mystere');
    await s.say('c2_l_narration');

    // Le vol est déjà simulé : la petite fusée traverse l'écran.
    const flight = s.tweens.add({ targets: flying, x: z.x + z.w * 0.3, y: z.y - z.h * 0.25, duration: 2600, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
    await s.wait(1600);
    // Lauren actionne un programme de préparation au départ.
    lauren.setPose('appuie');
    const b = zoneOf(pupitre, 'bouton');
    const glow = s.add.circle(b.x, b.y, b.w * 0.75, C.mustard, 0.7).setDepth(19);
    memory.push(glow);
    sfx().select();
    await s.tween({ targets: glow, scale: 1.4, alpha: 0, duration: 500 });
    // L'écran se fige.
    flight.stop();
    services.music.stop(0.2);
    sfx().softError();
    screen.fillStyle(0x8a93a6, 0.55);
    screen.fillRoundedRect(z.x - z.w / 2, z.y - z.h / 2, z.w, z.h, 22);
    screen.lineStyle(3, C.white, 0.4);
    for (let y = z.y - z.h / 2 + 14; y < z.y + z.h / 2; y += 18) screen.lineBetween(z.x - z.w / 2 + 10, y, z.x + z.w / 2 - 10, y);
    await s.wait(1300);
    lauren.setPose('gene');
    await s.say('c2_l_bouton');
    // Margaret se penche vers elle et regarde la machine avec curiosité.
    margaret.setPose('penchee');
    await s.tween({ targets: margaret, x: 700, duration: 900, ease: 'Sine.InOut' });
    await s.wait(900);
    await s.say('c2_l_important');
    lauren.setPose('neutre');
    services.music.play('calme');
    await s.say('c2_l_apollo8');
    await s.wait(500);

    // Retour au laboratoire du jeu.
    sfx().memory();
    await s.tween({ targets: cam, alpha: 0, duration: 800 });
    for (const o of memory) o.destroy();
    lauren.destroy();
    delete s.chars.lauren;
    margaret.setX(250).setPose('neutre');
    collegue.setVisible(true);
    l.functions.setVisible(true);
    services.music.play('leger');
    await s.tween({ targets: cam, alpha: 1, duration: 700 });
    collegue.setPose('explique');
    await s.say('c2_l_retour');
    collegue.setPose('neutre');
  },
};

// ---------------------------------------------------------------------------
// C2.2 — Oups ! Le bug mystérieux : rejoindre la balise (avancer sur une piste)
// ---------------------------------------------------------------------------

function bugSpec(s: StoryScene, at: { x: number; y: number }): ChallengeSpec<AdvanceParams, number> {
  let track: Track | null = null;
  return {
    id: 'c2_bug',
    family: advance,
    gesture: 'tuto_reponse',
    nextIntro: 'c2_2_autre',
    maxProblems: 4,
    async build(p) {
      calmVeil(s, true);
      track = new Track(s, at.x, at.y, s.profile).setDepth(30).setAlpha(0);
      track.placeRocket(p.from);
      track.placeBeacon(p.to);
      track.setWobble(true);
      await s.tween({ targets: track, alpha: 1, duration: 400 });
    },
    consigne: (p) => ({ id: 'c2_2_consigne', vars: { from: p.from, to: p.to } }),
    answer: (_p, onValidate) => new NumberPicker(s, { max: TRACK_MAX[s.profile], tens: s.profile === 'fin', onValidate }),
    async success(p, a) {
      // Le déplacement simulé montre l'effet de la réponse ; la fusée se stabilise, le repère passe au vert.
      track!.clearMarks();
      await track!.advance(a, p.to);
      track!.setWobble(false);
      track!.setBeacon('green');
      sfx().chord();
      s.char('collegue', 'soulage');
      await s.say('c2_2_succes');
      s.char('collegue', 'explique');
    },
    async error(p, a) {
      const { stop, missing, extra } = await track!.advance(a, p.to);
      s.char('collegue', 'inquiet');
      if (missing > 0) await s.say(missing === 1 ? 'c2_2_court_1' : 'c2_2_court', { stop, k: missing });
      else await s.say(extra === 1 ? 'c2_2_long_1' : 'c2_2_long', { stop, k: extra });
      s.char('collegue', 'explique');
      // Le test revient à son point de départ pour corriger le même problème.
      await track!.reset(p.from);
    },
    resetAfterError() {
      /* la fusée est déjà revenue au départ ; l'aide affichée reste visible */
    },
    async help(p, level, ui) {
      s.char('collegue', 'explique');
      if (level === 1) await s.say('c2_2_aide_1', { from: p.from, to: p.to });
      else if (level === 2) {
        track!.showPath(p.from, p.to);
        await s.say(track!.mode === 'grid' ? 'c2_2_aide_2_fin' : 'c2_2_aide_2');
      } else if (level === 3) {
        await s.say('gen_compter');
        await track!.countPath(p.from, p.to);
      } else {
        const answer = p.to - p.from;
        ui.set(answer);
        await s.say('c2_2_aide_4', { answer });
        services.focus.focus(ui.validateButton, { silent: true });
      }
    },
    async clear() {
      if (!track) return;
      const old = track;
      track = null;
      await s.tween({ targets: old, alpha: 0, duration: 350 });
      old.destroy();
    },
  };
}

const c2_2: SceneScript = {
  id: 'c2.2',
  estMs: 60_000,
  challenge: { id: 'c2_bug', family: 'avancer' },
  async run(s) {
    const l = lab2(s);
    l.functions.all('on');
    const cam = s.cameras.main;
    const gentle = services.save.data.settings.gentle;
    const margaret = s.char('margaret', 'neutre');
    const collegue = s.char('collegue', 'enthousiaste');
    services.music.play('leger');
    await showSimRocket(s, l);
    // L'essai commence : la fusée virtuelle s'élève…
    sfx().beeps(3);
    const r = l.simRocket;
    const home = { x: r.x, y: r.y };
    await s.tween({ targets: r, y: r.y - 40, duration: 1200, ease: 'Sine.InOut' });
    // … puis tourne sur elle-même. Les voyants deviennent orange, une alarme courte retentit.
    const spin = s.tweens.add({ targets: r, angle: '+=360', duration: 900, repeat: -1 });
    l.functions.all('alert');
    sfx().alarm();
    if (!gentle) cam.shake(250, 0.003);
    await s.wait(1100);
    services.music.play('mystere');
    // Le Collègue recule, serre ses papiers et regarde Margaret.
    collegue.setPose('inquiet');
    await s.tween({ targets: collegue, x: collegue.x + 70, duration: 500, ease: 'Sine.Out' });
    await s.wait(500);
    await s.say('c2_2_direction');
    margaret.setPose('reflechit');
    await s.say('c2_2_trouver');
    margaret.setPose('parle');
    await s.say('c2_2_tranquille');
    margaret.setPose('neutre');
    // La rotation ralentit, puis l'écran présente une piste lisible.
    spin.stop();
    await s.tween({ targets: r, angle: r.angle + 180, duration: 1600, ease: 'Cubic.Out' });
    await s.tween({ targets: collegue, x: collegue.x - 70, duration: 500, ease: 'Sine.Out' });
    collegue.setPose('explique');

    calmVeil(s, true);
    const grid = s.profile === 'fin';
    const width = s.profile === 'debut' ? 1300 : 1640;
    const frame = grid ? new SimFrame(s, 960, 455, 800, 480) : new SimFrame(s, 960, 340, width, 300);
    frame.setDepth(29);
    await frame.appear();
    await s.say('sim_regardons');
    labSurprises(s, l, frame);
    await runChallenge(s, bugSpec(s, grid ? { x: 960, y: 455 } : { x: 960, y: 355 }));
    await closeFrame(s, frame);
    calmVeil(s, false);

    // Clôture : la fusée retrouve son orientation, les voyants repassent au vert, le Collègue se détend.
    services.music.play('leger');
    await s.tween({ targets: r, angle: 0, x: home.x, y: home.y, duration: 900, ease: 'Back.Out' });
    l.functions.all('on');
    sfx().chord();
    collegue.setPose('applaudit');
    margaret.setPose('joie');
    await s.say('c2_2_bravo');
    collegue.setPose('soulage');
    margaret.setPose('neutre');
    await s.wait(600);
  },
};

// ---------------------------------------------------------------------------
// C2.3 — Le grand test : tout le voyage simulé, un contrôle par phase
// ---------------------------------------------------------------------------

/** Position de la fusée sur sa trajectoire après chaque contrôle validé. */
const FLIGHT = [0, 0.22, 0.44, 0.66, 0.86];
const PROBLEM_DEPTH = 31;

/**
 * Chaque phase du vol a son objet : le plein (addition), la radio de Houston (compléter),
 * les étoiles repères (ranger), le freinage près de la Lune (retirer).
 */
function voyageSpec(s: StoryScene, flight: FlightView): ChallengeSpec<VoyageParams, number | number[]> {
  let fuel: FuelBoard | null = null;
  let brake: BrakeGauge | null = null;
  let radio: RadioDial | null = null;
  let stars: StarOption[] = [];
  let starAns: StarPathAnswer | null = null;
  let pathShip: Img | null = null;
  let problem = 0;
  const fin = s.profile === 'fin';

  const appear = async (o: Phaser.GameObjects.Container) => {
    o.setDepth(PROBLEM_DEPTH).setAlpha(0);
    await s.tween({ targets: o, alpha: 1, duration: 350 });
  };
  const showSolution = (ui: AnswerUI<number | number[]>, answer: number | number[]) => {
    ui.set(answer);
    services.focus.focus(ui.validateButton, { silent: true });
  };

  /** La petite fusée suit le chemin des étoiles ; `wobble` : elle se perd. */
  const followStars = async (order: number[], wobble: boolean) => {
    const ship = pathShip;
    if (!ship) return;
    const trail = s.add.graphics().setDepth(PROBLEM_DEPTH - 1);
    let from = { x: ship.x, y: ship.y };
    for (const [rank, i] of order.entries()) {
      const star = stars[i];
      const to = { x: star.x, y: star.y };
      ship.setAngle(Phaser.Math.RadToDeg(Math.atan2(to.y - from.y, to.x - from.x)) + 90);
      await s.tween({ targets: ship, x: to.x, y: to.y, duration: 520, ease: 'Sine.InOut' });
      trail.lineStyle(10, wobble ? C.orange : C.mint, 1);
      trail.lineBetween(from.x, from.y, to.x, to.y);
      if (!wobble) {
        sfx().pop(rank * 3 + 4);
        s.tweens.add({ targets: star, scale: 1.15, duration: 160, yoyo: true });
      }
      from = to;
    }
    if (wobble) {
      sfx().softError();
      await s.tween({ targets: ship, angle: ship.angle + 360, duration: 700, ease: 'Sine.InOut' });
    }
    await s.wait(300);
    trail.destroy();
    if (wobble) {
      ship.setPosition(STAR_START.x, STAR_START.y).setAngle(90);
    }
  };

  return {
    id: 'c2_test',
    family: voyage,
    gesture: (p) => (p.kind === 'etoiles' ? 'tuto_ordre' : 'tuto_reponse'),
    nextIntro: 'c2_3_suite',
    maxProblems: FLIGHT.length - 1,
    async build(p, index) {
      problem = index;
      calmVeil(s, true);
      switch (p.kind) {
        case 'plein':
          fuel = new FuelBoard(s, s.profile, p.a, p.b);
          await appear(fuel);
          break;
        case 'radio':
          radio = new RadioDial(s, s.profile, p.deja, p.total);
          await appear(radio);
          sfx().crackle(1.2);
          break;
        case 'etoiles':
          pathShip = pathRocket(s, STAR_START, PROBLEM_DEPTH + 1).setAlpha(0);
          stars = p.cards.map((v, i) => new StarOption(s, STAR_POS[i].x, STAR_POS[i].y, v, () => starAns?.toggle(i)).setDepth(PROBLEM_DEPTH).setAlpha(0));
          await s.tween({ targets: [...stars, pathShip], alpha: 1, duration: 400 });
          stars.forEach((star, i) => s.tweens.add({ targets: star, scale: 1.08, duration: 180, yoyo: true, delay: i * 160 }));
          break;
        case 'freinage':
          brake = new BrakeGauge(s, s.profile, p.total, p.minus);
          await appear(brake);
          await s.wait(300);
          // Le moteur brûle sa part de carburant avant la question (les données se voient quand elles sont dites).
          await brake.burn();
          break;
      }
    },
    consigne: (p): { id: string; vars?: Record<string, number> } => {
      switch (p.kind) {
        case 'plein':
          return { id: 'c2_3_plein', vars: { a: p.a, b: p.b } };
        case 'radio':
          return { id: 'c2_3_radio', vars: { total: p.total, deja: p.deja } };
        case 'etoiles':
          return { id: 'c2_3_etoiles' };
        case 'freinage':
          return { id: 'c2_3_freinage', vars: { total: p.total, minus: p.minus } };
      }
    },
    answer: (p, onValidate) => {
      if (p.kind === 'etoiles') {
        starAns = new StarPathAnswer(s, stars, STAR_START, PROBLEM_DEPTH, onValidate);
        return starAns;
      }
      const max = p.kind === 'radio' ? RADIO_MAX[s.profile] : answerMax(s.profile, 100);
      return new NumberPicker(s, { max, tens: fin, onValidate });
    },
    async success(p, a) {
      flight.hold(false);
      switch (p.kind) {
        case 'plein':
          await fuel!.fill();
          break;
        case 'radio':
          await radio!.turn(a as number, p.total);
          await radio!.tuned();
          await s.say('c2_3_houston');
          break;
        case 'etoiles':
          await followStars(stars.map((_, i) => i).sort((x, y) => p.cards[x] - p.cards[y]), false);
          break;
        case 'freinage':
          await brake!.settle();
          break;
      }
      sfx().chord();
    },
    async error(p, a) {
      // L'essai se met en attente au point concerné.
      flight.hold(true);
      s.char('collegue', 'inquiet');
      switch (p.kind) {
        case 'plein': {
          const n = a as number;
          const { missing, extra } = await fuel!.pour(n);
          if (missing > 0) await s.say(missing === 1 ? 'c2_3_plein_peu_1' : 'c2_3_plein_peu', { n, k: missing });
          else await s.say(extra === 1 ? 'c2_3_plein_trop_1' : 'c2_3_plein_trop', { n, k: extra });
          break;
        }
        case 'radio': {
          const { missing, extra } = await radio!.turn(a as number, p.total);
          if (missing > 0) await s.say(missing === 1 ? 'c2_3_radio_court_1' : 'c2_3_radio_court', { k: missing });
          else await s.say(extra === 1 ? 'c2_3_radio_long_1' : 'c2_3_radio_long', { k: extra });
          break;
        }
        case 'etoiles':
          await followStars(starAns?.chosen() ?? [], true);
          await s.say('c2_3_etoiles_erreur');
          break;
        case 'freinage': {
          const n = a as number;
          const { missing, extra } = await brake!.countAnswer(n);
          if (missing > 0) await s.say(missing === 1 ? 'c2_3_freinage_peu_1' : 'c2_3_freinage_peu', { n, k: missing });
          else await s.say(extra === 1 ? 'c2_3_freinage_trop_1' : 'c2_3_freinage_trop', { n, k: extra });
          break;
        }
      }
    },
    resetAfterError(p) {
      if (p.kind === 'plein') fuel?.resetMarks();
      else if (p.kind === 'radio') radio?.reset();
      else if (p.kind === 'etoiles') starAns?.reset();
      else brake?.clearMarks();
    },
    async help(p, level, ui) {
      s.char('collegue', 'explique');
      const answer = voyage.answer(p);
      switch (p.kind) {
        case 'plein':
          if (level === 1) await s.say('c2_3_aide_1_plein', { a: p.a, b: p.b });
          else if (level === 2) {
            fuel!.showGroups();
            await s.say(fin ? 'c2_3_aide_2_plein_fin' : 'c2_3_aide_2_plein');
          } else if (level === 3) {
            await s.say('c2_3_aide_3_plein', { a: p.a });
            await fuel!.countOn();
          } else {
            showSolution(ui, answer);
            await s.say('c2_3_aide_4_plein', { a: p.a, b: p.b, answer: answer as number });
          }
          break;
        case 'radio':
          if (level === 1) await s.say('c2_3_aide_1_radio', { deja: p.deja, total: p.total });
          else if (level === 2) {
            radio!.showPath();
            await s.say('c2_3_aide_2_radio');
          } else if (level === 3) {
            await s.say('gen_compter');
            await radio!.countPath();
          } else {
            showSolution(ui, answer);
            await s.say('c2_3_aide_4_radio', { answer: answer as number });
          }
          break;
        case 'etoiles':
          if (level === 1) await s.say('c2_3_aide_1_etoiles');
          else if (level === 2) {
            await s.say(fin ? 'c2_3_aide_2_etoiles_fin' : 'c2_3_aide_2_reperes');
            for (const star of stars) s.tweens.add({ targets: star.reps, scale: star.reps.scale * 1.3, duration: 300, yoyo: true, repeat: 1 });
          } else if (level === 3) {
            await s.say(fin ? 'c1_3_aide_3_fin' : 'c2_3_aide_3_reperes');
            for (const star of stars) {
              s.tweens.add({ targets: star, scale: 1.1, duration: 200, yoyo: true });
              await services.voice.sayNumber(fin ? Math.floor(star.value / 10) : star.value);
              await s.wait(400);
            }
          } else {
            showSolution(ui, answer);
            await s.say('c2_3_aide_4_etoiles');
          }
          break;
        case 'freinage':
          if (level === 1) await s.say('c2_3_aide_1_freinage', { total: p.total, minus: p.minus });
          else if (level === 2) {
            brake!.showRest();
            await s.say('c2_3_aide_2_freinage');
          } else if (level === 3) {
            await s.say('gen_compter');
            await brake!.countRest();
          } else {
            showSolution(ui, answer);
            await s.say('c2_3_aide_4_freinage', { answer: answer as number });
          }
          break;
      }
    },
    async clear() {
      const old: Phaser.GameObjects.GameObject[] = [fuel, brake, radio, pathShip, ...stars].filter((o): o is NonNullable<typeof o> => o !== null);
      fuel = null;
      brake = null;
      radio = null;
      pathShip = null;
      stars = [];
      starAns = null;
      await s.tween({ targets: old, alpha: 0, duration: 300 });
      for (const o of old) o.destroy();
      calmVeil(s, false);
      // Chaque contrôle validé fait avancer le vol simulé (le plein fait décoller la fusée).
      await advanceFlight(s, flight, FLIGHT[Math.min(problem + 1, FLIGHT.length - 1)]);
    },
  };
}

/** Le vol avance ; le premier contrôle fait décoller la fusée. */
async function advanceFlight(s: StoryScene, flight: FlightView, t: number): Promise<void> {
  if (t <= flight.t) return;
  if (flight.t === 0) {
    sfx().rumble(2.6);
    if (!services.save.data.settings.gentle) s.cameras.main.shake(600, 0.004);
  } else sfx().whoosh();
  await flight.flyTo(t, flight.t === 0 ? 2400 : 1600);
}

const c2_3: SceneScript = {
  id: 'c2.3',
  estMs: 70_000,
  challenge: { id: 'c2_test', family: 'voyage' },
  async run(s) {
    const l = lab2(s);
    l.functions.all('on');
    const cam = s.cameras.main;
    const margaret = s.char('margaret', 'neutre');
    const collegue = s.char('collegue', 'enthousiaste');
    services.music.play('leger');
    await showSimRocket(s, l);
    await s.say('c2_3_voyage');

    // La caméra entre dans l'écran de simulation, qui garde son cadre distinctif.
    const z = zoneOf(l.ecran, 'ecran');
    await s.tween({ targets: cam, zoom: 2.4, scrollX: z.x - 960, scrollY: z.y - 540, duration: 1500, ease: 'Sine.InOut' });
    sfx().whoosh();
    await s.tween({ targets: cam, alpha: 0, duration: 300 });
    cam.setZoom(1).setScroll(0, 0);
    margaret.setVisible(false);
    collegue.setVisible(false);
    l.functions.setVisible(false);
    const flight = new FlightView(s).setDepth(22);
    const frame = new SimFrame(s, 960, 540, 1900, 1060, { screen: false, iconInside: true }).setDepth(28);
    // Reprise : le vol repart du dernier contrôle validé.
    const done = s.run.challengeDone['c2_test'] ?? 0;
    if (done > 0) await flight.flyTo(FLIGHT[Math.min(done, FLIGHT.length - 1)], 1);
    await s.tween({ targets: cam, alpha: 1, duration: 500 });
    await frame.appear();
    await s.say('sim_regardons');
    s.surprises = [frameRocketSurprise(s, frame)];
    await runChallenge(s, voyageSpec(s, flight));

    // Les moments de départ, de voyage et d'arrivée restent visibles, quel que soit le nombre de contrôles.
    flight.hold(false);
    await advanceFlight(s, flight, Math.max(flight.t, FLIGHT[1]));
    await flight.flyTo(1, Math.max(1200, 4200 * (1 - flight.t)));
    // La simulation atteint son but : une musique de réussite remplace le ronronnement des machines.
    l.hum.stop();
    services.music.play('ample');
    sfx().success();
    await s.tween({ targets: flight.rocket, angle: flight.rocket.angle + 360, duration: 1400, ease: 'Sine.InOut' });
    await s.tween({ targets: frame.icon, scale: frame.icon.scale * 1.3, duration: 220, yoyo: true, repeat: 1 });
    await s.wait(900);

    // Retour au laboratoire.
    await s.tween({ targets: cam, alpha: 0, duration: 500 });
    flight.destroy();
    frame.destroy();
    margaret.setVisible(true).setPose('joie');
    collegue.setVisible(true).setPose('enthousiaste');
    l.functions.setVisible(true);
    await s.tween({ targets: cam, alpha: 1, duration: 500 });
    collegue.hop();
    await s.say('c2_3_fonctionne');

    // Un message de la NASA sort de l'imprimante.
    const p = l.imprimante;
    const card = s.add.container(p.x, p.y - p.displayHeight * 0.4).setDepth(32).setAlpha(0);
    const paper = s.add.graphics();
    paper.fillStyle(C.white, 1);
    paper.fillRoundedRect(-230, -90, 460, 180, 14);
    paper.lineStyle(4, C.ink, 1);
    paper.strokeRoundedRect(-230, -90, 460, 180, 14);
    const text = s.add.text(0, 0, 'MISSION APOLLO 11\npréparatifs du lancement', textStyle(34, { color: '#3a2a20', align: 'center' })).setOrigin(0.5);
    card.add([paper, text]);
    const printing = sfx().printer(1.4);
    await s.tween({ targets: card, alpha: 1, x: 960, y: 330, duration: 1200, ease: 'Cubic.Out' });
    printing.stop();
    margaret.setPose('surprise');
    await s.say('c2_3_nasa');
    margaret.setPose('joie');
    collegue.setPose('applaudit');
    await s.say('c2_3_ellipse');
    await s.wait(1200);
    await s.tween({ targets: card, alpha: 0, duration: 500 });
    card.destroy();
  },
};

export const chapter2: ChapterScript = { id: 'c2', scenes: [c2_1, c2_lauren, c2_2, c2_3] };
