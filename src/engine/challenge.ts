import { estimateNext } from '../math/budget';
import type { Family } from '../math/families';
import { RereadCounter, type ProblemRecord } from '../math/scoring';
import { services } from '../services';
import type { StoryScene } from '../scenes/StoryScene';
import type { AnswerUI } from './answers';

type Vars = Record<string, string | number>;
export type HelpLevel = 1 | 2 | 3 | 4;

/**
 * Un challenge extensible (sections 4.2 et 7) : une situation narrative, un ou plusieurs problèmes
 * selon le budget de durée, chacun avec son action, son effet visible et sa suite d'aides.
 */
export interface ChallengeSpec<P, A> {
  id: string;
  family: Family<P, A>;
  /** Met en place les objets du problème (les données restent visibles). */
  build(p: P, index: number): Promise<void> | void;
  consigne(p: P): { id: string; vars?: Vars };
  answer(p: P, onValidate: () => void): AnswerUI<A>;
  /** Explication du geste, donnée la première fois qu'il est demandé (P3). */
  gesture: Gesture | ((p: P) => Gesture);
  /** Effet visible d'une bonne réponse. `firstTry` : sans erreur (sinon le jeu dit la réplique de correction). */
  success(p: P, a: A, firstTry: boolean): Promise<void>;
  /** Effet visible d'une erreur et retour chiffré. */
  error(p: P, a: A): Promise<void>;
  /** Revient à un état corrigeable, en gardant les données de la consigne. */
  resetAfterError(p: P, ui: AnswerUI<A>): void;
  /** Aide graduée (P7) : 1 reformuler, 2 matérialiser, 3 compter, 4 montrer la solution. */
  help(p: P, level: HelpLevel, ui: AnswerUI<A>): Promise<void>;
  /** Retire les objets du problème avant la variante suivante. */
  clear(p: P): Promise<void> | void;
  /** Réplique qui introduit une variante supplémentaire. */
  nextIntro?: string;
  /** Taille de la réserve de variantes du challenge (6 par défaut). */
  maxProblems?: number;
  /**
   * Problème à deux étapes (fin de CP, section 5 et 9.3) : l'étape suivante, construite sur le résultat
   * de la précédente, qui reste affiché. `null` : le problème est terminé.
   */
  followUp?(p: P, a: A): P | null;
}

export type Gesture =
  | 'tuto_reponse'
  | 'tuto_choix'
  | 'tuto_ordre'
  | 'tuto_clavier'
  | 'tuto_batterie'
  | 'tuto_jauge'
  | 'tuto_compteur'
  | 'tuto_plateau';

export type Action = { type: 'validate' | 'reecouter' | 'aide' | 'reorient' };

export class ActionQueue {
  private queue: Action[] = [];
  private waiting: ((a: Action) => void) | null = null;

  push(a: Action): void {
    if (this.waiting) {
      const w = this.waiting;
      this.waiting = null;
      w(a);
    } else this.queue.push(a);
  }

  next(): Promise<Action> {
    const a = this.queue.shift();
    if (a) return Promise.resolve(a);
    return new Promise((resolve) => (this.waiting = resolve));
  }

  clear(): void {
    this.queue = [];
  }
}

export async function runChallenge<P, A>(s: StoryScene, spec: ChallengeSpec<P, A>): Promise<void> {
  const used = new Set<string>();
  // Reprise : les problèmes déjà terminés restent acquis (un élément validé demeure validé).
  let index = s.run.challengeDone[spec.id] ?? 0;
  let easier = false;

  for (;;) {
    const first = spec.family.generate(s.profile, { index, easier, rng: services.rng, used });
    used.add(spec.family.key(first));
    easier = false;

    if (index > 0 && spec.nextIntro) await s.say(spec.nextIntro);
    const startedAt = services.clock.activeMs;
    const tally = { errors: 0, helps: 0, efficient: true };
    let p: P | null = first;
    let last = first;
    let step = 0;
    while (p) {
      last = p;
      services.debug.problem = { challenge: spec.id, index, step, params: p, answer: spec.family.answer(p) };
      // Deuxième étape : `build` complète la scène, le résultat de la première reste affiché.
      await spec.build(p, index);
      s.check();
      const r: StepResult<A> = await solveStep(s, spec, p);
      tally.errors += r.errors;
      tally.helps += r.helps;
      tally.efficient &&= r.efficient;
      if (r.errors > 0) easier = true;
      p = spec.followUp?.(p, r.answer) ?? null;
      step++;
    }

    const record: ProblemRecord = {
      chapterId: s.chapterId,
      challengeId: spec.id,
      family: spec.family.id,
      profile: s.profile,
      ms: services.clock.activeMs - startedAt,
      efficient: tally.efficient,
      errors: tally.errors,
      helps: tally.helps,
      steps: step,
    };
    index++;
    s.recordProblem(record, spec.id, index);

    // Réserve finie de variantes pertinentes : on conclut normalement quand elle est épuisée (7.4).
    const more = index < (spec.maxProblems ?? 6) && s.budgetDecision(spec.id, spec.family.id).offer;
    // Les objets du problème sont retirés aussi après le dernier, avant la clôture de la scène.
    await spec.clear(last);
    if (!more) break;
    await s.microSurprise();
  }
}

interface StepResult<A> {
  answer: A;
  errors: number;
  helps: number;
  efficient: boolean;
}

/** Une étape : consigne, réponse préparée puis validée, erreurs et aides, effet de la bonne réponse. */
async function solveStep<P, A>(s: StoryScene, spec: ChallengeSpec<P, A>, p: P): Promise<StepResult<A>> {
  const rereads = new RereadCounter();
  let errors = 0;
  let helps = 0;
  let level = 0;
  const gesture = typeof spec.gesture === 'function' ? spec.gesture(p) : spec.gesture;

  await s.tutorialsBeforeConsigne();
  services.music.play('calme');
  const c = spec.consigne(p);
  await s.say(c.id, c.vars);

  let answer: A | null = null;
  const ui = spec.answer(p, () => s.actions.push({ type: 'validate' }));
  s.beginAnswer(ui);
  // Raccourci pour les tests et la console (mg.resoudre) : répond juste ou faux, puis valide.
  services.debug.solve = (wrong = false) => {
    const right = spec.family.answer(p);
    ui.set(wrong ? (spec.family.wrong?.(p) ?? (wrongAnswer(right) as A)) : right);
    s.actions.push({ type: 'validate' });
  };
  services.debug.validate = ui.validateButton.bounds();
  if (!services.save.data.told[gesture]) {
    s.setBusy(true);
    await s.say(gesture);
    services.save.update((d) => (d.told[gesture] = true));
    s.setBusy(false);
  }

  for (;;) {
    const action = await s.nextAction();
    s.check();
    if (action.type === 'reecouter') {
      // Chaque consigne a sa première réécoute gratuite (P7, P8).
      const { free } = rereads.request(0);
      s.setBusy(true);
      await s.say(free ? 'gen_reecoute_1' : 'gen_reecoute_n');
      await s.say(c.id, c.vars);
      s.setBusy(false);
    } else if (action.type === 'reorient') {
      // Retour après une absence : on réoriente doucement, sans compter de réécoute.
      s.setBusy(true);
      await s.say('gen_reprise');
      await s.say(c.id, c.vars);
      s.setBusy(false);
    } else if (action.type === 'aide') {
      level = Math.min(4, level + 1);
      helps++;
      s.setBusy(true);
      if (level === 1) await s.say('gen_aide');
      await spec.help(p, level as HelpLevel, ui);
      s.setBusy(false);
    } else {
      const a = ui.value();
      if (a === null) {
        s.setBusy(true);
        await s.say(gesture);
        s.setBusy(false);
        continue;
      }
      s.setBusy(true);
      if (spec.family.check(p, a)) {
        answer = a;
        break;
      }
      // Erreur : conséquence visible, retour explicatif, puis l'aide augmente d'un cran (P5).
      errors++;
      services.sfx.softError();
      if (errors === 1) await s.say('gen_erreur');
      await spec.error(p, a);
      // Retour à un état corrigeable, puis l'aide (la dernière montre la solution : elle doit rester affichée).
      spec.resetAfterError(p, ui);
      level = Math.min(4, level + 1);
      helps++;
      await spec.help(p, level as HelpLevel, ui);
      s.setBusy(false);
    }
  }

  s.endAnswer(ui);
  ui.destroy();
  services.debug.solve = undefined;
  services.sfx.success();
  const right = answer as A;
  await spec.success(p, right, errors === 0);
  // Étape intermédiaire : son résultat est gardé, on passe à la suivante.
  if (spec.followUp?.(p, right)) await s.say('gen_etape');
  else if (errors > 0) await s.say('gen_correction');
  else await s.say('gen_bravo_1'); // et ses variantes, tirées par la voix
  return { answer: right, errors, helps, efficient: rereads.efficient };
}

function wrongAnswer(right: unknown): unknown {
  if (Array.isArray(right)) return [...right].reverse();
  if (typeof right === 'number') return right <= 1 ? right + 1 : right - 1;
  return right;
}

/** Durée estimée d'une participation de cette famille (pour réserver le temps des challenges à venir). */
export function participationMs(family: string): number {
  return estimateNext(services.save.data.times, family, services.save.data.run?.profile ?? 'debut');
}
