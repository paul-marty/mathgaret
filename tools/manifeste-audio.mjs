#!/usr/bin/env node
/**
 * Manifeste des fichiers audio livrés : public/audio/manifest.json.
 *
 * Il est reconstruit automatiquement à chaque lancement de `npm run dev` et de `npm run build`
 * (extension Vite dans vite.config.ts), et à chaque fichier ajouté pendant `npm run dev`.
 * `npm run audio` affiche en plus l'état de la livraison (fichiers manquants, noms mal écrits).
 *
 * Il suffit de déposer les fichiers, avec les noms de la commande (docs/audio/commande-voix.csv) :
 *   public/audio/voix/…     répliques et nombres (sous-dossiers libres)
 *   public/audio/sons/…     bruitages (src/content/audio-catalogue.json)
 *   public/audio/musique/…  musiques en boucle (idem)
 */
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORMATS = new Set(['.mp3', '.ogg']);

/**
 * Clé du manifeste pour un nom de fichier de voix (sans extension), ou null si le nom n'est pas reconnu :
 *   c1_1_intro            → c1_1_intro
 *   c1_2_consigne__2      → c1_2_consigne#2             (2e morceau d'une réplique à nombres)
 *   bilan_efficacite__n-3 → bilan_efficacite|n=3        (réplique entière pour une valeur)
 *   c1_2_consigne__deja-2__total-6 → c1_2_consigne|deja=2|total=6
 *   nombre_07             → nombre_7
 */
export function keyOf(stem) {
  const num = /^nombre_(\d{1,3})$/.exec(stem);
  if (num) return `nombre_${Number(num[1])}`;
  const [id, ...rest] = stem.split('__');
  if (!/^[a-z0-9_]+$/i.test(id) || id.endsWith('_')) return null;
  if (rest.length === 0) return id;
  if (rest.length === 1 && /^\d+$/.test(rest[0])) return `${id}#${Number(rest[0])}`;
  const pairs = rest.map((r) => /^([a-z]+)-(\d+)$/i.exec(r));
  if (pairs.some((p) => !p)) return null;
  const sorted = pairs.map((p) => [p[1], Number(p[2])]).sort(([a], [b]) => (a < b ? -1 : 1));
  return `${id}|${sorted.map(([k, v]) => `${k}=${v}`).join('|')}`;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
}

/** Noms de fichiers attendus (colonne « fichier » de la commande), avec leur lot. */
function expectedVoices(root) {
  const csv = resolve(root, 'docs/audio/commande-voix.csv');
  if (!existsSync(csv)) return new Map();
  const map = new Map();
  for (const line of readFileSync(csv, 'utf8').replace(/^﻿/, '').split(/\r?\n/).slice(1)) {
    const m = /^"(\d+)";"([^"]+)"/.exec(line);
    if (m) map.set(m[2], Number(m[1]));
  }
  return map;
}

/** Écrit le fichier seulement s'il change, et d'un bloc (deux builds peuvent tourner en même temps). */
function writeIfChanged(file, content) {
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return false;
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, file);
  return true;
}

/**
 * Parcourt public/audio et écrit public/audio/manifest.json.
 * Renvoie un bilan : nombre de fichiers par sorte, avertissements, couverture de la commande par lot.
 */
export function buildAudioManifest(root) {
  const audioDir = resolve(root, 'public/audio');
  const { lines } = JSON.parse(readFileSync(resolve(root, 'src/content/lines.json'), 'utf8'));
  const catalogue = JSON.parse(readFileSync(resolve(root, 'src/content/audio-catalogue.json'), 'utf8'));
  const expected = expectedVoices(root);
  const manifest = { voix: {}, sons: {}, musique: {} };
  const warnings = [];
  const delivered = new Set();
  const url = (file) => relative(audioDir, file).split(sep).map(encodeURIComponent).join('/');

  const scan = (kind, accept) => {
    for (const file of walk(join(audioDir, kind))) {
      const ext = extname(file).toLowerCase();
      const name = relative(audioDir, file);
      if (!FORMATS.has(ext)) {
        if (!/\.(txt|md|csv|json)$/i.test(file)) warnings.push(`${name} : format non pris en charge (mp3 ou ogg attendu)`);
        continue;
      }
      const stem = basename(file, extname(file));
      const key = accept(stem, name);
      if (!key) continue;
      if (manifest[kind][key]) {
        warnings.push(`${name} : en double avec ${manifest[kind][key]} (ignoré)`);
        continue;
      }
      manifest[kind][key] = url(file);
    }
  };

  scan('voix', (stem, name) => {
    const key = keyOf(stem);
    const id = key?.split(/[#|]/)[0];
    if (!key || !(id in lines || /^nombre_\d+$/.test(key))) {
      warnings.push(`${name} : nom inconnu du jeu (faute de frappe ?)`);
      return null;
    }
    if (expected.size && !expected.has(`${stem}.mp3`)) warnings.push(`${name} : pas dans la commande (réplique modifiée depuis ?)`);
    delivered.add(`${stem}.mp3`);
    return key;
  });
  scan('sons', (stem, name) => {
    if (stem in catalogue.sons) return stem;
    warnings.push(`${name} : bruitage inconnu (noms attendus : ${Object.keys(catalogue.sons).join(', ')})`);
    return null;
  });
  scan('musique', (stem, name) => {
    if (stem in catalogue.musiques) return stem;
    warnings.push(`${name} : musique inconnue (noms attendus : ${Object.keys(catalogue.musiques).join(', ')})`);
    return null;
  });

  const lots = {};
  for (const [file, lot] of expected) {
    lots[lot] ??= { attendus: 0, livres: 0, manquants: [] };
    lots[lot].attendus++;
    if (delivered.has(file)) lots[lot].livres++;
    else lots[lot].manquants.push(file);
  }
  const missingSounds = Object.keys(catalogue.sons).filter((s) => !manifest.sons[s]);
  const missingMusic = Object.keys(catalogue.musiques).filter((m) => !manifest.musique[m]);

  const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
  const json = JSON.stringify({ voix: sortKeys(manifest.voix), sons: sortKeys(manifest.sons), musique: sortKeys(manifest.musique) }, null, 1) + '\n';
  if (existsSync(audioDir)) writeIfChanged(join(audioDir, 'manifest.json'), json);

  const count = (k) => Object.keys(manifest[k]).length;
  return {
    voix: count('voix'),
    sons: count('sons'),
    musique: count('musique'),
    warnings,
    lots,
    missingSounds,
    missingMusic,
    summary: `audio livré : ${count('voix')} voix, ${count('sons')} bruitages, ${count('musique')} musiques${warnings.length ? ` (${warnings.length} avertissements : npm run audio)` : ''}`,
  };
}

// Lancé directement : bilan détaillé de la livraison.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const r = buildAudioManifest(root);
  console.log(`✓ public/audio/manifest.json : ${r.voix} voix, ${r.sons} bruitages, ${r.musique} musiques`);
  for (const [lot, l] of Object.entries(r.lots)) {
    const label = lot === '3' ? 'lot 3 (nombres)' : `lot ${lot}`;
    console.log(`  ${l.livres === l.attendus ? '✓' : '·'} voix, ${label} : ${l.livres} / ${l.attendus}`);
    if (l.livres > 0 && l.manquants.length) {
      console.log(`      manquants : ${l.manquants.slice(0, 12).join(', ')}${l.manquants.length > 12 ? ` … (+${l.manquants.length - 12})` : ''}`);
    }
  }
  console.log(`  ${r.missingSounds.length ? '·' : '✓'} bruitages : ${r.sons} / ${r.sons + r.missingSounds.length}${r.missingSounds.length && r.sons ? ` (manquants : ${r.missingSounds.join(', ')})` : ''}`);
  console.log(`  ${r.missingMusic.length ? '·' : '✓'} musiques : ${r.musique} / ${r.musique + r.missingMusic.length}${r.missingMusic.length && r.musique ? ` (manquantes : ${r.missingMusic.join(', ')})` : ''}`);
  console.log('  Sans fichier, le jeu garde sa voix de synthèse et ses sons provisoires.');
  for (const w of r.warnings) console.log(`  ⚠ ${w}`);
}
