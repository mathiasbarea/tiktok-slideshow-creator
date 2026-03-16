#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const dir = getArg('dir') || 'content/shortform-content';
fs.mkdirSync(dir, { recursive: true });

const files = {
  'defaults.json': {
    language: 'en',
    imageGen: {
      provider: 'openai',
      model: 'gpt-image-1'
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
