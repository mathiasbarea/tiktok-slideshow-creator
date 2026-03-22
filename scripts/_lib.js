const fs = require('fs');
const path = require('path');

const TIKTOK_PLATFORM = 'tiktok';

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJsonIfMissing(filePath, value) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
    return true;
  }
  return false;
}

function writeTextIfMissing(filePath, value) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, value);
    return true;
  }
  return false;
}

function readJsonIfExists(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getAccountDir(rootDir, accountId) {
  return path.join(rootDir, accountId);
}

function getCampaignsDir(rootDir, accountId) {
  return path.join(getAccountDir(rootDir, accountId), 'campaigns');
}

function getCampaignDir(rootDir, accountId, campaignId) {
  return path.join(getCampaignsDir(rootDir, accountId), campaignId);
}

function getPlatformDir(rootDir, accountId, platform = TIKTOK_PLATFORM) {
  return path.join(getAccountDir(rootDir, accountId), platform);
}

function getTemplatesDir(rootDir, accountId) {
  return path.join(getAccountDir(rootDir, accountId), 'templates');
}

function getPostsDir(rootDir, accountId, platform = TIKTOK_PLATFORM) {
  return path.join(getPlatformDir(rootDir, accountId, platform), 'posts');
}

function defaultProfile(accountId) {
  return {
    id: accountId,
    displayName: accountId,
    accountType: 'brand',
    language: '',
    topic: '',
    offerings: [],
    audience: '',
    voice: {
      tone: '',
      style: '',
      overlayStyle: '',
      captionStyle: '',
      avoid: []
    },
    visual: {
      style: '',
      subjectPattern: '',
      basePromptStyle: ''
    },
    render: {
      imageGen: {
        provider: 'gemini',
        model: 'gemini-3.1-flash-image-preview'
      },
      slides: {
        count: 6,
        width: 1024,
        height: 1536
      }
    },
    slides: {
      format: '6-slide',
      defaultStructure: ['hook', 'problem', 'discovery', 'transformation-1', 'transformation-2', 'cta'],
      ctaStyle: ''
    },
    contentPillars: [],
    defaultThemes: []
  };
}

function ensureAccount(rootDir, accountId) {
  const accountDir = getAccountDir(rootDir, accountId);
  const platformDir = getPlatformDir(rootDir, accountId);
  const postsDir = getPostsDir(rootDir, accountId);
  const templatesDir = getTemplatesDir(rootDir, accountId);
  const profilePath = path.join(accountDir, 'profile.json');
  const examplesPath = path.join(platformDir, 'examples.md');
  ensureDir(accountDir);
  ensureDir(platformDir);
  ensureDir(postsDir);
  ensureDir(templatesDir);

  const created = {
    accountDir,
    platformDir,
    postsDir,
    templatesDir,
    profilePath,
    examplesPath,
    profile: writeJsonIfMissing(profilePath, defaultProfile(accountId)),
    examples: writeTextIfMissing(examplesPath, `# ${accountId} TikTok\n\nAdd TikTok hooks, captions, and platform-specific examples here.\n`)
  };

  return created;
}

function ensureCampaign(rootDir, accountId, campaignId, brief = {}) {
  const campaignDir = getCampaignDir(rootDir, accountId, campaignId);
  const briefPath = path.join(campaignDir, 'brief.json');
  ensureDir(campaignDir);

  const created = writeJsonIfMissing(briefPath, {
    accountId,
    campaign: campaignId,
    title: brief.title || campaignId,
    coreOffer: brief.coreOffer || '',
    goal: brief.goal || '',
    message: brief.message || '',
    cta: brief.cta || '',
    visualTemplateId: brief.visualTemplateId || '',
    notes: brief.notes || []
  });

  return { campaignDir, briefPath, created };
}

module.exports = {
  ensureAccount,
  ensureCampaign,
  ensureDir,
  getAccountDir,
  getCampaignDir,
  getCampaignsDir,
  getPlatformDir,
  getPostsDir,
  getTemplatesDir,
  readJsonIfExists,
  slugify,
  TIKTOK_PLATFORM,
  writeJsonIfMissing,
  writeTextIfMissing
};
