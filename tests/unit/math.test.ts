import { describe, expect, it } from 'vitest';
import { makeRng } from '../../src/core/rng';
import { decideVariant, estimateNext, extraMs, median } from '../../src/math/budget';
import {
  add,
  ADD_MAX,
  advance,
  approach,
  approachFollowUp,
  capacity,
  capacityFollowUp,
  type CapacityParams,
  CONTROLS_PLAN,
  freeBefore,
  GAUGE_MAX,
  TRAY,
  TRAY_MAX,
  WAITING,
  compare,
  complement,
  match,
  order,
  PROFILES,
  RADIO_MAX,
  remove,
  removeFollowUp,
  signal,
  signalFollowUp,
  signalOptions,
  SYSTEM_MAX,
  systems,
  SYSTEMS_PLAN,
  TRACK_MAX,
  voyage,
  VOYAGE_PLAN,
  type Family,
  type GenContext,
  type Profile,
  LIGHTEN_MAX,
  lighten,
  lightenPair,
  loadSum,
  RADAR_MAX,
  radar,
  radarTerms,
  wave,
  WAVE_MAX,
  waveFollowUp,
} from '../../src/math/families';
import { chapterRate, globalRate, progressOf, RereadCounter, starsFromRate, type ProblemRecord } from '../../src/math/scoring';

function series<P, A>(family: Family<P, A>, profile: Profile, n: number, seed = 1, easierAt = -1): P[] {
  const used = new Set<string>();
  const rng = makeRng(seed);
  const out: P[] = [];
  for (let index = 0; index < n; index++) {
    const ctx: GenContext = { index, easier: index === easierAt, rng, used };
    const p = family.generate(profile, ctx);
    used.add(family.key(p));
    out.push(p);
  }
  return out;
}

describe('familles de problèmes (P5, P6)', () => {
  it('le premier problème reprend l’exemple du document', () => {
    expect(series(complement, 'debut', 1)[0]).toEqual({ total: 6, deja: 2 });
    expect(series(complement, 'milieu', 1)[0]).toEqual({ total: 12, deja: 7 });
    expect(series(complement, 'fin', 1)[0]).toEqual({ total: 30, deja: 20 });
    expect(series(match, 'debut', 1)[0]).toEqual({ trays: [3, 5], target: 5 });
    expect(series(compare, 'milieu', 1)[0]).toEqual({ trays: [12, 15], ask: 'plus' });
    expect([...series(order, 'fin', 1)[0].cards].sort((a, b) => a - b)).toEqual([20, 40, 60]);
  });

  it.each(PROFILES)('compléter (%s) : valeurs dans le domaine, réponse positive, pas de doublon', (profile) => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const ps = series(complement, profile, 8, seed);
      const max = profile === 'debut' ? 10 : profile === 'milieu' ? 20 : 100;
      for (const p of ps) {
        expect(p.total).toBeLessThanOrEqual(max);
        expect(p.deja).toBeGreaterThanOrEqual(1);
        expect(complement.answer(p)).toBeGreaterThanOrEqual(1);
        expect(p.deja).toBeLessThan(p.total);
      }
      expect(new Set(ps.map(complement.key)).size).toBe(ps.length);
    }
  });

  it('compléter en fin de CP : dizaines entières d’abord, puis dizaines et unités', () => {
    const ps = series(complement, 'fin', 6, 7);
    for (const p of ps.slice(0, 3)) expect(p.deja % 10).toBe(0);
    expect(ps.slice(3).some((p) => p.deja % 10 !== 0)).toBe(true);
  });

  it('après une erreur, la variante suivante est plus simple', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const p = series(complement, 'debut', 3, seed, 2)[2];
      expect(p.total).toBeLessThanOrEqual(6);
    }
  });

  it('associer et comparer : une seule bonne réponse', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const p of series(match, 'debut', 6, seed)) {
        expect(p.trays.filter((t) => t === p.target)).toHaveLength(1);
        expect(match.check(p, match.answer(p))).toBe(true);
      }
      for (const p of series(compare, 'milieu', 6, seed)) {
        expect(p.trays[0]).not.toBe(p.trays[1]);
        expect(compare.check(p, compare.answer(p))).toBe(true);
        expect(compare.check(p, 1 - compare.answer(p))).toBe(false);
      }
    }
  });

  it('ranger : trois nombres distincts, jamais déjà dans l’ordre', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const p of series(order, 'fin', 6, seed)) {
        expect(new Set(p.cards).size).toBe(3);
        expect(order.check(p, p.cards)).toBe(false);
        expect(order.check(p, order.answer(p))).toBe(true);
      }
    }
  });
});

describe('familles du chapitre 2', () => {
  it('le premier problème reprend l’exemple du document', () => {
    expect(series(remove, 'debut', 1)[0]).toEqual({ total: 5, minus: 2 });
    expect(series(remove, 'milieu', 1)[0]).toEqual({ total: 8, minus: 3 });
    expect(series(remove, 'fin', 1)[0]).toEqual({ total: 30, minus: 12, then: 8 });
    expect(series(advance, 'debut', 1)[0]).toEqual({ from: 2, to: 6 });
    expect(series(advance, 'milieu', 1)[0]).toEqual({ from: 9, to: 15 });
    expect(series(advance, 'fin', 1)[0]).toEqual({ from: 32, to: 50 });
  });

  it('problème à deux étapes : la deuxième part du résultat de la première (30 − 12 = 18, puis 18 − 8 = 10)', () => {
    const p = series(remove, 'fin', 1)[0];
    expect(remove.answer(p)).toBe(18);
    const next = removeFollowUp(p)!;
    expect(next).toEqual({ total: 18, minus: 8 });
    expect(remove.answer(next)).toBe(10);
    expect(removeFollowUp(next)).toBeNull();
    expect(removeFollowUp({ total: 5, minus: 2 })).toBeNull();
  });

  it.each(PROFILES)('retirer (%s) : jamais plus que la collection, reste positif, pas de doublon', (profile) => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const ps = series(remove, profile, 6, seed, 3);
      const max = profile === 'debut' ? 10 : profile === 'milieu' ? 20 : 40;
      for (const p of ps) {
        expect(p.total).toBeLessThanOrEqual(max);
        expect(p.minus).toBeGreaterThanOrEqual(1);
        expect(remove.answer(p)).toBeGreaterThanOrEqual(1);
        const next = removeFollowUp(p);
        if (next) {
          expect(profile).toBe('fin');
          expect(remove.answer(next)).toBeGreaterThanOrEqual(1);
        }
      }
      expect(new Set(ps.map(remove.key)).size).toBe(ps.length);
    }
  });

  it('retirer en fin de CP : après une erreur, une seule étape', () => {
    for (const seed of [1, 2, 3, 4]) expect(series(remove, 'fin', 4, seed, 2)[2].then).toBeUndefined();
  });

  it.each(PROFILES)('avancer (%s) : départ et balise sur la piste, la balise devant', (profile) => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const ps = series(advance, profile, 6, seed, 4);
      for (const p of ps) {
        expect(p.from).toBeGreaterThanOrEqual(profile === 'fin' ? 1 : 0);
        expect(p.to).toBeLessThanOrEqual(TRACK_MAX[profile]);
        expect(advance.answer(p)).toBeGreaterThanOrEqual(1);
      }
      expect(new Set(ps.map(advance.key)).size).toBe(ps.length);
    }
  });

  it.each(PROFILES)('le grand test (%s) : un contrôle par phase, dans l’ordre du vol', (profile) => {
    for (const seed of [1, 2, 3]) {
      const ps = series(voyage, profile, 8, seed, 5);
      ps.forEach((p, i) => expect(p.kind).toBe(VOYAGE_PLAN[i % VOYAGE_PLAN.length]));
      for (const p of ps) {
        const a = voyage.answer(p);
        expect(voyage.check(p, a)).toBe(true);
        switch (p.kind) {
          case 'etoiles':
            expect(new Set(p.cards).size).toBe(3);
            expect(voyage.check(p, p.cards)).toBe(false);
            break;
          case 'plein':
            // De vraies additions : moins de 10, de 20, de 100 ; deux nombres d'au moins 2, le plus grand d'abord.
            expect(p.a + p.b).toBeLessThanOrEqual(ADD_MAX[profile]);
            expect(p.b).toBeGreaterThanOrEqual(2);
            expect(p.a).toBeGreaterThanOrEqual(p.b);
            if (profile === 'fin') expect(p.a).toBeLessThanOrEqual(60);
            break;
          case 'radio':
            expect(p.total).toBeLessThanOrEqual(RADIO_MAX[profile]);
            expect(a as number).toBeGreaterThanOrEqual(2);
            break;
          case 'freinage':
            expect(p.minus).toBeGreaterThanOrEqual(2);
            expect(a as number).toBeGreaterThanOrEqual(2);
            break;
        }
      }
      expect(new Set(ps.map(voyage.key)).size).toBe(ps.length);
    }
  });

  it('le grand test : le plein est une addition ; le freinage brûle une partie de ce même carburant', () => {
    expect(series(voyage, 'debut', 1)[0]).toEqual({ kind: 'plein', a: 5, b: 3 });
    expect(series(voyage, 'milieu', 1)[0]).toEqual({ kind: 'plein', a: 8, b: 6 });
    expect(series(voyage, 'fin', 1)[0]).toEqual({ kind: 'plein', a: 30, b: 20 });
    for (const profile of PROFILES) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const ps = series(voyage, profile, 4, seed);
        const p0 = ps[0];
        const p3 = ps[3];
        if (p0.kind !== 'plein' || p3.kind !== 'freinage') throw new Error('ordre du vol');
        expect(p3.total).toBe(p0.a + p0.b);
        // Sans retenue en fin de CP.
        if (profile === 'fin') expect(p3.minus % 10).toBeLessThanOrEqual(p3.total % 10);
      }
    }
  });

  it.each(PROFILES)('additions (%s) : sommes du profil, sans retenue en fin de CP', (profile) => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const p of series(add, profile, 8, seed, 5)) {
        expect(p.a + p.b).toBeLessThanOrEqual(ADD_MAX[profile]);
        expect(p.a).toBeGreaterThanOrEqual(p.b);
        expect(p.b).toBeGreaterThanOrEqual(profile === 'fin' ? 10 : 2);
        if (profile === 'fin') expect((p.a % 10) + (p.b % 10)).toBeLessThanOrEqual(9);
      }
    }
  });
});

describe('familles du chapitre 3', () => {
  it('vérifications : premier problème = exemple du document, puis un système à la fois', () => {
    expect(series(systems, 'debut', 1)[0]).toMatchObject({ total: 6, deja: 2 });
    expect(series(systems, 'milieu', 1)[0]).toMatchObject({ total: 12, deja: 7 });
    expect(series(systems, 'fin', 1)[0]).toMatchObject({ total: 40, deja: 25 });
    expect(series(systems, 'milieu', 4).map((p) => p.kind)).toEqual(SYSTEMS_PLAN);
    expect(new Set(SYSTEMS_PLAN)).toEqual(new Set(['communications', 'alimentation', 'navigation', 'guidage']));
  });

  it.each(PROFILES)('vérifications (%s) : au moins deux déjà vérifiés, au moins deux à faire, dans le domaine', (profile) => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const ps = series(systems, profile, 4, seed, 2);
      expect(new Set(ps.map((p) => systems.key(p))).size).toBe(ps.length);
      for (const p of ps) {
        expect(p.total).toBeLessThanOrEqual(SYSTEM_MAX[profile]);
        expect(p.deja).toBeGreaterThanOrEqual(2);
        expect(systems.answer(p)).toBeGreaterThanOrEqual(2);
        expect(systems.check(p, p.total - p.deja)).toBe(true);
      }
    }
  });

  it('vérifications (fin) : dizaines entières au deuxième problème et après une erreur', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const ps = series(systems, 'fin', 4, seed, 3);
      for (const i of [1, 3]) {
        expect(ps[i].total % 10).toBe(0);
        expect(ps[i].deja % 10).toBe(0);
      }
    }
  });

  it('signal : premier problème = exemple du document (7 − 2, 16 − 6, 50 − 20 − 5)', () => {
    expect(series(signal, 'debut', 1)[0]).toMatchObject({ total: 7, minus: 2 });
    expect(series(signal, 'milieu', 1)[0]).toMatchObject({ total: 16, minus: 6 });
    const p = series(signal, 'fin', 1)[0];
    expect(p).toMatchObject({ total: 50, minus: 20, then: 5 });
    expect(p.options[signal.answer(p)]).toBe(30);
    const next = signalFollowUp(p, makeRng(3))!;
    expect(next).toMatchObject({ total: 30, minus: 5 });
    expect(next.options).toContain(25);
    expect(signalFollowUp(next, makeRng(3))).toBeNull();
  });

  it.each(PROFILES)('signal (%s) : trois batteries différentes, une seule juste, aucune plus grande que la réserve', (profile) => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const p of series(signal, profile, 4, seed, 2)) {
        expect(p.options).toHaveLength(3);
        expect(new Set(p.options).size).toBe(3);
        const right = p.options.filter((_, i) => signal.check(p, i));
        expect(right).toEqual([p.total - p.minus]);
        for (const v of p.options) expect(v).toBeGreaterThan(0);
      }
    }
  });

  it('signal : les batteries proposées restent plausibles (écart d’une unité, d’une dizaine ou erreur typique)', () => {
    const rng = makeRng(9);
    for (let i = 0; i < 200; i++) {
      const total = 3 + (i % 48);
      const minus = 1 + (i % (total - 1));
      const opts = signalOptions(total, minus, rng);
      const answer = total - minus;
      expect(opts).toContain(answer);
      for (const v of opts.filter((v) => v !== answer)) {
        const plausible = [1, 2, 10].includes(Math.abs(v - answer)) || v === total || v === minus;
        expect(plausible).toBe(true);
      }
    }
  });
});

describe('étoiles (P8)', () => {
  const rec = (efficient: boolean, chapterId = 'c1'): ProblemRecord => ({
    chapterId,
    challengeId: 'x',
    family: 'completer',
    profile: 'debut',
    ms: 1000,
    efficient,
    errors: 0,
    helps: 0,
  });

  it('80 % donne quatre étoiles sur cinq', () => {
    const records = [rec(true), rec(true), rec(true), rec(true), rec(false)];
    expect(chapterRate(records, 'c1')).toBe(0.8);
    expect(starsFromRate(0.8)).toBe(4);
    expect(starsFromRate(1)).toBe(5);
    expect(starsFromRate(0.6)).toBe(3);
    expect(starsFromRate(0.19)).toBe(0);
  });

  it('un chapitre sans problème terminé est « en cours » et sort de la moyenne', () => {
    expect(chapterRate([rec(true)], 'c2')).toBeNull();
    expect(globalRate([1, null, 0.5])).toBe(0.75);
  });

  it('la première réécoute de chaque consigne est gratuite', () => {
    const r = new RereadCounter();
    expect(r.request(0).free).toBe(true);
    expect(r.efficient).toBe(true);
    expect(r.request(1).free).toBe(true); // autre étape d'un problème à deux étapes
    expect(r.efficient).toBe(true);
    expect(r.request(0).free).toBe(false);
    expect(r.efficient).toBe(false);
  });
});

describe('durée (P9)', () => {
  const base = {
    targetMs: 60 * 60_000,
    activeMs: 5 * 60_000,
    essentialRemainingMs: 30 * 60_000,
    currentWeight: 10,
    openWeights: [10, 12, 10, 16, 12],
    openChallenges: 2,
    nextEstimateMs: 60_000,
  };

  it('propose une variante quand elle tient dans la part du challenge', () => {
    const d = decideVariant(base);
    expect(d.availableMs).toBe(25 * 60_000);
    expect(d.shareMs).toBeCloseTo((25 * 60_000 * 10) / 60 / 2);
    expect(d.offer).toBe(true);
  });

  it('la part d’un chapitre ne se reconstitue pas après chaque variante', () => {
    // 25 min disponibles, chapitre de poids 10 sur 60, 2 challenges : 125 s par challenge.
    let spent = 0;
    let active = base.activeMs;
    let offered = 0;
    for (let i = 0; i < 100; i++) {
      const d = decideVariant({ ...base, activeMs: active, nextEstimateMs: 10_000, spentCurrentMs: spent });
      if (!d.offer) break;
      offered++;
      spent += 10_000;
      active += 10_000;
    }
    expect(offered).toBe(12);
  });

  it('conclut quand la suite de l’histoire ne laisse plus de temps', () => {
    expect(decideVariant({ ...base, activeMs: 31 * 60_000 }).offer).toBe(false);
    expect(decideVariant({ ...base, nextEstimateMs: 5 * 60_000 }).offer).toBe(false);
  });

  it('estime avec la médiane des 5 derniers problèmes de la famille, puis du profil, puis 2 min', () => {
    expect(extraMs([30, 10, 20])).toBe(30);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    const h = [10, 20, 30, 40, 50, 60].map((ms) => ({ family: 'completer', profile: 'debut' as const, ms }));
    expect(estimateNext(h, 'completer', 'debut')).toBe(40);
    expect(estimateNext(h, 'comparer', 'debut')).toBe(35);
    expect(estimateNext(h, 'comparer', 'fin')).toBe(120_000);
  });
});

describe('familles du chapitre 4', () => {
  it('prévoir : premier problème = exemple du document (8 − 3, 15 − 5, 60 − 20 − 10)', () => {
    expect(series(approach, 'debut', 1)[0]).toMatchObject({ total: 8, minus: 3 });
    expect(series(approach, 'milieu', 1)[0]).toMatchObject({ total: 15, minus: 5 });
    const p = series(approach, 'fin', 1)[0];
    expect(p).toMatchObject({ total: 60, minus: 20, then: 10 });
    const next = approachFollowUp(p)!;
    expect(next).toMatchObject({ total: 40, minus: 10 });
    expect(approach.answer(next)).toBe(30);
    // Le deuxième contrôle n'est pas le même que le premier.
    expect(next.control).not.toBe(p.control);
    expect(approachFollowUp(next)).toBeNull();
  });

  it.each(PROFILES)('prévoir (%s) : la jauge contient la réserve, il reste toujours au moins une unité', (profile) => {
    for (let seed = 1; seed <= 40; seed++) {
      const ps = series(approach, profile, 4, seed, 2);
      expect(new Set(ps.map((p) => approach.key(p))).size).toBe(ps.length);
      for (const p of ps) {
        expect(CONTROLS_PLAN).toContain(p.control);
        expect(p.total).toBeLessThanOrEqual(GAUGE_MAX[profile]);
        expect(p.minus).toBeGreaterThanOrEqual(2);
        let step: typeof p | null = p;
        while (step) {
          expect(approach.answer(step)).toBeGreaterThanOrEqual(1);
          expect(approach.check(step, step.total - step.minus)).toBe(true);
          step = approachFollowUp(step);
        }
      }
    }
  });

  /** Toutes les étapes d'un problème du plateau. */
  const steps = (p: CapacityParams): CapacityParams[] => {
    const out: CapacityParams[] = [];
    for (let s: CapacityParams | null = p; s; s = capacityFollowUp(s)) out.push(s);
    return out;
  };

  it('capacité : premier problème = exemple du document (5 − 3, 10 − 6, 50 − 20 − 15), puis le choix', () => {
    const debut = steps(series(capacity, 'debut', 1)[0]);
    expect(debut.map((s) => s.stage)).toEqual(['reste', 'choix']);
    expect(capacity.answer(debut[0])).toBe(2);
    const milieu = steps(series(capacity, 'milieu', 1)[0]);
    expect(milieu[0]).toMatchObject({ cap: 10, task: 'guidage', units: 6 });
    expect(capacity.answer(milieu[0])).toBe(4);
    const fin = steps(series(capacity, 'fin', 1)[0]);
    expect(fin.map((s) => [s.stage, s.task])).toEqual([
      ['reste', 'guidage'],
      ['reste', 'controle'],
      ['choix', 'rapport'],
    ]);
    expect(capacity.answer(fin[0])).toBe(30);
    expect(capacity.answer(fin[1])).toBe(15);
    // Le premier rapport ne tient pas : il va dans la zone d'attente.
    for (const s of [debut, milieu, fin]) expect(capacity.answer(s[s.length - 1])).toBe(WAITING);
  });

  it.each(PROFILES)('capacité (%s) : plateau à sa taille, au moins deux places libres, une vraie comparaison au choix', (profile) => {
    let fits = 0;
    let waits = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const ps = series(capacity, profile, 3, seed, 2);
      expect(new Set(ps.map((p) => capacity.key(p))).size).toBe(ps.length);
      // Le deuxième problème montre une tâche secondaire qui tient dans le plateau.
      const second = steps(ps[1]);
      expect(capacity.answer(second[second.length - 1])).toBe(TRAY);
      for (const p of ps) {
        expect(p.cap).toBeLessThanOrEqual(TRAY_MAX[profile]);
        const all = steps(p);
        const last = all[all.length - 1];
        expect(last.stage).toBe('choix');
        for (const s of all.slice(0, -1)) {
          expect(s.units).toBeGreaterThanOrEqual(2);
          expect(capacity.answer(s)).toBeGreaterThanOrEqual(2);
          expect(capacity.check(s, freeBefore(s) - s.units)).toBe(true);
        }
        // La tâche secondaire a besoin d'au moins deux unités, près du nombre de places libres.
        expect(last.units).toBeGreaterThanOrEqual(2);
        expect(Math.abs(last.units - freeBefore(last))).toBeLessThanOrEqual(10);
        if (capacity.answer(last) === TRAY) fits++;
        else waits++;
        // Réponse fausse (tests, console) : l'autre option au choix.
        expect(capacity.wrong!(last)).toBe(1 - capacity.answer(last));
      }
    }
    expect(fits).toBeGreaterThan(0);
    expect(waits).toBeGreaterThan(0);
  });

  it('capacité (fin) : dizaines entières d’abord ; après une erreur, une seule tâche indispensable', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const ps = series(capacity, 'fin', 3, seed, 2);
      expect(ps[1].cap % 10).toBe(0);
      expect(ps[1].units % 10).toBe(0);
      expect(ps[2].then).toBeUndefined();
      expect(steps(ps[2])).toHaveLength(2);
    }
  });
});

describe('familles du chapitre 5', () => {
  it('premiers problèmes : 5 kilos (3 + 2 ou 4 + 1), 10, 9, 8…, 20, 18, 16…, 50, 40, 30…, et l’onde (50 : 25 puis 15)', () => {
    const l = series(lighten, 'debut', 1)[0];
    expect(l.target).toBe(5);
    expect(l.items.map((it) => it.w)).toEqual([3, 2, 4, 1]);
    expect(lighten.check(l, [0, 1])).toBe(true);
    expect(lighten.check(l, [2, 3])).toBe(true);
    expect(lighten.check(l, [0])).toBe(false);
    expect(lighten.check(l, [0, 0])).toBe(false);
    expect(lighten.answer(l)).toEqual([2, 3]); // l'aide montre la paire avec l'objet le plus lourd
    expect(series(lighten, 'milieu', 1)[0].target).toBe(12);
    expect(series(lighten, 'fin', 1)[0].target).toBe(40);
    expect(radarTerms(series(radar, 'debut', 1)[0])).toEqual([10, 9, 8]);
    expect(radar.answer(series(radar, 'debut', 1)[0])).toBe(7);
    expect(radarTerms(series(radar, 'milieu', 1)[0])).toEqual([20, 18, 16]);
    expect(radar.answer(series(radar, 'milieu', 1)[0])).toBe(14);
    expect(radarTerms(series(radar, 'fin', 1)[0])).toEqual([50, 40, 30]);
    expect(radar.answer(series(radar, 'fin', 1)[0])).toBe(20);
    expect(series(wave, 'debut', 1)[0]).toMatchObject({ stage: 'reste', total: 6, deja: 4 });
    expect(series(wave, 'milieu', 1)[0]).toMatchObject({ stage: 'reste', total: 15, deja: 9 });
    const p = series(wave, 'fin', 1)[0];
    expect(p).toMatchObject({ stage: 'somme', total: 50, a: 25, b: 15 });
    expect(wave.answer(p)).toBe(40);
    const next = waveFollowUp(p)!;
    expect(next).toEqual({ stage: 'reste', total: 50, deja: 40 });
    expect(wave.answer(next)).toBe(10);
    expect(waveFollowUp(next)).toBeNull();
  });

  it.each(PROFILES)('alléger Eagle (%s) : deux objets font le poids, aucun seul, poids distincts et lisibles', (profile) => {
    const counts: Record<Profile, number> = { debut: 4, milieu: 5, fin: 5 };
    for (let seed = 1; seed <= 60; seed++) {
      const ps = series(lighten, profile, 4, seed, 2);
      expect(new Set(ps.map((p) => lighten.key(p))).size).toBe(ps.length);
      for (const [i, p] of ps.entries()) {
        expect(p.items).toHaveLength(counts[profile]);
        expect(new Set(p.items.map((it) => it.kind)).size).toBe(p.items.length);
        expect(p.target).toBeLessThanOrEqual(LIGHTEN_MAX[profile]);
        for (const it of p.items) {
          expect(it.w).toBeGreaterThan(0);
          expect(it.w).not.toBe(p.target);
        }
        const pair = lightenPair(p)!;
        expect(pair).not.toBeNull();
        // Une seule paire fait le poids (hors exemple du début), pour que l'aide montre la bonne.
        if (i > 0) {
          const pairs = p.items.flatMap((x, k) => p.items.slice(k + 1).filter((y) => x.w + y.w === p.target));
          expect(pairs).toHaveLength(1);
        }
        expect(loadSum(p, pair)).toBe(p.target);
        expect(lighten.check(p, lighten.answer(p))).toBe(true);
        expect(lighten.check(p, lighten.wrong!(p))).toBe(false);
        if (profile === 'milieu' && i !== 2) expect(p.target).toBeGreaterThan(10);
        if (profile === 'fin' && i > 0) {
          const [a, b] = pair.map((k) => p.items[k].w);
          if (i === 1 || i === 2) expect((a % 10) + (b % 10)).toBe(0);
          else expect((a % 10) + (b % 10)).toBeLessThanOrEqual(9);
        }
      }
    }
  });

  it.each(PROFILES)('radar (%s) : la distance baisse toujours du même pas et reste positive', (profile) => {
    const steps: Record<Profile, number[]> = { debut: [1], milieu: [1, 2], fin: [5, 10] };
    for (let seed = 1; seed <= 60; seed++) {
      const ps = series(radar, profile, 4, seed, 2);
      expect(new Set(ps.map((p) => radar.key(p))).size).toBe(ps.length);
      for (const p of ps) {
        expect(steps[profile]).toContain(p.step);
        expect(p.start).toBeLessThanOrEqual(RADAR_MAX[profile]);
        expect(radar.answer(p)).toBeGreaterThanOrEqual(2);
        const t = radarTerms(p);
        expect(t[1] - t[2]).toBe(p.step);
        expect(t[2] - radar.answer(p)).toBe(p.step);
      }
    }
  });

  it.each(PROFILES)('onde radio (%s) : sommes sans retenue (hors exemple), il manque toujours au moins un morceau', (profile) => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const [i, p] of series(wave, profile, 3, seed, 2).entries()) {
        expect(p.total).toBeLessThanOrEqual(WAVE_MAX[profile]);
        if (p.stage === 'somme') {
          expect(profile).toBe('fin');
          if (i > 0) expect((p.a! % 10) + (p.b! % 10)).toBeLessThanOrEqual(9);
          const next = waveFollowUp(p)!;
          expect(wave.answer(next)).toBeGreaterThanOrEqual(2);
        } else {
          expect(p.deja).toBeGreaterThanOrEqual(2);
          expect(wave.answer(p)).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('phrase de progrès : persévérance, puis deux étapes, puis défis réussis sans aide', () => {
    const r = (o: Partial<ProblemRecord>): ProblemRecord => ({
      chapterId: 'c1',
      challengeId: 'a',
      family: 'f',
      profile: 'fin',
      ms: 1000,
      efficient: true,
      errors: 0,
      helps: 0,
      ...o,
    });
    expect(progressOf([])).toBeNull();
    expect(progressOf([r({ helps: 1 })])).toBeNull();
    expect(progressOf([r({ challengeId: 'a' }), r({ challengeId: 'b' })])).toBe('autonome');
    expect(progressOf([r({ challengeId: 'a' }), r({ challengeId: 'b', helps: 1 })])).toBeNull();
    expect(progressOf([r({ steps: 2 }), r({ challengeId: 'b' })])).toBe('etapes');
    expect(progressOf([r({ steps: 2 }), r({ errors: 1, helps: 1 })])).toBe('correction');
  });
});
