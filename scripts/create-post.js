#!/usr/bin/env node
const path = require('path');
const {
  ensureAccount,
  ensureCampaign,
  ensureDir,
  slugify,
  writeJsonIfMissing,
  writeTextIfMissing,
} = require('./_lib');

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const rootDir = getArg('dir') || 'content';
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

if (!accountId || !campaignId || !postTitle) {
  console.error('Usage: node create-post.js --dir <content-root> --account <account-id> --campaign <campaign-id> --title <post-title> [--post <post-slug>] [--offer <offer-name>] [--cta <cta>] [--message <message>] [--angle <editorial-angle>] [--template-family <template-family>]');
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

if (writeJsonIfMissing(promptsPath, {
  base: 'iPhone photo of the same subject in the same scene, realistic lighting, portrait orientation, no text, no logos, no watermarks.',
  slides: [
    'Hook state.',
    'Problem state.',
    'Discovery state.',
    'Transformation 1.',
    'Transformation 2.',
    'Best final state that supports the CTA.'
  ]
})) console.log(`Created ${promptsPath}`);

if (writeJsonIfMissing(textsPath, [
  'Hook goes\\nhere',
  'Problem goes\\nhere',
  'Discovery goes\\nhere',
  'First reaction\\ngoes here',
  'Second reaction\\ngoes here',
  'CTA goes\\nhere'
])) console.log(`Created ${textsPath}`);

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
  profile: path.relative(postDir, account.profilePath).replace(/\\/g, '/'),
  brief: path.relative(postDir, campaign.briefPath).replace(/\\/g, '/')
})) console.log(`Created ${postConfigPath}`);

console.log(`\nPost scaffold ready at ${postDir}`);
