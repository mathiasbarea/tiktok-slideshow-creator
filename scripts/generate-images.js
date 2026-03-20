#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const MIN_IMAGE_BYTES = 10000;
const DEFAULT_RETRY_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 4000;
const DEFAULT_RETRY_MAX_DELAY_MS = 20000;
const RATE_LIMIT_ERROR_RE = /rate limit|429|quota/i;
const TRANSIENT_IMAGE_ERROR_RE = /high demand|temporar(?:ily|y) unavailable|overloaded|resource exhausted|try again later/i;

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
  const logPath = logPathFor(outputDir);
  if (!fs.existsSync(logPath)) return { attempts: [] };
  try {
    return JSON.parse(fs.readFileSync(logPath, 'utf8'));
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
      ...((profile.render && profile.render.imageGen) || {}),
    },
    slides: {
      ...(defaults.slides || {}),
      ...((profile.render && profile.render.slides) || {}),
    },
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

function isRateLimitError(value) {
  return RATE_LIMIT_ERROR_RE.test(String(value || ''));
}

function isTransientImageError(value) {
  const text = String(value || '');
  return isRateLimitError(text) || TRANSIENT_IMAGE_ERROR_RE.test(text);
}

function annotateErrorFlags(entry) {
  const errorText = entry?.error || '';
  if (!entry || !errorText) return entry;
  entry.timeoutDetected = /timeout|timed out|etimedout|deadline/i.test(errorText);
  entry.rateLimitDetected = isRateLimitError(errorText);
  entry.transientFailureDetected = isTransientImageError(errorText);
  return entry;
}

function normalizeRetryConfig(retryConfig = {}) {
  const maxAttempts = Number.isFinite(retryConfig.maxAttempts)
    ? Math.max(1, Math.floor(retryConfig.maxAttempts))
    : DEFAULT_RETRY_MAX_ATTEMPTS;
  const baseDelayMs = Number.isFinite(retryConfig.baseDelayMs)
    ? Math.max(0, Math.floor(retryConfig.baseDelayMs))
    : DEFAULT_RETRY_BASE_DELAY_MS;
  const maxDelayMs = Number.isFinite(retryConfig.maxDelayMs)
    ? Math.max(baseDelayMs, Math.floor(retryConfig.maxDelayMs))
    : DEFAULT_RETRY_MAX_DELAY_MS;

  return {
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
  };
}

function calculateRetryDelayMs(attemptNumber, retryConfig = {}) {
  const config = normalizeRetryConfig(retryConfig);
  return Math.min(config.maxDelayMs, config.baseDelayMs * Math.max(1, attemptNumber));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv = process.argv.slice(2)) {
  function getArg(name) {
    const index = argv.indexOf(`--${name}`);
    return index !== -1 ? argv[index + 1] : null;
  }

  return {
    defaultsPath: getArg('defaults'),
    profilePath: getArg('profile'),
    outputDirArg: getArg('output'),
    promptsPath: getArg('prompts'),
    mode: getArg('mode') || 'hero-variations',
  };
}

function createRuntime(argv = process.argv.slice(2)) {
  const {
    defaultsPath,
    profilePath,
    outputDirArg,
    promptsPath,
    mode,
  } = parseArgs(argv);

  if (!defaultsPath || !outputDirArg || !promptsPath) {
    throw new Error('Usage: node generate-images.js --defaults <defaults.json> [--profile <profile.json>] --output <dir> --prompts <prompts.json> [--mode hero-variations|independent]');
  }

  const outputDir = path.join(outputDirArg, 'images');
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
  const retry = normalizeRetryConfig(config.imageGen?.retry || config.imageGen?.retries || {});

  if (!prompts.slides || prompts.slides.length !== slideCount) {
    throw new Error(`prompts.json must contain exactly ${slideCount} slide prompts`);
  }
  if (provider === 'openai' && !openaiApiKey) {
    throw new Error('Missing OPENAI_API_KEY. Configure it via ~/.openclaw/openclaw.json under skills.entries.tiktok-slideshow-creator.');
  }
  if (provider === 'gemini' && !geminiApiKey) {
    throw new Error('Missing GEMINI_API_KEY. Configure it via ~/.openclaw/openclaw.json under skills.entries.tiktok-slideshow-creator.env.GEMINI_API_KEY.');
  }

  return {
    defaultsPath,
    profilePath,
    outputDirArg,
    outputDir,
    promptsPath,
    mode,
    prompts,
    provider,
    model,
    openaiApiKey,
    geminiApiKey,
    width,
    height,
    slideCount,
    size,
    language,
    geminiAspectRatio,
    geminiImageSize,
    retry,
  };
}

function makePrompt(runtime, text) {
  return `[Output language hint: ${runtime.language}]\n${text}`;
}

function heroPrompt(runtime) {
  const identityLock = 'Generate a highly consistent hero frame. Lock subject identity, clothing, hairstyle, facial hair, age range, body type, workspace layout, desk objects, background, and camera angle so follow-up variations can preserve them.';
  return makePrompt(runtime, `${runtime.prompts.base}\n\n${runtime.prompts.slides[0]}\n\n${identityLock}`);
}

function variationPrompt(runtime, slideText, slideNum) {
  return makePrompt(runtime, `${runtime.prompts.base}\n\n${slideText}\n\nUse the attached hero frame as a strong identity and scene reference. Preserve the same person, same clothing family, same workspace, same desk setup, and same camera angle. Only change expression, posture, and subtle state progression for slide ${slideNum}. Do not change the subject into a different person. Do not move to a different room.`);
}

async function generateOpenAI(runtime, prompt, outPath) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${runtime.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: runtime.model,
      prompt,
      n: 1,
      size: runtime.size,
      quality: 'high',
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  fs.writeFileSync(outPath, Buffer.from(data.data[0].b64_json, 'base64'));
}

async function editOpenAI(runtime, referencePath, prompt, outPath) {
  const form = new FormData();
  const blob = new Blob([fs.readFileSync(referencePath)], { type: 'image/png' });
  form.append('model', runtime.model);
  form.append('prompt', prompt);
  form.append('size', runtime.size);
  form.append('image', blob, path.basename(referencePath));

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${runtime.openaiApiKey}`,
    },
    body: form,
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  fs.writeFileSync(outPath, Buffer.from(data.data[0].b64_json, 'base64'));
}

async function generateGemini(runtime, prompt, outPath) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${runtime.model}:generateContent?key=${runtime.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: runtime.geminiAspectRatio,
          imageSize: runtime.geminiImageSize,
        },
      },
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  if (!imagePart) throw new Error(`Gemini did not return image data: ${JSON.stringify(data)}`);
  fs.writeFileSync(outPath, Buffer.from(imagePart.inlineData.data, 'base64'));
}

async function editGemini(runtime, referencePath, prompt, outPath) {
  const referenceBase64 = fs.readFileSync(referencePath).toString('base64');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${runtime.model}:generateContent?key=${runtime.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: referenceBase64 } },
        ],
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: runtime.geminiAspectRatio,
          imageSize: runtime.geminiImageSize,
        },
      },
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  if (!imagePart) throw new Error(`Gemini did not return edited image data: ${JSON.stringify(data)}`);
  fs.writeFileSync(outPath, Buffer.from(imagePart.inlineData.data, 'base64'));
}

async function generateLocal(runtime, _prompt, outPath, slideNum) {
  const localPath = path.join(runtime.outputDir, `local_slide${slideNum}.png`);
  if (!fs.existsSync(localPath)) throw new Error(`Place local image at ${localPath}`);
  fs.copyFileSync(localPath, outPath);
}

async function generateByProvider(runtime, prompt, outPath, slideNum) {
  if (runtime.provider === 'local') return generateLocal(runtime, prompt, outPath, slideNum);
  if (runtime.provider === 'openai') return generateOpenAI(runtime, prompt, outPath);
  if (runtime.provider === 'gemini') return generateGemini(runtime, prompt, outPath);
  throw new Error(`Unsupported provider: ${runtime.provider}`);
}

async function editByProvider(runtime, referencePath, prompt, outPath) {
  if (runtime.provider === 'openai') return editOpenAI(runtime, referencePath, prompt, outPath);
  if (runtime.provider === 'gemini') return editGemini(runtime, referencePath, prompt, outPath);
  throw new Error(`Hero variations are not implemented for provider: ${runtime.provider}`);
}

async function retryImageOperation({
  runtime,
  outputDir,
  logPrefix,
  label,
  operation,
  sleepFn = sleep,
}) {
  let attemptCount = 0;
  while (true) {
    attemptCount += 1;
    try {
      await operation();
      return attemptCount;
    } catch (error) {
      const errorMessage = error?.message || String(error);
      error.attemptCount = attemptCount;
      error.rateLimitDetected = isRateLimitError(errorMessage);
      error.transientFailureDetected = isTransientImageError(errorMessage);

      if (!error.transientFailureDetected || attemptCount >= runtime.retry.maxAttempts) {
        throw error;
      }

      const delayMs = calculateRetryDelayMs(attemptCount, runtime.retry);
      appendProcessLog(outputDir, `${logPrefix}: transient retry attempt=${attemptCount} delayMs=${delayMs} error=${errorMessage}\n`);
      console.log(`${label} hit a transient image error. Retrying in ${delayMs}ms...`);
      await sleepFn(delayMs);
    }
  }
}

async function runIndependent(runtime) {
  console.log(`Generating ${runtime.slideCount} raw slides using ${runtime.provider}/${runtime.model} at ${runtime.size} (language=${runtime.language}, mode=independent)`);
  for (let index = 0; index < runtime.slideCount; index += 1) {
    const outPath = path.join(runtime.outputDir, `slide${index + 1}_raw.png`);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > MIN_IMAGE_BYTES) {
      console.log(`Skipping existing ${path.basename(outPath)}`);
      continue;
    }
    const prompt = makePrompt(runtime, `${runtime.prompts.base}\n\n${runtime.prompts.slides[index]}`);
    console.log(`Generating slide ${index + 1}...`);
    await retryImageOperation({
      runtime,
      outputDir: runtime.outputDir,
      logPrefix: `slide ${index + 1}`,
      label: `slide ${index + 1}`,
      operation: () => generateByProvider(runtime, prompt, outPath, index + 1),
    });
    console.log(`Saved ${outPath}`);
  }
}

async function runHeroVariations(runtime) {
  if (runtime.provider === 'local') {
    console.log('Mode hero-variations is not implemented for local provider. Falling back to independent mode.');
    return runIndependent(runtime);
  }

  console.log(`Generating ${runtime.slideCount} raw slides using ${runtime.provider}/${runtime.model} at ${runtime.size} (language=${runtime.language}, mode=hero-variations)`);
  appendProcessLog(runtime.outputDir, `\n===== generate-images attempt ${new Date().toISOString()} =====\n`);
  appendProcessLog(runtime.outputDir, `mode=hero-variations provider=${runtime.provider} model=${runtime.model} slideCount=${runtime.slideCount}\n`);
  const heroPath = path.join(runtime.outputDir, 'hero_frame.png');
  const slide1Path = path.join(runtime.outputDir, 'slide1_raw.png');
  const attemptIndex = appendAttempt(runtime.outputDir, {
    startedAt: new Date().toISOString(),
    mode: 'hero-variations',
    provider: runtime.provider,
    model: runtime.model,
    slideCount: runtime.slideCount,
    slides: [],
  });

  try {
    const heroEntry = { slide: 0, output: 'hero_frame.png', startedAt: new Date().toISOString() };
    try {
      if (!fs.existsSync(heroPath) || fs.statSync(heroPath).size <= MIN_IMAGE_BYTES) {
        console.log('Generating hero frame...');
        appendProcessLog(runtime.outputDir, 'hero: start generate hero_frame.png\n');
        const heroAttempts = await retryImageOperation({
          runtime,
          outputDir: runtime.outputDir,
          logPrefix: 'hero',
          label: 'hero frame',
          operation: () => generateByProvider(runtime, heroPrompt(runtime), heroPath, 1),
        });
        console.log(`Saved ${heroPath}`);
        heroEntry.status = 'ok';
        heroEntry.attemptCount = heroAttempts;
        heroEntry.retryCount = Math.max(0, heroAttempts - 1);
        appendProcessLog(runtime.outputDir, `hero: ok bytes=${fs.existsSync(heroPath) ? fs.statSync(heroPath).size : 0}\n`);
      } else {
        console.log('Reusing existing hero frame');
        heroEntry.status = 'skipped-existing';
      }
      heroEntry.bytes = fs.existsSync(heroPath) ? fs.statSync(heroPath).size : 0;
    } catch (error) {
      heroEntry.status = 'failed';
      heroEntry.error = error.message || String(error);
      heroEntry.attemptCount = error.attemptCount || 1;
      heroEntry.retryCount = Math.max(0, heroEntry.attemptCount - 1);
      annotateErrorFlags(heroEntry);
      throw error;
    } finally {
      heroEntry.finishedAt = new Date().toISOString();
      const log = readLog(runtime.outputDir);
      log.attempts[attemptIndex].slides.push(heroEntry);
      writeLog(runtime.outputDir, log);
    }

    const slide1Entry = { slide: 1, output: 'slide1_raw.png', startedAt: new Date().toISOString() };
    if (!fs.existsSync(slide1Path) || fs.statSync(slide1Path).size <= MIN_IMAGE_BYTES) {
      fs.copyFileSync(heroPath, slide1Path);
      console.log(`Saved ${slide1Path} from hero frame`);
      slide1Entry.status = 'ok';
      appendProcessLog(runtime.outputDir, `slide 1: ok bytes=${fs.existsSync(slide1Path) ? fs.statSync(slide1Path).size : 0} source=hero_frame\n`);
    } else {
      slide1Entry.status = 'skipped-existing';
      console.log(`Skipping existing ${path.basename(slide1Path)}`);
    }
    slide1Entry.bytes = fs.existsSync(slide1Path) ? fs.statSync(slide1Path).size : 0;
    slide1Entry.finishedAt = new Date().toISOString();
    {
      const log = readLog(runtime.outputDir);
      log.attempts[attemptIndex].slides.push(slide1Entry);
      writeLog(runtime.outputDir, log);
    }

    for (let index = 1; index < runtime.slideCount; index += 1) {
      const outPath = path.join(runtime.outputDir, `slide${index + 1}_raw.png`);
      const slideEntry = { slide: index + 1, output: path.basename(outPath), startedAt: new Date().toISOString() };
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > MIN_IMAGE_BYTES) {
        slideEntry.status = 'skipped-existing';
        slideEntry.bytes = fs.statSync(outPath).size;
        slideEntry.finishedAt = new Date().toISOString();
        {
          const log = readLog(runtime.outputDir);
          log.attempts[attemptIndex].slides.push(slideEntry);
          writeLog(runtime.outputDir, log);
        }
        appendProcessLog(runtime.outputDir, `slide ${index + 1}: skipped-existing ${path.basename(outPath)} bytes=${slideEntry.bytes}\n`);
        console.log(`Skipping existing ${path.basename(outPath)}`);
        continue;
      }

      const prompt = variationPrompt(runtime, runtime.prompts.slides[index], index + 1);
      console.log(`Generating slide ${index + 1} from hero frame...`);
      try {
        appendProcessLog(runtime.outputDir, `slide ${index + 1}: start edit ${path.basename(outPath)}\n`);
        const slideAttempts = await retryImageOperation({
          runtime,
          outputDir: runtime.outputDir,
          logPrefix: `slide ${index + 1}`,
          label: `slide ${index + 1}`,
          operation: () => editByProvider(runtime, heroPath, prompt, outPath),
        });
        slideEntry.status = 'ok';
        slideEntry.attemptCount = slideAttempts;
        slideEntry.retryCount = Math.max(0, slideAttempts - 1);
        slideEntry.bytes = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
        appendProcessLog(runtime.outputDir, `slide ${index + 1}: ok bytes=${slideEntry.bytes || 0}\n`);
      } catch (error) {
        slideEntry.status = 'failed';
        slideEntry.error = error.message || String(error);
        slideEntry.attemptCount = error.attemptCount || 1;
        slideEntry.retryCount = Math.max(0, slideEntry.attemptCount - 1);
        annotateErrorFlags(slideEntry);
        appendProcessLog(runtime.outputDir, `slide ${index + 1}: failed error=${slideEntry.error}\n`);
        throw error;
      } finally {
        slideEntry.finishedAt = new Date().toISOString();
        const log = readLog(runtime.outputDir);
        log.attempts[attemptIndex].slides.push(slideEntry);
        writeLog(runtime.outputDir, log);
      }
      console.log(`Saved ${outPath}`);
    }

    updateAttempt(runtime.outputDir, attemptIndex, { status: 'ok', finishedAt: new Date().toISOString() });
    appendProcessLog(runtime.outputDir, 'attempt status=ok\n');
  } catch (error) {
    const attemptPatch = {
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error: error.message || String(error),
      transientFailureDetected: isTransientImageError(error.message || String(error)),
      rateLimitDetected: isRateLimitError(error.message || String(error)),
    };
    updateAttempt(runtime.outputDir, attemptIndex, attemptPatch);
    appendProcessLog(runtime.outputDir, `attempt status=failed error=${attemptPatch.error}\n`);
    throw error;
  }
}

async function main(argv = process.argv.slice(2)) {
  const runtime = createRuntime(argv);
  if (runtime.mode === 'independent') {
    await runIndependent(runtime);
    return;
  }
  await runHeroVariations(runtime);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  MIN_IMAGE_BYTES,
  annotateErrorFlags,
  calculateRetryDelayMs,
  createRuntime,
  isRateLimitError,
  isTransientImageError,
  main,
  normalizeRetryConfig,
  retryImageOperation,
  runHeroVariations,
  runIndependent,
  sleep,
};
