import type { Page } from '@playwright/test';
import { arrowsTo, expect, gameToPage, installGamepad, open, PAD, tap, test, until } from './helpers';

// Écran de lancement : le mot aux parents, puis l'accès caché « commencer à un chapitre »
// (haut, haut, bas, bas aux flèches ou à la croix de la manette ; appui long sur « Mathgaret » au toucher).

/** Textes affichés par une scène, y compris ceux des boutons. */
function texts(page: Page, scene: string): Promise<string[]> {
  return page.evaluate((key) => {
    type Obj = { type: string; text?: string; visible?: boolean; list?: Obj[] };
    const game = (window as unknown as { __mathgaret: { game: { scene: { getScene: (k: string) => { children: { list: Obj[] } } } } } }).__mathgaret.game;
    const out: string[] = [];
    const walk = (list: Obj[]) => {
      for (const o of list) {
        if (o.visible === false) continue;
        if (o.type === 'Text' && o.text) out.push(o.text);
        if (o.list) walk(o.list);
      }
    };
    walk(game.scene.getScene(key).children.list);
    return out;
  }, scene);
}

async function title(page: Page): Promise<void> {
  await open(page, 'vitesse=8');
  await until(page, (s) => s.scenes.includes('Title'), 'écran de lancement');
}

/** L'accueil montre le choix du chapitre de départ ; on prend le 3 et on lance la mission. */
async function startAtChapter3(page: Page): Promise<void> {
  await until(page, (s) => s.scenes.includes('Menu') && s.focus !== null, 'accueil');
  await expect.poll(() => texts(page, 'Menu')).toContain('Commencer au chapitre…');
  await arrowsTo(page, 960, 540, 'chapitre 3');
  await page.keyboard.press('Enter');
  await expect.poll(() => texts(page, 'Menu')).toContain('Départ : chapitre 3, « Apollo 11, le grand décollage »');
  const config = await texts(page, 'Menu');
  // Plus de jetons dans les réglages.
  expect(config.some((t) => /jeton/i.test(t))).toBe(false);
  await page.keyboard.press('Enter'); // « C'est parti ! », sélectionné d'office
  const s = await until(page, (st) => st.scene === 'c3.1', 'début du chapitre 3');
  expect(s.save.run).toMatchObject({ mode: 'aventure', chapterId: 'c3', sceneIndex: 0 });
}

test('au lancement, un mot pour les parents ; une touche ouvre l’accueil habituel', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await title(page);
  const shown = await texts(page, 'Title');
  expect(shown).toContain('Un mot pour les parents');
  expect(shown.join('\n')).toMatch(/Notre intention/);
  expect(shown.join('\n')).toMatch(/Objectif/);
  expect(shown).toContain('Appuie sur une touche');
  // Une flèche qui ne suit pas le code caché lance le jeu, comme n'importe quelle touche.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowLeft');
  await until(page, (s) => s.scenes.includes('Menu'), 'accueil');
  await expect.poll(() => texts(page, 'Menu')).toContain('Nouvelle mission');
});

test('code caché aux flèches : commencer directement au chapitre 3', async ({ page, consoleErrors }) => {
  test.setTimeout(120_000);
  void consoleErrors;
  await title(page);
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown']) await page.keyboard.press(k);
  await startAtChapter3(page);
});

test('code caché à la croix de la manette', async ({ page, consoleErrors }) => {
  test.setTimeout(120_000);
  void consoleErrors;
  await installGamepad(page);
  await title(page);
  for (const b of [PAD.UP, PAD.UP, PAD.DOWN, PAD.DOWN]) await tap(page, b);
  await until(page, (s) => s.scenes.includes('Menu') && s.focus !== null, 'accueil');
  await expect.poll(() => texts(page, 'Menu')).toContain('Commencer au chapitre…');
  // « Retour » revient à l'accueil habituel.
  await page.keyboard.press('Escape');
  await expect.poll(() => texts(page, 'Menu')).toContain('Nouvelle mission');
});

test('appui long sur « Mathgaret » : le choix du chapitre ; un toucher bref ailleurs lance le jeu', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await title(page);
  const p = await gameToPage(page, 960, 112);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(1800);
  await page.mouse.up();
  await until(page, (s) => s.scenes.includes('Menu'), 'accueil');
  await expect.poll(() => texts(page, 'Menu')).toContain('Commencer au chapitre…');

  // Un toucher bref sur le titre lance le jeu normalement.
  await title(page);
  await page.mouse.click(p.x, p.y);
  await until(page, (s) => s.scenes.includes('Menu'), 'accueil');
  await expect.poll(() => texts(page, 'Menu')).toContain('Nouvelle mission');
});
