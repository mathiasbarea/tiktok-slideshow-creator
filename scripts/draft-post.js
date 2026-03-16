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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function pickLanguage(profile, defaults) {
  return profile.language || defaults.language || 'en';
}

function buildContext(profile, brief, angle) {
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
  return { accountName, offer, audience, topic, visualStyle, subjectPattern, basePromptStyle, cta, title, message, angle };
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
      caption: `Some service models are built around process. Kickoff calls, strategy decks, alignment loops, status updates. That can work in some contexts.\n\nBut if what you need is movement, it can start to feel heavier than it should.\n\nThat is the gap ${ctx.offer} is trying to close. Less overhead. Less meeting gravity. More shipped work. More visible momentum.\n\nThat is the idea behind ${ctx.accountName}. Not more process for the sake of process. More progress.\n\n#startup #founders #agency #productizedservice #buildinpublic`,
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
      caption: `A lot of teams are not blocked by talent. They are blocked by coordination overhead. Another check-in. Another update. Another round of alignment.\n\nThat is why meeting-heavy workflows start to feel expensive fast. Not just in money, in momentum.\n\n${ctx.offer} is built around a simpler idea: less meeting gravity, more visible movement.\n\nThat is the direction behind ${ctx.accountName}.\n\n#startup #founders #agency #operations #buildinpublic`,
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
      caption: `The hardest part is not always paying for a service. It is paying while momentum still feels light.\n\nThat is where retainer-heavy models can start to feel frustrating: money goes out, but movement does not always show up fast enough.\n\n${ctx.offer} is built around a different expectation — visible traction, not just ongoing activity.\n\nThat is a big part of how ${ctx.accountName} thinks about execution.\n\n#startup #founders #retainer #agency #productizedservice`,
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
      caption: `Founders rarely wake up wanting more process. They usually want movement, clarity, and something real shipping forward.\n\nThat is why overhead becomes such a problem when speed matters. You feel it quickly.\n\n${ctx.offer} is built around that founder reality: less delay, more visible momentum.\n\nThat is one of the core ideas behind ${ctx.accountName}.\n\n#startup #founders #execution #productizedservice #buildinpublic`,
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
      caption: `Busy is easy to perform. Outcomes are harder to fake.\n\nThat is the difference a lot of teams eventually run into: a calendar can look full while progress still feels thin.\n\n${ctx.offer} is built around the opposite standard — outcomes first, not activity optics.\n\nThat framing is central to how ${ctx.accountName} thinks about execution.\n\n#startup #founders #outcomes #agency #execution`,
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

function chooseAngle(post, postDir, ctx) {
  if (post.angle) return post.angle;
  const library = getAngleLibrary(ctx);
  const used = collectUsedAngles(postDir);
  const available = Object.keys(library).filter(angle => !used.has(angle));
  return available[0] || Object.keys(library)[0];
}

function generatePrompts(ctx, language, promptSlides) {
  return {
    base: `${language === 'en' ? 'iPhone photo' : 'Smartphone photo'} of ${ctx.subjectPattern}. ${ctx.basePromptStyle}. Portrait orientation. ${ctx.visualStyle}. Audience context: ${ctx.audience}. Topic context: ${ctx.topic}. Leave clean negative space in the upper center for text overlay. Keep the subject's face below that text zone whenever possible.`,
    slides: promptSlides
  };
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
const postConfigPath = path.join(postDir, 'post.json');
const post = readJsonIfExists(postConfigPath) || {};
const language = pickLanguage(profile, defaults);
const preliminaryCtx = buildContext(profile, brief, null);
const angle = chooseAngle(post, postDir, preliminaryCtx);
const ctx = buildContext(profile, brief, angle);
const library = getAngleLibrary(ctx);
const variant = library[angle];

if (!variant) {
  console.error(`No creative angle config found for angle: ${angle}`);
  process.exit(1);
}

const promptsPath = path.join(postDir, 'prompts.json');
const textsPath = path.join(postDir, 'texts.json');
const captionPath = path.join(postDir, 'caption.txt');

writeJson(promptsPath, generatePrompts(ctx, language, variant.promptSlides));
writeJson(textsPath, variant.texts);
fs.writeFileSync(captionPath, variant.caption + '\n');

post.status = 'drafted';
post.language = language;
post.accountName = ctx.accountName;
post.offer = post.offer || ctx.offer;
post.angle = angle;
writeJson(postConfigPath, post);

console.log(`Drafted post content in ${postDir} using angle=${angle}`);
