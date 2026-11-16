import * as Phaser from 'phaser';
import { SCRIPTS } from '../chapters';
import { CHAPTERS } from '../chapters/plan';
import { NOTE_PARENTS } from '../content/note-parents';
import { C, SCENES, textStyle, URLP } from '../config';
import type { DurationMin, RunState } from '../core/save';
import type { Profile } from '../math/families';
import { starsFromRate } from '../math/scoring';
import { services } from '../services';
import { cover } from '../view/assets';
import { Button } from '../view/Button';
import { FocusLayer } from '../view/focus';
import { star } from '../view/icons';

type Screen = 'main' | 'config' | 'replay' | 'parents' | 'chapitre';

/**
 * Accueil (P2) : Nouvelle mission, Continuer, Rejouer, avec pictogrammes et lecture vocale.
 * La configuration (niveau, durée, intensité) précède une nouvelle mission (section 4.1).
 */
export class MenuScene extends Phaser.Scene {
  private layer = new FocusLayer('menu');
  private screen: Screen = 'main';
  private notePage = 0;
  private items: Phaser.GameObjects.GameObject[] = [];
  /** Chapitre de départ d'une nouvelle mission : le premier, sauf par l'accès caché de l'écran de lancement. */
  private startChapter = 'c1';

  constructor() {
    super(SCENES.Menu);
  }

  create(data: { screen?: Screen } = {}): void {
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
    this.show(data.screen ?? 'main');
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
    else if (screen === 'parents') this.showParents();
    else if (screen === 'chapitre') this.showStartChapter();
    else this.showReplay();
    services.focus.ensureFocus(this.layer);
  }

  private showMain(): void {
    const run = services.save.data.run;
    const canContinue = Boolean(run && SCRIPTS[run.chapterId]);
    this.startChapter = 'c1';
    const canReplay = CHAPTERS.some((c) => services.save.data.chapters[c.id]?.missionStar);
    const nouvelle = this.button({ x: 960, y: 470, w: 760, h: 190, icon: 'rocket', iconSize: 140, text: 'Nouvelle mission', textSize: 56, fill: C.mustard, label: 'menu_nouvelle', onPress: () => this.show('config') });
    const cont = this.button({ x: 960, y: 690, w: 760, h: 160, icon: 'play', iconSize: 100, text: 'Continuer', textSize: 52, label: 'menu_continuer', onPress: () => this.continueRun() });
    cont.setEnabled(canContinue);
    const replay = this.button({ x: 960, y: 880, w: 760, h: 160, icon: 'replay', iconSize: 100, text: 'Rejouer un chapitre', textSize: 52, label: 'menu_rejouer', onPress: () => this.show('replay') });
    replay.setEnabled(canReplay);
    // Pour les parents : la note historique et le prénom du diplôme, à l'écart du parcours de l'enfant.
    this.button({ x: 1700, y: 1010, w: 380, h: 100, icon: 'helper', iconSize: 60, text: 'Pour les parents', textSize: 30, label: 'menu_parents', onPress: () => this.show('parents') });
    services.focus.focus(canContinue ? cont : nouvelle, { silent: true });
  }

  /** Réglages de la mission : pensés pour l'adulte, mais lus à voix haute si l'enfant les parcourt. */
  private showConfig(): void {
    const s = services.save.data.settings;
    const start = CHAPTERS.find((c) => c.id === this.startChapter);
    if (start && start.number > 1) this.text(960, 196, `Départ : chapitre ${start.number}, « ${start.title} »`, 32).setColor('#f2c14e');
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
    const toggle = (x: number, icon: 'feather' | 'subtitles', text: string, key: 'gentle' | 'subtitles', lines: [string, string]) => {
      const b = this.button({
        x,
        y: 680,
        w: 330,
        h: 140,
        icon,
        iconSize: 60,
        iconColor: icon === 'feather' ? C.sky : C.ink,
        text,
        textSize: 28,
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
    toggle(720, 'feather', 'Ambiance douce', 'gentle', ['cfg_doux_oui', 'cfg_doux_non']);
    toggle(1080, 'subtitles', 'Sous-titres', 'subtitles', ['cfg_st_oui', 'cfg_st_non']);

    this.button({ x: 640, y: 900, w: 300, h: 150, icon: 'home', iconSize: 90, text: 'Retour', textSize: 40, label: 'menu_retour', onPress: () => this.show('main') });
    const go = this.button({ x: 1200, y: 900, w: 560, h: 170, icon: 'play', iconSize: 110, iconColor: C.white, text: 'C’est parti !', textSize: 52, fill: C.green, label: 'cfg_go', onPress: () => this.newMission() });
    services.focus.focus(go, { silent: true });
  }

  /** Accès caché (code de l'écran de lancement) : commencer une nouvelle mission à n'importe quel chapitre. */
  private showStartChapter(): void {
    this.text(960, 250, 'Commencer au chapitre…', 56);
    const buttons = CHAPTERS.map((ch, i) => {
      const x = 360 + i * 300;
      const b = this.button({
        x,
        y: 540,
        w: 260,
        h: 300,
        text: String(ch.number),
        textSize: 120,
        label: undefined,
        onPress: () => {
          this.startChapter = ch.id;
          this.show('config');
        },
      });
      b.setEnabled(Boolean(SCRIPTS[ch.id]));
      const t = this.add.text(x, 715, ch.title, textStyle(26, { align: 'center', wordWrap: { width: 260 } })).setOrigin(0.5, 0);
      this.items.push(t);
      return b;
    });
    this.button({ x: 960, y: 960, w: 300, h: 130, icon: 'home', iconSize: 80, text: 'Retour', textSize: 40, label: 'menu_retour', onPress: () => this.show('main') });
    services.focus.focus(buttons[0], { silent: true });
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

  /** Note aux parents, page par page, et prénom écrit sur le diplôme. */
  private showParents(): void {
    const page = NOTE_PARENTS[this.notePage];
    const panel = this.add.graphics();
    panel.fillStyle(C.nightDeep, 0.85);
    panel.fillRoundedRect(150, 220, 1620, 640, 30);
    this.items.push(panel);
    this.text(960, 270, page.title, 46).setColor('#f2c14e');
    const body = this.add.text(200, 330, page.paragraphs.join('\n\n'), textStyle(29, { wordWrap: { width: 1520 }, lineSpacing: 6 })).setOrigin(0, 0);
    this.items.push(body);
    this.text(960, 830, `${this.notePage + 1} / ${NOTE_PARENTS.length}`, 28);

    const go = (d: number) => {
      this.notePage = Math.max(0, Math.min(NOTE_PARENTS.length - 1, this.notePage + d));
      this.show('parents');
    };
    const prev = this.button({ x: 360, y: 960, w: 300, h: 120, icon: 'up', iconSize: 60, text: 'Précédente', textSize: 32, label: 'parents_precedente', onPress: () => go(-1) });
    prev.setEnabled(this.notePage > 0);
    const next = this.button({ x: 700, y: 960, w: 300, h: 120, icon: 'down', iconSize: 60, text: 'Suivante', textSize: 32, label: 'parents_suivante', onPress: () => go(1) });
    next.setEnabled(this.notePage < NOTE_PARENTS.length - 1);
    const name = services.save.data.settings.firstName?.trim();
    this.button({
      x: 1150,
      y: 960,
      w: 480,
      h: 120,
      icon: 'star',
      iconSize: 60,
      text: name ? `Diplôme : ${name}` : 'Prénom pour le diplôme',
      textSize: 30,
      label: 'cfg_prenom',
      onPress: () => this.askFirstName(),
    });
    this.button({ x: 1600, y: 960, w: 280, h: 120, icon: 'home', iconSize: 70, text: 'Retour', textSize: 36, label: 'menu_retour', onPress: () => this.show('main') });
    services.focus.focus(this.notePage < NOTE_PARENTS.length - 1 ? next : prev, { silent: true });
  }

  /** Le prénom écrit sur le diplôme (facultatif) : la boîte de saisie du navigateur, avec le clavier de l'appareil. */
  private askFirstName(): void {
    const current = services.save.data.settings.firstName ?? '';
    const answer = window.prompt('Prénom écrit sur le diplôme (laisser vide pour une ligne à remplir à la main) :', current);
    if (answer === null) return;
    const firstName = answer.trim().slice(0, 30);
    services.save.update((d) => (d.settings.firstName = firstName || undefined));
    this.show('parents');
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
      chapterId: this.startChapter,
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
