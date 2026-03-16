#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const dir = getArg('dir');
const captionPath = getArg('caption');
if (!dir) {
  console.error('Usage: node build-post-package.js --dir <post-dir> [--caption <caption.txt>]');
  process.exit(1);
}

const imagesDir = path.join(dir, 'images');
const slides = [];
for (let i = 1; i <= 6; i++) {
  const p = path.join(imagesDir, `slide${i}.png`);
  if (!fs.existsSync(p)) {
    console.error(`Missing ${p}`);
    process.exit(1);
  }
  slides.push(`slide${i}.png`);
}

let caption = '';
if (captionPath && fs.existsSync(captionPath)) {
  caption = fs.readFileSync(captionPath, 'utf-8');
  fs.copyFileSync(captionPath, path.join(dir, 'caption.txt'));
}

const manifest = {
  createdAt: new Date().toISOString(),
  type: 'shortform-slideshow-package',
  slides,
  captionIncluded: Boolean(caption),
  notes: 'Ready for manual publishing or a future publishing adapter.'
};

fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest, null, 2));
console.log(`Created ${path.join(dir, 'package.json')}`);
