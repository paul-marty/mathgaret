let saturationCurve: Float32Array<ArrayBuffer> | null = null;

/** Courbe de saturation douce (type « tanh ») pour l'effet radio. */
function getSaturationCurve(): Float32Array<ArrayBuffer> {
  if (saturationCurve) return saturationCurve;
  const n = 1024;
  const k = 6;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  saturationCurve = curve;
  return curve;
}

/**
 * Effet « radio en direct » appliqué à une réplique :
 * filtre passe-bande (≈ 380 Hz – 3,2 kHz), légère saturation, souffle,
 * bip d'ouverture et « kssh » + bip de fermeture.
 *
 * Usage : `const t = radio.open(at)` → démarrer la voix sur `radio.input` à `t`, puis `radio.close(fin)`.
 */
export class RadioChain {
  readonly input: GainNode;
  private out: GainNode;
  private staticGain: GainNode;
  private staticFilter: BiquadFilterNode;
  private staticSrc: AudioBufferSourceNode | null = null;
  private nodes: AudioNode[] = [];

  constructor(
    private ctx: AudioContext,
    destination: AudioNode,
    private noise: AudioBuffer | null,
  ) {
    this.input = ctx.createGain();
    this.out = ctx.createGain();
    this.out.connect(destination);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 380;
    highpass.Q.value = 0.8;
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 1800;
    presence.gain.value = 5;
    presence.Q.value = 1;
    const shaper = ctx.createWaveShaper();
    shaper.curve = getSaturationCurve();
    shaper.oversample = '2x';
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3200;
    lowpass.Q.value = 0.9;
    const post = ctx.createGain();
    post.gain.value = 0.8;
    this.input.connect(highpass).connect(presence).connect(shaper).connect(lowpass).connect(post).connect(this.out);

    this.staticGain = ctx.createGain();
    this.staticGain.gain.value = 0;
    const staticFilter = ctx.createBiquadFilter();
    staticFilter.type = 'bandpass';
    staticFilter.frequency.value = 2400;
    staticFilter.Q.value = 0.7;
    staticFilter.connect(this.staticGain).connect(this.out);
    this.nodes.push(highpass, presence, shaper, lowpass, post, staticFilter, this.staticGain);
    this.staticFilter = staticFilter;
  }

  /** Ouvre le canal à l'instant `at` ; renvoie l'instant où la voix peut commencer. */
  open(at: number): number {
    if (this.noise) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      src.connect(this.staticFilter);
      src.start(at);
      this.staticSrc = src;
      this.staticGain.gain.setValueAtTime(0, at);
      this.staticGain.gain.linearRampToValueAtTime(0.02, at + 0.05);
    }
    this.beep(at, 1350, 0.07, 0.1);
    return at + 0.13;
  }

  /** Ferme le canal (squelch + bip), puis libère les nœuds. */
  close(at: number): void {
    const end = at + 0.2;
    if (this.noise) {
      const burst = this.ctx.createBufferSource();
      burst.buffer = this.noise;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.09, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
      burst.connect(this.staticFilter);
      burst.connect(g).connect(this.out);
      burst.start(at, Math.random());
      burst.stop(at + 0.14);
    }
    this.beep(at + 0.12, 950, 0.05, 0.08);
    this.staticGain.gain.setValueAtTime(this.staticGain.gain.value, at);
    this.staticGain.gain.linearRampToValueAtTime(0, end);
    this.staticSrc?.stop(end + 0.05);
    const delayMs = Math.max(0, (end - this.ctx.currentTime) * 1000) + 300;
    window.setTimeout(() => this.dispose(), delayMs);
  }

  beep(at: number, freq: number, duration: number, level: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + 0.005);
    g.gain.setValueAtTime(level, at + duration - 0.01);
    g.gain.linearRampToValueAtTime(0, at + duration);
    osc.connect(g).connect(this.out);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  private dispose(): void {
    for (const n of this.nodes) n.disconnect();
    this.input.disconnect();
    this.out.disconnect();
  }
}
