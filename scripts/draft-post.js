#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function pickLanguage(profile, defaults) {
  return profile.language || defaults.language || 'en';
}

function buildContext(profile, brief) {
  const accountName = profile.displayName || profile.id || brief.accountId || 'the brand';
  const offer = brief.coreOffer || (profile.offerings && profile.offerings[0] && profile.offerings[0].name) || 'the offer';
  const audience = profile.audience || 'founders and operators';
  const topic = profile.topic || 'outcome-focused execution';
  const visualStyle = profile.visual?.style || 'realistic iPhone photo aesthetic';
  const subjectPattern = profile.visual?.subjectPattern || 'the same founder working in the same believable workspace from the same angle';
  const basePromptStyle = profile.visual?.basePromptStyle || 'realistic phone camera quality, same room identity across all slides, no text, no logos, no watermarks';
  const cta = brief.cta || 'Learn more';
  const title = brief.title || 'Untitled campaign';
  const message = brief.message || `${accountName} positions ${offer} as a better alternative to slow process-heavy service models.`;
  return { accountName, offer, audience, topic, visualStyle, subjectPattern, basePromptStyle, cta, title, message };
}

function generateTexts(ctx) {
  return [
    'Some models sell\nprocess over\nprogress.',
    'Too many calls,\ndecks, and slow\nmomentum.',
    'If you need speed,\nthat gets old\nfast.',
    'Same goal.\nLess overhead.\nMore shipping.',
    'Less retainer\nfriction, more\nmovement.',
    `${ctx.offer}\nfor teams that need\nreal momentum.`
  ];
}

function generatePrompts(ctx, language) {
  return {
    base: `${language === 'en' ? 'iPhone photo' : 'Smartphone photo'} of ${ctx.subjectPattern}. ${ctx.basePromptStyle}. Portrait orientation. ${ctx.visualStyle}. Audience context: ${ctx.audience}. Topic context: ${ctx.topic}. Leave clean negative space in the upper center for text overlay. Keep the subject's face below that text zone whenever possible.`,
    slides: [
      'The founder looks tired and unconvinced while reviewing process-heavy proposals, too many tabs open, believable frustration, startup operator energy.',
      'The same founder is on a meeting-heavy video call with too many people and too much coordination, visible fatigue, low momentum, same room and same camera angle.',
      'The same founder starts considering a more outcome-focused model with less overhead, expression shifting from frustration to attention and curiosity.',
      'The same founder sees first signs of movement, fewer distractions, cleaner desk, more focused posture, subtle but visible momentum, same scene identity.',
      'The same founder looks calmer, sharper, and more in control, clear sense that the work is finally moving.',
      `Best final version of the same scene, founder calm, confident, and back in control, visually supporting ${ctx.offer} as a lower-overhead model for real momentum.`
    ]
  };
}

function generateCaption(ctx) {
  return `Some service models are built around process. Kickoff calls, strategy decks, alignment loops, status updates. That can work in some contexts.\n\nBut if what you need is movement, it can start to feel heavier than it should.\n\nThat is the gap ${ctx.offer} is trying to close. Less overhead. Less meeting gravity. More shipped work. More visible momentum.\n\nThat is the idea behind ${ctx.accountName}. Not more process for the sake of process. More progress.\n\n#startup #founders #agency #productizedservice #buildinpublic`;
}

const defaultsPath = getArg('defaults');
const profilePath = getArg('profile');
const briefPath = getArg('brief');
const postDir = getArg('post-dir');

if (!defaultsPath || !profilePath || !briefPath || !postDir) {
  console.error('Usage: node draft-post.js --defaults <defaults.json> --profile <profile.json> --brief <brief.json> --post-dir <post-dir>');
  process.exit(1);
}

const defaults = readJson(defaultsPath);
const profile = readJson(profilePath);
const brief = readJson(briefPath);
const language = pickLanguage(profile, defaults);
const ctx = buildContext(profile, brief);

const promptsPath = path.join(postDir, 'prompts.json');
const textsPath = path.join(postDir, 'texts.json');
const captionPath = path.join(postDir, 'caption.txt');
const postConfigPath = path.join(postDir, 'post.json');

writeJson(promptsPath, generatePrompts(ctx, language));
writeJson(textsPath, generateTexts(ctx));
fs.writeFileSync(captionPath, generateCaption(ctx) + '\n');

if (fs.existsSync(postConfigPath)) {
  const post = readJson(postConfigPath);
  post.status = 'drafted';
  post.language = language;
  post.accountName = ctx.accountName;
  post.offer = post.offer || ctx.offer;
  writeJson(postConfigPath, post);
}

console.log(`Drafted post content in ${postDir}`);
