#!/usr/bin/env node
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const inputDir = getArg('input');
const textsPath = getArg('texts');
const profilePath = getArg('profile');

if (!inputDir || !textsPath) {
  console.error('Usage: node add-text-overlay.js --input <dir> --texts <texts.json> [--profile <profile.json>]');
  process.exit(1);
}

const texts = JSON.parse(fs.readFileSync(textsPath, 'utf-8'));
if (texts.length !== 6) {
  console.error('texts.json must have exactly 6 entries');
  process.exit(1);
}

const profile = profilePath && fs.existsSync(profilePath)
  ? JSON.parse(fs.readFileSync(profilePath, 'utf-8'))
  : {};

function registerWindowsFallbackFonts() {
  const fontCandidates = [
    { path: 'C:/Windows/Fonts/arial.ttf', family: 'Arial' },
    { path: 'C:/Windows/Fonts/arialbd.ttf', family: 'Arial Bold' },
    { path: 'C:/Windows/Fonts/segoeui.ttf', family: 'Segoe UI' },
    { path: 'C:/Windows/Fonts/segoeuib.ttf', family: 'Segoe UI Bold' }
  ];
  for (const candidate of fontCandidates) {
    if (fs.existsSync(candidate.path)) {
      try { GlobalFonts.registerFromPath(candidate.path, candidate.family); } catch {}
    }
  }
}
registerWindowsFallbackFonts();

function overlayConfigFromProfile(profileObj) {
  const overlay = (profileObj.render && profileObj.render.overlay) || {};
  const preset = overlay.preset || 'top-safe';
  const presetMap = {
    'top-safe': { centerYRatio: 0.18, minYRatio: 0.08, maxYRatio: 0.34 },
    'upper-third': { centerYRatio: 0.26, minYRatio: 0.12, maxYRatio: 0.40 },
    'middle': { centerYRatio: 0.30, minYRatio: 0.12, maxYRatio: 0.55 },
    'lower-third': { centerYRatio: 0.62, minYRatio: 0.35, maxYRatio: 0.72 },
    'bottom-safe': { centerYRatio: 0.68, minYRatio: 0.45, maxYRatio: 0.76 }
  };
  return {
    fontSizeRatio: overlay.fontSizeRatio || 0.065,
    outlineRatio: overlay.outlineRatio || 0.15,
    maxWidthRatio: overlay.maxWidthRatio || 0.75,
    ...presetMap[preset],
    ...(overlay.centerYRatio ? { centerYRatio: overlay.centerYRatio } : {}),
    ...(overlay.minYRatio ? { minYRatio: overlay.minYRatio } : {}),
    ...(overlay.maxYRatio ? { maxYRatio: overlay.maxYRatio } : {})
  };
}

const overlayCfg = overlayConfigFromProfile(profile);

function wrapText(ctx, text, maxWidth) {
  const cleanText = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
  const manualLines = cleanText.split('\n');
  const wrapped = [];

  for (const line of manualLines) {
    if (ctx.measureText(line.trim()).width <= maxWidth) {
      wrapped.push(line.trim());
      continue;
    }
    const words = line.trim().split(/\s+/);
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) current = test;
      else {
        if (current) wrapped.push(current);
        current = word;
      }
    }
    if (current) wrapped.push(current);
  }
  return wrapped;
}

async function addOverlay(imgPath, text, outPath) {
  const img = await loadImage(imgPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, img.width, img.height);

  const fontSize = Math.round(img.width * overlayCfg.fontSizeRatio);
  const outlineWidth = Math.max(2, Math.round(fontSize * overlayCfg.outlineRatio));
  const maxWidth = img.width * overlayCfg.maxWidthRatio;
  const lineHeight = fontSize * 1.25;

  ctx.font = `bold ${fontSize}px "Arial Bold", Arial, "Segoe UI Bold", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const lines = wrapText(ctx, text, maxWidth);
  const totalHeight = lines.length * lineHeight;
  const startY = (img.height * overlayCfg.centerYRatio) - (totalHeight / 2) + (lineHeight / 2);
  const minY = img.height * overlayCfg.minYRatio;
  const maxY = img.height * overlayCfg.maxYRatio - totalHeight;
  const safeY = Math.max(minY, Math.min(startY, maxY));
  const x = img.width / 2;

  for (let i = 0; i < lines.length; i++) {
    const y = safeY + (i * lineHeight);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = outlineWidth;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(lines[i], x, y);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(lines[i], x, y);
  }

  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log(`Created ${path.basename(outPath)} @ center-x / y=${Math.round(safeY)}`);
}

(async () => {
  for (let i = 0; i < 6; i++) {
    const input = path.join(inputDir, `slide${i + 1}_raw.png`);
    const output = path.join(inputDir, `slide${i + 1}.png`);
    if (!fs.existsSync(input)) {
      console.error(`Missing ${input}`);
      process.exit(1);
    }
    await addOverlay(input, texts[i], output);
  }
  fs.writeFileSync(path.join(inputDir, 'texts.used.json'), JSON.stringify(texts, null, 2));
})();
