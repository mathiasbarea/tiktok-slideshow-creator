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

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function readTextIfExists(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function pickLanguage(profile, defaults) {
  return profile.language || defaults.language || 'en';
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function asSupportedTextProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  return provider === 'openai' || provider === 'gemini' ? provider : null;
}

function defaultTextModel(provider) {
  if (provider === 'openai') return 'gpt-5-mini';
  if (provider === 'gemini') return 'gemini-2.0-flash';
  return '';
}

function hasApiKeyFor(provider) {
  if (provider === 'openai') return Boolean(process.env.OPENAI_API_KEY);
  if (provider === 'gemini') return Boolean(process.env.GEMINI_API_KEY);
  return false;
}

function resolveTextGenConfig(defaults, profile) {
  const defaultsTextGen = defaults.textGen || {};
  const profileTextGen = profile.render?.textGen || {};
  const defaultsImageGen = defaults.imageGen || {};
  const profileImageGen = profile.render?.imageGen || {};

  const provider = firstNonEmpty(
    asSupportedTextProvider(profileTextGen.provider),
    asSupportedTextProvider(defaultsTextGen.provider),
    asSupportedTextProvider(profileImageGen.provider),
    asSupportedTextProvider(defaultsImageGen.provider),
    process.env.GEMINI_API_KEY ? 'gemini' : null,
    process.env.OPENAI_API_KEY ? 'openai' : null
  );

  return {
    provider,
    model: firstNonEmpty(profileTextGen.model, defaultsTextGen.model) || defaultTextModel(provider)
  };
}

function buildContext(profile, brief, post, angle) {
  const accountName = profile.displayName || profile.id || brief.accountId || 'the brand';
  const offer = post.offer || brief.coreOffer || (profile.offerings && profile.offerings[0] && profile.offerings[0].name) || 'the offer';
  const audience = profile.audience || 'founders and operators';
  const topic = profile.topic || 'outcome-focused execution';
  const visualStyle = profile.visual?.style || 'realistic iPhone photo aesthetic';
  const subjectPattern = profile.visual?.subjectPattern || 'the same founder working in the same believable workspace from the same angle';
  const basePromptStyle = profile.visual?.basePromptStyle || 'realistic phone camera quality, same room identity across all slides, no text, no logos, no watermarks';
  const cta = post.cta || brief.cta || 'Learn more';
  const campaignTitle = brief.title || 'Untitled campaign';
  const postTitle = post.postTitle || post.title || campaignTitle;
  const message = post.message || brief.message || `${accountName} positions ${offer} as a better alternative to slow process-heavy service models.`;
  return {
    accountName,
    offer,
    audience,
    topic,
    visualStyle,
    subjectPattern,
    basePromptStyle,
    cta,
    campaignTitle,
    postTitle,
    message,
    angle
  };
}

function getAngleLibrary(ctx) {
  return {
    'process-overload': {
      texts: [
        'Too much process.\nNot enough\nprogress.',
        'Too many calls.\nToo many decks.\nSlow momentum.',
        'If you need speed,\nthat gets old\nvery fast.',
        'Same goal.\nLess overhead.\nMore shipping.',
        'Less friction.\nMore movement.\nMore momentum.',
        `${ctx.offer}.\nBuilt for teams that\nneed momentum.`
      ],
      promptSlides: [
        'The founder looks tired and unconvinced while reviewing process-heavy proposals, too many tabs open, believable frustration, startup operator energy.',
        'The same founder is on a meeting-heavy video call with too many people and too much coordination, visible fatigue, low momentum, same room and same camera angle.',
        'The same founder starts considering a more outcome-focused model with less overhead, expression shifting from frustration to attention and curiosity.',
        'The same founder sees first signs of movement, fewer distractions, cleaner desk, more focused posture, subtle but visible momentum, same scene identity.',
        'The same founder looks calmer, sharper, and more in control, clear sense that the work is finally moving.',
        `Best final version of the same scene, founder calm, confident, and back in control, visually supporting ${ctx.offer} as a lower-overhead model for real momentum.`
      ]
    },
    'meeting-fatigue': {
      texts: [
        'You can feel it.\nAnother call.\nAnother update.',
        'Too much alignment.\nNot enough\nactual work.',
        'When every week\nis meetings,\nprogress slows.',
        'Teams do not need\nmore check-ins.\nThey need motion.',
        'Less coordination\ndrag. More visible\nmovement.',
        `${ctx.offer}.\nFor teams tired of\nmeeting gravity.`
      ],
      promptSlides: [
        'The founder looks drained after back-to-back calls, laptop full of calendar blocks, realistic meeting fatigue.',
        'The same founder sits through another update call with little real movement, same room and same angle, visible boredom and frustration.',
        'The same founder realizes the issue is coordination overhead, expression turning from fatigue to clarity.',
        'The same founder starts seeing momentum return as the workday becomes less fragmented and more focused.',
        'The same founder looks lighter, calmer, and more productive, clear reduction in meeting drag.',
        `Best final version of the same scene, founder back in control, visually supporting ${ctx.offer} as a lower-meeting model.`
      ]
    },
    'retainer-drag': {
      texts: [
        'Retainers can feel\nheavy when progress\nstays light.',
        'You keep paying.\nYou keep waiting.\nMomentum slips.',
        'That gap gets\nfrustrating\nvery quickly.',
        'Same spend.\nLess drag.\nMore movement.',
        'Less retainer\nweight. More visible\nprogress.',
        `${ctx.offer}.\nFor teams that want\ntraction, not drag.`
      ],
      promptSlides: [
        'The founder looks skeptical while reviewing invoices and deliverables, the emotional tone is weight without payoff.',
        'The same founder sees money leaving but very little visible progress, same room and same camera angle.',
        'The same founder starts comparing that drag against a more outcome-focused model.',
        'The same founder notices early signs of traction and less emotional friction around the work.',
        'The same founder feels more confident because progress is now visible and concrete.',
        `Best final version of the same scene, founder seeing traction, visually supporting ${ctx.offer} as a lower-drag model.`
      ]
    },
    'founders-need-movement': {
      texts: [
        'Founders usually need\nmovement more than\nmore process.',
        'When speed matters,\noverhead starts to\nshow fast.',
        'That is where\nslow models begin\nto hurt.',
        'Same ambition.\nLess overhead.\nMore momentum.',
        'Less delay.\nMore clarity.\nMore movement.',
        `${ctx.offer}.\nBuilt for teams that\nneed momentum.`
      ],
      promptSlides: [
        'The founder looks impatient and restless, surrounded by signs of delay and overhead.',
        'The same founder feels blocked by a slow-moving workflow with too much coordination and not enough shipping.',
        'The same founder reframes the problem around the need for movement, not more process.',
        'The same founder starts getting momentum back, posture and workspace showing forward motion.',
        'The same founder looks sharper and more decisive, visibly reconnected to progress.',
        `Best final version of the same scene, founder fully back in motion, visually supporting ${ctx.offer} as a founder-speed model.`
      ]
    },
    'outcomes-not-activity': {
      texts: [
        'Activity looks busy.\nOutcomes are what\nactually matter.',
        'A full calendar\nis not the same\nas progress.',
        'That difference\ngets expensive\nfast.',
        'Less activity theatre.\nMore shipped work.\nMore outcomes.',
        'Less noise.\nMore signal.\nMore movement.',
        `${ctx.offer}.\nBuilt around outcomes,\nnot optics.`
      ],
      promptSlides: [
        'The founder looks unconvinced by a busy-looking workflow that lacks visible payoff.',
        'The same founder sees lots of activity but little meaningful movement, same room and angle.',
        'The same founder begins separating activity from outcomes, expression shifting to clarity.',
        'The same founder sees early signs of actual output and less noise.',
        'The same founder looks calmer and more certain because the work now feels real.',
        `Best final version of the same scene, founder focused on outcomes, visually supporting ${ctx.offer} as an outcomes-first model.`
      ]
    }
  };
}

function inferAngleFromTexts(texts) {
  const joined = (texts || []).join(' | ').toLowerCase();
  if (joined.includes('too much process') || joined.includes('not enough\nprogress')) return 'process-overload';
  if (joined.includes('another call') || joined.includes('meeting gravity') || joined.includes('too much alignment')) return 'meeting-fatigue';
  if (joined.includes('retainer') || joined.includes('traction, not drag')) return 'retainer-drag';
  if (joined.includes('founders usually need') || joined.includes('same ambition')) return 'founders-need-movement';
  if (joined.includes('activity looks busy') || joined.includes('outcomes are what')) return 'outcomes-not-activity';
  return null;
}

function collectUsedAngles(postDir) {
  const campaignDir = path.resolve(postDir, '..', '..');
  const postsDir = path.join(campaignDir, 'posts');
  if (!fs.existsSync(postsDir)) return new Set();
  const used = new Set();
  for (const entry of fs.readdirSync(postsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidateDir = path.join(postsDir, entry.name);
    if (path.resolve(candidateDir) === path.resolve(postDir)) continue;
    const postJson = readJsonIfExists(path.join(candidateDir, 'post.json'));
    if (postJson && postJson.angle) {
      used.add(postJson.angle);
      continue;
    }
    const texts = readJsonIfExists(path.join(candidateDir, 'texts.json'));
    const inferred = inferAngleFromTexts(texts);
    if (inferred) used.add(inferred);
  }
  return used;
}

function collectSiblingCaptions(postDir) {
  const campaignDir = path.resolve(postDir, '..', '..');
  const postsDir = path.join(campaignDir, 'posts');
  if (!fs.existsSync(postsDir)) return [];

  const refs = [];
  const entries = fs.readdirSync(postsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const candidateDir = path.join(postsDir, entry.name);
    if (path.resolve(candidateDir) === path.resolve(postDir)) continue;
    const caption = normalizeCaptionOutput(readTextIfExists(path.join(candidateDir, 'caption.txt')));
    if (!caption) continue;
    const meta = readJsonIfExists(path.join(candidateDir, 'post.json')) || {};
    refs.push({
      postSlug: entry.name,
      postTitle: meta.postTitle || entry.name,
      angle: meta.angle || null,
      caption: truncateText(caption, 320)
    });
  }

  return refs.slice(-5);
}

function chooseTemplateFamily(post, postDir, ctx) {
  const library = getAngleLibrary(ctx);
  if (post.templateFamily && library[post.templateFamily]) return post.templateFamily;
  if (post.angle && library[post.angle]) return post.angle;
  const used = collectUsedAngles(postDir);
  const available = Object.keys(library).filter((angle) => !used.has(angle));
  return available[0] || Object.keys(library)[0];
}

function generatePrompts(ctx, language, promptSlides) {
  return {
    base: `${language === 'en' ? 'iPhone photo' : 'Smartphone photo'} of ${ctx.subjectPattern}. ${ctx.basePromptStyle}. Portrait orientation. ${ctx.visualStyle}. Audience context: ${ctx.audience}. Topic context: ${ctx.topic}. Leave clean negative space in the upper center for text overlay. Keep the subject's face below that text zone whenever possible.`,
    slides: promptSlides
  };
}

function truncateText(value, maxChars) {
  const clean = String(value || '').trim();
  if (!clean || clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars - 3).trimEnd()}...`;
}

function normalizeCaptionOutput(value) {
  let text = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!text) return '';

  text = text.replace(/^```(?:text)?\s*/i, '').replace(/\s*```$/i, '').trim();
  text = text.replace(/^caption\s*:\s*/i, '').trim();

  if ((text.startsWith('"') && text.endsWith('"'))) {
    text = text.slice(1, -1).trim();
  }

  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildCaptionInstructions(language) {
  return [
    'You write short, native-sounding TikTok slideshow captions.',
    `Write in ${language}.`,
    'Return plain text only.',
    'Make the caption feel custom to the supplied post, not like a generic template.',
    'Use 2 or 3 short paragraphs max.',
    'The flow should be: hook, value/progression, CTA when relevant.',
    'Use at most 5 hashtags on the final line.',
    'Do not use emojis, bullets, labels, quotation marks, or self-referential phrases.',
    'Avoid repeating openings, CTA wording, or hashtag clusters from sibling captions.'
  ].join(' ');
}

function buildCaptionPrompt(ctx, profile, brief, post, slideTexts, examples, siblingCaptions) {
  const payload = {
    account: {
      name: ctx.accountName,
      audience: ctx.audience,
      topic: ctx.topic,
      offer: ctx.offer
    },
    campaign: {
      title: ctx.campaignTitle,
      message: ctx.message,
      cta: ctx.cta
    },
    post: {
      title: ctx.postTitle,
      angle: ctx.angle,
      slideTexts
    },
    voice: {
      tone: profile.voice?.tone || '',
      style: profile.voice?.style || '',
      captionStyle: profile.voice?.captionStyle || '',
      avoid: profile.voice?.avoid || []
    },
    briefNotes: Array.isArray(brief.notes) ? brief.notes : [],
    siblingCaptionReferences: siblingCaptions,
    examples: examples ? truncateText(examples, 1800) : ''
  };

  return [
    'Create one short TikTok caption for this slideshow package.',
    'Keep it compact and readable on mobile.',
    'Mention the offer naturally only when it helps the story.',
    'Use the CTA naturally if it fits; do not force it.',
    'JSON context:',
    JSON.stringify(payload, null, 2)
  ].join('\n\n');
}

function extractOpenAIText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data.output) ? data.output : [];
  const content = [];

  for (const item of output) {
    if (!Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part.type === 'output_text' && part.text) content.push(part.text);
    }
  }

  return content.join('').trim();
}

function extractGeminiText(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || '').join('').trim();
}

async function generateCaptionWithOpenAI(model, instructions, prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY for dynamic caption generation.');
  }

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'developer',
          content: [{ type: 'input_text', text: instructions }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }]
        }
      ]
    })
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `OpenAI caption generation failed with status ${res.status}`);
  }

  const text = normalizeCaptionOutput(extractOpenAIText(data));
  if (!text) throw new Error('OpenAI did not return caption text.');
  return text;
}

async function generateCaptionWithGemini(model, instructions, prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY for dynamic caption generation.');
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: instructions }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 220
      }
    })
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Gemini caption generation failed with status ${res.status}`);
  }

  const text = normalizeCaptionOutput(extractGeminiText(data));
  if (!text) throw new Error('Gemini did not return caption text.');
  return text;
}

async function generateDynamicCaption(defaults, profile, profilePathForExamples, brief, post, postDir, ctx, slideTexts) {
  const configured = resolveTextGenConfig(defaults, profile);
  let config = configured;

  if (!hasApiKeyFor(config.provider)) {
    const fallbackProvider = ['gemini', 'openai'].find((provider) => provider !== config.provider && hasApiKeyFor(provider));
    if (fallbackProvider) {
      config = {
        provider: fallbackProvider,
        model: defaultTextModel(fallbackProvider)
      };
    }
  }

  if (!config.provider || !config.model) {
    throw new Error('Dynamic captions require a supported text provider. Configure defaults.textGen/provider or profile.render.textGen/provider, or set OPENAI_API_KEY or GEMINI_API_KEY.');
  }

  const examplesPath = path.join(path.dirname(profilePathForExamples), 'examples.md');
  const examples = readTextIfExists(examplesPath);
  const siblingCaptions = collectSiblingCaptions(postDir);
  const instructions = buildCaptionInstructions(pickLanguage(profile, defaults));
  const prompt = buildCaptionPrompt(ctx, profile, brief, post, slideTexts, examples, siblingCaptions);

  if (config.provider === 'openai') {
    return {
      caption: await generateCaptionWithOpenAI(config.model, instructions, prompt),
      provider: config.provider,
      model: config.model
    };
  }

  if (config.provider === 'gemini') {
    return {
      caption: await generateCaptionWithGemini(config.model, instructions, prompt),
      provider: config.provider,
      model: config.model
    };
  }

  throw new Error(`Unsupported text provider for captions: ${config.provider}`);
}

const defaultsPath = getArg('defaults');
const profilePath = getArg('profile');
const briefPath = getArg('brief');
const postDir = getArg('post-dir');

if (!defaultsPath || !profilePath || !briefPath || !postDir) {
  console.error('Usage: node draft-post.js --defaults <defaults.json> --profile <profile.json> --brief <brief.json> --post-dir <post-dir>');
  process.exit(1);
}

async function main() {
  const defaults = readJson(defaultsPath);
  const profile = readJson(profilePath);
  const brief = readJson(briefPath);
  const postConfigPath = path.join(postDir, 'post.json');
  const post = readJsonIfExists(postConfigPath) || {};
  const language = pickLanguage(profile, defaults);
  const preliminaryCtx = buildContext(profile, brief, post, null);
  const templateFamily = chooseTemplateFamily(post, postDir, preliminaryCtx);
  const editorialAngle = firstNonEmpty(post.angle, templateFamily);
  const ctx = buildContext(profile, brief, post, editorialAngle);
  const library = getAngleLibrary(ctx);
  const variant = library[templateFamily];

  if (!variant) {
    console.error(`No creative template family config found for templateFamily: ${templateFamily}`);
    process.exit(1);
  }

  const promptsPath = path.join(postDir, 'prompts.json');
  const textsPath = path.join(postDir, 'texts.json');
  const captionPath = path.join(postDir, 'caption.txt');

  writeJson(promptsPath, generatePrompts(ctx, language, variant.promptSlides));
  writeJson(textsPath, variant.texts);

  const captionResult = await generateDynamicCaption(defaults, profile, profilePath, brief, post, postDir, ctx, variant.texts);
  fs.writeFileSync(captionPath, `${captionResult.caption}\n`);

  post.status = 'drafted';
  post.language = language;
  post.accountName = ctx.accountName;
  post.offer = post.offer || ctx.offer;
  post.cta = post.cta || ctx.cta;
  post.message = post.message || ctx.message;
  post.angle = editorialAngle;
  post.templateFamily = templateFamily;
  post.captionProvider = captionResult.provider;
  post.captionModel = captionResult.model;
  post.captionDynamic = true;
  writeJson(postConfigPath, post);

  console.log(`Drafted post content in ${postDir} using angle=${editorialAngle}, templateFamily=${templateFamily}, and caption=${captionResult.provider}/${captionResult.model}`);
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
