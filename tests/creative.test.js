const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildIdeaTaskPayload } = require('../scripts/_creative');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

test('buildIdeaTaskPayload explicitly constrains llm-task to the idea JSON shape', () => {
  const contentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tiktok-idea-task-'));
  const account = 'brand-a';
  const campaign = 'launch-angle';

  writeJson(path.join(contentRoot, account, 'profile.json'), {
    displayName: 'Brand A',
    language: 'en',
    topic: 'AI workflows',
    audience: 'Operators',
    voice: {},
    visual: {},
  });
  writeJson(path.join(contentRoot, account, 'campaigns', campaign, 'brief.json'), {
    title: 'Launch angle',
    coreOffer: 'AI workflows',
    goal: 'Generate demand',
    message: 'Reliable automation',
    cta: 'Check the link in bio',
  });
  writeText(path.join(contentRoot, account, 'tiktok-slideshows', 'examples.md'), '# examples\n');
  fs.mkdirSync(path.join(contentRoot, account, 'tiktok-slideshows', 'posts'), { recursive: true });

  const payload = buildIdeaTaskPayload({ contentRoot, account, campaign });

  assert.equal(payload.kind, 'idea-task');
  assert.match(
    payload.prompt,
    /Return exactly one JSON object with only these keys: postTitle, postSlug, angle, templateFamily, rationale\./u,
  );
  assert.match(
    payload.prompt,
    /Do not include hook, caption, slides, prompts, texts, imagePrompt, or any other keys\./u,
  );
  assert.match(
    payload.prompt,
    /This step is idea selection only\. Do not draft the slideshow package yet\./u,
  );
  assert.match(
    payload.prompt,
    /rationale must be a short plain-language reason this idea is fresh and strategically relevant for the account\./u,
  );
});
