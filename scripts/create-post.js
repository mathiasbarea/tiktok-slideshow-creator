#!/usr/bin/env node
const path = require('path');
const { resolveContentRoot } = require('./_content-root');
const {
  ensureAccount,
  ensureCampaign,
  ensureDir,
  readJsonIfExists,
  slugify,
  writeJsonIfMissing,
  writeTextIfMissing,
} = require('./_lib');
const {
  buildTemplateTextPlaceholders,
  loadTemplateForSelection,
} = require('./_templates');

const DEFAULT_SLIDE_PROMPTS = [
  'Hook state.',
  'Problem state.',
  'Discovery state.',
  'Transformation 1.',
  'Transformation 2.',
  'Best final state that supports the CTA.'
];

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

try {
  const rootDir = resolveContentRoot(getArg('dir'), { scriptDir: __dirname });
  const accountId = slugify(getArg('account'));
  const campaignId = slugify(getArg('campaign'));
  const postTitle = getArg('title') || 'untitled-post';
  const datePrefix = new Date().toISOString().slice(0, 10);
  const postSlug = getArg('post') ? slugify(getArg('post')) : `${datePrefix}-slideshow-${slugify(postTitle)}`;
  const offer = getArg('offer') || '';
  const cta = getArg('cta') || '';
  const message = getArg('message') || '';
  const angle = getArg('angle') || '';
  const templateFamily = getArg('template-family') || '';
  const explicitVisualTemplateId = slugify(getArg('visual-template'));

  if (!accountId || !campaignId || !postTitle) {
    console.error('Usage: node create-post.js [--dir <content-root>] --account <account-id> --campaign <campaign-id> --title <post-title> [--post <post-slug>] [--offer <offer-name>] [--cta <cta>] [--message <message>] [--angle <editorial-angle>] [--template-family <template-family>] [--visual-template <template-id>]');
    process.exit(1);
  }

  const account = ensureAccount(rootDir, accountId);
  const campaign = ensureCampaign(rootDir, accountId, campaignId, {
    title: postTitle,
    coreOffer: offer,
    cta,
    message,
    notes: []
  });

  const postsDir = account.postsDir;
  const postDir = path.join(postsDir, postSlug);
  const promptsPath = path.join(postDir, 'prompts.json');
  const textsPath = path.join(postDir, 'texts.json');
  const captionPath = path.join(postDir, 'caption.txt');
  const postConfigPath = path.join(postDir, 'post.json');
  const imagesDir = path.join(postDir, 'images');

  ensureDir(postDir);
  ensureDir(imagesDir);

  if (account.profile) console.log(`Created ${account.profilePath}`);
  if (account.examples) console.log(`Created ${account.examplesPath}`);
  if (campaign.created) console.log(`Created ${campaign.briefPath}`);

  const campaignBrief = readJsonIfExists(campaign.briefPath, {}) || {};
  const visualTemplateId = explicitVisualTemplateId || campaignBrief.visualTemplateId || '';
  const visualTemplate = loadTemplateForSelection(visualTemplateId, {
    contentRoot: rootDir,
    accountId,
  });
  const placeholderTexts = visualTemplate ? buildTemplateTextPlaceholders(visualTemplate) : [
    'Hook goes\\nhere',
    'Problem goes\\nhere',
    'Discovery goes\\nhere',
    'First reaction\\ngoes here',
    'Second reaction\\ngoes here',
    'CTA goes\\nhere'
  ];
  const slidePrompts = visualTemplate
    ? visualTemplate.slides.map((slide, index) => DEFAULT_SLIDE_PROMPTS[index] || `Slide ${slide.index} state.`)
    : DEFAULT_SLIDE_PROMPTS;

  if (writeJsonIfMissing(promptsPath, {
    base: 'iPhone photo of the same subject in the same scene, realistic lighting, portrait orientation, no text, no logos, no watermarks.',
    slides: slidePrompts
  })) console.log(`Created ${promptsPath}`);

  if (writeJsonIfMissing(textsPath, placeholderTexts)) console.log(`Created ${textsPath}`);

  if (writeTextIfMissing(captionPath, 'Draft the caption here.\n')) console.log(`Created ${captionPath}`);

  if (writeJsonIfMissing(postConfigPath, {
    accountId,
    campaignId,
    platform: 'tiktok',
    format: 'slideshow',
    createdAt: new Date().toISOString(),
    status: 'scaffolded',
    postTitle,
    postSlug,
    offer,
    cta,
    message,
    angle,
    templateFamily,
    visualTemplateId,
    profile: path.relative(postDir, account.profilePath).replace(/\\/g, '/'),
    brief: path.relative(postDir, campaign.briefPath).replace(/\\/g, '/')
  })) console.log(`Created ${postConfigPath}`);

  console.log(`\nPost scaffold ready at ${postDir}`);
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
