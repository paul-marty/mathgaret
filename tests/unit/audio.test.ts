import { describe, expect, it } from 'vitest';
import { keyOf } from '../../tools/manifeste-audio.mjs';
import { trimBounds } from '../../src/audio/assemble';
import { numberValue, PAUSES, segmentTexts, voiceParts } from '../../src/audio/segments';
import { Voice } from '../../src/audio/Voice';
import type { AudioEngine } from '../../src/audio/AudioEngine';
import type { GameClock } from '../../src/core/clock';
import type { Diag } from '../../src/core/diag';
import catalogue from '../../src/content/audio-catalogue.json';
import linesData from '../../src/content/lines.json';

// Documents de travail (docs/ n'est pas publié) : les tests qui les lisent sont sautés s'ils sont absents.
const docs = import.meta.glob<string>('../../docs/audio/*.{csv,md}', { query: '?raw', import: 'default', eager: true });
const csvRaw = docs['../../docs/audio/commande-voix.csv'];
const promptRaw = docs['../../docs/audio/prompt-chatgpt.md'];

const lines: Record<string, { speaker: string; text: string; scene?: string; variante_de?: string }> = linesData.lines;

/** Lignes de docs/audio/commande-voix.csv : fichier → texte à dire. */
function commande(): Map<string, string> {
  const map = new Map<string, string>();
  const csv = csvRaw.replace(/^﻿/, '');
  for (const line of csv.split('\n').slice(1)) {
    const m = /^"\d+";"([^"]+)";"[^"]*";"((?:[^"]|"")*)"/.exec(line);
    if (m) map.set(m[1], m[2].replace(/""/g, '"'));
  }
  return map;
}

describe('répliques à nombres en morceaux', () => {
  it('enchaîne morceaux et nombres, avec une pause plus longue entre deux phrases', () => {
    const parts = voiceParts('c1_2_consigne', lines.c1_2_consigne.text, { total: 8, deja: 5 });
    expect(parts).toEqual([
      { key: 'c1_2_consigne#1', pauseBefore: 0 },
      { key: 'nombre_8', pauseBefore: PAUSES.mot },
      { key: 'c1_2_consigne#2', pauseBefore: PAUSES.mot },
      { key: 'nombre_5', pauseBefore: PAUSES.mot },
      { key: 'c1_2_consigne#3', pauseBefore: PAUSES.phrase },
    ]);
  });

  it('une réplique qui commence par un nombre, avec des virgules', () => {
    const parts = voiceParts('c2_3_aide_4_plein', lines.c2_3_aide_4_plein.text, { a: 5, b: 3, answer: 8 });
    expect(parts?.map((p) => p.key)).toEqual([
      'nombre_5',
      'c2_3_aide_4_plein#1',
      'nombre_3',
      'c2_3_aide_4_plein#2',
      'nombre_8',
      'c2_3_aide_4_plein#3',
      'nombre_8',
      'c2_3_aide_4_plein#4',
    ]);
    expect(parts?.map((p) => p.pauseBefore)).toEqual([0, PAUSES.mot, PAUSES.mot, PAUSES.virgule, PAUSES.mot, PAUSES.phrase, PAUSES.mot, PAUSES.virgule]);
  });

  it('rien à assembler si une valeur n’est pas un nombre de 0 à 100', () => {
    expect(voiceParts('c1_2_trop', lines.c1_2_trop.text, { n: 120, k: 2 })).toBeNull();
    expect(voiceParts('c1_2_trop', lines.c1_2_trop.text, { n: 'beaucoup', k: 2 })).toBeNull();
    expect(numberValue('07')).toBe(7);
    expect(numberValue(2.5)).toBeNull();
  });

  it.skipIf(!csvRaw)('la commande (docs/audio/commande-voix.csv) est à jour : sinon, lancer npm run commande-audio', () => {
    const files = commande();
    const whole = ['bilan_efficacite', 'rejeu_chapitre'];
    for (const [id, line] of Object.entries(lines)) {
      if (!line.text.includes('{')) {
        expect(files.get(`${id}.mp3`), id).toBe(line.text);
      } else if (whole.includes(id)) {
        expect([...files.keys()].some((f) => f.startsWith(`${id}__n-`)), id).toBe(true);
      } else {
        const segs = segmentTexts(line.text);
        const ones = Object.fromEntries([...line.text.matchAll(/\{(\w+)\}/g)].map((m) => [m[1], 1]));
        const keys = voiceParts(id, line.text, ones)!.filter((p) => p.key.includes('#'));
        expect(keys.map((p) => p.key), id).toEqual(segs.map((_, i) => `${id}#${i + 1}`));
        segs.forEach((s, i) => expect(files.get(`${id}__${i + 1}.mp3`), `${id}__${i + 1}`).toBe(s));
      }
    }
    for (let n = 0; n <= 100; n++) expect(files.has(`nombre_${n}.mp3`)).toBe(true);
    expect(files.get('nombre_71.mp3')).toBe('soixante et onze');
    expect(files.get('nombre_80.mp3')).toBe('quatre-vingts');
    expect(files.get('nombre_91.mp3')).toBe('quatre-vingt-onze');
    expect(files.get('bilan_efficacite__n-1.mp3')).toBe("Et voici tes étoiles d'efficacité : une sur cinq.");
    // Chaque fichier commandé a un nom que le manifeste reconnaît.
    for (const f of files.keys()) expect(keyOf(f.replace(/\.mp3$/, '')), f).not.toBeNull();
  });
});

describe('manifeste audio', () => {
  it('reconnaît les noms de fichiers livrés', () => {
    expect(keyOf('c1_1_intro')).toBe('c1_1_intro');
    expect(keyOf('c1_2_consigne__2')).toBe('c1_2_consigne#2');
    expect(keyOf('bilan_efficacite__n-3')).toBe('bilan_efficacite|n=3');
    expect(keyOf('c1_2_consigne__total-6__deja-2')).toBe('c1_2_consigne|deja=2|total=6');
    expect(keyOf('nombre_07')).toBe('nombre_7');
    expect(keyOf('c1 intro')).toBeNull();
    expect(keyOf('c1_2_consigne__deux')).toBeNull();
  });

  it('la voix choisit le fichier entier, sinon les morceaux, sinon rien (synthèse)', () => {
    const voice = new Voice({} as AudioEngine, {} as GameClock, {} as Diag, true);
    voice.files = {
      'rejeu_chapitre|n=2': 'u/rejeu2',
      c1_1_intro: 'u/intro',
      'c1_2_trop|k=2|n=9': 'u/trop-9-2',
      'c1_2_trop#1': 'u/t1',
      'c1_2_trop#2': 'u/t2',
      'c1_2_trop#3': 'u/t3',
      nombre_9: 'u/9',
      nombre_3: 'u/3',
    };
    expect(voice.clipsFor('rejeu_chapitre', lines.rejeu_chapitre.text, { n: 2, titre: 'L’ordinateur d’Apollo' })?.map((c) => c.url)).toEqual(['u/rejeu2']);
    expect(voice.clipsFor('c1_1_intro', lines.c1_1_intro.text)?.map((c) => c.url)).toEqual(['u/intro']);
    expect(voice.clipsFor('c1_2_trop', lines.c1_2_trop.text, { n: 9, k: 2 })?.map((c) => c.url)).toEqual(['u/trop-9-2']);
    expect(voice.clipsFor('c1_2_trop', lines.c1_2_trop.text, { n: 9, k: 3 })?.map((c) => c.url)).toEqual(['u/t1', 'u/9', 'u/t2', 'u/3', 'u/t3']);
    // Un nombre manque : toute la réplique passe par la synthèse (pas de trou au milieu).
    expect(voice.clipsFor('c1_2_trop', lines.c1_2_trop.text, { n: 9, k: 4 })).toBeUndefined();
  });

  it('variantes : le texte de base d’abord, puis au hasard sans répétition, sans mélanger fichier livré et synthèse', () => {
    const voice = new Voice({} as AudioEngine, {} as GameClock, {} as Diag, true);
    const group = ['gen_bravo_1', ...Object.keys(lines).filter((id) => lines[id].variante_de === 'gen_bravo_1')];
    expect(group.length).toBeGreaterThanOrEqual(6);
    // Rien de livré : toutes les variantes sont possibles.
    expect(voice.chooseVariant('gen_bravo_1')).toBe('gen_bravo_1');
    const seen = new Set<string>();
    let last = 'gen_bravo_1';
    for (let i = 0; i < 200; i++) {
      const v = voice.chooseVariant('gen_bravo_1');
      expect(group).toContain(v);
      expect(v).not.toBe(last);
      seen.add(v);
      last = v;
    }
    expect(seen.size).toBe(group.length);
    // Une réplique sans variante reste elle-même.
    expect(voice.chooseVariant('c1_1_intro')).toBe('c1_1_intro');

    // La base et une seule variante livrées : on alterne entre les deux, jamais la synthèse.
    const v2 = new Voice({} as AudioEngine, {} as GameClock, {} as Diag, true);
    v2.files = { gen_bravo_1: 'u/b1', gen_bravo_2: 'u/b2' };
    const said = Array.from({ length: 6 }, () => v2.chooseVariant('gen_bravo_1'));
    expect(said).toEqual(['gen_bravo_1', 'gen_bravo_2', 'gen_bravo_1', 'gen_bravo_2', 'gen_bravo_1', 'gen_bravo_2']);
  });

  it('un morceau identique déjà enregistré (même voix, même texte) sert aux autres répliques', () => {
    const voice = new Voice({} as AudioEngine, {} as GameClock, {} as Diag, true);
    // « Il en reste {answer}. Choisis {answer}, puis appuie sur la grande coche. » : les trois morceaux du chapitre 2.
    voice.files = { 'c2_1_aide_4#1': 'u/reste', 'c2_1_aide_4#2': 'u/choisis', 'c2_1_aide_4#3': 'u/coche', nombre_4: 'u/4' };
    expect(lines.c5_1_aide_4.text).toBe(lines.c2_1_aide_4.text);
    expect(voice.clipsFor('c5_1_aide_4', lines.c5_1_aide_4.text, { answer: 4 })?.map((c) => c.url)).toEqual(['u/reste', 'u/4', 'u/choisis', 'u/4', 'u/coche']);
    // Le fichier propre à la réplique, s'il est livré, passe avant.
    voice.files['c5_1_aide_4#3'] = 'u/coche-c5';
    expect(voice.clipsFor('c5_1_aide_4', lines.c5_1_aide_4.text, { answer: 4 })?.at(-1)?.url).toBe('u/coche-c5');
    // Pas d'échange entre personnages ni entre réplique entière et morceau.
    expect(voice.fileFor('menu_continuer')).toBeUndefined();
    voice.files.menu_continuer = 'u/continuer';
    expect(voice.fileFor('fin_continuer')).toBe('u/continuer');
    expect(voice.fileFor('c3_2_aide_1#1')).toBeUndefined();
  });

  it('chaque variante a la voix et la scène de sa réplique de base, sans nombre', () => {
    for (const [id, l] of Object.entries(lines)) {
      if (!l.variante_de) continue;
      const base = lines[l.variante_de];
      expect(base, id).toBeDefined();
      expect(base.variante_de, `${id} : la base n'est pas elle-même une variante`).toBeUndefined();
      expect(l.speaker, id).toBe(base.speaker);
      expect(l.scene, id).toBe(base.scene);
      expect(l.text.includes('{'), id).toBe(base.text.includes('{'));
    }
  });

  it.skipIf(!promptRaw)('chaque bruitage et chaque musique du catalogue figure dans la commande à ChatGPT', () => {
    const prompt = promptRaw;
    for (const s of Object.keys(catalogue.sons)) expect(prompt, s).toContain(`sons/${s}.mp3`);
    for (const m of Object.keys(catalogue.musiques)) expect(prompt, m).toContain(`musique/${m}.mp3`);
  });
});

describe('assemblage', () => {
  it('retire le silence aux deux bouts en gardant une petite marge', () => {
    const rate = 1000;
    const data = new Float32Array(1000);
    for (let i = 300; i < 600; i++) data[i] = 0.5;
    const [s, e] = trimBounds(data, rate);
    expect(s).toBe(300 - 12);
    expect(e).toBe(600 + 40);
    expect(trimBounds(new Float32Array(50), rate)).toEqual([0, 50]);
  });
});
