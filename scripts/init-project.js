#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const dir = getArg('dir') || 'content/tiktok-slideshows';
fs.mkdirSync(dir, { recursive: true });

const files = {
  'defaults.json': {
    language: 'en',
    imageGen: {
      provider: 'gemini',
      model: 'gemini-3.1-flash-image-preview'
    },
    slides: {
      count: 6,
      width: 1024,
      height: 1536
    }
  }
};

for (const [name, value] of Object.entries(files)) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(value, null, 2));
    console.log(`Created ${p}`);
  }
}

console.log(`\nProject initialized at ${dir}`);
