const fs = require('fs');
const path = require('path');
const { slugify } = require('./_lib');
const {
  buildTemplateTextSchema,
  flattenTextEntry,
  loadTemplateForSelection,
  normalizeTemplateTextEntries,
  summarizeTemplateForPrompt,
} = require('./_templates');

const DEFAULT_SLIDE_COUNT = 6;
const DEFAULT_CAPTION_MAX_CHARS = 500;
const DEFAULT_RECENT_POST_LIMIT = 50;
const DEFAULT_TEMPLATE_FAMILY_COOLDOWN = 5;
const TITLE_SIMILARITY_THRESHOLD = 0.72;
const CAPTION_SIMILARITY_THRESHOLD = 0.82;
const TIKTOK_PLATFORM = 'tiktok';
const SUPPORTED_TEMPLATE_FAMILIES = [
  {
    id: 'process-overload',
    description: 'Use when the tension comes from too much process, coordination, or ceremony slowing execution.'
  },
  {
    id: 'meeting-fatigue',
    description: 'Use when the tension is driven by too many calls, status updates, alignment loops, or handoffs.'
  },
  {
    id: 'retainer-drag',
    description: 'Use when the emotional drag is paying for work without feeling traction, relief, or visible movement.'
  },
  {
    id: 'founders-need-movement',
    description: 'Use when the framing centers founder urgency, speed, ownership, or the need for movement over overhead.'
  },
  {
    id: 'outcomes-not-activity',
    description: 'Use when the contrast is busy work versus visible shipped outcomes, signal, or measurable progress.'
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonIfExists(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return readJson(filePath);
}

function readTextIfExists(filePath, fallback = '') {
  if (!fs.existsSync(filePath)) return fallback;
  return fs.readFileSync(filePath, 'utf8');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function normalizeComparableText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function comparableWords(value) {
  return normalizeComparableText(value).split(' ').filter(Boolean);
}

function leadingWordsKey(value, count = 4) {
  return comparableWords(value).slice(0, count).join(' ');
}

function sharedLeadingWords(a, b, count = 4) {
  const left = comparableWords(a).slice(0, count);
  const right = comparableWords(b).slice(0, count);
  if (left.length < count || right.length < count) return false;
  return left.every((word, index) => word === right[index]);
}

function asWordSet(value) {
  return new Set(comparableWords(value));
}

function jaccardSimilarity(a, b) {
  const left = asWordSet(a);
  const right = asWordSet(b);
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const word of left) {
    if (right.has(word)) intersection += 1;
  }

  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function stripDatePrefix(value) {
  return String(value || '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

function stripSlideshowPrefix(value) {
  return String(value || '').replace(/^slideshow-/, '');
}

function slugBaseForComparison(value) {
  return slugify(stripSlideshowPrefix(stripDatePrefix(value)));
}

function extractPostDateFromSlug(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})-/);
  return match ? match[1] : '';
}

function toSortableTimestamp(postJson, entryName, fallbackMs) {
  const explicit = firstNonEmpty(postJson?.createdAt, postJson?.postDate);
  const slugDate = extractPostDateFromSlug(entryName);
  const candidates = [
    explicit,
    slugDate ? `${slugDate}T00:00:00.000Z` : '',
  ];

  for (const candidate of candidates) {
    const parsed = Date.parse(candidate);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return fallbackMs;
}

function normalizePostSlug(value, datePrefix) {
  const rawSlug = slugify(value);
  const baseSlug = stripSlideshowPrefix(stripDatePrefix(rawSlug));
  const finalBase = baseSlug || 'untitled-post';
  return `${datePrefix}-slideshow-${finalBase}`;
}

function buildOverlayFingerprint(values) {
  if (!Array.isArray(values)) return '';
  return values
    .map((value) => normalizeComparableText(flattenTextEntry(value)))
    .filter(Boolean)
    .slice(0, 3)
    .join(' | ');
}

function truncateText(value, maxChars) {
  const clean = normalizeText(value);
  if (!clean || clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars - 3).trimEnd()}...`;
}

function normalizeCaption(value) {
  let text = normalizeText(value);
  if (!text) return '';

  text = text.replace(/^```(?:json|text)?\s*/i, '').replace(/\s*```$/i, '').trim();
  text = text.replace(/^caption\s*:\s*/i, '').trim();

  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function pickLanguage(profile, defaults) {
  return firstNonEmpty(profile?.language, defaults?.language, 'en');
}

function unwrapModelJson(raw) {
  return raw?.result?.details?.json
    || raw?.result?.json
    || raw?.result
    || raw?.details?.json
    || raw?.json
    || raw?.data
    || raw;
}

function getSlideCount(defaults, profile) {
  return profile?.render?.slides?.count || defaults?.slides?.count || DEFAULT_SLIDE_COUNT;
}

function summarizeOverlayTexts(texts, limit = 3) {
  if (!Array.isArray(texts)) return [];
  return texts
    .map((value) => normalizeText(flattenTextEntry(value)).replace(/\s+/g, ' '))
    .filter(Boolean)
    .slice(0, limit);
}

function extractCaptionOpening(caption) {
  const clean = normalizeCaption(caption);
  if (!clean) return '';
  const firstParagraph = clean.split(/\n\n+/)[0] || clean;
  const firstSentence = firstParagraph.split(/(?<=[.!?])\s+/)[0] || firstParagraph;
  return truncateText(firstSentence, 140);
}

function hasMeaningfulTextEntry(value) {
  if (typeof value === 'string') return Boolean(normalizeText(value));
  if (!value || typeof value !== 'object') return false;
  return Boolean(flattenTextEntry(value));
}

function summarizePost(postDir, entry) {
  const postJson = readJsonIfExists(path.join(postDir, 'post.json'), {}) || {};
  const texts = readJsonIfExists(path.join(postDir, 'texts.json'), []) || [];
  const caption = normalizeCaption(readTextIfExists(path.join(postDir, 'caption.txt'), ''));
  const overlayTextSample = summarizeOverlayTexts(texts);
  const stat = fs.statSync(postDir);

  return {
    postSlug: entry.name,
    postTitle: postJson.postTitle || postJson.title || entry.name,
    campaignId: postJson.campaignId || '',
    angle: postJson.angle || '',
    templateFamily: postJson.templateFamily || '',
    rationale: postJson.ideaRationale || '',
    overlayTextSample,
    hookOpening: overlayTextSample[0] || '',
    captionExcerpt: truncateText(caption, 220),
    captionOpening: extractCaptionOpening(caption),
    overlayFingerprint: buildOverlayFingerprint(texts),
    lastModifiedAt: new Date(stat.mtimeMs).toISOString(),
  };
}

function collectRecentPosts(postsDir, { excludePostDir = null, limit = DEFAULT_RECENT_POST_LIMIT } = {}) {
  if (!fs.existsSync(postsDir)) return [];

  const entries = fs.readdirSync(postsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(postsDir, entry.name);
      const stat = fs.statSync(fullPath);
      const postJson = readJsonIfExists(path.join(fullPath, 'post.json'), {}) || {};
      return {
        entry,
        fullPath,
        sortMs: toSortableTimestamp(postJson, entry.name, stat.mtimeMs),
        mtimeMs: stat.mtimeMs,
      };
    })
    .sort((a, b) => (b.sortMs - a.sortMs) || (b.mtimeMs - a.mtimeMs));

  const recent = [];
  for (const candidate of entries) {
    if (excludePostDir && path.resolve(candidate.fullPath) === path.resolve(excludePostDir)) continue;
    const summary = summarizePost(candidate.fullPath, candidate.entry);
    const meaningful = summary.angle || summary.templateFamily || summary.overlayTextSample.length > 0 || summary.captionExcerpt;
    if (!meaningful) continue;
    recent.push(summary);
    if (recent.length >= limit) break;
  }

  return recent;
}

function buildRepetitionSignals(recentPosts) {
  return {
    recentAngles: Array.from(new Set(recentPosts.map((post) => post.angle).filter(Boolean))),
    recentTemplateFamilies: Array.from(new Set(recentPosts.map((post) => post.templateFamily).filter(Boolean))),
    blockedPostTitles: Array.from(new Set(recentPosts.map((post) => post.postTitle).filter(Boolean))),
    blockedPostSlugBases: Array.from(new Set(recentPosts.map((post) => slugBaseForComparison(post.postSlug)).filter(Boolean))),
    blockedHookOpenings: Array.from(new Set(recentPosts.map((post) => post.hookOpening).filter(Boolean))),
    blockedHookPrefixes: Array.from(new Set(recentPosts.map((post) => leadingWordsKey(post.hookOpening, 4)).filter(Boolean))),
    blockedCaptionOpenings: Array.from(new Set(recentPosts.map((post) => post.captionOpening).filter(Boolean))),
    blockedCaptionPrefixes: Array.from(new Set(recentPosts.map((post) => leadingWordsKey(post.captionOpening, 5)).filter(Boolean))),
    blockedOverlayFingerprints: Array.from(new Set(recentPosts.map((post) => post.overlayFingerprint).filter(Boolean))),
    templateCooldownWindow: recentPosts.slice(0, DEFAULT_TEMPLATE_FAMILY_COOLDOWN).map((post) => post.templateFamily).filter(Boolean),
  };
}

function summarizeProfile(profile) {
  return {
    displayName: profile.displayName || profile.id || '',
    language: profile.language || '',
    topic: profile.topic || '',
    audience: profile.audience || '',
    offerings: Array.isArray(profile.offerings) ? profile.offerings : [],
    voice: profile.voice || {},
    visual: profile.visual || {},
    contentPillars: Array.isArray(profile.contentPillars) ? profile.contentPillars : [],
    defaultThemes: Array.isArray(profile.defaultThemes) ? profile.defaultThemes : [],
  };
}

function summarizeBrief(brief) {
  return {
    title: brief.title || '',
    coreOffer: brief.coreOffer || '',
    goal: brief.goal || '',
    message: brief.message || '',
    cta: brief.cta || '',
    visualTemplateId: brief.visualTemplateId || '',
    notes: Array.isArray(brief.notes) ? brief.notes : [],
  };
}

function buildCreativeReferences() {
  return {
    slideStructure: [
      'Slide 1 hook: stop the scroll with tension, conflict, curiosity, or a founder-level observation.',
      'Slide 2 problem: sharpen the pain, friction, or waste without sounding generic.',
      'Slide 3 discovery: reframe the problem or introduce the better model clearly.',
      'Slide 4 transformation 1: show early movement, relief, clarity, or traction.',
      'Slide 5 transformation 2: intensify the payoff with a stronger visible outcome.',
      'Slide 6 CTA: land the offer naturally and clearly without sounding like an ad script.'
    ],
    overlayRules: [
      'Write overlay text that feels native to TikTok, not like presentation labels.',
      'Aim for 2 to 4 short lines per slide and roughly 4 to 6 words per line.',
      'Keep slide 1 especially punchy and avoid repeating recent opening hooks.',
      'Do not reuse the same first-slide opening, overlay sequence, or copy family from the recent post set.',
      'Do not use emojis, generic motivational cliches, or empty jargon.'
    ],
    promptingRules: [
      'Use one strong base prompt that locks subject identity, room identity, lighting, and camera angle.',
      'Keep the same person and same believable workspace across all slides.',
      'Let each slide change expression, posture, state progression, or tension rather than replacing the whole scene.',
      'Leave clear negative space in the upper center for text overlays.'
    ],
    captionRules: [
      'Caption must be plain text only.',
      'Keep it short for TikTok: 2 or 3 short paragraphs max and no more than 5 hashtags.',
      'Avoid repeating caption openings or CTA wording from recent posts.',
      'If the new caption feels too close to a recent one, rewrite it until the opening and progression are clearly different.',
      'Do not use emojis, bullets, labels, quotation marks, or self-referential phrasing.'
    ],
    templateFamilies: SUPPORTED_TEMPLATE_FAMILIES,
  };
}

function buildContext(defaults, profile, brief, post = {}) {
  const accountName = firstNonEmpty(profile.displayName, profile.id, brief.accountId, 'the brand');
  const offer = firstNonEmpty(
    post.offer,
    brief.coreOffer,
    profile.offerings?.[0]?.name,
    'the offer'
  );
  const audience = firstNonEmpty(profile.audience, 'founders and operators');
  const topic = firstNonEmpty(profile.topic, 'outcome-focused execution');
  const visualStyle = firstNonEmpty(profile.visual?.style, 'realistic iPhone photo aesthetic');
  const subjectPattern = firstNonEmpty(
    profile.visual?.subjectPattern,
    'the same founder or operator working in the same believable workspace from the same angle'
  );
  const basePromptStyle = firstNonEmpty(
    profile.visual?.basePromptStyle,
    'realistic phone camera quality, same room identity across all slides, no text, no logos, no watermarks'
  );
  const cta = firstNonEmpty(post.cta, brief.cta, 'Learn more');
  const campaignTitle = firstNonEmpty(brief.title, 'Untitled campaign');
  const postTitle = firstNonEmpty(post.postTitle, post.title, campaignTitle);
  const angle = firstNonEmpty(post.angle, post.templateFamily, '');
  const templateFamily = firstNonEmpty(post.templateFamily, '');
  const visualTemplateId = firstNonEmpty(post.visualTemplateId, brief.visualTemplateId, '');
  const message = firstNonEmpty(
    post.message,
    brief.message,
    `${accountName} positions ${offer} as a better way to get visible movement with less overhead.`
  );

  return {
    language: pickLanguage(profile, defaults),
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
    angle,
    templateFamily,
    visualTemplateId,
    message,
  };
}

function buildIdeaSchema() {
  return {
    type: 'object',
    properties: {
      postTitle: { type: 'string' },
      postSlug: { type: 'string' },
      angle: { type: 'string' },
      templateFamily: {
        type: 'string',
        enum: SUPPORTED_TEMPLATE_FAMILIES.map((family) => family.id),
      },
      rationale: { type: 'string' },
    },
    required: ['postTitle', 'postSlug', 'angle', 'templateFamily', 'rationale'],
    additionalProperties: false,
  };
}

function buildDraftSchema(slideCount, templateManifest = null) {
  const templateTextSchema = buildTemplateTextSchema(templateManifest);
  return {
    type: 'object',
    properties: {
      postTitle: { type: 'string' },
      angle: { type: 'string' },
      templateFamily: {
        type: 'string',
        enum: SUPPORTED_TEMPLATE_FAMILIES.map((family) => family.id),
      },
      rationale: { type: 'string' },
      prompts: {
        type: 'object',
        properties: {
          base: { type: 'string' },
          slides: {
            type: 'array',
            minItems: slideCount,
            maxItems: slideCount,
            items: { type: 'string' },
          },
        },
        required: ['base', 'slides'],
        additionalProperties: false,
      },
      texts: {
        type: 'array',
        minItems: slideCount,
        maxItems: slideCount,
        ...(templateTextSchema
          ? { prefixItems: templateTextSchema, items: false }
          : { items: { type: 'string' } }),
      },
      caption: { type: 'string' },
    },
    required: ['prompts', 'texts', 'caption'],
    additionalProperties: false,
  };
}

function buildIdeaTaskPayload({ contentRoot, account, campaign }) {
  const profilePath = path.join(contentRoot, account, 'profile.json');
  const briefPath = path.join(contentRoot, account, 'campaigns', campaign, 'brief.json');
  const examplesPath = path.join(contentRoot, account, TIKTOK_PLATFORM, 'examples.md');
  const postsDir = path.join(contentRoot, account, TIKTOK_PLATFORM, 'posts');

  const profile = readJson(profilePath);
  const brief = readJson(briefPath);
  const recentPosts = collectRecentPosts(postsDir, { limit: DEFAULT_RECENT_POST_LIMIT });
  const repetitionSignals = buildRepetitionSignals(recentPosts);

  const input = {
    account,
    campaign,
    profile: summarizeProfile(profile),
    brief: summarizeBrief(brief),
    recentPosts,
    repetitionSignals,
    examples: truncateText(readTextIfExists(examplesPath, ''), 2000),
    guidance: buildCreativeReferences(),
    runtime: {
      datePrefix: new Date().toISOString().slice(0, 10),
    },
  };

  const prompt = [
    'Create one fresh TikTok slideshow post idea for this account and campaign.',
    'Return JSON only.',
    'Return exactly one JSON object with only these keys: postTitle, postSlug, angle, templateFamily, rationale.',
    'Do not include hook, caption, slides, prompts, texts, imagePrompt, or any other keys.',
    'This step is idea selection only. Do not draft the slideshow package yet.',
    'Do not repeat recent post angles, hook openings, caption openings, or copy families across the recent account-level TikTok post set.',
    'Do not reuse a recent post title, slug family, or the same title opening.',
    'Keep the post title short and punchy.',
    'Use templateFamily as the nearest drafting/rendering family, but keep angle as a fresh editorial label.',
    'rationale must be a short plain-language reason this idea is fresh and strategically relevant for the account.',
    'postSlug must be kebab-case and should normalize to the pattern YYYY-MM-DD-slideshow-your-post-name.',
  ].join(' ');

  return {
    kind: 'idea-task',
    prompt,
    input,
    schema: buildIdeaSchema(),
  };
}

function buildDraftTaskPayload({ defaultsPath, profilePath, briefPath, postDir }) {
  const defaults = readJson(defaultsPath);
  const profile = readJson(profilePath);
  const brief = readJson(briefPath);
  const post = readJsonIfExists(path.join(postDir, 'post.json'), {}) || {};
  const examplesPath = path.resolve(postDir, '..', '..', 'examples.md');
  const postsDir = path.resolve(postDir, '..');
  const context = buildContext(defaults, profile, brief, post);
  const recentPosts = collectRecentPosts(postsDir, { excludePostDir: postDir, limit: DEFAULT_RECENT_POST_LIMIT });
  const templateManifest = loadTemplateForSelection(post.visualTemplateId, brief.visualTemplateId, {
    postDir,
    briefPath,
  });
  const slideCount = templateManifest?.slides?.length || getSlideCount(defaults, profile);

  const input = {
    context,
    post: {
      postTitle: post.postTitle || '',
      postSlug: post.postSlug || path.basename(postDir),
      angle: post.angle || '',
      templateFamily: post.templateFamily || '',
      rationale: post.ideaRationale || '',
      offer: post.offer || '',
      cta: post.cta || '',
      message: post.message || '',
      visualTemplateId: post.visualTemplateId || brief.visualTemplateId || '',
    },
    profile: summarizeProfile(profile),
    brief: summarizeBrief(brief),
    recentPosts,
    repetitionSignals: buildRepetitionSignals(recentPosts),
    examples: truncateText(readTextIfExists(examplesPath, ''), 2000),
    visualTemplate: summarizeTemplateForPrompt(templateManifest),
    guidance: buildCreativeReferences(),
    constraints: {
      slideCount,
      captionMaxChars: DEFAULT_CAPTION_MAX_CHARS,
      overlayLineTarget: '2 to 4 lines',
      overlayWordTarget: '4 to 6 words per line',
      textMode: templateManifest ? 'template-slots' : 'overlay-strings',
    },
  };

  const prompt = [
    'Draft one complete TikTok slideshow package for this post.',
    'Return JSON only.',
    'Write fresh copy that fits the account voice and avoids reusing recent hooks, caption openings, or copy families from the recent account-level TikTok post set.',
    'Do not reuse a recent title opening, overlay opening, overlay sequence, or caption opening.',
    'texts must contain exactly the required number of overlay entries and each entry should feel native to TikTok.',
    'prompts.base must lock scene identity and prompts.slides must show believable progression across the same person and workspace.',
    `caption must stay under ${DEFAULT_CAPTION_MAX_CHARS} characters, be plain text only, and already be optimized for TikTok.`,
    'Use templateFamily as loose creative guidance, not as a reason to repeat old copy.',
    templateManifest
      ? 'Use the selected visual template. texts must be an array of objects whose keys exactly match each slide editableSlotNames list. For static slides with no editable slots, return an empty object.'
      : '',
  ].join(' ');

  return {
    kind: 'draft-task',
    prompt,
    input,
    schema: buildDraftSchema(slideCount, templateManifest),
  };
}

function validateFreshIdea({ postTitle, postSlug, angle, templateFamily, recentPosts = [] }) {
  const issues = [];
  const comparableTitle = normalizeComparableText(postTitle);
  const comparableAngle = normalizeComparableText(angle);
  const comparableSlugBase = slugBaseForComparison(postSlug);
  const recentTemplateCooldown = recentPosts.slice(0, DEFAULT_TEMPLATE_FAMILY_COOLDOWN).map((post) => post.templateFamily).filter(Boolean);

  for (const recentPost of recentPosts) {
    if (normalizeComparableText(recentPost.postTitle) === comparableTitle) {
      issues.push(`postTitle duplicates recent title "${recentPost.postTitle}"`);
      break;
    }
  }

  for (const recentPost of recentPosts) {
    if (slugBaseForComparison(recentPost.postSlug) === comparableSlugBase) {
      issues.push(`postSlug reuses recent slug family "${recentPost.postSlug}"`);
      break;
    }
  }

  for (const recentPost of recentPosts) {
    if (normalizeComparableText(recentPost.angle) === comparableAngle) {
      issues.push(`angle repeats recent angle "${recentPost.angle}"`);
      break;
    }
  }

  for (const recentPost of recentPosts) {
    if (sharedLeadingWords(postTitle, recentPost.postTitle, 3)) {
      issues.push(`postTitle starts too similarly to recent title "${recentPost.postTitle}"`);
      break;
    }
  }

  for (const recentPost of recentPosts) {
    const similarity = jaccardSimilarity(postTitle, recentPost.postTitle);
    if (similarity >= TITLE_SIMILARITY_THRESHOLD) {
      issues.push(`postTitle is too similar to recent title "${recentPost.postTitle}"`);
      break;
    }
  }

  if (templateFamily && recentTemplateCooldown.includes(templateFamily)) {
    issues.push(`templateFamily "${templateFamily}" was used too recently`);
  }

  if (issues.length > 0) {
    throw new Error(`Idea is too similar to recent posts: ${issues.join('; ')}`);
  }
}

function normalizeIdeaOutput(raw, { datePrefix, recentPosts = [] }) {
  const idea = unwrapModelJson(raw);
  const postTitle = firstNonEmpty(normalizeText(idea?.postTitle), normalizeText(idea?.title));
  const angle = normalizeText(idea?.angle);
  const rationale = normalizeText(idea?.rationale);
  const templateFamily = normalizeText(idea?.templateFamily);
  const isSupportedTemplateFamily = SUPPORTED_TEMPLATE_FAMILIES.some((family) => family.id === templateFamily);
  const slugBase = normalizeText(idea?.postSlug) || postTitle;

  if (!postTitle || !angle || !rationale || !templateFamily || !isSupportedTemplateFamily) {
    throw new Error('Idea JSON is missing one of: postTitle, angle, rationale, templateFamily.');
  }

  const postSlug = normalizePostSlug(slugBase, datePrefix);

  validateFreshIdea({
    postTitle,
    postSlug,
    angle,
    templateFamily,
    recentPosts,
  });

  return {
    postTitle,
    postSlug,
    angle,
    templateFamily,
    rationale,
  };
}

function validateFreshDraft({ postTitle, postSlug, angle, templateFamily, texts, caption, recentPosts = [] }) {
  validateFreshIdea({
    postTitle,
    postSlug,
    angle,
    templateFamily,
    recentPosts,
  });

  const issues = [];
  const hookOpening = flattenTextEntry(texts[0]);
  const overlayFingerprint = buildOverlayFingerprint(texts);
  const captionOpening = extractCaptionOpening(caption);
  const normalizedCaption = normalizeComparableText(caption);

  for (const recentPost of recentPosts) {
    if (normalizeComparableText(recentPost.hookOpening) === normalizeComparableText(hookOpening)) {
      issues.push(`slide 1 hook duplicates recent hook opening from "${recentPost.postTitle}"`);
      break;
    }
  }

  for (const recentPost of recentPosts) {
    if (sharedLeadingWords(hookOpening, recentPost.hookOpening, 4)) {
      issues.push(`slide 1 hook starts too similarly to "${recentPost.postTitle}"`);
      break;
    }
  }

  for (const recentPost of recentPosts) {
    if (recentPost.overlayFingerprint && recentPost.overlayFingerprint === overlayFingerprint) {
      issues.push(`overlay copy family duplicates recent post "${recentPost.postTitle}"`);
      break;
    }
  }

  for (const recentPost of recentPosts) {
    if (normalizeComparableText(recentPost.captionOpening) === normalizeComparableText(captionOpening)) {
      issues.push(`caption opening duplicates recent caption from "${recentPost.postTitle}"`);
      break;
    }
  }

  for (const recentPost of recentPosts) {
    if (sharedLeadingWords(captionOpening, recentPost.captionOpening, 5)) {
      issues.push(`caption opening starts too similarly to "${recentPost.postTitle}"`);
      break;
    }
  }

  for (const recentPost of recentPosts) {
    const similarity = jaccardSimilarity(normalizedCaption, recentPost.captionExcerpt);
    if (similarity >= CAPTION_SIMILARITY_THRESHOLD) {
      issues.push(`caption is too similar to recent post "${recentPost.postTitle}"`);
      break;
    }
  }

  if (issues.length > 0) {
    throw new Error(`Draft is too similar to recent posts: ${issues.join('; ')}`);
  }
}

function normalizeDraftOutput(raw, { slideCount, fallbackPost, recentPosts = [] }) {
  const draft = unwrapModelJson(raw);
  const prompts = draft?.prompts || {};
  const basePrompt = normalizeText(prompts.base);
  const promptSlides = Array.isArray(prompts.slides) ? prompts.slides.map((value) => normalizeText(value)) : [];
  const templateManifest = loadTemplateForSelection(fallbackPost.visualTemplateId, {
    postDir: fallbackPost.postDir,
    briefPath: fallbackPost.briefPath,
    contentRoot: fallbackPost.contentRoot,
    accountId: fallbackPost.accountId,
  });
  const texts = templateManifest
    ? normalizeTemplateTextEntries(draft?.texts, templateManifest)
    : Array.isArray(draft?.texts) ? draft.texts.map((value) => normalizeText(value)) : [];
  const caption = normalizeCaption(draft?.caption);
  const templateFamily = firstNonEmpty(normalizeText(draft?.templateFamily), fallbackPost.templateFamily);
  const angle = firstNonEmpty(normalizeText(draft?.angle), fallbackPost.angle, templateFamily);
  const postTitle = firstNonEmpty(normalizeText(draft?.postTitle), normalizeText(draft?.title), fallbackPost.postTitle);
  const rationale = firstNonEmpty(normalizeText(draft?.rationale), fallbackPost.rationale, '');

  if (!basePrompt) throw new Error('Draft JSON must include prompts.base.');
  if (promptSlides.length !== slideCount || promptSlides.some((value) => !value)) {
    throw new Error(`Draft JSON must include exactly ${slideCount} non-empty prompts.slides entries.`);
  }
  const hasInvalidTexts = templateManifest
    ? texts.some((value) => !hasMeaningfulTextEntry(value) && Object.keys(value || {}).length !== 0)
    : texts.some((value) => !normalizeText(value));

  if (texts.length !== slideCount || hasInvalidTexts) {
    throw new Error(`Draft JSON must include exactly ${slideCount} non-empty texts entries.`);
  }
  if (!caption) throw new Error('Draft JSON must include a non-empty caption.');
  if (caption.length > DEFAULT_CAPTION_MAX_CHARS) {
    throw new Error(`caption must stay under ${DEFAULT_CAPTION_MAX_CHARS} characters.`);
  }
  if (!postTitle) throw new Error('Draft JSON must resolve to a postTitle.');
  if (!angle) throw new Error('Draft JSON must resolve to an angle.');
  if (!templateFamily) throw new Error('Draft JSON must resolve to a templateFamily.');
  if (!SUPPORTED_TEMPLATE_FAMILIES.some((family) => family.id === templateFamily)) {
    throw new Error(`Unsupported templateFamily: ${templateFamily}`);
  }

  validateFreshDraft({
    postTitle,
    postSlug: fallbackPost.postSlug || postTitle,
    angle,
    templateFamily,
    texts,
    caption,
    recentPosts,
  });

  return {
    postTitle,
    angle,
    templateFamily,
    rationale,
    prompts: {
      base: basePrompt,
      slides: promptSlides,
    },
    texts,
    caption,
  };
}

function applyDraftPackage({ defaults, profile, brief, postDir, draft }) {
  const postConfigPath = path.join(postDir, 'post.json');
  const promptsPath = path.join(postDir, 'prompts.json');
  const textsPath = path.join(postDir, 'texts.json');
  const captionPath = path.join(postDir, 'caption.txt');
  const post = readJsonIfExists(postConfigPath, {}) || {};
  const context = buildContext(defaults, profile, brief, {
    ...post,
    angle: draft.angle,
    templateFamily: draft.templateFamily,
    postTitle: draft.postTitle,
  });

  writeJson(promptsPath, draft.prompts);
  writeJson(textsPath, draft.texts);
  fs.writeFileSync(captionPath, `${draft.caption}\n`);

  post.status = 'drafted';
  post.language = context.language;
  post.accountName = context.accountName;
  post.offer = post.offer || context.offer;
  post.cta = post.cta || context.cta;
  post.message = post.message || context.message;
  post.postTitle = draft.postTitle;
  post.angle = draft.angle;
  post.templateFamily = draft.templateFamily;
  post.visualTemplateId = post.visualTemplateId || brief.visualTemplateId || '';
  post.ideaRationale = draft.rationale || post.ideaRationale || '';
  post.creativeSource = 'agent';
  delete post.captionProvider;
  delete post.captionModel;
  delete post.captionDynamic;

  writeJson(postConfigPath, post);

  return {
    post,
    promptsPath,
    textsPath,
    captionPath,
  };
}

module.exports = {
  DEFAULT_CAPTION_MAX_CHARS,
  SUPPORTED_TEMPLATE_FAMILIES,
  applyDraftPackage,
  buildDraftTaskPayload,
  buildIdeaTaskPayload,
  buildRepetitionSignals,
  buildContext,
  buildCreativeReferences,
  collectRecentPosts,
  getSlideCount,
  jaccardSimilarity,
  leadingWordsKey,
  normalizeCaption,
  normalizeComparableText,
  normalizeDraftOutput,
  normalizeIdeaOutput,
  pickLanguage,
  readJson,
  readJsonIfExists,
  readTextIfExists,
  truncateText,
  unwrapModelJson,
  writeJson,
};
