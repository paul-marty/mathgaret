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
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
/** Indications propres au chapitre 4 (moments historiques). */
const TON_C4 = {
  c4_2_alarme: 'astronaute à la radio : calme et précis, une légère tension contenue (le jeu ajoute lui-même l’effet radio)',
  c4_4_pose: 'astronaute à la radio : calme, posé, émotion retenue, moment historique (le jeu ajoute lui-même l’effet radio)',
  c4_2_trop_travail: 'surpris, inquiet, jamais effrayant',
  c4_4_allez: 'murmure, retient son souffle, plein d’espoir',
  c4_4_reussi: 'explosion de joie, émerveillé, sans crier trop fort',
  c4_4_lune: 'émerveillée, joyeuse, un peu émue',
  c4_4_plus_tard: 'conteur : doux, lent, une petite pause à la fin',
  c4_5_pas: 'conteur : émerveillé, lent, solennel et doux',
  c4_5_aldrin: 'conteur : émerveillé, lent, doux',
  c4_5_mission: 'complice et sérieux, à voix posée, avec une petite pause avant « mais »',
};

/** Indications propres au chapitre 5 et à la fin de la mission. */
const TON_C5 = {
  c5_1_pret: 'astronaute à la radio : joyeux, sûr de lui, prêt à partir (le jeu ajoute lui-même l’effet radio)',
  c5_3_appel: 'astronaute à la radio : appel inquiet qui se répète, la voix se perd à la fin (le jeu ajoute l’effet radio)',
  c5_3_recoit: 'astronaute à la radio : grand soulagement, chaleureux (le jeu ajoute l’effet radio)',
  c5_4_tout_va_bien: 'astronaute à la radio : soulagé, joyeux, simple (le jeu ajoute l’effet radio)',
  c5_3_perdu: 'surpris, un peu inquiet, jamais effrayant',
  c5_3_imaginaire: 'complice : on joue à faire semblant, rassurant',
  c5_3_soupir: 'un grand soupir de soulagement, à peine un mot',
  c5_3_frayeur: 'rit de soulagement, complice',
  c5_3_fin_simulation: 'conteur : rassurant, clair, on revient au vrai voyage',
  c5_4_chaud: 'impressionné, un peu inquiet, jamais effrayant',
  c5_4_bouclier: 'rassurant, posé',
  c5_4_radio: 'conteur : grave et calme, un peu de suspense',
  c5_4_parachutes: 'explosion de joie, émerveillé',
  c5_5_fete: 'très ému et joyeux, fier de l’équipe, avec une petite pause avant « et à revenir sur Terre »',
  c5_5_photo: 'conteur : posé, respectueux, chaleureux, sans emphase',
  fin_accomplie: 'annonce joyeuse et solennelle',
  fin_bravo: 'conteur : chaleureux, fier de l’enfant, posé',
  fin_diplome_titre: 'annonce solennelle et joyeuse',
  fin_diplome_texte: 'conteur : fier, chaleureux',
  fin_diplome_fin: 'joyeux et fier, sans crier',
  fin_mars_question: 'chuchoté, rêveur, plein d’émerveillement',
  fin_mars_aventure: 'conteur : rêveur, lent, une porte ouverte sur l’imagination',
  c5_1_cailloux: 'surpris, un peu inquiet, jamais effrayant',
  c5_2_radar: 'explique simplement, posé, avec curiosité',
};

function ton(id, speaker) {
  if (TON_C4[id]) return TON_C4[id];
  if (TON_C5[id]) return TON_C5[id];
  if (speaker === 'houston') return 'contrôleur de mission : calme, posé, chaleureux, articulé (le jeu ajoute lui-même l’effet radio)';
  if (speaker === 'lauren') return 'petite fille de 4 ans, un peu penaude, sincère, voix douce';
  if (/^(menu|cfg|hud|parents)_|^bilan_(continuer|pause)$|^fin_(continuer|imprimer|accueil)$/.test(id)) return 'nom de bouton : court, clair, simple, sans emphase';
  if (id === 'rejeu_chapitre') return 'titre de chapitre : posé, petite pause après le numéro';
  if (/_(ohnon|direction)$/.test(id)) return 'surpris, un peu inquiet, jamais effrayant';
  if (/succes|bravo|correction|fonctionne|valide|^ms_bip$|^gen_etape$|^bilan_mission$|^fin_progres_|^c5_2_reunis$|^c5_1_equilibre|^c5_2_proche/.test(id)) return 'joyeux et fier de l’enfant, sans crier';
  if (/_(peu|trop|court|long|rien|leger|lourd)(_1)?$|erreur|^c4_3_(deborde|tient)$|^c5_2_(eloigne|grand_bond|petit_bond)$/.test(id)) return 'doux et rassurant : on regarde ensemble, jamais déçu ni moqueur';
  if (/aide|^gen_compter$|^gen_reecoute/.test(id)) return 'patient, un peu plus lent, comme en montrant du doigt';
  if (/^tuto_/.test(id)) return 'explique simplement un bouton, rassurant';
  if (/consigne|^c2_3_(plein|radio|etoiles|freinage)$|^c2_1_liste$|^c4_3_choix_|^c5_1_poids$|^c5_2_suite$/.test(id)) return 'consigne de problème : très clair, posé, vraie question à la fin';
  if (/^ms_/.test(id)) return 'amusé, léger';
  if (speaker === 'narrateur') return 'conteur : chaleureux, posé, un soupçon de mystère';
  if (speaker === 'margaret') return 'calme, sûre d’elle, bienveillante';
  return 'chaleureux, enthousiaste, naturel';
}

const lotOf = (scene) => (/^C5/.test(scene) ? 6 : /^C4/.test(scene) ? 5 : /^C3/.test(scene) ? 4 : /^C2/.test(scene) ? 2 : 1);
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
/**
 * Phrase complète d'exemple pour les répliques en morceaux : seule l'intonation compte, mais les nombres
 * restent cohérents entre eux (8 − 3 = 5, 5 + 3 = 8, une erreur d'une ou deux unités de part ou d'autre).
 */
function example(id, text) {
  const v = { total: 8, minus: 3, deja: 3, answer: 5, a: 5, b: 3, from: 2, to: 7, target: 5, cap: 8, units: 3, free: 8, n: 3, k: 2, stop: 9 };
  if (/plein|somme/.test(id)) v.answer = v.a + v.b;
  // Radar (C5.2) : 10, 8, 6, puis 4 ; une erreur trop loin (7), trop près (2), pas assez près (5).
  if (/^c5_2_/.test(id)) {
    Object.assign(v, { a: 10, b: 8, c: 6, step: 2, answer: 4 });
    v.n = /eloigne/.test(id) ? 7 : /grand_bond/.test(id) ? 2 : 5;
    return fill(text, v);
  }
  // Alléger Eagle (C5.1) : 5 kilos de cailloux, 3 + 2 ; l'aide pose l'objet de 3 kilos.
  if (/^c5_1_/.test(id)) {
    Object.assign(v, { target: 5, a: 3, b: 2 });
    return fill(text, v);
  }
  const k = /_1$/.test(id) ? 1 : 2;
  if (/^c4_1_/.test(id)) {
    // Jauge : n est l'énergie qui resterait d'après l'enfant, k ce que le contrôle aurait alors pris.
    if (/_rien$/.test(id)) v.n = v.total;
    else if (/_peu_1$/.test(id)) v.n = v.total - 1;
    else if (/_peu$/.test(id)) v.n = v.answer + 1;
    else if (/_trop$/.test(id)) v.n = v.answer - 2;
    v.k = v.total - v.n;
  } else if (/_(peu|court)|trop_peu/.test(id)) {
    // Réponse trop petite.
    Object.assign(v, { k, n: v.answer - k, stop: v.from + v.answer - k });
  } else if (/_(trop|long)/.test(id)) {
    // Réponse trop grande.
    Object.assign(v, { k, n: v.answer + k, stop: v.from + v.answer + k });
  } else if (/erreur/.test(id)) v.n = v.answer + 1;
  return fill(text, v);
}

const rows = [];
for (const [id, l] of Object.entries(lines)) {
  const who = speakers[l.speaker]?.name ?? l.speaker;
  // Une variante se dit sur le ton de sa réplique de base (répliques qui reviennent souvent).
  const base = { lot: lotOf(l.scene ?? ''), personnage: who, scene: l.scene ?? '', ton: ton(l.variante_de ?? id, l.speaker), variante: Boolean(l.variante_de) };
  if (!l.text.includes('{')) {
    const remarque = l.variante_de ? `variante de ${l.variante_de} (« ${lines[l.variante_de].text} ») : le jeu choisit au hasard, même ton` : '';
    rows.push({ ...base, fichier: `${id}.mp3`, texte: l.text, phrase: '', remarque });
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
        phrase: example(id, l.text),
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
// Prononciations à signaler (en plus du dictionnaire de voix.txt).
const SAY = [
  [/1202/, 'dire « douze zéro deux » (code d’alarme)'],
  [/Tranquillité/, 'dire « Tranquillité » posément, comme un nom de lieu'],
  [/Saturn V/, 'dire « Saturne cinq »'],
  [/Eagle/, 'dire « Iguel » (anglais)'],
  [/Columbia/, 'dire « Colombia »'],
  [/Mathgaret/, 'dire « Mathgaret » comme « Math » (mathématiques) + « garet » de Margaret'],
];
for (const r of rows) {
  const notes = SAY.filter(([re]) => re.test(r.texte)).map(([, n]) => n);
  if (notes.length) r.remarque = [r.remarque, ...notes].filter(Boolean).join(' ; ');
}

// Les lots 1 à 7 sont entièrement livrés (lot 7 : les variantes des répliques qui reviennent souvent).
// Ce qui n'est pas encore dans public/audio/voix forme le lot 9 (les nouveaux exercices de C5.1 et C5.2, 18/11).
const voixDir = resolve(root, 'public/audio/voix');
const delivered = new Set(existsSync(voixDir) ? readdirSync(voixDir) : []);
for (const r of rows) {
  r.lot0 = r.variante ? 7 : r.lot;
  if (!delivered.has(r.fichier)) r.lot = 9;
  else if (r.variante) r.lot = 7;
}

const FACULTATIF = 'facultatif';
// Un même enregistrement n'est commandé qu'une fois : même personnage, même sorte (réplique entière ou morceau),
// même texte. Le jeu réutilise celui qui est livré (sameTextKey et Voice.fileFor dans src/audio/).
const sameKey = (r) => {
  const kind = /__\d+\.mp3$/.test(r.fichier) ? 'morceau' : /__|^nombre_/.test(r.fichier) ? null : 'entiere';
  return kind && `${r.personnage}|${kind}|${r.texte.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()}`;
};
const groups = new Map();
for (const r of rows) {
  const k = sameKey(r);
  if (k) groups.set(k, [...(groups.get(k) ?? []), r]);
}
for (const group of groups.values()) {
  if (group.length < 2) continue;
  const kept = group.find((r) => delivered.has(r.fichier)) ?? group[0];
  for (const r of group) {
    if (r === kept || delivered.has(r.fichier)) continue;
    // Déjà enregistré sous un autre nom : rien à commander, le jeu le réutilise (il ne va pas dans le lot 9).
    if (delivered.has(kept.fichier) && r.lot === 9) r.lot = r.lot0;
    // Gardé dans son lot (les commandes déjà transmises restent valables), mais facultatif.
    r.remarque = [FACULTATIF + ` : même texte et même voix que ${kept.fichier}, que le jeu réutilise. Tu peux ne pas l'enregistrer`, r.remarque]
      .filter(Boolean)
      .join(' ; ');
  }
}
rows.sort((x, y) => x.lot - y.lot);

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const head = ['lot', 'fichier', 'personnage', 'texte_a_dire', 'ton', 'phrase_complete_exemple', 'scene', 'remarque'];
const csv = [head.join(';'), ...rows.map((r) => [r.lot, r.fichier, r.personnage, r.texte, r.ton, r.phrase, r.scene, r.remarque].map(q).join(';'))].join('\n');
mkdirSync(resolve(root, 'docs/audio'), { recursive: true });
writeFileSync(resolve(root, 'docs/audio/commande-voix.csv'), '﻿' + csv + '\n');
// Les commandes des lots déjà livrés (commande-voix-lot4.csv à lot7.csv) restent telles qu'elles ont été passées.
for (const lot of [9]) {
  const part = rows.filter((r) => r.lot === lot);
  if (part.length === 0) continue;
  const text = [head.join(';'), ...part.map((r) => [r.lot, r.fichier, r.personnage, r.texte, r.ton, r.phrase, r.scene, r.remarque].map(q).join(';'))].join('\n');
  writeFileSync(resolve(root, `docs/audio/commande-voix-lot${lot}.csv`), '﻿' + text + '\n');
}

const byLot = rows.reduce((m, r) => ((m[r.lot] = (m[r.lot] ?? 0) + 1), m), {});
const chars = (lot) => rows.filter((r) => r.lot === lot).reduce((s, r) => s + r.texte.length, 0);
console.log(`✓ docs/audio/commande-voix.csv : ${rows.length} fichiers`);
for (const lot of [1, 2, 3, 4, 5, 6, 7, 9]) if (byLot[lot]) console.log(`  lot ${lot} : ${byLot[lot]} fichiers, ${chars(lot)} caractères`);
