#!/usr/bin/env node
/**
 * Exporte les répliques du jeu pour les scénaristes et l'équipe des voix :
 *   - docs/repliques.md  : lecture humaine, groupée par scène, avec la provenance de chaque texte ;
 *   - docs/repliques.csv : tableau à compléter (colonne « fichier ») lors de la livraison des voix.
 *
 * Usage : npm run repliques
 * Source unique : src/content/lines.json (ne pas modifier les fichiers générés à la main).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { speakers, lines } = JSON.parse(readFileSync(resolve(root, 'src/content/lines.json'), 'utf8'));

const SOURCE = {
  repris: 'Repris du document de référence (dialogue écrit par les scénaristes)',
  propose: 'Proposé par le document (raccord, idée de réplique)',
  provisoire: 'Provisoire : écrit pour faire fonctionner le jeu, à remplacer ou valider',
};
const VARS = {
  n: 'un nombre (ou le numéro du chapitre)',
  titre: 'le titre du chapitre',
  total: 'le nombre total d’objets du problème',
  deja: 'le nombre d’objets déjà présents',
  k: 'l’écart entre la réponse donnée et la bonne réponse',
  answer: 'la bonne réponse',
  target: 'le nombre demandé',
};

const ids = Object.keys(lines);
const byScene = new Map();
for (const id of ids) {
  const scene = lines[id].scene ?? 'divers';
  if (!byScene.has(scene)) byScene.set(scene, []);
  byScene.get(scene).push(id);
}
const count = (src) => ids.filter((id) => lines[id].source === src).length;
const varsOf = (text) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
const cell = (s) => String(s).replace(/\|/g, '\\|');

let md = `# Répliques du jeu

> Fichier généré par \`npm run repliques\` depuis \`src/content/lines.json\`. Ne pas le modifier à la main.

${ids.length} répliques : ${count('repris')} reprises du document, ${count('propose')} proposées par le document, **${count('provisoire')} provisoires** (à valider ou réécrire par les scénaristes).

## Provenance

| Marque | Sens |
| --- | --- |
${Object.entries(SOURCE)
  .map(([k, v]) => `| ${k === 'provisoire' ? '**provisoire**' : k} | ${v} |`)
  .join('\n')}

## Variantes

Les répliques qui reviennent à chaque exercice (félicitations, transitions, erreurs, aides, bilans) ont plusieurs façons d'être dites. La première fois, le jeu dit la réplique de base ; ensuite il tire une variante au hasard, jamais la même deux fois de suite. Les variantes sont marquées « variante de … ».

## Variables

Certaines répliques contiennent un nombre qui change selon le niveau et la variante. Elles sont écrites avec des accolades : \`{total}\`. Voir la question 1 de \`docs/questions-scenaristes.md\` pour la manière d'enregistrer ces répliques.

| Variable | Contenu |
| --- | --- |
${Object.entries(VARS)
  .map(([k, v]) => `| \`{${k}}\` | ${v} |`)
  .join('\n')}

## Personnages

| Identifiant | Nom | Effet |
| --- | --- | --- |
${Object.entries(speakers)
  .map(([k, v]) => `| \`${k}\` | ${v.name} | ${v.radio ? 'effet radio ajouté par le jeu' : '—'} |`)
  .join('\n')}
`;

for (const [scene, list] of byScene) {
  md += `\n## ${scene}\n\n| Identifiant | Personnage | Texte | Provenance |\n| --- | --- | --- | --- |\n`;
  for (const id of list) {
    const l = lines[id];
    const src = l.source === 'provisoire' ? '**provisoire**' : l.source;
    const variante = l.variante_de ? ` (variante de \`${l.variante_de}\`, tirée au hasard)` : '';
    md += `| \`${id}\` | ${speakers[l.speaker]?.name ?? l.speaker} | ${cell(l.text)} | ${src}${variante} |\n`;
  }
}

const csvCell = (s) => `"${String(s).replace(/"/g, '""')}"`;
const csv = [
  ['id', 'personnage', 'texte', 'variables', 'provenance', 'scene', 'fichier'].join(';'),
  ...ids.map((id) => {
    const l = lines[id];
    return [id, l.speaker, l.text, varsOf(l.text).join(' '), l.source, l.scene ?? '', ''].map(csvCell).join(';');
  }),
].join('\n');

writeFileSync(resolve(root, 'docs/repliques.md'), md);
// BOM : le fichier s'ouvre avec les accents corrects dans un tableur.
writeFileSync(resolve(root, 'docs/repliques.csv'), '﻿' + csv + '\n');
console.log(`✓ docs/repliques.md et docs/repliques.csv (${ids.length} répliques, ${count('provisoire')} provisoires)`);
