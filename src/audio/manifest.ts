import type { Music } from './Music';
import type { Sfx } from './Sfx';
import type { Voice } from './Voice';

/**
 * Manifeste des fichiers audio livrés (public/audio/manifest.json, reconstruit par Vite) :
 * clé → chemin relatif au manifeste.
 *   voix    : « c1_1_intro », « c1_2_consigne#2 » (morceau), « bilan_efficacite|n=3 », « nombre_7 »
 *   sons    : « appui », « note »… (src/content/audio-catalogue.json)
 *   musique : « mystere », « leger », « calme », « ample »
 */
export interface AudioManifest {
  voix?: Record<string, string>;
  sons?: Record<string, string>;
  musique?: Record<string, string>;
}

/** Charge le manifeste et le distribue. Sans manifeste, tout reste en sons provisoires. */
export async function loadAudioManifest(url: string, to: { voice: Voice; sfx: Sfx; music: Music }): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const raw = (await res.json()) as AudioManifest;
    const base = new URL(url, location.href);
    const resolve = (o: Record<string, string> | undefined) =>
      Object.fromEntries(Object.entries(o ?? {}).map(([k, f]) => [k, new URL(f, base).href]));
    to.voice.files = resolve(raw.voix);
    to.sfx.setFiles(resolve(raw.sons));
    to.music.files = resolve(raw.musique);
  } catch (err) {
    console.warn('[audio] manifeste illisible', err);
  }
}
