import { arrowsTo, expect, mg, open, playToBilan, state, test, until, waitAnswer } from './helpers';

// Chapitre 4 « Alerte sur la Lune ! » joué de bout en bout aux trois niveaux, la jauge de prévision (C4.1)
// et le plateau de l'ordinateur (C4.3) aux flèches + OK, et le passage du bilan du chapitre 3 au chapitre 4.

for (const niveau of ['debut', 'milieu', 'fin'] as const) {
  test(`chapitre 4 complet au niveau ${niveau} : approche, alarme 1202, tâches essentielles, alunissage, premier pas`, async ({ page, consoleErrors }) => {
    test.setTimeout(360_000);
    void consoleErrors;
    await open(page, `vitesse=10&niveau=${niveau}&scene=c4.1`);
    let s = await until(page, (st) => st.scene === 'c4.1', 'scène C4.1');
    expect(s.save.run?.chapterId).toBe('c4');

    s = await playToBilan(page);
    s = await until(page, (st) => st.voiceLog.includes('bilan_suite') && !st.voice && st.focus !== null, 'bilan dit', 60_000);
    expect(s.save.run?.chapterId).toBe('c5');

    const ids = new Set(s.save.run?.records.map((r) => r.challengeId));
    expect([...ids].sort()).toEqual(['c4_approche', 'c4_taches']);
    expect(s.save.chapters.c4.missionStar).toBe(true);
    // La première prévision était fausse (une de moins) : le contrôle en aurait pris trop.
    expect(s.save.run!.records[0]).toMatchObject({ challengeId: 'c4_approche', errors: 1, efficient: true });
    expect(s.voiceLog).toEqual(
      expect.arrayContaining([
        // C4.1 : Eagle, Columbia, la jauge.
        'c4_1_eagle',
        'c4_1_columbia',
        'c4_1_incroyable',
        'sim_regardons',
        'c4_1_consigne',
        'tuto_jauge',
        'c4_1_trop',
        'c4_1_fin',
        // C4.2 : l'alarme, le cadre de la simulation revient.
        'c4_2_alarme',
        'c4_2_trop_travail',
        'c4_2_equipe',
        'c4_2_prepare',
        // C4.3 : les tâches, le plateau, le compteur, la zone d'attente (le premier rapport ne tient pas).
        'c4_3_place',
        'c4_3_tache_guidage',
        'c4_3_tache_controle',
        'c4_3_tache_rapport',
        'c4_3_tache_affichage',
        'c4_3_priorite',
        'c4_3_plateau',
        'c4_3_consigne_guidage',
        'tuto_compteur',
        'c4_3_choix_rapport',
        'tuto_plateau',
        'c4_3_attend',
        'c4_3_fonctionne',
        // C4.4 et C4.5 : l'alunissage, le premier pas, la Terre dans le ciel.
        'c4_4_controleurs',
        'c4_4_continuer',
        'c4_4_rochers',
        'c4_4_allez',
        'c4_4_pose',
        'c4_4_reussi',
        'c4_4_lune',
        'c4_4_plus_tard',
        'c4_5_pas',
        'c4_5_aldrin',
        'c4_5_mission',
        'c4_5_maison',
        'bilan_mission',
      ]),
    );
    // L'alarme survient après la clôture des contrôles ; « L'Aigle s'est posé » avant les réjouissances.
    const at = (id: string) => s.voiceLog.indexOf(id);
    expect(at('c4_1_fin')).toBeLessThan(at('c4_2_alarme'));
    expect(at('c4_4_pose')).toBeLessThan(at('c4_4_reussi'));
    // Fin de CP : deux contrôles (60 − 20 puis − 10), deux tâches indispensables (50 − 20 − 15).
    if (niveau === 'fin') expect(s.voiceLog).toEqual(expect.arrayContaining(['gen_etape', 'c4_1_consigne_2', 'c4_3_consigne_2']));
    expect(s.diag.blocages).toBe(0);
    expect(s.diag.erreurs).toBe(0);
  });
}

test('jauge de prévision : chiffres du clavier, puis le repère descendu aux flèches + OK', async ({ page, consoleErrors }) => {
  test.setTimeout(180_000);
  void consoleErrors;
  await open(page, 'vitesse=10&niveau=milieu&scene=c4.1');
  let s = await waitAnswer(page, 120_000);
  const p = s.problem!.params as { total: number; minus: number };
  expect(p).toMatchObject({ total: 15, minus: 5 });
  expect(s.voiceLog).toContain('tuto_jauge');

  // Une prévision fausse, tapée au clavier : 12 (le contrôle n'en aurait pris que 3).
  await page.keyboard.press('Digit1');
  await page.keyboard.press('Digit2');
  await arrowsTo(page, 1400, 935, 'Valider');
  await page.keyboard.press('Enter');
  s = await until(page, (st) => st.voiceLog.includes('c4_1_peu'), 'le contrôle en aurait pris trop peu');
  s = await waitAnswer(page);

  // Le repère est revenu au niveau de la jauge : cinq appuis sur ▼ le mettent sur 10.
  await arrowsTo(page, 752, 575, 'flèche vers le bas');
  for (let i = 0; i < p.minus; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(80);
  }
  await arrowsTo(page, 1400, 935, 'Valider');
  await page.keyboard.press('Enter');
  s = await until(page, (st) => st.save.run?.records.some((r) => r.challengeId === 'c4_approche') ?? false, 'contrôle réussi', 60_000);
  expect(s.save.run!.records.find((r) => r.challengeId === 'c4_approche')).toMatchObject({ errors: 1 });
  s = await state(page);
  expect(s.diag.erreurs).toBe(0);
});

test('plateau de l’ordinateur : compteur aux flèches + OK, puis la tâche secondaire mise dans le plateau, puis en attente', async ({ page, consoleErrors }) => {
  test.setTimeout(240_000);
  void consoleErrors;
  await open(page, 'vitesse=10&niveau=debut&scene=c4.3');
  let s = await waitAnswer(page, 150_000);
  // Capacité 5, le guidage en prend 3 : le compteur (une seule roue) monte à 2 avec ▲, sélectionné d'office.
  expect(s.problem!.params).toMatchObject({ stage: 'reste', cap: 5, units: 3 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  await page.keyboard.press('Enter');
  await arrowsTo(page, 1400, 935, 'Valider');
  await page.keyboard.press('Enter');

  // Le rapport (3 unités) ne tient pas dans les 2 places libres. Essai dans le plateau : des unités restent dehors.
  s = await until(page, (st) => st.answering && !st.busy && (st.problem?.params as { stage: string }).stage === 'choix', 'choix de la tâche secondaire', 90_000);
  expect(s.problem!.params).toMatchObject({ task: 'rapport', units: 3, busy: 3 });
  await arrowsTo(page, 650, 770, 'dans le plateau');
  await page.keyboard.press('Enter');
  await arrowsTo(page, 1400, 935, 'Valider');
  await page.keyboard.press('Enter');
  s = await until(page, (st) => st.voiceLog.includes('c4_3_deborde'), 'des unités ne trouvent pas de place');
  s = await waitAnswer(page);
  await arrowsTo(page, 1010, 770, 'zone d’attente');
  await page.keyboard.press('Enter');
  await arrowsTo(page, 1400, 935, 'Valider');
  await page.keyboard.press('Enter');
  s = await until(page, (st) => st.voiceLog.includes('c4_3_attend'), 'la tâche attend son tour', 60_000);
  s = await until(page, (st) => st.save.run?.records.some((r) => r.challengeId === 'c4_taches') ?? false, 'problème enregistré');
  expect(s.save.run!.records.find((r) => r.challengeId === 'c4_taches')).toMatchObject({ errors: 1 });
  expect(s.diag.erreurs).toBe(0);
});

test('du bilan du chapitre 3, « Continuer » ouvre le chapitre 4', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await open(page, 'vitesse=10&niveau=debut&scene=c3.5');
  await mg(page, 'bilan');
  let s = await until(page, (st) => st.voiceLog.includes('bilan_suite') && !st.voice && st.focus !== null, 'bilan du chapitre 3', 60_000);
  expect(s.save.run?.chapterId).toBe('c4');
  await page.keyboard.press('Enter'); // « Continuer », sélectionné d'office
  s = await until(page, (st) => st.scene === 'c4.1', 'début du chapitre 4');
  expect(s.save.run?.sceneIndex).toBe(0);
  s = await state(page);
  expect(s.diag.erreurs).toBe(0);
});
