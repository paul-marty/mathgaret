/**
 * Note aux parents (bouton « Pour les parents » de l'accueil). Rédigée à partir des sources listées en dernière page
 * (archives NASA, Apollo Lunar Surface Journal, MIT, Computer History Museum), en séparant faits documentés,
 * simplifications du jeu et incidents inventés (demande des scénaristes du 15/11, point 16).
 * BROUILLON : soumis aux scénaristes pour validation (docs/note-parents.md).
 */
export interface NotePage {
  title: string;
  paragraphs: string[];
}

/**
 * Mot aux parents de l'écran de lancement : l'intention du jeu en quelques lignes (le détail est dans NOTE_PARENTS).
 * BROUILLON : soumis aux scénaristes avec la note (docs/note-parents.md).
 */
export const MOT_PARENTS: NotePage & { more: string } = {
  title: 'Un mot pour les parents',
  paragraphs: [
    'Votre enfant incarne Margaret Hamilton, qui dirigeait au MIT une équipe chargée du logiciel des missions Apollo, et vit la mission Apollo 11 de l’intérieur.',
    'Objectif : pratiquer les mathématiques du CP (compter, comparer, compléter, ajouter, retirer) en leur donnant un sens. Chaque réponse a un effet visible dans l’histoire. Tout est dit à voix haute : pas besoin de savoir lire.',
    'Notre intention : donner le goût des mathématiques par le récit, montrer qu’une erreur se corrige, et faire découvrir une pionnière de l’informatique.',
  ],
  more: 'Pour en savoir plus : « Pour les parents », dans le menu.',
};

export const NOTE_PARENTS: NotePage[] = [
  {
    title: 'Pour les parents',
    paragraphs: [
      'Mathgaret est un dessin animé interactif de mathématiques pour le CP. Votre enfant y joue Margaret Hamilton, qui dirigeait au MIT une équipe chargée du logiciel des missions Apollo, et suit la mission Apollo 11, du 16 au 24 juillet 1969.',
      'Les pages suivantes distinguent ce qui est historique, ce que le jeu simplifie, et ce qui est inventé pour l’histoire.',
      'Les aides et la réécoute des consignes sont toujours disponibles. Les étoiles d’efficacité reflètent seulement le nombre de réécoutes (la première est gratuite) ; une erreur de calcul ne compte pas comme un manque d’attention.',
    ],
  },
  {
    title: 'Ce qui est historique (1/4) : Margaret et son équipe',
    paragraphs: [
      'Margaret Hamilton a dirigé la division du génie logiciel du laboratoire d’instrumentation du MIT, à Cambridge (Massachusetts), qui a développé le logiciel de bord d’Apollo. Elle est souvent créditée d’avoir popularisé l’expression « génie logiciel ».',
      'La photographie de la fin la montre en 1969, à côté des listings du logiciel « développé par elle et l’équipe dont elle avait la charge ». Ce travail était collectif : des milliers de personnes ont contribué au programme Apollo.',
      'Lauren, la fille de Margaret, a un jour lancé par erreur le programme P01 sur un simulateur. L’incident a montré qu’il fallait prévoir ce genre de fausse manœuvre. Une erreur du même type s’est produite en vol pendant Apollo 8, en décembre 1968.',
    ],
  },
  {
    title: 'Ce qui est historique (2/4) : le départ et les alarmes',
    paragraphs: [
      'Saturn V décolle du centre spatial Kennedy, en Floride, le 16 juillet 1969 à 13 h 32 (temps universel). La commande de démarrage des moteurs est envoyée 8,9 secondes avant le décollage.',
      'Le 20 juillet, pendant la descente d’Eagle, l’ordinateur affiche les alarmes 1202, puis 1201 : il a trop de travail, encombré par des calculs inutiles liés au radar de rendez-vous. À chaque alarme, il redémarre et reprend les tâches essentielles (comme le pilotage du moteur de descente), sans les calculs inutiles. Cette capacité de redémarrage avait été longuement testée au MIT.',
      'À Houston, le responsable du guidage Steve Bales se tourne vers Jack Garman, qui avait étudié la liste des alarmes et sait que la descente peut continuer.',
    ],
  },
  {
    title: 'Ce qui est historique (3/4) : sur la Lune',
    paragraphs: [
      'Eagle se pose le 20 juillet 1969 à 20 h 17 (temps universel), dans la mer de la Tranquillité. Neil Armstrong annonce : « Houston, Tranquility Base here. The Eagle has landed. » (« Houston, ici la base de la Tranquillité. L’Aigle s’est posé. »). Charlie Duke répond depuis Houston : « We copy you on the ground. You got a bunch of guys about to turn blue. We’re breathing again. » (« Nous vous recevons au sol. Il y a ici des gars qui allaient virer au bleu. Nous respirons de nouveau. »)',
      'Neil Armstrong pose le pied sur la Lune le 21 juillet vers 2 h 56 (temps universel), encore le soir du 20 juillet aux États-Unis : « That’s one small step for (a) man; one giant leap for mankind. » (« C’est un petit pas pour un homme, un bond de géant pour l’humanité. ») Armstrong a toujours dit avoir prononcé le « a », qu’on n’entend pas sur les enregistrements. Buzz Aldrin le rejoint ensuite ; Michael Collins reste en orbite dans Columbia.',
    ],
  },
  {
    title: 'Ce qui est historique (4/4) : le retour',
    paragraphs: [
      'Le 21 juillet, le haut d’Eagle décolle de la Lune ; sa base y reste. Il rejoint Columbia en orbite, puis il est abandonné une fois les astronautes passés dans Columbia.',
      'Le 24 juillet, seule la capsule rentre dans l’atmosphère. La chaleur l’entoure de gaz ionisés qui coupent la radio pendant environ quatre minutes. Deux petits parachutes, puis trois grands parachutes orange et blanc d’environ 25 mètres de diamètre la ralentissent.',
      'Columbia amerrit à 16 h 50 (temps universel) dans l’océan Pacifique, à environ 1 500 km au sud-ouest d’Hawaï. Elle se retourne d’abord pointe en bas, puis des ballons la redressent. Des hélicoptères récupèrent les astronautes et les ramènent sur le porte-avions USS Hornet.',
    ],
  },
  {
    title: 'Ce que le jeu simplifie',
    paragraphs: [
      'Margaret suit toute la mission depuis son laboratoire et parle avec un Collègue (personnage inventé). Le logiciel était prêt avant le départ : les exercices du chapitre 4 font découvrir son fonctionnement, ils ne pilotent pas le vol, et la décision de continuer appartenait à Houston. Seule l’alarme 1202 est montrée.',
      'Les nombres des exercices (équipements, unités d’énergie, places de l’ordinateur, cases) sont des quantités de jeu, sans rapport avec les vraies valeurs. Le « plateau » de l’ordinateur est une image du fonctionnement du logiciel : les tâches indispensables d’abord, les autres attendent.',
      'Au compte à rebours, les flammes apparaissent à « sept ». Les jours de voyage sont condensés (les trois soleils). Les astronautes sont dessinés sans ressemblance, et les voix sont des voix de synthèse de personnages inventés : les répliques radio historiques sont dites en français.',
    ],
  },
  {
    title: 'Ce qui est inventé pour le jeu',
    paragraphs: [
      'Le laboratoire qui « devient fou » et les papiers qui s’envolent (chapitre 1). Le bug de la fusée de simulation et le grand test en simulation (chapitre 2). Le signal mystérieux avant le lancement (chapitre 3).',
      'La panne de radio du retour (chapitre 5), présentée dans le jeu comme une panne imaginaire, pour s’entraîner. Elle est distincte de la vraie coupure radio de la rentrée.',
      'Les messages « Eagle est prêt pour le départ ! » et « Tout va bien ! » sont romancés.',
    ],
  },
  {
    title: 'Sources',
    paragraphs: [
      'NASA, chronologie d’Apollo 11 (SP-4029) : nasa.gov/history, « Apollo 11 Timeline ».',
      'Apollo Lunar Surface Journal (NASA) : transcriptions de l’alunissage et du premier pas ; P. Adler, « Apollo 11 Program Alarms ».',
      'NASA, « 50 Years Ago: Hornet + 3, the Recovery of Apollo 11 » ; NASA, hommage à Jack Garman.',
      'MIT News, « Scene at MIT: Margaret Hamilton’s Apollo code » (2016). Computer History Museum, témoignage oral de Margaret Hamilton.',
      'Photographie : Draper Laboratory (alors MIT Instrumentation Laboratory), 1969, restauration Adam Cuerden, domaine public aux États-Unis (Wikimedia Commons).',
    ],
  },
];
