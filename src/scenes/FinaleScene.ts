import * as Phaser from 'phaser';
import { PHOTO_CREDIT } from '../chapters/c5';
import { CHAPTERS } from '../chapters/plan';
import { C, SCENES, textStyle, URLP } from '../config';
import { chapterRate, globalRate, progressOf, starsFromRate, type ProblemRecord } from '../math/scoring';
import { services } from '../services';
import { cover, fit } from '../view/assets';
import { Button } from '../view/Button';
import { Character } from '../view/Character';
import { FocusLayer } from '../view/focus';
import { star } from '../view/icons';

export interface FinaleData {
  /** Problèmes de la partie (aventure complète, ou chapitre 5 rejoué). */
  records: ProblemRecord[];
}

/** Ce qui défile au générique : le projet, les outils, les sources, les licences (validé le 15/11, point 15). */
export const CREDITS: string[] = [
  'Mathgaret',
  '',
  'Un jeu du Projet Mathgaret',
  '',
  'Histoire et dialogues',
  'Projet Mathgaret',
  '',
  'Voix des personnages, musiques et bruitages',
  'Voix synthétiques de personnages inventés,',
  'musiques et bruitages créés avec ElevenLabs.',
  'Aucune voix n’imite une personne réelle.',
  '',
  'Images',
  'Illustrations générées pour le jeu avec ImageGen (OpenAI)',
  '',
  'Photographie de Margaret Hamilton',
  PHOTO_CREDIT,
  '',
  'Sources historiques',
  'NASA : archives des missions Apollo',
  'MIT : histoire du logiciel d’Apollo',
  '',
  'Les incidents du laboratoire, le signal mystérieux',
  'et la panne de radio du retour sont inventés pour le jeu.',
  '',
  'Merci à Margaret Hamilton, à son équipe',
  'et aux milliers de personnes du programme Apollo.',
];

/** La Shield et les téléviseurs n'impriment pas : le bouton n'y est pas proposé (validé le 15/11, point 13). */
const IS_TV = /Android TV|SHIELD|AFT|BRAVIA|GoogleTV|SmartTV/i.test(navigator.userAgent);

/**
 * Fin de la mission (document de référence, C5.6 et C5.7) :
 * le bilan de la mission (carte des cinq chapitres, étoiles de mission et d'efficacité, une phrase de progrès),
 * le diplôme, le générique, puis la scène de Mars, montrée à chaque mission terminée, sans seuil d'étoiles.
 * Le temps passé ici ne compte pas dans la durée active (P9).
 */
export class FinaleScene extends Phaser.Scene {
  private layer = new FocusLayer('finale');
  private items: Phaser.GameObjects.GameObject[] = [];
  /** Étape en cours (tests et débogage). */
  step: 'bilan' | 'diplome' | 'generique' | 'mars' | 'fin' = 'bilan';

  constructor() {
    super(SCENES.Finale);
  }

  create(data: FinaleData): void {
    this.tweens.timeScale = URLP.speed;
    this.time.timeScale = URLP.speed;
    this.layer = new FocusLayer('finale');
    services.focus.push(this.layer);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      services.focus.pop(this.layer);
      document.getElementById('mathgaret-diplome')?.remove();
    });
    services.clock.counting = false;
    void this.play(data.records ?? []);
  }

  private wait(ms: number): Promise<void> {
    return services.clock.wait(ms);
  }

  private clear(): void {
    for (const it of this.items) it.destroy();
    this.items = [];
    this.layer.clear();
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.items.push(o);
    return o;
  }

  private button(opts: ConstructorParameters<typeof Button>[1]): Button {
    const b = this.keep(new Button(this, opts));
    this.layer.add(b);
    return b;
  }

  /** Attend l'appui sur un bouton « Continuer » (et éventuellement d'autres boutons, qui ne terminent pas l'attente). */
  private continueButton(x: number, y: number): Promise<void> {
    return new Promise((resolve) => {
      const b = this.button({ x, y, w: 420, h: 150, icon: 'play', iconSize: 90, iconColor: C.white, fill: C.green, text: 'Continuer', textSize: 40, label: 'fin_continuer', onPress: () => resolve() });
      services.focus.focus(b, { silent: true });
    });
  }

  private async play(records: ProblemRecord[]): Promise<void> {
    await this.bilan(records);
    await this.diploma();
    await this.credits();
    await this.mars();
    this.end();
  }

  // -------------------------------------------------------------------------
  // C5.6 — Les étoiles de la mission
  // -------------------------------------------------------------------------

  private async bilan(records: ProblemRecord[]): Promise<void> {
    this.step = 'bilan';
    this.keep(cover(this.add.image(960, 540, 'labo_soir')));
    this.keep(this.add.rectangle(960, 540, 1920, 1080, C.nightDeep, 0.6));
    services.music.play('theme');
    this.keep(this.add.text(960, 270, 'Mission Apollo 11 accomplie !', textStyle(72, { color: '#f2c14e' })).setOrigin(0.5));
    await services.voice.say('fin_accomplie');

    // La carte des cinq chapitres s'illumine, un chapitre après l'autre.
    for (const [i, c] of CHAPTERS.entries()) {
      const x = 560 + i * 200;
      const g = this.keep(this.add.graphics());
      if (i > 0) {
        g.lineStyle(8, C.mustard, 1);
        g.lineBetween(x - 200 + 46, 130, x - 46, 130);
      }
      g.fillStyle(C.mustard, 1);
      g.fillCircle(x, 130, 46);
      g.lineStyle(6, C.ink, 1);
      g.strokeCircle(x, 130, 46);
      this.keep(this.add.text(x, 132, String(c.number), textStyle(48, { color: '#3a2a20' })).setOrigin(0.5));
      g.setScale(0.4);
      this.tweens.add({ targets: g, scale: 1, duration: 300, ease: 'Back.Out' });
      services.sfx.pop(i + 2);
      await this.wait(260);
    }

    // Zone 1 : les étoiles de mission, une par chapitre terminé.
    const box1 = this.keep(this.add.graphics());
    box1.fillStyle(C.cream, 0.12);
    box1.fillRoundedRect(200, 380, 700, 420, 36);
    this.keep(this.add.text(550, 420, 'Étoiles de mission', textStyle(40)).setOrigin(0.5));
    const missions = CHAPTERS.filter((c) => services.save.data.chapters[c.id]?.missionStar).length;
    for (let k = 0; k < 5; k++) {
      const g = this.keep(this.add.graphics({ x: 330 + k * 110, y: 600 }));
      g.fillStyle(k < missions ? C.orange : 0x5d6270, 1);
      star(g, 0, 0, 50, 22);
      if (k < missions) {
        g.setScale(0);
        this.tweens.add({ targets: g, scale: 1, duration: 300, ease: 'Back.Out' });
        services.sfx.pop(k + 3);
        await this.wait(200);
      }
    }
    await services.voice.say('fin_etoiles_mission');

    // Zone 2 : les étoiles d'efficacité de la partie (moyenne des chapitres, P8).
    const box2 = this.keep(this.add.graphics());
    box2.fillStyle(C.cream, 0.12);
    box2.fillRoundedRect(1000, 380, 720, 420, 36);
    this.keep(this.add.text(1360, 420, 'Étoiles d’efficacité', textStyle(40)).setOrigin(0.5));
    const rate = globalRate(CHAPTERS.map((c) => chapterRate(records, c.id)));
    const n = rate === null ? 0 : starsFromRate(rate);
    for (let k = 0; k < 5; k++) {
      const g = this.keep(this.add.graphics({ x: 1120 + k * 120, y: 600 }));
      g.fillStyle(0x5d6270, 1);
      star(g, 0, 0, 52, 23);
      if (k < n) {
        const on = this.keep(this.add.graphics({ x: 1120 + k * 120, y: 600 }));
        on.fillStyle(C.sky, 1);
        star(on, 0, 0, 52, 23);
        on.setScale(0);
        await this.wait(250);
        this.tweens.add({ targets: on, scale: 1, duration: 300, ease: 'Back.Out' });
        services.sfx.pop(k + 2);
      }
    }
    await services.voice.say('bilan_efficacite', { n });
    await services.voice.say('fin_bravo');
    // Une phrase sur un progrès réellement observé pendant la partie (jamais une comparaison).
    const progress = progressOf(records);
    if (progress) await services.voice.say(`fin_progres_${progress}`);
    await this.continueButton(960, 930);
  }

  // -------------------------------------------------------------------------
  // Le diplôme (P13, texte validé le 15/11)
  // -------------------------------------------------------------------------

  private async diploma(): Promise<void> {
    this.step = 'diplome';
    services.voice.stop();
    this.clear();
    this.keep(this.add.rectangle(960, 540, 1920, 1080, C.nightDeep));
    const name = services.save.data.settings.firstName?.trim() ?? '';
    const paper = this.keep(this.add.graphics());
    paper.fillStyle(0x000000, 0.3);
    paper.fillRoundedRect(330 + 12, 60 + 14, 1260, 740, 30);
    paper.fillStyle(0xfbf6ea, 1);
    paper.fillRoundedRect(330, 60, 1260, 740, 30);
    paper.lineStyle(10, C.mustard, 1);
    paper.strokeRoundedRect(350, 80, 1220, 700, 22);
    paper.lineStyle(3, C.orange, 1);
    paper.strokeRoundedRect(372, 102, 1176, 656, 16);
    paper.fillStyle(C.mustard, 1);
    star(paper, 450, 180, 46, 20);
    star(paper, 1470, 180, 46, 20);
    const ink = { color: '#3a2a20' };
    this.keep(this.add.text(960, 175, 'Diplôme de mission Mathgaret', textStyle(66, { ...ink, color: '#c4553a' })).setOrigin(0.5));
    this.keep(this.add.text(960, 285, 'Décerné à', textStyle(38, ink)).setOrigin(0.5));
    if (name) this.keep(this.add.text(960, 360, name, textStyle(72, { ...ink, color: '#1d2b4f' })).setOrigin(0.5));
    else {
      const line = this.keep(this.add.graphics());
      line.lineStyle(4, C.ink, 0.7);
      line.lineBetween(660, 395, 1260, 395);
    }
    this.keep(this.add.text(960, 455, 'ingénieure de la mission Apollo 11 dans le jeu Mathgaret.', textStyle(36, ink)).setOrigin(0.5));
    this.keep(
      this.add
        .text(960, 560, 'Avec Margaret et son équipe, tu as résolu les défis\net mené la mission jusqu’au retour sur Terre.', textStyle(36, { ...ink, align: 'center' }))
        .setOrigin(0.5),
    );
    this.keep(this.add.text(960, 685, 'Mission accomplie !', textStyle(58, { ...ink, color: '#2f8f4e' })).setOrigin(0.5));
    const rocket = this.keep(fit(this.add.image(1450, 650, 'petite_fusee'), 110, 150));
    this.tweens.add({ targets: rocket, y: 630, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    services.sfx.success();
    await services.voice.say('fin_diplome_titre');
    await services.voice.say('fin_diplome_texte');
    await services.voice.say('fin_diplome_fin');
    if (!IS_TV) {
      this.button({ x: 560, y: 930, w: 520, h: 150, icon: 'star', iconSize: 80, iconColor: C.mustard, text: 'Imprimer le diplôme', textSize: 36, label: 'fin_imprimer', onPress: () => printDiploma(name) });
    }
    await this.continueButton(IS_TV ? 960 : 1300, 930);
  }

  // -------------------------------------------------------------------------
  // Le générique
  // -------------------------------------------------------------------------

  private async credits(): Promise<void> {
    this.step = 'generique';
    services.voice.stop();
    this.clear();
    this.keep(cover(this.add.image(960, 540, 'labo_soir')));
    this.keep(this.add.rectangle(960, 540, 1920, 1080, C.nightDeep, 0.8));
    const roll = this.keep(this.add.container(960, 1150));
    let y = 0;
    for (const [i, line] of CREDITS.entries()) {
      const head = i === 0 || /^(Un jeu|Histoire|Voix des|Images|Photographie|Sources)/.test(line);
      const t = this.add.text(0, y, line, textStyle(i === 0 ? 96 : head ? 44 : 32, { color: head ? '#f2c14e' : '#f6ecd9', align: 'center', wordWrap: { width: 1500 } })).setOrigin(0.5, 0);
      roll.add(t);
      y += line === '' ? 40 : t.height + 14;
    }
    const height = y;
    // Le générique défile en musique ; « Continuer » permet de passer.
    const done = new Promise<void>((resolve) => {
      this.tweens.add({ targets: roll, y: -height - 80, duration: 26_000, ease: 'Linear', onComplete: () => resolve() });
    });
    const skip = this.continueButton(1640, 980);
    await Promise.race([done, skip]);
  }

  // -------------------------------------------------------------------------
  // C5.7 — La scène secrète du générique : Mars (P14)
  // -------------------------------------------------------------------------

  private async mars(): Promise<void> {
    this.step = 'mars';
    services.voice.stop();
    this.clear();
    const cam = this.cameras.main;
    services.music.stop(1.5);
    // Le laboratoire est redevenu silencieux. L'ordinateur se rallume. « Bip ! » La petite fusée revient.
    this.keep(cover(this.add.image(960, 540, 'labo_soir')));
    const computer = this.keep(fit(this.add.image(960, 600, 'ordinateur_apollo'), 520, 420));
    computer.setTint(0x6d7590);
    const collegue = this.keep(new Character(this, 'collegue', 1600, 1045, 560));
    await this.wait(1600);
    computer.clearTint();
    services.sfx.beeps(1);
    const rocket = this.keep(fit(this.add.image(960, 420, 'petite_fusee'), 120, 170));
    rocket.setAlpha(0);
    await new Promise<void>((r) => this.tweens.add({ targets: rocket, alpha: 1, y: 360, duration: 800, ease: 'Back.Out', onComplete: () => r() }));
    services.music.play('mystere');
    collegue.setPose('chuchote');
    await services.voice.say('fin_mars_question');

    // La caméra quitte le laboratoire, traverse les nuages, puis découvre Mars.
    await new Promise<void>((r) => {
      cam.fadeOut(500 / URLP.speed);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => r());
    });
    this.clear();
    const clouds = this.keep(cover(this.add.image(960, 540, 'rentree_ciel')));
    cam.fadeIn(400 / URLP.speed);
    services.sfx.whoosh();
    await new Promise<void>((r) => this.tweens.add({ targets: clouds, y: 1700, duration: 1800, ease: 'Sine.In', onComplete: () => r() }));
    const mars = this.keep(cover(this.add.image(960, 540, 'mars')));
    mars.setAlpha(0).setScale(mars.scale * 0.8);
    services.music.play('theme');
    await new Promise<void>((r) => this.tweens.add({ targets: mars, alpha: 1, scale: mars.scale * 1.25, duration: 3000, ease: 'Sine.Out', onComplete: () => r() }));
    await services.voice.say('fin_mars_aventure');
    await this.wait(1500);
  }

  private end(): void {
    this.step = 'fin';
    const home = this.button({ x: 960, y: 940, w: 560, h: 150, icon: 'home', iconSize: 90, text: 'Retour à l’accueil', textSize: 40, label: 'fin_accueil', onPress: () => this.leave() });
    services.focus.focus(home, { silent: true });
  }

  private leave(): void {
    services.voice.stop();
    services.music.stop(0.6);
    this.cameras.main.fadeOut(300 / URLP.speed);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENES.Menu));
  }
}

/**
 * Impression du diplôme (ordinateur) : une page HTML propre, sans le canevas du jeu.
 * Le navigateur propose l'imprimante ou l'enregistrement en PDF.
 */
function printDiploma(name: string): void {
  document.getElementById('mathgaret-diplome')?.remove();
  const el = document.createElement('div');
  el.id = 'mathgaret-diplome';
  const who = name ? escapeHtml(name) : '<span class="ligne"></span>';
  el.innerHTML = `
    <style>
      #mathgaret-diplome { display: none; }
      @media print {
        @page { size: A4 landscape; margin: 12mm; }
        body > *:not(#mathgaret-diplome) { display: none !important; }
        #mathgaret-diplome { display: block; font-family: Georgia, serif; color: #3a2a20; text-align: center;
          border: 6px double #f2c14e; padding: 18mm 14mm; }
        #mathgaret-diplome h1 { color: #c4553a; font-size: 34pt; margin: 0 0 10mm; }
        #mathgaret-diplome .nom { font-size: 30pt; color: #1d2b4f; margin: 4mm 0 6mm; }
        #mathgaret-diplome .ligne { display: inline-block; width: 110mm; border-bottom: 1.5pt solid #3a2a20; height: 12mm; }
        #mathgaret-diplome p { font-size: 17pt; margin: 3mm 0; }
        #mathgaret-diplome .fin { color: #2f8f4e; font-size: 26pt; margin-top: 10mm; font-weight: bold; }
      }
    </style>
    <h1>★ Diplôme de mission Mathgaret ★</h1>
    <p>Décerné à</p>
    <div class="nom">${who}</div>
    <p>ingénieure de la mission Apollo 11 dans le jeu Mathgaret.</p>
    <p>Avec Margaret et son équipe, tu as résolu les défis<br>et mené la mission jusqu’au retour sur Terre.</p>
    <p class="fin">Mission accomplie !</p>`;
  document.body.appendChild(el);
  window.print();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
