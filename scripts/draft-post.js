#!/usr/bin/env node
const {
  applyDraftPackage,
  buildDraftTaskPayload,
  normalizeDraftOutput,
  readJson,
} = require('./_creative');

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
}

function normalizeText(value) {
  return String(value || '').trim();
}

async function main() {
  const defaultsPath = getArg('defaults');
  const profilePath = getArg('profile');
  const briefPath = getArg('brief');
  const postDir = getArg('post-dir');
  const draftFile = getArg('draft-file');

  if (!defaultsPath || !profilePath || !briefPath || !postDir) {
    console.error('Usage: node draft-post.js --defaults <defaults.json> --profile <profile.json> --brief <brief.json> --post-dir <post-dir> [--draft-file <draft.json>]');
    process.exit(1);
  }

  const task = buildDraftTaskPayload({
    defaultsPath,
    profilePath,
    briefPath,
    postDir,
  });

  const stdinText = normalizeText(await readStdin());
  if (!draftFile && !stdinText) {
    process.stdout.write(`${JSON.stringify(task, null, 2)}\n`);
    return;
  }

  const rawDraft = draftFile ? readJson(draftFile) : JSON.parse(stdinText);
  const draft = normalizeDraftOutput(rawDraft, {
    slideCount: task.input.constraints.slideCount,
    fallbackPost: {
      postTitle: task.input.post.postTitle,
      postSlug: task.input.post.postSlug,
      angle: task.input.post.angle,
      templateFamily: task.input.post.templateFamily,
      rationale: task.input.post.rationale,
    },
    recentPosts: task.input.recentPosts,
  });

  const defaults = readJson(defaultsPath);
  const profile = readJson(profilePath);
  const brief = readJson(briefPath);

  applyDraftPackage({
    defaults,
    profile,
    brief,
    postDir,
    draft,
  });

  console.log(`Drafted post content in ${postDir} from an agent-generated creative package.`);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
