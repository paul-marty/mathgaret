import { loopPoints } from './assemble';
import type { AudioEngine } from './AudioEngine';

/**
 * Musique. Chaque ambiance est jouée en boucle depuis son fichier quand il a été livré
 * (public/audio/musique/<ambiance>.mp3), sinon générée (nappes + clochettes, provisoire).
 * Elle passe par le bus « musique » : elle est donc baissée automatiquement pendant les voix.
 *
 * Ambiances (section 9.1) : le laboratoire installe la curiosité, la recherche reste calme,
 * les révélations élargissent la musique.
 */
export type Mood = 'mystere' | 'leger' | 'calme' | 'ample' | 'theme';

interface MoodDef {
  chords: number[][];
  bar: number;
  level: number;
  bells: number; // probabilité d'une clochette par mesure
  cutoff: number;
}

const MOODS: Record<Mood, MoodDef> = {
  // la m – ré m – mi : mystérieux, lent
  mystere: { chords: [[57, 60, 64], [50, 57, 62], [52, 56, 59], [57, 60, 64]], bar: 5, level: 0.8, bells: 0.5, cutoff: 900 },
  // do – la m – fa – sol : léger et régulier
  leger: { chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], bar: 3, level: 0.75, bells: 0.8, cutoff: 1400 },
  // nappe très douce pendant le raisonnement
  calme: { chords: [[60, 64, 67], [57, 60, 64]], bar: 6, level: 0.45, bells: 0, cutoff: 700 },
  // do – sol – la m – fa, plus large et lumineux
  ample: { chords: [[48, 60, 64, 67], [43, 59, 62, 67], [45, 60, 64, 69], [41, 57, 60, 65]], bar: 4, level: 1, bells: 1, cutoff: 2200 },
  // thème de Margaret, version finale (C5.5, bilan de la mission, générique) : do – fa – sol – do, large et joyeux
  theme: { chords: [[48, 60, 64, 67, 72], [41, 57, 60, 65, 69], [43, 59, 62, 67, 71], [48, 60, 64, 67, 72]], bar: 3, level: 1, bells: 1, cutoff: 2600 },
};

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Fondus entre deux musiques en fichier (s). */
const FADE_IN = 1.2;
const FADE_OUT = 0.8;

export class Music {
  mood: Mood | null = null;
  /** Ambiance → URL du fichier livré. */
  files: Partial<Record<string, string>> = {};
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private out: GainNode | null = null;
  /** Musique en fichier qui joue (ou qui se charge). */
  private track: { mood: Mood; src: AudioBufferSourceNode | null; gain: GainNode } | null = null;

  constructor(private audio: AudioEngine) {
    // Musique demandée avant que le son soit autorisé (premier geste) : elle démarre à ce moment-là.
    void audio.whenReady().then(() => {
      const mood = this.mood;
      if (mood && !this.playing && !this.track) {
        this.mood = null;
        this.play(mood);
      }
    });
  }

  /** Ce qui joue (tests et débogage). */
  get playing(): { mood: Mood; via: 'fichier' | 'synthese' } | null {
    if (this.track?.src) return { mood: this.track.mood, via: 'fichier' };
    if (this.timer !== null && this.mood) return { mood: this.mood, via: 'synthese' };
    return null;
  }

  play(mood: Mood): void {
    const ctx = this.audio.ctx;
    if (!ctx || !this.audio.buses) {
      this.mood = mood;
      return;
    }
    const url = this.files[mood];
    if (url) {
      if (this.track?.mood === mood) return;
      this.mood = mood;
      this.stopSynth(FADE_OUT / 3);
      this.stopTrack(FADE_OUT);
      void this.playTrack(ctx, mood, url);
      return;
    }
    if (this.mood === mood && this.timer !== null) return;
    this.mood = mood;
    this.stopTrack(FADE_OUT);
    this.step = 0;
    if (this.timer !== null) return; // la nouvelle ambiance prend le relais à la mesure suivante
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.out.connect(this.audio.buses.music);
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 400);
    this.schedule();
  }

  stop(fade = 0.6): void {
    this.mood = null;
    this.stopSynth(fade);
    this.stopTrack(fade);
  }

  private async playTrack(ctx: AudioContext, mood: Mood, url: string): Promise<void> {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.audio.buses!.music);
    const track: NonNullable<Music['track']> = { mood, src: null, gain };
    this.track = track;
    const buffer = await this.audio.load(url);
    if (this.track !== track) return gain.disconnect(); // une autre musique a été demandée entre-temps
    if (!buffer) {
      // Fichier illisible : la musique générée prend le relais.
      this.track = null;
      gain.disconnect();
      delete this.files[mood];
      if (this.mood === mood) {
        this.mood = null;
        this.play(mood);
      }
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    [src.loopStart, src.loopEnd] = loopPoints(buffer);
    src.connect(gain);
    const t = ctx.currentTime + 0.05;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(1, t + FADE_IN);
    src.start(t, src.loopStart);
    track.src = src;
  }

  private stopTrack(fade: number): void {
    const track = this.track;
    this.track = null;
    const ctx = this.audio.ctx;
    if (!track || !ctx) return;
    const now = ctx.currentTime;
    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(track.gain.gain.value, now);
    track.gain.gain.setTargetAtTime(0, now, Math.max(0.05, fade / 3));
    try {
      track.src?.stop(now + fade * 2 + 0.2);
    } catch {
      /* déjà arrêté */
    }
    window.setTimeout(() => track.gain.disconnect(), (fade * 2 + 0.5) * 1000);
  }

  private stopSynth(fade: number): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const ctx = this.audio.ctx;
    if (ctx && this.out) {
      const out = this.out;
      out.gain.setTargetAtTime(0, ctx.currentTime, fade);
      window.setTimeout(() => out.disconnect(), fade * 6000 + 500);
    }
    this.out = null;
  }

  private schedule(): void {
    const ctx = this.audio.ctx;
    // Contexte gelé (pause, onglet caché) : on n'empile rien.
    if (!ctx || ctx.state !== 'running' || !this.out || !this.mood) return;
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 1.5) {
      const m = MOODS[this.mood];
      const chord = m.chords[this.step % m.chords.length];
      this.chord(ctx, this.nextTime, chord, m);
      if (Math.random() < m.bells) this.bell(ctx, this.nextTime + 0.5 + Math.random() * (m.bar - 1), chord);
      this.nextTime += m.bar;
      this.step++;
    }
  }

  private chord(ctx: AudioContext, t: number, notes: number[], m: MoodDef): void {
    const out = this.out!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = m.cutoff;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(m.level, t + 1.2);
    env.gain.setValueAtTime(m.level, t + m.bar - 0.2);
    env.gain.linearRampToValueAtTime(0, t + m.bar + 1.5);
    lp.connect(env).connect(out);
    for (const note of notes) {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = midiToHz(note);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0.02;
        osc.connect(g).connect(lp);
        osc.start(t);
        osc.stop(t + m.bar + 1.6);
      }
    }
  }

  private bell(ctx: AudioContext, t: number, notes: number[]): void {
    const out = this.out!;
    const note = notes[Math.floor(Math.random() * notes.length)] + 24;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = midiToHz(note);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.03, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 2.5);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 2.6);
  }
}
