/**
 * Répliques à nombres dites avec des fichiers livrés (« phrases à trous ») : la réplique est enregistrée
 * en morceaux, sans les nombres, et chaque nombre seul (nombre_0 … nombre_100). Le jeu enchaîne
 * morceaux et nombres, avec une courte pause là où le texte a une ponctuation.
 *
 * Le découpage doit rester identique à celui de tools/commande-audio.mjs, qui écrit la liste des
 * fichiers à produire (un test le vérifie).
 */

type Vars = Record<string, string | number>;

export interface VoicePart {
  /** Clé du manifeste : « id#k » pour le k-ième morceau de texte, « nombre_N » pour un nombre. */
  key: string;
  /** Silence à placer avant ce morceau (ms). */
  pauseBefore: number;
}

/** Silences entre les morceaux (ms). */
export const PAUSES = { mot: 70, virgule: 200, phrase: 380 };

const LEAD = /^[\s.,;:!?…—–]+/;
const TRAIL = /[.,;:!?…—–][\s.,;:!?…—–»"”)]*$/;
const VAR = /\{(\w+)\}/g;

function pauseOf(punct: string): number {
  if (/[.!?…]/.test(punct)) return PAUSES.phrase;
  if (/[,;:—–]/.test(punct)) return PAUSES.virgule;
  return 0;
}

/** Les morceaux de texte entre les nombres, tels qu'ils sont enregistrés. */
export function segmentTexts(text: string): string[] {
  return text
    .split(/\{\w+\}/)
    .map((p) => p.replace(LEAD, '').trim())
    .filter((p) => p !== '');
}

/** Valeur dite avec un fichier nombre_N : un entier de 0 à 100, sinon rien. */
export function numberValue(v: string | number | undefined): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
}

/**
 * Suite des fichiers à enchaîner pour dire `text` avec ces valeurs, ou null si une variable
 * n'est pas un nombre de 0 à 100 (la réplique est alors dite autrement).
 */
export function voiceParts(id: string, text: string, vars: Vars): VoicePart[] | null {
  const pieces = text.split(/\{\w+\}/);
  const names = [...text.matchAll(VAR)].map((m) => m[1]);
  const parts: VoicePart[] = [];
  let gap = 0;
  let k = 0;
  const push = (key: string) => {
    parts.push({ key, pauseBefore: parts.length ? Math.max(gap, PAUSES.mot) : 0 });
    gap = 0;
  };
  for (let i = 0; i < pieces.length; i++) {
    const lead = LEAD.exec(pieces[i])?.[0] ?? '';
    gap = Math.max(gap, pauseOf(lead));
    const body = pieces[i].slice(lead.length).trim();
    if (body) {
      push(`${id}#${++k}`);
      gap = pauseOf(TRAIL.exec(body)?.[0] ?? '');
    }
    if (i < names.length) {
      const n = numberValue(vars[names[i]]);
      if (n === null) return null;
      push(`nombre_${n}`);
    }
  }
  return parts;
}
