import { C, HEIGHT, WIDTH } from '../config';
import { face, SKIN, vGradient, type G } from './drawkit';

/**
 * Formes provisoires du chapitre 3 (en attendant les images ChatGPT, docs/images/prompts.md, lot 3).
 * Les repères de la carte sont placés en proportions de l'image (`MAP_PINS`) : le jeu les dessine
 * par-dessus, que l'image soit provisoire ou livrée.
 */

/** Lieux de la carte (fractions de la largeur et de la hauteur de l'image `carte_usa`). */
export const MAP_PINS = {
  floride: { x: 0.78, y: 0.81 },
  houston: { x: 0.47, y: 0.81 },
  mit: { x: 0.87, y: 0.29 },
} as const;

/**
 * Pas de tir dans le décor `kennedy_aube` (fractions de l'image) : la tour de lancement est dans le décor,
 * la fusée n'y est pas — le jeu la pose contre les bras de la tour (axe en `x`, pied à `y`, hauteur `h` de l'image).
 */
export const PAD = { x: 0.835, y: 0.855, h: 0.5 } as const;

/** Silhouette d'astronaute en combinaison blanche (portrait jusqu'à la taille). */
function astronaut(g: G, hair: number, shade: number): { w: number; h: number } {
  const cx = 180;
  g.fillStyle(0xe9edf2, 1);
  g.fillRoundedRect(cx - 150, 300, 300, 260, 70);
  g.lineStyle(6, C.ink, 1);
  g.strokeRoundedRect(cx - 150, 300, 300, 260, 70);
  // Col, fermeture, écusson de mission (bleu, sans logo).
  g.fillStyle(0xc7ced8, 1);
  g.fillRoundedRect(cx - 70, 280, 140, 44, 20);
  g.lineStyle(4, C.ink, 1);
  g.lineBetween(cx, 324, cx, 540);
  g.fillStyle(C.sky, 1);
  g.fillCircle(cx + 80, 380, 30);
  g.lineStyle(4, C.ink, 1);
  g.strokeCircle(cx + 80, 380, 30);
  // Tête et cheveux.
  g.fillStyle(SKIN, 1);
  g.fillCircle(cx, 190, 92);
  g.fillStyle(hair, 1);
  g.fillEllipse(cx, 118, 170, 70);
  g.lineStyle(5, C.ink, 1);
  g.strokeCircle(cx, 190, 92);
  face(g, cx, 200, 90, 'neutre');
  // Casque tenu sous le bras.
  g.fillStyle(0xf4f6f9, 1);
  g.fillCircle(cx - 120, 470, 70);
  g.fillStyle(shade, 1);
  g.fillEllipse(cx - 110, 470, 90, 70);
  g.lineStyle(5, C.ink, 1);
  g.strokeCircle(cx - 120, 470, 70);
  return { w: 360, h: 570 };
}

export function drawC3Object(g: G, id: string): { w: number; h: number } | null {
  switch (id) {
    case 'saturn_v': {
      // Fusée immense, blanche, bandes noires : premier étage, deuxième, troisième, vaisseau, tour de sauvetage.
      const cx = 150;
      g.fillStyle(0xe9edf2, 1);
      g.fillRect(cx - 80, 900, 160, 560);
      g.fillRect(cx - 80, 520, 160, 380);
      g.fillPoints(
        [
          { x: cx - 80, y: 520 },
          { x: cx + 80, y: 520 },
          { x: cx + 56, y: 470 },
          { x: cx - 56, y: 470 },
        ],
        true,
      );
      g.fillRect(cx - 56, 260, 112, 210);
      g.fillStyle(0xd9dee6, 1);
      g.fillTriangle(cx - 56, 260, cx + 56, 260, cx, 150);
      g.lineStyle(6, C.ink, 1);
      g.lineBetween(cx, 150, cx, 40);
      g.lineBetween(cx - 16, 110, cx + 16, 110);
      g.fillStyle(C.brick, 1);
      g.fillTriangle(cx - 10, 50, cx + 10, 50, cx, 20);
      // Damier noir du premier étage et bandes.
      g.fillStyle(C.ink, 1);
      g.fillRect(cx - 80, 1000, 80, 120);
      g.fillRect(cx, 1240, 80, 120);
      g.fillRect(cx - 80, 880, 160, 20);
      g.fillRect(cx - 80, 600, 80, 70);
      g.fillRect(cx - 56, 330, 56, 40);
      // Ailerons et moteurs.
      g.fillStyle(C.ink, 1);
      g.fillTriangle(cx - 80, 1380, cx - 130, 1480, cx - 80, 1480);
      g.fillTriangle(cx + 80, 1380, cx + 130, 1480, cx + 80, 1480);
      g.fillStyle(0x5d6270, 1);
      g.fillRect(cx - 70, 1460, 140, 40);
      g.lineStyle(5, C.ink, 1);
      g.strokeRect(cx - 80, 900, 160, 560);
      g.strokeRect(cx - 80, 520, 160, 380);
      g.strokeRect(cx - 56, 260, 112, 210);
      return { w: 300, h: 1500 };
    }
    case 'carte_usa': {
      // Carte très simple des États-Unis : terre verte sur la mer, sans texte.
      g.fillStyle(0x9fd3ec, 1);
      g.fillRoundedRect(0, 0, 900, 560, 30);
      const pts = [
        [40, 70], [300, 50], [560, 70], [690, 110], [780, 70], [860, 50], [870, 150], [820, 210], [800, 300], [770, 380],
        [800, 440], [835, 520], [800, 545], [760, 455], [660, 440], [560, 455], [490, 520], [430, 480], [390, 430], [250, 425],
        [140, 385], [70, 310], [35, 190],
      ].map(([x, y]) => ({ x, y }));
      g.fillStyle(0xb9d98a, 1);
      g.fillPoints(pts, true);
      g.lineStyle(6, 0x5f7d3a, 1);
      g.strokePoints(pts, true);
      g.lineStyle(6, C.ink, 1);
      g.strokeRoundedRect(0, 0, 900, 560, 30);
      return { w: 900, h: 560 };
    }
    case 'astronaute_1':
      return astronaut(g, 0xb08a5a, 0x3b5f8a);
    case 'astronaute_2':
      return astronaut(g, 0x8a8a8a, 0x5a7aa8);
    case 'astronaute_3':
      return astronaut(g, 0x4a301c, 0x4a6f9a);
    case 'ingenieur': {
      // Ingénieur du centre de contrôle : chemise blanche, cravate, casque-micro.
      const cx = 200;
      g.fillStyle(C.white, 1);
      g.fillRoundedRect(cx - 150, 200, 300, 160, 60);
      g.fillStyle(C.night, 1);
      g.fillTriangle(cx - 14, 210, cx + 14, 210, cx, 330);
      g.fillStyle(SKIN, 1);
      g.fillCircle(cx, 130, 80);
      g.fillStyle(0x3a2a20, 1);
      g.fillEllipse(cx, 66, 150, 50);
      g.lineStyle(5, C.ink, 1);
      g.strokeCircle(cx, 130, 80);
      face(g, cx, 140, 78, 'neutre');
      g.lineStyle(10, C.ink, 1);
      g.beginPath();
      g.arc(cx, 130, 88, Math.PI, 0);
      g.strokePath();
      g.fillStyle(C.ink, 1);
      g.fillCircle(cx - 86, 135, 18);
      g.lineStyle(5, C.ink, 1);
      g.lineBetween(cx - 86, 150, cx - 40, 190);
      g.lineStyle(5, C.ink, 1);
      g.strokeRoundedRect(cx - 150, 200, 300, 160, 60);
      return { w: 400, h: 360 };
    }
    case 'columbia_eagle': {
      // Columbia (cône et cylindre argentés) accroché à Eagle (module doré à pieds).
      g.fillStyle(0xd9dee6, 1);
      g.fillRect(20, 70, 180, 80);
      g.fillTriangle(200, 60, 200, 160, 270, 110);
      g.fillStyle(0x8a93a6, 1);
      g.fillTriangle(20, 80, 20, 140, -10, 110);
      g.lineStyle(5, C.ink, 1);
      g.strokeRect(20, 70, 180, 80);
      g.strokeTriangle(200, 60, 200, 160, 270, 110);
      g.fillStyle(C.mustard, 1);
      g.fillRect(280, 60, 120, 100);
      g.fillStyle(0x8a93a6, 1);
      g.fillRect(300, 30, 80, 34);
      g.lineStyle(5, C.ink, 1);
      g.strokeRect(280, 60, 120, 100);
      g.strokeRect(300, 30, 80, 34);
      g.lineBetween(290, 160, 270, 200);
      g.lineBetween(390, 160, 410, 200);
      return { w: 420, h: 210 };
    }
    default:
      return null;
  }
}

/** Décors du chapitre 3. Renvoie faux si l'identifiant n'en fait pas partie. */
export function drawC3Decor(g: G, id: string): boolean {
  if (id !== 'kennedy_aube') return false;
  const W = WIDTH;
  const H = HEIGHT;
  // Lever du jour sur le centre spatial : ciel bleu nuit → rose → orangé, mer, terrain plat.
  vGradient(g, 0, 0, W, H * 0.72, 0x23305c, 0xf4a77a);
  g.fillStyle(0xffd59a, 1);
  g.fillCircle(W * 0.2, H * 0.72, 70);
  g.fillStyle(0x4f7fa8, 1);
  g.fillRect(0, H * 0.7, W, H * 0.06);
  g.fillStyle(0x6f8a5a, 1);
  g.fillRect(0, H * 0.76, W, H * 0.24);
  g.fillStyle(0x8f8a80, 1);
  g.fillRect(W * 0.6, H * 0.76, W * 0.3, 40);
  // Tour de lancement sur le pas de tir, sans fusée (le jeu pose Saturn V à droite de la tour).
  const x = W * PAD.x;
  g.fillStyle(0x8f8a80, 1);
  g.fillRect(x - 160, H * PAD.y - 14, 300, 18);
  g.fillStyle(C.brick, 1);
  g.fillRect(x - 120, H * 0.28, 50, H * (PAD.y - 0.28));
  g.lineStyle(3, 0x7a3020, 1);
  for (let y = H * 0.28; y < H * PAD.y; y += 30) g.lineBetween(x - 120, y, x - 70, y + 30);
  g.lineStyle(6, C.brick, 1);
  for (const f of [0.36, 0.5, 0.64]) g.lineBetween(x - 70, H * f, x - 40, H * f);
  return true;
}
