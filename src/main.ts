import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-ext-400.css';
import '@fontsource/fredoka/latin-ext-600.css';
import * as Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import { loadAudioManifest } from './audio/manifest';
import { HEIGHT, URLP, WIDTH } from './config';
import { installKeyboard } from './core/input';
import { BilanScene } from './scenes/BilanScene';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { OverlayScene } from './scenes/OverlayScene';
import { StoryScene } from './scenes/StoryScene';
import { TitleScene } from './scenes/TitleScene';
import { installConsole } from './devtools';
import { services } from './services';
import { imageStatus } from './view/assets';

async function loadFonts(): Promise<void> {
  try {
    await Promise.all(['400', '600'].map((w) => document.fonts.load(`${w} 40px Fredoka`)));
  } catch {
    /* police de secours */
  }
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  else void document.documentElement.requestFullscreen?.().catch(() => undefined);
}

/** Le son ne peut démarrer qu'après un geste réel (touche, toucher, clic). */
function setupInteractions(): void {
  const unlock = (e: Event) => {
    if (!e.isTrusted) return;
    // Sur écran tactile, l'activation navigateur arrive au relâchement du doigt.
    if (e.type === 'pointerdown' && (e as PointerEvent).pointerType !== 'mouse') return;
    services.audio.unlock();
    services.back.arm();
  };
  for (const type of ['keydown', 'pointerdown', 'pointerup', 'touchend', 'click']) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }
  installKeyboard(services.input, toggleFullscreen);
  window.addEventListener('pointerdown', () => services.input.noteInteraction({ source: 'pointer', trusted: true }), { capture: true });

  const f = services.focus;
  f.hooks.moved = () => services.sfx.tick();
  f.hooks.speak = (label) => void services.voice.sayLabel(label);
}

/**
 * Jeu « increvable » : Phaser ne redemande pas l'image suivante si une erreur survient pendant une image,
 * ce qui figerait tout l'écran. L'erreur est notée, et le jeu continue à l'image suivante.
 */
class SafeGame extends Phaser.Game {
  override step(time: number, delta: number): void {
    try {
      super.step(time, delta);
    } catch (err) {
      services.diag.erreur(err, 'boucle de jeu');
    }
  }
}

function watchErrors(): void {
  window.addEventListener('error', (e) => services.diag.erreur(e.error ?? e.message, 'page'));
  window.addEventListener('unhandledrejection', (e) => services.diag.erreur(e.reason, 'promesse'));
}

function exposeDebug(game: Phaser.Game): void {
  if (!import.meta.env.DEV && !URLP.debug) return;
  (window as unknown as Record<string, unknown>).__mathgaret = {
    game,
    services,
    images: imageStatus,
    state: () => ({
      scenes: game.scene.getScenes(true).map((s) => s.scene.key),
      scene: services.debug.scene,
      problem: services.debug.problem,
      budget: services.debug.budget,
      voice: services.voice.current,
      voiceLog: services.voice.log.map((l) => l.id),
      voiceFiles: services.voice.log.filter((l) => l.via === 'fichier').map((l) => l.id),
      /** Répliques assemblées à partir de plusieurs fichiers (morceaux et nombres) : id → nombre de fichiers. */
      voiceParts: Object.fromEntries(services.voice.log.filter((l) => (l.parts ?? 0) > 1).map((l) => [l.id, l.parts])),
      voiceLast: services.voice.log.slice(-5).map((l) => ({ id: l.id, speaker: l.speaker, via: l.via })),
      sons: [...services.sfx.played],
      musique: services.music.playing,
      focus: services.focus.current ? services.focus.current.bounds() : null,
      layers: services.focus.layers.map((l) => l.name),
      save: services.save.data,
      activeMs: services.clock.activeMs,
      paused: services.clock.paused,
      hud: services.ui.overlay?.visibleHud() ?? [],
      audio: services.audio.debugState(),
      answering: services.ui.story?.answering ?? false,
      busy: services.ui.story?.busy ?? false,
      validate: services.debug.validate,
      diag: {
        step: services.diag.step,
        /** L'histoire attend que l'enfant touche un objet (même si une réplique est dite en même temps). */
        waiting: services.diag.waitingForChild,
        secours: services.diag.journal.filter((e) => e.kind === 'secours').map((e) => e.text),
        blocages: services.diag.count('blocage'),
        erreurs: services.diag.count('erreur'),
        journal: services.diag.journal.slice(-40),
      },
    }),
    solve: (wrong?: boolean) => (services.debug.solve as ((w?: boolean) => void) | undefined)?.(wrong),
  };
}

function start(): void {
  const save = services.save.load();
  services.sfx.gentle = save.settings.gentle;
  services.ready = Promise.all([loadFonts(), loadAudioManifest(`${import.meta.env.BASE_URL}audio/manifest.json`, services)]);
  setupInteractions();
  watchErrors();

  const game = new SafeGame({
    type: URLP.canvas ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game',
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#101a33',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // Le son passe par notre moteur Web Audio (ducking, effet radio) ; les entrées par notre couche unifiée.
    audio: { noAudio: true },
    input: { keyboard: false, gamepad: false },
    scene: [BootScene, TitleScene, MenuScene, StoryScene, BilanScene, OverlayScene],
  });
  exposeDebug(game);
  installConsole(game);

  // Mise à jour du jeu installé (PWA) : appliquée au prochain lancement.
  registerSW({ immediate: true });
}

start();
