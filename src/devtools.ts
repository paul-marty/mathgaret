import type * as Phaser from 'phaser';
import { SCRIPTS } from './chapters';
import { CHAPTERS } from './chapters/plan';
import { SCENES, URLP } from './config';
import { PROFILES, type Profile } from './math/families';
import { services } from './services';

/**
 * Console de développement : `mg` dans la console JavaScript du navigateur (taper `mg.aide()`).
 * Elle permet d'avancer vite dans les chapitres pour vérifier une scène. Rien ici ne sert à l'enfant.
 */

const isProfile = (p: unknown): p is Profile => PROFILES.includes(p as Profile);

/** Résout « c2.2 », « c2 » (première scène) ou « 2 » en chapitre + numéro de scène. */
export function findScene(id: string): { chapterId: string; sceneIndex: number } | null {
  const raw = String(id).trim().toLowerCase();
  const chapterId = raw.startsWith('c') ? raw.split('.')[0] : `c${raw.split('.')[0]}`;
  const script = SCRIPTS[chapterId];
  if (!script) return null;
  if (!raw.includes('.')) return { chapterId, sceneIndex: 0 };
  const full = raw.startsWith('c') ? raw : `c${raw}`;
  const sceneIndex = script.scenes.findIndex((s) => s.id === full);
  return sceneIndex >= 0 ? { chapterId, sceneIndex } : null;
}

/**
 * Prépare la partie pour démarrer à une scène. `fresh` : nouvelle partie (accès direct ?scene=).
 * Sinon la partie en cours est gardée (résultats, temps) ; les challenges de la scène visée et des suivantes
 * repartent de leur premier problème.
 */
export function prepareRun(chapterId: string, sceneIndex: number, opts: { profile?: Profile; fresh?: boolean } = {}): void {
  const s = services.save.data.settings;
  const later = SCRIPTS[chapterId]?.scenes.slice(sceneIndex).flatMap((sc) => (sc.challenge ? [sc.challenge.id] : [])) ?? [];
  services.save.update((d) => {
    if (d.run && !opts.fresh) {
      d.run.chapterId = chapterId;
      d.run.sceneIndex = sceneIndex;
      if (opts.profile) d.run.profile = opts.profile;
      for (const id of later) delete d.run.challengeDone[id];
      return;
    }
    d.run = {
      mode: 'aventure',
      profile: opts.profile ?? s.profile,
      durationMin: s.durationMin,
      targetMs: s.durationMin * 60_000,
      activeMs: 0,
      chapterId,
      sceneIndex,
      records: [],
      challengeDone: {},
    };
  });
}

function setSpeed(game: Phaser.Game, n: number): void {
  URLP.speed = n;
  services.clock.speed = n;
  for (const sc of game.scene.getScenes(false)) {
    if (sc.scene.key === SCENES.Overlay) continue;
    sc.tweens.timeScale = n;
    sc.time.timeScale = n;
  }
}

function startStory(game: Phaser.Game, chapterId: string, sceneIndex: number): void {
  const mgr = game.scene;
  for (const key of [SCENES.Title, SCENES.Menu, SCENES.Bilan, SCENES.Finale, SCENES.Story]) {
    if (mgr.isActive(key) || mgr.isPaused(key) || mgr.isSleeping(key)) mgr.stop(key);
  }
  mgr.start(SCENES.Story, { chapterId, sceneIndex });
}

const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));

export function installConsole(game: Phaser.Game): void {
  let autoTimer: number | null = null;
  let target: string | null = null;
  let before: { speed: number; silent: boolean } | null = null;
  let exerciseTarget: { reached: () => boolean; unsubscribe: () => void } | null = null;

  const story = () => services.ui.story;
  const sceneId = () => (story() ? (services.debug.scene as string | undefined) ?? null : null);
  const chosenProfile = (p?: string): Profile | undefined => {
    if (p === undefined) return undefined;
    if (isProfile(p)) return p;
    console.warn(`Niveau inconnu « ${p} » : debut, milieu ou fin.`);
    return undefined;
  };

  const stopAuto = (why?: string) => {
    if (autoTimer !== null) window.clearInterval(autoTimer);
    autoTimer = null;
    target = null;
    exerciseTarget?.unsubscribe();
    exerciseTarget = null;
    if (before) {
      setSpeed(game, before.speed);
      services.voice.silent = before.silent;
      before = null;
    }
    if (why) console.info(`[mg] pilote automatique arrêté : ${why}`);
  };

  const autoStep = () => {
    if (game.scene.isActive(SCENES.Bilan)) return stopAuto('bilan du chapitre');
    if (game.scene.isActive(SCENES.Finale)) return stopAuto('fin de la mission');
    if (services.clock.paused) return;
    if (target && sceneId() === target) return stopAuto(`scène ${target} atteinte`);
    if (exerciseTarget?.reached()) return stopAuto('prochain exercice atteint');
    const st = story();
    if (!st) return;
    const solve = services.debug.solve as ((wrong?: boolean) => void) | undefined;
    const press = services.debug.press as ((i?: number) => void) | undefined;
    if (st.answering && !st.busy && solve) solve(false);
    else if (press) press(0);
  };

  const startFastForward = (vitesse: number) => {
    before ??= { speed: URLP.speed, silent: services.voice.silent };
    setSpeed(game, vitesse);
    services.voice.silent = true;
    if (services.voice.current) services.voice.stop();
    if (autoTimer === null) autoTimer = window.setInterval(autoStep, 250);
  };

  services.input.on((intent) => {
    if (intent.type !== 'next-exercise' || exerciseTarget || services.clock.paused) return;
    const st = story();
    if (!st) return;
    stopAuto();
    const currentProblem = st.answering ? services.debug.problem : undefined;
    const instructions = () => stopAuto('prochain exercice atteint');
    const shutdown = () => stopAuto();
    st.events.once('exercise-instructions', instructions);
    st.events.once('shutdown', shutdown);
    exerciseTarget = {
      // Si la consigne était déjà en cours, rendre la main dès que les boutons apparaissent.
      reached: () => st.answering && services.debug.problem !== currentProblem,
      unsubscribe: () => {
        st.events.off('exercise-instructions', instructions);
        st.events.off('shutdown', shutdown);
      },
    };
    startFastForward(Math.max(URLP.speed, 20));
  });

  const mg = {
    aide() {
      console.table({
        'mg.scenes()': 'liste des scènes réalisées',
        'mg.aller("c2.2", "fin")': 'va à une scène (niveau facultatif : debut, milieu, fin)',
        'mg.chapitre(2)': 'va au début d’un chapitre',
        'mg.suivante() / mg.precedente()': 'scène suivante / précédente',
        'mg.recommencer()': 'reprend la scène en cours depuis son début',
        'mg.bilan()': 'termine le chapitre (bilan)',
        'mg.passer()': 'coupe la réplique en cours, ou termine l’attente en cours',
        'mg.resoudre() / mg.erreur()': 'répond juste / faux au problème en cours',
        'mg.toucher(0)': 'touche l’objet proposé n° 0, 1…',
        'mg.auto() / mg.auto(false)': 'joue tout seul (bonnes réponses) / rend la main',
        'mg.jusqua("c2.3")': 'joue tout seul, vite et sans voix, jusqu’à cette scène',
        'mg.vitesse(8)': 'accélère tout le jeu (1 = normal)',
        'mg.muet() / mg.muet(false)': 'répliques en silence minuté (elles suivent la vitesse)',
        'mg.niveau("milieu")': 'change le niveau et reprend la scène',
        'mg.etat()': 'où en est le jeu',
      });
      return 'Exemple : mg.aller("c2.2") puis mg.vitesse(4).';
    },

    scenes() {
      const rows = CHAPTERS.flatMap((ch) => {
        const sc = SCRIPTS[ch.id];
        if (!sc) return [{ scene: `${ch.id} (à venir)`, chapitre: ch.title, challenge: '' }];
        return sc.scenes.map((s) => ({ scene: s.id, chapitre: ch.title, challenge: s.challenge?.id ?? '' }));
      });
      console.table(rows);
      return rows.map((r) => r.scene);
    },

    aller(id: string, niveau?: string) {
      const found = findScene(id);
      if (!found) return `Scène inconnue « ${id} ». Voir mg.scenes().`;
      stopAuto();
      prepareRun(found.chapterId, found.sceneIndex, { profile: chosenProfile(niveau) });
      startStory(game, found.chapterId, found.sceneIndex);
      return `→ ${SCRIPTS[found.chapterId].scenes[found.sceneIndex].id} (${services.save.data.run?.profile})`;
    },

    chapitre(n: number | string, niveau?: string) {
      return mg.aller(String(n).replace(/^c/i, '').split('.')[0], niveau);
    },

    suivante() {
      const st = story();
      if (!st) return 'Aucune scène en cours.';
      st.goTo(st.sceneIndex + 1);
      return '→ scène suivante';
    },

    precedente() {
      const st = story();
      if (!st) return 'Aucune scène en cours.';
      prepareRun(st.chapterId, Math.max(0, st.sceneIndex - 1));
      st.goTo(Math.max(0, st.sceneIndex - 1));
      return '→ scène précédente';
    },

    recommencer() {
      const st = story();
      if (!st) return 'Aucune scène en cours.';
      prepareRun(st.chapterId, st.sceneIndex);
      st.goTo(st.sceneIndex);
      return '→ scène reprise depuis son début';
    },

    bilan() {
      const st = story();
      if (!st) return 'Aucune scène en cours.';
      st.goTo(Number.MAX_SAFE_INTEGER);
      return '→ bilan du chapitre';
    },

    async passer() {
      if (services.voice.busy) {
        services.voice.stop();
        return 'réplique coupée';
      }
      if (services.diag.waitingForChild || story()?.answering) return 'L’enfant doit agir : mg.toucher(), mg.resoudre() ou mg.auto().';
      const step = services.diag.step;
      for (let i = 0; i < 30 && services.clock.skipToNext(); i++) {
        await nextTick();
        if (services.diag.step !== step) break;
      }
      return `étape : ${services.diag.step}`;
    },

    resoudre() {
      const solve = services.debug.solve as ((wrong?: boolean) => void) | undefined;
      if (!solve || !story()?.answering) return 'Aucun problème en attente de réponse.';
      if (story()?.busy) return 'Un personnage parle encore : réessayer dans un instant.';
      solve(false);
      return 'réponse juste validée';
    },

    erreur() {
      const solve = services.debug.solve as ((wrong?: boolean) => void) | undefined;
      if (!solve || !story()?.answering) return 'Aucun problème en attente de réponse.';
      if (story()?.busy) return 'Un personnage parle encore : réessayer dans un instant.';
      solve(true);
      return 'réponse fausse validée';
    },

    toucher(i = 0) {
      const press = services.debug.press as ((i?: number) => void) | undefined;
      if (!press) return 'Rien à toucher en ce moment.';
      press(i);
      return `objet n° ${i} touché`;
    },

    auto(on = true) {
      if (!on) {
        stopAuto('à la demande');
        return 'pilote automatique arrêté';
      }
      if (autoTimer === null) autoTimer = window.setInterval(autoStep, 250);
      return 'pilote automatique : bonnes réponses, premier objet proposé. mg.auto(false) pour arrêter.';
    },

    jusqua(id: string, vitesse = 10) {
      const found = findScene(id);
      if (!found) return `Scène inconnue « ${id} ». Voir mg.scenes().`;
      const wanted = SCRIPTS[found.chapterId].scenes[found.sceneIndex].id;
      if (!story()) return 'Lancer d’abord une partie (ou mg.aller).';
      if (exerciseTarget) stopAuto();
      target = wanted;
      startFastForward(vitesse);
      return `pilote automatique jusqu’à ${wanted} (vitesse ${vitesse}, sans voix)`;
    },

    vitesse(n = 1) {
      const v = Math.max(1, Math.min(40, Number(n) || 1));
      setSpeed(game, v);
      return v > 1 && !services.voice.silent ? `vitesse ${v} (astuce : mg.muet() pour que les répliques suivent)` : `vitesse ${v}`;
    },

    muet(on = true) {
      services.voice.silent = on;
      if (on && services.voice.busy) services.voice.stop();
      return on ? 'répliques en silence minuté' : 'voix rétablies';
    },

    niveau(p: string) {
      const profile = chosenProfile(p);
      if (!profile) return 'Niveaux : debut, milieu, fin.';
      services.save.update((d) => {
        d.settings.profile = profile;
        if (d.run) d.run.profile = profile;
      });
      const st = story();
      if (st) mg.recommencer();
      return `niveau ${profile}${st ? ', scène reprise' : ''}`;
    },

    etat() {
      const st = story();
      const problem = services.debug.problem as { params?: unknown; answer?: unknown } | undefined;
      return {
        scenes: game.scene.getScenes(true).map((s) => s.scene.key),
        scene: sceneId(),
        etape: services.diag.step,
        niveau: services.save.data.run?.profile ?? services.save.data.settings.profile,
        vitesse: URLP.speed,
        muet: services.voice.silent,
        reponse_attendue: st?.answering ? problem?.answer : undefined,
        probleme: st?.answering ? problem?.params : undefined,
        pilote: exerciseTarget ? 'jusqu’au prochain exercice' : autoTimer !== null ? (target ? `jusqu’à ${target}` : 'actif') : 'arrêté',
      };
    },
  };

  (window as unknown as Record<string, unknown>).mg = mg;
  console.info('[mathgaret] console de développement : mg.aide()');
}
