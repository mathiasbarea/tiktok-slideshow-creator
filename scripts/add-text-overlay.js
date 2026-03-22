#!/usr/bin/env node
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const { drawTextInSlot, normalizeText, registerWindowsFallbackFonts, wrapText } = require('./_render-text');
const { flattenTextEntry, loadTemplateForSelection } = require('./_templates');

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const postDir = getArg('input');
const textsPath = getArg('texts');
const profilePath = getArg('profile');
const inputDir = postDir ? path.join(postDir, 'images') : null;

if (!postDir || !textsPath) {
  console.error('Usage: node add-text-overlay.js --input <post-dir> --texts <texts.json> [--profile <profile.json>]');
  process.exit(1);
}

const profile = profilePath && fs.existsSync(profilePath)
  ? JSON.parse(fs.readFileSync(profilePath, 'utf-8'))
  : {};
const postJson = fs.existsSync(path.join(postDir, 'post.json'))
  ? JSON.parse(fs.readFileSync(path.join(postDir, 'post.json'), 'utf-8'))
  : {};
const visualTemplate = loadTemplateForSelection(postJson.visualTemplateId, {
  postDir,
  accountId: postJson.accountId || '',
});
const texts = JSON.parse(fs.readFileSync(textsPath, 'utf-8'));
const expectedSlideCount = visualTemplate?.slides?.length || 6;
if (texts.length !== expectedSlideCount) {
  console.error(`texts.json must have exactly ${expectedSlideCount} entries`);
  process.exit(1);
}

registerWindowsFallbackFonts();

function overlayConfigFromProfile(profileObj) {
  const overlay = (profileObj.render && profileObj.render.overlay) || {};
  const preset = overlay.preset || overlay.placement || 'top-safe';
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

function normalizeTemplateEntry(entry, slide) {
  if (!slide || !slide.slots || slide.slots.length === 0) return {};
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) return entry;
  if (typeof entry === 'string' && slide.slots.length === 1) {
    return { [slide.slots[0].name]: normalizeText(entry) };
  }
  throw new Error(`Slide ${slide.index} requires template slot objects in texts.json.`);
}

async function addLegacyOverlay(imgPath, text, outPath) {
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

  for (let i = 0; i < lines.length; i += 1) {
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

async function addTemplateOverlay(imgPath, slide, textEntry, outPath) {
  if (!slide || !slide.slots || slide.slots.length === 0) {
    fs.copyFileSync(imgPath, outPath);
    console.log(`Copied static ${path.basename(outPath)}`);
    return;
  }

  const img = await loadImage(imgPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, img.width, img.height);

  const normalizedEntry = normalizeTemplateEntry(textEntry, slide);
  for (const slot of slide.slots) {
    drawTextInSlot(ctx, normalizedEntry[slot.name], slot, img.width, img.height);
  }

  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log(`Created ${path.basename(outPath)} using template ${visualTemplate.id}`);
}

(async () => {
  for (let i = 0; i < expectedSlideCount; i += 1) {
    const slideIndex = i + 1;
    const input = path.join(inputDir, `slide${slideIndex}_raw.png`);
    const output = path.join(inputDir, `slide${slideIndex}.png`);

    if (!fs.existsSync(input)) {
      console.error(`Missing ${input}`);
      process.exit(1);
    }

    if (visualTemplate?.renderMode === 'template-pack') {
      const slide = visualTemplate.slides.find((entry) => entry.index === slideIndex);
      await addTemplateOverlay(input, slide, texts[i], output);
      continue;
    }

    await addLegacyOverlay(input, flattenTextEntry(texts[i]), output);
  }

  fs.writeFileSync(path.join(inputDir, 'texts.used.json'), JSON.stringify(texts, null, 2));
})().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
