import { C } from '../config';
import { face, limb, SKIN, type G } from './drawkit';

/**
 * Formes provisoires du chapitre 2 (en attendant les images ChatGPT, docs/images/prompts.md, lot 2).
 * Les zones utiles des objets (écran, intérieur du compartiment, gros bouton) sont repérées en proportions
 * de l'image dans `ZONES` : le jeu y dessine son contenu, que l'image soit provisoire ou livrée.
 */

/** Zones utiles des images, en fractions de la largeur et de la hauteur (centre et taille). */
export const ZONES = {
  /** Écran de l'écran de simulation. */
  ecran: { cx: 0.5, cy: 0.4, w: 0.78, h: 0.62 },
  /** Intérieur du compartiment ouvert. */
  compartiment: { cx: 0.5, cy: 0.6, w: 0.82, h: 0.62 },
  /** Gros bouton orange du pupitre du simulateur. */
  bouton: { cx: 0.5, cy: 0.45, w: 0.16, h: 0.2 },
  /** Lampe au sommet de la balise. */
  lampe: { cx: 0.5, cy: 0.12, w: 0.5, h: 0.2 },
} as const;

const HAIR_L = 0x8a5a32;

/** Lauren, la fille de Margaret : une petite fille (souvenir P18). */
export function drawLauren(g: G, pose: string): void {
  const cx = 250;
  // jambes, chaussures rouges
  limb(g, cx - 30, 560, cx - 32, 712, 30, SKIN);
  limb(g, cx + 30, 560, cx + 32, 712, 30, SKIN);
  g.fillStyle(C.brick, 1);
  g.fillEllipse(cx - 40, 722, 60, 26);
  g.fillEllipse(cx + 40, 722, 60, 26);
  // robe menthe à col blanc
  g.fillStyle(C.mint, 1);
  g.fillPoints(
    [
      { x: cx - 70, y: 390 },
      { x: cx + 70, y: 390 },
      { x: cx + 120, y: 600 },
      { x: cx - 120, y: 600 },
    ],
    true,
  );
  g.fillStyle(C.white, 1);
  g.fillTriangle(cx - 50, 388, cx, 388, cx - 22, 420);
  g.fillTriangle(cx + 50, 388, cx, 388, cx + 22, 420);
  const sl = { x: cx - 72, y: 404 };
  const sr = { x: cx + 72, y: 404 };
  const arm = (s: { x: number; y: number }, hx: number, hy: number) => {
    limb(g, s.x, s.y, hx, hy, 26, SKIN);
    g.fillStyle(SKIN, 1);
    g.fillCircle(hx, hy, 17);
  };
  switch (pose) {
    case 'appuie':
      // le bras tendu vers le bouton du pupitre
      arm(sl, cx - 96, 540);
      arm(sr, cx + 210, 400);
      break;
    case 'gene':
      // une main derrière la tête
      arm(sl, cx - 96, 540);
      arm(sr, cx + 60, 200);
      break;
    default:
      arm(sl, cx - 96, 545);
      arm(sr, cx + 96, 545);
  }
  // cheveux (arrière) avec queue de cheval, tête, frange
  g.fillStyle(HAIR_L, 1);
  g.fillEllipse(cx + 118, 300, 60, 120);
  g.fillRoundedRect(cx - 112, 160, 224, 200, 80);
  g.fillStyle(SKIN, 1);
  g.fillCircle(cx, 270, 100);
  g.fillStyle(HAIR_L, 1);
  g.slice(cx, 262, 108, Math.PI, 0, false);
  g.fillPath();
  g.fillStyle(SKIN, 1);
  g.fillEllipse(cx, 282, 176, 84);
  g.fillStyle(C.brick, 1);
  g.fillCircle(cx + 96, 236, 16);
  face(g, cx, 288, 96, pose === 'gene' ? 'inquiet' : pose === 'appuie' ? 'joie' : 'neutre');
  // joues
  g.fillStyle(0xf0a090, 0.6);
  g.fillCircle(cx - 56, 312, 14);
  g.fillCircle(cx + 56, 312, 14);
}

/** Objets du chapitre 2, ou `null` si l'identifiant n'en fait pas partie. */
export function drawC2Object(g: G, id: string): { w: number; h: number } | null {
  switch (id) {
    case 'ordinateur_apollo': {
      // Boîtier métallique et son clavier-afficheur, sur une petite table
      g.fillStyle(0x8a6346, 1);
      g.fillRect(30, 360, 360, 24);
      g.fillRect(50, 384, 22, 36);
      g.fillRect(348, 384, 22, 36);
      g.fillStyle(0x9aa0ab, 1);
      g.fillRoundedRect(40, 20, 340, 340, 26);
      g.lineStyle(6, 0x4d5260, 1);
      g.strokeRoundedRect(40, 20, 340, 340, 26);
      g.fillStyle(0x2c3140, 1);
      g.fillRoundedRect(80, 50, 260, 110, 14);
      for (let r = 0; r < 3; r++) {
        g.fillStyle(0x7ee08f, 1);
        for (let k = 0; k < 5; k++) g.fillRect(110 + k * 30, 66 + r * 30, 20, 20);
      }
      g.fillStyle(C.mustard, 1);
      g.fillCircle(310, 80, 10);
      g.fillStyle(C.green, 1);
      g.fillCircle(310, 115, 10);
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 7; c++) {
          g.fillStyle(C.cream, 1);
          g.fillRoundedRect(76 + c * 40, 190 + r * 50, 32, 38, 6);
          g.lineStyle(3, 0x4d5260, 1);
          g.strokeRoundedRect(76 + c * 40, 190 + r * 50, 32, 38, 6);
        }
      return { w: 420, h: 420 };
    }
    case 'ecran_simulation': {
      // Grand écran rond des années 1960 sur son pied
      g.fillStyle(0x6b6f7a, 1);
      g.fillRect(250, 380, 60, 50);
      g.fillRoundedRect(150, 420, 260, 30, 10);
      g.fillStyle(0xd8d2c0, 1);
      g.fillRoundedRect(20, 10, 520, 380, 40);
      g.lineStyle(7, C.ink, 1);
      g.strokeRoundedRect(20, 10, 520, 380, 40);
      g.fillStyle(0x16324a, 1);
      g.fillRoundedRect(62, 42, 436, 286, 34);
      g.lineStyle(10, 0x5d6270, 1);
      g.strokeRoundedRect(62, 42, 436, 286, 34);
      g.fillStyle(C.orange, 1);
      g.fillCircle(470, 360, 11);
      g.fillStyle(C.mint, 1);
      g.fillCircle(436, 360, 11);
      return { w: 560, h: 460 };
    }
    case 'icone_maquette': {
      // Pastille « simulation » : une petite maquette de fusée sur son socle
      g.fillStyle(C.mint, 1);
      g.fillRoundedRect(6, 6, 108, 108, 26);
      g.lineStyle(6, C.ink, 1);
      g.strokeRoundedRect(6, 6, 108, 108, 26);
      g.fillStyle(0x8a6346, 1);
      g.fillRect(34, 88, 52, 12);
      g.fillStyle(C.white, 1);
      g.fillRect(52, 34, 16, 54);
      g.fillTriangle(52, 34, 68, 34, 60, 16);
      g.fillStyle(C.orange, 1);
      g.fillTriangle(52, 70, 42, 88, 52, 88);
      g.fillTriangle(68, 70, 78, 88, 68, 88);
      g.lineStyle(3, C.ink, 1);
      g.strokeRect(52, 34, 16, 54);
      return { w: 120, h: 120 };
    }
    case 'fusee_sim': {
      // Fusée de la simulation : dessin plat et lumineux, pointe vers le haut
      g.fillStyle(C.white, 1);
      g.fillRoundedRect(56, 50, 48, 150, 18);
      g.fillTriangle(56, 64, 104, 64, 80, 6);
      g.fillStyle(C.orange, 1);
      g.fillTriangle(56, 150, 22, 212, 56, 196);
      g.fillTriangle(104, 150, 138, 212, 104, 196);
      g.fillStyle(C.sky, 1);
      g.fillCircle(80, 100, 14);
      g.lineStyle(5, C.ink, 1);
      g.strokeRoundedRect(56, 50, 48, 150, 18);
      g.strokeCircle(80, 100, 14);
      g.fillStyle(C.mustard, 1);
      g.fillTriangle(64, 202, 96, 202, 80, 236);
      return { w: 160, h: 240 };
    }
    case 'balise': {
      // Balise de la piste : un mât, un fanion, une lampe au sommet
      g.fillStyle(0x5d6270, 1);
      g.fillRect(64, 40, 12, 140);
      g.fillRoundedRect(36, 176, 68, 18, 8);
      g.fillStyle(C.cream, 1);
      g.fillTriangle(76, 60, 132, 80, 76, 100);
      g.lineStyle(4, C.ink, 1);
      g.strokeTriangle(76, 60, 132, 80, 76, 100);
      g.fillStyle(0xe9edf2, 1);
      g.fillCircle(70, 26, 22);
      g.strokeCircle(70, 26, 22);
      return { w: 140, h: 200 };
    }
    case 'compartiment': {
      // Compartiment d'équipements ouvert (fusée de la simulation), trappe relevée
      g.fillStyle(0xb7bcc6, 1);
      g.fillRoundedRect(10, 10, 440, 70, 20);
      g.lineStyle(5, 0x5d6270, 1);
      g.strokeRoundedRect(10, 10, 440, 70, 20);
      g.fillStyle(0xd5d9e0, 1);
      g.fillRoundedRect(10, 70, 440, 220, 26);
      g.lineStyle(7, C.ink, 1);
      g.strokeRoundedRect(10, 70, 440, 220, 26);
      g.fillStyle(0x3a4256, 1);
      g.fillRoundedRect(40, 92, 380, 180, 18);
      g.fillStyle(0x5d6270, 1);
      for (const x of [60, 400]) g.fillCircle(x, 40, 9);
      return { w: 460, h: 300 };
    }
    case 'pupitre_simulateur': {
      // Pupitre du simulateur : interrupteurs et un gros bouton orange
      g.fillStyle(0x8a6346, 1);
      g.fillRect(40, 250, 26, 100);
      g.fillRect(454, 250, 26, 100);
      g.fillStyle(0xb7bcc6, 1);
      g.fillPoints(
        [
          { x: 40, y: 80 },
          { x: 480, y: 80 },
          { x: 510, y: 260 },
          { x: 10, y: 260 },
        ],
        true,
      );
      g.lineStyle(6, 0x4d5260, 1);
      g.strokePoints(
        [
          { x: 40, y: 80 },
          { x: 480, y: 80 },
          { x: 510, y: 260 },
          { x: 10, y: 260 },
        ],
        true,
      );
      for (let k = 0; k < 8; k++) {
        g.fillStyle([C.green, C.mustard, C.sky, C.brick][k % 4], 1);
        g.fillCircle(80 + k * 52, 110, 10);
        g.fillStyle(0x4d5260, 1);
        g.fillRect(74 + k * 52, 216, 12, 26);
      }
      g.fillStyle(0xb05a20, 1);
      g.fillCircle(260, 168, 40);
      g.fillStyle(C.orange, 1);
      g.fillCircle(260, 162, 38);
      g.lineStyle(5, C.ink, 1);
      g.strokeCircle(260, 162, 38);
      return { w: 520, h: 360 };
    }
    default:
      return null;
  }
}
