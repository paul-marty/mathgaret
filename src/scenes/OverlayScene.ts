import * as Phaser from 'phaser';
import { C, SCENES, textStyle, URLP } from '../config';
import { services, type OverlayApi } from '../services';
import { Button } from '../view/Button';

type HudName = 'reecouter' | 'aide';

/**
 * Scène toujours au premier plan : boutons d'aide, cadre de sélection, sous-titres.
 * Elle fait aussi avancer l'horloge du jeu et lit la manette.
 *
 * Pas de pause pendant l'aventure (choix de l'utilisateur, à la place de P4). Seule exception technique :
 * quand l'application passe en arrière-plan, le jeu se fige sans rien afficher et repart au retour,
 * pour que le temps hors de l'application ne compte pas (section 7) et qu'aucune réplique ne soit perdue.
 */
export class OverlayScene extends Phaser.Scene implements OverlayApi {
  private hud!: Record<HudName, Button>;
  private ring!: Phaser.GameObjects.Graphics;
  private subtitle!: Phaser.GameObjects.Container;
  private subName!: Phaser.GameObjects.Text;
  private subText!: Phaser.GameObjects.Text;
  private hiddenAt: number | null = null;
  private diagText: Phaser.GameObjects.Text | null = null;
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super(SCENES.Overlay);
  }

  create(): void {
    services.ui.overlay = this;
    const mk = (x: number, icon: 'speaker' | 'helper', label: string, onPress: () => void) =>
      new Button(this, { x, y: 110, w: 124, h: 124, icon, iconSize: 84, label, onPress }).setDepth(10);
    this.hud = {
      reecouter: mk(1625, 'speaker', 'hud_reecouter', () => services.ui.story?.request('reecouter')),
      aide: mk(1770, 'helper', 'hud_aide', () => services.ui.story?.request('aide')),
    };
    this.setHud('hidden');

    this.ring = this.add.graphics().setDepth(100);
    this.buildSubtitles();
    // Mode débogage : l'étape en cours du scénario, en bas à gauche (pour comprendre un éventuel blocage).
    if (URLP.debug) {
      this.diagText = this.add
        .text(16, 1068, '', textStyle(24, { backgroundColor: '#101a33cc', padding: { x: 10, y: 4 } }))
        .setOrigin(0, 1)
        .setDepth(120);
    }

    services.voice.on((e, spoken) => {
      if (spoken.kind !== 'line') return;
      if (e === 'start' && (services.save.data.settings.subtitles || URLP.debug)) this.showSubtitle(spoken.speaker, spoken.text);
      if (e === 'end') this.subtitle.setVisible(false);
    });

    // « Retour » (Échap, B, télécommande) n'a pas d'effet pendant l'aventure : il n'y a pas de pause.
    services.input.on((intent) => {
      if (intent.type === 'shortcut') services.ui.story?.request(intent.name);
    });

    const freeze = () => this.freeze();
    const syncVisibility = () => (document.hidden ? this.freeze() : this.thaw());
    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('pagehide', freeze);
    window.addEventListener('pageshow', syncVisibility);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('pagehide', freeze);
      window.removeEventListener('pageshow', syncVisibility);
    });
    syncVisibility();
  }

  override update(_time: number, delta: number): void {
    services.gamepad.poll();
    services.clock.tick(delta);
    this.watchStory(delta);
    this.drawRing();
  }

  /**
   * Garde-fou : pendant l'histoire, si rien n'avance pendant 40 s alors que l'enfant n'a rien à faire,
   * c'est un blocage. Il est signalé, et la scène reprend pour que l'enfant ne reste jamais devant un écran figé.
   */
  private watchStory(delta: number): void {
    const d = services.diag;
    if (services.clock.paused) return;
    d.realNow += Math.min(delta, 250);
    const story = services.ui.story;
    if (this.diagText && Math.floor(d.realNow / 250) !== Math.floor((d.realNow - delta) / 250)) {
      const since = ((d.realNow - d.lastProgress) / 1000).toFixed(1);
      this.diagText.setText(`${services.debug.scene ?? ''} · ${d.step} · ${since} s · secours ${d.count('secours')}`);
    }
    if (!story) return;
    const childsTurn = d.waitingForChild || (story.answering && !story.busy);
    if (childsTurn || services.voice.current) {
      d.progress();
      return;
    }
    if (d.realNow - d.lastProgress > 40_000) {
      d.blocage(`plus rien n'avance depuis 40 s (étape : ${d.step})`);
      d.progress();
      story.recover('blocage');
    }
  }

  // -------------------------------------------------------------------------
  // Boutons d'aide (OverlayApi)
  // -------------------------------------------------------------------------

  setHud(mode: 'hidden' | 'story' | 'challenge'): void {
    const story = services.ui.story;
    const visible: Record<HudName, boolean> = {
      reecouter: mode === 'challenge',
      aide: mode === 'challenge',
    };
    for (const name of Object.keys(this.hud) as HudName[]) {
      const b = this.hud[name];
      b.setVisible(visible[name]);
      if (story) {
        if (visible[name]) story.layer.add(b);
        else story.layer.remove(b);
      }
    }
  }

  visibleHud(): string[] {
    return (Object.keys(this.hud) as HudName[]).filter((n) => this.hud[n].visible);
  }

  setBusy(on: boolean): void {
    this.hud.reecouter.setEnabled(!on);
    this.hud.aide.setEnabled(!on);
  }

  pulse(name: 'reecouter' | 'aide' | null): void {
    this.pulseTween?.stop();
    for (const b of Object.values(this.hud)) b.setScale(1);
    if (!name) return;
    this.pulseTween = this.tweens.add({ targets: this.hud[name], scale: 1.22, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  // -------------------------------------------------------------------------
  // Cadre de sélection
  // -------------------------------------------------------------------------

  private drawRing(): void {
    const g = this.ring;
    g.clear();
    const cur = services.focus.current;
    if (!cur || services.input.lastSource === 'pointer' || !cur.isEnabled()) return;
    const b = cur.bounds();
    const pad = 12;
    const a = 0.65 + 0.35 * Math.sin(this.time.now / 180);
    g.lineStyle(14, C.ink, 0.5 * a);
    g.strokeRoundedRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, 30);
    g.lineStyle(9, C.focus, a);
    g.strokeRoundedRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, 30);
  }

  // -------------------------------------------------------------------------
  // Sous-titres (pour l'adulte, désactivés par défaut)
  // -------------------------------------------------------------------------

  private buildSubtitles(): void {
    this.subtitle = this.add.container(860, 120).setDepth(50).setVisible(false);
    const bg = this.add.graphics().setName('bg');
    this.subName = this.add.text(-530, -50, '', textStyle(30)).setOrigin(0, 0);
    this.subText = this.add.text(-530, -12, '', textStyle(34, { wordWrap: { width: 1060 } })).setOrigin(0, 0);
    this.subtitle.add([bg, this.subName, this.subText]);
  }

  private showSubtitle(speaker: string, text: string): void {
    const info = services.voice.speakers[speaker];
    this.subName.setText(info?.name ?? speaker).setColor(info?.color ?? '#ffffff');
    this.subText.setText(text);
    const bg = this.subtitle.getByName('bg') as Phaser.GameObjects.Graphics;
    bg.clear();
    bg.fillStyle(0x101a33, 0.85);
    bg.fillRoundedRect(-560, -64, 1120, this.subText.height + 72, 24);
    this.subtitle.setVisible(true);
  }

  // -------------------------------------------------------------------------
  // Application en arrière-plan : le jeu se fige en silence, puis repart
  // -------------------------------------------------------------------------

  private freeze(): void {
    if (this.hiddenAt !== null) return;
    this.hiddenAt = performance.now();
    services.ui.story?.saveActive(); // l'application peut être fermée en arrière-plan
    services.clock.paused = true;
    services.voice.pause();
    services.audio.pause();
    // La prochaine image peut n'arriver qu'au retour : appliquer la pause maintenant.
    const story = services.ui.story?.sys;
    if (story?.isActive()) story.pause();
  }

  private thaw(): void {
    if (this.hiddenAt === null) return;
    const away = performance.now() - this.hiddenAt;
    this.hiddenAt = null;
    services.audio.resume();
    services.clock.paused = false;
    const story = services.ui.story?.sys;
    if (story?.isPaused()) story.resume();
    services.voice.resume();
    services.ui.story?.afterAbsence(away);
  }
}
