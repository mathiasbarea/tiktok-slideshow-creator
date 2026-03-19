#!/usr/bin/env node
const { slugify, ensureAccount, ensureCampaign } = require('./_lib');
const { resolveContentRoot } = require('./_content-root');

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

try {
  const rootDir = resolveContentRoot(getArg('dir'), { scriptDir: __dirname });
  const accountId = slugify(getArg('account'));
  const campaignId = slugify(getArg('campaign'));
  const title = getArg('title') || campaignId;
  const offer = getArg('offer') || '';
  const cta = getArg('cta') || '';
  const message = getArg('message') || '';

  if (!accountId || !campaignId) {
    console.error('Usage: node create-campaign.js [--dir <content-root>] --account <account-id> --campaign <campaign-id> [--title <title>] [--offer <offer-name>] [--cta <cta>] [--message <message>]');
    process.exit(1);
  }

  const account = ensureAccount(rootDir, accountId);
  const campaign = ensureCampaign(rootDir, accountId, campaignId, {
    title,
    coreOffer: offer,
    cta,
    message,
    notes: []
  });

  if (account.profile) console.log(`Created ${account.profilePath}`);
  if (account.examples) console.log(`Created ${account.examplesPath}`);
  if (campaign.created) console.log(`Created ${campaign.briefPath}`);
  console.log(`\nCampaign ready at ${campaign.campaignDir}`);
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
