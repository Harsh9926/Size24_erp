import { cpSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const erpDist    = resolve(__dirname, '../dist');
const landingDist = resolve(__dirname, '../../../size24-landing/dist');

if (!existsSync(landingDist)) {
    console.warn('[merge-landing] size24-landing/dist not found — skipping.');
    process.exit(0);
}

// 1. Copy hashed JS/CSS assets
cpSync(`${landingDist}/assets`, `${erpDist}/assets`, { recursive: true });

// 2. Copy root-level files (images, fonts, etc.) — skip index.html, assets/, journey/
for (const entry of readdirSync(landingDist)) {
    if (entry === 'index.html' || entry === 'assets' || entry === 'journey') continue;
    const src = join(landingDist, entry);
    if (statSync(src).isFile()) cpSync(src, join(erpDist, entry));
}

// 3. Copy journey/ subfolder
const journeySrc = `${landingDist}/journey`;
if (existsSync(journeySrc)) {
    mkdirSync(`${erpDist}/journey`, { recursive: true });
    cpSync(journeySrc, `${erpDist}/journey`, { recursive: true });
}

// 4. Swap index.html → launch.html
cpSync(`${landingDist}/index.html`, `${erpDist}/launch.html`);

console.log('[merge-landing] Landing page merged into ERP dist.');
