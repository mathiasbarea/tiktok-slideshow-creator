#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function processLogPathFor(outputDir) {
  return path.join(outputDir, 'generation-process.log');
}

function appendProcessLog(outputDir, text) {
  fs.appendFileSync(processLogPathFor(outputDir), text, 'utf8');
}

function logPathFor(outputDir) {
  return path.join(outputDir, 'generation-log.json');
}

function readLog(outputDir) {
  const p = logPathFor(outputDir);
  if (!fs.existsSync(p)) return { attempts: [] };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { attempts: [] };
  }
}

function writeLog(outputDir, data) {
  fs.writeFileSync(logPathFor(outputDir), JSON.stringify(data, null, 2));
}

function appendAttempt(outputDir, attempt) {
  const log = readLog(outputDir);
  log.attempts = Array.isArray(log.attempts) ? log.attempts : [];
  log.attempts.push(attempt);
  writeLog(outputDir, log);
  return log.attempts.length - 1;
}

function updateAttempt(outputDir, index, patch) {
  const log = readLog(outputDir);
  log.attempts = Array.isArray(log.attempts) ? log.attempts : [];
  if (!log.attempts[index]) log.attempts[index] = {};
  log.attempts[index] = { ...log.attempts[index], ...patch };
  writeLog(outputDir, log);
}

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

function aspectRatioFromSize(width, height) {
  if (!width || !height) return '9:16';
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.08) return '1:1';
  if (ratio < 1) return '9:16';
  if (Math.abs(ratio - (4 / 3)) < 0.08) return '4:3';
  return '16:9';
}

function imageSizeFromDimensions(width, height) {
  return Math.max(width, height) > 1024 ? '2K' : '1K';
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
const openaiApiKey = process.env.OPENAI_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const width = config.slides?.width || 1024;
const height = config.slides?.height || 1536;
const slideCount = config.slides?.count || 6;
const size = `${width}x${height}`;
const language = config.language || 'en';
const geminiAspectRatio = aspectRatioFromSize(width, height);
const geminiImageSize = imageSizeFromDimensions(width, height);

if (!prompts.slides || prompts.slides.length !== slideCount) {
  console.error(`prompts.json must contain exactly ${slideCount} slide prompts`);
  process.exit(1);
}

if (provider === 'openai' && !openaiApiKey) {
  console.error('Missing OPENAI_API_KEY. Configure it via ~/.openclaw/openclaw.json under skills.entries.tiktok-slideshow-creator.');
  process.exit(1);
}
if (provider === 'gemini' && !geminiApiKey) {
  console.error('Missing GEMINI_API_KEY. Configure it via ~/.openclaw/openclaw.json under skills.entries.tiktok-slideshow-creator.env.GEMINI_API_KEY.');
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
      'Authorization': `Bearer ${openaiApiKey}`,
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
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: form
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  fs.writeFileSync(outPath, Buffer.from(data.data[0].b64_json, 'base64'));
}

async function generateGemini(prompt, outPath) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: geminiAspectRatio,
          imageSize: geminiImageSize
        }
      }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(part => part.inlineData?.data);
  if (!imagePart) throw new Error(`Gemini did not return image data: ${JSON.stringify(data)}`);
  fs.writeFileSync(outPath, Buffer.from(imagePart.inlineData.data, 'base64'));
}

async function editGemini(referencePath, prompt, outPath) {
  const referenceBase64 = fs.readFileSync(referencePath).toString('base64');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: referenceBase64 } }
        ]
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: geminiAspectRatio,
          imageSize: geminiImageSize
        }
      }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(part => part.inlineData?.data);
  if (!imagePart) throw new Error(`Gemini did not return edited image data: ${JSON.stringify(data)}`);
  fs.writeFileSync(outPath, Buffer.from(imagePart.inlineData.data, 'base64'));
}

async function generateLocal(_prompt, outPath, slideNum) {
  const localPath = path.join(outputDir, `local_slide${slideNum}.png`);
  if (!fs.existsSync(localPath)) throw new Error(`Place local image at ${localPath}`);
  fs.copyFileSync(localPath, outPath);
}

async function generateByProvider(prompt, outPath, slideNum) {
  if (provider === 'local') return generateLocal(prompt, outPath, slideNum);
  if (provider === 'openai') return generateOpenAI(prompt, outPath);
  if (provider === 'gemini') return generateGemini(prompt, outPath);
  throw new Error(`Unsupported provider: ${provider}`);
}

async function editByProvider(referencePath, prompt, outPath) {
  if (provider === 'openai') return editOpenAI(referencePath, prompt, outPath);
  if (provider === 'gemini') return editGemini(referencePath, prompt, outPath);
  throw new Error(`Hero variations are not implemented for provider: ${provider}`);
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
    await generateByProvider(prompt, outPath, i + 1);
    console.log(`Saved ${outPath}`);
  }
}

async function runHeroVariations() {
  if (provider === 'local') {
    console.log('Mode hero-variations is not implemented for local provider. Falling back to independent mode.');
    return runIndependent();
  }

  console.log(`Generating ${slideCount} raw slides using ${provider}/${model} at ${size} (language=${language}, mode=hero-variations)`);
  appendProcessLog(outputDir, `\n===== generate-images attempt ${new Date().toISOString()} =====\n`);
  appendProcessLog(outputDir, `mode=hero-variations provider=${provider} model=${model} slideCount=${slideCount}\n`);
  const heroPath = path.join(outputDir, 'hero_frame.png');
  const slide1Path = path.join(outputDir, 'slide1_raw.png');
  const attemptIndex = appendAttempt(outputDir, {
    startedAt: new Date().toISOString(),
    mode: 'hero-variations',
    provider,
    model,
    slideCount,
    slides: []
  });
  try {
    const heroEntry = { slide: 0, output: 'hero_frame.png', startedAt: new Date().toISOString() };
    try {
      if (!fs.existsSync(heroPath) || fs.statSync(heroPath).size <= 10000) {
        console.log('Generating hero frame...');
        appendProcessLog(outputDir, `hero: start generate hero_frame.png\n`);
        await generateByProvider(heroPrompt(), heroPath, 1);
        console.log(`Saved ${heroPath}`);
        heroEntry.status = 'ok';
        appendProcessLog(outputDir, `hero: ok bytes=${fs.existsSync(heroPath) ? fs.statSync(heroPath).size : 0}\n`);
      } else {
        console.log('Reusing existing hero frame');
        heroEntry.status = 'skipped-existing';
      }
      heroEntry.bytes = fs.existsSync(heroPath) ? fs.statSync(heroPath).size : 0;
    } catch (err) {
      heroEntry.status = 'failed';
      heroEntry.error = err.message || String(err);
      heroEntry.timeoutDetected = /timeout|timed out|etimedout|deadline/i.test(heroEntry.error);
      heroEntry.rateLimitDetected = /rate limit|429|quota/i.test(heroEntry.error);
      throw err;
    } finally {
      heroEntry.finishedAt = new Date().toISOString();
      const log = readLog(outputDir); log.attempts[attemptIndex].slides.push(heroEntry); writeLog(outputDir, log);
    }

    const slide1Entry = { slide: 1, output: 'slide1_raw.png', startedAt: new Date().toISOString() };
    if (!fs.existsSync(slide1Path) || fs.statSync(slide1Path).size <= 10000) {
      fs.copyFileSync(heroPath, slide1Path);
      console.log(`Saved ${slide1Path} from hero frame`);
      slide1Entry.status = 'ok';
      appendProcessLog(outputDir, `slide 1: ok bytes=${fs.existsSync(slide1Path) ? fs.statSync(slide1Path).size : 0} source=hero_frame\n`);
    } else {
      slide1Entry.status = 'skipped-existing';
      console.log(`Skipping existing ${path.basename(slide1Path)}`);
    }
    slide1Entry.bytes = fs.existsSync(slide1Path) ? fs.statSync(slide1Path).size : 0;
    slide1Entry.finishedAt = new Date().toISOString();
    { const log = readLog(outputDir); log.attempts[attemptIndex].slides.push(slide1Entry); writeLog(outputDir, log); }

    for (let i = 1; i < slideCount; i++) {
      const outPath = path.join(outputDir, `slide${i + 1}_raw.png`);
      const slideEntry = { slide: i + 1, output: path.basename(outPath), startedAt: new Date().toISOString() };
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 10000) {
        slideEntry.status = 'skipped-existing';
        slideEntry.bytes = fs.statSync(outPath).size;
        slideEntry.finishedAt = new Date().toISOString();
        { const log = readLog(outputDir); log.attempts[attemptIndex].slides.push(slideEntry); writeLog(outputDir, log); }
        appendProcessLog(outputDir, `slide ${i + 1}: skipped-existing ${path.basename(outPath)} bytes=${slideEntry.bytes}\n`);
        console.log(`Skipping existing ${path.basename(outPath)}`);
        continue;
      }
      const prompt = variationPrompt(prompts.slides[i], i + 1);
      console.log(`Generating slide ${i + 1} from hero frame...`);
      try {
        appendProcessLog(outputDir, `slide ${i + 1}: start edit ${path.basename(outPath)}\n`);
        await editByProvider(heroPath, prompt, outPath);
        slideEntry.status = 'ok';
        slideEntry.bytes = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
        appendProcessLog(outputDir, `slide ${i + 1}: ok bytes=${slideEntry.bytes || 0}\n`);
      } catch (err) {
        slideEntry.status = 'failed';
        slideEntry.error = err.message || String(err);
        slideEntry.timeoutDetected = /timeout|timed out|etimedout|deadline/i.test(slideEntry.error);
        slideEntry.rateLimitDetected = /rate limit|429|quota/i.test(slideEntry.error);
        appendProcessLog(outputDir, `slide ${i + 1}: failed error=${slideEntry.error}\n`);
        throw err;
      } finally {
        slideEntry.finishedAt = new Date().toISOString();
        const log = readLog(outputDir); log.attempts[attemptIndex].slides.push(slideEntry); writeLog(outputDir, log);
      }
      console.log(`Saved ${outPath}`);
    }
    updateAttempt(outputDir, attemptIndex, { status: 'ok', finishedAt: new Date().toISOString() });
    appendProcessLog(outputDir, `attempt status=ok\n`);
  } catch (err) {
    updateAttempt(outputDir, attemptIndex, { status: 'failed', finishedAt: new Date().toISOString(), error: err.message || String(err) });
    appendProcessLog(outputDir, `attempt status=failed error=${err.message || String(err)}\n`);
    throw err;
  }
}

(async () => {
  if (mode === 'independent') await runIndependent();
  else await runHeroVariations();
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
