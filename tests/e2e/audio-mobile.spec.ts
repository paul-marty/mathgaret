import { devices } from '@playwright/test';
import { expect, FAST, gameToPage, open, state, test, until } from './helpers';

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

test('le cadran de Houston répond après des verrouillages successifs', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.route('**/audio/manifest.json', (route) => route.fulfill({
    json: { voix: { nombre_0: 'voix/nombre_0.mp3', nombre_1: 'voix/nombre_1.mp3' } },
  }));
  await open(page, 'vitesse=12&niveau=debut&scene=c2.3');
  const tap = async (x: number, y: number) => {
    const point = await gameToPage(page, x, y);
    await page.touchscreen.tap(point.x, point.y);
  };
  await tap(960, 540); // premier geste, pour démarrer le moteur audio
  await until(page, (s) => s.problem?.index === 0 && s.answering && !s.busy, 'question sur le plein');
  await page.evaluate(() => (window as unknown as { __mathgaret: { solve: () => void } }).__mathgaret.solve());
  await until(page, (s) => s.problem?.index === 1 && s.answering && !s.busy, 'question sur le cadran de Houston');

  for (const [x, number] of [[1120, 1], [680, 0], [1120, 1], [680, 0]]) {
    await page.evaluate(() => {
      // iOS peut suspendre les images avant que Phaser ait traité la demande de pause.
      for (const hidden of [true, false]) {
        Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      }
    });
    const audioTime = () => page.evaluate(() => {
      const debug = (window as unknown as { __mathgaret: { services: { audio: { ctx: AudioContext } } } }).__mathgaret;
      return debug.services.audio.ctx.currentTime;
    });
    const resumedAt = await audioTime();
    await expect.poll(audioTime).toBeGreaterThan(resumedAt);
    expect((await state(page)).scenes).toContain('Story');
    await tap(x, 940);
    await expect.poll(async () => (await state(page)).voiceLast.at(-1)).toMatchObject({ id: `nombre_${number}`, via: 'fichier' });
  }
});
