// Génère les icônes PNG de la PWA à partir de public/favicon.svg (via le Chromium de Playwright).
// Usage : npm run icons
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const outDir = new URL('../public/icons/', import.meta.url);
await mkdir(outDir, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0 },
  // « maskable » : Android découpe l'icône (cercle, goutte…) → on garde 20 % de marge.
  { file: 'icon-maskable-512.png', size: 512, padding: 0.2 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, padding } of targets) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - padding));
  await page.setContent(
    `<html><body style="margin:0;background:#0b1440;display:grid;place-items:center;width:${size}px;height:${size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`,
  );
  await page.screenshot({ path: new URL(file, outDir).pathname, omitBackground: false });
  console.log(`✓ public/icons/${file}`);
}
await browser.close();
