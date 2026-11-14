import { expect, FAST, test, until } from './helpers';

test.use({ hasTouch: true, isMobile: true });

test('le toucher active le son après fermeture et réouverture de la page', async ({ page, context, consoleErrors }) => {
  void consoleErrors;
  const url = `./?${FAST}&vitesse=8`;
  await page.goto(url);
  await until(page, (s) => s.scenes.includes('Title'), 'accueil');
  await page.locator('canvas').tap();
  await until(page, (s) => s.musique?.mood === 'mystere', 'musique du menu');
  await page.close();

  const reopened = await context.newPage();
  await reopened.route('**/audio/manifest.json', (route) => route.fulfill({ json: {} }));
  await reopened.goto(url);
  await until(reopened, (s) => s.scenes.includes('Title'), 'accueil après réouverture');
  const audioTime = () => reopened.evaluate(() => {
    const debug = (window as unknown as { __mathgaret: { services: { audio: { ctx: AudioContext | null } } } }).__mathgaret;
    return debug.services.audio.ctx?.currentTime ?? null;
  });
  expect(await audioTime()).toBeNull();
  await reopened.locator('canvas').tap();
  await until(reopened, (s) => s.musique?.mood === 'mystere', 'musique après le premier toucher');
  const before = (await audioTime())!;
  await expect.poll(audioTime).toBeGreaterThan(before);

  await reopened.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await until(reopened, (s) => s.paused, 'page masquée');
  await reopened.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await until(reopened, (s) => !s.paused, 'page restaurée');
  const restored = (await audioTime())!;
  await expect.poll(audioTime).toBeGreaterThan(restored);
});
