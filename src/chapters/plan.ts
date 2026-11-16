/**
 * Les cinq chapitres, leurs poids de durée (section 7.1) et les estimations
 * de la narration essentielle. Les chapitres non encore réalisés gardent ici une estimation
 * provisoire : elle sert à leur réserver du temps dans le budget (P9).
 * À remplacer par des mesures quand les voix et animations seront produites (section 7.4).
 */
export interface ChallengePlan {
  id: string;
  family: string;
}

export interface ChapterPlan {
  id: string;
  number: number;
  title: string;
  /** Poids dans la durée globale : 10, 12, 10, 16, 12. */
  weight: number;
  /** Narration et cinématiques essentielles des chapitres non réalisés (ms), estimation provisoire. */
  essentialMs: number;
  challenges: ChallengePlan[];
}

export const CHAPTERS: ChapterPlan[] = [
  {
    id: 'c1',
    number: 1,
    title: 'Le grand rêve de Margaret',
    weight: 10,
    essentialMs: 0, // calculé à partir des scènes réalisées
    challenges: [
      { id: 'c1_voyants', family: 'completer' },
      { id: 'c1_liste', family: 'comparer' },
    ],
  },
  {
    id: 'c2',
    number: 2,
    title: 'L’ordinateur d’Apollo',
    weight: 12,
    essentialMs: 0, // calculé à partir des scènes réalisées
    challenges: [
      { id: 'c2_instructions', family: 'retirer' },
      { id: 'c2_bug', family: 'avancer' },
      { id: 'c2_test', family: 'voyage' },
    ],
  },
  {
    id: 'c3',
    number: 3,
    title: 'Apollo 11, le grand décollage',
    weight: 10,
    essentialMs: 0, // calculé à partir des scènes réalisées
    challenges: [
      { id: 'c3_verifications', family: 'systemes' },
      { id: 'c3_signal', family: 'signal' },
    ],
  },
  {
    id: 'c4',
    number: 4,
    title: 'Alerte sur la Lune !',
    weight: 16,
    essentialMs: 0, // calculé à partir des scènes réalisées
    challenges: [
      { id: 'c4_approche', family: 'prevoir' },
      { id: 'c4_taches', family: 'capacite' },
    ],
  },
  {
    id: 'c5',
    number: 5,
    title: 'Le grand retour sur Terre',
    weight: 12,
    essentialMs: 0, // calculé à partir des scènes réalisées
    challenges: [
      { id: 'c5_depart', family: 'verifier' },
      { id: 'c5_rendezvous', family: 'rejoindre' },
      { id: 'c5_silence', family: 'onde' },
    ],
  },
];

export function chapterById(id: string): ChapterPlan {
  const c = CHAPTERS.find((ch) => ch.id === id);
  if (!c) throw new Error(`Chapitre inconnu : ${id}`);
  return c;
}

export const TOTAL_WEIGHT = CHAPTERS.reduce((a, c) => a + c.weight, 0);
