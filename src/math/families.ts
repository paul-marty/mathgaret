import { randInt, shuffle, type Rng } from '../core/rng';

/** Profil de difficulté choisi au lancement (section 5). */
export type Profile = 'debut' | 'milieu' | 'fin';
export const PROFILES: Profile[] = ['debut', 'milieu', 'fin'];

export interface GenContext {
  /** Rang du problème dans le challenge (0 = premier) : le premier reprend l'exemple du document. */
  index: number;
  /** Vrai après une erreur : variante plus simple dans le même profil (P5). */
  easier: boolean;
  rng: Rng;
  /** Clés déjà proposées dans ce challenge (pas de doublon). */
  used: Set<string>;
}

export interface Family<P, A> {
  id: string;
  generate(profile: Profile, ctx: GenContext): P;
  answer(p: P): A;
  check(p: P, answer: A): boolean;
  key(p: P): string;
  /** Une réponse fausse plausible (tests et console) ; par défaut, une de plus ou une de moins. */
  wrong?(p: P): A;
}

/** Tire jusqu'à obtenir une variante inédite (ou renonce après quelques essais). */
function fresh<P>(ctx: GenContext, key: (p: P) => string, make: () => P): P {
  let p = make();
  for (let i = 0; i < 40 && ctx.used.has(key(p)); i++) p = make();
  return p;
}

// ---------------------------------------------------------------------------
// Compléter une collection : « il en faut `total`, il y en a déjà `deja`, combien encore ? »
// (C1.2 voyants, C3.2 instruments, C5.1 équipements…)
// ---------------------------------------------------------------------------

export interface ComplementParams {
  total: number;
  deja: number;
}

export const complement: Family<ComplementParams, number> = {
  id: 'completer',
  key: (p) => `${p.total}-${p.deja}`,
  answer: (p) => p.total - p.deja,
  check: (p, a) => a === p.total - p.deja,
  generate(profile, ctx) {
    const { rng } = ctx;
    const firsts: Record<Profile, ComplementParams> = {
      debut: { total: 6, deja: 2 },
      milieu: { total: 12, deja: 7 },
      fin: { total: 30, deja: 20 },
    };
    if (ctx.index === 0 && !ctx.used.has(complement.key(firsts[profile]))) return firsts[profile];
    return fresh(ctx, complement.key, () => {
      switch (profile) {
        case 'debut': {
          const total = randInt(rng, 4, ctx.easier ? 6 : 10);
          const deja = randInt(rng, 1, total - 1);
          return { total, deja };
        }
        case 'milieu': {
          const total = randInt(rng, ctx.easier ? 8 : 10, ctx.easier ? 12 : 20);
          const answer = randInt(rng, 2, Math.min(9, total - 1));
          return { total, deja: total - answer };
        }
        case 'fin': {
          // D'abord des dizaines entières, puis dizaines et unités (P5). 60 au plus : le panneau reste lisible.
          if (ctx.easier || ctx.index < 3) {
            const total = 10 * randInt(rng, 2, 6);
            const deja = 10 * randInt(rng, 1, total / 10 - 1);
            return { total, deja };
          }
          const total = 10 * randInt(rng, 3, 6);
          const deja = randInt(rng, 11, total - 5);
          return { total, deja };
        }
      }
    });
  },
};

// ---------------------------------------------------------------------------
// Associer un nombre à la collection correspondante (début de CP, C1.3).
// ---------------------------------------------------------------------------

export interface MatchParams {
  /** Contenu des plateaux proposés, dans l'ordre d'affichage. */
  trays: number[];
  target: number;
}

export const match: Family<MatchParams, number> = {
  id: 'associer',
  key: (p) => `${p.target}:${[...p.trays].sort((a, b) => a - b).join(',')}`,
  answer: (p) => p.trays.indexOf(p.target),
  check: (p, a) => p.trays[a] === p.target,
  generate(_profile, ctx) {
    const { rng } = ctx;
    if (ctx.index === 0 && !ctx.used.has('5:3,5')) return { trays: [3, 5], target: 5 };
    return fresh(ctx, match.key, () => {
      const target = randInt(rng, 2, ctx.easier ? 6 : 10);
      // L'écart reste visible d'un coup d'œil quand l'enfant vient de se tromper.
      const minGap = ctx.easier ? 2 : 1;
      let other = target;
      while (Math.abs(other - target) < minGap) other = randInt(rng, 1, 10);
      const trays = shuffle(rng, [target, other]);
      return { trays, target };
    });
  },
};

// ---------------------------------------------------------------------------
// Comparer deux collections : laquelle en contient le plus (ou le moins) ? (milieu de CP, C1.3)
// ---------------------------------------------------------------------------

export interface CompareParams {
  trays: [number, number];
  ask: 'plus' | 'moins';
}

export const compare: Family<CompareParams, number> = {
  id: 'comparer',
  key: (p) => `${p.ask}:${p.trays.join(',')}`,
  answer: (p) => {
    const [a, b] = p.trays;
    return p.ask === 'plus' ? (a > b ? 0 : 1) : a < b ? 0 : 1;
  },
  check: (p, a) => a === compare.answer(p),
  generate(_profile, ctx) {
    const { rng } = ctx;
    if (ctx.index === 0 && !ctx.used.has('plus:12,15')) return { trays: [12, 15], ask: 'plus' };
    return fresh(ctx, compare.key, () => {
      const a = randInt(rng, ctx.easier ? 6 : 10, ctx.easier ? 12 : 20);
      let b = a;
      const minGap = ctx.easier ? 4 : 1;
      while (Math.abs(b - a) < minGap || b < 6 || b > 20) b = randInt(rng, 6, 20);
      // Les premières variantes demandent « le plus », puis on alterne.
      const ask = ctx.index < 2 || ctx.easier ? 'plus' : rng() < 0.5 ? 'plus' : 'moins';
      return { trays: [a, b], ask };
    });
  },
};

// ---------------------------------------------------------------------------
// Ranger des nombres du plus petit au plus grand (fin de CP, C1.3).
// ---------------------------------------------------------------------------

export interface OrderParams {
  /** Cartes dans l'ordre d'affichage (mélangé). */
  cards: number[];
}

export const order: Family<OrderParams, number[]> = {
  id: 'ordonner',
  key: (p) => [...p.cards].sort((a, b) => a - b).join(','),
  answer: (p) => [...p.cards].sort((a, b) => a - b),
  check: (p, a) => a.length === p.cards.length && order.answer(p).every((v, i) => v === a[i]),
  generate(_profile, ctx) {
    const { rng } = ctx;
    if (ctx.index === 0 && !ctx.used.has('20,40,60')) return { cards: [40, 60, 20] };
    return fresh(ctx, order.key, () => {
      const values = new Set<number>();
      // Dizaines entières d'abord, puis nombres quelconques jusqu'à 100 (P5).
      const tensOnly = ctx.easier || ctx.index < 2;
      while (values.size < 3) values.add(tensOnly ? 10 * randInt(rng, 1, 9) : randInt(rng, 11, 99));
      let cards = shuffle(rng, [...values]);
      // Jamais déjà dans l'ordre : il y aurait rien à ranger.
      while (order.check({ cards }, cards)) cards = shuffle(rng, cards);
      return { cards };
    });
  },
};

// ---------------------------------------------------------------------------
// Retirer : « il y en a `total`, `minus` s'en vont, combien en reste-t-il ? » (C2.1, C2.3).
// En fin de CP, problème à deux étapes : `then` s'en vont encore, le premier résultat restant affiché.
// ---------------------------------------------------------------------------

export interface RemoveParams {
  total: number;
  minus: number;
  /** Deuxième retrait (problème à deux étapes) : l'étape suivante part du résultat de la première. */
  then?: number;
}

/** Étape suivante d'un problème à deux étapes, ou `null`. */
export function removeFollowUp(p: RemoveParams): RemoveParams | null {
  return p.then ? { total: p.total - p.minus, minus: p.then } : null;
}

function makeRemove(id: string, firsts: Record<Profile, RemoveParams>, opts: { twoSteps: boolean; finMax: number }): Family<RemoveParams, number> {
  const fam: Family<RemoveParams, number> = {
    id,
    key: (p) => `${p.total}-${p.minus}-${p.then ?? 0}`,
    answer: (p) => p.total - p.minus,
    check: (p, a) => a === p.total - p.minus,
    generate(profile, ctx) {
      const { rng } = ctx;
      if (ctx.index === 0 && !ctx.used.has(fam.key(firsts[profile]))) return firsts[profile];
      return fresh(ctx, fam.key, () => {
        switch (profile) {
          case 'debut': {
            // Au moins deux objets retirés (« 2 sont installés ») et au moins un qui reste.
            const total = randInt(rng, 4, ctx.easier ? 6 : 10);
            return { total, minus: randInt(rng, 2, total - 1) };
          }
          case 'milieu': {
            const total = randInt(rng, ctx.easier ? 6 : 9, ctx.easier ? 12 : 20);
            const rest = randInt(rng, 2, Math.min(9, total - 2));
            return { total, minus: total - rest };
          }
          case 'fin': {
            // Dizaines entières d'abord, puis dizaines et unités (P5). Après une erreur : une seule étape.
            const tensOnly = ctx.easier || ctx.index < 2;
            const total = 10 * randInt(rng, 3, opts.finMax / 10);
            const minus = tensOnly ? 10 * randInt(rng, 1, total / 10 - 2) : randInt(rng, 11, total - 15);
            const rest = total - minus;
            if (!opts.twoSteps || ctx.easier) return { total, minus };
            const then = tensOnly ? randInt(rng, 2, 9) : randInt(rng, 3, Math.min(9, rest - 3));
            return { total, minus, then };
          }
        }
      });
    },
  };
  return fam;
}

/** C2.1 : équipements installés, puis (fin de CP) contrôlés. Exemples du document : 5−2, 8−3, 30−12−8. */
export const remove = makeRemove(
  'retirer',
  { debut: { total: 5, minus: 2 }, milieu: { total: 8, minus: 3 }, fin: { total: 30, minus: 12, then: 8 } },
  { twoSteps: true, finMax: 40 },
);

// ---------------------------------------------------------------------------
// C3.2 — Les dernières vérifications : un système à la fois, chacun avec son objet
// (« il y a `total` contrôles, `deja` sont vérifiés, combien en reste-t-il ? »).
// ---------------------------------------------------------------------------

export type SystemKind = 'communications' | 'alimentation' | 'navigation' | 'guidage';
/** Les instruments de navigation d'abord : la consigne reprise du document (« douze instruments… ») les concerne. */
export const SYSTEMS_PLAN: SystemKind[] = ['navigation', 'communications', 'alimentation', 'guidage'];

export interface SystemParams {
  kind: SystemKind;
  total: number;
  deja: number;
}

/** Plus grand nombre de contrôles d'un système : 10, 20, 40. */
export const SYSTEM_MAX: Record<Profile, number> = { debut: 10, milieu: 20, fin: 40 };

export const systems: Family<SystemParams, number> = {
  id: 'systemes',
  key: (p) => `${p.total}-${p.deja}`,
  answer: (p) => p.total - p.deja,
  check: (p, a) => a === p.total - p.deja,
  generate(profile, ctx) {
    const { rng } = ctx;
    const kind = SYSTEMS_PLAN[ctx.index % SYSTEMS_PLAN.length];
    // Exemples du document : 6 − 2 (début), 12 − 7 (milieu), 40 − 25 (fin de CP).
    const firsts: Record<Profile, { total: number; deja: number }> = {
      debut: { total: 6, deja: 2 },
      milieu: { total: 12, deja: 7 },
      fin: { total: 40, deja: 25 },
    };
    if (ctx.index === 0 && !ctx.used.has(systems.key({ kind, ...firsts[profile] }))) return { kind, ...firsts[profile] };
    const p = fresh(ctx, systems.key, () => {
      // « {deja} sont vérifiés » : au moins deux ; au moins deux contrôles restent.
      switch (profile) {
        case 'debut': {
          const total = randInt(rng, 4, ctx.easier ? 6 : 10);
          return { kind, total, deja: randInt(rng, 2, total - 2) };
        }
        case 'milieu': {
          const total = randInt(rng, ctx.easier ? 8 : 10, ctx.easier ? 12 : 20);
          const rest = randInt(rng, 2, Math.min(9, total - 2));
          return { kind, total, deja: total - rest };
        }
        case 'fin': {
          // Dizaines entières d'abord (et après une erreur), puis dizaines et unités.
          if (ctx.easier || ctx.index < 2) {
            const total = 10 * randInt(rng, 2, 4);
            return { kind, total, deja: 10 * randInt(rng, 1, total / 10 - 1) };
          }
          const total = 10 * randInt(rng, 3, 4);
          return { kind, total, deja: randInt(rng, 11, total - 5) };
        }
      }
    });
    return { ...p, kind };
  },
};

// ---------------------------------------------------------------------------
// C3.3 — Le signal mystérieux : la réserve d'énergie après un test (retirer), à choisir
// parmi trois batteries (« choisir un résultat cohérent à partir de quantités visibles »).
// En fin de CP, deux retraits successifs : 50, puis 20 et 5 utilisés.
// ---------------------------------------------------------------------------

export interface SignalParams extends RemoveParams {
  /** Niveaux des trois batteries proposées, dans l'ordre d'affichage. */
  options: number[];
}

const signalRemove = makeRemove(
  'signal',
  { debut: { total: 7, minus: 2 }, milieu: { total: 16, minus: 6 }, fin: { total: 50, minus: 20, then: 5 } },
  { twoSteps: true, finMax: 50 },
);

/** Deux batteries plausibles à côté de la bonne : un écart d'une unité (ou d'une dizaine), et une erreur typique. */
export function signalOptions(total: number, minus: number, rng: Rng): number[] {
  const answer = total - minus;
  const near = [answer + 1, answer - 1, ...(total >= 20 ? [answer + 10, answer - 10] : [])];
  const typical = [total, minus, answer + 2, answer - 2];
  const ok = (v: number, taken: number[]) => v > 0 && v <= total && !taken.includes(v);
  const a = shuffle(rng, near).find((v) => ok(v, [answer])) ?? answer + 1;
  const b = shuffle(rng, typical).find((v) => ok(v, [answer, a])) ?? answer + 2;
  return shuffle(rng, [answer, a, b]);
}

export const signal: Family<SignalParams, number> = {
  id: 'signal',
  key: (p) => signalRemove.key(p),
  answer: (p) => p.options.indexOf(p.total - p.minus),
  check: (p, a) => p.options[a] === p.total - p.minus,
  generate(profile, ctx) {
    const p = signalRemove.generate(profile, ctx);
    return { ...p, options: signalOptions(p.total, p.minus, ctx.rng) };
  },
};

/** Deuxième retrait (fin de CP) : il part de la réserve trouvée à la première étape. */
export function signalFollowUp(p: SignalParams, rng: Rng): SignalParams | null {
  const next = removeFollowUp(p);
  return next ? { ...next, options: signalOptions(next.total, next.minus, rng) } : null;
}

// ---------------------------------------------------------------------------
// Avancer sur une piste : « la fusée est sur la case `from`, la balise sur la case `to` » (C2.2).
// ---------------------------------------------------------------------------

export interface AdvanceParams {
  from: number;
  to: number;
}

/** Dernière case de la piste : 10 au début, 20 au milieu, 60 en fin de CP (piste en lignes de dix). */
export const TRACK_MAX: Record<Profile, number> = { debut: 10, milieu: 20, fin: 60 };

export const advance: Family<AdvanceParams, number> = {
  id: 'avancer',
  key: (p) => `${p.from}-${p.to}`,
  answer: (p) => p.to - p.from,
  check: (p, a) => a === p.to - p.from,
  generate(profile, ctx) {
    const { rng } = ctx;
    const firsts: Record<Profile, AdvanceParams> = {
      debut: { from: 2, to: 6 },
      milieu: { from: 9, to: 15 },
      fin: { from: 32, to: 50 },
    };
    if (ctx.index === 0 && !ctx.used.has(advance.key(firsts[profile]))) return firsts[profile];
    return fresh(ctx, advance.key, () => {
      switch (profile) {
        case 'debut': {
          const to = randInt(rng, 3, ctx.easier ? 7 : 10);
          return { from: randInt(rng, 0, to - 2), to };
        }
        case 'milieu': {
          const to = randInt(rng, ctx.easier ? 6 : 10, ctx.easier ? 12 : 20);
          const jump = randInt(rng, 2, Math.min(ctx.easier ? 6 : 9, to - 1));
          return { from: to - jump, to };
        }
        case 'fin': {
          // La piste commence à la case 1. Bonds de dizaines entières d'abord, puis dizaines et unités.
          if (ctx.easier || ctx.index < 2) {
            const from = 10 * randInt(rng, 1, 3);
            return { from, to: from + 10 * randInt(rng, 1, 2) };
          }
          const from = randInt(rng, 11, 38);
          return { from, to: Math.min(60, from + randInt(rng, 12, 22)) };
        }
      }
    });
  },
};

// ---------------------------------------------------------------------------
// Additionner deux collections : « le premier en a `a`, le deuxième en a `b`, combien en tout ? »
// Sommes inférieures à 10 au début, à 20 au milieu, à 100 en fin de CP.
// ---------------------------------------------------------------------------

export interface AddParams {
  /** Le plus grand des deux nombres vient en premier (on peut compter à partir de lui). */
  a: number;
  b: number;
}

/** Plus grande somme proposée par profil. */
export const ADD_MAX: Record<Profile, number> = { debut: 9, milieu: 19, fin: 99 };

function makeAdd(id: string, firsts: Record<Profile, AddParams>, opts: { finMaxPart: number }): Family<AddParams, number> {
  const fam: Family<AddParams, number> = {
    id,
    key: (p) => `${p.a}+${p.b}`,
    answer: (p) => p.a + p.b,
    check: (p, a) => a === p.a + p.b,
    generate(profile, ctx) {
      const { rng } = ctx;
      if (ctx.index === 0 && !ctx.used.has(fam.key(firsts[profile]))) return firsts[profile];
      return fresh(ctx, fam.key, () => {
        switch (profile) {
          case 'debut': {
            // Au moins deux dans chaque collection : « 1 unités » ne se dit pas.
            const sum = randInt(rng, 4, ctx.easier ? 6 : 9);
            const b = randInt(rng, 2, Math.floor(sum / 2));
            return { a: sum - b, b };
          }
          case 'milieu': {
            const sum = randInt(rng, ctx.easier ? 10 : 11, ctx.easier ? 14 : 19);
            const b = randInt(rng, 2, Math.min(ctx.easier ? 5 : 9, Math.floor(sum / 2)));
            return { a: sum - b, b };
          }
          case 'fin': {
            const cap = opts.finMaxPart;
            // Dizaines entières d'abord, puis dizaines et unités sans retenue (P5).
            if (ctx.easier || ctx.index < 2) {
              const a = 10 * randInt(rng, 2, Math.min(cap, 80) / 10);
              const b = 10 * randInt(rng, 1, Math.min(a, 90 - a) / 10);
              return { a, b };
            }
            for (;;) {
              const a = randInt(rng, 21, cap);
              const b = 10 * randInt(rng, 1, 4) + randInt(rng, 1, 9);
              if (b <= a && a + b <= 99 && (a % 10) + (b % 10) <= 9) return { a, b };
            }
          }
        }
      });
    },
  };
  return fam;
}

/** Additions générales (chapitres suivants). */
export const add = makeAdd('ajouter', { debut: { a: 4, b: 3 }, milieu: { a: 9, b: 5 }, fin: { a: 40, b: 30 } }, { finMaxPart: 80 });

// ---------------------------------------------------------------------------
// Le grand test (C2.3) : un contrôle par phase du vol simulé, chacun avec son objet.
// Le plein (addition), la radio de Houston (compléter), les étoiles repères (ranger),
// le freinage près de la Lune (retirer : le carburant du plein est en partie brûlé).
// ---------------------------------------------------------------------------

export type VoyageKind = 'plein' | 'radio' | 'etoiles' | 'freinage';

export type VoyageParams =
  | ({ kind: 'plein' } & AddParams)
  | ({ kind: 'radio' } & ComplementParams)
  | ({ kind: 'etoiles' } & OrderParams)
  | ({ kind: 'freinage' } & RemoveParams);

/** Ordre des contrôles pendant le vol : décollage, voyage, voyage, mise en orbite lunaire. */
export const VOYAGE_PLAN: VoyageKind[] = ['plein', 'radio', 'etoiles', 'freinage'];

/** Dernier canal du cadran de la radio. */
export const RADIO_MAX: Record<Profile, number> = { debut: 10, milieu: 20, fin: 60 };

/** Réservoirs d'au plus 60 unités en fin de CP : ils restent lisibles à côté de la fusée. */
const plein = makeAdd('plein', { debut: { a: 5, b: 3 }, milieu: { a: 8, b: 6 }, fin: { a: 30, b: 20 } }, { finMaxPart: 60 });

function genRadio(profile: Profile, ctx: GenContext): ComplementParams {
  const { rng } = ctx;
  switch (profile) {
    case 'debut': {
      const total = randInt(rng, 4, ctx.easier ? 7 : 10);
      return { total, deja: randInt(rng, 1, total - 2) };
    }
    case 'milieu': {
      const total = randInt(rng, ctx.easier ? 8 : 10, ctx.easier ? 14 : 20);
      return { total, deja: total - randInt(rng, 2, Math.min(9, total - 1)) };
    }
    case 'fin': {
      if (ctx.easier || ctx.index < VOYAGE_PLAN.length) {
        const total = 10 * randInt(rng, 2, 6);
        return { total, deja: 10 * randInt(rng, 1, total / 10 - 1) };
      }
      const total = randInt(rng, 25, 60);
      return { total, deja: total - randInt(rng, 12, Math.min(25, total - 10)) };
    }
  }
}

function genEtoiles(profile: Profile, ctx: GenContext): OrderParams {
  const { rng } = ctx;
  const values = new Set<number>();
  const [lo, hi] = profile === 'debut' ? [1, 10] : profile === 'milieu' ? [1, 20] : [11, 99];
  const tensOnly = profile === 'fin' && ctx.easier;
  // Après une erreur, des nombres bien séparés.
  const minGap = ctx.easier ? (profile === 'fin' ? 10 : 3) : 1;
  while (values.size < 3) {
    const v = tensOnly ? 10 * randInt(rng, 1, 9) : randInt(rng, lo, hi);
    if ([...values].every((w) => Math.abs(w - v) >= minGap)) values.add(v);
  }
  let cards = shuffle(rng, [...values]);
  while (order.check({ cards }, cards)) cards = shuffle(rng, cards);
  return { cards };
}

/**
 * Freinage : le moteur brûle une partie du carburant mis au départ (somme du plein déjà joué,
 * sinon celle du premier plein du profil). Il reste au moins deux unités, et on en brûle au moins deux.
 */
function genFreinage(profile: Profile, ctx: GenContext): RemoveParams {
  const { rng } = ctx;
  const played = [...ctx.used].find((k) => k.startsWith('p:'));
  let total: number;
  if (played) total = played.slice(2).split('+').map(Number).reduce((x, y) => x + y, 0);
  else {
    const first = plein.generate(profile, { ...ctx, index: 0, used: new Set() });
    total = first.a + first.b;
  }
  const tens = Math.floor(total / 10);
  if (profile !== 'fin' || tens < 2) {
    const rest = randInt(rng, 2, Math.min(9, total - 2));
    return { total, minus: total - rest };
  }
  // Sans retenue : des dizaines entières si le plein en était, sinon dizaines et unités.
  const minus = 10 * randInt(rng, 1, tens - 1) + (total % 10 === 0 ? 0 : randInt(rng, 0, total % 10));
  return { total, minus };
}

const voyageKey = (p: VoyageParams): string => {
  switch (p.kind) {
    case 'plein':
      return `p:${p.a}+${p.b}`;
    case 'radio':
      return `d:${p.total}-${p.deja}`;
    case 'etoiles':
      return `e:${order.key(p)}`;
    case 'freinage':
      return `f:${p.total}-${p.minus}`;
  }
};

export const voyage: Family<VoyageParams, number | number[]> = {
  id: 'voyage',
  key: voyageKey,
  answer: (p) => {
    switch (p.kind) {
      case 'plein':
        return p.a + p.b;
      case 'radio':
        return p.total - p.deja;
      case 'etoiles':
        return order.answer(p);
      case 'freinage':
        return p.total - p.minus;
    }
  },
  check: (p, a) => {
    if (p.kind === 'etoiles') return Array.isArray(a) && order.check(p, a);
    return typeof a === 'number' && a === voyage.answer(p);
  },
  generate(profile, ctx) {
    const kind = VOYAGE_PLAN[ctx.index % VOYAGE_PLAN.length];
    // Pendant le premier tour du voyage, chaque contrôle propose une variante accessible du profil.
    const sub: GenContext = { ...ctx, index: ctx.index < VOYAGE_PLAN.length ? 0 : ctx.index };
    return fresh(ctx, voyageKey, (): VoyageParams => {
      switch (kind) {
        case 'plein': {
          const used = new Set([...ctx.used].filter((k) => k.startsWith('p:')).map((k) => k.slice(2)));
          return { kind, ...plein.generate(profile, { ...sub, used }) };
        }
        case 'radio':
          return { kind, ...genRadio(profile, sub) };
        case 'etoiles':
          return { kind, ...genEtoiles(profile, sub) };
        case 'freinage':
          return { kind, ...genFreinage(profile, sub) };
      }
    });
  },
};

// ---------------------------------------------------------------------------
// C4.1 — La Lune approche : prévoir ce qui restera dans la jauge d'énergie après le prochain contrôle.
// Exemples du document : 8 − 3 (début), 15 − 5 (milieu), 60 − 20 puis − 10 (fin de CP, deux contrôles).
// ---------------------------------------------------------------------------

/** Contrôles fictifs de la descente (un pictogramme chacun). */
export type ControlKind = 'radar' | 'moteur' | 'antenne' | 'cap';
export const CONTROLS_PLAN: ControlKind[] = ['radar', 'moteur', 'antenne', 'cap'];

/** Graduation de la jauge : 10 au début, 20 au milieu, 60 en fin de CP. */
export const GAUGE_MAX: Record<Profile, number> = { debut: 10, milieu: 20, fin: 60 };

export interface ApproachParams extends RemoveParams {
  control: ControlKind;
}

const approachRemove = makeRemove(
  'prevoir',
  { debut: { total: 8, minus: 3 }, milieu: { total: 15, minus: 5 }, fin: { total: 60, minus: 20, then: 10 } },
  { twoSteps: true, finMax: 60 },
);

export const approach: Family<ApproachParams, number> = {
  id: 'prevoir',
  key: (p) => approachRemove.key(p),
  answer: (p) => p.total - p.minus,
  check: (p, a) => a === p.total - p.minus,
  generate(profile, ctx) {
    const p = approachRemove.generate(profile, ctx);
    return { ...p, control: CONTROLS_PLAN[ctx.index % CONTROLS_PLAN.length] };
  },
};

/** Deuxième contrôle (fin de CP) : il part de ce qui restait après le premier. */
export function approachFollowUp(p: ApproachParams): ApproachParams | null {
  const next = removeFollowUp(p);
  if (!next) return null;
  return { ...next, control: CONTROLS_PLAN[(CONTROLS_PLAN.indexOf(p.control) + 1) % CONTROLS_PLAN.length] };
}

// ---------------------------------------------------------------------------
// C4.3 — Sauver les tâches essentielles : le plateau de travail de l'ordinateur.
// Étape « reste » : la tâche indispensable occupe ses places, combien en reste-t-il ?
// (fin de CP : le guidage, puis le contrôle du vol). Étape « choix » : une tâche secondaire annoncée
// tient-elle dans les places libres (plateau), ou va-t-elle dans la zone d'attente ?
// Exemples du document : 5 − 3 (début), 10 − 6 (milieu), 50 − 20 − 15 (fin de CP).
// ---------------------------------------------------------------------------

export type EssentialTask = 'guidage' | 'controle';
export type SecondaryTask = 'rapport' | 'affichage';
export type TaskKind = EssentialTask | SecondaryTask;

/** Réponse de l'étape « choix » : l'option choisie. */
export const TRAY = 0;
export const WAITING = 1;

/** Plus grand plateau : 10 places au début, 20 au milieu, 50 en fin de CP. */
export const TRAY_MAX: Record<Profile, number> = { debut: 10, milieu: 20, fin: 50 };

export interface CapacityParams {
  stage: 'reste' | 'choix';
  /** Places du plateau (unités de travail que l'ordinateur peut effectuer). */
  cap: number;
  /** Places déjà occupées par les tâches indispensables avant cette étape. */
  busy: number;
  /** La tâche de cette étape et ses unités. */
  task: TaskKind;
  units: number;
  /** Fin de CP : la deuxième tâche indispensable. */
  then?: { task: EssentialTask; units: number };
  /** La tâche secondaire annoncée à la dernière étape. */
  secondary: { task: SecondaryTask; units: number };
}

/** Places libres avant l'étape. */
export const freeBefore = (p: CapacityParams): number => p.cap - p.busy;

export const capacity: Family<CapacityParams, number> = {
  id: 'capacite',
  key: (p) => `${p.cap}-${p.units}-${p.then?.units ?? 0}-${p.secondary.units}`,
  answer: (p) => (p.stage === 'reste' ? freeBefore(p) - p.units : p.units <= freeBefore(p) ? TRAY : WAITING),
  check: (p, a) => a === capacity.answer(p),
  wrong: (p) => {
    const right = capacity.answer(p);
    return p.stage === 'choix' ? 1 - right : right <= 1 ? right + 1 : right - 1;
  },
  generate(profile, ctx) {
    const { rng } = ctx;
    const firsts: Record<Profile, CapacityParams> = {
      debut: { stage: 'reste', cap: 5, busy: 0, task: 'guidage', units: 3, secondary: { task: 'rapport', units: 3 } },
      milieu: { stage: 'reste', cap: 10, busy: 0, task: 'guidage', units: 6, secondary: { task: 'rapport', units: 5 } },
      fin: {
        stage: 'reste',
        cap: 50,
        busy: 0,
        task: 'guidage',
        units: 20,
        then: { task: 'controle', units: 15 },
        secondary: { task: 'rapport', units: 20 },
      },
    };
    if (ctx.index === 0 && !ctx.used.has(capacity.key(firsts[profile]))) return firsts[profile];
    const task: EssentialTask = ctx.index % 2 === 0 ? 'guidage' : 'controle';
    const secondaryTask: SecondaryTask = ctx.index % 2 === 0 ? 'rapport' : 'affichage';
    // La deuxième fois, la tâche secondaire tient dans le plateau ; ensuite, au hasard.
    const wantFits = ctx.index === 1 ? true : ctx.index === 0 ? false : randInt(rng, 0, 1) === 0;
    /** Unités de la tâche secondaire : au moins deux, juste autour des places libres (vraie comparaison). */
    const secondaryUnits = (rest: number, spread: number): number =>
      wantFits && rest >= 2 ? randInt(rng, Math.max(2, rest - spread), rest) : rest + randInt(rng, 1, spread);
    return fresh(ctx, capacity.key, (): CapacityParams => {
      switch (profile) {
        case 'debut': {
          // Au moins deux places occupées et deux places libres (« une unité » n'est jamais demandée).
          const cap = randInt(rng, 4, ctx.easier ? 6 : 10);
          const units = randInt(rng, 2, cap - 2);
          const rest = cap - units;
          return { stage: 'reste', cap, busy: 0, task, units, secondary: { task: secondaryTask, units: secondaryUnits(rest, 2) } };
        }
        case 'milieu': {
          const cap = randInt(rng, ctx.easier ? 8 : 10, ctx.easier ? 12 : 20);
          const rest = randInt(rng, 2, Math.min(9, cap - 2));
          return { stage: 'reste', cap, busy: 0, task, units: cap - rest, secondary: { task: secondaryTask, units: secondaryUnits(rest, 3) } };
        }
        case 'fin': {
          // Dizaines entières et moitiés de dizaine d'abord, puis dizaines et unités. Après une erreur : une seule tâche indispensable.
          const tensOnly = ctx.easier || ctx.index < 2;
          const cap = 10 * randInt(rng, tensOnly ? 3 : 4, 5);
          const guidage = tensOnly ? 10 * randInt(rng, 1, cap / 10 - 2) : randInt(rng, 11, cap - 20);
          const rest1 = cap - guidage;
          if (ctx.easier) {
            return { stage: 'reste', cap, busy: 0, task: 'guidage', units: guidage, secondary: { task: secondaryTask, units: secondaryUnits(rest1, 10) } };
          }
          const controle = tensOnly ? 5 * randInt(rng, 1, (rest1 - 5) / 5) : randInt(rng, 3, Math.min(15, rest1 - 5));
          return {
            stage: 'reste',
            cap,
            busy: 0,
            task: 'guidage',
            units: guidage,
            then: { task: 'controle', units: controle },
            secondary: { task: secondaryTask, units: secondaryUnits(rest1 - controle, tensOnly ? 5 : 8) },
          };
        }
      }
    });
  },
};

/** Étape suivante : la deuxième tâche indispensable (fin de CP), puis le choix pour la tâche secondaire. */
export function capacityFollowUp(p: CapacityParams): CapacityParams | null {
  if (p.stage === 'choix') return null;
  const busy = p.busy + p.units;
  if (p.then) return { ...p, busy, task: p.then.task, units: p.then.units, then: undefined };
  return { ...p, stage: 'choix', busy, task: p.secondary.task, units: p.secondary.units };
}

// ---------------------------------------------------------------------------
// Chapitre 5 — Le grand retour sur Terre
// ---------------------------------------------------------------------------

/**
 * C5.1 — Il faut rentrer à la maison : alléger Eagle (décomposer un nombre).
 * Pour de vrai, Armstrong et Aldrin ont laissé sur la Lune leurs sacs à dos, leurs bottes et des outils,
 * pour qu'Eagle puisse remporter les cailloux. Dans la simulation, les objets laissés doivent peser
 * autant que la boîte de cailloux (`target`) : l'enfant les choisit, la balance les pèse.
 * Deux objets font le poids ensemble (une seule paire, sauf dans l'exemple du début : 3 + 2 ou 4 + 1), et aucun objet
 * ne pèse à lui seul le poids des cailloux. Choix demandé par le propriétaire le 18/11 (à la place de la liste).
 */
export type LoadKind = 'sac' | 'bottes' | 'appareil' | 'pelle' | 'marteau';
export const LOAD_KINDS: readonly LoadKind[] = ['sac', 'bottes', 'appareil', 'pelle', 'marteau'];

export interface LightenParams {
  /** Poids de la boîte de cailloux, en kilos. */
  target: number;
  /** Les objets proposés, dans l'ordre de l'étagère. */
  items: { kind: LoadKind; w: number }[];
}

export const LIGHTEN_MAX: Record<Profile, number> = { debut: 9, milieu: 18, fin: 90 };

export const loadSum = (p: LightenParams, chosen: readonly number[]): number => chosen.reduce((s, i) => s + (p.items[i]?.w ?? 0), 0);

/** Deux objets qui font le poids (les plus lourds d'abord) : la solution montrée par l'aide. */
export function lightenPair(p: LightenParams): [number, number] | null {
  let best: [number, number] | null = null;
  for (let i = 0; i < p.items.length; i++)
    for (let j = i + 1; j < p.items.length; j++)
      if (p.items[i].w + p.items[j].w === p.target) {
        const big = Math.max(p.items[i].w, p.items[j].w);
        if (!best || big > Math.max(p.items[best[0]].w, p.items[best[1]].w)) best = [i, j];
      }
  return best;
}

/**
 * Les poids des objets : la paire `a + b`, puis des leurres tous différents. Aucun leurre ne vaut `target`
 * ni ne fait le poids avec un autre objet : l'aide montre la seule paire possible.
 */
function loadItems(rng: Rng, n: number, target: number, a: number, distractor: () => number): LightenParams {
  const ws = [a, target - a];
  for (let guard = 0; ws.length < n && guard < 500; guard++) {
    const w = distractor();
    if (w !== target && w > 0 && !ws.includes(w) && !ws.some((x) => x + w === target)) ws.push(w);
  }
  const kinds = shuffle(rng, LOAD_KINDS).slice(0, n);
  return { target, items: shuffle(rng, ws).map((w, i) => ({ kind: kinds[i], w })) };
}

export const lighten: Family<LightenParams, number[]> = {
  id: 'alleger',
  key: (p) => `${p.target}:${p.items.map((it) => it.w).join(',')}`,
  answer: (p) => lightenPair(p) ?? [],
  check: (p, a) => a.length > 0 && new Set(a).size === a.length && a.every((i) => i >= 0 && i < p.items.length) && loadSum(p, a) === p.target,
  // Un seul objet ne fait jamais le poids : c'est la réponse fausse des tests et de la console.
  wrong: () => [0],
  generate(profile, ctx) {
    const { rng } = ctx;
    const firsts: Record<Profile, LightenParams> = {
      debut: {
        target: 5,
        items: [
          { kind: 'sac', w: 3 },
          { kind: 'bottes', w: 2 },
          { kind: 'appareil', w: 4 },
          { kind: 'pelle', w: 1 },
        ],
      },
      milieu: {
        target: 12,
        items: [
          { kind: 'sac', w: 7 },
          { kind: 'bottes', w: 4 },
          { kind: 'appareil', w: 5 },
          { kind: 'pelle', w: 9 },
          { kind: 'marteau', w: 6 },
        ],
      },
      fin: {
        target: 40,
        items: [
          { kind: 'sac', w: 10 },
          { kind: 'bottes', w: 25 },
          { kind: 'appareil', w: 30 },
          { kind: 'pelle', w: 15 },
          { kind: 'marteau', w: 20 },
        ],
      },
    };
    if (ctx.index === 0 && !ctx.used.has(lighten.key(firsts[profile]))) return firsts[profile];
    return fresh(ctx, lighten.key, () => {
      switch (profile) {
        case 'debut': {
          const target = randInt(rng, ctx.easier ? 4 : 5, ctx.easier ? 6 : 9);
          const a = randInt(rng, 1, target - 1);
          return loadItems(rng, 4, target, a, () => randInt(rng, 1, 9));
        }
        case 'milieu': {
          // Après une erreur : sans passer la dizaine ; sinon, la paire passe la dizaine (7 + 5).
          if (ctx.easier) {
            const target = randInt(rng, 7, 10);
            return loadItems(rng, 5, target, randInt(rng, 2, target - 2), () => randInt(rng, 1, 9));
          }
          const target = randInt(rng, 11, 17);
          const a = randInt(rng, target - 9, 9);
          return loadItems(rng, 5, target, a, () => randInt(rng, 2, 9));
        }
        case 'fin': {
          // Dizaines entières après une erreur et au deuxième problème, puis dizaines et unités sans retenue.
          if (ctx.easier || ctx.index === 1) {
            const target = 10 * randInt(rng, 4, 9);
            const a = 10 * randInt(rng, 1, target / 10 - 1);
            return loadItems(rng, 5, target, a, () => 10 * randInt(rng, 1, 8));
          }
          for (;;) {
            const a = randInt(rng, 21, 49);
            const b = randInt(rng, 11, 39);
            if (a % 10 === 0 || b % 10 === 0 || (a % 10) + (b % 10) > 9 || a + b > 90) continue;
            return loadItems(rng, 5, a + b, a, () => randInt(rng, 11, 69));
          }
        }
      }
    });
  },
};

/**
 * C5.2 — Les retrouvailles dans l'espace : le radar du rendez-vous (suites de nombres).
 * Le radar d'Eagle affiche la distance qui le sépare de Columbia : trois mesures, puis la suivante à trouver.
 * Début : on compte à rebours de 1 en 1 ; milieu : de 2 en 2 ; fin : de 10 en 10, de 5 en 5, puis de 10 en 10
 * à partir d'un nombre qui n'est pas rond. Choix demandé par le propriétaire le 18/11 (à la place de la piste).
 */
export interface RadarParams {
  /** Première mesure affichée. */
  start: number;
  /** De combien la distance baisse à chaque mesure. */
  step: number;
}

/** Nombre de mesures déjà affichées avant celle à trouver. */
export const RADAR_SHOWN = 3;
export const RADAR_MAX: Record<Profile, number> = { debut: 10, milieu: 20, fin: 100 };

export const radarTerms = (p: RadarParams): number[] => Array.from({ length: RADAR_SHOWN }, (_, i) => p.start - i * p.step);

export const radar: Family<RadarParams, number> = {
  id: 'radar',
  key: (p) => `${p.start}-${p.step}`,
  answer: (p) => p.start - RADAR_SHOWN * p.step,
  check: (p, a) => a === radar.answer(p),
  generate(profile, ctx) {
    const { rng } = ctx;
    const firsts: Record<Profile, RadarParams> = {
      debut: { start: 10, step: 1 },
      milieu: { start: 20, step: 2 },
      fin: { start: 50, step: 10 },
    };
    if (ctx.index === 0 && !ctx.used.has(radar.key(firsts[profile]))) return firsts[profile];
    return fresh(ctx, radar.key, () => {
      switch (profile) {
        case 'debut':
          return { start: randInt(rng, ctx.easier ? 5 : 6, ctx.easier ? 7 : 10), step: 1 };
        case 'milieu': {
          // Après une erreur : de 1 en 1 ; au deuxième problème, des nombres pairs ; ensuite, aussi des impairs.
          if (ctx.easier) return { start: randInt(rng, 12, 20), step: 1 };
          const start = ctx.index === 1 ? 2 * randInt(rng, 5, 10) : randInt(rng, 11, 20);
          return { start, step: 2 };
        }
        case 'fin': {
          if (ctx.easier) return { start: 10 * randInt(rng, 4, 9), step: 10 };
          if (ctx.index === 1) return { start: 5 * randInt(rng, 6, 12), step: 5 };
          // De 10 en 10 sans partir d'un nombre rond : seul le chiffre des dizaines change.
          let start = randInt(rng, 41, 99);
          if (start % 10 === 0) start++;
          return { start, step: 10 };
        }
      }
    });
  },
};

/**
 * C5.3 — Le grand silence : les morceaux de l'onde radio de la simulation (compléter).
 * Exemples du document : il en faut 6, il y en a 4 (début) ; 15 et 9 (milieu) ;
 * fin de CP en deux étapes : 25 puis 15 déjà apportés (combien en tout ?), puis combien pour aller à 50.
 */
export interface WaveParams {
  stage: 'somme' | 'reste';
  total: number;
  /** Déjà là (étape « reste »). */
  deja: number;
  /** Les deux apports de l'étape « somme » (fin de CP). */
  a?: number;
  b?: number;
}

export const WAVE_MAX: Record<Profile, number> = { debut: 10, milieu: 20, fin: 60 };

export const wave: Family<WaveParams, number> = {
  id: 'onde',
  key: (p) => (p.stage === 'somme' ? `${p.total}:${p.a}+${p.b}` : `${p.total}-${p.deja}`),
  answer: (p) => (p.stage === 'somme' ? p.a! + p.b! : p.total - p.deja),
  check: (p, a) => a === wave.answer(p),
  generate(profile, ctx) {
    const { rng } = ctx;
    const firsts: Record<Profile, WaveParams> = {
      debut: { stage: 'reste', total: 6, deja: 4 },
      milieu: { stage: 'reste', total: 15, deja: 9 },
      fin: { stage: 'somme', total: 50, deja: 0, a: 25, b: 15 },
    };
    if (ctx.index === 0 && !ctx.used.has(wave.key(firsts[profile]))) return firsts[profile];
    return fresh(ctx, wave.key, () => {
      switch (profile) {
        case 'debut': {
          const total = randInt(rng, 4, ctx.easier ? 6 : 10);
          return { stage: 'reste', total, deja: randInt(rng, 2, total - 1) };
        }
        case 'milieu': {
          const total = randInt(rng, ctx.easier ? 8 : 11, ctx.easier ? 12 : 20);
          const answer = randInt(rng, 2, Math.min(9, total - 2));
          return { stage: 'reste', total, deja: total - answer };
        }
        case 'fin': {
          // Après une erreur : une seule étape, en dizaines entières.
          if (ctx.easier) {
            const total = 10 * randInt(rng, 3, 5);
            return { stage: 'reste', total, deja: 10 * randInt(rng, 1, total / 10 - 1) };
          }
          const total = 10 * randInt(rng, 4, 6);
          if (ctx.index === 1) {
            const a = 10 * randInt(rng, 1, 2);
            const b = 10 * randInt(rng, 1, total / 10 - a / 10 - 1);
            return { stage: 'somme', total, deja: 0, a, b };
          }
          // Sans retenue, et au moins deux morceaux à ajouter à la fin.
          for (;;) {
            const a = randInt(rng, 12, 35);
            const b = randInt(rng, 11, 25);
            if ((a % 10) + (b % 10) <= 9 && a + b <= total - 2 && b <= a) return { stage: 'somme', total, deja: 0, a, b };
          }
        }
      }
    });
  },
};

/** Deuxième étape (fin de CP) : les morceaux apportés sont réunis, combien faut-il en ajouter ? */
export function waveFollowUp(p: WaveParams): WaveParams | null {
  return p.stage === 'somme' ? { stage: 'reste', total: p.total, deja: p.a! + p.b! } : null;
}
