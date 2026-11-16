import { arrowsTo, expect, mg, open, playToBilan, solve, state, test, until, waitAnswer } from './helpers';

// Chapitre 3 « Apollo 11, le grand décollage » joué de bout en bout aux trois niveaux (bilan qui mène au chapitre 4),
// le pavé numérique de l'ordinateur de guidage aux flèches + OK et aux touches chiffres,
// et le passage du bilan du chapitre 2 au chapitre 3.

for (const niveau of ['debut', 'milieu', 'fin'] as const) {
  test(`chapitre 3 complet au niveau ${niveau} : vérifications, signal, lancement, bilan qui mène au chapitre 4`, async ({ page, consoleErrors }) => {
    test.setTimeout(300_000);
    void consoleErrors;
    await open(page, `vitesse=10&niveau=${niveau}&scene=c3.1`);
    let s = await until(page, (st) => st.scene === 'c3.1', 'scène C3.1');
    expect(s.save.run?.chapterId).toBe('c3');

    s = await playToBilan(page);
    // Le bilan propose de continuer : la sauvegarde est déjà au début du chapitre 4.
    s = await until(page, (st) => st.voiceLog.includes('bilan_suite') && !st.voice && st.focus !== null, 'bilan dit', 60_000);
    expect(s.save.run?.chapterId).toBe('c4');

    const ids = new Set(s.save.run?.records.map((r) => r.challengeId));
    expect([...ids].sort()).toEqual(['c3_signal', 'c3_verifications']);
    expect(s.save.chapters.c3.missionStar).toBe(true);
    // La première réponse était fausse : sa conséquence, puis une aide, sans retirer l'étoile d'efficacité (P8).
    expect(s.save.run!.records[0]).toMatchObject({ challengeId: 'c3_verifications', errors: 1, efficient: true });
    expect(s.voiceLog).toEqual(
      expect.arrayContaining([
        // C3.1 : la carte, le poste, les trois astronautes nommés.
        'c3_1_radio',
        'c3_1_saturn',
        'c3_1_carte_floride',
        'c3_1_carte_houston',
        'c3_1_carte_mit',
        'c3_1_poste',
        'c3_1_armstrong',
        'c3_1_aldrin',
        'c3_1_collins',
        'c3_1_fin',
        // C3.2 : un système à la fois ; la première réponse est fausse (une de moins : il en manque un).
        'c3_2_ingenieur',
        'c3_2_navigation',
        'c3_2_peu_1',
        'c3_2_valide',
        'c3_2_cloture',
        'c3_2_recu',
        // C3.3 : le signal, la bonne batterie.
        'c3_3_etrange',
        'c3_3_reserve',
        'c3_3_stable',
        'c3_3_valide',
        // C3.4 et C3.5 : compte à rebours complet, lancement, message depuis l'espace.
        'c3_4_compte_10',
        'c3_4_compte_1',
        'c3_4_etages',
        'c3_4_parti',
        'c3_5_message',
        'c3_5_columbia',
        'c3_5_voyage',
        'c3_5_etape',
        'bilan_mission',
      ]),
    );
    // Compte à rebours dans l'ordre.
    const countdown = s.voiceLog.filter((id) => id.startsWith('c3_4_compte_'));
    expect(countdown).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => `c3_4_compte_${n}`));
    // Fin de CP : 50 − 20 puis − 5, la réserve trouvée sert à la deuxième étape.
    if (niveau === 'fin') expect(s.voiceLog).toEqual(expect.arrayContaining(['gen_etape', 'c3_3_reserve_2']));
    expect(s.diag.blocages).toBe(0);
    expect(s.diag.erreurs).toBe(0);
  });
}

test('ordinateur de guidage : le pavé numérique se joue aux touches chiffres puis aux flèches + OK', async ({ page, consoleErrors }) => {
  test.setTimeout(240_000);
  void consoleErrors;
  await open(page, 'vitesse=10&niveau=milieu&scene=c3.2');
  // Les trois premiers systèmes (navigation, communications, alimentation) : réponses justes.
  let s = await waitAnswer(page);
  for (let i = 0; i < 3; i++) {
    expect((s.problem?.params as { kind: string }).kind).not.toBe('guidage');
    await solve(page, false);
    s = await until(page, (st) => st.answering && !st.busy && st.problem?.index === i + 1, `problème ${i + 2}`, 90_000);
  }
  const p = s.problem!.params as { kind: string; total: number; deja: number };
  expect(p.kind).toBe('guidage');
  const answer = p.total - p.deja;
  expect(s.voiceLog).toContain('c3_2_guidage');
  expect(s.voiceLog).toContain('tuto_clavier');

  // Une première réponse fausse, tapée aux touches chiffres du clavier : une de trop.
  const typeDigits = async (n: number) => {
    for (const d of String(n)) await page.keyboard.press(`Digit${d}`);
  };
  await typeDigits(answer + 1);
  await arrowsTo(page, 1290, 935, 'Valider');
  await page.keyboard.press('Enter');
  s = await until(page, (st) => st.voiceLog.includes('c3_2_trop_1'), 'une de trop');
  s = await waitAnswer(page);

  // La bonne réponse aux flèches + OK : chaque chiffre sur le pavé, puis Valider.
  const KEY: Record<string, [number, number]> = {
    '7': [0, 0], '8': [1, 0], '9': [2, 0],
    '4': [0, 1], '5': [1, 1], '6': [2, 1],
    '1': [0, 2], '2': [1, 2], '3': [2, 2],
    '0': [1, 3],
  };
  for (const d of String(answer)) {
    const [c, r] = KEY[d];
    await arrowsTo(page, 1290 + (c - 1) * 128, 425 + r * 106, `touche ${d}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  await arrowsTo(page, 1290, 935, 'Valider');
  await page.keyboard.press('Enter');
  s = await until(page, (st) => st.save.run?.records.filter((r) => r.challengeId === 'c3_verifications').length === 4, 'guidage vérifié', 60_000);
  const last = s.save.run!.records.filter((r) => r.challengeId === 'c3_verifications')[3];
  expect(last).toMatchObject({ errors: 1 });
  s = await until(page, (st) => st.voiceLog.includes('c3_2_recu'), 'clôture des vérifications', 90_000);
  expect(s.diag.erreurs).toBe(0);
});

test('du bilan du chapitre 2, « Continuer » ouvre le chapitre 3', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await open(page, 'vitesse=10&niveau=debut&scene=c2.3');
  await mg(page, 'bilan');
  let s = await until(page, (st) => st.voiceLog.includes('bilan_suite') && !st.voice && st.focus !== null, 'bilan du chapitre 2', 60_000);
  expect(s.save.run?.chapterId).toBe('c3');
  await page.keyboard.press('Enter'); // « Continuer », sélectionné d'office
  s = await until(page, (st) => st.scene === 'c3.1', 'début du chapitre 3');
  expect(s.save.run?.sceneIndex).toBe(0);
  s = await state(page);
  expect(s.diag.erreurs).toBe(0);
});
