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
