import type * as Phaser from 'phaser';
import { C, HEIGHT, WIDTH } from '../config';
import { face, HAIR_C, HAIR_M, limb, SKIN, vGradient, type G } from './drawkit';
import { drawC2Object, drawLauren } from './placeholders-c2';
import { drawC3Decor, drawC3Object } from './placeholders-c3';
import { drawC4Decor, drawC4Object } from './placeholders-c4';
import { drawC5Decor, drawC5Object } from './placeholders-c5';

/**
 * Images du jeu. Chaque identifiant correspond à un fichier produit avec ChatGPT
 * (docs/images/prompts.md), déposé dans src/assets/images/<dossier>/<id>.png.
 * Tant que le fichier manque, le jeu dessine une forme provisoire de même rôle.
 */
export const IMAGES = {
  personnages: [
    'margaret_neutre',
    'margaret_parle',
    'margaret_reflechit',
    'margaret_joie',
    'margaret_surprise',
    'margaret_montre',
    'collegue_neutre',
    'collegue_enthousiaste',
    'collegue_explique',
    'collegue_inquiet',
    'collegue_stupefait',
    'collegue_soulage',
    'collegue_enseveli',
    'collegue_applaudit',
    'collegue_chuchote',
    // Chapitre 2
    'margaret_penchee',
    'lauren_neutre',
    'lauren_appuie',
    'lauren_gene',
  ],
  decors: [
    'c1_ville',
    'labo',
    'labo_soir',
    'kennedy_aube',
    'lune_surface',
    'lune_sol',
    'salle_controle',
    // Chapitre 5
    'orbite_lune',
    'terre_proche',
    'rentree_ciel',
    'ocean',
    'mars',
  ],
  objets: [
    'poste_travail',
    'armoire_bandes',
    'bobine',
    'imprimante',
    'panneau',
    'voyant_eteint',
    'voyant_vert',
    'voyant_orange',
    'maquette_saturn',
    'petite_fusee',
    'eq_casque',
    'eq_batterie',
    'eq_antenne',
    'eq_gyroscope',
    'eq_oxygene',
    'eq_boussole',
    // Chapitre 2
    'ordinateur_apollo',
    'ecran_simulation',
    'icone_maquette',
    'fusee_sim',
    'balise',
    'compartiment',
    'pupitre_simulateur',
    // Chapitre 3
    'saturn_v',
    'carte_usa',
    'astronaute_1',
    'astronaute_2',
    'astronaute_3',
    'ingenieur',
    'columbia_eagle',
    // Chapitre 4
    'eagle',
    'columbia',
    'rochers',
    'echelle_eagle',
    'astronaute_dos',
    'terre',
    // Chapitre 5
    'eagle_montee',
    'eagle_base',
    'module_service',
    'capsule',
    'capsule_parachutes',
    'helicoptere',
    'navire',
    'equipe_fete',
    // Chapitre 5, ajoutés le 18/11 : alléger Eagle (C5.1)
    'boite_cailloux',
    'lune_sac',
    'lune_bottes',
    'lune_appareil',
    'lune_pelle',
    'lune_marteau',
  ],
  /** Photographies d'archive (pas de forme provisoire : le fichier est dans le dépôt). */
  photos: ['photo_margaret'],
} as const;

export type ImageId = (typeof IMAGES)[keyof typeof IMAGES][number];
export const EQUIPMENT: ImageId[] = ['eq_batterie', 'eq_casque', 'eq_antenne', 'eq_gyroscope', 'eq_oxygene', 'eq_boussole'];

const files = import.meta.glob('../assets/images/**/*.{png,jpg}', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;

export function imageUrl(id: string): string | undefined {
  const key = Object.keys(files).find((k) => k.endsWith(`/${id}.png`) || k.endsWith(`/${id}.jpg`));
  return key ? files[key] : undefined;
}

/** Liste des images livrées / provisoires (affichée en mode débogage). */
export function imageStatus(): { id: string; ready: boolean }[] {
  return Object.values(IMAGES)
    .flat()
    .map((id) => ({ id, ready: Boolean(imageUrl(id)) }));
}

export function queueImages(scene: Phaser.Scene): void {
  for (const id of Object.values(IMAGES).flat()) {
    const url = imageUrl(id);
    if (url) scene.load.image(id, url);
  }
}

/** Ajuste une image à une boîte en gardant ses proportions (les vraies images n'ont pas la taille des provisoires). */
export function fit<T extends Phaser.GameObjects.Image>(img: T, maxW: number, maxH: number): T {
  const s = Math.min(maxW / img.width, maxH / img.height);
  img.setScale(s);
  return img;
}

/** Décor plein écran : couvre 1920×1080 en rognant le haut et le bas si besoin. */
export function cover<T extends Phaser.GameObjects.Image>(img: T): T {
  const s = Math.max(WIDTH / img.width, HEIGHT / img.height);
  img.setScale(s);
  return img;
}

// ---------------------------------------------------------------------------
// Formes provisoires
// ---------------------------------------------------------------------------


function drawMargaret(g: G, pose: string): void {
  const W = 500;
  const cx = W / 2;
  // jambes et chaussures
  limb(g, cx - 40, 600, cx - 44, 715, 30, SKIN);
  limb(g, cx + 40, 600, cx + 44, 715, 30, SKIN);
  g.fillStyle(0x6b4423, 1);
  g.fillEllipse(cx - 52, 724, 64, 26);
  g.fillEllipse(cx + 52, 724, 64, 26);
  // robe bleu ciel
  g.fillStyle(C.sky, 1);
  g.fillPoints(
    [
      { x: cx - 78, y: 300 },
      { x: cx + 78, y: 300 },
      { x: cx + 130, y: 620 },
      { x: cx - 130, y: 620 },
    ],
    true,
  );
  // gilet crème
  g.fillStyle(C.cream, 1);
  g.fillPoints(
    [
      { x: cx - 82, y: 296 },
      { x: cx - 30, y: 300 },
      { x: cx - 40, y: 470 },
      { x: cx - 100, y: 470 },
    ],
    true,
  );
  g.fillPoints(
    [
      { x: cx + 82, y: 296 },
      { x: cx + 30, y: 300 },
      { x: cx + 40, y: 470 },
      { x: cx + 100, y: 470 },
    ],
    true,
  );
  g.fillStyle(C.white, 1);
  g.fillEllipse(cx, 304, 70, 26);
  // bras selon la pose
  const sl = { x: cx - 88, y: 320 };
  const sr = { x: cx + 88, y: 320 };
  const arm = (s: { x: number; y: number }, hx: number, hy: number) => {
    limb(g, s.x, s.y, hx, hy, 32, C.cream);
    g.fillStyle(SKIN, 1);
    g.fillCircle(hx, hy, 19);
  };
  switch (pose) {
    case 'joie':
      arm(sl, cx - 150, 150);
      arm(sr, cx + 150, 150);
      break;
    case 'parle':
      arm(sl, cx - 110, 500);
      arm(sr, cx + 170, 360);
      break;
    case 'reflechit':
      arm(sl, cx - 110, 500);
      arm(sr, cx + 30, 255);
      break;
    case 'surprise':
      arm(sl, cx - 110, 500);
      arm(sr, cx + 40, 270);
      break;
    case 'montre':
      arm(sl, cx - 110, 500);
      arm(sr, cx + 220, 300);
      break;
    case 'penchee':
      // penchée vers Lauren, mains sur les genoux, regard curieux
      arm(sl, cx + 10, 560);
      arm(sr, cx + 150, 540);
      break;
    default:
      arm(sl, cx - 112, 500);
      arm(sr, cx + 112, 500);
  }
  // cheveux (arrière), tête, cheveux (avant)
  g.fillStyle(HAIR_M, 1);
  g.fillRoundedRect(cx - 100, 110, 200, 210, 70);
  g.fillStyle(SKIN, 1);
  g.fillCircle(cx, 200, 82);
  g.fillStyle(HAIR_M, 1);
  g.slice(cx, 196, 92, Math.PI, 0, false);
  g.fillPath();
  g.fillStyle(SKIN, 1);
  g.fillEllipse(cx + 20, 205, 140, 70);
  face(g, cx, 210, 82, pose);
  // grandes lunettes
  g.lineStyle(5, C.ink, 1);
  g.strokeCircle(cx - 30, 202, 24);
  g.strokeCircle(cx + 30, 202, 24);
  g.lineBetween(cx - 6, 202, cx + 6, 202);
}

function drawCollegue(g: G, pose: string): void {
  const W = 500;
  const cx = W / 2;
  const lean = pose === 'chuchote' ? 18 : pose === 'inquiet' ? -14 : 0;
  // jambes (pantalon gris) et chaussures
  limb(g, cx - 30, 470, cx - 36 + lean / 2, 712, 40, 0x7c8494);
  limb(g, cx + 30, 470, cx + 36 + lean / 2, 712, 40, 0x7c8494);
  g.fillStyle(0x3a2a20, 1);
  g.fillEllipse(cx - 46, 726, 70, 26);
  g.fillEllipse(cx + 46, 726, 70, 26);
  // chemise blanche
  g.fillStyle(C.white, 1);
  g.fillRoundedRect(cx - 70 + lean, 250, 140, 240, 30);
  g.lineStyle(4, 0xcfd6df, 1);
  g.strokeRoundedRect(cx - 70 + lean, 250, 140, 240, 30);
  // cravate orange et porte-crayons
  g.fillStyle(C.orange, 1);
  g.fillTriangle(cx - 12 + lean, 258, cx + 12 + lean, 258, cx + lean, 400);
  g.fillStyle(C.sky, 1);
  g.fillRect(cx + 26 + lean, 290, 26, 30);
  g.fillStyle(C.brick, 1);
  g.fillRect(cx + 30 + lean, 278, 6, 18);
  g.fillStyle(C.ink, 1);
  g.fillRect(cx + 40 + lean, 276, 6, 20);
  const sl = { x: cx - 74 + lean, y: 272 };
  const sr = { x: cx + 74 + lean, y: 272 };
  const arm = (s: { x: number; y: number }, hx: number, hy: number) => {
    limb(g, s.x, s.y, hx, hy, 30, C.white);
    g.fillStyle(SKIN, 1);
    g.fillCircle(hx, hy, 18);
  };
  const papers = (x: number, y: number, tilt = 0) => {
    g.fillStyle(C.cream, 1);
    for (let i = 0; i < 4; i++) g.fillRect(x - 46 + i * 3 + tilt * i, y - 34 - i * 6, 92, 60);
    g.lineStyle(3, 0xb8a888, 1);
    g.strokeRect(x - 46 + 9 + tilt * 3, y - 52, 92, 60);
  };
  switch (pose) {
    case 'enthousiaste':
      arm(sl, cx - 190, 200);
      arm(sr, cx + 190, 200);
      g.fillStyle(C.cream, 1);
      g.fillRect(cx + 150, 90, 70, 50);
      break;
    case 'explique':
      papers(cx + 120, 420);
      arm(sl, cx - 230, 250);
      arm(sr, cx + 100 + lean, 420);
      break;
    case 'inquiet':
      papers(cx + lean, 360);
      arm(sl, cx - 20 + lean, 370);
      arm(sr, cx + 30 + lean, 370);
      break;
    case 'soulage':
      papers(cx + 130, 440);
      arm(sl, cx - 10 + lean, 320);
      arm(sr, cx + 110, 440);
      break;
    case 'applaudit':
      arm(sl, cx - 8, 300);
      arm(sr, cx + 8, 300);
      break;
    case 'chuchote':
      arm(sl, cx - 6 + lean, 380);
      arm(sr, cx + 12 + lean, 380);
      break;
    case 'stupefait':
      arm(sl, cx - 140, 420);
      arm(sr, cx + 140, 420);
      break;
    default:
      papers(cx + 120, 430);
      arm(sl, cx - 104, 470);
      arm(sr, cx + 104, 440);
  }
  // tête
  const hx = cx + lean;
  g.fillStyle(SKIN, 1);
  g.fillCircle(hx, 180, 70);
  g.fillStyle(HAIR_C, 1);
  const spikes = pose === 'stupefait' || pose === 'enseveli' ? 1.45 : 1;
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i * Math.PI) / 6;
    const bx = hx + Math.cos(a) * 62;
    const by = 170 + Math.sin(a) * 62;
    g.fillTriangle(bx - 22, by + 8, bx + 22, by + 8, hx + Math.cos(a) * 100 * spikes, 170 + Math.sin(a) * 100 * spikes);
  }
  g.slice(hx, 168, 70, Math.PI, 0, false);
  g.fillPath();
  face(g, hx, 186, 70, pose === 'enseveli' ? 'stupefait' : pose);
  if (pose === 'enseveli') {
    // bande de papier listing enroulée autour de lui
    g.fillStyle(C.white, 1);
    g.lineStyle(3, 0x9cc9a8, 1);
    for (let i = 0; i < 9; i++) {
      const y = 240 + i * 52;
      const x = cx - 150 + (i % 2) * 40;
      g.fillRect(x, y, 300, 46);
      g.strokeRect(x, y, 300, 46);
      g.fillStyle(0xdff0e3, 1);
      g.fillRect(x, y + 14, 300, 12);
      g.fillStyle(C.white, 1);
    }
    g.fillRect(hx + 30, 70, 46, 120);
  }
}

function drawDecor(g: G, id: string): void {
  const W = WIDTH;
  const H = HEIGHT;
  if (id === 'c1_ville') {
    vGradient(g, 0, 0, W, H * 0.7, 0x9fd3ec, 0xf6ecd9);
    g.fillStyle(0x9aa59a, 1);
    g.fillRect(0, H * 0.78, W, H * 0.22);
    g.fillStyle(0x6f6a64, 1);
    g.fillRect(0, H * 0.84, W, 90);
    // immeubles de briques
    const bricks = [0xb4553e, 0xa64b37, 0xc4553a];
    for (let i = 0; i < 9; i++) {
      const x = i * 230 - 40;
      const h = 380 + ((i * 97) % 180);
      g.fillStyle(bricks[i % 3], 1);
      g.fillRect(x, H * 0.78 - h, 220, h);
      g.fillStyle(0xf6e7b8, 1);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.fillRect(x + 28 + c * 64, H * 0.78 - h + 40 + r * 80, 34, 46);
    }
    // grand bâtiment du laboratoire au centre, avec sa porte
    g.fillStyle(0xd9cbb0, 1);
    g.fillRect(W / 2 - 360, H * 0.78 - 520, 720, 520);
    g.fillStyle(0xc9b996, 1);
    for (let i = 0; i < 6; i++) g.fillRect(W / 2 - 330 + i * 125, H * 0.78 - 470, 40, 470);
    g.fillStyle(0x3a2a20, 1);
    g.fillRoundedRect(W / 2 - 80, H * 0.78 - 230, 160, 230, { tl: 70, tr: 70, bl: 0, br: 0 });
    g.fillStyle(0xf2c14e, 1);
    g.fillCircle(W / 2 + 50, H * 0.78 - 110, 9);
    // arbres
    for (const x of [140, 560, 1360, 1780]) {
      g.fillStyle(0x6b4423, 1);
      g.fillRect(x - 14, H * 0.78 - 140, 28, 140);
      g.fillStyle(0x5e9e6e, 1);
      g.fillCircle(x, H * 0.78 - 190, 90);
    }
    return;
  }
  const night = id === 'labo_soir';
  vGradient(g, 0, 0, W, H * 0.72, night ? 0x3a3550 : 0xf3e6cf, night ? 0x4c4258 : 0xe8d6b8);
  g.fillStyle(night ? 0x3b3140 : 0xa9876a, 1);
  g.fillRect(0, H * 0.72, W, H * 0.28);
  g.fillStyle(night ? 0x332a38 : 0x987659, 1);
  for (let i = 0; i < 12; i++) g.fillRect(i * 170, H * 0.72, 6, H * 0.28);
  // grande fenêtre au fond
  const wx = W / 2 - 330;
  const wy = 150;
  if (night) {
    g.fillStyle(0x1d2b4f, 1);
    g.fillRect(wx, wy, 660, 380);
    g.fillStyle(0xffffff, 0.9);
    for (let i = 0; i < 40; i++) g.fillCircle(wx + ((i * 151) % 640) + 10, wy + ((i * 83) % 360) + 10, (i % 3) + 1);
    g.fillStyle(0xf6f0d8, 1);
    g.fillCircle(wx + 470, wy + 120, 70);
    g.fillStyle(0xd9d1b6, 1);
    g.fillCircle(wx + 450, wy + 105, 14);
    g.fillCircle(wx + 495, wy + 140, 10);
  } else {
    vGradient(g, wx, wy, 660, 380, 0x7fb8d8, 0xcfe6ef, 12);
    g.fillStyle(0xffffff, 0.8);
    g.fillEllipse(wx + 180, wy + 110, 160, 50);
    g.fillEllipse(wx + 470, wy + 80, 200, 60);
  }
  g.lineStyle(18, night ? 0x5a4a50 : 0x8a6a4e, 1);
  g.strokeRect(wx, wy, 660, 380);
  g.lineBetween(wx + 330, wy, wx + 330, wy + 380);
  g.lineBetween(wx, wy + 190, wx + 660, wy + 190);
  // armoires d'ordinateur à gauche et à droite
  for (const [x0, flip] of [
    [40, 1],
    [W - 40, -1],
  ] as const) {
    for (let i = 0; i < 2; i++) {
      const x = flip === 1 ? x0 + i * 200 : x0 - (i + 1) * 200;
      g.fillStyle(night ? 0x6e6e7e : 0xb7bcc6, 1);
      g.fillRect(x, 240, 190, 560);
      g.lineStyle(5, 0x5d6270, 1);
      g.strokeRect(x, 240, 190, 560);
      g.fillStyle(0x2c3140, 1);
      g.fillCircle(x + 55, 340, 40);
      g.fillCircle(x + 135, 340, 40);
      const dots = [C.green, C.orange, C.mustard, C.sky];
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 5; c++) {
          g.fillStyle(dots[(r + c + i) % 4], night ? 0.5 : 0.9);
          g.fillCircle(x + 35 + c * 30, 460 + r * 34, 8);
        }
    }
  }
  // tables avec listings
  g.fillStyle(night ? 0x5a4636 : 0x8a6346, 1);
  g.fillRect(W / 2 - 520, 610, 300, 24);
  g.fillRect(W / 2 + 220, 610, 300, 24);
  g.fillStyle(night ? 0xbdb3a0 : C.cream, 1);
  for (let i = 0; i < 5; i++) {
    g.fillRect(W / 2 - 490 + i * 4, 560 - i * 9, 120, 50);
    g.fillRect(W / 2 + 300 + i * 4, 560 - i * 9, 120, 50);
  }
  if (night) {
    g.fillStyle(0x000000, 0.25);
    g.fillRect(0, 0, W, H);
  }
}

function drawObject(g: G, id: string): { w: number; h: number } {
  switch (id) {
    case 'poste_travail': {
      g.fillStyle(0x8a6346, 1);
      g.fillRect(20, 230, 380, 30);
      g.fillRect(40, 260, 26, 100);
      g.fillRect(354, 260, 26, 100);
      g.fillStyle(0xd8d2c0, 1);
      g.fillRoundedRect(80, 40, 260, 190, 22);
      g.lineStyle(6, C.ink, 1);
      g.strokeRoundedRect(80, 40, 260, 190, 22);
      g.fillStyle(0x6f8a78, 1);
      g.fillCircle(170, 135, 70);
      g.lineStyle(8, 0x4a5a50, 1);
      g.strokeCircle(170, 135, 70);
      for (const [i, c] of [C.brick, C.mustard, C.green, C.sky].entries()) {
        g.fillStyle(c, 1);
        g.fillCircle(290, 80 + i * 40, 13);
      }
      return { w: 420, h: 360 };
    }
    case 'armoire_bandes': {
      g.fillStyle(0xb7bcc6, 1);
      g.fillRoundedRect(10, 10, 280, 500, 14);
      g.lineStyle(6, 0x5d6270, 1);
      g.strokeRoundedRect(10, 10, 280, 500, 14);
      g.fillStyle(0x2c3140, 1);
      g.fillCircle(150, 120, 86);
      g.fillCircle(150, 310, 86);
      g.fillStyle(0x9aa0ab, 1);
      g.fillRect(40, 430, 220, 50);
      return { w: 300, h: 520 };
    }
    case 'bobine': {
      g.fillStyle(0x6b5a4a, 1);
      g.fillCircle(100, 100, 92);
      g.fillStyle(0xcfd3da, 1);
      g.fillCircle(100, 100, 80);
      g.fillStyle(0x2c3140, 1);
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        g.fillCircle(100 + Math.cos(a) * 46, 100 + Math.sin(a) * 46, 22);
      }
      g.fillStyle(0x5d6270, 1);
      g.fillCircle(100, 100, 18);
      return { w: 200, h: 200 };
    }
    case 'imprimante': {
      g.fillStyle(0x6b6f7a, 1);
      g.fillRect(50, 250, 22, 80);
      g.fillRect(288, 250, 22, 80);
      g.fillStyle(0xd0c6b0, 1);
      g.fillRoundedRect(20, 60, 320, 200, 20);
      g.lineStyle(6, C.ink, 1);
      g.strokeRoundedRect(20, 60, 320, 200, 20);
      g.fillStyle(0x3a3a44, 1);
      g.fillRect(80, 60, 200, 16);
      g.fillStyle(C.orange, 1);
      g.fillCircle(290, 120, 12);
      g.fillStyle(C.green, 1);
      g.fillCircle(290, 160, 12);
      return { w: 360, h: 340 };
    }
    case 'panneau': {
      g.fillStyle(0x000000, 0.2);
      g.fillRoundedRect(16, 22, 880, 470, 40);
      g.fillStyle(C.cream, 1);
      g.fillRoundedRect(8, 8, 880, 470, 40);
      g.lineStyle(8, C.ink, 1);
      g.strokeRoundedRect(8, 8, 880, 470, 40);
      g.fillStyle(0xb8a888, 1);
      for (const [x, y] of [
        [40, 40],
        [856, 40],
        [40, 446],
        [856, 446],
      ])
        g.fillCircle(x, y, 10);
      return { w: 900, h: 500 };
    }
    case 'voyant_eteint':
    case 'voyant_vert':
    case 'voyant_orange': {
      g.fillStyle(0xc9ced6, 1);
      g.fillCircle(60, 60, 56);
      g.lineStyle(5, 0x5d6270, 1);
      g.strokeCircle(60, 60, 56);
      const col = id === 'voyant_vert' ? C.green : id === 'voyant_orange' ? C.orange : 0x6d776f;
      g.fillStyle(col, 1);
      g.fillCircle(60, 60, 42);
      g.fillStyle(0xffffff, id === 'voyant_eteint' ? 0.15 : 0.55);
      g.fillCircle(46, 44, 12);
      return { w: 120, h: 120 };
    }
    case 'maquette_saturn': {
      g.fillStyle(0x8a6346, 1);
      g.fillRect(30, 560, 120, 36);
      g.fillStyle(C.white, 1);
      g.fillRect(62, 120, 56, 440);
      g.fillTriangle(62, 120, 118, 120, 90, 40);
      g.fillRect(86, 6, 8, 40);
      g.fillStyle(C.ink, 1);
      for (const y of [200, 330, 470]) g.fillRect(62, y, 56, 14);
      g.fillTriangle(62, 520, 40, 560, 62, 560);
      g.fillTriangle(118, 520, 140, 560, 118, 560);
      g.lineStyle(4, C.ink, 1);
      g.strokeRect(62, 120, 56, 440);
      return { w: 180, h: 600 };
    }
    case 'petite_fusee': {
      g.fillStyle(C.white, 1);
      g.fillEllipse(110, 100, 90, 150);
      g.fillStyle(C.orange, 1);
      g.fillTriangle(70, 130, 40, 190, 90, 165);
      g.fillTriangle(150, 130, 180, 190, 130, 165);
      g.fillStyle(C.sky, 1);
      g.fillCircle(110, 85, 24);
      g.lineStyle(5, C.ink, 1);
      g.strokeEllipse(110, 100, 90, 150);
      g.strokeCircle(110, 85, 24);
      g.fillStyle(C.mustard, 1);
      g.fillTriangle(90, 172, 130, 172, 110, 215);
      return { w: 220, h: 220 };
    }
    case 'eq_casque':
      g.fillStyle(C.white, 1);
      g.fillCircle(70, 66, 54);
      g.fillRect(30, 96, 80, 30);
      g.fillStyle(0xe0a93a, 1);
      g.fillEllipse(70, 64, 70, 46);
      g.lineStyle(5, C.ink, 1);
      g.strokeCircle(70, 66, 54);
      return { w: 140, h: 140 };
    case 'eq_batterie':
      g.fillStyle(C.mustard, 1);
      g.fillRoundedRect(36, 26, 68, 100, 10);
      g.fillStyle(0x8a93a6, 1);
      g.fillRect(56, 12, 28, 16);
      g.fillStyle(C.ink, 1);
      g.fillRect(52, 66, 36, 8);
      g.fillRect(66, 52, 8, 36);
      g.lineStyle(5, C.ink, 1);
      g.strokeRoundedRect(36, 26, 68, 100, 10);
      return { w: 140, h: 140 };
    case 'eq_antenne':
      g.fillStyle(C.sky, 1);
      g.slice(70, 70, 50, Math.PI * 0.85, Math.PI * 2.15, false);
      g.fillPath();
      g.lineStyle(5, C.ink, 1);
      g.lineBetween(70, 70, 70, 128);
      g.lineBetween(46, 128, 94, 128);
      g.fillStyle(C.ink, 1);
      g.fillCircle(70, 50, 8);
      return { w: 140, h: 140 };
    case 'eq_gyroscope':
      g.lineStyle(9, 0xd9a63a, 1);
      g.strokeCircle(70, 70, 50);
      g.strokeEllipse(70, 70, 100, 40);
      g.strokeEllipse(70, 70, 40, 100);
      g.fillStyle(C.brick, 1);
      g.fillCircle(70, 70, 14);
      return { w: 140, h: 140 };
    case 'eq_oxygene':
      g.fillStyle(C.mint, 1);
      g.fillRoundedRect(44, 30, 52, 100, 24);
      g.fillStyle(0x8a93a6, 1);
      g.fillRect(60, 12, 20, 20);
      g.fillRect(76, 16, 26, 8);
      g.lineStyle(5, C.ink, 1);
      g.strokeRoundedRect(44, 30, 52, 100, 24);
      return { w: 140, h: 140 };
    case 'eq_boussole':
      g.fillStyle(C.brick, 1);
      g.fillCircle(70, 70, 54);
      g.fillStyle(C.cream, 1);
      g.fillCircle(70, 70, 42);
      g.fillStyle(C.brick, 1);
      g.fillTriangle(62, 70, 78, 70, 70, 30);
      g.fillStyle(C.ink, 1);
      g.fillTriangle(62, 70, 78, 70, 70, 110);
      return { w: 140, h: 140 };
    default:
      g.fillStyle(C.grey, 1);
      g.fillRect(0, 0, 100, 100);
      return { w: 100, h: 100 };
  }
}

/** Crée les textures provisoires des images non encore livrées. */
export function makePlaceholders(scene: Phaser.Scene): void {
  const g = scene.make.graphics({}, false);
  for (const id of IMAGES.personnages) {
    if (scene.textures.exists(id)) continue;
    g.clear();
    const [who, pose] = id.split('_');
    if (who === 'margaret') drawMargaret(g, pose);
    else if (who === 'lauren') drawLauren(g, pose);
    else drawCollegue(g, pose);
    g.generateTexture(id, 500, 750);
  }
  for (const id of IMAGES.decors) {
    if (scene.textures.exists(id)) continue;
    g.clear();
    if (!drawC3Decor(g, id) && !drawC4Decor(g, id) && !drawC5Decor(g, id)) drawDecor(g, id);
    g.generateTexture(id, WIDTH, HEIGHT);
  }
  for (const id of IMAGES.objets) {
    if (scene.textures.exists(id)) continue;
    g.clear();
    const { w, h } = drawC5Object(g, id) ?? drawC4Object(g, id) ?? drawC3Object(g, id) ?? drawC2Object(g, id) ?? drawObject(g, id);
    g.generateTexture(id, w, h);
  }
  g.destroy();
}
