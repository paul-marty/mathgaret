import * as Phaser from 'phaser';
import { SCRIPTS } from '../chapters';
import { CHAPTERS } from '../chapters/plan';
import { C, SCENES, textStyle, URLP } from '../config';
import type { DurationMin, RunState } from '../core/save';
import type { Profile } from '../math/families';
import { starsFromRate } from '../math/scoring';
import { services } from '../services';
import { cover } from '../view/assets';
import { Button } from '../view/Button';
import { FocusLayer } from '../view/focus';
import { star } from '../view/icons';

type Screen = 'main' | 'config' | 'replay';

/**
 * Accueil (P2) : Nouvelle mission, Continuer, Rejouer, avec pictogrammes et lecture vocale.
 * La configuration (niveau, durée, jetons, intensité) précède une nouvelle mission (section 4.1).
 */
export class MenuScene extends Phaser.Scene {
  private layer = new FocusLayer('menu');
  private screen: Screen = 'main';
  private items: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENES.Menu);
  }

  create(): void {
    this.tweens.timeScale = URLP.speed;
    this.layer = new FocusLayer('menu');
    services.focus.push(this.layer);
    cover(this.add.image(960, 540, 'labo'));
    this.add.rectangle(960, 540, 1920, 1080, C.nightDeep, 0.55);
    this.add.text(960, 120, 'Mathgaret', textStyle(110, { color: '#f2c14e', stroke: '#3a2a20', strokeThickness: 10 })).setOrigin(0.5);
    services.music.play('mystere');
    const offBack = services.input.on((intent) => {
      if (intent.type === 'back' && this.screen !== 'main') this.show('main');
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offBack();
      services.focus.pop(this.layer);
    });
    this.show('main');
  }

  private clear(): void {
    for (const it of this.items) it.destroy();
    this.items = [];
    this.layer.clear();
  }

  private button(opts: ConstructorParameters<typeof Button>[1]): Button {
    const b = new Button(this, opts);
    this.items.push(b);
    this.layer.add(b);
    return b;
  }

  private text(x: number, y: number, s: string, size = 40): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, s, textStyle(size)).setOrigin(0.5);
    this.items.push(t);
    return t;
  }

  private show(screen: Screen): void {
    this.screen = screen;
    this.clear();
    if (screen === 'main') this.showMain();
    else if (screen === 'config') this.showConfig();
    else this.showReplay();
    services.focus.ensureFocus(this.layer);
  }

  private showMain(): void {
    const run = services.save.data.run;
    const canContinue = Boolean(run && SCRIPTS[run.chapterId]);
    const canReplay = CHAPTERS.some((c) => services.save.data.chapters[c.id]?.missionStar);
    const nouvelle = this.button({ x: 960, y: 470, w: 760, h: 190, icon: 'rocket', iconSize: 140, text: 'Nouvelle mission', textSize: 56, fill: C.mustard, label: 'menu_nouvelle', onPress: () => this.show('config') });
    const cont = this.button({ x: 960, y: 690, w: 760, h: 160, icon: 'play', iconSize: 100, text: 'Continuer', textSize: 52, label: 'menu_continuer', onPress: () => this.continueRun() });
    cont.setEnabled(canContinue);
    const replay = this.button({ x: 960, y: 880, w: 760, h: 160, icon: 'replay', iconSize: 100, text: 'Rejouer un chapitre', textSize: 52, label: 'menu_rejouer', onPress: () => this.show('replay') });
    replay.setEnabled(canReplay);
    services.focus.focus(canContinue ? cont : nouvelle, { silent: true });
  }

  /** Réglages de la mission : pensés pour l'adulte, mais lus à voix haute si l'enfant les parcourt. */
  private showConfig(): void {
    const s = services.save.data.settings;
    const rowLabel = (y: number, label: string) => {
      const t = this.add.text(250, y, label, textStyle(40)).setOrigin(0, 0.5);
      this.items.push(t);
    };

    rowLabel(300, 'Niveau');
    const levels: [Profile, string, string][] = [
      ['debut', 'Début CP', 'cfg_niveau_debut'],
      ['milieu', 'Milieu CP', 'cfg_niveau_milieu'],
      ['fin', 'Fin CP', 'cfg_niveau_fin'],
    ];
    const levelButtons = levels.map(([p, label, line], i) => {
      const b = this.button({ x: 720 + i * 360, y: 300, w: 330, h: 140, icon: 'rocket', iconSize: 60 + i * 22, text: label, textSize: 36, label: line, onPress: () => select(p) });
      return { p, b };
    });
    const select = (p: Profile) => {
      services.save.update((d) => (d.settings.profile = p));
      for (const { p: q, b } of levelButtons) b.setSelected(q === p);
      services.sfx.select();
    };
    for (const { p, b } of levelButtons) b.setSelected(p === s.profile);

    rowLabel(490, 'Durée');
    const durations: DurationMin[] = [30, 45, 60];
    const durButtons = durations.map((m, i) => {
      const b = this.button({ x: 720 + i * 360, y: 490, w: 330, h: 140, icon: 'clock', iconSize: 90, iconColor: C.orange, iconExtra: m, text: m === 60 ? '1 heure' : `${m} min`, textSize: 36, label: `cfg_duree_${m}`, onPress: () => pickDur(m) });
      return { m, b };
    });
    const pickDur = (m: DurationMin) => {
      services.save.update((d) => (d.settings.durationMin = m));
      for (const { m: n, b } of durButtons) b.setSelected(n === m);
      services.sfx.select();
    };
    for (const { m, b } of durButtons) b.setSelected(m === s.durationMin);

    rowLabel(680, 'Options');
    const toggle = (x: number, icon: 'token' | 'feather' | 'subtitles', text: string, key: 'tokensReady' | 'gentle' | 'subtitles', lines: [string, string]) => {
      const b = this.button({
        x,
        y: 680,
        w: 330,
        h: 140,
        icon,
        iconSize: 80,
        iconColor: icon === 'feather' ? C.sky : C.ink,
        text,
        textSize: 32,
        label: services.save.data.settings[key] ? lines[0] : lines[1],
        onPress: () => {
          services.save.update((d) => (d.settings[key] = !d.settings[key]));
          const on = services.save.data.settings[key];
          b.setSelected(on);
          b.label = on ? lines[0] : lines[1];
          services.sfx.select();
          void services.voice.sayLabel(b.label);
          if (key === 'gentle') services.sfx.gentle = on;
        },
      });
      b.setSelected(services.save.data.settings[key]);
    };
    toggle(720, 'token', 'Jetons prêts', 'tokensReady', ['cfg_jetons_oui', 'cfg_jetons_non']);
    toggle(1080, 'feather', 'Ambiance douce', 'gentle', ['cfg_doux_oui', 'cfg_doux_non']);
    toggle(1440, 'subtitles', 'Sous-titres', 'subtitles', ['cfg_st_oui', 'cfg_st_non']);

    this.button({ x: 640, y: 900, w: 300, h: 150, icon: 'home', iconSize: 90, text: 'Retour', textSize: 40, label: 'menu_retour', onPress: () => this.show('main') });
    const go = this.button({ x: 1200, y: 900, w: 560, h: 170, icon: 'play', iconSize: 110, iconColor: C.white, text: 'C’est parti !', textSize: 52, fill: C.green, label: 'cfg_go', onPress: () => this.newMission() });
    services.focus.focus(go, { silent: true });
  }

  private showReplay(): void {
    this.text(960, 250, 'Rejouer un chapitre', 56);
    CHAPTERS.forEach((ch, i) => {
      const prog = services.save.data.chapters[ch.id];
      const x = 360 + i * 300;
      const b = this.button({
        x,
        y: 560,
        w: 260,
        h: 340,
        text: String(ch.number),
        textSize: 120,
        label: undefined,
        onPress: () => this.replay(ch.id),
      });
      b.setEnabled(Boolean(prog?.missionStar && SCRIPTS[ch.id]));
      const best = prog?.best[services.save.data.settings.profile];
      if (best) {
        const g = this.add.graphics();
        g.fillStyle(C.mustard, 1);
        const n = starsFromRate(best.rate);
        for (let k = 0; k < 5; k++) {
          g.fillStyle(k < n ? C.mustard : 0x6d6d7d, 1);
          star(g, x - 96 + k * 48, 680, 20, 9);
        }
        this.items.push(g);
      }
      const t = this.add.text(x, 790, ch.title, textStyle(26, { align: 'center', wordWrap: { width: 260 } })).setOrigin(0.5, 0);
      this.items.push(t);
    });
    this.button({ x: 960, y: 960, w: 300, h: 130, icon: 'home', iconSize: 80, text: 'Retour', textSize: 40, label: 'menu_retour', onPress: () => this.show('main') });
  }

  private startRun(run: RunState, resumed = false): void {
    services.save.update((d) => (d.run = run));
    this.goStory({ chapterId: run.chapterId, sceneIndex: run.sceneIndex, resumed });
  }

  private goStory(data: { chapterId: string; sceneIndex: number; resumed: boolean }): void {
    services.sfx.select();
    services.voice.stop();
    services.music.stop(0.5);
    this.cameras.main.fadeOut(350 / URLP.speed);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENES.Story, data));
  }

  private newMission(): void {
    const s = services.save.data.settings;
    this.startRun({
      mode: 'aventure',
      profile: s.profile,
      durationMin: s.durationMin,
      targetMs: s.durationMin * 60_000,
      activeMs: 0,
      chapterId: 'c1',
      sceneIndex: 0,
      records: [],
      challengeDone: {},
    });
  }

  private continueRun(): void {
    const run = services.save.data.run;
    if (!run) return;
    this.goStory({ chapterId: run.chapterId, sceneIndex: run.sceneIndex, resumed: true });
  }

  private replay(chapterId: string): void {
    const s = services.save.data.settings;
    this.startRun({
      mode: 'rejeu',
      profile: s.profile,
      durationMin: s.durationMin,
      targetMs: s.durationMin * 60_000,
      activeMs: 0,
      chapterId,
      sceneIndex: 0,
      records: [],
      challengeDone: {},
    });
  }
}
