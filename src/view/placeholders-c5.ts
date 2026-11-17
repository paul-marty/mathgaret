import { C, HEIGHT, WIDTH } from '../config';
import { vGradient, type G } from './drawkit';

/**
 * Formes provisoires du chapitre 5 (en attendant les images, docs/images/prompts.md, chapitre 5).
 * `eagle_montee` et `eagle_base` ont le même cadre que `eagle` : posés au même endroit, à la même taille,
 * ils reforment le module entier (les images livrées seront découpées dans `eagle.png`, sur le même canevas).
 */

const MOON = 0x9c9a94;
const MOON_LIGHT = 0xc4c1b9;
const GOLD = 0xd9a93a;
const GOLD_DARK = 0xa87a22;
const SILVER = 0xd9dee6;

function stars(g: G, w: number, h: number, n: number): void {
  g.fillStyle(C.cream, 0.9);
  for (let i = 0; i < n; i++) g.fillCircle((i * 397) % w, (i * 233) % h, 1.2 + (i % 3) * 0.8);
}

/** Le haut d'Eagle (étage de remontée) : cabine grise, hublot, antennes. */
function ascent(g: G, cx: number): void {
  const pts = [
    { x: cx - 100, y: 170 },
    { x: cx - 80, y: 70 },
    { x: cx + 40, y: 50 },
    { x: cx + 110, y: 90 },
    { x: cx + 100, y: 170 },
  ];
  g.fillStyle(0xd3d7de, 1);
  g.fillPoints(pts, true);
  g.lineStyle(5, C.ink, 1);
  g.strokePoints(pts, true);
  g.fillStyle(0x23305c, 1);
  g.fillTriangle(cx - 60, 110, cx - 20, 100, cx - 40, 140);
  g.lineStyle(4, 0x8a8f99, 1);
  g.lineBetween(cx + 60, 70, cx + 90, 20);
  g.fillStyle(0x8a8f99, 1);
  g.fillCircle(cx + 92, 18, 12);
  g.fillStyle(0x5d6270, 1);
  g.fillRect(cx - 30, 170, 60, 14);
}

/** Le bas d'Eagle (étage de descente) : feuille dorée, pieds, semelles. */
function descent(g: G, cx: number): void {
  g.lineStyle(10, 0x8a8f99, 1);
  g.lineBetween(cx - 90, 230, cx - 170, 340);
  g.lineBetween(cx + 90, 230, cx + 170, 340);
  g.lineBetween(cx - 40, 250, cx - 70, 350);
  g.lineBetween(cx + 40, 250, cx + 70, 350);
  g.fillStyle(0xb9bec8, 1);
  for (const fx of [-170, 170, -70, 70]) g.fillEllipse(cx + fx, 350, 60, 18);
  const pts = [
    { x: cx - 120, y: 170 },
    { x: cx + 120, y: 170 },
    { x: cx + 140, y: 200 },
    { x: cx + 120, y: 260 },
    { x: cx - 120, y: 260 },
    { x: cx - 140, y: 200 },
  ];
  g.fillStyle(GOLD, 1);
  g.fillPoints(pts, true);
  g.fillStyle(GOLD_DARK, 1);
  g.fillRect(cx - 120, 236, 240, 24);
  g.lineStyle(5, C.ink, 1);
  g.strokeRect(cx - 120, 170, 240, 90);
  g.fillStyle(0x5d6270, 1);
  g.fillTriangle(cx - 26, 260, cx + 26, 260, cx, 300);
}

/** La capsule (module de commande) : cône argenté, bouclier thermique brun en bas. */
function capsule(g: G, cx: number, top: number, s: number): void {
  g.fillStyle(SILVER, 1);
  g.fillTriangle(cx, top, cx - 120 * s, top + 150 * s, cx + 120 * s, top + 150 * s);
  g.fillStyle(0x8a5a3a, 1);
  g.fillEllipse(cx, top + 152 * s, 250 * s, 40 * s);
  g.lineStyle(5, C.ink, 1);
  g.strokeTriangle(cx, top, cx - 120 * s, top + 150 * s, cx + 120 * s, top + 150 * s);
  g.fillStyle(0x23305c, 1);
  g.fillCircle(cx - 30 * s, top + 90 * s, 12 * s);
  g.fillCircle(cx + 30 * s, top + 90 * s, 12 * s);
}

/** Décors du chapitre 5. Renvoie faux si l'identifiant n'en fait pas partie. */
export function drawC5Decor(g: G, id: string): boolean {
  const W = WIDTH;
  const H = HEIGHT;
  switch (id) {
    case 'orbite_lune': {
      // L'espace noir, la Lune en bas, la Terre toute petite au loin.
      g.fillStyle(0x05070d, 1);
      g.fillRect(0, 0, W, H);
      stars(g, W, H, 130);
      g.fillStyle(MOON, 1);
      g.fillEllipse(W * 0.5, H * 1.55, W * 1.7, H * 1.5);
      g.fillStyle(MOON_LIGHT, 0.5);
      g.fillEllipse(W * 0.42, H * 0.95, W * 0.5, H * 0.1);
      g.fillStyle(0x3d7fb8, 1);
      g.fillCircle(W * 0.86, H * 0.16, 34);
      g.fillStyle(C.white, 0.8);
      g.fillEllipse(W * 0.86, H * 0.14, 40, 10);
      return true;
    }
    case 'terre_proche': {
      // Près de la Terre (C5.4) : l'espace étoilé, un grand morceau du disque terrestre en bas à droite
      // (centre x 0,78 et y 1,16 de la hauteur, rayon 0,70 de la hauteur : son bord est à 0,46 de la hauteur).
      g.fillStyle(0x05070d, 1);
      g.fillRect(0, 0, W, H);
      stars(g, W, H, 110);
      g.fillStyle(0x9fd3ec, 1);
      g.fillCircle(W * 0.78, H * 1.16, H * 0.7 + 8);
      g.fillStyle(0x3d7fb8, 1);
      g.fillCircle(W * 0.78, H * 1.16, H * 0.7);
      return true;
    }
    case 'rentree_ciel': {
      // Très haut au-dessus de la Terre : ciel bleu nuit vers bleu clair, courbe de l'horizon, nuages.
      vGradient(g, 0, 0, W, H, 0x0b1430, 0x3d7fb8);
      g.fillStyle(0x6fa8d8, 1);
      g.fillEllipse(W * 0.5, H * 1.9, W * 2.4, H * 1.9);
      g.fillStyle(C.white, 0.75);
      for (const [fx, fy, w, h] of [[0.15, 0.82, 380, 60], [0.45, 0.9, 520, 70], [0.78, 0.84, 420, 60], [0.92, 0.95, 300, 50]]) {
        g.fillEllipse(W * fx, H * fy, w, h);
      }
      return true;
    }
    case 'ocean': {
      // L'océan Pacifique sous un ciel clair : horizon, vagues, quelques nuages.
      vGradient(g, 0, 0, W, H * 0.55, 0x8fc7ea, 0xd6ecf7);
      g.fillStyle(C.white, 0.9);
      for (const [fx, fy, w, h] of [[0.2, 0.14, 320, 60], [0.62, 0.1, 420, 70], [0.86, 0.22, 260, 50]]) g.fillEllipse(W * fx, H * fy, w, h);
      vGradient(g, 0, H * 0.55, W, H * 0.45, 0x2f6fa0, 0x1d4a73);
      g.lineStyle(5, 0x9fd3ec, 0.6);
      for (let i = 0; i < 14; i++) {
        const x = (i * 313) % W;
        const y = H * 0.6 + ((i * 97) % (H * 0.36));
        g.lineBetween(x, y, x + 80, y - 6);
      }
      return true;
    }
    case 'mars': {
      // Mars dans l'espace, rouge orangé, avec ses taches sombres et sa calotte blanche.
      g.fillStyle(0x05070d, 1);
      g.fillRect(0, 0, W, H);
      stars(g, W, H, 140);
      g.fillStyle(0xc4553a, 1);
      g.fillCircle(W * 0.5, H * 0.55, 330);
      g.fillStyle(0x9a3b28, 1);
      g.fillEllipse(W * 0.45, H * 0.5, 260, 90);
      g.fillEllipse(W * 0.58, H * 0.68, 200, 70);
      g.fillStyle(C.cream, 0.9);
      g.fillEllipse(W * 0.5, H * 0.55 - 300, 160, 50);
      g.lineStyle(8, 0xf08a3c, 0.6);
      g.strokeCircle(W * 0.5, H * 0.55, 330);
      return true;
    }
    default:
      return false;
  }
}

/** Objets du chapitre 5, ou null. */
export function drawC5Object(g: G, id: string): { w: number; h: number } | null {
  switch (id) {
    case 'eagle_montee':
      ascent(g, 210);
      return { w: 420, h: 370 };
    case 'eagle_base':
      descent(g, 210);
      return { w: 420, h: 370 };
    case 'module_service': {
      // La grande partie arrière de Columbia : cylindre argenté et tuyère (tourné vers la droite, comme `columbia`).
      g.fillStyle(SILVER, 1);
      g.fillRect(40, 50, 260, 110);
      g.fillStyle(0x8a93a6, 1);
      g.fillTriangle(40, 70, 40, 140, 0, 105);
      g.fillStyle(0xb9bec8, 1);
      g.fillRect(120, 50, 16, 110);
      g.lineStyle(5, C.ink, 1);
      g.strokeRect(40, 50, 260, 110);
      return { w: 310, h: 210 };
    }
    case 'capsule':
      // Pointe en haut, bouclier thermique en bas : la position de la rentrée.
      capsule(g, 140, 10, 1);
      return { w: 280, h: 200 };
    case 'capsule_parachutes': {
      // Trois grandes voiles rouges et blanches, les suspentes, la capsule en dessous.
      const tops = [140, 300, 460];
      for (const [i, x] of tops.entries()) {
        const y = i === 1 ? 90 : 120;
        g.fillStyle(i % 2 ? C.white : 0xe0503a, 1);
        g.slice(x, y, 95, Math.PI, 0, false);
        g.fillPath();
        g.lineStyle(4, C.ink, 1);
        g.beginPath();
        g.arc(x, y, 95, Math.PI, 0, false);
        g.strokePath();
        g.lineStyle(2, C.ink, 0.8);
        g.lineBetween(x - 95, y, 300, 470);
        g.lineBetween(x + 95, y, 300, 470);
      }
      capsule(g, 300, 470, 0.7);
      return { w: 600, h: 590 };
    }
    case 'helicoptere': {
      // Un hélicoptère gris marine, vu de côté, le nez vers la droite (il arrive par la gauche).
      g.fillStyle(0x5d6b7a, 1);
      g.fillEllipse(290, 120, 220, 110);
      g.fillRect(30, 105, 180, 24);
      g.fillStyle(0x9fd3ec, 1);
      g.fillEllipse(350, 110, 90, 60);
      g.lineStyle(5, C.ink, 1);
      g.strokeEllipse(290, 120, 220, 110);
      g.lineStyle(8, 0x3a3f48, 1);
      g.lineBetween(130, 40, 430, 40);
      g.lineBetween(280, 40, 280, 66);
      g.lineBetween(30, 90, 30, 145);
      g.lineBetween(230, 176, 340, 176);
      return { w: 460, h: 200 };
    }
    case 'navire': {
      // Un grand bateau gris (porte-avions) sur l'eau, vu de côté.
      g.fillStyle(0x6d7783, 1);
      g.fillPoints(
        [
          { x: 0, y: 120 },
          { x: 900, y: 120 },
          { x: 860, y: 200 },
          { x: 40, y: 200 },
        ],
        true,
      );
      g.fillStyle(0x8a93a6, 1);
      g.fillRect(560, 50, 90, 70);
      g.fillRect(590, 10, 30, 40);
      g.lineStyle(5, C.ink, 1);
      g.strokeRect(560, 50, 90, 70);
      g.lineBetween(0, 120, 900, 120);
      g.fillStyle(0x23305c, 1);
      for (let i = 0; i < 4; i++) g.fillRect(575 + i * 18, 70, 10, 14);
      return { w: 900, h: 210 };
    }
    // C5.1 : la boîte de cailloux de Lune et les objets laissés sur la Lune pour alléger Eagle.
    case 'boite_cailloux': {
      // Une caisse en aluminium à deux fermoirs, des cailloux gris qui dépassent du couvercle entrouvert.
      g.fillStyle(MOON, 1);
      for (const [x, r] of [
        [70, 26],
        [118, 32],
        [170, 24],
      ] as const)
        g.fillCircle(x, 62, r);
      g.fillStyle(SILVER, 1);
      g.fillRoundedRect(20, 60, 200, 110, 12);
      g.fillStyle(0xb9bec8, 1);
      g.fillRect(20, 60, 200, 26);
      g.fillStyle(C.ink, 1);
      g.fillRect(58, 78, 20, 26);
      g.fillRect(162, 78, 20, 26);
      g.lineStyle(5, C.ink, 1);
      g.strokeRoundedRect(20, 60, 200, 110, 12);
      g.lineBetween(20, 86, 220, 86);
      return { w: 240, h: 180 };
    }
    case 'lune_sac': {
      // Le sac à dos des astronautes (il garde l'air et le froid) : un grand boîtier blanc, ses sangles, un petit boîtier.
      g.fillStyle(0xeef1f5, 1);
      g.fillRoundedRect(40, 50, 140, 170, 22);
      g.fillStyle(SILVER, 1);
      g.fillRoundedRect(60, 14, 100, 44, 10);
      g.fillStyle(0x7fb8d8, 1);
      g.fillRect(60, 120, 100, 14);
      g.lineStyle(5, C.ink, 1);
      g.strokeRoundedRect(40, 50, 140, 170, 22);
      g.strokeRoundedRect(60, 14, 100, 44, 10);
      g.lineStyle(10, 0x8a93a6, 1);
      g.lineBetween(70, 60, 70, 210);
      g.lineBetween(150, 60, 150, 210);
      return { w: 220, h: 230 };
    }
    case 'lune_bottes': {
      // Une paire de grosses bottes de Lune, blanches à semelle bleue.
      for (const x of [20, 120]) {
        g.fillStyle(0xeef1f5, 1);
        g.fillRoundedRect(x, 20, 60, 120, 14);
        g.fillRoundedRect(x, 100, 100, 48, 18);
        g.fillStyle(0x3d7fb8, 1);
        g.fillRect(x, 140, 100, 16);
        g.lineStyle(5, C.ink, 1);
        g.strokeRoundedRect(x, 20, 60, 120, 14);
        g.strokeRoundedRect(x, 100, 100, 56, 18);
      }
      return { w: 240, h: 170 };
    }
    case 'lune_appareil': {
      // Un appareil photo argenté et son gros objectif noir.
      g.fillStyle(SILVER, 1);
      g.fillRoundedRect(20, 40, 180, 120, 14);
      g.fillStyle(0x3a3f48, 1);
      g.fillRect(150, 20, 50, 30);
      g.fillCircle(110, 100, 46);
      g.fillStyle(0x7fb8d8, 1);
      g.fillCircle(110, 100, 22);
      g.lineStyle(5, C.ink, 1);
      g.strokeRoundedRect(20, 40, 180, 120, 14);
      g.strokeCircle(110, 100, 46);
      return { w: 220, h: 180 };
    }
    case 'lune_pelle': {
      // Une petite pelle à long manche, en biais.
      g.lineStyle(16, 0x8a93a6, 1);
      g.lineBetween(40, 30, 160, 150);
      g.lineStyle(5, C.ink, 1);
      g.strokeRect(24, 14, 34, 22);
      g.fillStyle(SILVER, 1);
      g.fillTriangle(140, 130, 210, 160, 170, 200);
      g.fillCircle(185, 172, 30);
      g.lineStyle(5, C.ink, 1);
      g.strokeCircle(185, 172, 30);
      return { w: 230, h: 220 };
    }
    case 'lune_marteau': {
      // Un marteau de géologue : manche en biais, tête métallique.
      g.lineStyle(18, 0xa87a22, 1);
      g.lineBetween(50, 190, 150, 70);
      g.fillStyle(0x8a93a6, 1);
      g.fillRoundedRect(90, 30, 130, 52, 12);
      g.lineStyle(5, C.ink, 1);
      g.strokeRoundedRect(90, 30, 130, 52, 12);
      return { w: 240, h: 210 };
    }
    case 'equipe_fete': {
      // L'équipe du laboratoire en silhouettes joyeuses, bras levés (personnes inventées).
      const colors = [0x7fb8d8, 0xf2c14e, 0x8fd1b5, 0xf08a3c, 0xc9d6e8];
      for (let i = 0; i < 5; i++) {
        const x = 90 + i * 150;
        const y = 150 + (i % 2) * 20;
        g.fillStyle(colors[i], 1);
        g.fillRoundedRect(x - 45, y, 90, 170, 30);
        g.fillStyle(0xe8c4a0, 1);
        g.fillCircle(x, y - 30, 34);
        g.lineStyle(14, colors[i], 1);
        g.lineBetween(x - 40, y + 20, x - 70, y - 60);
        g.lineBetween(x + 40, y + 20, x + 70, y - 60);
        g.lineStyle(4, C.ink, 1);
        g.strokeCircle(x, y - 30, 34);
      }
      return { w: 780, h: 340 };
    }
    default:
      return null;
  }
}
