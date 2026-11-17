# Mathgaret

Dessin animé interactif de mathématiques pour un enfant de CP. L'enfant incarne **Margaret Hamilton** dans l'équipe logicielle d'Apollo, du laboratoire du MIT jusqu'au retour sur Terre d'Apollo 11. Chaque problème a un effet visible dans l'histoire.

Le document qui fait foi est `Mathgaret-document-de-reference.md`. Ses propositions P1 à P18 sont adoptées. Le jeu suit le scénario sans l'inventer : les questions ouvertes sont dans `docs/questions-scenaristes.md`.

## Où en est le jeu

| Partie | État |
| --- | --- |
| Moteur (challenges extensibles, aides graduées, réécoute, étoiles, durée globale, reprise) | fait |
| Chapitre 1 « Le grand rêve de Margaret » (C1.1 à C1.4), 3 niveaux | jouable de bout en bout |
| Chapitre 2 « L'ordinateur d'Apollo » (C2.1, souvenir de Lauren, C2.2, C2.3), 3 niveaux | jouable de bout en bout ; répliques en partie provisoires (`docs/questions-scenaristes.md`, section 7) |
| Chapitre 3 « Apollo 11, le grand décollage » (C3.1 à C3.5), 3 niveaux | jouable de bout en bout, avec ses voix (lot 4) et ses images |
| Chapitre 4 « Alerte sur la Lune ! » (C4.1 à C4.5), 3 niveaux | jouable de bout en bout, avec ses voix et bruitages (lot 5) et ses images |
| Chapitre 5 « Le grand retour sur Terre » (C5.1 à C5.5), 3 niveaux | jouable de bout en bout, avec ses voix, bruitages, la musique finale (lot 6) et ses images ; C5.1 (alléger Eagle sur la balance) et C5.2 (le radar du rendez-vous) ont été refaits le 18/11, avec leurs voix (lot 9) et leurs images |
| Fin de la mission (C5.6, C5.7) | bilan des cinq chapitres avec une phrase de progrès, diplôme (imprimable sur ordinateur), générique, scène de Mars |
| Voix | les 719 fichiers des lots 1 à 7 et 9 sont livrés (`public/audio/voix/`, état : `npm run audio`) ; une réplique sans fichier passe par la synthèse du navigateur |
| Images | les 81 images sont livrées (`src/assets/images/`, références et journal de production dans `art/`) ; la photographie d'archive de Margaret (`photos/`) attend la validation de ses droits : elle reste hors du dépôt (`.gitignore`) et, sans elle, le Narrateur parle sur la fête (C5.5) |
| Musique et bruitages | les 29 bruitages et les 5 musiques sont livrés (`public/audio/sons/`, `musique/`) ; sans fichier, le jeu les synthétise en direct |

## Jouer

- **Flèches + OK** suffisent pour tout le jeu : clavier (flèches, Entrée ou Espace), télécommande, manette (croix ou stick, A).
- **Chiffres en option** : clavier ou pavé numérique. Deux chiffres tapés à la suite forment un nombre (1 puis 5 → 15).
- **Tablette** : tout se touche.
- **Pas de pause pendant l'aventure.** « Retour » (Échap, B, touche Retour de la télécommande) n'a pas d'effet. Si l'application passe en arrière-plan, le jeu se fige sans rien afficher et repart au retour. Entre deux chapitres, le bilan propose de s'arrêter.
- **Manette** : Y réécoute la consigne, X demande de l'aide.
- La partie est enregistrée en continu sur l'appareil. « Continuer » reprend là où l'enfant s'était arrêté.
- **Au lancement**, un court mot aux parents : l'intention du jeu et son objectif pédagogique (`MOT_PARENTS`, `src/content/note-parents.ts`).
- **Commencer à un chapitre (accès caché)** : sur l'écran de lancement, haut, haut, bas, bas (flèches, télécommande ou croix de la manette), ou appui long (1,5 s) sur le mot « Mathgaret » à la tablette. L'accueil propose alors les cinq chapitres ; le niveau et la durée se règlent ensuite comme pour une nouvelle mission, et l'aventure continue avec les chapitres suivants.
- **Répliques variées** : les répliques qui reviennent à chaque exercice (félicitations, effet d'une bonne réponse, transition vers la variante suivante, erreur, aides, bilans) ont des variantes (`variante_de` dans `src/content/lines.json`). La première fois, le texte de base ; ensuite une variante au hasard, jamais la même deux fois de suite. Si la réplique de base a son fichier livré, seules les variantes livrées sont tirées (jamais de mélange avec la synthèse) : la variété s'entend une fois le lot 7 livré (`docs/prompt-agent-scenariste-lot7.md`).
- **Pas de jetons** : la fonction (bouton, réglage « Jetons prêts », phrases associées) a été retirée le 15/11.
- **Pour les parents** (accueil) : une note qui sépare ce qui est historique, ce que le jeu simplifie et ce qui est inventé, avec ses sources (brouillon soumis aux scénaristes : `docs/note-parents.md`), et le prénom facultatif inscrit sur le diplôme.

## Développer

```bash
npm install
npm run dev          # http://localhost:5173 (accessible depuis la Shield ou la tablette sur le réseau local)
npm run check        # types + tests unitaires + tests dans le navigateur (Playwright)
npm run build        # dossier dist/, prêt pour GitHub Pages
```

Paramètres d'adresse utiles en développement :

| Paramètre | Effet |
| --- | --- |
| `?debug` | sous-titres affichés, étape en cours du scénario en bas à gauche, état exposé dans `window.__mathgaret` |
| `?scene=c2.2&niveau=debut` | démarre directement une scène (`debut`, `milieu`, `fin`) |
| `?vitesse=8` | accélère tout le jeu |
| `?voix=muette` | pas de synthèse vocale (répliques remplacées par un silence minuté) |
| `?graine=3` | tirages reproductibles |
| `?renderer=canvas` | rendu Canvas au lieu de WebGL |

### Avancer vite : la console `mg`

Dans la console JavaScript du navigateur (F12), l'objet `mg` permet de se déplacer dans l'histoire. `mg.aide()` affiche la liste.

| Commande | Effet |
| --- | --- |
| `mg.scenes()` | liste des scènes réalisées (`c1.1` … `c2.lauren`, `c2.2`, `c2.3`) |
| `mg.aller("c2.2", "fin")` | va à une scène (niveau facultatif) |
| `mg.chapitre(2)` | va au début d'un chapitre |
| `mg.suivante()`, `mg.precedente()`, `mg.recommencer()` | scène suivante, précédente, ou reprise de la scène en cours |
| `mg.jusqua("c2.3")` | joue tout seul, vite et sans voix, jusqu'à cette scène, puis rend la main (vitesse et voix d'avant) |
| `mg.bilan()` | termine le chapitre et affiche son bilan |
| `mg.resoudre()`, `mg.erreur()` | répond juste ou faux au problème en cours |
| `mg.toucher(0)` | touche l'objet proposé n° 0, 1… |
| `mg.passer()` | coupe la réplique en cours, ou termine l'attente en cours |
| `mg.auto()`, `mg.auto(false)` | pilote automatique (bonnes réponses), ou arrêt |
| `mg.vitesse(8)`, `mg.muet()` | accélère le jeu ; répliques remplacées par des silences minutés qui suivent la vitesse |
| `mg.niveau("milieu")` | change de niveau et reprend la scène |
| `mg.etat()` | scène, étape, niveau, vitesse et réponse attendue |

La console est là aussi en production : elle ne gêne pas l'enfant, qui n'ouvre pas les outils du navigateur.

Autres commandes :

| Commande | Rôle |
| --- | --- |
| `npm run repliques` | régénère `docs/repliques.md` et `docs/repliques.csv` depuis `src/content/lines.json` |
| `npm run commande-audio` | écrit `docs/audio/commande-voix.csv`, la liste des fichiers de voix à produire, et, pour ce qui n'a pas encore de fichier livré, `commande-voix-lot4.csv` (chapitre 3 et répliques générales), `commande-voix-lot5.csv` (chapitre 4) `commande-voix-lot6.csv` (chapitre 5, fin de la mission, boutons de l'accueil) et `commande-voix-lot7.csv` (variantes des répliques fréquentes) |
| `npm run audio` | état de la livraison audio (`public/audio/`) : ce qui manque, les noms mal écrits |
| `npm run icons` | régénère les icônes de l'application installable |

## Fiabilité du scénario

L'histoire ne doit jamais rester figée. Chaque attente du scénario se termine forcément :
- **Réplique** : fichier livré, synthèse du navigateur ou sous-titre minuté. La synthèse est surveillée : fin non signalée, phrase ignorée, refus, voix qui ne s'arrête pas. Si besoin, le jeu enchaîne de lui-même.
- **Animation** : elle se termine même si elle est interrompue.
- **Erreur dans une scène** : la scène reprend depuis son début. Si l'erreur se reproduit, l'histoire passe à la suite.
- **Erreur pendant une image** : elle est notée, et le jeu continue à l'image suivante.
- **Garde-fou** : si rien n'avance pendant 40 s alors que l'enfant n'a rien à faire, c'est signalé, et la scène reprend.

Si un blocage se produit malgré tout, relancer avec `?debug`. L'étape en cours s'affiche en bas à gauche, avec le temps écoulé et le nombre de filets de sécurité déclenchés. Le journal complet est dans la console du navigateur : `__mathgaret.state().diag`.

Les tests `tests/e2e/chaos.spec.ts` rejouent le chapitre 1 avec une synthèse vocale capricieuse et des appuis au hasard. `CHAOS=10 npx playwright test chaos` en lance dix. `tests/e2e/chapitre2.spec.ts` joue le chapitre 2 en entier aux trois niveaux et vérifie la console `mg`. `tests/e2e/chapitre3.spec.ts` joue le chapitre 3 aux trois niveaux et le clavier de l'ordinateur de guidage aux flèches + OK. `tests/e2e/chapitre4.spec.ts` joue le chapitre 4 aux trois niveaux, la jauge d'énergie aux touches chiffres puis aux flèches, et le plateau de l'ordinateur (compteur, débordement, zone d'attente). `tests/e2e/variantes.spec.ts` vérifie le tirage des variantes en jeu. `tests/e2e/lancement.spec.ts` vérifie le mot aux parents et l'accès caché au choix du chapitre (flèches, manette, appui long). `tests/e2e/chapitre5.spec.ts` joue le chapitre 5 aux trois niveaux jusqu'au retour à l'accueil (bilan de la mission, diplôme, générique, Mars), la balance de C5.1 aux flèches (trop lourd, puis la bonne paire), le radar de C5.2 aux touches chiffres (les trois sortes d'erreurs), la note aux parents et le prénom du diplôme.

## Ajouter les images

Chaque image porte un nom fixe dans `src/assets/images/personnages/`, `decors/`, `objets/` ou `photos/` (photographies d'archive, en JPEG) (liste : `IMAGES` dans `src/view/assets.ts`). Une image absente est remplacée par une forme provisoire dessinée par le jeu. Les planches de référence des personnages, le journal des prompts utilisés et les repères mesurés sur les images (`art/reperes.md`, reportés dans `ZONES`, `PAD`, `MAP_PINS`, `LANDING`, `GROUND` et `LADDER`) sont dans `art/`.

## Organisation du code

| Dossier | Contenu |
| --- | --- |
| `src/chapters/` | le script de chaque chapitre (`c1.ts` à `c5.ts`) et le plan général (poids, durées, familles) |
| `src/engine/` | boucle d'un challenge (consigne, réponse, erreur, aides, variantes) et façons de répondre |
| `src/math/` | logique pure et testée : familles de problèmes, étoiles, budget de durée |
| `src/content/lines.json` | toutes les répliques, avec leur personnage et leur provenance |
| `src/audio/` | moteur son (Web Audio), voix, musique, bruitages |
| `src/view/` | boutons, sélection aux flèches, personnages, objets, images provisoires, éléments animés de chaque chapitre (`widgets-c2.ts`, `widgets-voyage.ts`, `widgets-c3.ts`, `widgets-c4.ts`, `widgets-c5.ts`) |
| `src/scenes/` | accueil, menu (et note aux parents), histoire, bilan, fin de la mission (`FinaleScene.ts`), et la couche toujours visible (boutons d'aide, sous-titres) |
| `src/devtools.ts` | la console de développement `mg` |
| `tests/unit/`, `tests/e2e/` | tests unitaires (Vitest) et parcours réels dans Chromium (Playwright) |

## Déploiement

Chaque push sur `main` lance `.github/workflows/deploy.yml` : types, tests unitaires, tests navigateur, build, publication sur GitHub Pages. Le site fonctionne sous `/<nom-du-dépôt>/`. Il est installable et jouable hors ligne.

## Secrets

Le jeu n'utilise aucune clé. La clé ElevenLabs reste dans `.env` (ignoré par git, jamais lu par le jeu). Le build refuse de s'achever si une clé apparaît dans les fichiers produits.
