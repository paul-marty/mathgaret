import type * as Phaser from 'phaser';
import { C } from '../config';

/** Outils de dessin des formes provisoires (en attendant les images ChatGPT). */

export type G = Phaser.GameObjects.Graphics;
export const SKIN = 0xf3c9a4;
export const HAIR_M = 0x7a4a2a;
export const HAIR_C = 0x4a301c;

export function vGradient(g: G, x: number, y: number, w: number, h: number, top: number, bottom: number, steps = 24): void {
  const a = { r: (top >> 16) & 255, g: (top >> 8) & 255, b: top & 255 };
  const b = { r: (bottom >> 16) & 255, g: (bottom >> 8) & 255, b: bottom & 255 };
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const c = (Math.round(a.r + (b.r - a.r) * t) << 16) | (Math.round(a.g + (b.g - a.g) * t) << 8) | Math.round(a.b + (b.b - a.b) * t);
    g.fillStyle(c, 1);
    g.fillRect(x, y + (h * i) / steps, w, h / steps + 1);
  }
}

export function limb(g: G, x1: number, y1: number, x2: number, y2: number, w: number, color: number): void {
  g.lineStyle(w, color, 1);
  g.lineBetween(x1, y1, x2, y2);
  g.fillStyle(color, 1);
  g.fillCircle(x1, y1, w / 2);
  g.fillCircle(x2, y2, w / 2);
}

export function face(g: G, cx: number, cy: number, r: number, mood: string): void {
  g.fillStyle(C.ink, 1);
  const eyesClosed = mood === 'soulage';
  if (eyesClosed) {
    g.lineStyle(5, C.ink, 1);
    g.beginPath();
    g.arc(cx - r * 0.35, cy - r * 0.1, r * 0.13, 0.2, Math.PI - 0.2);
    g.strokePath();
    g.beginPath();
    g.arc(cx + r * 0.35, cy - r * 0.1, r * 0.13, 0.2, Math.PI - 0.2);
    g.strokePath();
  } else {
    const er = mood === 'stupefait' || mood === 'surprise' ? r * 0.11 : r * 0.08;
    g.fillCircle(cx - r * 0.35, cy - r * 0.1, er);
    g.fillCircle(cx + r * 0.35, cy - r * 0.1, er);
  }
  if (mood === 'stupefait' || mood === 'surprise' || mood === 'chuchote') {
    g.fillStyle(0x8a3a2a, 1);
    g.fillEllipse(cx, cy + r * 0.42, r * 0.28, mood === 'chuchote' ? r * 0.16 : r * 0.34);
  } else if (mood === 'inquiet') {
    g.lineStyle(5, C.ink, 1);
    g.beginPath();
    g.arc(cx, cy + r * 0.62, r * 0.28, Math.PI + 0.5, -0.5);
    g.strokePath();
  } else {
    g.lineStyle(5, C.ink, 1);
    g.beginPath();
    const big = mood === 'joie' || mood === 'enthousiaste' || mood === 'applaudit';
    g.arc(cx, cy + r * 0.18, big ? r * 0.38 : r * 0.28, 0.35, Math.PI - 0.35);
    g.strokePath();
  }
}

