import * as Phaser from 'phaser';
import { CHAPTERS, chapterById, TOTAL_WEIGHT } from '../chapters/plan';
import { SCRIPTS } from '../chapters';
import type { ChapterScript } from '../chapters/types';
import { C, SCENES, URLP } from '../config';
import { installTripleTap } from '../core/input';
import { pick } from '../core/rng';
import type { RunState } from '../core/save';
import type { AnswerUI } from '../engine/answers';
import { ActionQueue, participationMs, type Action } from '../engine/challenge';
import { decideVariant, estimateNext, extraMs, type BudgetDecision } from '../math/budget';
import type { Profile } from '../math/families';
import { chapterRate } from '../math/scoring';
import type { ProblemRecord } from '../math/scoring';
import { services } from '../services';
import { cover, fit } from '../view/assets';
import { Character, type CharacterId } from '../view/Character';
import { FocusLayer, type Focusable } from '../view/focus';
import { tweenAsync } from '../view/tweens';

/** Erreur interne : la partie a été quittée ou la scène relancée, l'ancien script s'arrête. */
class Abort extends Error {}

/** Reprises après incident, par scène (une reprise, puis la scène est passée). */
const recoveries = new Map<string, number>();

export interface StoryData {
  chapterId: string;
  sceneIndex: number;
  /** Reprise d'une partie sauvegardée : une phrase restitue le contexte (P2). */
  resumed?: boolean;
}

const POS: Record<CharacterId, { x: number; y: number; h: number }> = {
  margaret: { x: 250, y: 1045, h: 540 },
  collegue: { x: 1675, y: 1045, h: 580 },
  // Lauren, la fille de Margaret (souvenir P18) : une enfant, plus petite.
  lauren: { x: 820, y: 1045, h: 400 },
};

/**
 * La scène qui joue le scénario : décor, personnages, objets, et les challenges.
 * Les scripts des chapitres (src/chapters) l'utilisent comme une petite boîte à outils.
 */
export class StoryScene extends Phaser.Scene {
  chapterId = 'c1';
  sceneIndex = 0;
  run!: RunState;
  layer = new FocusLayer('story');
  actions = new ActionQueue();
  chars: Partial<Record<CharacterId, Character>> = {};
  /** Micro-surprises disponibles dans le décor courant (P16). */
  surprises: { id: string; play: () => Promise<void> }[] = [];
  answering = false;
  busy = false;

  private bgImage: Phaser.GameObjects.Image | null = null;
  private aborted = false;
  /** Numéro de lancement de la scène : un script lancé avant une relance ne doit plus agir. */
  private gen = 0;
  private lastSurprise = '';
  private resumed = false;
  private offVoice: (() => void) | null = null;

  constructor() {
    super(SCENES.Story);
  }

  get profile(): Profile {
    return this.run.profile;
  }

  init(data: StoryData): void {
    this.chapterId = data.chapterId;
    this.sceneIndex = data.sceneIndex;
    this.resumed = Boolean(data.resumed);
    this.aborted = false;
    this.gen++;
    this.chars = {};
    this.bgImage = null;
    this.surprises = [];
    this.answering = false;
    this.busy = false;
    this.actions = new ActionQueue();
    this.layer = new FocusLayer('story');
  }

  create(): void {
    const run = services.save.data.run;
    if (!run) {
      this.scene.start(SCENES.Menu);
      return;
    }
    this.run = run;
    this.tweens.timeScale = URLP.speed;
    this.time.timeScale = URLP.speed;
    this.cameras.main.setBackgroundColor(C.nightDeep);
    this.cameras.main.fadeIn(400 / URLP.speed);

    services.focus.push(this.layer);
    this.layer.onDigit = (d) => this.currentUi?.onDigit?.(d);
    this.layer.onErase = () => this.currentUi?.onErase?.();
    services.clock.counting = true;
    services.clock.activeMs = this.run.activeMs;
    services.ui.story = this;
    services.ui.overlay?.setHud('story');
    installTripleTap(this, () => services.input.handle({ type: 'next-exercise' }, 'pointer'));

    this.offVoice = services.voice.on((e, spoken) => {
      if (spoken.kind !== 'line') return;
      const ch = this.chars[spoken.speaker as CharacterId];
      ch?.setSpeaking(e === 'start');
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    void this.playChapter();
  }

  private cleanup(): void {
    this.aborted = true;
    // Les attentes du script en cours ne se résoudront plus ; la voix en cours s'arrête.
    services.clock.clearTimers();
    services.voice.stop();
    services.diag.waitingForChild = false;
    this.offVoice?.();
    services.focus.pop(this.layer);
    services.clock.counting = false;
    if (services.ui.story === this) services.ui.story = null;
    services.ui.overlay?.setHud('hidden');
  }

  check(): void {
    if (this.aborted) throw new Abort();
  }

  /** Attend une promesse du script. Si la scène a été relancée entre-temps, l'ancien script s'arrête là. */
  private async step<T>(label: string | null, p: () => Promise<T>): Promise<T> {
    this.check();
    const gen = this.gen;
    if (label) services.diag.begin(label);
    const v = await p();
    if (gen !== this.gen) throw new Abort();
    this.check();
    return v;
  }

  /**
   * Incident (erreur dans une scène, blocage) : la scène reprend depuis son début ;
   * si l'incident se reproduit, on passe à la scène suivante. L'enfant n'est jamais bloqué.
   */
  recover(why: string): void {
    const id = this.script?.scenes[this.sceneIndex]?.id ?? this.chapterId;
    const n = (recoveries.get(id) ?? 0) + 1;
    recoveries.set(id, n);
    const sceneIndex = n <= 1 ? this.sceneIndex : this.sceneIndex + 1;
    services.diag.secours(`${why} — scène ${id} ${n <= 1 ? 'reprise depuis son début' : 'passée'}`);
    this.scene.restart({ chapterId: this.chapterId, sceneIndex } satisfies StoryData);
  }

  /** Enregistre le temps actif (l'application peut être fermée à tout moment). */
  saveActive(): void {
    if (!this.run) return;
    services.save.update((d) => {
      if (d.run) d.run.activeMs = services.clock.activeMs;
    });
  }

  private get script(): ChapterScript | undefined {
    return SCRIPTS[this.chapterId];
  }

  private async playChapter(): Promise<void> {
    try {
      const script = this.script;
      if (!script) {
        this.goBilan(false);
        return;
      }
      if (this.resumed) {
        await this.wait(600);
        await this.say('gen_reprise');
      }
      for (let i = this.sceneIndex; i < script.scenes.length; i++) {
        this.sceneIndex = i;
        services.save.update((d) => {
          if (!d.run) return;
          d.run.sceneIndex = i;
          d.run.activeMs = services.clock.activeMs;
        });
        services.debug.scene = script.scenes[i].id;
        this.surprises = [];
        await script.scenes[i].run(this);
        this.check();
      }
      this.finishChapter();
    } catch (err) {
      if (err instanceof Abort) return;
      services.diag.erreur(err, `scène ${services.debug.scene ?? this.chapterId}`);
      this.recover('erreur dans le scénario');
    }
  }

  /**
   * Va directement à une scène du chapitre (console de développement). Au-delà de la dernière scène,
   * le chapitre est terminé et le bilan s'affiche.
   */
  goTo(sceneIndex: number): void {
    const script = this.script;
    if (!script || sceneIndex >= script.scenes.length) {
      this.aborted = true;
      this.finishChapter();
      return;
    }
    const i = Math.max(0, sceneIndex);
    services.save.update((d) => {
      if (d.run) d.run.sceneIndex = i;
    });
    this.scene.restart({ chapterId: this.chapterId, sceneIndex: i } satisfies StoryData);
  }

  private finishChapter(): void {
    const id = this.chapterId;
    const rate = chapterRate(this.run.records, id);
    const firstMission = !services.save.chapter(id).missionStar;
    services.save.update((d) => {
      const prog = (d.chapters[id] ??= { missionStar: false, best: {} });
      prog.missionStar = true;
      if (rate !== null) {
        const best = prog.best[this.profile];
        if (!best || rate > best.rate) prog.best[this.profile] = { rate, durationMin: this.run.durationMin };
      }
      if (!d.run) return;
      d.run.activeMs = services.clock.activeMs;
      const next = CHAPTERS[CHAPTERS.findIndex((c) => c.id === id) + 1];
      if (d.run.mode === 'aventure' && next) {
        d.run.chapterId = next.id;
        d.run.sceneIndex = 0;
      } else d.run = null;
    });
    this.scene.start(SCENES.Bilan, { chapterId: id, rate, firstMission, records: [...this.run.records] });
  }

  private goBilan(firstMission: boolean): void {
    this.scene.start(SCENES.Bilan, { chapterId: this.chapterId, rate: null, firstMission, unavailable: true });
  }

  // -------------------------------------------------------------------------
  // Boîte à outils des scripts
  // -------------------------------------------------------------------------

  say(id: string, vars?: Record<string, string | number>): Promise<void> {
    return this.step(`réplique ${id}`, () => services.voice.say(id, vars));
  }

  wait(ms: number): Promise<void> {
    return this.step(`attente ${Math.round(ms)} ms`, () => services.clock.wait(ms));
  }

  /** Animation attendue par le script : se termine toujours (voir tweenAsync). */
  tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return this.step('animation', () => tweenAsync(this, config));
  }

  /** Décor plein écran (fondu si un décor était déjà là). */
  async setBg(key: string, fadeMs = 0): Promise<Phaser.GameObjects.Image> {
    const img = cover(this.add.image(960, 540, key)).setDepth(0);
    const old = this.bgImage;
    this.bgImage = img;
    if (old && fadeMs > 0) {
      img.setAlpha(0);
      await this.tween({ targets: img, alpha: 1, duration: fadeMs });
      old.destroy();
    } else old?.destroy();
    return img;
  }

  get bg(): Phaser.GameObjects.Image | null {
    return this.bgImage;
  }

  /** Place un personnage à sa position habituelle (ou le retrouve s'il est déjà là). */
  char(who: CharacterId, pose = 'neutre'): Character {
    let c = this.chars[who];
    if (!c) {
      const p = POS[who];
      c = new Character(this, who, p.x, p.y, p.h).setDepth(20);
      this.chars[who] = c;
    }
    c.setPose(pose);
    return c;
  }

  prop(key: string, x: number, y: number, maxW: number, maxH: number, depth = 10): Phaser.GameObjects.Image {
    return fit(this.add.image(x, y, key), maxW, maxH).setDepth(depth);
  }

  /**
   * Attend que l'enfant désigne un des éléments (aux flèches + OK, ou au doigt).
   * `reminder` : réplique redite une seule fois si rien ne se passe pendant `reminderMs` (invitation ponctuelle).
   * `timeoutMs` : au-delà, l'histoire continue sans choix (résultat `null`).
   */
  choose<T extends Focusable>(items: T[], opts: { reminder?: string; reminderMs?: number; timeoutMs?: number } = {}): Promise<T | null> {
    return this.step('attend que l’enfant touche un objet', () => {
      const diag = services.diag;
      diag.waitingForChild = true;
      return new Promise<T | null>((resolve) => {
        let settled = false;
        const originals = new Map<T, () => void>();
        const settle = (it: T | null) => {
          if (settled) return;
          settled = true;
          for (const [item, original] of originals) item.activate = original;
          services.debug.press = undefined;
          this.layer.remove(...items);
          diag.waitingForChild = false;
          diag.progress();
          resolve(it);
        };
        // Console de développement (mg.toucher) : désigne un des éléments proposés.
        services.debug.press = (i = 0) => items[Math.max(0, Math.min(items.length - 1, i))]?.activate();
        for (const it of items) {
          const original = it.activate.bind(it);
          originals.set(it, it.activate);
          it.activate = () => {
            original();
            settle(it);
          };
        }
        this.layer.add(...items);
        services.focus.focus(items[0], { silent: true });
        const gen = this.gen;
        if (opts.reminder) {
          const reminder = opts.reminder;
          void services.clock.wait(opts.reminderMs ?? 15_000).then(() => {
            if (!settled && gen === this.gen && !services.voice.busy) void services.voice.say(reminder);
          });
        }
        if (opts.timeoutMs !== undefined) void services.clock.wait(opts.timeoutMs).then(() => settle(null));
      });
    });
  }

  async waitForPress<T extends Focusable>(items: T[], opts: { reminder?: string; reminderMs?: number } = {}): Promise<T> {
    return (await this.choose(items, opts)) as T;
  }

  // -------------------------------------------------------------------------
  // Réponse en cours
  // -------------------------------------------------------------------------

  private currentUi: AnswerUI<unknown> | null = null;

  beginAnswer<A>(ui: AnswerUI<A>): void {
    this.currentUi = ui as AnswerUI<unknown>;
    this.answering = true;
    this.actions.clear();
    this.layer.add(...ui.focusables());
    services.ui.overlay?.setHud('challenge');
    services.focus.focus(ui.first(), { silent: true });
    this.setBusy(false);
  }

  endAnswer<A>(ui: AnswerUI<A>): void {
    this.layer.remove(...ui.focusables());
    this.currentUi = null;
    this.answering = false;
    this.busy = false;
    services.ui.overlay?.setHud('story');
    services.focus.ensureFocus(this.layer);
  }

  /** Pendant qu'un personnage parle, on peut préparer sa réponse mais pas valider ni demander d'aide. */
  setBusy(on: boolean): void {
    this.busy = on;
    this.currentUi?.validateButton.setEnabled(!on);
    services.ui.overlay?.setBusy(on);
  }

  nextAction(): Promise<Action> {
    return this.step(null, () => this.actions.next());
  }

  /** Bouton de l'interface (réécouter, aide) pendant un challenge. */
  request(type: 'reecouter' | 'aide'): void {
    if (!this.answering || this.busy) return;
    this.actions.push({ type });
  }

  /** Retour après une longue absence (application en arrière-plan) : on réoriente doucement l'enfant. */
  afterAbsence(awayMs: number): void {
    if (this.answering && !this.busy && awayMs > 20_000) this.actions.push({ type: 'reorient' });
  }

  /** Explications des outils, au moment où ils deviennent utiles (P7, P8). */
  async tutorialsBeforeConsigne(): Promise<void> {
    this.events.emit('exercise-instructions');
    const told = services.save.data.told;
    const overlay = services.ui.overlay;
    if (!told.reecoute) {
      overlay?.setHud('challenge');
      overlay?.pulse('reecouter');
      await this.say('tuto_reecoute');
      services.save.update((d) => (d.told.reecoute = true));
    }
    overlay?.pulse(null);
  }

  // -------------------------------------------------------------------------
  // Résultats et durée
  // -------------------------------------------------------------------------

  recordProblem(r: ProblemRecord, challengeId: string, done: number): void {
    services.save.update((d) => {
      d.times.push({ family: r.family, profile: r.profile, ms: r.ms });
      if (!d.run) return;
      d.run.records.push(r);
      d.run.challengeDone[challengeId] = done;
      d.run.activeMs = services.clock.activeMs;
    });
  }

  /** Faut-il proposer une variante de plus ? (P9) */
  budgetDecision(challengeId: string, family: string): BudgetDecision {
    const run = this.run;
    const script = this.script;
    const chapter = chapterById(this.chapterId);
    const times = services.save.data.times;
    // Narration essentielle restante : clôture de la scène courante + scènes suivantes du chapitre.
    let essential = 20_000;
    let openChallenges = 1;
    if (script) {
      for (const sc of script.scenes.slice(this.sceneIndex + 1)) {
        essential += sc.estMs;
        if (sc.challenge) {
          essential += participationMs(sc.challenge.family);
          openChallenges++;
        }
      }
    }
    const openWeights = [chapter.weight];
    let targetMs = run.durationMin * 60_000;
    if (run.mode === 'aventure') {
      const idx = CHAPTERS.indexOf(chapter);
      for (const ch of CHAPTERS.slice(idx + 1)) {
        openWeights.push(ch.weight);
        const sc = SCRIPTS[ch.id];
        essential += sc ? sc.scenes.reduce((a, s) => a + s.estMs, 0) : ch.essentialMs;
        for (const c of ch.challenges) essential += participationMs(c.family);
      }
    } else {
      // Chapitre rejoué seul : son budget indicatif dans la durée choisie (P11).
      targetMs = (targetMs * chapter.weight) / TOTAL_WEIGHT;
    }
    // Temps déjà consacré aux variantes dans ce chapitre (le premier problème de chaque challenge est réservé).
    const byChallenge = new Map<string, number[]>();
    for (const r of run.records) if (r.chapterId === this.chapterId) byChallenge.set(r.challengeId, [...(byChallenge.get(r.challengeId) ?? []), r.ms]);
    const spentCurrentMs = extraMs(byChallenge.get(challengeId) ?? []);
    let spentClosedMs = 0;
    for (const [id, list] of byChallenge) if (id !== challengeId) spentClosedMs += extraMs(list);
    const decision = decideVariant({
      spentCurrentMs,
      spentClosedMs,
      targetMs,
      // En rejeu, la partie ne contient que ce chapitre : son temps actif part de zéro.
      activeMs: services.clock.activeMs,
      essentialRemainingMs: essential,
      currentWeight: chapter.weight,
      openWeights,
      openChallenges,
      nextEstimateMs: estimateNext(times, family, this.profile),
    });
    services.debug.budget = { challengeId, essential, targetMs, ...decision };
    return decision;
  }

  /** Une petite surprise entre deux problèmes, jamais la même deux fois de suite (P16). */
  async microSurprise(): Promise<void> {
    const choices = this.surprises.filter((s) => s.id !== this.lastSurprise);
    if (choices.length === 0 || services.rng() < 0.4) return;
    const s = pick(services.rng, choices);
    this.lastSurprise = s.id;
    await this.step(`petite surprise ${s.id}`, () => s.play());
  }
}
