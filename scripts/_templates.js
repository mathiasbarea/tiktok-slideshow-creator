const fs = require('fs');
const path = require('path');

const SHARED_ACCOUNT_ID = '_shared';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function inferAccountDirFromBriefPath(briefPath) {
  if (!briefPath) return null;
  return path.dirname(path.dirname(path.dirname(path.resolve(briefPath))));
}

function inferAccountDirFromPostDir(postDir) {
  if (!postDir) return null;
  return path.dirname(path.dirname(path.dirname(path.resolve(postDir))));
}

function inferTemplateContext(options = {}) {
  const accountDir = options.accountId && options.contentRoot
    ? path.join(path.resolve(options.contentRoot), options.accountId)
    : inferAccountDirFromBriefPath(options.briefPath) || inferAccountDirFromPostDir(options.postDir);

  if (!accountDir) {
    return {
      contentRoot: null,
      accountId: '',
      accountDir: null,
    };
  }

  return {
    contentRoot: path.dirname(accountDir),
    accountId: path.basename(accountDir),
    accountDir,
  };
}

function buildTemplateRootCandidates(options = {}) {
  const context = inferTemplateContext(options);
  const candidates = [];

  if (context.accountDir) {
    candidates.push({
      kind: 'account',
      rootDir: path.join(context.accountDir, 'templates'),
      contentRoot: context.contentRoot,
      accountId: context.accountId,
    });
  }

  if (context.contentRoot) {
    candidates.push({
      kind: 'shared',
      rootDir: path.join(context.contentRoot, SHARED_ACCOUNT_ID, 'templates'),
      contentRoot: context.contentRoot,
      accountId: SHARED_ACCOUNT_ID,
    });
  }

  return candidates;
}

function getTemplateDir(templateId, options = {}) {
  const candidateId = String(templateId || '').trim();
  if (!candidateId) return null;

  const roots = buildTemplateRootCandidates(options);
  const checkedPaths = [];

  for (const root of roots) {
    const templateDir = path.join(root.rootDir, candidateId);
    const manifestPath = path.join(templateDir, 'manifest.json');
    checkedPaths.push(manifestPath);
    if (fs.existsSync(manifestPath)) {
      return {
        ...root,
        templateId: candidateId,
        templateDir,
        manifestPath,
        checkedPaths,
      };
    }
  }

  const details = checkedPaths.length > 0
    ? ` Looked in: ${checkedPaths.join(', ')}`
    : ' No content-root/account context was available to resolve template directories.';
  throw new Error(`Unknown visualTemplateId: ${candidateId}.${details}`);
}

function resolveTemplateAsset(template, relativePath) {
  return path.join(template.rootDir, relativePath);
}

function normalizeSlide(slide, template) {
  const slots = Array.isArray(slide.slots) ? slide.slots : [];
  return {
    index: slide.index,
    asset: slide.asset,
    assetPath: resolveTemplateAsset(template, slide.asset),
    staticFinal: Boolean(slide.staticFinal),
    slots: slots.map((slot) => ({
      ...slot,
      name: String(slot.name || '').trim(),
      placeholder: String(slot.placeholder || slot.name || '').trim(),
    })),
  };
}

function loadTemplateManifest(templateId, options = {}) {
  if (!templateId) return null;
  const resolved = getTemplateDir(templateId, options);
  const raw = readJson(resolved.manifestPath);
  const template = {
    id: raw.id || templateId,
    name: raw.name || templateId,
    description: raw.description || '',
    renderMode: raw.renderMode || 'template-pack',
    canvas: raw.canvas || { width: 1080, height: 1920 },
    rootDir: resolved.templateDir,
    manifestPath: resolved.manifestPath,
    source: {
      kind: resolved.kind,
      accountId: resolved.accountId,
      contentRoot: resolved.contentRoot,
    },
    slides: [],
  };

  template.slides = Array.isArray(raw.slides)
    ? raw.slides.map((slide) => normalizeSlide(slide, template))
    : [];

  if (template.slides.length === 0) {
    throw new Error(`Template ${template.id} must define at least one slide`);
  }

  return template;
}

function loadTemplateForSelection(...args) {
  let options = {};
  if (args.length > 0) {
    const maybeOptions = args[args.length - 1];
    if (isPlainObject(maybeOptions) && !('slides' in maybeOptions) && !('renderMode' in maybeOptions)) {
      options = args.pop();
    }
  }

  const ids = args.flat().map((value) => String(value || '').trim()).filter(Boolean);
  let lastMissingError = null;
  for (const id of ids) {
    try {
      return loadTemplateManifest(id, options);
    } catch (error) {
      if (!/Unknown visualTemplateId:/i.test(String(error.message || error))) {
        throw error;
      }
      lastMissingError = error;
    }
  }
  if (lastMissingError) throw lastMissingError;
  return null;
}

function getSlideTemplate(template, slideIndex) {
  if (!template) return null;
  return template.slides.find((slide) => slide.index === slideIndex) || null;
}

function buildTemplateTextPlaceholders(template) {
  if (!template) return null;
  return template.slides.map((slide) => {
    const slots = slide.slots || [];
    if (slots.length === 0) return {};
    return Object.fromEntries(slots.map((slot) => [slot.name, `${slot.placeholder} here`]));
  });
}

function buildTemplateTextSchema(template) {
  if (!template) return null;
  return template.slides.map((slide) => {
    const slots = slide.slots || [];
    const properties = Object.fromEntries(slots.map((slot) => [slot.name, { type: 'string' }]));
    return {
      type: 'object',
      properties,
      required: slots.map((slot) => slot.name),
      additionalProperties: false,
    };
  });
}

function summarizeTemplateForPrompt(template) {
  if (!template) return null;
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    renderMode: template.renderMode,
    source: template.source,
    slides: template.slides.map((slide) => ({
      index: slide.index,
      staticFinal: slide.staticFinal,
      editableSlotNames: slide.slots.map((slot) => slot.name),
    })),
  };
}

function flattenTextEntry(value) {
  if (typeof value === 'string') return normalizeText(value);
  if (!isPlainObject(value)) return '';
  return Object.values(value)
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .join('\n');
}

function normalizeTemplateTextEntries(texts, template) {
  if (!Array.isArray(texts) || texts.length !== template.slides.length) {
    throw new Error(`Draft JSON must include exactly ${template.slides.length} template text entries.`);
  }

  return template.slides.map((slide, index) => {
    const slots = slide.slots || [];
    const entry = texts[index];

    if (slots.length === 0) {
      if (entry == null) return {};
      if (!isPlainObject(entry) || Object.keys(entry).length > 0) {
        throw new Error(`Slide ${slide.index} uses a static template and must return an empty object for texts[${index}].`);
      }
      return {};
    }

    if (!isPlainObject(entry)) {
      throw new Error(`Slide ${slide.index} must return an object for texts[${index}] matching the template slot names.`);
    }

    const normalized = {};
    for (const slot of slots) {
      const slotValue = normalizeText(entry[slot.name]);
      if (!slotValue) {
        throw new Error(`Slide ${slide.index} is missing text for slot "${slot.name}".`);
      }
      normalized[slot.name] = slotValue;
    }

    const unknownKeys = Object.keys(entry).filter((key) => !slots.some((slot) => slot.name === key));
    if (unknownKeys.length > 0) {
      throw new Error(`Slide ${slide.index} returned unknown template slots: ${unknownKeys.join(', ')}`);
    }

    return normalized;
  });
}

module.exports = {
  SHARED_ACCOUNT_ID,
  buildTemplateRootCandidates,
  buildTemplateTextPlaceholders,
  buildTemplateTextSchema,
  flattenTextEntry,
  getSlideTemplate,
  inferTemplateContext,
  loadTemplateForSelection,
  loadTemplateManifest,
  normalizeTemplateTextEntries,
  resolveTemplateAsset,
  summarizeTemplateForPrompt,
};
