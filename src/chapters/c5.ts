import * as Phaser from 'phaser';
import { C, textStyle } from '../config';
import { NumberPicker, PickAnswer } from '../engine/answers';
import { runChallenge, type ChallengeSpec } from '../engine/challenge';
import {
  lighten,
  lightenPair,
  loadSum,
  radar,
  RADAR_MAX,
  RADAR_SHOWN,
  radarTerms,
  wave,
  WAVE_MAX,
  waveFollowUp,
  type LightenParams,
  type RadarParams,
  type WaveParams,
} from '../math/families';
import type { StoryScene } from '../scenes/StoryScene';
import { services } from '../services';
import { cover } from '../view/assets';
import { GROUND } from '../view/placeholders-c4';
import { LoadOption, MoonScale, RadarScreen, RadioWave } from '../view/widgets-c5';
import { lab3 } from './c3';
import { destroyAll, dropFrame, fade, simFrame, starSky } from './c4';
import { calmVeil, papersSurprise } from './common';
import type { ChapterScript, SceneScript } from './types';

/**
 * Chapitre 5 — Le grand retour sur Terre (document de référence, section 8 ; choix validés le 15/11,
 * docs/questions-scenaristes.md, section 10). Il faut rentrer à la maison, les retrouvailles dans l'espace,
 * le grand silence (panne imaginaire, P12), la traversée des flammes, la célébration.
 * Le bilan de la mission, le diplôme, le générique et la scène de Mars (C5.6, C5.7) suivent dans FinaleScene.
 */

const sfx = () => services.sfx;
type Img = Phaser.GameObjects.Image;

/** Taille d'Eagle posé sur la Lune ; ses deux étages ont le même cadre et se superposent exactement. */
const EAGLE_BOX = { w: 340, h: 300 };

function eagleOnGround(s: StoryScene, x: number, depth = 13): { base: Img; top: Img } {
  const base = s.prop('eagle_base', x, 0, EAGLE_BOX.w, EAGLE_BOX.h, depth);
  const top = s.prop('eagle_montee', x, 0, EAGLE_BOX.w, EAGLE_BOX.h, depth + 1);
  const y = 1080 * GROUND.y - base.displayHeight / 2 + 4;
  base.setY(y);
  top.setY(y).setDisplaySize(base.displayWidth, base.displayHeight);
  return { base, top };
}

/** Trois soleils qui s'allument : les jours du voyage (comme en C3.5). */
function threeSuns(s: StoryScene, firstMs: number, everyMs: number): Phaser.GameObjects.Graphics[] {
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
  days.forEach((d, i) =>
    s.time.delayedCall(firstMs + i * everyMs, () => {
      d.setAlpha(1).setScale(1.3);
      s.tweens.add({ targets: d, scale: 1, duration: 300, ease: 'Back.Out' });
      sfx().pop(4 + i);
    }),
  );
  return days;
}

// ---------------------------------------------------------------------------
// C5.1 — Il faut rentrer à la maison : alléger Eagle (décomposer un nombre ; choix du propriétaire, 18/11)
// ---------------------------------------------------------------------------

const SCALE = { x: 960, y: 455 };
const CARDS_Y = 725;

function lightenSpec(s: StoryScene): ChallengeSpec<LightenParams, number[]> {
  let scale: MoonScale | null = null;
  let cards: LoadOption[] = [];
  let pick: PickAnswer | null = null;
  const weights = (p: LightenParams, a: number[]) => a.map((i) => p.items[i].w);
  return {
    id: 'c5_alleger',
    family: lighten,
    gesture: 'tuto_objets',
    nextIntro: 'c5_1_autre',
    maxProblems: 4,
    async build(p) {
      calmVeil(s, true);
      scale = new MoonScale(s, SCALE.x, SCALE.y, p.target).setDepth(31).setAlpha(0);
      const gap = p.items.length > 4 ? 235 : 250;
      cards = p.items.map((it, i) =>
        new LoadOption(s, SCALE.x + (i - (p.items.length - 1) / 2) * gap, CARDS_Y, it.kind, it.w, () => pick?.toggle(i))
          .setDepth(32)
          .setAlpha(0),
      );
      sfx().paper();
      await s.tween({ targets: [scale, ...cards], alpha: 1, duration: 400 });
    },
    consigne: (p) => ({ id: 'c5_1_poids', vars: { target: p.target } }),
    answer: (p, onValidate) => (pick = new PickAnswer(s, cards, onValidate, (chosen) => scale?.setLoad(chosen.map((i) => p.items[i])))),
    async success(p, a) {
      scale!.clearTemp();
      await scale!.weigh(weights(p, a));
      // Les objets choisis restent sur la Lune.
      await Promise.all(a.map((i) => cards[i].leave()));
      s.char('collegue', 'enthousiaste');
      await s.say('c5_1_equilibre');
      s.char('collegue', 'explique');
    },
    async error(p, a) {
      // La balance pèse et penche : du côté des cailloux (il manque des kilos) ou des objets (il y en a trop).
      scale!.clearTemp();
      await scale!.weigh(weights(p, a));
      const sum = loadSum(p, a);
      const k = Math.abs(p.target - sum);
      s.char('collegue', 'inquiet');
      if (sum < p.target) await s.say(k === 1 ? 'c5_1_leger_1' : 'c5_1_leger', { k });
      else await s.say(k === 1 ? 'c5_1_lourd_1' : 'c5_1_lourd', { k });
      s.char('collegue', 'explique');
    },
    resetAfterError() {
      // Les objets restent choisis (on peut n'en changer qu'un) ; la balance se rebloque, penchée vers les cailloux.
      void scale?.relock();
    },
    async help(p, level, ui) {
      s.char('collegue', 'explique');
      const [big, small] = [...lightenPair(p)!].sort((x, y) => p.items[y].w - p.items[x].w);
      const a = p.items[big].w;
      const b = p.items[small].w;
      if (level === 1) await s.say('c5_1_aide_1_poids', { target: p.target });
      else if (level === 2) {
        const tens = s.profile === 'fin';
        scale!.showUnits(tens);
        for (const c of cards) c.showUnits(tens);
        await s.say(tens ? 'c5_1_aide_2_poids_dizaine' : 'c5_1_aide_2_poids');
      } else if (level === 3) {
        // L'objet le plus lourd de la paire est posé ; on compte jusqu'au poids des cailloux.
        ui.set([big]);
        await s.say('c5_1_aide_3_poids', { a, target: p.target });
        await scale!.countOn(a, p.target);
        await s.say(b === 1 ? 'c5_1_aide_3_manque_1' : 'c5_1_aide_3_manque', { k: b });
      } else {
        scale!.clearTemp();
        ui.set([big, small].sort((x, y) => x - y));
        await s.say(b === 1 ? 'c5_1_aide_4_poids_1' : 'c5_1_aide_4_poids', { a, b });
        services.focus.focus(ui.validateButton, { silent: true });
      }
    },
    async clear() {
      const old: Phaser.GameObjects.Container[] = [...(scale ? [scale] : []), ...cards];
      scale = null;
      cards = [];
      pick = null;
      await s.tween({ targets: old, alpha: 0, duration: 300 });
      for (const o of old) o.destroy();
    },
  };
}

/** Sur l'écran du laboratoire, le schéma du retour : la Lune, la Terre, le chemin en pointillés. */
function returnSchema(s: StoryScene): Phaser.GameObjects.Graphics {
  const l = lab3(s);
  const g = s.add.graphics();
  g.fillStyle(0xd9d6cf, 1);
  g.fillCircle(-120, -10, 34);
  g.fillStyle(0x3d7fb8, 1);
  g.fillCircle(130, 10, 46);
  g.fillStyle(0x6fae5a, 1);
  g.fillEllipse(120, 0, 34, 22);
  g.lineStyle(5, C.mint, 1);
  for (let i = 0; i < 7; i++) g.lineBetween(-80 + i * 26, -6 + i * 2, -68 + i * 26, -4 + i * 2);
  g.setAlpha(0);
  l.screen.add(g);
  s.tweens.add({ targets: g, alpha: 1, duration: 600 });
  return g;
}

const c5_1: SceneScript = {
  id: 'c5.1',
  estMs: 60_000,
  challenge: { id: 'c5_alleger', family: 'alleger' },
  async run(s) {
    const cam = s.cameras.main;
    // Le 21 juillet 1969 : la caméra survole Eagle posé sur la Lune, une musique douce.
    services.music.stop(0.3);
    cam.setAlpha(0);
    const ground = cover(s.add.image(960, 540, 'lune_sol')).setDepth(11);
    const earth = s.prop('terre', 1500, 230, 200, 200, 12);
    const lm = eagleOnGround(s, 1200);
    services.music.play('calme');
    await fade(s, 1, 1400);
    const pan = s.tween({ targets: [lm.base, lm.top], x: 820, duration: 6500, ease: 'Sine.InOut' });
    s.tweens.add({ targets: earth, x: 1380, duration: 6500, ease: 'Sine.InOut' });
    await s.say('c5_1_date');
    await pan;

    // Au laboratoire, la Terre apparaît sur un schéma de retour.
    await fade(s, 0);
    destroyAll([ground, earth, lm.base, lm.top]);
    const l = lab3(s);
    l.show(true);
    const margaret = s.char('margaret', 'reflechit');
    const collegue = s.char('collegue', 'enthousiaste');
    services.music.play('leger');
    await fade(s, 1, 600);
    const schema = returnSchema(s);
    await s.say('c5_1_rentrer');

    // Les cailloux de Lune alourdissent Eagle : dans la simulation, on choisit ce qu'on laisse sur la Lune.
    collegue.setPose('explique');
    margaret.setPose('neutre');
    await s.say('c5_1_cailloux');
    await simFrame(s);
    await s.say('c5_1_balance');
    s.surprises = [papersSurprise(s)];
    await runChallenge(s, lightenSpec(s));
    sfx().chord();
    calmVeil(s, false);
    await dropFrame(s);
    schema.destroy();

    // La radio annonce le départ ; le haut d'Eagle s'élève et laisse sa base sur le sol.
    collegue.setPose('enthousiaste');
    margaret.setPose('joie');
    sfx().crackle(0.8);
    await s.wait(500);
    await s.say('c5_1_pret');
    await fade(s, 0);
    l.show(false);
    const ground2 = cover(s.add.image(960, 540, 'lune_sol')).setDepth(11);
    const lm2 = eagleOnGround(s, 960);
    // Pour de vrai, les sacs à dos et les bottes restent sur la Lune, au pied d'Eagle.
    const groundY = 1080 * GROUND.y;
    const pack = s.prop('lune_sac', 620, 0, 130, 136, 12);
    pack.setY(groundY - pack.displayHeight / 2 + 6);
    const boots = s.prop('lune_bottes', 1290, 0, 150, 106, 12);
    boots.setY(groundY - boots.displayHeight / 2 + 6);
    services.music.play('ample');
    await fade(s, 1, 500);
    await s.say('c5_1_vrai');
    await s.wait(300);
    sfx().liftoff();
    const dust = s.add.graphics().setDepth(12);
    dust.fillStyle(0xc4c1b9, 0.7);
    for (let i = 0; i < 14; i++) dust.fillCircle(960 + (i - 7) * 38, 1080 * GROUND.y + (i % 3) * 10, 16 + (i % 4) * 6);
    s.tweens.add({ targets: dust, alpha: 0, scaleX: 1.6, duration: 1600 });
    const rise = s.tween({ targets: lm2.top, y: -300, duration: 4200, ease: 'Quad.In' });
    await s.say('c5_1_envol');
    await rise;

    // La caméra accompagne le départ vers l'orbite.
    await fade(s, 0, 400);
    destroyAll([ground2, dust, lm2.base, lm2.top, pack, boots]);
    const orbit = cover(s.add.image(960, 540, 'orbite_lune')).setDepth(11);
    const climber = s.prop('eagle_montee', 700, 900, 180, 160, 13);
    await fade(s, 1, 400);
    await s.tween({ targets: climber, x: 1250, y: 380, scale: climber.scale * 0.7, duration: 3000, ease: 'Sine.Out' });
    await fade(s, 0, 500);
    destroyAll([orbit, climber]);
    l.show(true);
    margaret.setPose('neutre');
    collegue.setPose('neutre');
    await fade(s, 1, 400);
  },
};

// ---------------------------------------------------------------------------
// C5.2 — Les retrouvailles dans l'espace : le radar du rendez-vous (suites ; choix du propriétaire, 18/11)
// ---------------------------------------------------------------------------

const RADAR_AT = { x: 960, y: 470 };

function radarSpec(s: StoryScene): ChallengeSpec<RadarParams, number> {
  let screen: RadarScreen | null = null;
  const fin = s.profile === 'fin';
  const last = (p: RadarParams) => radarTerms(p)[RADAR_SHOWN - 1];
  return {
    id: 'c5_radar',
    family: radar,
    gesture: 'tuto_reponse',
    nextIntro: 'c5_2_mesure',
    maxProblems: 4,
    async build(p) {
      calmVeil(s, true);
      screen = new RadarScreen(s, RADAR_AT.x, RADAR_AT.y, radarTerms(p), p.step).setDepth(31).setAlpha(0);
      await s.tween({ targets: screen, alpha: 1, duration: 400 });
      await screen.print();
    },
    consigne: (p) => {
      const [a, b, c] = radarTerms(p);
      return { id: 'c5_2_suite', vars: { a, b, c } };
    },
    answer: (_p, onValidate) => new NumberPicker(s, { max: RADAR_MAX[s.profile], tens: fin, onValidate }),
    async success(_p, a) {
      await screen!.approach(a);
      sfx().chord();
      s.char('collegue', 'soulage');
      await s.say('c5_2_proche');
      s.char('collegue', 'explique');
    },
    async error(p, a) {
      // Eagle va là où la mesure proposée le mettrait : pas plus près, trop près d'un coup, pas assez près.
      await screen!.tryWrong(a);
      s.char('collegue', 'inquiet');
      if (a >= last(p)) await s.say('c5_2_eloigne', { n: a });
      else if (a < radar.answer(p)) await s.say('c5_2_grand_bond', { n: a });
      else await s.say('c5_2_petit_bond', { n: a });
      s.char('collegue', 'explique');
    },
    resetAfterError() {
      void screen?.reset();
    },
    async help(p, level, ui) {
      s.char('collegue', 'explique');
      const answer = radar.answer(p);
      if (level === 1) await s.say('c5_2_aide_1_radar');
      else if (level === 2) {
        screen!.showJumps(p.step);
        await s.say('c5_2_aide_2_radar', { step: p.step });
      } else if (level === 3) {
        await s.say('gen_compter');
        await screen!.countDown(last(p), answer);
      } else {
        ui.set(answer);
        await s.say('c5_2_aide_4_radar', { answer });
        services.focus.focus(ui.validateButton, { silent: true });
      }
    },
    async clear() {
      if (!screen) return;
      const old = screen;
      screen = null;
      await s.tween({ targets: old, alpha: 0, duration: 350 });
      old.destroy();
    },
  };
}

const c5_2: SceneScript = {
  id: 'c5.2',
  estMs: 55_000,
  challenge: { id: 'c5_radar', family: 'radar' },
  async run(s) {
    const l = lab3(s);
    // Columbia attend dans le noir de l'espace ; Michael Collins, sur sa carte (comme en C4.1).
    await fade(s, 0);
    l.show(false);
    const orbit = cover(s.add.image(960, 540, 'orbite_lune')).setDepth(11);
    const columbia = s.prop('columbia', 1100, 360, 420, 200, 13).setAngle(-4);
    const inset = s.add.graphics().setDepth(14);
    inset.fillStyle(0x000000, 0.3);
    inset.fillRoundedRect(1560 - 150 + 8, 520 + 10, 300, 400, 28);
    inset.fillStyle(0x2c4a72, 1);
    inset.fillRoundedRect(1560 - 150, 520, 300, 400, 28);
    inset.lineStyle(8, C.cream, 1);
    inset.strokeRoundedRect(1560 - 150, 520, 300, 400, 28);
    const collins = s.prop('astronaute_3', 1560, 720, 270, 380, 15);
    const far = s.prop('eagle_montee', 260, 760, 70, 62, 13);
    services.music.play('mystere');
    await fade(s, 1, 600);
    s.tweens.add({ targets: columbia, x: 980, duration: 7000, ease: 'Sine.InOut' });
    s.tweens.add({ targets: far, x: 420, y: 650, duration: 7000, ease: 'Sine.InOut' });
    await s.say('c5_2_collins');
    await s.wait(800);

    // Au laboratoire : la simulation du rapprochement.
    await fade(s, 0);
    destroyAll([orbit, columbia, inset, collins, far]);
    l.show(true);
    const margaret = s.char('margaret', 'reflechit');
    const collegue = s.char('collegue', 'explique');
    services.music.play('leger');
    await fade(s, 1, 500);
    await s.say('c5_2_retrouver');
    await simFrame(s);
    await s.say('c5_2_simulation');
    await s.say('c5_2_radar');
    s.surprises = [papersSurprise(s)];
    await runChallenge(s, radarSpec(s));
    calmVeil(s, false);
    await dropFrame(s);

    // Retour à la vue extérieure : Eagle rejoint Columbia. « Clac ! »
    await fade(s, 0);
    l.show(false);
    const orbit2 = cover(s.add.image(960, 540, 'orbite_lune')).setDepth(11);
    const col2 = s.prop('columbia', 1080, 430, 460, 220, 13);
    const eagle = s.prop('eagle_montee', 300, 300, 200, 180, 13);
    services.music.play('ample');
    await fade(s, 1, 500);
    await s.tween({ targets: eagle, x: col2.x + col2.displayWidth / 2 + 40, y: 430, angle: -90, duration: 3200, ease: 'Sine.InOut' });
    sfx().dock();
    s.cameras.main.shake(services.save.data.settings.gentle ? 0 : 160, 0.002);
    await s.wait(500);
    await s.say('c5_2_reunis');
    await s.say('c5_2_ensemble');

    // Le transfert dans Columbia, puis Eagle est laissé derrière.
    const drift = s.tween({ targets: eagle, x: 1700, y: 220, alpha: 0.4, duration: 4000, ease: 'Sine.In' });
    await s.say('c5_2_retour');
    await drift;

    // Ellipse : trois jours de voyage vers la Terre.
    await fade(s, 0, 500);
    destroyAll([orbit2, col2, eagle]);
    const sky = starSky(s);
    const moon = s.add.circle(260, 260, 120, 0xd9d6cf).setStrokeStyle(6, 0xa9a59c).setDepth(12);
    const home = s.add.circle(1720, 820, 60, 0x3d7fb8).setStrokeStyle(6, 0x9fd3ec).setDepth(12);
    const ship = s.prop('columbia', 520, 380, 260, 124, 13).setAngle(22);
    const days = threeSuns(s, 600, 2200);
    await fade(s, 1, 500);
    s.tweens.add({ targets: moon, scale: 0.5, duration: 7500, ease: 'Sine.In' });
    s.tweens.add({ targets: home, scale: 2.4, duration: 7500, ease: 'Sine.In' });
    await s.tween({ targets: ship, x: 1450, y: 700, duration: 7500, ease: 'Sine.InOut' });
    await fade(s, 0, 500);
    destroyAll([sky, moon, home, ship, ...days]);
    l.show(true);
    margaret.setPose('neutre');
    collegue.setPose('neutre');
    await fade(s, 1, 400);
  },
};

// ---------------------------------------------------------------------------
// C5.3 — Le grand silence : une panne imaginaire de radio, dans la simulation (P12)
// ---------------------------------------------------------------------------

const WAVE = { x: 960, y: 400 };

function waveSpec(s: StoryScene, getWave: () => RadioWave): ChallengeSpec<WaveParams, number> {
  const fin = s.profile === 'fin';
  let first = true;
  return {
    id: 'c5_silence',
    family: wave,
    gesture: 'tuto_reponse',
    nextIntro: 'c5_3_suivant',
    maxProblems: 3,
    followUp: (p) => waveFollowUp(p),
    async build(p) {
      calmVeil(s, true);
      const w = getWave();
      if (p.stage === 'somme') {
        // Une onde vide de `total` morceaux, et les deux tas apportés par l'équipe.
        if (!first || w.total !== p.total || w.have !== 0) await replaceWave(s, p.total, 0);
        getWave().showPiles(p.a!, p.b!);
      } else if (p.deja !== getWave().have || getWave().total !== p.total) {
        await replaceWave(s, p.total, p.deja);
      }
      first = false;
    },
    consigne(p): { id: string; vars: Record<string, number> } {
      if (p.stage === 'somme') return { id: 'c5_3_consigne_somme', vars: { total: p.total, a: p.a!, b: p.b! } };
      if (waveFromSum.has(p)) return { id: 'c5_3_consigne_2', vars: { total: p.total } };
      return { id: 'c5_3_consigne', vars: { total: p.total, deja: p.deja } };
    },
    answer: (_p, onValidate) => new NumberPicker(s, { max: WAVE_MAX[s.profile], tens: fin, onValidate }),
    async success(p, a) {
      const w = getWave();
      w.clearTemp();
      if (p.stage === 'somme') {
        await w.mergePiles(a);
        return;
      }
      await w.addPieces(a, C.green);
      await s.say('c5_3_valide');
    },
    async error(p, a) {
      const w = getWave();
      const right = wave.answer(p);
      const k = Math.abs(right - a);
      s.char('collegue', 'inquiet');
      if (p.stage === 'somme') {
        w.shakePiles();
        await s.say(a < right ? 'c5_3_somme_peu' : 'c5_3_somme_trop', { n: a });
      } else {
        // La proposition de l'enfant s'ajoute en orange : un trou reste dans l'onde, ou des morceaux débordent.
        await w.addPieces(a, C.orange);
        if (a < right) await s.say(k === 1 ? 'c5_3_peu_1' : 'c5_3_peu', { n: a, k });
        else await s.say(k === 1 ? 'c5_3_trop_1' : 'c5_3_trop', { n: a, k });
      }
      s.char('collegue', 'explique');
    },
    resetAfterError() {
      getWave().clearTemp();
    },
    async help(p, level, ui) {
      s.char('collegue', 'explique');
      const w = getWave();
      const answer = wave.answer(p);
      if (p.stage === 'somme') {
        if (level === 1) await s.say('c5_3_aide_1_somme', { a: p.a!, b: p.b! });
        else if (level === 2) {
          w.highlightPiles();
          await s.say('c5_3_aide_2_somme');
        } else if (level === 3) {
          await s.say('gen_compter');
          await w.countPiles(p.a!, p.b!);
        } else {
          ui.set(answer);
          await s.say('c5_3_aide_4_somme', { answer });
          services.focus.focus(ui.validateButton, { silent: true });
        }
        return;
      }
      if (level === 1) await s.say('c5_3_aide_1', { total: p.total, deja: p.deja });
      else if (level === 2) {
        w.showMissing();
        await s.say(fin ? 'c5_3_aide_2_fin' : 'c5_3_aide_2');
      } else if (level === 3) {
        await s.say('gen_compter');
        await w.countMissing();
      } else {
        ui.set(answer);
        await s.say('c5_3_aide_4', { answer });
        services.focus.focus(ui.validateButton, { silent: true });
      }
    },
    async clear() {
      /* l'onde réparée reste affichée jusqu'au signal retrouvé */
    },
  };
}

/** Deuxièmes étapes (fin de CP) : elles partent des morceaux réunis à l'étape précédente. */
const waveFromSum = new WeakSet<WaveParams>();
const waves = new WeakMap<StoryScene, RadioWave>();

async function replaceWave(s: StoryScene, total: number, have: number): Promise<RadioWave> {
  const old = waves.get(s);
  if (old) {
    await s.tween({ targets: old, alpha: 0, duration: 250 });
    old.destroy();
  }
  const w = new RadioWave(s, WAVE.x, WAVE.y, s.profile, total).setDepth(31).setAlpha(0);
  w.setHave(have);
  waves.set(s, w);
  await s.tween({ targets: w, alpha: 1, duration: 300 });
  return w;
}

const c5_3: SceneScript = {
  id: 'c5.3',
  estMs: 55_000,
  challenge: { id: 'c5_silence', family: 'onde' },
  async run(s) {
    lab3(s).show(true);
    const margaret = s.char('margaret', 'neutre');
    const collegue = s.char('collegue', 'explique');
    services.music.play('leger');
    // P12 : la panne est annoncée comme imaginaire, et se joue dans le cadre de la simulation.
    await s.say('c5_3_imaginaire');
    await simFrame(s);
    // Dans le hublot de la simulation, la Terre grandit lentement.
    const port = s.add.graphics().setDepth(30);
    port.fillStyle(0x05070d, 1);
    port.fillCircle(960, 420, 230);
    port.lineStyle(26, 0x8a93a6, 1);
    port.strokeCircle(960, 420, 230);
    const earth = s.add.circle(1010, 470, 60, 0x3d7fb8).setStrokeStyle(5, 0x9fd3ec).setDepth(30);
    s.tweens.add({ targets: earth, scale: 2.2, x: 980, y: 440, duration: 6000, ease: 'Sine.InOut' });
    await s.wait(1500);
    sfx().crackle(1.2);
    await s.wait(500);
    await s.say('c5_3_appel');
    // La radio se tait, la musique s'arrête.
    sfx().crackle(0.6);
    services.music.stop(0.4);
    await s.wait(1600);
    margaret.setPose('surprise');
    collegue.setPose('stupefait');
    await s.say('c5_3_perdu');
    await s.tween({ targets: [port, earth], alpha: 0, duration: 400 });
    destroyAll([port, earth]);

    // L'onde radio, à reconstruire morceau par morceau.
    margaret.setPose('reflechit');
    collegue.setPose('explique');
    const p0 = wave.generate(s.profile, { index: 0, easier: false, rng: services.rng, used: new Set() });
    await replaceWave(s, p0.total, p0.stage === 'somme' ? 0 : p0.deja);
    await s.say('c5_3_onde');
    s.surprises = [];
    const spec = waveSpec(s, () => waves.get(s)!);
    const follow = spec.followUp!;
    spec.followUp = (p, a) => {
      const next = follow(p, a);
      if (next) waveFromSum.add(next);
      return next;
    };
    await runChallenge(s, spec);

    // Le signal revient : « Bip… bip… », puis Columbia répond.
    const w = waves.get(s)!;
    w.setHave(w.total);
    await w.alive();
    sfx().beeps(2);
    await s.wait(900);
    await s.say('c5_3_recoit');
    collegue.setPose('soulage');
    margaret.setPose('joie');
    await s.say('c5_3_soupir');
    await s.say('c5_3_frayeur');
    services.music.play('leger');
    await s.tween({ targets: w, alpha: 0, duration: 300 });
    w.destroy();
    waves.delete(s);
    calmVeil(s, false);
    await dropFrame(s);
    await s.say('c5_3_fin_simulation');
    margaret.setPose('neutre');
    collegue.setPose('neutre');
  },
};

// ---------------------------------------------------------------------------
// C5.4 — La traversée des flammes : rentrée et amerrissage (cinématique sans calcul)
// ---------------------------------------------------------------------------

const c5_4: SceneScript = {
  id: 'c5.4',
  estMs: 70_000,
  async run(s) {
    const l = lab3(s);
    const gentle = services.save.data.settings.gentle;
    const cam = s.cameras.main;
    // Le 24 juillet 1969 : Columbia près de la Terre ; la grande partie arrière se détache.
    await fade(s, 0);
    l.show(false);
    // L'espace près de la Terre : un grand morceau du disque terrestre en bas à droite (terre_proche).
    const sky = cover(s.add.image(960, 540, 'terre_proche')).setDepth(11);
    const columbia = s.prop('columbia', 700, 380, 460, 220, 13);
    services.music.play('mystere');
    await fade(s, 1, 700);
    await s.say('c5_4_date');
    const back = s.prop('module_service', 0, 0, 1, 1, 13);
    // Le module de service prend la place de l'arrière de Columbia, la capsule celle de sa pointe
    // (art/reperes.md : module_service = les 70 % de gauche de columbia.png ; l'axe de la pointe est un peu sous le milieu).
    const cut = 0.7;
    back.setDisplaySize(columbia.displayWidth * cut, columbia.displayHeight).setPosition(columbia.x - (columbia.displayWidth * (1 - cut)) / 2, columbia.y);
    const capsule = s.prop('capsule', columbia.x + columbia.displayWidth * 0.34, columbia.y + columbia.displayHeight * 0.12, 150, 110, 13).setAngle(90);
    columbia.destroy();
    const sep = s.tween({ targets: back, x: back.x - 500, y: back.y - 120, angle: -25, alpha: 0.3, duration: 5000, ease: 'Sine.In' });
    await s.say('c5_4_separation');
    // La capsule se tourne : le bouclier thermique vers la Terre.
    await s.tween({ targets: capsule, angle: -30, x: 1100, y: 520, duration: 2200, ease: 'Sine.InOut' });
    await sep;

    // La rentrée : halo orange, traînée lumineuse, souffle grave.
    await fade(s, 0, 400);
    destroyAll([sky, back]);
    const air = cover(s.add.image(960, 540, 'rentree_ciel')).setDepth(11);
    capsule.setPosition(960, 470).setAngle(0).setDepth(14);
    capsule.setScale(capsule.scale * 1.6);
    const halo = s.add.ellipse(960, 560, 360, 260, C.orange, gentle ? 0.35 : 0.6).setDepth(13);
    const trail = s.add.graphics().setDepth(12);
    trail.fillStyle(C.mustard, gentle ? 0.25 : 0.45);
    trail.fillTriangle(800, 460, 1120, 460, 960, -100);
    const fire = sfx().reentry();
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => fire.stop());
    s.tweens.add({ targets: halo, scaleX: 1.12, scaleY: 1.18, alpha: gentle ? 0.25 : 0.45, duration: 260, yoyo: true, repeat: -1 });
    await fade(s, 1, 500);
    if (!gentle) cam.shake(1200, 0.002);
    await s.wait(1200);

    // Vue intérieure rassurante : le Collègue explique.
    await fade(s, 0, 300);
    for (const o of [air, capsule, halo, trail]) o.setVisible(false);
    l.show(true);
    const margaret = s.char('margaret', 'surprise');
    const collegue = s.char('collegue', 'explique');
    await fade(s, 1, 300);
    await s.say('c5_4_chaud');
    await s.say('c5_4_bouclier');
    await fade(s, 0, 300);
    l.show(false);
    for (const o of [air, capsule, halo, trail]) o.setVisible(true);
    await fade(s, 1, 300);

    // La radio se tait un moment (la vraie coupure de la rentrée, distincte de la panne imaginaire).
    await s.say('c5_4_radio');
    sfx().crackle(2.5);
    await s.wait(2800);
    s.tweens.killTweensOf(halo);
    await s.tween({ targets: [halo, trail], alpha: 0, duration: 1200 });
    fire.stop();

    // Les nuages passent, le rythme change : les parachutes s'ouvrent.
    const clouds = s.add.graphics().setDepth(15);
    clouds.fillStyle(C.white, 0.9);
    for (let i = 0; i < 6; i++) clouds.fillEllipse(200 + i * 320, 1250 + (i % 2) * 120, 520, 140);
    s.tweens.add({ targets: clouds, y: -1500, duration: 3200, ease: 'Sine.InOut' });
    await s.wait(1600);
    const chutes = s.prop('capsule_parachutes', 960, 470, 520, 520, 14).setAlpha(0);
    sfx().chutes();
    await s.tween({ targets: chutes, alpha: 1, duration: 300 });
    capsule.setVisible(false);
    services.music.play('calme');
    await s.say('c5_4_parachutes');

    // L'océan : la descente, « Plouf ! », un bref silence, puis la confirmation.
    await fade(s, 0, 500);
    destroyAll([air, halo, trail, clouds]);
    const sea = cover(s.add.image(960, 540, 'ocean')).setDepth(11);
    const swell = sfx().waves();
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => swell.stop());
    chutes.setPosition(960, 160).setDepth(14);
    await fade(s, 1, 500);
    await s.tween({ targets: chutes, y: 470, duration: 4000, ease: 'Sine.Out' });
    // La capsule touche l'eau : les voiles retombent, l'eau éclabousse.
    sfx().splash();
    const splash = s.add.graphics().setDepth(15);
    splash.lineStyle(8, C.white, 0.9);
    splash.strokeEllipse(960, 760, 300, 60);
    splash.strokeEllipse(960, 760, 460, 90);
    s.tweens.add({ targets: splash, scaleX: 1.5, scaleY: 1.4, alpha: 0, duration: 1400 });
    const floating = s.prop('capsule', 960, 0, 220, 160, 14);
    floating.setY(1080 * 0.7 - floating.displayHeight / 2 + 30);
    chutes.destroy();
    services.music.stop(0.3);
    await s.wait(1300);
    sfx().crackle(0.5);
    await s.say('c5_4_tout_va_bien');
    services.music.play('ample');
    s.tweens.add({ targets: floating, y: floating.y + 10, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // La récupération : un hélicoptère et le navire.
    const ship = s.prop('navire', 1600, 600, 560, 140, 12).setAlpha(0);
    const heli = s.prop('helicoptere', -200, 260, 300, 130, 15);
    const rotor = sfx().helicopter();
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => rotor.stop());
    s.tweens.add({ targets: ship, alpha: 1, x: 1450, duration: 3000 });
    const fly = s.tween({ targets: heli, x: 960, y: 330, duration: 4000, ease: 'Sine.Out' });
    await s.say('c5_4_recuperation');
    await fly;
    await s.wait(800);

    await fade(s, 0, 600);
    rotor.stop();
    swell.stop();
    s.tweens.killTweensOf(floating);
    destroyAll([sea, ship, heli, floating, splash]);
    l.show(true);
    margaret.setPose('neutre');
    collegue.setPose('neutre');
    await fade(s, 1, 500);
  },
};

// ---------------------------------------------------------------------------
// C5.5 — La célébration : le laboratoire applaudit, puis la photographie de Margaret
// ---------------------------------------------------------------------------

export const PHOTO_CAPTION = 'Margaret Hamilton avec les listings du logiciel Apollo, en 1969.';
export const PHOTO_CREDIT =
  'Photo : Draper Laboratory (alors MIT Instrumentation Laboratory), 1969. Restauration : Adam Cuerden. Domaine public aux États-Unis, via Wikimedia Commons.';

const c5_5: SceneScript = {
  id: 'c5.5',
  estMs: 45_000,
  async run(s) {
    const l = lab3(s);
    l.show(true);
    const cam = s.cameras.main;
    const margaret = s.char('margaret', 'joie');
    const collegue = s.char('collegue', 'applaudit');
    // L'équipe applaudit au premier plan, coupée à la taille par le bas de l'écran (equipe_fete : les torses
    // s'arrêtent tous au bord inférieur de l'image) ; des feuilles montent dans l'air (rappel du gag du chapitre 1).
    const team = s.prop('equipe_fete', 960, 0, 1000, 430, 12).setAlpha(0);
    team.setY(1080 - team.displayHeight / 2 + 6);
    services.music.play('theme');
    await s.tween({ targets: team, alpha: 1, duration: 500 });
    sfx().applause();
    const sheets = [0, 1, 2, 3, 4, 5].map((i) => s.add.rectangle(560 + i * 170, 900, 70, 90, C.cream).setStrokeStyle(3, C.ink).setDepth(22));
    sfx().paper();
    sheets.forEach((sh, i) =>
      s.tweens.add({ targets: sh, y: 120 + (i % 3) * 60, x: sh.x + (i % 2 ? 80 : -80), angle: (i % 2 ? 1 : -1) * 260, alpha: 0.2, duration: 2600 + i * 120, ease: 'Sine.Out' }),
    );
    if (!services.save.data.settings.gentle) collegue.hop();
    await s.wait(900);
    collegue.setPose('enthousiaste');
    await s.say('c5_5_fete');
    destroyAll(sheets);

    // La caméra recule, puis passe à la photographie de Margaret auprès des listings. Sans la photographie
    // (elle n'est publiée qu'une fois ses droits validés : voir .gitignore), le Narrateur parle sur la fête.
    await s.tween({ targets: cam, zoom: 0.85, duration: 1500, ease: 'Sine.InOut' });
    const shown: Phaser.GameObjects.GameObject[] = [];
    if (s.textures.exists('photo_margaret')) {
      await fade(s, 0, 500);
      cam.setZoom(1);
      l.show(false);
      team.setVisible(false);
      // Sous les sous-titres (trois lignes au plus), au-dessus de la légende.
      const bg = s.add.rectangle(960, 540, 1920, 1080, 0x1b1712).setDepth(11);
      const frame = s.add.rectangle(960, 580, 620, 760, C.cream).setStrokeStyle(8, C.mustard).setDepth(12);
      const photo = s.prop('photo_margaret', 960, 580, 560, 580, 13);
      frame.setSize(photo.displayWidth + 40, photo.displayHeight + 40);
      const caption = s.add.text(960, 935, PHOTO_CAPTION, textStyle(40)).setOrigin(0.5).setDepth(13);
      const credit = s.add
        .text(960, 1010, PHOTO_CREDIT, textStyle(22, { color: '#cfc6b4', align: 'center', wordWrap: { width: 1500 } }))
        .setOrigin(0.5)
        .setDepth(13);
      shown.push(bg, frame, photo, caption, credit);
      await fade(s, 1, 900);
      s.tweens.add({ targets: [photo, frame], scale: '*=1.04', duration: 9000, ease: 'Sine.InOut' });
    }
    await s.say('c5_5_photo');
    await s.wait(2500);
    await fade(s, 0, 800);
    cam.setZoom(1);
    destroyAll([...shown, team]);
    margaret.setPose('neutre');
    collegue.setPose('neutre');
  },
};

export const chapter5: ChapterScript = { id: 'c5', scenes: [c5_1, c5_2, c5_3, c5_4, c5_5] };
