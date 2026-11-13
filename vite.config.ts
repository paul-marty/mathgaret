import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { buildAudioManifest } from './tools/manifeste-audio.mjs';

/**
 * Chemin de base du site. GitHub Pages sert un dépôt « projet » sous /<nom-du-dépôt>/ :
 * le workflow de déploiement fournit BASE_PATH. En local, on reste à la racine.
 */
const base = process.env.BASE_PATH || '/';

/**
 * Garde-fou : fait échouer le build si la valeur d'une clé secrète présente dans .env
 * (ELEVENLABS_API_KEY, OPENAI_API_KEY, …) se retrouve dans un fichier du dossier de sortie.
 */
function secretGuard(): Plugin {
  let outDir = 'dist';
  let secrets: string[] = [];
  return {
    name: 'secret-guard',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      // Uniquement les valeurs écrites dans les fichiers .env du projet (+ les clés connues).
      const entries: [string, string][] = [];
      for (const name of ['.env', '.env.local', `.env.${config.mode}`, `.env.${config.mode}.local`]) {
        const file = join(config.root, name);
        if (!existsSync(file)) continue;
        for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
          const m = /^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
          if (m) entries.push([m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]);
        }
      }
      for (const k of ['ELEVENLABS_API_KEY', 'OPENAI_API_KEY']) {
        const v = process.env[k];
        if (v) entries.push([k, v]);
      }
      secrets = entries.filter(([k, v]) => /(KEY|SECRET|TOKEN|PASSWORD)/i.test(k) && v.length >= 12).map(([, v]) => v);
    },
    closeBundle() {
      if (secrets.length === 0) return;
      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((name) => {
          const p = join(dir, name);
          return statSync(p).isDirectory() ? walk(p) : [p];
        });
      for (const file of walk(outDir)) {
        if (!/\.(js|mjs|css|html|json|webmanifest|txt|map|svg)$/i.test(file)) continue;
        const content = readFileSync(file, 'utf8');
        if (secrets.some((s) => content.includes(s))) {
          throw new Error(`[secret-guard] Une clé secrète du fichier .env a été trouvée dans ${file}. Build annulé.`);
        }
      }
    },
  };
}

/**
 * Manifeste des fichiers audio livrés (public/audio/manifest.json) : reconstruit à chaque lancement
 * (dev, build) et, pendant `npm run dev`, dès qu'un fichier est ajouté ou retiré de public/audio.
 * Déposer les fichiers suffit : aucune commande à lancer.
 */
function audioManifest(): Plugin {
  let root = process.cwd();
  return {
    name: 'audio-manifest',
    configResolved(config) {
      root = config.root;
      config.logger.info(`  ${buildAudioManifest(root).summary}`);
    },
    configureServer(server) {
      const dir = resolve(root, 'public/audio');
      let timer: ReturnType<typeof setTimeout> | undefined;
      const changed = (file: string) => {
        if (!file.startsWith(dir) || /manifest\.json|\.tmp$/.test(file)) return;
        clearTimeout(timer);
        timer = setTimeout(() => server.config.logger.info(`  ${buildAudioManifest(root).summary}`, { timestamp: true }), 300);
      };
      server.watcher.on('add', changed);
      server.watcher.on('unlink', changed);
    },
  };
}

export default defineConfig({
  base,
  build: {
    outDir: process.env.OUT_DIR || 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  // host: true → le serveur est joignable depuis la Shield sur le réseau local.
  server: { host: true },
  preview: { host: true },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Mathgaret',
        short_name: 'Mathgaret',
        description: 'Avec Margaret Hamilton, prépare la mission Apollo 11 en résolvant des problèmes de maths.',
        lang: 'fr',
        start_url: '.',
        scope: '.',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#101a33',
        theme_color: '#101a33',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout est mis en cache pour jouer hors ligne, voix comprises.
        globPatterns: ['**/*.{js,css,html,png,svg,webp,mp3,ogg,json,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Dès la première visite, la page est servie par le cache (jouable si le réseau tombe).
        // Les mises à jour, elles, attendent le prochain lancement (pas de changement en pleine partie).
        clientsClaim: true,
      },
    }),
    secretGuard(),
    audioManifest(),
  ],
});
