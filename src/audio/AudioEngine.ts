export interface Buses {
  master: GainNode;
  /** « Lit » sonore baissé pendant les voix (ducking) : musique + ambiance. */
  bedDuck: GainNode;
  music: GainNode;
  ambience: GainNode;
  voice: GainNode;
  sfx: GainNode;
}

export interface Volumes {
  music: number;
  voice: number;
  sfx: number;
}

/** Rampe douce vers une valeur, sans saut même si une autre rampe était en cours. */
export function glide(param: AudioParam, target: number, now: number, timeConstant: number): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.setTargetAtTime(target, now, timeConstant);
}

/**
 * Moteur audio maison (Web Audio). Phaser est lancé sans son : on garde ainsi
 * la main sur le routage (effet radio par personnage, ducking de la musique…).
 *
 * Le contexte audio n'est créé qu'à la première action du joueur (exigence des navigateurs).
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  buses: Buses | null = null;
  /** Niveau de la musique pendant une réplique (0..1). */
  duckDepth = 0.25;
  duckTarget = 1;

  private paused = false;
  private resumeAttempt = 0;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private noiseCache = new Map<string, AudioBuffer>();
  private volumes: Volumes = { music: 0.7, voice: 1, sfx: 0.8 };
  private resolveReady!: (ctx: AudioContext) => void;
  private readonly ready = new Promise<AudioContext>((resolve) => (this.resolveReady = resolve));

  /** À appeler dans un gestionnaire de geste utilisateur (touche, clic). */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.buses = this.buildGraph(this.ctx);
      this.resolveReady(this.ctx);
    }
    if (!this.running) this.resumeContext();
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  whenReady(): Promise<AudioContext> {
    return this.ready;
  }

  /** Charge et décode un fichier audio (mis en cache). Renvoie null en cas d'échec. */
  load(url: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(url);
    if (!p) {
      p = this.ready
        .then(async (ctx) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await ctx.decodeAudioData(await res.arrayBuffer());
        })
        .catch((err) => {
          console.warn(`[audio] impossible de charger ${url}`, err);
          return null;
        });
      this.buffers.set(url, p);
    }
    return p;
  }

  /** Baisse (ou remonte) la musique et l'ambiance pendant les voix. */
  duck(active: boolean): void {
    this.duckTarget = active ? this.duckDepth : 1;
    if (!this.ctx || !this.buses) return;
    glide(this.buses.bedDuck.gain, this.duckTarget, this.ctx.currentTime, active ? 0.06 : 0.35);
  }

  setVolumes(v: Partial<Volumes>): void {
    this.volumes = { ...this.volumes, ...v };
    if (!this.ctx || !this.buses) return;
    const now = this.ctx.currentTime;
    glide(this.buses.music.gain, this.volumes.music, now, 0.05);
    glide(this.buses.voice.gain, this.volumes.voice, now, 0.05);
    glide(this.buses.sfx.gain, this.volumes.sfx, now, 0.05);
  }

  /** Pause du jeu : tout le son est gelé (et reprend exactement au même endroit). */
  pause(): void {
    this.paused = true;
    this.resumeAttempt++;
    this.ctx?.suspend().catch(() => undefined);
  }

  resume(): void {
    this.paused = false;
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'closed') return;
    const attempt = ++this.resumeAttempt;
    this.resumeContext();

    // Safari peut encore être interrompu quand la page redevient visible.
    setTimeout(() => {
      if (attempt === this.resumeAttempt && !this.running) this.resumeContext();
    }, 350);
  }

  private resumeContext(): void {
    const ctx = this.ctx;
    if (!this.paused && ctx && ctx.state !== 'closed') void ctx.resume().catch(() => undefined);
  }

  /** Bruit pré-calculé (blanc ou « brun », plus grave) de 2 s, en boucle. */
  noise(kind: 'white' | 'brown'): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const cached = this.noiseCache.get(kind);
    if (cached) return cached;
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === 'white') data[i] = white;
      else {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }
    this.noiseCache.set(kind, buffer);
    return buffer;
  }

  debugState() {
    return {
      state: this.ctx?.state ?? 'none',
      duckTarget: this.duckTarget,
      bedGain: this.buses ? this.buses.bedDuck.gain.value : null,
    };
  }

  private buildGraph(ctx: AudioContext): Buses {
    const gain = (value: number) => {
      const g = ctx.createGain();
      g.gain.value = value;
      return g;
    };
    const master = gain(1);
    // Petit compresseur final : évite la saturation quand alarme + voix + moteur s'additionnent.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    master.connect(limiter).connect(ctx.destination);

    const bedDuck = gain(1);
    bedDuck.connect(master);
    const music = gain(this.volumes.music);
    const ambience = gain(1);
    music.connect(bedDuck);
    ambience.connect(bedDuck);
    const voice = gain(this.volumes.voice);
    voice.connect(master);
    const sfx = gain(this.volumes.sfx);
    sfx.connect(master);
    return { master, bedDuck, music, ambience, voice, sfx };
  }
}
