import { test as base, expect, type Page } from '@playwright/test';

/** État exposé par le jeu avec ?debug (voir exposeDebug dans src/main.ts). */
export interface GameState {
  scenes: string[];
  scene: string | null;
  problem: { challenge: string; index: number; params: unknown; answer: number | number[] } | null;
  budget: { challengeId: string; offer: boolean; availableMs: number; shareMs: number } | null;
  voice: { id: string; kind: string } | null;
  voiceLog: string[];
  /** Répliques jouées depuis un fichier audio livré (et non par la synthèse provisoire). */
  voiceFiles: string[];
  voiceParts: Record<string, number>;
  voiceLast: { id: string; speaker: string; via?: string }[];
  sons: string[];
  musique: { mood: string; via: string } | null;
  focus: { x: number; y: number; width: number; height: number } | null;
  layers: string[];
  save: {
    settings: { profile: string; durationMin: number; tokensReady: boolean; gentle: boolean; subtitles: boolean };
    run: {
      chapterId: string;
      sceneIndex: number;
      profile: string;
      records: { challengeId: string; efficient: boolean; errors: number; helps: number }[];
      challengeDone: Record<string, number>;
    } | null;
    chapters: Record<string, { missionStar: boolean; best: Record<string, { rate: number }> }>;
    told: Record<string, boolean>;
  };
  activeMs: number;
  paused: boolean;
  /** Boutons d'aide affichés en haut à droite. */
  hud: string[];
  answering: boolean;
  busy: boolean;
  validate: { x: number; y: number; width: number; height: number } | null;
  /** Journal de fiabilité (src/core/diag.ts). */
  diag: { step: string; waiting: boolean; secours: string[]; blocages: number; erreurs: number; journal: { at: number; kind: string; text: string }[] };
}

/** Page qui échoue si le jeu produit une erreur JavaScript, une erreur ou un avertissement console. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    // Par défaut, aucun fichier audio : les parcours ne dépendent pas des voix livrées (durées, synthèse simulée).
    // Un test qui veut des fichiers déclare sa propre route (elle passe avant) ou retire celle-ci.
    await page.route('**/audio/manifest.json', (r) => r.fulfill({ json: {} }));
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      // Messages de performance du pilote graphique logiciel de Chromium headless (pas du jeu).
      if (m.text().includes('GL Driver Message')) return;
      if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
    });
    await use(errors);
    expect(errors, 'erreurs dans la console du navigateur').toEqual([]);
  },
});
export { expect };

export function state(page: Page): Promise<GameState> {
  return page.evaluate(() => (window as unknown as { __mathgaret: { state: () => GameState } }).__mathgaret.state());
}

/** Attend qu'une condition sur l'état du jeu soit vraie. */
export async function until(page: Page, fn: (s: GameState) => boolean, label: string, timeout = 60_000): Promise<GameState> {
  const t0 = Date.now();
  let last: GameState | null = null;
  while (Date.now() - t0 < timeout) {
    last = await page.evaluate(() => (window as unknown as { __mathgaret?: { state: () => GameState } }).__mathgaret?.state() ?? null);
    if (last && fn(last)) return last;
    await page.waitForTimeout(100);
  }
  throw new Error(`délai dépassé : ${label}\n${JSON.stringify(last)?.slice(0, 1200)}`);
}

/** Paramètres de test : rendu Canvas (rapide sans GPU), pas de synthèse vocale, jeu accéléré. */
export const FAST = 'debug&renderer=canvas&voix=muette&graine=3';

export async function open(page: Page, query: string): Promise<void> {
  await page.goto(`./?${FAST}&${query}`);
  await until(page, (s) => s.scenes.length > 1, 'démarrage', 30_000);
}

/** Attend que l'enfant puisse répondre (consigne dite, personne ne parle). */
export function waitAnswer(page: Page, timeout = 90_000): Promise<GameState> {
  return until(page, (s) => s.answering && !s.busy, 'attente de la réponse', timeout);
}

export function sameRect(a: GameState['focus'], b: GameState['focus']): boolean {
  return Boolean(a && b && a.x === b.x && a.y === b.y && a.width === b.width);
}

/** Déplace la sélection aux flèches jusqu'au bouton de validation. */
export async function arrowsToValidate(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const s = await state(page);
    if (sameRect(s.focus, s.validate)) return;
    await page.keyboard.press('ArrowRight');
  }
  const s = await state(page);
  expect(sameRect(s.focus, s.validate), 'la validation est atteignable aux flèches').toBe(true);
}

/** Position à l'écran d'un point du jeu (coordonnées 1920×1080). */
export async function gameToPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('canvas introuvable');
  return { x: box.x + (x / 1920) * box.width, y: box.y + (y / 1080) * box.height };
}

/** Manette standard simulée (navigator.getGamepads), pilotée par appuis brefs. */
export async function installGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = { id: 'Manette de test (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, timestamp: 0 };
    (window as unknown as { __pad: typeof pad }).__pad = pad;
    navigator.getGamepads = () => [pad as unknown as Gamepad, null, null, null];
  });
}

export const PAD = { A: 0, B: 1, X: 2, Y: 3, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

export async function tap(page: Page, button: number): Promise<void> {
  const set = (on: boolean) =>
    page.evaluate(
      ([b, v]) => {
        const btn = (window as unknown as { __pad: { buttons: { pressed: boolean; value: number }[] } }).__pad.buttons[b as number];
        btn.pressed = v as boolean;
        btn.value = v ? 1 : 0;
      },
      [button, on] as const,
    );
  await set(true);
  await page.waitForTimeout(100);
  await set(false);
  await page.waitForTimeout(100);
}
