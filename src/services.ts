import { AudioEngine, type BrowserAudioSession } from './audio/AudioEngine';
import { Music } from './audio/Music';
import { Sfx } from './audio/Sfx';
import { Voice } from './audio/Voice';
import { GameClock } from './core/clock';
import { Diag } from './core/diag';
import { BackGuard, GamepadSource } from './core/gamepad';
import { InputHub } from './core/input';
import { makeRng } from './core/rng';
import { SaveStore } from './core/save';
import { URLP } from './config';
import type { StoryScene } from './scenes/StoryScene';
import { FocusManager } from './view/focus';

/** Ce que la scène Overlay (toujours au premier plan) offre aux autres scènes. */
export interface OverlayApi {
  setHud(mode: 'hidden' | 'story' | 'challenge'): void;
  setBusy(on: boolean): void;
  pulse(name: 'reecouter' | 'aide' | null): void;
  /** Boutons d'aide affichés (tests). */
  visibleHud(): string[];
}

const input = new InputHub();
const gamepad = new GamepadSource(input);
const clock = new GameClock(URLP.speed);
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const audioSession = ios ? (navigator as Navigator & { audioSession?: BrowserAudioSession }).audioSession : undefined;
const audio = new AudioEngine(audioSession);
const diag = new Diag();

/** Services partagés par toutes les scènes. */
export const services = {
  input,
  gamepad,
  back: new BackGuard(input, gamepad),
  focus: new FocusManager(input),
  clock,
  audio,
  sfx: new Sfx(audio),
  music: new Music(audio),
  voice: new Voice(audio, clock, diag, URLP.mute),
  /** Journal de fiabilité : étape en cours, filets de sécurité déclenchés, blocages, erreurs. */
  diag,
  save: new SaveStore(),
  rng: makeRng(URLP.seed ?? (Date.now() & 0xffffffff)),
  ui: { overlay: null as OverlayApi | null, story: null as StoryScene | null },
  /** Résolu quand polices et manifeste audio sont chargés. */
  ready: Promise.resolve() as Promise<unknown>,
  /** Données exposées aux tests (?debug). */
  debug: {} as Record<string, unknown>,
};

// Variantes des répliques : leur propre flux, reproductible avec la graine des tests, sans décaler celui des problèmes.
services.voice.random = makeRng(((URLP.seed ?? Date.now()) ^ 0x5eed) >>> 0);

export type Services = typeof services;
