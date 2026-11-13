/**
 * Assemblage d'une réplique à partir de plusieurs fichiers (morceaux de phrase et nombres) :
 * chaque fichier est débarrassé de son silence de début et de fin, puis les morceaux sont mis
 * bout à bout avec les pauses demandées, dans un seul tampon (une seule lecture, un seul effet radio).
 */

/** Indices [début, fin[ du son utile : on retire le silence (et le bourrage du MP3) aux deux bouts. */
export function trimBounds(
  data: Float32Array,
  rate: number,
  startLevel = 0.008,
  endLevel = 0.004,
  before = 0.012,
  after = 0.04,
): [number, number] {
  let first = -1;
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > startLevel) {
      first = i;
      break;
    }
  }
  if (first < 0) return [0, data.length];
  let last = first;
  for (let i = data.length - 1; i > first; i--) {
    if (Math.abs(data[i]) > endLevel) {
      last = i;
      break;
    }
  }
  // Un peu de marge : l'attaque d'une consonne, la fin d'une voyelle qui s'éteint.
  const start = Math.max(0, first - Math.round(rate * before));
  const end = Math.min(data.length, last + 1 + Math.round(rate * after));
  return [start, end];
}

/** Canal unique (moyenne des canaux). */
function mono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += d[i] / buffer.numberOfChannels;
  }
  return out;
}

/** Met les morceaux bout à bout ; `pauses[i]` (ms) précède le morceau i. */
export function joinClips(ctx: BaseAudioContext, buffers: AudioBuffer[], pauses: number[]): AudioBuffer {
  const rate = ctx.sampleRate;
  const fade = Math.round(rate * 0.004);
  const pieces = buffers.map((b) => {
    const data = mono(b);
    const [s, e] = trimBounds(data, rate);
    return data.subarray(s, e);
  });
  const gaps = pauses.map((ms, i) => (i === 0 ? 0 : Math.round((rate * ms) / 1000)));
  const total = pieces.reduce((n, p, i) => n + p.length + gaps[i], 0);
  const out = ctx.createBuffer(1, Math.max(1, total), rate);
  const dst = out.getChannelData(0);
  let at = 0;
  pieces.forEach((p, i) => {
    at += gaps[i];
    dst.set(p, at);
    // Fondus très courts aux coupures : pas de clic.
    const f = Math.min(fade, Math.floor(p.length / 2));
    for (let k = 0; k < f; k++) {
      dst[at + k] *= k / f;
      dst[at + p.length - 1 - k] *= k / f;
    }
    at += p.length;
  });
  return out;
}

/** Points de bouclage d'un fichier en boucle (s) : on saute le bourrage silencieux que le MP3 ajoute aux deux bouts. */
export function loopPoints(buffer: AudioBuffer): [number, number] {
  const [s, e] = trimBounds(buffer.getChannelData(0), buffer.sampleRate, 1e-4, 1e-4, 0, 0);
  return e - s > buffer.sampleRate * 0.2 ? [s / buffer.sampleRate, e / buffer.sampleRate] : [0, buffer.duration];
}
