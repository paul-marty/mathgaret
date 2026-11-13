# Mathgaret

Dessin animé interactif de mathématiques pour un enfant de CP. L'enfant incarne **Margaret Hamilton** dans l'équipe logicielle d'Apollo, du laboratoire du MIT jusqu'au retour sur Terre d'Apollo 11. Chaque problème a un effet visible dans l'histoire.

Le document qui fait foi est `Mathgaret-document-de-reference.md`. Ses propositions P1 à P18 sont adoptées. Le jeu suit le scénario sans l'inventer : les questions ouvertes sont dans `docs/questions-scenaristes.md`.

## Où en est le jeu

| Partie | État |
| --- | --- |
| Moteur (challenges extensibles, aides graduées, réécoute, étoiles, durée globale, reprise) | fait |
| Chapitre 1 « Le grand rêve de Margaret » (C1.1 à C1.4), 3 niveaux | jouable de bout en bout |
| Chapitre 2 « L'ordinateur d'Apollo » (C2.1, souvenir de Lauren, C2.2, C2.3), 3 niveaux | jouable de bout en bout ; répliques en partie provisoires (`docs/questions-scenaristes.md`, section 7) |
| Chapitres 3 à 5 | à faire (le bilan du chapitre 2 annonce « La suite arrive bientôt ») |
| Voix | synthèse provisoire du navigateur, en attendant les fichiers déposés dans `public/audio/` (commande : `docs/audio/prompt-chatgpt.md`) |
| Images | formes provisoires dessinées par le jeu, en attendant les images (`docs/images/prompts.md`) |
| Musique et bruitages | provisoires, synthétisés en direct |

## Jouer

- **Flèches + OK** suffisent pour tout le jeu : clavier (flèches, Entrée ou Espace), télécommande, manette (croix ou stick, A).
- **Chiffres en option** : clavier ou pavé numérique. Deux chiffres tapés à la suite forment un nombre (1 puis 5 → 15).
- **Tablette** : tout se touche.
- **Pas de pause pendant l'aventure.** « Retour » (Échap, B, touche Retour de la télécommande) n'a pas d'effet. Si l'application passe en arrière-plan, le jeu se fige sans rien afficher et repart au retour. Entre deux chapitres, le bilan propose de s'arrêter.
- **Manette** : Y réécoute la consigne, X demande de l'aide.
- La partie est enregistrée en continu sur l'appareil. « Continuer » reprend là où l'enfant s'était arrêté.

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
| `npm run commande-audio` | écrit `docs/audio/commande-voix.csv`, la liste des fichiers de voix à produire |
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

Les tests `tests/e2e/chaos.spec.ts` rejouent le chapitre 1 avec une synthèse vocale capricieuse et des appuis au hasard. `CHAOS=10 npx playwright test chaos` en lance dix. `tests/e2e/chapitre2.spec.ts` joue le chapitre 2 en entier aux trois niveaux et vérifie la console `mg`.

## Ajouter les images

Les prompts ChatGPT de chaque image sont dans `docs/images/prompts.md`. Enregistrer chaque image sous le nom indiqué dans `src/assets/images/personnages/`, `decors/` ou `objets/`. Elle remplace la forme provisoire au prochain lancement.

## Organisation du code

| Dossier | Contenu |
| --- | --- |
| `src/chapters/` | le script de chaque chapitre (`c1.ts`, `c2.ts`) et le plan général (poids, durées, familles) |
| `src/engine/` | boucle d'un challenge (consigne, réponse, erreur, aides, variantes) et façons de répondre |
| `src/math/` | logique pure et testée : familles de problèmes, étoiles, budget de durée |
| `src/content/lines.json` | toutes les répliques, avec leur personnage et leur provenance |
| `src/audio/` | moteur son (Web Audio), voix, musique, bruitages |
| `src/view/` | boutons, sélection aux flèches, personnages, objets, images provisoires, éléments animés de chaque chapitre (`widgets-c2.ts`, `widgets-voyage.ts`) |
| `src/scenes/` | accueil, menu, histoire, bilan, et la couche toujours visible (boutons d'aide, sous-titres) |
| `src/devtools.ts` | la console de développement `mg` |
| `tests/unit/`, `tests/e2e/` | tests unitaires (Vitest) et parcours réels dans Chromium (Playwright) |

## Déploiement

Chaque push sur `main` lance `.github/workflows/deploy.yml` : types, tests unitaires, tests navigateur, build, publication sur GitHub Pages. Le site fonctionne sous `/<nom-du-dépôt>/`. Il est installable et jouable hors ligne.

## Secrets

Le jeu n'utilise aucune clé. La clé ElevenLabs reste dans `.env` (ignoré par git, jamais lu par le jeu). Le build refuse de s'achever si une clé apparaît dans les fichiers produits.
