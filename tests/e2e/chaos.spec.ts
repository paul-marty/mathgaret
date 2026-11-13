import { test as baseTest } from '@playwright/test';
import { expect, FAST, test, until, waitAnswer, type GameState } from './helpers';

/**
 * Fiabilité du scénario : le chapitre 1 doit toujours aller jusqu'au bilan, même quand
 * - la synthèse vocale du navigateur se comporte mal (fin ou début jamais signalés, phrase ignorée,
 *   phrase qui ne finit jamais, erreurs, démarrage tardif) ;
 * - l'enfant appuie n'importe où, n'importe quand (touches, clics, Retour) ;
 * - l'application passe brièvement en arrière-plan.
 *
 * Deux graines par défaut ; `CHAOS=10 npx playwright test chaos` en essaie dix.
 */

/** Remplace speechSynthesis par une imitation capricieuse (tirages reproductibles). Exécuté dans la page. */
function capriciousSpeech(seed: number): void {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const moods: [string, number][] = [
    ['normale', 0.5],
    ['sans-fin', 0.13],
    ['sans-debut', 0.08],
    ['ignoree', 0.07],
    ['erreur', 0.06],
    ['coupee', 0.06],
    ['figee', 0.03],
    ['tardive', 0.07],
  ];
  const pickMood = () => {
    let r = rnd();
    for (const [m, p] of moods) if ((r -= p) < 0) return m;
    return 'normale';
  };
  type U = {
    text: string;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((e: { error: string }) => void) | null;
  };
  const stats: Record<string, number> = {};
  let current: { u: U; timers: number[] } | null = null;
  const synth = {
    speaking: false,
    pending: false,
    paused: false,
    getVoices: () => [],
    addEventListener: () => undefined,
    resume() {
      this.paused = false;
    },
    pause() {
      this.paused = true;
    },
    cancel() {
      if (!current) return;
      const { u, timers } = current;
      for (const t of timers) clearTimeout(t);
      current = null;
      synth.speaking = false;
      // Comme Chrome : la phrase annulée reçoit une erreur « interrupted », après coup.
      setTimeout(() => u.onerror?.({ error: 'interrupted' }), 5);
    },
    speak(u: U) {
      synth.cancel();
      const w = window as unknown as { __forceMood?: string; __fakeEnds: number[] };
      const mood = w.__forceMood ?? pickMood();
      stats[mood] = (stats[mood] ?? 0) + 1;
      const timers: number[] = [];
      current = { u, timers };
      const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
      const len = 80 + u.text.length * 4;
      const start = mood === 'tardive' ? 1200 + rnd() * 1800 : 20 + rnd() * 150;
      const end = () => {
        synth.speaking = false;
        current = null;
        w.__fakeEnds.push(performance.now());
      };
      switch (mood) {
        case 'ignoree':
          break;
        case 'erreur':
          at(40, () => {
            end();
            u.onerror?.({ error: 'synthesis-failed' });
          });
          break;
        case 'figee':
          at(start, () => {
            synth.speaking = true;
            u.onstart?.();
          });
          break;
        default:
          at(start, () => {
            synth.speaking = true;
            if (mood !== 'sans-debut') u.onstart?.();
          });
          at(start + len, () => {
            end();
            if (mood === 'coupee') u.onerror?.({ error: 'interrupted' });
            else if (mood !== 'sans-fin') u.onend?.();
          });
      }
    },
  };
  class FakeUtterance {
    lang = '';
    voice = null;
    pitch = 1;
    rate = 1;
    onstart = null;
    onend = null;
    onerror = null;
    constructor(public text: string) {}
  }
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true });
  (window as unknown as { __speechStats: typeof stats }).__speechStats = stats;
  (window as unknown as { __fakeEnds: number[] }).__fakeEnds = [];
}

/**
 * Chaque caprice, mesuré en temps réel (vitesse normale du jeu) : durée totale d'une réplique courte
 * (« Allume ton poste de travail ! », environ 0,4 s de voix imitée). Avant la correction, une fin non
 * signalée laissait l'écran immobile une dizaine de secondes (plus de trente pour une longue réplique).
 */
const LIMITS: [string, number][] = [
  ['normale', 700],
  ['sans-debut', 700],
  ['coupee', 700],
  ['sans-fin', 1300], // fin repérée quand le navigateur ne parle plus
  ['erreur', 5000], // nouvelle tentative, puis sous-titre minuté (≈ 3,3 s seul, plus sur une machine chargée)
  ['ignoree', 6500], // rien ne démarre : nouvelle tentative, puis sous-titre minuté
  ['tardive', 7000],
  ['figee', 10_000], // la voix ne s'arrête jamais : plafond de sécurité
];

test('synthèse capricieuse : chaque réplique se termine peu après la fin réelle de la voix', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await page.addInitScript(capriciousSpeech, 1);
  await page.goto('./?debug&renderer=canvas&graine=1');
  await until(page, (s) => s.scenes.includes('Title'), 'accueil', 30_000);
  const measured: Record<string, number> = {};
  for (const [mood] of LIMITS) {
    measured[mood] = await page.evaluate(async (m) => {
      const w = window as unknown as {
        __forceMood?: string;
        __mathgaret: { services: { voice: { say: (id: string) => Promise<void> } } };
      };
      w.__forceMood = m;
      const t = performance.now();
      await w.__mathgaret.services.voice.say('c1_1_poste');
      return Math.round(performance.now() - t);
    }, mood);
  }
  console.log('durées (ms)', JSON.stringify(measured));
  test.info().annotations.push({ type: 'durées (ms)', description: JSON.stringify(measured) });
  for (const [mood, max] of LIMITS) expect(measured[mood], `réplique « ${mood} »`).toBeLessThan(max);
});

const runs = Number(process.env.CHAOS ?? 2);
const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Enter', 'Space', 'Escape', 'Backspace', 'Digit1', 'Digit3', 'Digit7'];

for (let seed = 1; seed <= runs; seed++) {
  test(`chaos ${seed} : synthèse capricieuse et appuis au hasard, le chapitre 1 va jusqu’au bilan`, async ({ page, consoleErrors }) => {
    test.setTimeout(300_000);
    void consoleErrors; // aucune erreur ni aucun avertissement (les blocages sont des avertissements)
    await page.addInitScript(capriciousSpeech, seed);
    const niveau = ['debut', 'milieu', 'fin'][seed % 3];
    await page.goto(`./?debug&renderer=canvas&vitesse=6&graine=${seed}&niveau=${niveau}&scene=c1.1`);
    await until(page, (s) => s.scenes.includes('Story'), 'histoire', 30_000);

    let a = seed * 7919;
    const rnd = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    const box = (await page.locator('canvas').boundingBox())!;
    const read = () => page.evaluate(() => (window as unknown as { __mathgaret: { state: () => GameState } }).__mathgaret.state());
    const t0 = Date.now();
    let s = await read();
    let hidden = false;
    let lastStep = '';
    let stepSince = Date.now();

    while (!s.scenes.includes('Bilan')) {
      expect(Date.now() - t0, `le chapitre doit finir (étape : ${s.diag.step})`).toBeLessThan(270_000);
      const r = rnd();
      if (s.answering && !s.busy && r < 0.35) {
        // Une réponse (parfois fausse) pour avancer.
        await page.evaluate((w) => (window as unknown as { __mathgaret: { solve: (w: boolean) => void } }).__mathgaret.solve(w), rnd() < 0.25);
      } else if (r < 0.65) {
        await page.keyboard.press(KEYS[Math.floor(rnd() * KEYS.length)]);
      } else if (r < 0.9) {
        await page.mouse.click(box.x + rnd() * box.width, box.y + rnd() * box.height);
      } else if (r < 0.94 && !hidden) {
        hidden = true;
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { value: true, configurable: true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
      }
      if (hidden && rnd() < 0.5) {
        hidden = false;
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { value: false, configurable: true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
      }
      await page.waitForTimeout(80 + rnd() * 500);
      s = await read();
      // Un objet à toucher depuis longtemps : l'enfant finit par le toucher.
      if (s.diag.step !== lastStep) {
        lastStep = s.diag.step;
        stepSince = Date.now();
      } else if (s.diag.waiting && Date.now() - stepSince > 4000) await page.keyboard.press('Enter');
    }

    const stats = await page.evaluate(() => (window as unknown as { __speechStats: Record<string, number> }).__speechStats);
    test.info().annotations.push({ type: 'synthèse', description: JSON.stringify(stats) });
    test.info().annotations.push({ type: 'secours', description: `${s.diag.secours.length} filets de sécurité déclenchés` });
    if (process.env.CHAOS_DETAILS) console.log(`chaos ${seed}`, JSON.stringify(stats), '\n  ' + s.diag.secours.join('\n  '));
    expect(s.diag.blocages, 'aucun blocage détecté').toBe(0);
    expect(s.diag.erreurs, 'aucune erreur').toBe(0);
    // Les caprices de la synthèse ont bien été rencontrés… et absorbés.
    expect(s.diag.secours.length).toBeGreaterThan(0);
    expect(s.save.chapters.c1?.missionStar).toBe(true);
  });
}

// Pannes provoquées : le jeu doit s'en remettre seul (les erreurs sont attendues, donc pas de contrôle de la console ici).
baseTest('panne dans une scène : elle reprend depuis son début, puis l’histoire continue', async ({ page }) => {
  await page.goto(`./?${FAST}&vitesse=6&niveau=debut&scene=c1.2`);
  await until(page, (s) => s.scenes.includes('Story'), 'histoire', 30_000);
  // La première consigne provoque une erreur (une seule fois).
  await page.evaluate(() => {
    const voice = (window as unknown as { __mathgaret: { services: { voice: { say: (id: string) => Promise<void> } } } }).__mathgaret.services.voice;
    const original = voice.say.bind(voice);
    let armed = true;
    voice.say = (id: string) => {
      if (armed && id === 'c1_2_consigne') {
        armed = false;
        throw new Error('panne de test');
      }
      return original(id);
    };
  });
  let s = await until(page, (st) => st.diag.erreurs === 1 && st.diag.secours.some((t) => t.includes('reprise depuis son début')), 'reprise de la scène');
  s = await waitAnswer(page);
  expect(s.scene).toBe('c1.2');
  await page.evaluate(() => (window as unknown as { __mathgaret: { solve: () => void } }).__mathgaret.solve());
  await until(page, (st) => (st.save.run?.records.length ?? 0) === 1, 'problème réussi après la reprise');
});

baseTest('erreur pendant une image : le jeu ne se fige pas', async ({ page }) => {
  await page.goto(`./?${FAST}&vitesse=6&niveau=debut&scene=c1.2`);
  await waitAnswer(page);
  const before = await page.evaluate(() => (window as unknown as { __mathgaret: { services: { clock: { now: number } } } }).__mathgaret.services.clock.now);
  await page.evaluate(() => {
    const game = (window as unknown as { __mathgaret: { game: { events: { once: (e: string, fn: () => void) => void } } } }).__mathgaret.game;
    game.events.once('prestep', () => {
      throw new Error('panne de test dans la boucle');
    });
  });
  const s = await until(page, (st) => st.diag.erreurs === 1, 'erreur notée');
  // L'horloge du jeu continue d'avancer : la boucle n'est pas morte.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __mathgaret: { services: { clock: { now: number } } } }).__mathgaret.services.clock.now))
    .toBeGreaterThan(before + 1000);
  expect(s.answering).toBe(true);
});

baseTest('panne en C2.1 après le toucher : la scène reprend avec son décor recréé, l’ordinateur se touche à nouveau', async ({ page }) => {
  await page.goto(`./?${FAST}&vitesse=8&niveau=debut&scene=c2.1`);
  await until(page, (s) => s.scenes.includes('Story'), 'histoire', 30_000);
  await page.evaluate(() => {
    const voice = (window as unknown as { __mathgaret: { services: { voice: { say: (id: string) => Promise<void> } } } }).__mathgaret.services.voice;
    const original = voice.say.bind(voice);
    let armed = true;
    voice.say = (id: string) => {
      if (armed && id === 'c2_1_liste') {
        armed = false;
        throw new Error('panne de test');
      }
      return original(id);
    };
  });
  await until(page, (s) => s.diag.waiting, 'ordinateur à toucher');
  await page.keyboard.press('Enter');
  let s = await until(page, (st) => st.diag.erreurs === 1 && st.diag.secours.some((t) => t.includes('reprise depuis son début')), 'reprise de la scène');
  // Le décor du laboratoire est recréé : l'ordinateur se touche de nouveau, sans nouvelle erreur.
  await until(page, (st) => st.diag.waiting, 'ordinateur à toucher après la reprise');
  await page.keyboard.press('Enter');
  s = await waitAnswer(page);
  expect(s.scene).toBe('c2.1');
  expect(s.diag.erreurs).toBe(1);
});
