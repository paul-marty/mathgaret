import { existsSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { arrowsTo, expect, mg, open, playToBilan, state, test, until, waitAnswer } from './helpers';

// Chapitre 5 « Le grand retour sur Terre » joué de bout en bout aux trois niveaux, puis la fin de la mission
// (bilan de la mission, diplôme, générique, Mars) ; la balance de C5.1 aux flèches ; le radar de C5.2 aux touches chiffres ;
// la note aux parents et le prénom du diplôme ; le passage du bilan du chapitre 4 au chapitre 5.

for (const niveau of ['debut', 'milieu', 'fin'] as const) {
  test(`chapitre 5 complet au niveau ${niveau} : départ, retrouvailles, panne imaginaire, rentrée, célébration, puis la fin de la mission`, async ({ page, consoleErrors }) => {
    test.setTimeout(420_000);
    void consoleErrors;
    await open(page, `vitesse=10&niveau=${niveau}&scene=c5.1`);
    let s = await until(page, (st) => st.scene === 'c5.1', 'scène C5.1');
    expect(s.save.run?.chapterId).toBe('c5');

    s = await playToBilan(page);
    expect(s.scenes).toContain('Finale');
    expect(s.save.chapters.c5.missionStar).toBe(true);
    // La partie est terminée : il n'y a plus de chapitre après le cinquième.
    expect(s.save.run).toBeNull();

    // C5.6 : le bilan de la mission. La première réponse était fausse : la phrase de progrès parle de persévérance.
    s = await until(page, (st) => st.voiceLog.includes('fin_bravo') && !st.voice && st.focus !== null, 'bilan de la mission', 60_000);
    expect(s.voiceLog).toEqual(expect.arrayContaining(['fin_accomplie', 'fin_etoiles_mission', 'bilan_efficacite', 'fin_progres_correction']));
    expect(s.voiceLog).toEqual(
      expect.arrayContaining([
        // C5.1 : Eagle sur la Lune, alléger Eagle sur la balance, les sacs à dos laissés pour de vrai, le départ.
        'c5_1_date',
        'c5_1_rentrer',
        'c5_1_cailloux',
        'c5_1_balance',
        'c5_1_poids',
        'c5_1_vrai',
        'c5_1_pret',
        'c5_1_envol',
        // C5.2 : Collins, le radar du rendez-vous, « Clac ! », le retour.
        'c5_2_collins',
        'c5_2_retrouver',
        'c5_2_simulation',
        'c5_2_radar',
        'c5_2_suite',
        'c5_2_reunis',
        'c5_2_ensemble',
        'c5_2_retour',
        // C5.3 : la panne annoncée comme imaginaire (P12), l'onde, le signal retrouvé.
        'c5_3_imaginaire',
        'c5_3_appel',
        'c5_3_perdu',
        'c5_3_onde',
        'c5_3_recoit',
        'c5_3_frayeur',
        'c5_3_fin_simulation',
        // C5.4 : la rentrée, la vraie coupure radio, les parachutes, l'amerrissage.
        'c5_4_date',
        'c5_4_separation',
        'c5_4_chaud',
        'c5_4_bouclier',
        'c5_4_radio',
        'c5_4_parachutes',
        'c5_4_tout_va_bien',
        'c5_4_recuperation',
        // C5.5 : la fête, la photographie.
        'c5_5_fete',
        'c5_5_photo',
      ]),
    );
    const at = (id: string) => s.voiceLog.indexOf(id);
    expect(at('c5_1_vrai')).toBeLessThan(at('c5_1_envol'));
    // La panne est annoncée comme imaginaire avant qu'elle arrive, et la fin de la simulation est dite.
    expect(at('c5_3_imaginaire')).toBeLessThan(at('c5_3_perdu'));
    expect(at('c5_3_recoit')).toBeLessThan(at('c5_3_fin_simulation'));
    expect(at('c5_4_radio')).toBeLessThan(at('c5_4_parachutes'));
    if (niveau === 'fin') expect(s.voiceLog).toEqual(expect.arrayContaining(['c5_3_consigne_somme', 'gen_etape', 'c5_3_consigne_2']));
    else expect(s.voiceLog).toContain('c5_3_consigne');

    // Le diplôme, lu à voix haute ; sur ordinateur, le bouton « Imprimer » est proposé.
    await page.keyboard.press('Enter'); // « Continuer », sélectionné d'office
    s = await until(page, (st) => st.voiceLog.includes('fin_diplome_fin') && !st.voice && st.focus !== null, 'diplôme', 60_000);
    expect(s.voiceLog).toEqual(expect.arrayContaining(['fin_diplome_titre', 'fin_diplome_texte']));
    await page.keyboard.press('Enter');
    // Le générique défile ; « Continuer » le passe. Puis la scène de Mars, sans seuil d'étoiles.
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter');
    s = await until(page, (st) => st.voiceLog.includes('fin_mars_aventure') && !st.voice && st.focus !== null, 'scène de Mars', 60_000);
    expect(s.voiceLog.indexOf('fin_mars_question')).toBeLessThan(s.voiceLog.indexOf('fin_mars_aventure'));
    await page.keyboard.press('Enter'); // « Retour à l'accueil »
    s = await until(page, (st) => st.scenes.includes('Menu'), 'retour à l’accueil', 30_000);
    expect(s.diag.blocages).toBe(0);
    expect(s.diag.erreurs).toBe(0);
  });
}

test('balance de C5.1 aux flèches : trop lourd, puis la bonne paire ; les objets restent choisis après l’erreur', async ({ page, consoleErrors }) => {
  test.setTimeout(240_000);
  void consoleErrors;
  await open(page, 'vitesse=10&niveau=debut&scene=c5.1');
  let s = await waitAnswer(page, 150_000);
  // 5 kilos de cailloux ; sac 3, bottes 2, appareil 4, pelle 1 (de gauche à droite).
  expect(s.problem!.params).toMatchObject({ target: 5 });
  const card = (i: number) => ({ x: 960 + (i - 1.5) * 250, y: 725 });
  const press = async (i: number, label: string) => {
    await arrowsTo(page, card(i).x, card(i).y, label);
    await page.keyboard.press('Enter');
  };
  // Changer d'avis n'est pas une erreur : la pelle est choisie puis reprise.
  await press(3, 'pelle');
  await press(3, 'pelle');
  await press(0, 'sac');
  await press(2, 'appareil');
  await arrowsTo(page, 1400, 935, 'Valider');
  await page.keyboard.press('Enter');
  // 3 + 4 = 7 : la balance penche du côté des objets, deux kilos de trop.
  s = await until(page, (st) => st.voiceLog.includes('c5_1_lourd'), 'trop lourd', 60_000);
  s = await waitAnswer(page);
  expect(s.problem!.answer).toEqual([2, 3]);
  // Les objets sont restés choisis : on remplace seulement l'appareil par les bottes.
  await press(2, 'appareil');
  await press(1, 'bottes');
  await arrowsTo(page, 1400, 935, 'Valider');
  await page.keyboard.press('Enter');
  s = await until(page, (st) => st.save.run?.records.some((r) => r.challengeId === 'c5_alleger') ?? false, 'balance droite', 60_000);
  expect(s.save.run!.records.find((r) => r.challengeId === 'c5_alleger')).toMatchObject({ errors: 1 });
  expect(s.voiceLog).toEqual(expect.arrayContaining(['tuto_objets', 'c5_1_aide_1_poids']));
  expect(s.voiceLog.some((id) => id.startsWith('c5_1_equilibre'))).toBe(true);
  expect(s.diag.erreurs).toBe(0);
});

test('radar de C5.2 aux touches chiffres : pas plus près, trop grand bond, trop petit bond, puis la bonne mesure', async ({ page, consoleErrors }) => {
  test.setTimeout(240_000);
  void consoleErrors;
  await open(page, 'vitesse=10&niveau=fin&scene=c5.2');
  let s = await waitAnswer(page, 150_000);
  // 50, 40, 30… puis 20.
  expect(s.problem!.params).toEqual({ start: 50, step: 10 });
  const tryNumber = async (digits: string) => {
    await waitAnswer(page);
    for (const d of digits) await page.keyboard.press(`Digit${d}`);
    await arrowsTo(page, 1500, 935, 'Valider');
    await page.keyboard.press('Enter');
  };
  await tryNumber('40');
  await until(page, (st) => st.voiceLog.includes('c5_2_eloigne'), 'pas plus près', 60_000);
  await tryNumber('10');
  await until(page, (st) => st.voiceLog.includes('c5_2_grand_bond'), 'trop grand bond', 60_000);
  await tryNumber('25');
  await until(page, (st) => st.voiceLog.includes('c5_2_petit_bond'), 'trop petit bond', 90_000);
  await tryNumber('20');
  s = await until(page, (st) => st.save.run?.records.some((r) => r.challengeId === 'c5_radar') ?? false, 'bonne mesure', 90_000);
  expect(s.save.run!.records.find((r) => r.challengeId === 'c5_radar')).toMatchObject({ errors: 3 });
  // Après chaque erreur, l'aide monte d'un cran : relire les mesures, voir les bonds, compter à rebours.
  expect(s.voiceLog).toEqual(expect.arrayContaining(['c5_2_aide_1_radar', 'c5_2_aide_2_radar', 'gen_compter']));
  expect(s.voiceLog.some((id) => id.startsWith('c5_2_proche'))).toBe(true);
  expect(s.diag.erreurs).toBe(0);
});

test('pour les parents : la note se lit page par page, le prénom s’inscrit sur le diplôme', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await open(page, 'vitesse=8');
  await until(page, (s) => s.scenes.includes('Title'), 'accueil');
  await page.keyboard.press('Space');
  await until(page, (s) => s.scenes.includes('Menu'), 'menu');
  await arrowsTo(page, 1700, 1010, 'Pour les parents');
  let s = await until(page, (st) => st.voiceLog.includes('menu_parents'), 'bouton lu');
  await page.keyboard.press('Enter');
  // « Suivante » est sélectionnée d'office : on va jusqu'à la dernière page (les sources).
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
  }
  page.once('dialog', (d) => void d.accept('Lou'));
  await arrowsTo(page, 1150, 960, 'Prénom pour le diplôme');
  await page.keyboard.press('Enter');
  s = await until(page, (st) => st.save.settings.firstName === 'Lou', 'prénom enregistré');
  expect(s.diag.erreurs).toBe(0);
});

test('du bilan du chapitre 4, « Continuer » ouvre le chapitre 5', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await open(page, 'vitesse=10&niveau=debut&scene=c4.5');
  await mg(page, 'bilan');
  let s = await until(page, (st) => st.voiceLog.includes('bilan_suite') && !st.voice && st.focus !== null, 'bilan du chapitre 4', 60_000);
  expect(s.save.run?.chapterId).toBe('c5');
  await page.keyboard.press('Enter');
  s = await until(page, (st) => st.scene === 'c5.1', 'début du chapitre 5');
  expect(s.save.run?.sceneIndex).toBe(0);
  s = await state(page);
  expect(s.diag.erreurs).toBe(0);
});

/** Textes visibles d'une scène. */
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

for (const avec of [true, false]) {
  test(`C5.5 ${avec ? 'avec' : 'sans'} la photographie d’archive${avec ? '' : ' (droits en attente : hors du dépôt), le Narrateur parle sur la fête'}`, async ({ page }) => {
    test.setTimeout(120_000);
    // Pas de fixture consoleErrors : le chargement refusé de la photographie est signalé dans la console.
    await page.route('**/audio/manifest.json', (r) => r.fulfill({ json: {} }));
    // La photographie n'est pas dans le dépôt : en CI, le build ne la contient pas (seul le cas « sans » est joué).
    test.skip(avec && !existsSync('src/assets/images/photos/photo_margaret.jpg'), 'photographie absente de ce poste');
    if (!avec) await page.route('**/photo_margaret*', (r) => r.abort());
    await open(page, 'vitesse=10&niveau=milieu&scene=c5.5');
    await until(page, (st) => st.voice?.id === 'c5_5_photo', 'réplique de la photographie', 60_000);
    const shown = await texts(page, 'Story');
    expect(shown.some((t) => t.includes('Margaret Hamilton avec les listings'))).toBe(avec);
    expect(shown.some((t) => t.startsWith('Photo : Draper Laboratory'))).toBe(avec);
    const s = await until(page, (st) => st.scenes.includes('Finale'), 'fin de la mission', 60_000);
    expect(s.voiceLog).toEqual(expect.arrayContaining(['c5_5_fete', 'c5_5_photo']));
    expect(s.diag.erreurs).toBe(0);
    expect(s.diag.blocages).toBe(0);
  });
}
