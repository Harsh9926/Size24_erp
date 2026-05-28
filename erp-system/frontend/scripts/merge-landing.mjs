import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const erpDist    = resolve(__dirname, '../dist');
const landingDist = resolve(__dirname, '../../../size24-landing/dist');

if (!existsSync(landingDist)) {
    console.warn('[merge-landing] size24-landing/dist not found — skipping landing page merge.');
    process.exit(0);
}

// Copy hashed JS/CSS assets
cpSync(`${landingDist}/assets`, `${erpDist}/assets`, { recursive: true });

// Copy root-level public files (images, fonts, etc.) — skip index.html
cpSync(landingDist, erpDist, {
    recursive: false,
    filter: (src) => !src.endsWith('index.html') && !src.endsWith('/assets'),
});

// Copy journey images subfolder
const journeySrc = `${landingDist}/journey`;
if (existsSync(journeySrc)) {
    mkdirSync(`${erpDist}/journey`, { recursive: true });
    cpSync(journeySrc, `${erpDist}/journey`, { recursive: true });
}

// Replace launch.html with new landing page
cpSync(`${landingDist}/index.html`, `${erpDist}/launch.html`);

console.log('[merge-landing] Landing page merged into ERP dist successfully.');
