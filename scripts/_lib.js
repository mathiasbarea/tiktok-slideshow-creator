const fs = require('fs');
const path = require('path');

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
        provider: 'openai',
        model: 'gpt-image-1'
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
  const accountDir = path.join(rootDir, accountId);
  const profilePath = path.join(accountDir, 'profile.json');
  const examplesPath = path.join(accountDir, 'examples.md');
  ensureDir(accountDir);

  const created = {
    accountDir,
    profilePath,
    examplesPath,
    profile: writeJsonIfMissing(profilePath, defaultProfile(accountId)),
    examples: writeTextIfMissing(examplesPath, `# ${accountId}\n\nAdd tone, hooks, caption examples, and onboarding notes here.\n`)
  };

  return created;
}

function ensureCampaign(rootDir, accountId, campaignId, brief = {}) {
  const accountDir = path.join(rootDir, accountId);
  const campaignDir = path.join(accountDir, 'campaigns', campaignId);
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
    notes: brief.notes || []
  });

  return { campaignDir, briefPath, created };
}

module.exports = {
  slugify,
  ensureDir,
  writeJsonIfMissing,
  writeTextIfMissing,
  ensureAccount,
  ensureCampaign
};
