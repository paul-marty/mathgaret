import { C, HEIGHT, WIDTH } from '../config';
import { vGradient, type G } from './drawkit';

/**
 * Formes provisoires du chapitre 4 (en attendant les images ChatGPT, docs/images/prompts.md, lot 4).
 * Les repères sont en fractions de l'image : le jeu les utilise que l'image soit provisoire ou livrée.
 */

/** Zone de pose dans `lune_surface` : une plaine dégagée, que la vue de descente agrandit. */
export const LANDING = { x: 0.5, y: 0.66 } as const;

/** Ligne du sol dans `lune_sol` (où se posent les pieds d'Eagle et des astronautes). */
export const GROUND = { y: 0.78 } as const;

/** Échelle dans `echelle_eagle` : verticale en `x`, du haut (`top`) au bas (`bottom`, juste au-dessus du pied). */
export const LADDER = { x: 0.36, top: 0.23, bottom: 0.7, ground: 0.95 } as const;

const MOON = 0x9c9a94;
const MOON_DARK = 0x6f6d68;
const MOON_LIGHT = 0xc4c1b9;
const GOLD = 0xd9a93a;
const GOLD_DARK = 0xa87a22;

function stars(g: G, w: number, h: number, n: number): void {
  g.fillStyle(C.cream, 0.9);
  for (let i = 0; i < n; i++) g.fillCircle((i * 397) % w, (i * 233) % h, 1.2 + (i % 3) * 0.8);
}

function crater(g: G, x: number, y: number, rx: number, ry: number): void {
  g.fillStyle(MOON_DARK, 1);
  g.fillEllipse(x, y, rx * 2, ry * 2);
  g.fillStyle(MOON_LIGHT, 1);
  g.fillEllipse(x + rx * 0.12, y + ry * 0.18, rx * 1.6, ry * 1.5);
  g.fillStyle(0x86847e, 1);
  g.fillEllipse(x + rx * 0.05, y + ry * 0.1, rx * 1.45, ry * 1.3);
}

/** Décors du chapitre 4. Renvoie faux si l'identifiant n'en fait pas partie. */
export function drawC4Decor(g: G, id: string): boolean {
  const W = WIDTH;
  const H = HEIGHT;
  switch (id) {
    case 'lune_surface': {
      // Vue plongeante depuis Eagle : ciel noir en haut, horizon courbe, plaine grise semée de cratères.
      g.fillStyle(0x05070d, 1);
      g.fillRect(0, 0, W, H);
      stars(g, W, H * 0.2, 40);
      g.fillStyle(MOON, 1);
      g.fillEllipse(W / 2, H * 1.6, W * 2.6, H * 2.9);
      // Cratères, plus petits vers l'horizon ; la zone de pose (LANDING) reste dégagée.
      const list = [
        [0.12, 0.3, 60, 14], [0.33, 0.27, 40, 9], [0.7, 0.29, 70, 15], [0.9, 0.34, 50, 12],
        [0.2, 0.45, 110, 30], [0.52, 0.4, 70, 20], [0.82, 0.48, 120, 34],
        [0.1, 0.7, 170, 55], [0.3, 0.86, 120, 40], [0.76, 0.8, 190, 60], [0.92, 0.66, 90, 30], [0.62, 0.95, 140, 40],
      ];
      for (const [fx, fy, rx, ry] of list) crater(g, W * fx, H * fy, rx, ry);
      return true;
    }
    case 'lune_sol': {
      // Vue de côté : ciel noir étoilé, sol gris ondulé jusqu'à l'horizon.
      g.fillStyle(0x05070d, 1);
      g.fillRect(0, 0, W, H);
      stars(g, W, H * 0.5, 70);
      g.fillStyle(MOON, 1);
      g.fillPoints(
        [
          { x: 0, y: H * 0.56 },
          { x: W * 0.25, y: H * 0.54 },
          { x: W * 0.5, y: H * 0.57 },
          { x: W * 0.78, y: H * 0.53 },
          { x: W, y: H * 0.56 },
          { x: W, y: H },
          { x: 0, y: H },
        ],
        true,
      );
      vGradient(g, 0, H * 0.6, W, H * 0.4, MOON, MOON_LIGHT);
      for (const [fx, fy, rx, ry] of [
        [0.15, 0.62, 90, 14], [0.62, 0.6, 70, 10], [0.86, 0.7, 140, 24], [0.3, 0.92, 200, 36],
      ]) crater(g, W * fx, H * fy, rx, ry);
      return true;
    }
    case 'salle_controle': {
      // Centre de contrôle de Houston : grand écran au fond, rangées de pupitres avec leurs petits écrans.
      vGradient(g, 0, 0, W, H, 0x1b2a40, 0x2d3d52);
      g.fillStyle(0x0d1622, 1);
      g.fillRoundedRect(W * 0.2, H * 0.08, W * 0.6, H * 0.32, 12);
      g.lineStyle(6, 0x5a6b80, 1);
      g.strokeRoundedRect(W * 0.2, H * 0.08, W * 0.6, H * 0.32, 12);
      // Trajectoire vers la Lune sur le grand écran.
      g.fillStyle(0x3d7fb8, 1);
      g.fillCircle(W * 0.3, H * 0.28, 40);
      g.fillStyle(0xd9d6cf, 1);
      g.fillCircle(W * 0.7, H * 0.18, 26);
      g.lineStyle(4, C.mint, 0.9);
      for (let i = 0; i < 12; i++) {
        const a = i / 12;
        const b = (i + 0.6) / 12;
        const px = (t: number) => W * (0.32 + 0.36 * t);
        const py = (t: number) => H * (0.26 - 0.12 * t - 0.06 * Math.sin(Math.PI * t));
        g.lineBetween(px(a), py(a), px(b), py(b));
      }
      // Rangées de pupitres.
      for (const [y, h, n] of [[0.52, 0.1, 6], [0.68, 0.13, 5], [0.86, 0.16, 4]] as const) {
        const rowW = W * (0.5 + n * 0.08);
        const x0 = (W - rowW) / 2;
        g.fillStyle(0x6f7f74, 1);
        g.fillRect(x0, H * y, rowW, H * h);
        g.lineStyle(4, 0x2a3530, 1);
        g.strokeRect(x0, H * y, rowW, H * h);
        for (let i = 0; i < n; i++) {
          const sx = x0 + (rowW / n) * (i + 0.5);
          g.fillStyle(0x10261a, 1);
          g.fillRect(sx - 40, H * y - 50, 80, 56);
          g.fillStyle(C.mint, 0.8);
          g.fillRect(sx - 30, H * y - 40, 60, 8);
          g.fillRect(sx - 30, H * y - 24, 40, 8);
        }
      }
      return true;
    }
    default:
      return false;
  }
}

/** Le module lunaire Eagle : étage de descente doré à quatre pieds, étage de remontée gris. */
function eagle(g: G): { w: number; h: number } {
  const cx = 210;
  // Pieds et semelles.
  g.lineStyle(10, 0x8a8f99, 1);
  g.lineBetween(cx - 90, 230, cx - 170, 340);
  g.lineBetween(cx + 90, 230, cx + 170, 340);
  g.lineBetween(cx - 40, 250, cx - 70, 350);
  g.lineBetween(cx + 40, 250, cx + 70, 350);
  g.fillStyle(0xb9bec8, 1);
  for (const fx of [-170, 170, -70, 70]) g.fillEllipse(cx + fx, 350, 60, 18);
  // Étage de descente (feuille dorée).
  g.fillStyle(GOLD, 1);
  g.fillPoints(
    [
      { x: cx - 120, y: 170 },
      { x: cx + 120, y: 170 },
      { x: cx + 140, y: 200 },
      { x: cx + 120, y: 260 },
      { x: cx - 120, y: 260 },
      { x: cx - 140, y: 200 },
    ],
    true,
  );
  g.fillStyle(GOLD_DARK, 1);
  g.fillRect(cx - 120, 236, 240, 24);
  g.lineStyle(5, C.ink, 1);
  g.strokeRect(cx - 120, 170, 240, 90);
  // Moteur de descente.
  g.fillStyle(0x5d6270, 1);
  g.fillTriangle(cx - 26, 260, cx + 26, 260, cx, 300);
  // Étage de remontée : cabine grise, hublots triangulaires, antennes.
  g.fillStyle(0xd3d7de, 1);
  g.fillPoints(
    [
      { x: cx - 100, y: 170 },
      { x: cx - 80, y: 70 },
      { x: cx + 40, y: 50 },
      { x: cx + 110, y: 90 },
      { x: cx + 100, y: 170 },
    ],
    true,
  );
  g.lineStyle(5, C.ink, 1);
  g.strokePoints(
    [
      { x: cx - 100, y: 170 },
      { x: cx - 80, y: 70 },
      { x: cx + 40, y: 50 },
      { x: cx + 110, y: 90 },
      { x: cx + 100, y: 170 },
    ],
    true,
  );
  g.fillStyle(0x23305c, 1);
  g.fillTriangle(cx - 60, 90, cx - 20, 90, cx - 40, 130);
  g.fillTriangle(cx + 0, 90, cx + 40, 90, cx + 20, 130);
  g.lineStyle(4, C.ink, 1);
  g.lineBetween(cx + 60, 60, cx + 90, 10);
  g.fillStyle(C.white, 1);
  g.fillCircle(cx + 92, 8, 8);
  return { w: 420, h: 370 };
}

/** Le pied d'Eagle et son échelle, posés sur le sol (gros plan). */
function ladder(g: G): { w: number; h: number } {
  const W = 900;
  const H = 1000;
  // Sol et ciel noir (l'image est posée sur le décor `lune_sol`, mais reste lisible seule).
  g.fillStyle(MOON, 1);
  g.fillEllipse(W * 0.5, H * 0.96, W * 1.1, 120);
  // Étage de descente doré, en haut à droite.
  g.fillStyle(GOLD, 1);
  g.fillRect(W * 0.25, 0, W * 0.75, H * 0.14);
  g.fillStyle(GOLD_DARK, 1);
  g.fillRect(W * 0.25, H * 0.1, W * 0.75, H * 0.04);
  // Plateforme de sortie.
  g.fillStyle(0xb9bec8, 1);
  g.fillRect(W * 0.28, H * 0.14, W * 0.3, 20);
  // Jambe du module et sa semelle.
  g.lineStyle(26, 0x8a8f99, 1);
  g.lineBetween(W * 0.62, H * 0.14, W * 0.5, H * 0.88);
  g.fillStyle(0xb9bec8, 1);
  g.fillEllipse(W * 0.5, H * 0.9, 220, 50);
  g.lineStyle(5, C.ink, 1);
  g.strokeEllipse(W * 0.5, H * 0.9, 220, 50);
  // L'échelle, le long de la jambe.
  const x = W * LADDER.x;
  g.lineStyle(10, 0xd3d7de, 1);
  g.lineBetween(x - 50, H * LADDER.top - 20, x - 50, H * LADDER.bottom + 20);
  g.lineBetween(x + 50, H * LADDER.top - 20, x + 50, H * LADDER.bottom + 20);
  for (let y = H * LADDER.top; y <= H * LADDER.bottom; y += 62) g.lineBetween(x - 50, y, x + 50, y);
  return { w: W, h: H };
}

/** Astronaute en combinaison blanche, vu de dos (sac à dos), bras levés vers l'échelle. */
function astronautBack(g: G): { w: number; h: number } {
  const cx = 150;
  // Bras levés.
  g.lineStyle(34, 0xe9edf2, 1);
  g.lineBetween(cx - 70, 170, cx - 60, 50);
  g.lineBetween(cx + 70, 170, cx + 60, 50);
  g.fillStyle(0xd3d7de, 1);
  g.fillCircle(cx - 60, 42, 20);
  g.fillCircle(cx + 60, 42, 20);
  // Jambes et bottes.
  g.lineStyle(44, 0xe9edf2, 1);
  g.lineBetween(cx - 40, 360, cx - 46, 480);
  g.lineBetween(cx + 40, 360, cx + 46, 480);
  g.fillStyle(0xb9bec8, 1);
  g.fillRoundedRect(cx - 80, 470, 64, 36, 12);
  g.fillRoundedRect(cx + 16, 470, 64, 36, 12);
  // Corps et sac à dos.
  g.fillStyle(0xe9edf2, 1);
  g.fillRoundedRect(cx - 90, 150, 180, 230, 50);
  g.fillStyle(0xd3d7de, 1);
  g.fillRoundedRect(cx - 74, 170, 148, 170, 20);
  g.lineStyle(5, C.ink, 1);
  g.strokeRoundedRect(cx - 74, 170, 148, 170, 20);
  // Casque.
  g.fillStyle(C.white, 1);
  g.fillCircle(cx, 120, 62);
  g.lineStyle(5, C.ink, 1);
  g.strokeCircle(cx, 120, 62);
  return { w: 300, h: 520 };
}

export function drawC4Object(g: G, id: string): { w: number; h: number } | null {
  switch (id) {
    case 'eagle':
      return eagle(g);
    case 'columbia': {
      // Columbia : cône argenté du vaisseau, module de service cylindrique, tuyère.
      g.fillStyle(0xd9dee6, 1);
      g.fillRect(40, 50, 260, 110);
      g.fillStyle(0xeef1f5, 1);
      g.fillTriangle(300, 40, 300, 170, 440, 105);
      g.fillStyle(0x8a93a6, 1);
      g.fillTriangle(40, 70, 40, 140, 0, 105);
      g.fillStyle(0xb9bec8, 1);
      g.fillRect(120, 50, 16, 110);
      g.lineStyle(5, C.ink, 1);
      g.strokeRect(40, 50, 260, 110);
      g.strokeTriangle(300, 40, 300, 170, 440, 105);
      g.fillStyle(0x23305c, 1);
      g.fillCircle(360, 92, 10);
      return { w: 450, h: 210 };
    }
    case 'rochers': {
      // Un champ de gros rochers, avec leurs ombres.
      const rocks = [
        [120, 170, 90, 60], [260, 150, 120, 80], [400, 180, 80, 54], [520, 160, 60, 40], [190, 220, 60, 36], [340, 220, 70, 40],
      ];
      for (const [x, y, rx, ry] of rocks) {
        g.fillStyle(0x3a3936, 0.6);
        g.fillEllipse(x + rx * 0.4, y + ry * 0.6, rx * 2, ry);
        g.fillStyle(0x7d7b75, 1);
        g.fillEllipse(x, y, rx * 1.6, ry * 1.5);
        g.fillStyle(0xa9a69e, 1);
        g.fillEllipse(x - rx * 0.2, y - ry * 0.2, rx * 0.9, ry * 0.7);
        g.lineStyle(4, C.ink, 1);
        g.strokeEllipse(x, y, rx * 1.6, ry * 1.5);
      }
      return { w: 640, h: 270 };
    }
    case 'echelle_eagle':
      return ladder(g);
    case 'astronaute_dos':
      return astronautBack(g);
    case 'terre': {
      // La Terre vue de la Lune : bleue, des nuages, une moitié dans l'ombre.
      g.fillStyle(0x3d7fb8, 1);
      g.fillCircle(150, 150, 130);
      g.fillStyle(0x6fae5a, 1);
      g.fillEllipse(110, 120, 90, 60);
      g.fillEllipse(170, 190, 70, 50);
      g.fillStyle(C.white, 0.9);
      g.fillEllipse(140, 80, 120, 24);
      g.fillEllipse(100, 200, 90, 20);
      g.fillStyle(0x05070d, 0.75);
      g.slice(150, 150, 131, -Math.PI / 2, Math.PI / 2, false);
      g.fillPath();
      g.lineStyle(4, 0x9fd3ec, 0.8);
      g.strokeCircle(150, 150, 130);
      return { w: 300, h: 300 };
    }
    default:
      return null;
  }
}
