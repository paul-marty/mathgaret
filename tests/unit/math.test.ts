import { describe, expect, it } from 'vitest';
import { makeRng } from '../../src/core/rng';
import { decideVariant, estimateNext, extraMs, median } from '../../src/math/budget';
import {
  add,
  ADD_MAX,
  advance,
  compare,
  complement,
  match,
  order,
  PROFILES,
  RADIO_MAX,
  remove,
  removeFollowUp,
  TRACK_MAX,
  voyage,
  VOYAGE_PLAN,
  type Family,
  type GenContext,
  type Profile,
} from '../../src/math/families';
import { chapterRate, globalRate, RereadCounter, starsFromRate, type ProblemRecord } from '../../src/math/scoring';

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
