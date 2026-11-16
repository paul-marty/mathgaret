import { existsSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { arrowsTo, expect, mg, open, playToBilan, state, test, until, waitAnswer } from './helpers';

// Chapitre 5 « Le grand retour sur Terre » joué de bout en bout aux trois niveaux, puis la fin de la mission
// (bilan de la mission, diplôme, générique, Mars) ; le dépassement de la piste d'orbite (C5.2) aux touches chiffres ;
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
        // C5.1 : Eagle sur la Lune, la liste des vérifications, le départ.
        'c5_1_date',
        'c5_1_rentrer',
        'c5_1_liste',
        'c5_1_consigne',
        'c5_1_pret',
        'c5_1_envol',
        // C5.2 : Collins, la simulation du rapprochement, « Clac ! », le retour.
        'c5_2_collins',
        'c5_2_retrouver',
        'c5_2_simulation',
        'c5_2_consigne',
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

test('piste d’orbite : Eagle dépasse Columbia et reste au-delà, puis la réponse corrigée l’amène au repère', async ({ page, consoleErrors }) => {
  test.setTimeout(240_000);
  void consoleErrors;
  await open(page, 'vitesse=10&niveau=milieu&scene=c5.2');
  let s = await waitAnswer(page, 150_000);
  expect(s.problem!.params).toEqual({ from: 7, to: 12 });
  // 8 cases au lieu de 5 : Eagle va jusqu'à la case 15, trois cases au-delà de Columbia.
  await page.keyboard.press('Digit8');
  await arrowsTo(page, 1400, 935, 'Valider');
  await page.keyboard.press('Enter');
  s = await until(page, (st) => st.voiceLog.includes('c5_2_corriger'), 'dépassement constaté', 60_000);
  expect(s.voiceLog).toContain('c5_2_long');
  s = await waitAnswer(page);
  await page.keyboard.press('Digit5');
  await arrowsTo(page, 1400, 935, 'Valider');
  await page.keyboard.press('Enter');
  s = await until(page, (st) => st.save.run?.records.some((r) => r.challengeId === 'c5_rendezvous') ?? false, 'rendez-vous réussi', 60_000);
  expect(s.save.run!.records.find((r) => r.challengeId === 'c5_rendezvous')).toMatchObject({ errors: 1 });
  expect(s.voiceLog).toContain('c5_2_succes');
  s = await state(page);
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
