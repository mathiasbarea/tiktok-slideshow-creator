const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { buildDraftTaskPayload, normalizeDraftOutput } = require('../scripts/_creative');

const PNG_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sXnKwAAAABJRU5ErkJggg==';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function writePng(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(PNG_1X1_BASE64, 'base64'));
}

function hashFile(filePath) {
  return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
}

function buildTemplateFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-template-pack-'));
  const contentRoot = path.join(root, 'content');
  const account = 'acct';
  const campaign = 'systems-explainer';
  const postSlug = '2026-03-21-slideshow-openclaw-architecture';
  const postDir = path.join(contentRoot, account, 'tiktok', 'posts', postSlug);
  const templateDir = path.join(contentRoot, account, 'templates', 'openclaw-multi-agent');
  const defaultsPath = path.join(contentRoot, 'defaults.json');
  const profilePath = path.join(contentRoot, account, 'profile.json');
  const briefPath = path.join(contentRoot, account, 'campaigns', campaign, 'brief.json');
  const promptsPath = path.join(postDir, 'prompts.json');
  const textsPath = path.join(postDir, 'texts.json');

  writeJson(defaultsPath, {
    language: 'en',
    imageGen: { provider: 'gemini', model: 'gemini-3.1-flash-image-preview' },
    slides: { count: 6, width: 1024, height: 1536 },
  });
  writeJson(profilePath, {
    id: account,
    displayName: 'Account',
    language: 'en',
    render: {
      imageGen: { provider: 'gemini', model: 'gemini-3.1-flash-image-preview' },
      slides: { count: 6, width: 1024, height: 1536 },
    },
  });
  writeJson(briefPath, {
    title: 'Systems Explainer',
    coreOffer: 'Offer',
    message: 'Message',
    cta: 'Check the link in bio',
    visualTemplateId: 'openclaw-multi-agent',
    notes: [],
  });
  writeJson(path.join(postDir, 'post.json'), {
    accountId: account,
    campaignId: campaign,
    postTitle: 'OpenClaw Multi-Agent Architecture',
    postSlug,
    angle: 'system-overview',
    templateFamily: 'process-overload',
    visualTemplateId: 'openclaw-multi-agent',
    status: 'drafted',
  });
  writeJson(path.join(templateDir, 'manifest.json'), {
    id: 'openclaw-multi-agent',
    name: 'OpenClaw Multi-Agent Architecture',
    description: 'Fixture template pack',
    renderMode: 'template-pack',
    canvas: { width: 1080, height: 1920 },
    slides: [
      {
        index: 1,
        asset: 'slides/1.png',
        slots: [
          { name: 'headline', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
          { name: 'subheadline', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
          { name: 'leftLabel', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
          { name: 'lowerLeftLabel', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
          { name: 'rightLabel', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
        ],
      },
      {
        index: 2,
        asset: 'slides/2.png',
        slots: [
          { name: 'headline', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
          { name: 'subheadline', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
          { name: 'body', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
        ],
      },
      {
        index: 3,
        asset: 'slides/3.png',
        slots: [
          { name: 'headline', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
          { name: 'subheadline', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
          { name: 'body', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
        ],
      },
      {
        index: 4,
        asset: 'slides/4.png',
        slots: [
          { name: 'headline', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
          { name: 'subheadline', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
          { name: 'body', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
        ],
      },
      {
        index: 5,
        asset: 'slides/5.png',
        slots: [
          { name: 'headline', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
          { name: 'subheadline', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
          { name: 'body', x: 0, y: 0, width: 1, height: 1, fontSize: 16 },
        ],
      },
      {
        index: 6,
        asset: 'slides/6.png',
        staticFinal: true,
        slots: [],
      },
    ],
  });
  for (let index = 1; index <= 6; index += 1) {
    writePng(path.join(templateDir, 'slides', `${index}.png`));
  }
  writeJson(promptsPath, {
    base: 'ignored for template-pack slides',
    slides: ['s1', 's2', 's3', 's4', 's5', 's6'],
  });
  writeJson(textsPath, [
    {
      headline: 'OpenClaw Multi-Agent',
      subheadline: 'Architecture',
      leftLabel: 'Main Agent',
      lowerLeftLabel: 'Peer Agents',
      rightLabel: 'Sub Agents',
    },
    {
      headline: 'Main Agent',
      subheadline: 'Single entry point for the user',
      body: 'Understands intent.\n\nChooses who should do the work.\n\nReports back when the work is done.',
    },
    {
      headline: 'Peer Agent',
      subheadline: 'The dedicated domain expert',
      body: 'Owns a specific area.\n\nExecutes complex tasks autonomously.\n\nManages specialized tools and sub-agents.',
    },
    {
      headline: 'Sub Agent',
      subheadline: 'A temporary background worker',
      body: 'Handles one scoped task.\n\nRuns in parallel when needed.\n\nReturns the result to its parent.',
    },
    {
      headline: 'Why?',
      subheadline: 'Multi-agent systems key benefits',
      body: 'More focused context\n\nFewer mistakes\n\nFaster execution',
    },
    {},
  ]);
  writeText(path.join(postDir, 'caption.txt'), 'Caption.\n');

  return {
    root,
    contentRoot,
    postDir,
    defaultsPath,
    profilePath,
    briefPath,
    promptsPath,
    textsPath,
  };
}

function runNode(scriptPath, args, cwd) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

test('template-pack draft task exposes template slot constraints', () => {
  const fixture = buildTemplateFixture();
  const task = buildDraftTaskPayload({
    defaultsPath: fixture.defaultsPath,
    profilePath: fixture.profilePath,
    briefPath: fixture.briefPath,
    postDir: fixture.postDir,
  });

  assert.equal(task.input.visualTemplate.id, 'openclaw-multi-agent');
  assert.equal(task.schema.properties.texts.prefixItems[0].required.includes('headline'), true);
  assert.equal(task.schema.properties.texts.prefixItems[5].required.length, 0);

  const draft = normalizeDraftOutput({
    postTitle: 'OpenClaw Multi-Agent Architecture',
    angle: 'system-overview',
    templateFamily: 'process-overload',
    prompts: { base: 'base', slides: ['1', '2', '3', '4', '5', '6'] },
    texts: readJson(fixture.textsPath),
    caption: 'Short caption',
  }, {
    slideCount: 6,
    fallbackPost: {
      postTitle: 'OpenClaw Multi-Agent Architecture',
      postSlug: '2026-03-21-slideshow-openclaw-architecture',
      angle: 'system-overview',
      templateFamily: 'process-overload',
      visualTemplateId: 'openclaw-multi-agent',
      rationale: 'fresh',
      postDir: fixture.postDir,
      briefPath: fixture.briefPath,
    },
    recentPosts: [],
  });

  assert.equal(draft.texts[0].headline, 'OpenClaw Multi-Agent');
  assert.deepEqual(draft.texts[5], {});

  fs.rmSync(fixture.root, { recursive: true, force: true });
});

test('template-pack image and overlay steps work without provider keys', () => {
  const fixture = buildTemplateFixture();
  const generateRun = runNode(path.join(__dirname, '..', 'scripts', 'generate-images.js'), [
    '--defaults', fixture.defaultsPath,
    '--profile', fixture.profilePath,
    '--output', fixture.postDir,
    '--prompts', fixture.promptsPath,
    '--mode', 'hero-variations',
  ], path.join(__dirname, '..'));

  assert.equal(generateRun.status, 0, generateRun.stderr);
  assert.equal(fs.existsSync(path.join(fixture.postDir, 'images', 'hero_frame.png')), true);
  assert.equal(fs.existsSync(path.join(fixture.postDir, 'images', 'slide6_raw.png')), true);

  const overlayRun = runNode(path.join(__dirname, '..', 'scripts', 'add-text-overlay.js'), [
    '--input', fixture.postDir,
    '--texts', fixture.textsPath,
    '--profile', fixture.profilePath,
  ], path.join(__dirname, '..'));

  assert.equal(overlayRun.status, 0, overlayRun.stderr);
  assert.equal(fs.existsSync(path.join(fixture.postDir, 'images', 'slide1.png')), true);
  assert.equal(fs.existsSync(path.join(fixture.postDir, 'images', 'slide6.png')), true);
  assert.equal(
    hashFile(path.join(fixture.postDir, 'images', 'slide6_raw.png')),
    hashFile(path.join(fixture.postDir, 'images', 'slide6.png')),
  );

  fs.rmSync(fixture.root, { recursive: true, force: true });
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
