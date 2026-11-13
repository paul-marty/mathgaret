import type * as Phaser from 'phaser';
import { C } from '../config';

/**
 * Pictogrammes dessinés par le jeu (nets à toutes les tailles, sans lecture).
 * Chaque fonction dessine centré en (0, 0) dans un carré de côté `s`.
 */
export type IconName =
  | 'speaker'
  | 'helper'
  | 'token'
  | 'pause'
  | 'play'
  | 'check'
  | 'plus'
  | 'minus'
  | 'home'
  | 'rocket'
  | 'replay'
  | 'star'
  | 'clock'
  | 'feather'
  | 'subtitles'
  | 'cross';

type G = Phaser.GameObjects.Graphics;

export function drawIcon(g: G, name: IconName, s: number, color: number = C.ink, extra?: number): void {
  const u = s / 100;
  g.fillStyle(color, 1);
  g.lineStyle(9 * u, color, 1);
  switch (name) {
    case 'speaker': {
      g.fillRect(-34 * u, -14 * u, 18 * u, 28 * u);
      g.fillTriangle(-18 * u, -14 * u, 6 * u, -34 * u, 6 * u, 34 * u);
      g.fillTriangle(-18 * u, -14 * u, -18 * u, 14 * u, 6 * u, 34 * u);
      g.beginPath();
      g.arc(10 * u, 0, 18 * u, -0.9, 0.9);
      g.strokePath();
      g.beginPath();
      g.arc(10 * u, 0, 34 * u, -0.9, 0.9);
      g.strokePath();
      break;
    }
    case 'helper': {
      // Le Collègue : tête, cheveux en bataille, cravate.
      g.fillStyle(0xf3c9a4, 1);
      g.fillCircle(0, -6 * u, 26 * u);
      g.fillStyle(0x5a3a22, 1);
      g.fillTriangle(-26 * u, -16 * u, -10 * u, -42 * u, 2 * u, -24 * u);
      g.fillTriangle(-8 * u, -24 * u, 8 * u, -46 * u, 18 * u, -22 * u);
      g.fillTriangle(6 * u, -24 * u, 28 * u, -38 * u, 26 * u, -12 * u);
      g.fillStyle(C.ink, 1);
      g.fillCircle(-9 * u, -8 * u, 3.5 * u);
      g.fillCircle(9 * u, -8 * u, 3.5 * u);
      g.lineStyle(4 * u, C.ink, 1);
      g.beginPath();
      g.arc(0, 2 * u, 10 * u, 0.3, Math.PI - 0.3);
      g.strokePath();
      g.fillStyle(C.white, 1);
      g.fillRect(-30 * u, 22 * u, 60 * u, 22 * u);
      g.fillStyle(C.orange, 1);
      g.fillTriangle(-6 * u, 22 * u, 6 * u, 22 * u, 0, 44 * u);
      break;
    }
    case 'token': {
      g.fillStyle(C.orange, 1);
      g.fillCircle(0, 0, 36 * u);
      g.lineStyle(5 * u, C.ink, 1);
      g.strokeCircle(0, 0, 36 * u);
      g.fillStyle(C.mustard, 1);
      star(g, 0, 0, 18 * u, 8 * u);
      break;
    }
    case 'pause':
      g.fillRoundedRect(-26 * u, -32 * u, 18 * u, 64 * u, 5 * u);
      g.fillRoundedRect(8 * u, -32 * u, 18 * u, 64 * u, 5 * u);
      break;
    case 'play':
      g.fillTriangle(-20 * u, -34 * u, -20 * u, 34 * u, 34 * u, 0);
      break;
    case 'check':
      g.lineStyle(16 * u, color, 1);
      g.beginPath();
      g.moveTo(-32 * u, 2 * u);
      g.lineTo(-8 * u, 26 * u);
      g.lineTo(34 * u, -26 * u);
      g.strokePath();
      break;
    case 'plus':
      g.fillRoundedRect(-34 * u, -9 * u, 68 * u, 18 * u, 6 * u);
      g.fillRoundedRect(-9 * u, -34 * u, 18 * u, 68 * u, 6 * u);
      break;
    case 'minus':
      g.fillRoundedRect(-34 * u, -9 * u, 68 * u, 18 * u, 6 * u);
      break;
    case 'cross':
      g.lineStyle(14 * u, color, 1);
      g.lineBetween(-26 * u, -26 * u, 26 * u, 26 * u);
      g.lineBetween(26 * u, -26 * u, -26 * u, 26 * u);
      break;
    case 'home':
      g.fillTriangle(-38 * u, -2 * u, 0, -36 * u, 38 * u, -2 * u);
      g.fillRect(-26 * u, -4 * u, 52 * u, 38 * u);
      g.fillStyle(C.cream, 1);
      g.fillRect(-8 * u, 12 * u, 16 * u, 22 * u);
      break;
    case 'rocket': {
      g.fillStyle(C.white, 1);
      g.fillEllipse(0, -2 * u, 32 * u, 70 * u);
      g.fillStyle(C.orange, 1);
      g.fillTriangle(-16 * u, 10 * u, -30 * u, 34 * u, -10 * u, 26 * u);
      g.fillTriangle(16 * u, 10 * u, 30 * u, 34 * u, 10 * u, 26 * u);
      g.fillStyle(C.sky, 1);
      g.fillCircle(0, -10 * u, 8 * u);
      g.fillStyle(C.mustard, 1);
      g.fillTriangle(-8 * u, 32 * u, 8 * u, 32 * u, 0, 48 * u);
      g.lineStyle(4 * u, C.ink, 1);
      g.strokeEllipse(0, -2 * u, 32 * u, 70 * u);
      break;
    }
    case 'replay':
      g.lineStyle(11 * u, color, 1);
      g.beginPath();
      g.arc(0, 0, 28 * u, -2.6, 2.2);
      g.strokePath();
      g.fillTriangle(-36 * u, -30 * u, -6 * u, -26 * u, -28 * u, -2 * u);
      break;
    case 'star':
      star(g, 0, 0, 40 * u, 18 * u);
      break;
    case 'clock': {
      // extra = minutes (30, 45, 60) : la part remplie du cadran.
      const frac = (extra ?? 60) / 60;
      g.fillStyle(C.cream, 1);
      g.fillCircle(0, 0, 38 * u);
      g.fillStyle(color, 1);
      g.slice(0, 0, 38 * u, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false);
      g.fillPath();
      g.lineStyle(6 * u, C.ink, 1);
      g.strokeCircle(0, 0, 38 * u);
      break;
    }
    case 'feather':
      g.fillStyle(color, 1);
      g.fillEllipse(0, -4 * u, 34 * u, 70 * u);
      g.lineStyle(5 * u, C.ink, 1);
      g.lineBetween(-12 * u, 40 * u, 10 * u, -32 * u);
      break;
    case 'subtitles':
      g.lineStyle(7 * u, color, 1);
      g.strokeRoundedRect(-40 * u, -28 * u, 80 * u, 56 * u, 8 * u);
      g.fillRect(-26 * u, 0, 30 * u, 8 * u);
      g.fillRect(10 * u, 0, 16 * u, 8 * u);
      g.fillRect(-26 * u, 14 * u, 52 * u, 8 * u);
      break;
  }
}

export function star(g: G, x: number, y: number, outer: number, inner: number): void {
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  g.fillPoints(pts, true);
}
