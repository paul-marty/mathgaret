import * as Phaser from 'phaser';
import { SCRIPTS } from '../chapters';
import { CHAPTERS, chapterById } from '../chapters/plan';
import { C, SCENES, textStyle, URLP } from '../config';
import { starsFromRate, type ProblemRecord } from '../math/scoring';
import { services } from '../services';
import { cover } from '../view/assets';
import { Button } from '../view/Button';
import { FocusLayer } from '../view/focus';
import { star } from '../view/icons';

export interface BilanData {
  chapterId: string;
  rate: number | null;
  firstMission: boolean;
  /** Le chapitre demandé n'est pas encore réalisé. */
  unavailable?: boolean;
  /** Problèmes de la partie, pour le bilan de la mission après le dernier chapitre. */
  records?: ProblemRecord[];
}

/**
 * Bilan d'un chapitre (P8) : étoile de mission et étoiles d'efficacité, dans deux zones distinctes,
 * avec leurs noms prononcés. Puis : continuer l'aventure ou faire une pause.
 * Le temps passé ici ne compte pas dans la durée active (P9).
 */
export class BilanScene extends Phaser.Scene {
  private layer = new FocusLayer('bilan');

  constructor() {
    super(SCENES.Bilan);
  }

  create(data: BilanData): void {
    // Après le dernier chapitre, le bilan est celui de toute la mission (C5.6), suivi du diplôme et du générique.
    if (!data.unavailable && data.chapterId === CHAPTERS[CHAPTERS.length - 1].id) {
      this.scene.start(SCENES.Finale, { records: data.records ?? [] });
      return;
    }
    this.tweens.timeScale = URLP.speed;
    this.layer = new FocusLayer('bilan');
    services.focus.push(this.layer);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => services.focus.pop(this.layer));
    services.clock.counting = false;
    cover(this.add.image(960, 540, 'labo_soir'));
    this.add.rectangle(960, 540, 1920, 1080, C.nightDeep, 0.6);
    void this.play(data);
  }

  private async play(data: BilanData): Promise<void> {
    const wait = (ms: number) => services.clock.wait(ms);
    const ch = chapterById(data.chapterId);
    const next = CHAPTERS[CHAPTERS.indexOf(ch) + 1];
    const run = services.save.data.run;
    const nextAvailable = Boolean(run && next && run.chapterId === next.id && SCRIPTS[next.id]);

    // Carte des cinq chapitres
    CHAPTERS.forEach((c, i) => {
      const done = services.save.data.chapters[c.id]?.missionStar;
      const x = 560 + i * 200;
      const g = this.add.graphics();
      if (i > 0) {
        g.lineStyle(8, done ? C.mustard : 0x5d6270, 1);
        g.lineBetween(x - 200 + 46, 150, x - 46, 150);
      }
      g.fillStyle(done ? C.mustard : 0x5d6270, 1);
      g.fillCircle(x, 150, 46);
      g.lineStyle(6, C.ink, 1);
      g.strokeCircle(x, 150, 46);
      this.add.text(x, 152, String(c.number), textStyle(48, { color: '#3a2a20' })).setOrigin(0.5);
    });

    if (data.unavailable) {
      this.add.text(960, 520, 'La suite arrive bientôt !', textStyle(72)).setOrigin(0.5);
      services.music.play('leger');
      await services.voice.say('bilan_bientot');
      this.menuButtons(false);
      return;
    }

    this.add.text(960, 280, `Chapitre ${ch.number} : ${ch.title}`, textStyle(56)).setOrigin(0.5);
    services.music.play('ample');

    // Zone 1 : l'étoile de mission
    const missionBox = this.add.graphics();
    missionBox.fillStyle(C.cream, 0.12);
    missionBox.fillRoundedRect(260, 380, 560, 420, 36);
    this.add.text(540, 420, 'Étoile de mission', textStyle(40)).setOrigin(0.5);
    const big = this.add.graphics({ x: 540, y: 620 });
    big.fillStyle(C.orange, 1);
    star(big, 0, 0, 130, 58);
    big.lineStyle(8, C.mustard, 1);
    big.strokeCircle(0, 0, 150);
    big.setScale(0);
    await wait(400);
    this.tweens.add({ targets: big, scale: 1, duration: 600, ease: 'Back.Out' });
    services.sfx.success();
    await services.voice.say('bilan_mission');

    // Zone 2 : les étoiles d'efficacité
    const effBox = this.add.graphics();
    effBox.fillStyle(C.cream, 0.12);
    effBox.fillRoundedRect(900, 380, 760, 420, 36);
    this.add.text(1280, 420, 'Étoiles d’efficacité', textStyle(40)).setOrigin(0.5);
    const n = data.rate === null ? 0 : starsFromRate(data.rate);
    for (let k = 0; k < 5; k++) {
      const g = this.add.graphics({ x: 1040 + k * 120, y: 600 });
      g.fillStyle(0x5d6270, 1);
      star(g, 0, 0, 52, 23);
      if (k < n) {
        const on = this.add.graphics({ x: 1040 + k * 120, y: 600 });
        on.fillStyle(C.sky, 1);
        star(on, 0, 0, 52, 23);
        on.lineStyle(5, C.white, 1);
        on.setScale(0);
        await wait(250);
        this.tweens.add({ targets: on, scale: 1, duration: 300, ease: 'Back.Out' });
        services.sfx.pop(k + 2);
      }
    }
    if (run?.mode === 'rejeu' || services.save.data.run === null) {
      const best = services.save.chapter(ch.id).best[services.save.data.settings.profile];
      if (best) this.add.text(1280, 740, `Meilleur résultat : ${starsFromRate(best.rate)} sur 5`, textStyle(34)).setOrigin(0.5);
    }
    await services.voice.say('bilan_efficacite', { n });
    if (!nextAvailable && next) {
      await services.voice.say('bilan_bientot');
      this.menuButtons(false);
      return;
    }
    await services.voice.say('bilan_suite');
    this.menuButtons(Boolean(next) && nextAvailable);
  }

  private menuButtons(canContinue: boolean): void {
    const pauseB = new Button(this, { x: canContinue ? 1200 : 960, y: 930, w: 420, h: 150, icon: 'home', iconSize: 90, text: 'Faire une pause', textSize: 38, label: 'bilan_pause', onPress: () => this.leave(SCENES.Menu) });
    this.layer.add(pauseB);
    if (canContinue) {
      const cont = new Button(this, { x: 700, y: 930, w: 460, h: 150, icon: 'play', iconSize: 90, iconColor: C.white, fill: C.green, text: 'Continuer', textSize: 40, label: 'bilan_continuer', onPress: () => this.continueAdventure() });
      this.layer.add(cont);
      services.focus.focus(cont, { silent: true });
    } else services.focus.focus(pauseB, { silent: true });
  }

  private continueAdventure(): void {
    const run = services.save.data.run;
    if (!run) return this.leave(SCENES.Menu);
    services.music.stop(0.5);
    this.cameras.main.fadeOut(350 / URLP.speed);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start(SCENES.Story, { chapterId: run.chapterId, sceneIndex: run.sceneIndex }),
    );
  }

  private leave(key: string): void {
    services.voice.stop();
    this.cameras.main.fadeOut(300 / URLP.speed);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key));
  }
}
