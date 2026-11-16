import type { Page } from '@playwright/test';
import { expect, gameToPage, mg, open, state, test, until } from './helpers';

test.use({ hasTouch: true, isMobile: true });

async function tripleTap(page: Page, x: number, y: number): Promise<void> {
  const point = await gameToPage(page, x, y);
  for (let i = 0; i < 3; i++) await page.touchscreen.tap(point.x, point.y);
}

test('un triple toucher avance jusqu’à la prochaine consigne et rend la main', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await open(page, 'vitesse=4&niveau=debut&scene=c1.1');
  await until(page, (s) => s.scene === 'c1.1' && s.diag.waiting, 'poste à toucher');

  await tripleTap(page, 90, 90);
  let s = await until(page, (st) => st.scene === 'c1.2' && st.answering && !st.busy, 'premier exercice');
  expect(s.save.run?.records).toHaveLength(0);
  expect(await mg(page, 'etat')).toMatchObject({ vitesse: 4, muet: false, pilote: 'arrêté' });

  await tripleTap(page, 1120, 935); // Trois appuis sur + servent à préparer la réponse.
  await until(page, (st) => st.voiceLast.at(-1)?.id === 'nombre_3', 'trois appuis sur +');
  expect((await state(page)).save.run?.records).toHaveLength(0);

  await tripleTap(page, 90, 90);
  s = await until(page, (st) => st.problem?.index === 1 && st.answering && !st.busy, 'exercice suivant');
  expect(s.save.run?.records).toHaveLength(1);
  expect(await mg(page, 'etat')).toMatchObject({ vitesse: 4, muet: false, pilote: 'arrêté' });
});

test('un triple toucher pendant la consigne laisse l’exercice à résoudre', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await open(page, 'vitesse=4&niveau=debut&scene=c1.2');
  await until(page, (s) => s.voice?.id === 'c1_2_consigne', 'consigne en cours');
  await tripleTap(page, 90, 90);
  await expect.poll(() => mg(page, 'etat')).toMatchObject({ vitesse: 4, muet: false, pilote: 'arrêté' });
  const s = await until(page, (st) => st.answering && !st.busy, 'premier exercice prêt');
  expect(s.problem?.index).toBe(0);
  expect(s.save.run?.records).toHaveLength(0);
});
