import { expect, open, solve, test, until, waitAnswer } from './helpers';

// Les répliques qui reviennent à chaque exercice (effet d'une bonne réponse, félicitations, transition vers
// la variante suivante) changent de formulation : la première fois le texte de base, ensuite des variantes.

test('répliques fréquentes : le texte de base d’abord, puis des variantes, jamais la même deux fois de suite', async ({ page, consoleErrors }) => {
  test.setTimeout(240_000);
  void consoleErrors;
  await open(page, 'vitesse=10&niveau=milieu&scene=c1.2');
  const said: { id: string; variant?: string }[] = [];
  for (let n = 1; n <= 4; n++) {
    await waitAnswer(page, 150_000);
    await solve(page, false);
    const s = await until(page, (st) => (st.save.run?.records.length ?? 0) >= n || st.scenes.includes('Bilan'), `problème ${n}`, 60_000);
    if (s.scenes.includes('Bilan') || !s.budget?.offer) break;
  }
  // Le journal complet des répliques dites (avec la variante choisie).
  const log = await page.evaluate(() =>
    (window as unknown as { __mathgaret: { services: { voice: { log: { id: string; variant?: string; kind: string }[] } } } }).__mathgaret.services.voice.log
      .filter((l) => l.kind === 'line')
      .map((l) => ({ id: l.id, variant: l.variant })),
  );
  said.push(...log);
  const succes = said.filter((l) => l.id === 'c1_2_succes').map((l) => l.variant ?? l.id);
  const bravo = said.filter((l) => l.id === 'gen_bravo_1').map((l) => l.variant ?? l.id);
  expect(succes.length, 'au moins trois problèmes résolus').toBeGreaterThanOrEqual(3);
  // Première fois : la réplique de base.
  expect(succes[0]).toBe('c1_2_succes');
  expect(bravo[0]).toBe('gen_bravo_1');
  // Ensuite : jamais la même deux fois de suite, et au moins une variante entendue.
  for (const list of [succes, bravo]) for (let i = 1; i < list.length; i++) expect(list[i]).not.toBe(list[i - 1]);
  expect([...succes, ...bravo].some((v) => /_v\d$|^gen_bravo_[2-8]$/.test(v))).toBe(true);
});
