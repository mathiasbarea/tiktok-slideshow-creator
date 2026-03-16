#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const dir = getArg('dir');
const outDirArg = getArg('out');
if (!dir) {
  console.error('Usage: node export-ready-package.js --dir <post-dir> [--out <export-dir>]');
  process.exit(1);
}

const outDir = outDirArg || path.join(dir, 'ready-to-publish');
fs.mkdirSync(outDir, { recursive: true });

const slides = [];
for (let i = 1; i <= 6; i++) {
  const src = path.join(dir, `slide${i}.png`);
  const dest = path.join(outDir, `slide${i}.png`);
  if (!fs.existsSync(src)) {
    console.error(`Missing ${src}`);
    process.exit(1);
  }
  fs.copyFileSync(src, dest);
  slides.push(`slide${i}.png`);
}

const captionSrc = path.join(dir, 'caption.txt');
if (fs.existsSync(captionSrc)) {
  fs.copyFileSync(captionSrc, path.join(outDir, 'caption.txt'));
}

const manifest = {
  createdAt: new Date().toISOString(),
  type: 'shortform-slideshow-ready-package',
  readyFor: ['manual-upload', 'future-publishing-adapter'],
  slides,
  caption: fs.existsSync(captionSrc) ? 'caption.txt' : null,
  notes: 'Upload slide1.png through slide6.png as a TikTok slideshow/carousel and use caption.txt as the post caption.'
};

fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(manifest, null, 2));
console.log(`Ready package exported to ${outDir}`);
