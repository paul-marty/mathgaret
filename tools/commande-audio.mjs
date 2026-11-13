#!/usr/bin/env node
/**
 * Écrit la commande des voix : docs/audio/commande-voix.csv, la liste exacte des fichiers audio à produire,
 * tirée de src/content/lines.json (la seule source des textes). À relancer quand une réplique change :
 *   npm run commande-audio
 *
 * Sortes de fichiers de voix (tous dans public/audio/voix/) :
 * - réplique sans nombre : <id>.mp3 ;
 * - réplique avec des nombres : un fichier par morceau de texte entre les nombres,
 *   <id>__1.mp3, <id>__2.mp3… Le jeu enchaîne morceaux et nombres (même découpage que src/audio/segments.ts) ;
 * - réplique du narrateur avec un nombre (peu de valeurs possibles) : un fichier par valeur, <id>__n-3.mp3 ;
 * - nombres lus seuls, par la voix du Collègue : nombre_0.mp3 … nombre_100.mp3.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { lines, speakers } = JSON.parse(readFileSync(resolve(root, 'src/content/lines.json'), 'utf8'));

// Titres des chapitres (src/chapters/plan.ts), pour « Chapitre {n} : {titre} ».
const plan = readFileSync(resolve(root, 'src/chapters/plan.ts'), 'utf8');
const titles = [...plan.matchAll(/title:\s*'([^']*)'/g)].map((m) => m[1].replace(/’/g, "'"));

/** Même découpage que src/audio/segments.ts. */
function segments(text) {
  return text
    .split(/\{\w+\}/)
    .map((p) => p.replace(/^[\s.,;:!?…—–]+/, '').trim())
    .filter((p) => p !== '');
}

/** Nombres en toutes lettres (0 à 100), pour qu'ElevenLabs ne lise pas « numéro 7 » ou « 7 euros ». */
function enLettres(n) {
  const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
  const D = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };
  if (n <= 16) return U[n];
  if (n < 20) return `dix-${U[n - 10]}`;
  if (n === 100) return 'cent';
  if (n === 80) return 'quatre-vingts';
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 7) return n === 71 ? 'soixante et onze' : `soixante-${enLettres(n - 60)}`;
  if (d >= 8) return `quatre-vingt-${enLettres(n - 80)}`;
  if (u === 0) return D[d];
  return u === 1 ? `${D[d]} et un` : `${D[d]}-${U[u]}`;
}

/** Répliques du narrateur dites en entier pour chaque valeur (peu de valeurs possibles). */
const WHOLE = {
  // « une sur cinq » : il s'agit d'étoiles.
  bilan_efficacite: [0, 1, 2, 3, 4, 5].map((n) => ({ vars: { n: n === 1 ? 'une' : enLettres(n) }, suffix: `n-${n}` })),
  rejeu_chapitre: titles.map((titre, i) => ({ vars: { n: enLettres(i + 1), titre }, suffix: `n-${i + 1}` })),
};

/** Indication de jeu pour la voix, d'après la nature de la réplique. */
function ton(id, speaker) {
  if (speaker === 'houston') return 'contrôleur de mission : calme, posé, chaleureux, articulé (le jeu ajoute lui-même l’effet radio)';
  if (speaker === 'lauren') return 'petite fille de 4 ans, un peu penaude, sincère, voix douce';
  if (/^(menu|cfg|hud)_|^bilan_(continuer|pause)$/.test(id)) return 'nom de bouton : court, clair, simple, sans emphase';
  if (id === 'rejeu_chapitre') return 'titre de chapitre : posé, petite pause après le numéro';
  if (/_(ohnon|direction)$/.test(id)) return 'surpris, un peu inquiet, jamais effrayant';
  if (/succes|bravo|correction|fonctionne|^ms_bip$|^gen_etape$|^bilan_mission$/.test(id)) return 'joyeux et fier de l’enfant, sans crier';
  if (/_(peu|trop|court|long)(_1)?$|erreur/.test(id)) return 'doux et rassurant : on regarde ensemble, jamais déçu ni moqueur';
  if (/aide|^gen_compter$|^gen_reecoute/.test(id)) return 'patient, un peu plus lent, comme en montrant du doigt';
  if (/^tuto_/.test(id)) return 'explique simplement un bouton, rassurant';
  if (/consigne|^c2_3_(plein|radio|etoiles|freinage)$|^c2_1_liste$/.test(id)) return 'consigne de problème : très clair, posé, vraie question à la fin';
  if (/^ms_/.test(id)) return 'amusé, léger';
  if (speaker === 'narrateur') return 'conteur : chaleureux, posé, un soupçon de mystère';
  if (speaker === 'margaret') return 'calme, sûre d’elle, bienveillante';
  return 'chaleureux, enthousiaste, naturel';
}

const lotOf = (scene) => (/^C2/.test(scene) ? 2 : 1);
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
const example = (text) => fill(text, { n: 7, k: 3, answer: 5, total: 8, minus: 3, deja: 5, stop: 4, a: 5, b: 3, target: 6, from: 2, to: 6 });

const rows = [];
for (const [id, l] of Object.entries(lines)) {
  const who = speakers[l.speaker]?.name ?? l.speaker;
  const base = { lot: lotOf(l.scene ?? ''), personnage: who, scene: l.scene ?? '', ton: ton(id, l.speaker) };
  if (!l.text.includes('{')) {
    rows.push({ ...base, fichier: `${id}.mp3`, texte: l.text, phrase: '', remarque: '' });
  } else if (WHOLE[id]) {
    for (const w of WHOLE[id]) {
      const texte = fill(l.text, w.vars).replace(/\b\d{1,2}\b/g, (d) => enLettres(Number(d)));
      rows.push({ ...base, fichier: `${id}__${w.suffix}.mp3`, texte, phrase: '', remarque: '' });
    }
  } else {
    const segs = segments(l.text);
    segs.forEach((s, i) =>
      rows.push({
        ...base,
        fichier: `${id}__${i + 1}.mp3`,
        texte: s,
        phrase: example(l.text),
        remarque: `morceau ${i + 1} sur ${segs.length} : le jeu place les nombres entre les morceaux`,
      }),
    );
  }
}
for (let n = 0; n <= 100; n++) {
  rows.push({
    lot: 3,
    fichier: `nombre_${n}.mp3`,
    personnage: speakers.collegue.name,
    texte: enLettres(n),
    phrase: '',
    scene: 'nombres',
    ton: 'nombre seul : intonation neutre, ni question ni fin de phrase',
    remarque: `le nombre ${n}`,
  });
}
rows.sort((x, y) => x.lot - y.lot);

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const head = ['lot', 'fichier', 'personnage', 'texte_a_dire', 'ton', 'phrase_complete_exemple', 'scene', 'remarque'];
const csv = [head.join(';'), ...rows.map((r) => [r.lot, r.fichier, r.personnage, r.texte, r.ton, r.phrase, r.scene, r.remarque].map(q).join(';'))].join('\n');
mkdirSync(resolve(root, 'docs/audio'), { recursive: true });
writeFileSync(resolve(root, 'docs/audio/commande-voix.csv'), '﻿' + csv + '\n');

const byLot = rows.reduce((m, r) => ((m[r.lot] = (m[r.lot] ?? 0) + 1), m), {});
const chars = (lot) => rows.filter((r) => r.lot === lot).reduce((s, r) => s + r.texte.length, 0);
console.log(`✓ docs/audio/commande-voix.csv : ${rows.length} fichiers`);
for (const lot of [1, 2, 3]) console.log(`  lot ${lot} : ${byLot[lot]} fichiers, ${chars(lot)} caractères`);
