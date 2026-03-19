#!/usr/bin/env node
const fs = require('fs');
const {
  buildIdeaTaskPayload,
  normalizeIdeaOutput,
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

async function main() {
  const contentRoot = getArg('content-root');
  const account = getArg('account');
  const campaign = getArg('campaign');
  const ideaFile = getArg('idea-file');

  if (!contentRoot || !account || !campaign) {
    console.error('Usage: node generate-post-idea.js --content-root <dir> --account <id> --campaign <id> [--idea-file <idea.json>]');
    process.exit(1);
  }

  const task = buildIdeaTaskPayload({ contentRoot, account, campaign });
  const stdinText = normalizeText(await readStdin());

  if (!ideaFile && !stdinText) {
    process.stdout.write(`${JSON.stringify(task, null, 2)}\n`);
    return;
  }

  const rawIdea = ideaFile ? readJson(ideaFile) : JSON.parse(stdinText);
  const idea = normalizeIdeaOutput(rawIdea, {
    datePrefix: task.input.runtime.datePrefix,
    recentPosts: task.input.recentPosts,
  });

  process.stdout.write(`${JSON.stringify(idea, null, 2)}\n`);
}

function normalizeText(value) {
  return String(value || '').trim();
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
