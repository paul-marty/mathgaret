import * as Phaser from 'phaser';
import { C } from '../config';
import { ChoiceAnswer } from '../engine/answers';
import { runChallenge, type ChallengeSpec } from '../engine/challenge';
import {
  approach,
  approachFollowUp,
  capacity,
  capacityFollowUp,
  freeBefore,
  GAUGE_MAX,
  TRAY,
  TRAY_MAX,
  type ApproachParams,
  type CapacityParams,
  type TaskKind,
} from '../math/families';
import type { StoryScene } from '../scenes/StoryScene';
import { services } from '../services';
import { cover } from '../view/assets';
import { GROUND, LADDER, LANDING } from '../view/placeholders-c4';
import { SimFrame } from '../view/widgets-c2';
import {
  AlarmDisplay,
  alertWindow,
  ControlCard,
  CounterAnswer,
  DescentWindow,
  DestinationOption,
  EnergyGauge,
  GaugeAnswer,
  PanelLamps,
  TaskChip,
  WaitingZone,
  WorkTray,
} from '../view/widgets-c4';
import { lab3 } from './c3';
import { calmVeil, papersSurprise } from './common';
import type { ChapterScript, SceneScript } from './types';

/**
 * Chapitre 4 — Alerte sur la Lune ! (document de référence, section 8).
 * La Lune approche, l'alarme 1202, sauver les tâches essentielles, le moment de vérité, le premier pas.
 */

const sfx = () => services.sfx;
type GO = Phaser.GameObjects.GameObject;
type Box = Phaser.GameObjects.Container;

/** Fondu au noir (ou retour) de toute l'image : les cinématiques changent de plan derrière. */
export const fade = (s: StoryScene, to: 0 | 1, ms = 500) => s.tween({ targets: s.cameras.main, alpha: to, duration: ms });

export function destroyAll(objs: (GO | { destroy(): void } | null | undefined)[]): void {
  for (const o of objs) o?.destroy();
}

/** Un ciel noir étoilé plein écran (plans dans l'espace). */
export function starSky(s: StoryScene, depth = 11): Phaser.GameObjects.Graphics {
  const g = s.add.graphics().setDepth(depth);
  g.fillStyle(0x05070d, 1);
  g.fillRect(0, 0, 1920, 1080);
  g.fillStyle(C.cream, 0.9);
  for (let i = 0; i < 110; i++) g.fillCircle((i * 397) % 1920, (i * 233) % 1080, 1.2 + (i % 3) * 0.8);
  return g;
}

// ---------------------------------------------------------------------------
// Le cadre de la simulation (P1) et les fenêtres d'alerte, qui durent d'une scène à l'autre
// ---------------------------------------------------------------------------

const frames = new WeakMap<StoryScene, SimFrame>();

/** Le cadre de la simulation : il apparaît (ou il est déjà là). Laisse voir Margaret et le Collègue de part et d'autre. */
export async function simFrame(s: StoryScene): Promise<SimFrame> {
  const existing = frames.get(s);
  if (existing?.active) return existing;
  const f = new SimFrame(s, 960, 485, 1220, 770).setDepth(29);
  frames.set(s, f);
  s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => frames.delete(s));
  await f.appear();
  return f;
}

export async function dropFrame(s: StoryScene): Promise<void> {
  const f = frames.get(s);
  frames.delete(s);
  if (!f?.active) return;
  await s.tween({ targets: f, alpha: 0, duration: 400 });
  f.destroy();
}

const alerts = new WeakMap<StoryScene, Box[]>();
/** Dans les marges du laboratoire, autour du cadre de la simulation. */
const ALERT_SPOTS = [
  { x: 180, y: 210 },
  { x: 205, y: 395 },
  { x: 1750, y: 240 },
  { x: 1765, y: 380 },
];

/** Les fenêtres d'alerte restées ouvertes après l'alarme (créées si on arrive directement à la scène). */
function alertWindows(s: StoryScene): Box[] {
  const existing = alerts.get(s);
  if (existing) return existing;
  const wins = ALERT_SPOTS.map((p, i) => alertWindow(s, p.x, p.y, 22).setAngle(i % 2 ? 4 : -3));
  alerts.set(s, wins);
  s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => alerts.delete(s));
  return wins;
}

/** Les fenêtres d'alerte se ferment, `n` à la fois (toutes par défaut) : le désordre diminue. */
async function closeAlerts(s: StoryScene, n = Infinity): Promise<void> {
  const wins = alerts.get(s);
  if (!wins || wins.length === 0) return;
  const closing = wins.splice(Math.max(0, wins.length - n));
  sfx().pop(2);
  await s.tween({ targets: closing, scale: 0, alpha: 0, duration: 280, ease: 'Back.In' });
  destroyAll(closing);
}

// ---------------------------------------------------------------------------
// C4.1 — La Lune approche : prévoir ce qui restera dans la jauge d'énergie
// ---------------------------------------------------------------------------

/** Disposition dans le cadre : jauge à gauche, ses flèches, puis la vue de descente, les voyants et le contrôle. */
const GAUGE = { x: 470, y: 465 };
const ARROWS_X = 752;
const VIEW = { x: 1180, y: 375, w: 660, h: 360 };
const LAMPS_Y = 610;
const CARD = { x: 1180, y: 750 };

function approachSpec(s: StoryScene, view: DescentWindow, lamps: PanelLamps): ChallengeSpec<ApproachParams, number> {
  let gauge: EnergyGauge | null = null;
  let card: ControlCard | null = null;
  const fin = s.profile === 'fin';
  /** Deuxièmes contrôles (fin de CP) : la jauge garde ce qui restait après le premier. */
  const seconds = new WeakSet<ApproachParams>();

  const dropCard = async () => {
    if (!card) return;
    const old = card;
    card = null;
    await s.tween({ targets: old, alpha: 0, y: old.y + 30, duration: 250 });
    old.destroy();
  };

  return {
    id: 'c4_approche',
    family: approach,
    gesture: 'tuto_jauge',
    nextIntro: 'c4_1_suivant',
    maxProblems: 4,
    followUp(p) {
      const next = approachFollowUp(p);
      if (next) seconds.add(next);
      return next;
    },
    async build(p) {
      calmVeil(s, true);
      if (!seconds.has(p) || !gauge) {
        gauge = new EnergyGauge(s, GAUGE.x, GAUGE.y, s.profile, GAUGE_MAX[s.profile], p.total).setDepth(31).setAlpha(0);
        gauge.showCursor(false);
        await s.tween({ targets: gauge, alpha: 1, duration: 300 });
      }
      // Le prochain contrôle s'annonce, avec les unités qu'il utilisera.
      card = new ControlCard(s, CARD.x, CARD.y, p.control, p.minus).setDepth(31).setAlpha(0);
      sfx().beeps(1);
      await s.tween({ targets: card, alpha: 1, y: { from: CARD.y + 30, to: CARD.y }, duration: 300 });
    },
    consigne: (p) =>
      seconds.has(p)
        ? { id: 'c4_1_consigne_2', vars: { minus: p.minus } as Record<string, number> }
        : { id: 'c4_1_consigne', vars: { total: p.total, minus: p.minus } },
    answer: (_p, onValidate) => {
      gauge!.showCursor(true);
      return new GaugeAnswer(s, gauge!, ARROWS_X, fin, onValidate);
    },
    async success(p) {
      const g = gauge!;
      g.clearMarks();
      card!.mark(null);
      // Le contrôle prend ses unités : la jauge descend pile sur le repère, le contrôle s'allume.
      await Promise.all([g.drain(p.total - p.minus), card!.power()]);
      g.showCursor(false);
      await lamps.lightNext();
      // La vue de descente avance : la surface grossit.
      sfx().whoosh();
      await view.zoomTo(view.zoom * 1.3, 1200);
      if (!p.then) await s.say('c4_1_valide');
      await dropCard();
    },
    async error(p, a) {
      // Le contrôle reste en attente : la part prévue par l'enfant (orange) face à ce qu'il utilise vraiment.
      const g = gauge!;
      const k = p.total - a;
      g.mark(a, p.total, C.orange);
      card!.mark(C.orange);
      s.char('collegue', 'inquiet');
      if (k <= 0) await s.say('c4_1_rien', { n: a, minus: p.minus });
      else if (k < p.minus) await s.say(k === 1 ? 'c4_1_peu_1' : 'c4_1_peu', { n: a, k, minus: p.minus });
      else await s.say('c4_1_trop', { n: a, k, minus: p.minus });
      g.clearMarks();
      card!.mark(null);
      s.char('collegue', 'explique');
    },
    resetAfterError() {
      // La réserve est à recomposer : le repère revient au niveau actuel.
      gauge?.setCursor(null);
    },
    async help(p, level, ui) {
      s.char('collegue', 'explique');
      const answer = p.total - p.minus;
      if (level === 1) await s.say('c4_1_aide_1', { total: p.total, minus: p.minus });
      else if (level === 2) {
        gauge!.mark(answer, p.total, C.mint);
        await s.say(fin ? 'c4_1_aide_2_fin' : 'c4_1_aide_2');
      } else if (level === 3) {
        await s.say('gen_compter');
        await gauge!.countUnits(answer);
      } else {
        ui.set(answer);
        await s.say('c4_1_aide_4', { answer });
        services.focus.focus(ui.validateButton, { silent: true });
      }
    },
    async clear() {
      await dropCard();
      if (!gauge) return;
      const old = gauge;
      gauge = null;
      await s.tween({ targets: old, alpha: 0, duration: 300 });
      old.destroy();
    },
  };
}

const c4_1: SceneScript = {
  id: 'c4.1',
  estMs: 70_000,
  challenge: { id: 'c4_approche', family: 'prevoir' },
  async run(s) {
    const cam = s.cameras.main;
    // Écran sombre, respiration puis radio.
    services.music.stop(0.3);
    cam.setAlpha(0);
    const breath = sfx().breathing();
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => breath.stop());
    await s.wait(1800);
    sfx().crackle(1.2);
    await s.wait(1400);

    // Eagle au-dessus d'une surface grise immense.
    const surface = new DescentWindow(s, 960, 540, 1920, 1080, 11, LANDING, 1);
    const eagle = s.prop('eagle', 1120, 300, 380, 340, 13);
    services.music.play('mystere');
    await fade(s, 1, 1500);
    const drift = s.tween({ targets: eagle, x: 980, y: 400, duration: 7000, ease: 'Sine.InOut' });
    void surface.zoomTo(1.2, 7000);
    await s.say('c4_1_eagle');
    await drift;

    // Raccord : Columbia en orbite, avec Michael Collins à bord.
    await fade(s, 0);
    surface.destroy();
    eagle.destroy();
    const sky = starSky(s);
    const moon = s.add.circle(960, 2150, 1300, 0x9c9a94).setStrokeStyle(10, 0xc4c1b9).setDepth(12);
    const columbia = s.prop('columbia', 260, 420, 460, 220, 13).setAngle(-6);
    // Michael Collins, sur sa carte (comme en C3.1).
    const inset = s.add.graphics().setDepth(14);
    inset.fillStyle(0x000000, 0.3);
    inset.fillRoundedRect(1560 - 150 + 8, 120 + 10, 300, 400, 28);
    inset.fillStyle(0x2c4a72, 1);
    inset.fillRoundedRect(1560 - 150, 120, 300, 400, 28);
    inset.lineStyle(8, C.cream, 1);
    inset.strokeRoundedRect(1560 - 150, 120, 300, 400, 28);
    const collins = s.prop('astronaute_3', 1560, 320, 270, 380, 15);
    await fade(s, 1, 600);
    const orbit = s.tween({ targets: columbia, x: 1080, y: 470, duration: 8000, ease: 'Sine.InOut' });
    await s.say('c4_1_columbia');
    await orbit;

    // Au laboratoire du MIT, on suit la descente.
    await fade(s, 0);
    breath.stop();
    destroyAll([sky, moon, columbia, inset, collins]);
    const l = lab3(s);
    l.show(true);
    const margaret = s.char('margaret', 'surprise');
    const collegue = s.char('collegue', 'enthousiaste');
    services.music.play('leger');
    await fade(s, 1, 600);
    await s.say('c4_1_incroyable');

    // La simulation de la descente : la vue d'Eagle, les voyants du tableau, la jauge d'énergie.
    collegue.setPose('explique');
    margaret.setPose('reflechit');
    await simFrame(s);
    const view = new DescentWindow(s, VIEW.x, VIEW.y, VIEW.w, VIEW.h, 30, LANDING, 1).setAlpha(0);
    const lamps = new PanelLamps(s, VIEW.x, LAMPS_Y, s.profile === 'fin' ? 8 : 4).setDepth(31).setAlpha(0);
    await s.tween({ targets: [...view.parts, lamps], alpha: 1, duration: 400 });
    await s.say('sim_regardons');
    s.surprises = [papersSurprise(s)];
    await runChallenge(s, approachSpec(s, view, lamps));

    // La clôture des contrôles conduit à l'alarme (elle survient quelles que soient les erreurs).
    sfx().chord();
    collegue.setPose('enthousiaste');
    margaret.setPose('joie');
    await s.say('c4_1_fin');
    await s.tween({ targets: [...view.parts, lamps], alpha: 0, duration: 400 });
    view.destroy();
    lamps.destroy();
    await dropFrame(s);
    calmVeil(s, false);
    margaret.setPose('neutre');
    collegue.setPose('neutre');
  },
};

// ---------------------------------------------------------------------------
// C4.2 — L'alarme 1202 (alarmes historiques, dramatisation audiovisuelle)
// ---------------------------------------------------------------------------

/** Fenêtres de l'alarme, un peu partout sur la vue de descente. */
const BURST = [
  { x: 380, y: 220 },
  { x: 1500, y: 180 },
  { x: 1650, y: 520 },
  { x: 300, y: 560 },
  { x: 1180, y: 300 },
  { x: 650, y: 330 },
  { x: 1450, y: 820 },
  { x: 420, y: 860 },
];

const c4_2: SceneScript = {
  id: 'c4.2',
  estMs: 45_000,
  async run(s) {
    const l = lab3(s);
    const cam = s.cameras.main;
    const gentle = services.save.data.settings.gentle;
    // Retour dans la descente : Eagle au-dessus de la surface, qui s'est rapprochée.
    await fade(s, 0);
    l.show(false);
    const surface = new DescentWindow(s, 960, 540, 1920, 1080, 11, LANDING, 1.7);
    const eagle = s.prop('eagle', 960, 330, 340, 300, 13);
    services.music.play('mystere');
    await fade(s, 1, 700);
    await s.wait(1500);

    // Un bip bref rompt l'ambiance. Le panneau affiche « 1202 ». La musique s'arrête.
    sfx().beeps(1);
    const panel = new AlarmDisplay(s, 960, 760).setDepth(16).setAlpha(0);
    await s.tween({ targets: panel, alpha: 1, duration: 150 });
    panel.alarm('1202', true);
    services.music.stop(0.1);
    sfx().alarm();
    // Des fenêtres et des voyants apparaissent pendant quelques secondes : la surcharge se voit.
    const burst: Box[] = [];
    for (const [i, p] of BURST.entries()) {
      const w = alertWindow(s, p.x, p.y, 17).setScale(0).setAngle(i % 2 ? 5 : -4);
      burst.push(w);
      s.tweens.add({ targets: w, scale: 1, duration: 200, ease: 'Back.Out' });
      sfx().beeps(1, true);
      await s.wait(gentle ? 320 : 200);
    }
    if (!gentle) cam.shake(250, 0.003);
    await s.wait(1000);
    // Puis la composition se stabilise.
    panel.alarm('1202', false);
    sfx().crackle(0.6);
    await s.wait(300);
    await s.say('c4_2_alarme');

    // Au laboratoire, le Collègue s'exclame.
    const moduleShot: GO[] = [...surface.parts, eagle, panel, ...burst];
    for (const o of moduleShot) (o as Phaser.GameObjects.Image).setVisible(false);
    l.show(true);
    const margaret = s.char('margaret', 'surprise');
    const collegue = s.char('collegue', 'stupefait');
    alertWindows(s);
    if (!gentle) collegue.hop();
    await s.say('c4_2_trop_travail');

    // Les regards passent du module à Houston, puis au laboratoire.
    await fade(s, 0, 250);
    l.show(false);
    for (const w of alerts.get(s) ?? []) w.setVisible(false);
    for (const o of moduleShot) (o as Phaser.GameObjects.Image).setVisible(true);
    await fade(s, 1, 250);
    await s.wait(1300);
    await fade(s, 0, 250);
    for (const o of moduleShot) (o as Phaser.GameObjects.Image).setVisible(false);
    const houston = cover(s.add.image(960, 540, 'salle_controle')).setDepth(11);
    sfx().crackle(1);
    await fade(s, 1, 250);
    await s.wait(1600);
    await fade(s, 0, 250);
    destroyAll([houston, eagle, panel, ...burst]);
    surface.destroy();
    l.show(true);
    for (const w of alerts.get(s) ?? []) w.setVisible(true);
    margaret.setPose('reflechit');
    collegue.setPose('explique');
    await fade(s, 1, 400);
    await s.say('c4_2_equipe');

    // Le cadre de la simulation revient : le jeu montre le fonctionnement du programme préparé avant le départ.
    await simFrame(s);
    await s.say('c4_2_prepare');
    margaret.setPose('neutre');
    collegue.setPose('neutre');
  },
};

// ---------------------------------------------------------------------------
// C4.3 — Sauver les tâches essentielles : le plateau de travail de l'ordinateur
// ---------------------------------------------------------------------------

const CHIP_Y = 205;
const CHIP_X = [560, 840];
const TRAY_POS = { x: 820, y: 500 };
const COUNTER = { x: 1370, y: 520 };
const ZONE = { x: 1380, y: 295, w: 300, h: 220 };
const SECONDARY = { x: 1380, y: 575 };
const OPT_Y = 770;

function capacitySpec(s: StoryScene): ChallengeSpec<CapacityParams, number> {
  let tray: WorkTray | null = null;
  let chips: TaskChip[] = [];
  let zone: WaitingZone | null = null;
  let options: DestinationOption[] = [];
  let choice: ChoiceAnswer | null = null;
  let toldTray = false;
  const fin = s.profile === 'fin';
  const lastChip = () => chips[chips.length - 1];

  const dropOptions = async () => {
    const old = options;
    options = [];
    if (old.length === 0) return;
    await s.tween({ targets: old, alpha: 0, duration: 250 });
    destroyAll(old);
  };

  return {
    id: 'c4_taches',
    family: capacity,
    gesture: (p) => (p.stage === 'reste' ? 'tuto_compteur' : 'tuto_plateau'),
    nextIntro: 'c4_3_suivant',
    maxProblems: 3,
    followUp: (p) => capacityFollowUp(p),
    async build(p) {
      calmVeil(s, true);
      if (!tray) {
        tray = new WorkTray(s, TRAY_POS.x, TRAY_POS.y, s.profile, p.cap).setDepth(31).setAlpha(0);
        await s.tween({ targets: tray, alpha: 1, duration: 300 });
        if (!toldTray) {
          toldTray = true;
          await s.say('c4_3_plateau');
        }
      }
      if (p.stage === 'reste') {
        // La tâche indispensable arrive, puis occupe ses places dans le plateau.
        const chip = new TaskChip(s, CHIP_X[Math.min(chips.length, 1)], CHIP_Y, p.task, p.units).setDepth(32).setAlpha(0);
        chips.push(chip);
        await s.tween({ targets: chip, alpha: 1, y: { from: CHIP_Y - 30, to: CHIP_Y }, duration: 300 });
        await tray.fill(p.task, p.units, chip.source);
        chip.showUnits(p.units);
        return;
      }
      // La tâche secondaire est annoncée, près de la zone d'attente.
      zone = new WaitingZone(s, ZONE.x, ZONE.y, ZONE.w, ZONE.h).setDepth(30).setAlpha(0);
      const chip = new TaskChip(s, SECONDARY.x, SECONDARY.y, p.task, p.units).setDepth(32).setAlpha(0);
      chips.push(chip);
      await s.tween({ targets: [zone, chip], alpha: 1, duration: 300 });
      options = [
        new DestinationOption(s, 650, OPT_Y, 'plateau', () => choice?.select(0)),
        new DestinationOption(s, 1010, OPT_Y, 'attente', () => choice?.select(1)),
      ];
      for (const o of options) o.setDepth(32).setAlpha(0);
      await s.tween({ targets: options, alpha: 1, duration: 250 });
    },
    consigne(p) {
      const vars: Record<string, number> = { units: p.units };
      if (p.stage === 'choix') return { id: `c4_3_choix_${p.task}`, vars };
      if (p.busy > 0) return { id: 'c4_3_consigne_2', vars };
      return { id: `c4_3_consigne_${p.task}`, vars: { ...vars, cap: p.cap } };
    },
    answer: (p, onValidate) =>
      p.stage === 'reste'
        ? new CounterAnswer(s, COUNTER.x, COUNTER.y, s.profile === 'debut' ? 9 : TRAY_MAX[s.profile], onValidate)
        : (choice = new ChoiceAnswer(s, options, onValidate)),
    async success(p) {
      tray!.clearMarks();
      tray!.clearExtras();
      if (p.stage === 'reste') {
        // Les places libres s'allument un instant : c'est bien ce qui reste.
        tray!.markFree(C.green);
        sfx().chord();
        await s.wait(800);
        tray!.clearMarks();
        return;
      }
      const chip = lastChip();
      chip.showUnits();
      await dropOptions();
      if (capacity.answer(p) === TRAY) {
        await tray!.fill(p.task, p.units, chip.source);
        chip.showUnits(p.units);
        await s.say('c4_3_travaille');
      } else {
        // Une bonne répartition : les tâches indispensables restent lumineuses, l'autre va dans la zone calme.
        await zone!.receive(chip);
        await tray!.glow();
        await s.say('c4_3_attend');
      }
      // Le bruit et les fenêtres diminuent.
      await closeAlerts(s, 2);
    },
    async error(p, a) {
      s.char('collegue', 'inquiet');
      if (p.stage === 'reste') {
        const rest = freeBefore(p) - p.units;
        if (a < rest) {
          // Des places libres n'ont pas été comptées : elles sont en orange.
          tray!.markFreeAfter(a, C.orange);
          await s.say(rest - a === 1 ? 'c4_3_peu_1' : 'c4_3_peu', { n: a, k: rest - a });
        } else {
          tray!.markFree(C.orange);
          await s.say(a - rest === 1 ? 'c4_3_trop_1' : 'c4_3_trop', { n: a, k: a - rest });
        }
        tray!.clearMarks();
      } else if (a === TRAY) {
        // Tentative qui dépasse la capacité : des unités ne trouvent pas de place, puis la tâche revient.
        const chip = lastChip();
        const placed = await tray!.overflow(chip);
        await s.say('c4_3_deborde');
        tray!.unfill(p.task, placed);
        chip.showUnits();
      } else {
        // La tâche aurait tenu : chaque unité a sa place libre.
        tray!.ghost(lastChip());
        await s.say('c4_3_tient');
        tray!.clearExtras();
        lastChip().showUnits();
      }
      s.char('collegue', 'explique');
    },
    resetAfterError(p) {
      if (p.stage === 'choix') for (const o of options) o.setSelected(false);
    },
    async help(p, level, ui) {
      s.char('collegue', 'explique');
      const answer = capacity.answer(p);
      const free = freeBefore(p);
      if (p.stage === 'reste') {
        if (level === 1) await s.say('c4_3_aide_1', { free, units: p.units });
        else if (level === 2) {
          tray!.markFree(C.mint);
          await s.say(fin ? 'c4_3_aide_2_fin' : 'c4_3_aide_2');
        } else if (level === 3) {
          await s.say('gen_compter');
          await tray!.countFree(fin);
        } else {
          ui.set(answer);
          await s.say('c4_3_aide_4', { answer });
          services.focus.focus(ui.validateButton, { silent: true });
        }
        return;
      }
      if (level === 1) await s.say('c4_3_aide_choix_1', { free, units: p.units });
      else if (level === 2) {
        tray!.ghost(lastChip());
        await s.say('c4_3_aide_choix_2');
      } else if (level === 3) {
        await s.say('gen_compter');
        await tray!.countFree(fin);
      } else {
        ui.set(answer);
        await s.say(answer === TRAY ? 'c4_3_aide_choix_4_plateau' : 'c4_3_aide_choix_4_attente');
        services.focus.focus(ui.validateButton, { silent: true });
      }
    },
    async clear() {
      await dropOptions();
      const old: GO[] = [...chips, ...(tray ? [tray] : []), ...(zone ? [zone] : [])];
      tray?.clearExtras();
      chips = [];
      tray = null;
      zone = null;
      if (old.length === 0) return;
      await s.tween({ targets: old, alpha: 0, duration: 300 });
      destroyAll(old);
    },
  };
}

/** Les quatre tâches, avec leur rôle dit oralement ; les indispensables d'abord. */
const TASKS: TaskKind[] = ['guidage', 'controle', 'rapport', 'affichage'];

const c4_3: SceneScript = {
  id: 'c4.3',
  estMs: 50_000,
  challenge: { id: 'c4_taches', family: 'capacite' },
  async run(s) {
    const l = lab3(s);
    l.show(true);
    const margaret = s.char('margaret', 'neutre');
    const collegue = s.char('collegue', 'explique');
    alertWindows(s);
    await simFrame(s);
    services.music.play('leger');
    await s.say('c4_3_place');

    // Les tâches portent des pictogrammes ; leur rôle est dit oralement. La priorité est illustrée avant le choix.
    calmVeil(s, true);
    const intro = TASKS.map((t, i) => new TaskChip(s, 555 + i * 270, 400, t, 0).setDepth(32).setScale(0));
    for (const [i, t] of TASKS.entries()) {
      sfx().pop(i * 2);
      await s.tween({ targets: intro[i], scale: 1, duration: 280, ease: 'Back.Out' });
      await s.say(`c4_3_tache_${t}`);
    }
    // Les indispensables passent devant ; les autres s'écartent, plus calmes.
    s.tweens.add({ targets: intro.slice(0, 2), y: 360, scale: 1.08, duration: 500, ease: 'Sine.Out' });
    s.tweens.add({ targets: intro.slice(2), y: 470, scale: 0.85, alpha: 0.6, duration: 500, ease: 'Sine.Out' });
    await s.say('c4_3_priorite');
    await s.tween({ targets: intro, alpha: 0, duration: 350 });
    destroyAll(intro);

    margaret.setPose('reflechit');
    s.surprises = [papersSurprise(s)];
    await runChallenge(s, capacitySpec(s));
    calmVeil(s, false);

    // Le programme illustré fonctionne : les dernières fenêtres se ferment.
    await closeAlerts(s);
    sfx().success();
    services.music.play('leger');
    collegue.setPose('applaudit');
    margaret.setPose('joie');
    await s.say('c4_3_fonctionne');
    collegue.setPose('neutre');
    margaret.setPose('neutre');
  },
};

// ---------------------------------------------------------------------------
// C4.4 — Le moment de vérité (alunissage historique, sans calcul ni geste urgent)
// ---------------------------------------------------------------------------

/** Les rochers sont juste sous Eagle au début de la cinématique ; la zone de pose est un peu plus loin. */
const ROCKS = { x: 0.46, y: 0.6 };

const c4_4: SceneScript = {
  id: 'c4.4',
  estMs: 60_000,
  async run(s) {
    const l = lab3(s);
    const gentle = services.save.data.settings.gentle;
    l.show(true);
    const margaret = s.char('margaret', 'neutre');
    const collegue = s.char('collegue', 'neutre');
    // Le cadre de simulation s'efface ; Houston autorise la suite.
    await closeAlerts(s);
    await dropFrame(s);
    calmVeil(s, false);
    await s.say('c4_4_controleurs');
    sfx().crackle(0.8);
    await s.wait(500);
    await s.say('c4_4_continuer');

    // La caméra retrouve Eagle. Les reliefs grossissent : des rochers, juste en dessous.
    await fade(s, 0);
    l.show(false);
    services.music.play('mystere');
    const surface = new DescentWindow(s, 960, 540, 1920, 1080, 11, ROCKS, 2);
    const rocks = s.prop('rochers', 960, 650, 760, 330, 12);
    const eagle = s.prop('eagle', 960, 300, 300, 270, 13);
    await fade(s, 1, 600);
    const k = rocks.scale;
    const grow = Promise.all([surface.zoomTo(2.6, 3500), s.tween({ targets: rocks, scale: k * 1.35, y: 680, duration: 3500, ease: 'Sine.InOut' })]);
    await s.say('c4_4_rochers');
    await grow;
    // Armstrong ajuste la zone de pose : le sol glisse sous Eagle, les rochers s'éloignent.
    s.tweens.add({ targets: eagle, angle: { from: -8, to: 0 }, duration: 4000, ease: 'Sine.InOut' });
    await s.tween({ targets: rocks, x: -500, duration: 4000, ease: 'Sine.InOut' });

    // Au laboratoire, on retient son souffle. La musique ralentit.
    await fade(s, 0, 400);
    for (const o of [...surface.parts, rocks, eagle]) (o as Phaser.GameObjects.Image).setVisible(false);
    l.show(true);
    collegue.setPose('chuchote');
    margaret.setPose('reflechit');
    services.music.stop(2.5);
    await fade(s, 1, 400);
    await s.say('c4_4_allez');

    // Vue de côté : la poussière se soulève, les pieds du module touchent le sol.
    await fade(s, 0, 400);
    surface.destroy();
    destroyAll([rocks, eagle]);
    l.show(false);
    const ground = cover(s.add.image(960, 540, 'lune_sol')).setDepth(11);
    const groundY = 1080 * GROUND.y;
    const lm = s.prop('eagle', 960, 0, 560, 500, 13);
    const landedY = groundY - lm.displayHeight / 2 + 6;
    lm.setY(landedY - 520);
    const dust = s.add.graphics().setDepth(14);
    const puffs: { x: number; r: number; a: number }[] = [];
    const drawDust = () => {
      dust.clear();
      for (const p of puffs) {
        dust.fillStyle(0xc4c1b9, p.a);
        dust.fillEllipse(p.x, groundY - p.r * 0.2, p.r * 2.4, p.r * 0.7);
      }
    };
    const breath = sfx().breathing();
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => breath.stop());
    await fade(s, 1, 600);
    const descent = s.tween({
      targets: lm,
      y: landedY,
      duration: 6000,
      ease: 'Sine.Out',
      onUpdate: () => {
        // Plus le module est bas, plus la poussière s'étale.
        const h = landedY - lm.y;
        if (h > 300) return;
        if (puffs.length < 24) puffs.push({ x: lm.x + (Math.random() - 0.5) * 700, r: 30 + Math.random() * 50, a: 0.7 });
        for (const p of puffs) {
          p.r += 1.2;
          p.x += p.x < lm.x ? -2 : 2;
        }
        drawDust();
      },
    });
    await descent;
    // Contact. Une pause sonore laisse l'image exister.
    sfx().rumble(1.2);
    if (!gentle) s.cameras.main.shake(180, 0.002);
    const settle = { a: 0.7 };
    s.tweens.add({
      targets: settle,
      a: 0,
      duration: 2000,
      onUpdate: () => {
        for (const p of puffs) p.a = settle.a;
        drawDust();
      },
    });
    await s.wait(2200);
    breath.stop();
    sfx().crackle(0.7);
    await s.wait(400);
    await s.say('c4_4_pose');
    await s.wait(800);

    // La musique devient triomphale. Le laboratoire applaudit.
    services.music.play('ample');
    await fade(s, 0, 400);
    destroyAll([ground, lm, dust]);
    l.show(true);
    collegue.setPose('applaudit');
    margaret.setPose('joie');
    await fade(s, 1, 400);
    sfx().applause();
    if (!gentle) collegue.hop();
    await s.say('c4_4_reussi');
    await s.say('c4_4_lune');
    await s.wait(800);

    // Ellipse : quelques heures d'attente avant la sortie.
    await fade(s, 0, 800);
    services.music.stop(1.5);
    await s.say('c4_4_plus_tard');
    await s.wait(500);
    collegue.setPose('neutre');
    margaret.setPose('neutre');
  },
};

// ---------------------------------------------------------------------------
// C4.5 — Le premier pas (narration, aucun calcul ni geste de réussite)
// ---------------------------------------------------------------------------

const c4_5: SceneScript = {
  id: 'c4.5',
  estMs: 55_000,
  async run(s) {
    const l = lab3(s);
    const cam = s.cameras.main;
    await closeAlerts(s);
    await dropFrame(s);
    calmVeil(s, false);
    cam.setAlpha(0);
    l.show(false);
    services.music.stop(0.5);

    // L'échelle d'Eagle occupe l'image. La respiration et la radio.
    const ground = cover(s.add.image(960, 540, 'lune_sol')).setDepth(11);
    const ladder = s.prop('echelle_eagle', 780, 540, 1000, 1080, 12);
    ladder.setY(1080 - ladder.displayHeight / 2);
    const L = {
      x: ladder.x - ladder.displayWidth / 2 + LADDER.x * ladder.displayWidth,
      top: ladder.y - ladder.displayHeight / 2 + LADDER.top * ladder.displayHeight,
      ground: ladder.y - ladder.displayHeight / 2 + LADDER.ground * ladder.displayHeight,
    };
    const armstrong = s.prop('astronaute_dos', L.x, 0, 260, 440, 13);
    armstrong.setY(L.top + armstrong.displayHeight / 2 - 40);
    const columbia = s.prop('columbia', 1500, 120, 150, 70, 12).setAlpha(0);
    const breath = sfx().breathing();
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => breath.stop());
    sfx().crackle(0.8);
    await fade(s, 1, 1400);
    await s.wait(800);

    // Armstrong descend lentement ; la caméra respecte le temps du geste.
    const onGround = L.ground - armstrong.displayHeight / 2;
    await s.tween({ targets: armstrong, y: onGround, duration: 7000, ease: 'Sine.InOut' });
    // Le pied touche le sol : un peu de poussière, une première empreinte.
    const print = s.add.graphics().setDepth(12);
    print.fillStyle(0x56544f, 1);
    print.fillEllipse(L.x + 60, L.ground + 18, 46, 18);
    const puff = s.add.ellipse(L.x, L.ground, 200, 50, 0xc4c1b9, 0.8).setDepth(14);
    sfx().pop(0);
    s.tweens.add({ targets: puff, scaleX: 1.8, alpha: 0, duration: 1600, ease: 'Sine.Out' });
    await s.wait(1200);
    breath.stop();
    await s.say('c4_5_pas');
    // La musique, retenue jusque-là, s'ouvre doucement.
    services.music.play('calme');

    // Buzz Aldrin le rejoint ; Michael Collins les attend dans Columbia.
    // Armstrong s'écarte de l'échelle ; Aldrin descend à son tour.
    await s.tween({ targets: armstrong, x: armstrong.x + 460, duration: 2200, ease: 'Sine.InOut' });
    const aldrin = s.prop('astronaute_dos', L.x, 0, 260, 440, 13);
    aldrin.setY(L.top + aldrin.displayHeight / 2 - 40);
    const second = s.tween({ targets: aldrin, y: onGround, duration: 5500, ease: 'Sine.InOut' });
    s.tweens.add({ targets: columbia, alpha: 1, duration: 800 });
    s.tweens.add({ targets: columbia, x: 1850, duration: 9000 });
    await s.say('c4_5_aldrin');
    await second;
    await s.wait(800);

    // Au laboratoire.
    await fade(s, 0, 600);
    destroyAll([ground, ladder, armstrong, aldrin, columbia, print, puff]);
    l.show(true);
    const margaret = s.char('margaret', 'joie');
    const collegue = s.char('collegue', 'explique');
    await fade(s, 1, 600);
    await s.say('c4_5_mission');

    // La caméra montre la Terre dans le ciel.
    await fade(s, 0, 600);
    l.show(false);
    const sky = cover(s.add.image(960, 540, 'lune_sol')).setDepth(11);
    const earth = s.prop('terre', 1380, 300, 240, 240, 12);
    const landed = s.prop('eagle', 560, 0, 300, 270, 13);
    landed.setY(1080 * GROUND.y - landed.displayHeight / 2 + 4);
    services.music.play('ample');
    await fade(s, 1, 900);
    s.tweens.add({ targets: earth, y: 270, duration: 4000, ease: 'Sine.InOut' });
    await s.say('c4_5_maison');
    await s.wait(1500);

    // Retour au laboratoire avant le bilan.
    await fade(s, 0, 600);
    destroyAll([sky, earth, landed]);
    l.show(true);
    margaret.setPose('neutre');
    collegue.setPose('neutre');
    await fade(s, 1, 500);
  },
};

export const chapter4: ChapterScript = { id: 'c4', scenes: [c4_1, c4_2, c4_3, c4_4, c4_5] };
