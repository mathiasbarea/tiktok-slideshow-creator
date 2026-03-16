#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

function readJsonIfExists(filePath) {
  if (!filePath) return {};
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function mergeConfig(defaults, profile) {
  return {
    language: profile.language || defaults.language || 'en',
    imageGen: {
      ...(defaults.imageGen || {}),
      ...((profile.render && profile.render.imageGen) || {})
    },
    slides: {
      ...(defaults.slides || {}),
      ...((profile.render && profile.render.slides) || {})
    }
  };
}

const defaultsPath = getArg('defaults');
const profilePath = getArg('profile');
const outputDirArg = getArg('output');
const outputDir = outputDirArg ? path.join(outputDirArg, 'images') : null;
const promptsPath = getArg('prompts');
const mode = getArg('mode') || 'hero-variations';

if (!defaultsPath || !outputDir || !promptsPath) {
  console.error('Usage: node generate-images.js --defaults <defaults.json> [--profile <profile.json>] --output <dir> --prompts <prompts.json> [--mode hero-variations|independent]');
  process.exit(1);
}

const defaults = readJsonIfExists(defaultsPath);
const profile = readJsonIfExists(profilePath);
const config = mergeConfig(defaults, profile);
const prompts = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));
fs.mkdirSync(outputDir, { recursive: true });

const provider = config.imageGen?.provider || 'openai';
const model = config.imageGen?.model || 'gpt-image-1';
const apiKey = process.env.OPENAI_API_KEY;
const width = config.slides?.width || 1024;
const height = config.slides?.height || 1536;
const slideCount = config.slides?.count || 6;
const size = `${width}x${height}`;
const language = config.language || 'en';

if (!prompts.slides || prompts.slides.length !== slideCount) {
  console.error(`prompts.json must contain exactly ${slideCount} slide prompts`);
  process.exit(1);
}

if (!apiKey && provider !== 'local') {
  console.error('Missing OPENAI_API_KEY. Configure it via ~/.openclaw/openclaw.json under skills.entries.shortform-content.');
  process.exit(1);
}

function makePrompt(text) {
  return `[Output language hint: ${language}]\n${text}`;
}

function heroPrompt() {
  const identityLock = 'Generate a highly consistent hero frame. Lock subject identity, clothing, hairstyle, facial hair, age range, body type, workspace layout, desk objects, background, and camera angle so follow-up variations can preserve them.';
  return makePrompt(`${prompts.base}\n\n${prompts.slides[0]}\n\n${identityLock}`);
}

function variationPrompt(slideText, slideNum) {
  return makePrompt(`${prompts.base}\n\n${slideText}\n\nUse the attached hero frame as a strong identity and scene reference. Preserve the same person, same clothing family, same workspace, same desk setup, and same camera angle. Only change expression, posture, and subtle state progression for slide ${slideNum}. Do not change the subject into a different person. Do not move to a different room.`);
}

async function generateOpenAI(prompt, outPath) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size,
      quality: 'high'
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  fs.writeFileSync(outPath, Buffer.from(data.data[0].b64_json, 'base64'));
}

async function editOpenAI(referencePath, prompt, outPath) {
  const form = new FormData();
  const blob = new Blob([fs.readFileSync(referencePath)], { type: 'image/png' });
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('image', blob, path.basename(referencePath));

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: form
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  fs.writeFileSync(outPath, Buffer.from(data.data[0].b64_json, 'base64'));
}

async function generateLocal(_prompt, outPath, slideNum) {
  const localPath = path.join(outputDir, `local_slide${slideNum}.png`);
  if (!fs.existsSync(localPath)) throw new Error(`Place local image at ${localPath}`);
  fs.copyFileSync(localPath, outPath);
}

async function runIndependent() {
  console.log(`Generating ${slideCount} raw slides using ${provider}/${model} at ${size} (language=${language}, mode=independent)`);
  for (let i = 0; i < slideCount; i++) {
    const outPath = path.join(outputDir, `slide${i + 1}_raw.png`);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 10000) {
      console.log(`Skipping existing ${path.basename(outPath)}`);
      continue;
    }
    const prompt = makePrompt(`${prompts.base}\n\n${prompts.slides[i]}`);
    console.log(`Generating slide ${i + 1}...`);
    if (provider === 'local') await generateLocal(prompt, outPath, i + 1);
    else if (provider === 'openai') await generateOpenAI(prompt, outPath);
    else throw new Error(`Unsupported provider for v1: ${provider}`);
    console.log(`Saved ${outPath}`);
  }
}

async function runHeroVariations() {
  if (provider !== 'openai') {
    console.log(`Mode hero-variations is currently implemented for openai only. Falling back to independent mode for provider=${provider}.`);
    return runIndependent();
  }

  console.log(`Generating ${slideCount} raw slides using ${provider}/${model} at ${size} (language=${language}, mode=hero-variations)`);
  const heroPath = path.join(outputDir, 'hero_frame.png');
  const slide1Path = path.join(outputDir, 'slide1_raw.png');

  if (!fs.existsSync(heroPath) || fs.statSync(heroPath).size <= 10000) {
    console.log('Generating hero frame...');
    await generateOpenAI(heroPrompt(), heroPath);
    console.log(`Saved ${heroPath}`);
  } else {
    console.log('Reusing existing hero frame');
  }

  if (!fs.existsSync(slide1Path) || fs.statSync(slide1Path).size <= 10000) {
    fs.copyFileSync(heroPath, slide1Path);
    console.log(`Saved ${slide1Path} from hero frame`);
  }

  for (let i = 1; i < slideCount; i++) {
    const outPath = path.join(outputDir, `slide${i + 1}_raw.png`);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 10000) {
      console.log(`Skipping existing ${path.basename(outPath)}`);
      continue;
    }
    const prompt = variationPrompt(prompts.slides[i], i + 1);
    console.log(`Generating slide ${i + 1} from hero frame...`);
    await editOpenAI(heroPath, prompt, outPath);
    console.log(`Saved ${outPath}`);
  }
}

(async () => {
  if (mode === 'independent') await runIndependent();
  else await runHeroVariations();
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
