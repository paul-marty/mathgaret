export function keyOf(stem: string): string | null;

export interface AudioReport {
  voix: number;
  sons: number;
  musique: number;
  warnings: string[];
  lots: Record<string, { attendus: number; livres: number; manquants: string[] }>;
  missingSounds: string[];
  missingMusic: string[];
  summary: string;
}

export function buildAudioManifest(root: string): AudioReport;
