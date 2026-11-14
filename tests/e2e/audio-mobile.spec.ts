import { devices } from '@playwright/test';
import { expect, FAST, test, until } from './helpers';

test.use({ hasTouch: true, isMobile: true, userAgent: devices['iPhone 13'].userAgent });

test('le toucher active le son après fermeture et réouverture de la page', async ({ page, context, consoleErrors }) => {
  void consoleErrors;
  await page.unroute('**/audio/manifest.json');
  const url = `./?${FAST}&vitesse=8`;
  await page.goto(url);
  await until(page, (s) => s.scenes.includes('Title'), 'accueil');
  await page.locator('canvas').tap();
  await until(page, (s) => s.musique?.via === 'fichier', 'musique du menu');
  await page.close();

  const reopened = await context.newPage();
  await reopened.addInitScript(() => {
    if (!('audioSession' in navigator)) Object.defineProperty(navigator, 'audioSession', { value: { type: 'auto' } });
  });
  await reopened.goto(url);
  await until(reopened, (s) => s.scenes.includes('Title'), 'accueil après réouverture');
  const transitions = await reopened.evaluateHandle(() => {
    const calls = { resume: 0, suspend: 0 };
    for (const method of ['resume', 'suspend'] as const) {
      const original = AudioContext.prototype[method];
      AudioContext.prototype[method] = function (this: AudioContext) {
        calls[method]++;
        return original.call(this);
      };
    }
    return calls;
  });
  const audioTime = () => reopened.evaluate(() => {
    const debug = (window as unknown as { __mathgaret: { services: { audio: { ctx: AudioContext | null } } } }).__mathgaret;
    return debug.services.audio.ctx?.currentTime ?? null;
  });
  const sessionType = () => reopened.evaluate(() => (navigator as Navigator & { audioSession: { type: string } }).audioSession.type);
  expect(await audioTime()).toBeNull();
  expect(await sessionType()).toBe('auto');
  await reopened.locator('canvas').tap();
  await until(reopened, (s) => s.musique?.via === 'fichier', 'musique après le premier toucher');
  const before = (await audioTime())!;
  await expect.poll(audioTime).toBeGreaterThan(before + 1);
  const calls = await transitions.jsonValue();
  expect(calls.resume).toBeLessThanOrEqual(1); // Chromium peut démarrer le contexte dès sa création.
  expect(calls.suspend).toBe(0);
  expect(await sessionType()).toBe('playback');

  await reopened.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await until(reopened, (s) => s.paused, 'page masquée');
  expect(await sessionType()).toBe('auto');
  await reopened.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await until(reopened, (s) => !s.paused, 'page restaurée');
  const restored = (await audioTime())!;
  await expect.poll(audioTime).toBeGreaterThan(restored);
  expect(await sessionType()).toBe('playback');

  // Le verrouillage de l'écran peut seulement changer la visibilité de la page.
  const setHidden = (hidden: boolean) => reopened.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { value, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  await setHidden(true);
  expect(await sessionType()).toBe('auto');
  await setHidden(false);
  expect(await sessionType()).toBe('playback');
  const unlocked = (await audioTime())!;
  await expect.poll(audioTime).toBeGreaterThan(unlocked);
});
