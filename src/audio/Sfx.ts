import catalogue from '../content/audio-catalogue.json';
import { loopPoints } from './assemble';
import type { AudioEngine } from './AudioEngine';

/** Bruitages qui peuvent venir d'un fichier livré (public/audio/sons/<nom>.mp3). */
export type SonId = keyof typeof catalogue.sons;

interface PlayOpts {
  /** Vitesse de lecture (1 = normale, 2 = une octave plus haut). */
  rate?: number;
  delay?: number;
  gain?: number;
  /** Durée imposée (s) : le son s'éteint en fondu à ce moment-là. */
  seconds?: number;
  fadeIn?: number;
  fadeOut?: number;
  bus?: 'sfx' | 'ambience';
}

export interface LoopHandle {
  stop(): void;
}

const NOOP: LoopHandle = { stop: () => undefined };

/**
 * Bruitages. Chacun est joué depuis son fichier quand il a été livré (public/audio/sons/),
 * sinon synthétisé (Web Audio, son provisoire). En intensité douce (P15), tout est atténué.
 */
export class Sfx {
  gentle = false;
  /** Bruitages joués depuis un fichier (tests et débogage). */
  played: SonId[] = [];

  private files: Partial<Record<SonId, string>> = {};
  private buffers = new Map<SonId, { buffer: AudioBuffer; loop: [number, number] }>();

  constructor(private audio: AudioEngine) {}

  /** Fichiers livrés (manifeste) : décodés dès que le son est autorisé, pour partir sans délai. */
  setFiles(files: Record<string, string>): void {
    this.files = Object.fromEntries(Object.entries(files).filter(([k]) => k in catalogue.sons));
    void this.audio.whenReady().then(() =>
      Promise.all(
        (Object.entries(this.files) as [SonId, string][]).map(async ([id, url]) => {
          const buffer = await this.audio.load(url);
          if (buffer) this.buffers.set(id, { buffer, loop: loopPoints(buffer) });
        }),
      ),
    );
  }

  /**
   * Joue le fichier livré pour ce bruitage. Renvoie null s'il n'y en a pas (pas livré, ou pas encore
   * décodé) : le son synthétisé prend alors le relais.
   */
  private file(id: SonId, o: PlayOpts = {}): LoopHandle | null {
    const ctx = this.ctx;
    const entry = this.buffers.get(id);
    if (!ctx || !entry || !this.audio.buses) return null;
    const t = ctx.currentTime + (o.delay ?? 0);
    const loop = catalogue.sons[id].boucle;
    const src = ctx.createBufferSource();
    src.buffer = entry.buffer;
    src.playbackRate.value = o.rate ?? 1;
    if (loop) {
      src.loop = true;
      [src.loopStart, src.loopEnd] = entry.loop;
    }
    const g = ctx.createGain();
    const level = (o.gain ?? 1) * this.level;
    const fadeIn = o.fadeIn ?? 0;
    g.gain.setValueAtTime(fadeIn > 0 ? 0.0001 : level, t);
    if (fadeIn > 0) g.gain.linearRampToValueAtTime(level, t + fadeIn);
    if (o.seconds !== undefined) {
      const end = t + o.seconds;
      const fadeOut = Math.min(o.fadeOut ?? 0.12, o.seconds);
      g.gain.setValueAtTime(level, Math.max(t + fadeIn, end - fadeOut));
      g.gain.linearRampToValueAtTime(0.0001, end);
    }
    src.connect(g).connect(o.bus === 'ambience' ? this.audio.buses.ambience : this.audio.buses.sfx);
    src.start(t, loop ? entry.loop[0] : 0);
    if (o.seconds !== undefined) src.stop(t + o.seconds + 0.02);
    this.played.push(id);
    if (this.played.length > 60) this.played.shift();
    let stopped = false;
    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        const now = ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.setTargetAtTime(0, now, 0.15);
        try {
          src.stop(now + 1);
        } catch {
          /* déjà arrêté */
        }
      },
    };
  }

  private has(id: SonId): boolean {
    return this.ctx !== null && this.buffers.has(id);
  }

  private get ctx(): AudioContext | null {
    return this.audio.ctx && this.audio.ctx.state !== 'closed' ? this.audio.ctx : null;
  }

  private get level(): number {
    return this.gentle ? 0.55 : 1;
  }

  /** Déplacement de la sélection. */
  tick(): void {
    if (this.file('selection')) return;
    this.tone(1250, 0.03, 0.05, 'sine');
  }

  /** Appui sur un bouton. */
  select(): void {
    if (this.file('appui')) return;
    this.tone(660, 0.05, 0.1, 'triangle');
    this.tone(990, 0.06, 0.08, 'triangle', 0.04);
  }

  step(up: boolean): void {
    if (this.file(up ? 'plus' : 'moins')) return;
    this.tone(up ? 880 : 620, 0.05, 0.08, 'triangle');
  }

  /** Un voyant (ou un élément) s'allume : la hauteur monte avec le rang. */
  pop(rank = 0): void {
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    const semis = scale[rank % scale.length] + 12 * Math.floor(rank / scale.length);
    // Fichier : la même note, jouée plus vite pour monter (deux octaves au plus).
    if (this.file('note', { rate: Math.pow(2, Math.min(semis, 24) / 12) })) return;
    this.tone(523.25 * Math.pow(2, semis / 12), 0.12, 0.07, 'sine');
  }

  /** Suite de petites notes de réussite. */
  success(): void {
    if (this.file('reussite')) return;
    [0, 4, 7, 12].forEach((s, i) => this.tone(523.25 * Math.pow(2, s / 12), 0.22, 0.11, 'triangle', i * 0.09));
  }

  /** Bref accord de clôture. */
  chord(): void {
    if (this.file('accord')) return;
    [0, 4, 7, 12].forEach((s) => this.tone(392 * Math.pow(2, s / 12), 1.4, 0.06, 'triangle'));
  }

  /** Erreur : deux notes douces qui descendent, jamais un buzzer. */
  softError(): void {
    if (this.file('erreur_douce')) return;
    this.tone(440, 0.18, 0.08, 'sine');
    this.tone(370, 0.28, 0.08, 'sine', 0.16);
  }

  /** Bips d'ordinateur (« Bip ! Bip ! »). */
  beeps(count = 3, strange = false): void {
    if (strange && this.file('bips_etranges', count <= 2 ? { seconds: 0.4 } : {})) return;
    if (!strange && this.has('bip')) {
      for (let i = 0; i < count; i++) this.file('bip', { delay: i * 0.28 });
      return;
    }
    for (let i = 0; i < count; i++) {
      const f = strange ? 600 + Math.random() * 1400 : 1500;
      this.tone(f, 0.09, 0.06, strange ? 'square' : 'sine', i * (strange ? 0.11 : 0.28));
    }
  }

  /** Imprimante à listings : « Brrrrrr ». */
  printer(seconds: number): LoopHandle {
    const fromFile = this.file('imprimante', { seconds, fadeOut: 0.15 });
    if (fromFile) return fromFile;
    const ctx = this.ctx;
    const noise = this.audio.noise('white');
    if (!ctx || !noise || !this.audio.buses) return NOOP;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = 0;
    // Hachage régulier : le bruit des aiguilles qui frappent le papier.
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 14;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05 * this.level;
    lfo.connect(lfoGain).connect(g.gain);
    const t = ctx.currentTime;
    src.connect(bp).connect(g).connect(this.audio.buses.sfx);
    src.start(t);
    lfo.start(t);
    const stop = (at = ctx.currentTime) => {
      try {
        src.stop(at + 0.05);
        lfo.stop(at + 0.05);
      } catch {
        /* déjà arrêté */
      }
    };
    stop(t + seconds);
    return { stop: () => stop() };
  }

  /** Froissement de papier. */
  paper(): void {
    if (this.file('papier')) return;
    this.noiseBurst(0.25, 3500, 0.08);
  }

  /** Transition (« whoosh »). */
  whoosh(): void {
    if (this.file('whoosh')) return;
    const ctx = this.ctx;
    const noise = this.audio.noise('white');
    if (!ctx || !noise || !this.audio.buses) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(2500, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12 * this.level, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(bp).connect(g).connect(this.audio.buses.sfx);
    src.start(t);
    src.stop(t + 0.75);
  }

  /** Ronronnement des machines du laboratoire (boucle). */
  hum(): LoopHandle {
    const fromFile = this.file('ronronnement', { bus: 'ambience', fadeIn: 1.5, gain: 0.8 });
    if (fromFile) return fromFile;
    const ctx = this.ctx;
    const noise = this.audio.noise('brown');
    if (!ctx || !noise || !this.audio.buses) return NOOP;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.5 * this.level, t + 1.5);
    out.connect(this.audio.buses.ambience);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const ng = ctx.createGain();
    ng.gain.value = 0.12;
    src.connect(lp).connect(ng).connect(out);
    const osc = ctx.createOscillator();
    osc.frequency.value = 60;
    const og = ctx.createGain();
    og.gain.value = 0.02;
    osc.connect(og).connect(out);
    src.start(t);
    osc.start(t);
    return {
      stop: () => {
        const now = ctx.currentTime;
        out.gain.setTargetAtTime(0, now, 0.4);
        src.stop(now + 2.5);
        osc.stop(now + 2.5);
      },
    };
  }

  /** Bobines de bande magnétique qui tournent. */
  reels(seconds: number): void {
    if (this.file('bobines', { seconds, fadeIn: 0.3, fadeOut: 0.4 })) return;
    const ctx = this.ctx;
    if (!ctx || !this.audio.buses) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.linearRampToValueAtTime(110, t + 0.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 * this.level, t + 0.4);
    g.gain.setValueAtTime(0.05 * this.level, t + seconds - 0.4);
    g.gain.linearRampToValueAtTime(0, t + seconds);
    osc.connect(lp).connect(g).connect(this.audio.buses.sfx);
    osc.start(t);
    osc.stop(t + seconds + 0.05);
  }

  /** Alarme courte de la simulation (C2.2) : brève, et son arrêt s'entend (9.1). Atténuée en intensité douce. */
  alarm(): void {
    if (this.file('alarme', { gain: this.gentle ? 0.6 : 1 })) return;
    for (let i = 0; i < 3; i++) {
      this.tone(880, 0.16, this.gentle ? 0.05 : 0.09, 'square', i * 0.36);
      this.tone(660, 0.16, this.gentle ? 0.05 : 0.09, 'square', i * 0.36 + 0.18);
    }
  }

  /** Grondement d'un décollage (simulation) : monte puis s'éteint. */
  rumble(seconds: number): void {
    if (this.file('grondement', { seconds, fadeIn: 0.15, fadeOut: seconds * 0.5 })) return;
    const ctx = this.ctx;
    const noise = this.audio.noise('brown');
    if (!ctx || !noise || !this.audio.buses) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.linearRampToValueAtTime(700, t + seconds * 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * this.level, t + seconds * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    src.connect(lp).connect(g).connect(this.audio.buses.sfx);
    src.start(t);
    src.stop(t + seconds + 0.05);
  }

  /** Cran du bouton d'une radio. */
  notch(): void {
    if (this.file('cran')) return;
    this.tone(2200, 0.018, 0.05, 'square');
  }

  /** Grésillement de radio mal réglée (bref, il ne couvre pas les voix). */
  crackle(seconds: number): void {
    if (this.file('gresillement', { seconds, fadeOut: 0.1 })) return;
    const ctx = this.ctx;
    const noise = this.audio.noise('white');
    if (!ctx || !noise || !this.audio.buses) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    // Craquements irréguliers.
    for (let k = 0; k < seconds * 14; k++) g.gain.setValueAtTime((0.04 + 0.12 * Math.random()) * this.level, t + k / 14);
    g.gain.setValueAtTime(0.0001, t + seconds);
    src.connect(bp).connect(g).connect(this.audio.buses.sfx);
    src.start(t);
    src.stop(t + seconds + 0.05);
  }

  /** Entrée dans un souvenir : quelques notes de harpe qui montent. */
  memory(): void {
    if (this.file('souvenir')) return;
    [0, 4, 7, 11, 14, 19].forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), 0.9, 0.05, 'sine', i * 0.12));
  }

  private tone(freq: number, duration: number, level: number, type: OscillatorType, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.audio.buses) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const peak = level * this.level;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.audio.buses.sfx);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private noiseBurst(duration: number, cutoff: number, level: number): void {
    const ctx = this.ctx;
    const noise = this.audio.noise('white');
    if (!ctx || !noise || !this.audio.buses) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level * this.level, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(hp).connect(g).connect(this.audio.buses.sfx);
    src.start(t, Math.random());
    src.stop(t + duration + 0.02);
  }
}
