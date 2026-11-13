/**
 * Fiabilité du scénario : ce que fait le jeu en ce moment, les filets de sécurité déclenchés,
 * les blocages et les erreurs. Rien n'est envoyé nulle part : tout reste dans la page.
 *
 * - Avec ?debug, l'étape en cours s'affiche en bas à gauche de l'écran.
 * - `window.__mathgaret.state().diag` donne le journal (tests, diagnostic à distance).
 */
export type DiagKind = 'etape' | 'secours' | 'blocage' | 'erreur';

export interface DiagEntry {
  /** Temps réel de jeu (ms, hors arrière-plan). */
  at: number;
  kind: DiagKind;
  text: string;
}

export class Diag {
  journal: DiagEntry[] = [];
  /** Étape en cours du scénario. */
  step = '';
  /** L'enfant doit agir (répondre, toucher un objet) : une longue attente est normale. */
  waitingForChild = false;
  /** Temps réel écoulé pendant que le jeu est visible (avancé par la scène Overlay). */
  realNow = 0;
  /** Dernier signe de vie du scénario (nouvelle étape, voix qui démarre ou s'arrête). */
  lastProgress = 0;

  private stallReported = '';
  private errorsSeen = new Set<string>();

  /** Le scénario passe à une nouvelle étape. */
  begin(step: string): void {
    this.step = step;
    this.progress();
    this.push('etape', step);
  }

  progress(): void {
    this.lastProgress = this.realNow;
  }

  /** Un filet de sécurité a pris le relais (voix muette, animation interrompue…). Le jeu continue. */
  secours(text: string): void {
    this.push('secours', text);
    console.info(`[fiabilité] ${text}`);
  }

  /** Le scénario n'avance plus alors que l'enfant n'a rien à faire : c'est un défaut à corriger. */
  blocage(text: string): void {
    if (this.stallReported === text) return;
    this.stallReported = text;
    this.push('blocage', text);
    console.warn(`[fiabilité] blocage : ${text}`);
  }

  erreur(err: unknown, where: string): void {
    const msg = err instanceof Error ? err.message : String(err);
    const key = `${where}|${msg}`;
    this.push('erreur', `${where} : ${msg}`);
    if (this.errorsSeen.has(key)) return;
    this.errorsSeen.add(key);
    console.error(`[fiabilité] erreur (${where})`, err);
  }

  count(kind: DiagKind): number {
    return this.journal.filter((e) => e.kind === kind).length;
  }

  private push(kind: DiagKind, text: string): void {
    this.journal.push({ at: Math.round(this.realNow), kind, text });
    if (this.journal.length > 300) this.journal.shift();
  }
}
