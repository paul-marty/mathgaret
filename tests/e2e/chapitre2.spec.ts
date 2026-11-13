import type { Page } from '@playwright/test';
import { expect, open, state, test, until, type GameState } from './helpers';

// Chapitre 2 « Tester avant de voler » joué de bout en bout aux trois niveaux,
// puis la console de développement `mg` (avance rapide dans les chapitres).

type Mg = Record<string, (...args: unknown[]) => unknown>;

function mg(page: Page, cmd: string, ...args: unknown[]): Promise<unknown> {
  return page.evaluate(([c, a]) => (window as unknown as { mg: Mg }).mg[c as string](...(a as unknown[])), [cmd, args] as const);
}

const solve = (page: Page, wrong: boolean) =>
  page.evaluate((w) => (window as unknown as { __mathgaret: { solve: (w: boolean) => void } }).__mathgaret.solve(w), wrong);

/** Joue jusqu'au bilan : la première réponse est fausse, les autres justes ; les objets proposés sont touchés à OK. */
async function playToBilan(page: Page): Promise<GameState> {
  let first = true;
  for (;;) {
    const s = await until(
      page,
      (st) => (st.answering && !st.busy) || st.scenes.includes('Bilan') || st.diag.waiting,
      'action suivante',
      120_000,
    );
    if (s.scenes.includes('Bilan')) return s;
    if (s.answering) {
      await solve(page, first);
      first = false;
      await page.waitForTimeout(300);
      await until(page, (st) => !st.answering || st.busy || st.scenes.includes('Bilan'), 'réponse prise en compte');
    } else {
      await page.keyboard.press('Enter'); // l'objet à toucher est sélectionné d'office
      await until(page, (st) => !st.diag.waiting, 'objet touché', 10_000);
    }
  }
}

for (const niveau of ['debut', 'milieu', 'fin'] as const) {
  test(`chapitre 2 complet au niveau ${niveau} : trois challenges, souvenir de Lauren, bilan`, async ({ page, consoleErrors }) => {
    test.setTimeout(300_000);
    void consoleErrors;
    await open(page, `vitesse=10&niveau=${niveau}&scene=c2.1`);
    let s = await until(page, (st) => st.scene === 'c2.1', 'scène C2.1');
    expect(s.save.run?.chapterId).toBe('c2');

    s = await playToBilan(page);
    s = await until(page, (st) => st.voiceLog.includes('bilan_bientot') && !st.voice && st.focus !== null, 'bilan dit', 60_000);

    const ids = new Set(s.save.run?.records.map((r) => r.challengeId));
    expect([...ids].sort()).toEqual(['c2_bug', 'c2_instructions', 'c2_test']);
    expect(s.save.chapters.c2.missionStar).toBe(true);
    // La première réponse était fausse : sa conséquence, puis une aide, sans retirer l'étoile d'efficacité (P8).
    expect(s.save.run!.records[0]).toMatchObject({ challengeId: 'c2_instructions', errors: 1, efficient: true });
    expect(s.voiceLog).toEqual(
      expect.arrayContaining(['c2_1_succes', 'c2_1_cloture', 'c2_l_narration', 'c2_l_retour', 'c2_2_bravo', 'c2_3_plein', 'c2_3_houston', 'c2_3_freinage', 'c2_3_fonctionne', 'c2_3_nasa', 'bilan_mission']),
    );
    // Problème en deux étapes (niveau fin, 30 − 12 puis − 8) : le résultat intermédiaire est annoncé.
    if (niveau === 'fin') expect(s.voiceLog).toContain('gen_etape');
    expect(s.diag.blocages).toBe(0);
    expect(s.diag.erreurs).toBe(0);
  });
}

test('du bilan du chapitre 1, « Continuer » ouvre le chapitre 2', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await open(page, 'vitesse=10&niveau=debut&scene=c1.4');
  await mg(page, 'bilan');
  let s = await until(page, (st) => st.voiceLog.includes('bilan_suite') && !st.voice && st.focus !== null, 'bilan du chapitre 1', 60_000);
  expect(s.voiceLog).not.toContain('bilan_bientot');
  expect(s.save.run?.chapterId).toBe('c2');
  await page.keyboard.press('Enter'); // « Continuer », sélectionné d'office
  s = await until(page, (st) => st.scene === 'c2.1', 'début du chapitre 2');
  expect(s.save.run?.sceneIndex).toBe(0);
});

test('console mg : aller, suivante, précédente, niveau, vitesse, jusqu’à, bilan', async ({ page, consoleErrors }) => {
  test.setTimeout(180_000);
  void consoleErrors;
  await open(page, 'vitesse=4&niveau=debut&scene=c1.2');
  await until(page, (st) => st.scene === 'c1.2', 'scène C1.2');

  const list = (await mg(page, 'scenes')) as string[];
  expect(list).toEqual(expect.arrayContaining(['c1.1', 'c1.4', 'c2.1', 'c2.lauren', 'c2.2', 'c2.3']));

  // Aller directement à une scène, avec un niveau.
  expect(await mg(page, 'aller', 'c2.2', 'fin')).toContain('c2.2');
  let s = await until(page, (st) => st.scene === 'c2.2' && st.answering && !st.busy, 'C2.2 prête', 90_000);
  expect(s.save.run?.profile).toBe('fin');
  expect(s.problem?.challenge).toBe('c2_bug');

  // Résoudre depuis la console : le problème est enregistré.
  expect(await mg(page, 'resoudre')).toContain('juste');
  s = await until(page, (st) => st.save.run?.records.some((r) => r.challengeId === 'c2_bug') ?? false, 'problème résolu');

  // Scène suivante, puis précédente.
  await mg(page, 'suivante');
  await until(page, (st) => st.scene === 'c2.3', 'C2.3');
  await mg(page, 'precedente');
  await until(page, (st) => st.scene === 'c2.2', 'retour à C2.2');

  // Changer de niveau reprend la scène.
  await mg(page, 'niveau', 'milieu');
  s = await until(page, (st) => st.scene === 'c2.2' && st.save.run?.profile === 'milieu', 'niveau milieu');

  // Vitesse réglable à chaud.
  expect(await mg(page, 'vitesse', 3)).toContain('vitesse 3');
  expect(await page.evaluate(() => (window as unknown as { __mathgaret: { services: { clock: { speed: number } } } }).__mathgaret.services.clock.speed)).toBe(3);

  // Pilote automatique jusqu'à une scène : il s'arrête dessus et rend la vitesse et la voix d'avant.
  await mg(page, 'chapitre', 2, 'debut');
  await until(page, (st) => st.scene === 'c2.1', 'début du chapitre 2');
  expect(await mg(page, 'jusqua', 'c2.3', 20)).toContain('c2.3');
  s = await until(page, (st) => st.scene === 'c2.3', 'C2.3 atteinte en pilote automatique', 150_000);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __mathgaret: { services: { clock: { speed: number } } } }).__mathgaret.services.clock.speed))
    .toBe(3);
  // Les challenges traversés ont été joués (bonnes réponses) et enregistrés.
  s = await state(page);
  expect(s.save.run?.records.filter((r) => r.challengeId === 'c2_instructions').length).toBeGreaterThan(0);
  expect(s.save.run?.records.filter((r) => r.challengeId === 'c2_bug').length).toBeGreaterThan(0);

  const etat = (await mg(page, 'etat')) as Record<string, unknown>;
  expect(etat).toMatchObject({ scene: 'c2.3' });

  // Bilan immédiat.
  await mg(page, 'bilan');
  await until(page, (st) => st.scenes.includes('Bilan'), 'bilan du chapitre 2');
});
