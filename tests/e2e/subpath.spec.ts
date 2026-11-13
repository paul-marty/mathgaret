import { expect, open, test, until } from './helpers';

// Le jeu est servi sous /mathgaret/, comme sur GitHub Pages (dépôt « projet »).
test('fonctionne dans un sous-dossier : fichiers, répliques, service worker', async ({ page, consoleErrors }) => {
  void consoleErrors;
  const failed: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await open(page, 'vitesse=4');
  expect(page.url()).toContain('/mathgaret/');
  await until(page, (s) => s.scenes.includes('Title'), 'accueil');
  await page.keyboard.press('Space');
  await until(page, (s) => s.scenes.includes('Menu') && s.voiceLog.length >= 0, 'menu');
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/mathgaret\/$/);
  expect(failed).toEqual([]);
});
