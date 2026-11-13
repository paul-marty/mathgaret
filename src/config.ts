import type * as Phaser from 'phaser';

/** Taille logique du jeu : tout est dessiné en 1920×1080 puis mis à l'échelle (FIT) sur l'écran. */
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Marge de sécurité TV (~5 %) : rien d'important au-delà. */
export const SAFE = { left: 96, top: 54, right: WIDTH - 96, bottom: HEIGHT - 54 };

export const FONT = 'Fredoka, "Trebuchet MS", system-ui, sans-serif';

/** Palette commune aux images ChatGPT (docs/images/prompts.md) et aux éléments dessinés par le jeu. */
export const C = {
  night: 0x1d2b4f,
  nightDeep: 0x101a33,
  sky: 0x7fb8d8,
  orange: 0xf08a3c,
  mustard: 0xf2c14e,
  mint: 0x8fd1b5,
  cream: 0xf6ecd9,
  brick: 0xc4553a,
  ink: 0x3a2a20,
  green: 0x5fcf7a,
  greenDark: 0x2f8f4e,
  white: 0xffffff,
  grey: 0x8a93a6,
  focus: 0xffe066,
} as const;

export const CSS = {
  ink: '#3a2a20',
  cream: '#f6ecd9',
  night: '#1d2b4f',
  white: '#ffffff',
  mustard: '#f2c14e',
  orange: '#f08a3c',
  mint: '#8fd1b5',
} as const;

export const SCENES = {
  Boot: 'Boot',
  Title: 'Title',
  Menu: 'Menu',
  Story: 'Story',
  Bilan: 'Bilan',
  Overlay: 'Overlay',
} as const;

export function textStyle(size: number, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, color: CSS.cream, fontStyle: '600', ...extra };
}

const params = new URLSearchParams(location.search);

/** Paramètres d'URL utiles au développement et aux tests. */
export const URLP = {
  debug: params.has('debug'),
  /** Accélère tout le jeu (tests) : ?vitesse=20. Modifiable en cours de partie par la console (mg.vitesse). */
  speed: Math.max(1, Number(params.get('vitesse')) || 1),
  /** Pas de voix de synthèse provisoire (tests) : ?voix=muette */
  mute: params.get('voix') === 'muette',
  canvas: params.get('renderer') === 'canvas',
  /** Démarre directement une scène : ?scene=c1.2 (avec ?niveau=debut|milieu|fin) */
  scene: params.get('scene'),
  profile: params.get('niveau'),
  /** Graine des tirages (tests reproductibles) : ?graine=42 */
  seed: params.has('graine') ? Number(params.get('graine')) : null,
};
