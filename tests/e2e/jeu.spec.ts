import {
  arrowsToValidate,
  expect,
  FAST,
  gameToPage,
  installGamepad,
  open,
  PAD,
  state,
  tap,
  test,
  until,
  waitAnswer,
} from './helpers';

// Les tests pilotent le vrai jeu (production + service worker), comme l'enfant :
// flèches + OK, chiffres du clavier en option, toucher, manette.

test('accueil et réglages aux flèches, lecture des choix, départ de la mission', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await open(page, 'vitesse=8');
  await until(page, (s) => s.scenes.includes('Title'), 'accueil');
  await page.keyboard.press('Space');
  await until(page, (s) => s.scenes.includes('Menu'), 'menu');
  await page.keyboard.press('Enter'); // « Nouvelle mission » (sélectionnée d'office)
  // Réglages : la sélection part de « C'est parti ! ». Trois fois vers le haut : niveau, colonne du milieu.
  await until(page, (s) => s.focus?.y === 900 - 85, 'réglages');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  let s = await until(page, (st) => st.save.settings.profile === 'milieu', 'niveau milieu choisi');
  expect(s.voiceLog).toContain('cfg_niveau_milieu'); // chaque bouton est lu quand on arrive dessus
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  s = await until(page, (st) => st.scene === 'c1.1', 'début du chapitre 1');
  expect(s.save.run?.profile).toBe('milieu');
  expect(s.save.run?.chapterId).toBe('c1');
});

test('voyants (C1.2) au clavier : chiffres, flèches et OK ; une erreur montre sa conséquence puis aide', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await open(page, 'vitesse=8&niveau=debut&scene=c1.2');
  let s = await waitAnswer(page);
  expect(s.problem?.params).toEqual({ total: 6, deja: 2 }); // exemple du document
  const answer = s.problem!.answer as number;

  // Réponse trop grande : un voyant de trop s'allume, le Collègue le dit, l'aide augmente d'un cran.
  await page.keyboard.press(`Digit${answer + 1}`);
  await arrowsToValidate(page);
  await page.keyboard.press('Enter');
  s = await waitAnswer(page);
  expect(s.voiceLog).toEqual(expect.arrayContaining(['gen_erreur', 'c1_2_trop_1', 'c1_2_aide_1']));
  expect(s.save.run?.records).toHaveLength(0);

  // Bonne réponse : les voyants s'allument, réplique de correction (pas de reproche).
  await page.keyboard.press(`Digit${answer}`);
  await arrowsToValidate(page);
  await page.keyboard.press('Enter');
  s = await until(page, (st) => (st.save.run?.records.length ?? 0) === 1, 'problème enregistré');
  expect(s.voiceLog).toEqual(expect.arrayContaining(['c1_2_succes', 'gen_correction']));
  // Les erreurs et les aides ne retirent pas l'étoile d'efficacité (P8).
  expect(s.save.run!.records[0]).toMatchObject({ challengeId: 'c1_voyants', errors: 1, efficient: true });
});

test('voyants aux flèches seules (sans pavé numérique) : + puis OK', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await open(page, 'vitesse=8&niveau=milieu&scene=c1.2');
  const s0 = await waitAnswer(page);
  expect(s0.problem?.params).toEqual({ total: 12, deja: 7 });
  // La sélection est d'office sur « + » : OK autant de fois que nécessaire.
  for (let i = 0; i < (s0.problem!.answer as number); i++) await page.keyboard.press('Enter');
  await arrowsToValidate(page);
  await page.keyboard.press('Enter');
  const s = await until(page, (st) => (st.save.run?.records.length ?? 0) === 1, 'problème enregistré');
  expect(s.save.run!.records[0]).toMatchObject({ errors: 0, efficient: true });
  expect(s.voiceLog.some((id) => id.startsWith('gen_bravo'))).toBe(true);
});

test.describe('tablette', () => {
  test.use({ hasTouch: true });

  test('voyants au toucher : + puis la grande coche', async ({ page, consoleErrors }) => {
    void consoleErrors;
    await open(page, 'vitesse=8&niveau=debut&scene=c1.2');
    const s0 = await waitAnswer(page);
    const plus = await gameToPage(page, 1120, 935);
    for (let i = 0; i < (s0.problem!.answer as number); i++) {
      await page.touchscreen.tap(plus.x, plus.y);
      await page.waitForTimeout(80);
    }
    const v = s0.validate!;
    const check = await gameToPage(page, v.x + v.width / 2, v.y + v.height / 2);
    await page.touchscreen.tap(check.x, check.y);
    const s = await until(page, (st) => (st.save.run?.records.length ?? 0) === 1, 'problème enregistré');
    expect(s.save.run!.records[0].errors).toBe(0);
  });
});

test('manette : Y réécoute (la première est gratuite), X aide, croix et A pour répondre', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await installGamepad(page);
  await open(page, 'vitesse=8&niveau=debut&scene=c1.2');
  const s0 = await waitAnswer(page);

  await tap(page, PAD.Y);
  let s = await until(page, (st) => st.voiceLog.includes('gen_reecoute_1') && st.answering && !st.busy, 'première réécoute');
  await tap(page, PAD.X);
  s = await until(page, (st) => st.voiceLog.includes('c1_2_aide_1') && !st.busy, 'aide niveau 1');
  await tap(page, PAD.Y);
  s = await until(page, (st) => st.voiceLog.includes('gen_reecoute_n') && !st.busy, 'deuxième réécoute');

  for (let i = 0; i < (s0.problem!.answer as number); i++) await tap(page, PAD.A);
  for (let i = 0; i < 4; i++) {
    s = await state(page);
    if (s.focus && s.validate && s.focus.x === s.validate.x && s.focus.y === s.validate.y) break;
    await tap(page, PAD.RIGHT);
  }
  await tap(page, PAD.A);
  s = await until(page, (st) => (st.save.run?.records.length ?? 0) === 1, 'problème enregistré');
  // Deuxième réécoute de la même consigne : l'étoile d'efficacité de ce problème n'est pas gagnée.
  expect(s.save.run!.records[0]).toMatchObject({ errors: 0, helps: 1, efficient: false });
});

test('pas de pause : ni bouton ni Retour ; l’application en arrière-plan se fige en silence ; « Continuer » reprend', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await open(page, 'vitesse=4&niveau=debut&scene=c1.2');
  let s = await waitAnswer(page);
  expect(s.hud).toEqual(['reecouter', 'aide']); // ni pause ni jetons

  // « Retour » (Échap, comme B ou la touche Retour de la télécommande) : rien ne s'arrête.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  s = await state(page);
  expect(s.paused).toBe(false);
  expect(s.answering).toBe(true);
  expect(s.layers).toEqual(['story']);

  // Application en arrière-plan : le temps de jeu ne compte plus, aucune fenêtre ne s'ouvre.
  const setHidden = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { value: h, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  s = await until(page, (st) => st.paused, 'jeu figé');
  const frozen = s.activeMs;
  await page.waitForTimeout(1200);
  s = await state(page);
  expect(s.activeMs).toBe(frozen);
  expect(s.layers).toEqual(['story']);
  await setHidden(false);
  s = await until(page, (st) => !st.paused && st.activeMs > frozen, 'le jeu repart');
  expect(s.answering).toBe(true);

  // Application fermée puis relancée : l'accueil propose « Continuer », qui reprend la scène.
  await page.goto(`./?${FAST}&vitesse=4`); // même adresse, sans démarrage direct d'une scène
  await until(page, (st) => st.scenes.includes('Title'), 'accueil');
  await page.keyboard.press('Space');
  await until(page, (st) => st.scenes.includes('Menu'), 'menu');
  await page.keyboard.press('Enter'); // « Continuer » est sélectionné d'office
  s = await until(page, (st) => st.scene === 'c1.2' && st.answering, 'reprise de la scène');
  expect(s.save.run?.chapterId).toBe('c1');
});

test('chapitre 1 complet jusqu’au bilan (étoile de mission enregistrée), puis retour à l’accueil', async ({ page, consoleErrors }) => {
  test.setTimeout(240_000);
  void consoleErrors;
  await open(page, 'vitesse=10&niveau=fin&scene=c1.1');
  // C1.1 : on touche le poste de travail (sélectionné d'office) pour s'y installer.
  await until(page, (s) => s.voiceLog.includes('c1_1_poste') && !s.voice, 'poste de travail', 90_000);
  await page.keyboard.press('Enter');
  const solve = (wrong: boolean) => page.evaluate((w) => (window as unknown as { __mathgaret: { solve: (w: boolean) => void } }).__mathgaret.solve(w), wrong);
  let first = true;
  for (;;) {
    const s = await until(page, (st) => (st.answering && !st.busy) || st.scenes.includes('Bilan'), 'problème suivant', 120_000);
    if (s.scenes.includes('Bilan')) break;
    await solve(first);
    first = false;
    await page.waitForTimeout(300);
    await until(page, (st) => !st.answering || st.busy || st.scenes.includes('Bilan'), 'réponse prise en compte');
  }
  const s = await until(page, (st) => st.voiceLog.includes('bilan_suite') && !st.voice && st.focus !== null, 'bilan dit', 60_000);
  expect(s.save.chapters.c1.missionStar).toBe(true);
  expect(s.save.chapters.c1.best.fin.rate).toBe(1);
  expect(s.save.run?.chapterId).toBe('c2');
  expect(s.voiceLog).toEqual(expect.arrayContaining(['c1_3_papier', 'c1_4_lune', 'c1_4_probleme', 'bilan_mission']));
  // « Continuer » (chapitre 2) est sélectionné d'office ; « Faire une pause » est à sa droite.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await until(page, (st) => st.scenes.includes('Menu'), 'accueil');
});

test('rendu WebGL (celui de la Shield) : démarre sans erreur', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.goto('./?debug&voix=muette');
  await until(page, (s) => s.scenes.includes('Title'), 'accueil', 60_000);
  const renderer = await page.evaluate(() => (window as unknown as { __mathgaret: { game: { renderer: { type: number } } } }).__mathgaret.game.renderer.type);
  expect(renderer).toBe(2); // Phaser.WEBGL
});

test('écran 4:3 : image 16:9 centrée avec bandes', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.setViewportSize({ width: 1024, height: 768 });
  await open(page, 'vitesse=4');
  await expect.poll(async () => (await page.locator('canvas').boundingBox())?.height).toBeCloseTo(576, 0);
  const box = await page.locator('canvas').boundingBox();
  expect(box!.width).toBeCloseTo(1024, 0);
  expect(box!.y).toBeCloseTo(96, 0);
});

test('PWA : manifeste, service worker et jeu jouable hors ligne', async ({ page, context }) => {
  await open(page, 'vitesse=4');
  expect(await page.locator('link[rel="manifest"]').count()).toBe(1);
  // Dès la première visite, le service worker prend la main (tout est déjà en cache).
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 30_000 }).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await until(page, (s) => s.scenes.includes('Title'), 'accueil hors ligne', 30_000);
  await page.keyboard.press('Space');
  await until(page, (s) => s.scenes.includes('Menu'), 'menu hors ligne');
  await context.setOffline(false);
});

/** WAV mono 16 bits de `ms` millisecondes de silence. */
function silentWav(ms: number): Buffer {
  const rate = 22_050;
  const n = Math.round((rate * ms) / 1000);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  return b;
}

test('voix livrées : le fichier du manifeste remplace la synthèse, y compris pour une réplique à nombres', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.route('**/audio/manifest.json', (r) =>
    r.fulfill({
      json: {
        voix: {
          c1_2_consigne: 'test/generique.wav', // ignoré : la réplique contient des nombres
          'c1_2_consigne|deja=2|total=6': 'test/consigne-6-2.wav',
          tuto_reponse: 'test/tuto.wav',
        },
      },
    }),
  );
  await page.route('**/audio/test/*.wav', (r) => r.fulfill({ body: silentWav(400), contentType: 'audio/wav' }));
  await open(page, 'vitesse=4&niveau=debut&scene=c1.2');
  await waitAnswer(page);
  // Toucher « Réécouter » : premier geste (le navigateur autorise alors le son), la consigne est redite.
  const hp = await gameToPage(page, 1625, 110); // bouton « Réécouter »
  await page.mouse.click(hp.x, hp.y);
  const s = await until(page, (st) => st.voiceLog.filter((id) => id === 'c1_2_consigne').length >= 2 && !st.busy, 'consigne redite');
  expect(s.voiceFiles).toContain('c1_2_consigne');
});

test('audio livré (vrais fichiers) : consigne assemblée avec ses nombres, nombres, musique et bruitages', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.unroute('**/audio/manifest.json');
  await open(page, 'vitesse=4&niveau=debut&scene=c1.2');
  await waitAnswer(page);
  // Premier geste : le son est autorisé, la consigne est redite depuis les fichiers.
  const hp = await gameToPage(page, 1625, 110); // bouton « Réécouter »
  await page.mouse.click(hp.x, hp.y);
  const s = await until(page, (st) => st.voiceLog.filter((id) => id === 'c1_2_consigne').length >= 2 && !st.busy, 'consigne redite', 60_000);
  expect(s.voiceParts.c1_2_consigne).toBe(5); // 3 morceaux + 2 nombres
  await until(page, (st) => st.musique?.via === 'fichier' && st.musique.mood === 'calme', 'musique calme depuis son fichier');
  await page.evaluate(() => {
    const g = (window as unknown as { __mathgaret: { services: { sfx: { select(): void }; voice: { sayNumber(n: number): Promise<void> } } } }).__mathgaret;
    g.services.sfx.select();
    void g.services.voice.sayNumber(7);
  });
  const t = await until(page, (st) => st.voiceLast.some((v) => v.id === 'nombre_7' && v.via === 'fichier'), 'nombre lu depuis son fichier');
  expect(t.voiceLast.find((v) => v.id === 'nombre_7')?.speaker).toBe('collegue');
  expect(t.sons).toContain('appui');
});
