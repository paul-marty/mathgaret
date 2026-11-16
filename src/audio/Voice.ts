import type { GameClock } from '../core/clock';
import type { Diag } from '../core/diag';
import linesData from '../content/lines.json';
import type { Rng } from '../core/rng';
import { joinClips } from './assemble';
import type { AudioEngine } from './AudioEngine';
import { RadioChain } from './RadioFx';
import { numberValue, sameTextKey, segmentTexts, voiceParts } from './segments';

export interface LineDef {
  speaker: string;
  text: string;
  /** repris (conversation), propose (document), provisoire (à écrire par les scénaristes). */
  source?: string;
  scene?: string;
  /** Autre façon de dire la réplique indiquée (variété des répliques qui reviennent souvent). */
  variante_de?: string;
}

export interface SpeakerInfo {
  name: string;
  color: string;
  radio: boolean;
}

export interface Spoken {
  /** Réplique demandée par le jeu (pour une réplique à variantes : la réplique de base). */
  id: string;
  /** Variante effectivement dite, si ce n'est pas la réplique de base. */
  variant?: string;
  speaker: string;
  text: string;
  /** line = réplique (jamais coupée par un nom de bouton ou un nombre), number/label = lecture courte. */
  kind: 'line' | 'number' | 'label';
  /** Comment la réplique a été dite : fichier livré, synthèse provisoire du navigateur, ou silence minuté. */
  via?: 'fichier' | 'synthese' | 'minuterie';
  /** Nombre de fichiers assemblés pour la dire (morceaux et nombres). */
  parts?: number;
}

type Vars = Record<string, string | number>;

/** Un fichier à jouer, précédé d'un silence (ms). Plusieurs fichiers sont assemblés en une seule lecture. */
interface Clip {
  url: string;
  pauseBefore: number;
}

/** Voix de synthèse provisoire du navigateur : une hauteur et un débit par personnage. */
const TTS: Record<string, { pitch: number; rate: number }> = {
  narrateur: { pitch: 1, rate: 0.95 },
  margaret: { pitch: 1.2, rate: 1 },
  collegue: { pitch: 0.8, rate: 1.08 },
  houston: { pitch: 0.9, rate: 1 },
  lauren: { pitch: 1.6, rate: 1.05 },
  astronaute: { pitch: 0.85, rate: 0.95 },
};

interface Playback {
  spoken: Spoken;
  done: boolean;
  finish: () => void;
  stopMedia: () => void;
  onPause: () => void;
  onResume: () => void;
  /** Durée (temps de jeu) au-delà de laquelle la lecture est déclarée finie, quoi qu'il arrive. */
  capMs: number;
  /** Jeton du filet de sécurité en cours (un nouveau filet annule le précédent). */
  guard: number;
}

/**
 * Découpe un texte en morceaux de phrases complètes (≈ 140 caractères au plus) :
 * certaines voix de synthèse s'arrêtent au-delà d'une quinzaine de secondes sans prévenir.
 */
export function splitForSpeech(text: string, max = 140): string[] {
  const sentences = (text.match(/[^.!?…]+(?:[.!?…]+[»"”)]*\s*|$)/g) ?? [text]).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  for (const sentence of sentences) {
    const last = chunks[chunks.length - 1];
    if (last !== undefined && last.length + 1 + sentence.length <= max) chunks[chunks.length - 1] = `${last} ${sentence}`;
    else chunks.push(sentence);
  }
  return chunks.length ? chunks : [text];
}

/**
 * Les voix. Une seule parle à la fois (section 9.1).
 *
 * Pour chaque réplique, dans l'ordre :
 * 1. le fichier livré (public/audio/manifest.json), avec effet radio si besoin. Une réplique à nombres
 *    est un fichier enregistré pour ces valeurs, ou bien ses morceaux et les nombres seuls, assemblés ;
 * 2. sinon, la synthèse vocale du navigateur (voix provisoire) ;
 * 3. sinon, un simple délai estimé d'après la longueur du texte (sous-titres seuls).
 */
export class Voice {
  readonly lines: Record<string, LineDef> = linesData.lines;
  readonly speakers: Record<string, SpeakerInfo> = linesData.speakers;
  /** Clé du manifeste (« id », « id#2 », « id|n=3 », « nombre_7 ») → URL du fichier audio. */
  files: Record<string, string> = {};
  /** Tirage des variantes (flux à part : il ne décale pas celui des problèmes). */
  random: Rng = Math.random;
  current: Spoken | null = null;
  ttsEnabled: boolean;
  /** Journal (tests et débogage). */
  log: Spoken[] = [];
  /**
   * Répliques en silence minuté (console de développement : mg.muet) : elles suivent alors la vitesse du jeu,
   * ce qui permet d'avancer vite dans l'histoire.
   */
  silent = false;

  private playback: Playback | null = null;
  /** Réplique de base → ses variantes (dans l'ordre de lines.json). */
  private readonly variants = new Map<string, string[]>();
  /**
   * Enregistrements interchangeables : même personnage, même texte, même sorte (réplique entière ou morceau).
   * « puis appuie sur la grande coche. » n'est enregistré qu'une fois et sert à toutes les répliques qui le disent.
   */
  private readonly sameText = new Map<string, string[]>();
  private readonly textOfKey = new Map<string, string>();
  /** Dernière façon de dire chaque réplique à variantes (jamais deux fois la même de suite). */
  private lastVariant = new Map<string, string>();
  private listeners: ((e: 'start' | 'end', s: Spoken) => void)[] = [];
  private frVoice: SpeechSynthesisVoice | null = null;
  private paused = false;
  /** Référence gardée sur la phrase en cours : sinon Chrome peut la libérer et ne jamais signaler sa fin. */
  utterance: SpeechSynthesisUtterance | null = null;

  constructor(
    private audio: AudioEngine,
    private clock: GameClock,
    private diag: Diag,
    mute: boolean,
  ) {
    this.ttsEnabled = !mute && typeof window !== 'undefined' && 'speechSynthesis' in window;
    for (const [id, line] of Object.entries(this.lines)) {
      if (line.variante_de) this.variants.set(line.variante_de, [...(this.variants.get(line.variante_de) ?? []), id]);
      const recorded = line.text.includes('{')
        ? segmentTexts(line.text).map((t, i) => [`${id}#${i + 1}`, sameTextKey(line.speaker, 'morceau', t)])
        : [[id, sameTextKey(line.speaker, 'entiere', line.text)]];
      for (const [key, same] of recorded) {
        this.textOfKey.set(key, same);
        this.sameText.set(same, [...(this.sameText.get(same) ?? []), key]);
      }
    }
    if (this.ttsEnabled) {
      const pickVoice = () => {
        const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'));
        this.frVoice = voices.find((v) => /fr[-_]fr/i.test(v.lang)) ?? voices[0] ?? null;
      };
      pickVoice();
      speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
    }
  }

  on(fn: (e: 'start' | 'end', s: Spoken) => void): () => void {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }

  text(id: string, vars: Vars = {}): string {
    const line = this.lines[id];
    if (!line) return id;
    return line.text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
  }

  /** Dit une réplique et se résout quand elle est finie (ou interrompue par `stop`). */
  say(id: string, vars: Vars = {}): Promise<void> {
    if (!this.lines[id]) {
      console.warn(`[voix] réplique inconnue : ${id}`);
      return Promise.resolve();
    }
    const chosen = this.chooseVariant(id, vars);
    const line = this.lines[chosen];
    const spoken: Spoken = { id, speaker: line.speaker, text: this.text(chosen, vars), kind: 'line' };
    if (chosen !== id) spoken.variant = chosen;
    return this.speak(spoken, this.clipsFor(chosen, line.text, vars));
  }

  /**
   * Façon de dire une réplique qui revient souvent. La première fois, le texte de base (celui du scénario) ;
   * ensuite, au hasard, jamais la même deux fois de suite. Quand la réplique de base a son fichier livré,
   * seules les variantes livrées elles aussi sont tirées : une même voix, jamais un mélange avec la synthèse.
   */
  chooseVariant(id: string, vars: Vars = {}): string {
    const others = this.variants.get(id);
    if (!others) return id;
    const last = this.lastVariant.get(id);
    let chosen = id;
    if (last !== undefined) {
      const recorded = (v: string) => Boolean(this.clipsFor(v, this.lines[v].text, vars));
      const all = [id, ...others];
      const pool = recorded(id) ? all.filter(recorded) : all;
      const fresh = pool.length > 1 ? pool.filter((v) => v !== last) : pool;
      chosen = fresh[Math.floor(this.random() * fresh.length)] ?? id;
    }
    this.lastVariant.set(id, chosen);
    return chosen;
  }

  /**
   * Fichiers qui disent cette réplique avec ces valeurs, s'il y en a :
   * 1. un fichier enregistré pour ces valeurs : « id|var=valeur|… » (valeurs numériques, ordre alphabétique) ;
   * 2. une réplique sans nombre : « id » ;
   * 3. les morceaux « id#1 », « id#2 »… et les nombres seuls « nombre_N », tous livrés.
   */
  clipsFor(id: string, text: string, vars: Vars = {}): Clip[] | undefined {
    const numeric = Object.entries(vars)
      .filter(([, v]) => numberValue(v) !== null)
      .sort(([a], [b]) => (a < b ? -1 : 1));
    const varKey = numeric.length ? `${id}|${numeric.map(([k, v]) => `${k}=${numberValue(v)}`).join('|')}` : id;
    const whole = this.files[varKey] ?? (text.includes('{') ? undefined : this.fileFor(id));
    if (whole) return [{ url: whole, pauseBefore: 0 }];
    if (!text.includes('{')) return undefined;
    const parts = voiceParts(id, text, vars)?.map((p) => ({ url: this.fileFor(p.key), pauseBefore: p.pauseBefore }));
    if (!parts || parts.some((p) => !p.url)) return undefined;
    return parts as Clip[];
  }

  /** Fichier livré pour cette clé, ou celui d'un enregistrement interchangeable (même personnage, même texte). */
  fileFor(key: string): string | undefined {
    if (this.files[key]) return this.files[key];
    const same = this.textOfKey.get(key);
    const other = same ? this.sameText.get(same)?.find((k) => this.files[k]) : undefined;
    return other ? this.files[other] : undefined;
  }

  /** Lit un nombre (quand l'enfant le choisit ou le touche). Ne coupe jamais une réplique. */
  sayNumber(n: number): Promise<void> {
    if (this.current && this.current.kind === 'line') return Promise.resolve();
    const file = this.files[`nombre_${n}`];
    // Les nombres sont dits par la voix du Collègue, celle qui les dit aussi dans les consignes.
    return this.speak({ id: `nombre_${n}`, speaker: 'collegue', text: String(n), kind: 'number' }, file ? [{ url: file, pauseBefore: 0 }] : undefined);
  }

  /** Lit le nom d'un bouton quand la sélection arrive dessus (l'enfant ne lit pas). */
  sayLabel(id: string): Promise<void> {
    const line = this.lines[id];
    if (!line || (this.current && this.current.kind === 'line')) return Promise.resolve();
    return this.speak({ id, speaker: line.speaker, text: line.text, kind: 'label' }, this.clipsFor(id, line.text));
  }

  /** Coupe la voix en cours (sa promesse se résout). */
  stop(): void {
    const p = this.playback;
    if (!p) return;
    p.stopMedia();
    p.finish();
  }

  pause(): void {
    this.paused = true;
    this.playback?.onPause();
  }

  resume(): void {
    this.paused = false;
    const pb = this.playback;
    if (!pb) return;
    pb.onResume();
    // La réplique repart (redite depuis le début) : son filet de sécurité aussi.
    this.armGuard(pb);
  }

  get busy(): boolean {
    return this.current !== null && this.current.kind === 'line';
  }

  private emit(e: 'start' | 'end', s: Spoken): void {
    this.diag.progress();
    for (const fn of [...this.listeners]) fn(e, s);
  }

  /** Temps de jeu équivalent à `ms` millisecondes réelles (les voix parlent en temps réel). */
  private real(ms: number): number {
    return ms * this.clock.speed;
  }

  /**
   * Filet de sécurité : quoi qu'il arrive (fin jamais signalée, son bloqué), la lecture se termine
   * après `capMs`. L'horloge du jeu s'arrête quand l'application est en arrière-plan : le filet aussi.
   */
  private armGuard(pb: Playback): void {
    const token = ++pb.guard;
    void this.clock.wait(pb.capMs).then(() => {
      if (pb.done || token !== pb.guard) return;
      this.diag.secours(`« ${pb.spoken.id} » (${pb.spoken.via ?? '?'}) : fin jamais signalée, le jeu continue`);
      pb.stopMedia();
      pb.finish();
    });
  }

  private speak(spoken: Spoken, clips?: Clip[]): Promise<void> {
    this.stop();
    return new Promise<void>((resolve) => {
      const pb: Playback = {
        spoken,
        done: false,
        finish: () => {
          if (pb.done) return;
          pb.done = true;
          if (this.playback === pb) {
            this.playback = null;
            this.current = null;
            this.audio.duck(false);
          }
          this.emit('end', spoken);
          resolve();
        },
        stopMedia: () => undefined,
        onPause: () => undefined,
        onResume: () => undefined,
        capMs: this.estimateMs(spoken.text) * 2 + 4000,
        guard: 0,
      };
      this.playback = pb;
      this.current = spoken;
      this.log.push(spoken);
      if (this.log.length > 200) this.log.shift();
      if (spoken.kind === 'line') this.audio.duck(true);
      this.emit('start', spoken);

      this.armGuard(pb);
      if (this.silent) void this.playTimer(pb);
      else if (clips && this.audio.ctx) void this.playFile(pb, clips);
      else if (this.ttsEnabled) this.playTts(pb);
      else void this.playTimer(pb);
    });
  }

  private estimateMs(text: string): number {
    return Math.max(1200, (text.length / 14 + 0.4) * 1000);
  }

  private async playTimer(pb: Playback, ms = this.estimateMs(pb.spoken.text)): Promise<void> {
    pb.spoken.via ??= 'minuterie';
    await this.clock.wait(ms);
    pb.finish();
  }

  private async playFile(pb: Playback, clips: Clip[]): Promise<void> {
    const buffers = await Promise.all(clips.map((c) => this.audio.load(c.url)));
    const ctx = this.audio.ctx;
    if (pb.done) return;
    const missing = clips.find((_, i) => !buffers[i]);
    const buffer =
      missing || !ctx ? null : buffers.length === 1 ? buffers[0] : joinClips(ctx, buffers as AudioBuffer[], clips.map((c) => c.pauseBefore));
    // Contexte audio bloqué (aucun geste encore) : le fichier ne jouerait jamais, on passe à la synthèse.
    if (!buffer || !ctx || !this.audio.buses || (ctx.state !== 'running' && !this.paused)) {
      if (missing) this.diag.secours(`fichier de voix illisible : ${missing.url}`);
      if (this.ttsEnabled) this.playTts(pb);
      else void this.playTimer(pb);
      return;
    }
    pb.spoken.via = 'fichier';
    pb.spoken.parts = clips.length;
    pb.capMs = this.real(buffer.duration * 1000 + 2500);
    this.armGuard(pb);
    const radio = this.speakers[pb.spoken.speaker]?.radio ? new RadioChain(ctx, this.audio.buses.voice, this.audio.noise('white')) : null;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(radio ? radio.input : this.audio.buses.voice);
    const start = radio ? radio.open(ctx.currentTime + 0.02) : ctx.currentTime + 0.02;
    src.start(start);
    // Le contexte audio est gelé en arrière-plan : `onended` attend le retour.
    src.onended = () => {
      radio?.close(ctx.currentTime);
      pb.finish();
    };
    pb.stopMedia = () => {
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* déjà arrêté */
      }
      radio?.close(ctx.currentTime);
    };
  }

  /**
   * Synthèse vocale du navigateur (voix provisoires). Elle est capricieuse selon les navigateurs :
   * début ou fin parfois jamais signalés, phrase ignorée juste après une autre, refus sans geste préalable.
   * D'où : référence gardée sur la phrase, surveillance de `speechSynthesis.speaking`, une nouvelle
   * tentative si rien ne démarre, puis un sous-titre minuté en dernier recours.
   */
  private playTts(pb: Playback): void {
    pb.spoken.via = 'synthese';
    const synth = window.speechSynthesis;
    const tts = TTS[pb.spoken.speaker] ?? TTS.narrateur;
    const chunks = splitForSpeech(pb.spoken.text);
    const estimate = this.estimateMs(pb.spoken.text);
    pb.capMs = this.real(estimate * 1.8 + 3000 + chunks.length * 1500);
    this.armGuard(pb);
    const startedAt = this.clock.now;
    let token = 0;
    let index = 0;
    let retried = false;

    const toTimer = (why: string) => {
      token++;
      synth.cancel();
      this.diag.secours(`« ${pb.spoken.id} » : ${why} ; sous-titre minuté à la place`);
      pb.spoken.via = 'minuterie';
      void this.playTimer(pb, Math.max(0, estimate - (this.clock.now - startedAt)));
    };

    const next = () => {
      token++;
      index++;
      if (index < chunks.length) speakChunk();
      else pb.finish();
    };

    const speakChunk = () => {
      if (pb.done) return;
      const my = ++token;
      const state = { started: false };
      const live = () => my === token && !pb.done;
      const u = new SpeechSynthesisUtterance(chunks[index]);
      u.lang = 'fr-FR';
      if (this.frVoice) u.voice = this.frVoice;
      u.pitch = tts.pitch;
      u.rate = pb.spoken.kind === 'number' ? 1.1 : tts.rate;
      u.onstart = () => {
        if (live()) state.started = true;
      };
      u.onend = () => {
        if (live()) next();
      };
      u.onerror = (e) => {
        if (!live()) return;
        if (state.started) next();
        else if (e.error === 'not-allowed') toTimer('synthèse vocale refusée par le navigateur');
        else if (!retried) {
          retried = true;
          speakChunk();
        } else toTimer(`synthèse vocale en erreur (${e.error})`);
      };
      this.utterance = u;
      if (synth.speaking || synth.pending) synth.cancel();
      if (synth.paused) synth.resume();
      synth.speak(u);
      void watch(my, state);
    };

    /** Surveillance (toutes les 200 ms réelles) pour les événements que le navigateur oublie. */
    const watch = async (my: number, state: { started: boolean }) => {
      const t0 = this.clock.now;
      let quiet = 0;
      for (;;) {
        await this.clock.wait(this.real(200));
        if (my !== token || pb.done) return;
        if (!state.started && synth.speaking) state.started = true; // début non signalé
        if (!state.started) {
          if (this.clock.now - t0 < this.real(2500)) continue;
          if (!retried) {
            // Phrase ignorée (souvent juste après une autre) : une seconde tentative.
            retried = true;
            speakChunk();
          } else toTimer('la synthèse vocale ne démarre pas');
          return;
        }
        if (synth.speaking || synth.pending) {
          quiet = 0;
          continue;
        }
        // Le navigateur ne parle plus, mais n'a pas signalé la fin : on enchaîne.
        if (++quiet >= 2) {
          this.diag.secours(`« ${pb.spoken.id} » : fin de phrase non signalée par la synthèse, on enchaîne`);
          next();
          return;
        }
      }
    };

    pb.stopMedia = () => {
      token++;
      synth.cancel();
    };
    // Une lecture coupée (application en arrière-plan) est rejouée en entier, gratuitement (P7).
    pb.onPause = () => {
      token++;
      synth.cancel();
    };
    pb.onResume = () => {
      index = 0;
      retried = false;
      speakChunk();
    };
    if (!this.paused) speakChunk();
  }
}
