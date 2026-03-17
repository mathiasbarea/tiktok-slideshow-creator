#!/usr/bin/env node
const { slugify, ensureAccount } = require('./_lib');

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const rootDir = getArg('dir') || 'content/tiktok-slideshows';
const accountId = slugify(getArg('account'));

if (!accountId) {
  console.error('Usage: node create-account.js --dir <content-root> --account <account-id>');
  process.exit(1);
}

const result = ensureAccount(rootDir, accountId);
if (result.profile) console.log(`Created ${result.profilePath}`);
if (result.examples) console.log(`Created ${result.examplesPath}`);
console.log(`\nAccount ready at ${result.accountDir}`);
