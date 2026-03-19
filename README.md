# TikTok Slideshow Creator

Create 6-slide TikTok slideshow packages from an account profile, campaign brief, and post folder.

This skill is now agent-first for creative generation:

- the agent generates post ideas, prompts, overlay text, and `caption.txt`
- the scripts build task payloads, validate freshness, and apply the generated JSON
- API keys are only needed for image generation

The skill does not handle publishing, scheduling, or analytics.

## Canonical content root

When this skill runs inside OpenClaw, the canonical managed content root is:

```text
C:\Users\mathi\.openclaw\workspace\content
```

Do not create sibling roots like `C:\Users\mathi\.openclaw\workspace\tiktok-content` or nested roots like `C:\Users\mathi\.openclaw\workspace\content\tiktok-slideshows` unless the user explicitly asks for a custom location.

The scaffolding and idea scripts now default to that canonical root automatically when the skill is installed under `.openclaw/skills`. Outside OpenClaw, the same commands fall back to a local `content/` directory unless you pass `--dir` or `--content-root`.

## Requirements

- Node.js 18+
- `npm`
- `OPENAI_API_KEY` or `GEMINI_API_KEY` only if you want API-based image generation

## Repository structure

```text
<content-root>/
  defaults.json
  <account>/
    profile.json
    campaigns/
      <campaign>/
        brief.json
    tiktok/
      examples.md
      posts/
        <YYYY-MM-DD-slideshow-post-name>/
          post.json
          prompts.json
          texts.json
          caption.txt
          images/
          ready-to-publish/
```

`defaults.json` is for shared technical defaults. Keep account identity in `profile.json`, campaign messaging in account-level `campaigns/<campaign>/brief.json`, and concrete TikTok assets in `tiktok/posts/<post>/`.

## Supported image providers

- `gemini`
- `openai`
- `local`

Use `local` when you want to supply images manually instead of calling an image API.

## Install

1. Install the skill into `.openclaw/skills` or a workspace-local skills folder.
2. Run `npm install` inside the skill folder.
3. Configure image-generation API keys outside project files only if you need API image generation.

Example OpenClaw config:

```json
{
  "skills": {
    "tiktok-slideshow-creator": {
      "enabled": true,
      "env": {
        "OPENAI_API_KEY": "YOUR-API-KEY-HERE",
        "GEMINI_API_KEY": "YOUR-API-KEY-HERE"
      }
    }
  }
}
```

## Core flow

### 1. Initialize a content repo

```bash
node scripts/init-project.js
```

### 2. Create the account and campaign structure

```bash
node scripts/create-account.js --account my-brand
node scripts/create-campaign.js --account my-brand --campaign launch-angle
```

### 3. Create a post scaffold

```bash
node scripts/create-post.js --account my-brand --campaign launch-angle --title "First slideshow"
```

`post.json` stores the editorial `angle`, the technical `templateFamily`, the `campaignId`, and platform metadata. New posts default to a folder name like `YYYY-MM-DD-slideshow-first-slideshow`. `caption.txt` is the only caption artifact and should already be short enough for TikTok.

### 4. Build an idea task for the agent

```bash
node scripts/generate-post-idea.js --account my-brand --campaign launch-angle
```

Without extra input, this returns a JSON task payload for the agent or workflow. The payload includes:

- account and campaign context
- recent account-level TikTok post summaries
- repetition signals from the recent account-level TikTok post set
- the JSON schema the model should return

The normalized idea contract is:

- `postTitle`
- `postSlug`
- `angle`
- `templateFamily`
- `rationale`

If you already have a generated idea JSON and want the skill to validate and normalize it:

```bash
node scripts/generate-post-idea.js --account my-brand --campaign launch-angle --idea-file idea.json
```

### 5. Build a draft task for the agent

```bash
node scripts/draft-post.js --defaults <content-root>/defaults.json --profile <content-root>/my-brand/profile.json --brief <campaign-dir>/brief.json --post-dir <post-dir>
```

Without extra input, this returns a JSON task payload for the agent or workflow to generate:

- `prompts.json`
- `texts.json`
- `caption.txt`

The draft JSON accepted by the skill resolves to:

- `postTitle`
- `angle`
- `templateFamily`
- `prompts`
- `texts`
- `caption`

To validate and apply an agent-generated draft:

```bash
node scripts/draft-post.js --defaults <content-root>/defaults.json --profile <content-root>/my-brand/profile.json --brief <campaign-dir>/brief.json --post-dir <post-dir> --draft-file draft.json
```

### 6. Generate images

```bash
node scripts/generate-images.js --defaults <content-root>/defaults.json --profile <content-root>/my-brand/profile.json --output <post-dir> --prompts <post-dir>/prompts.json
```

The script writes into `<post-dir>/images/`. It prefers `hero_frame.png` plus variations for consistency and also records generation logs for retries and diagnostics.

### 7. Add overlays

```bash
node scripts/add-text-overlay.js --input <post-dir> --texts <post-dir>/texts.json --profile <content-root>/my-brand/profile.json
```

### 8. Export the ready package

```bash
node scripts/export-ready-package.js --dir <post-dir>
```

This creates `ready-to-publish/` with:

- final slide images
- `caption.txt`
- `package.json`
- `package-for-mobile.zip` when zip creation is available

## Freshness and non-repetition

The skill now hardens against repetition in two ways:

1. It gives the agent recent-post context and explicit blocked signals.
2. It validates the returned JSON before accepting it.

The freshness scope is now account-wide inside TikTok. The skill reviews the latest 50 posts in `<content-root>/<account>/tiktok/posts/`, regardless of campaign.

The validation rejects ideas or drafts that are too close to recent posts, including:

- repeated post titles
- repeated slug families
- repeated editorial angles
- template families reused inside a short cooldown window
- repeated first-slide hook openings
- repeated overlay copy families
- repeated caption openings
- captions that are too similar to recent captions

If a generated idea or draft fails freshness validation, the script exits with an error instead of silently accepting repeated copy.

## Custom roots

If you intentionally want to manage content outside the canonical OpenClaw root, pass an explicit external path:

```bash
node scripts/init-project.js --dir D:\content-lab
node scripts/create-account.js --dir D:\content-lab --account my-brand
node scripts/generate-post-idea.js --content-root D:\content-lab --account my-brand --campaign launch-angle
```

When the skill is running from `.openclaw/skills`, it rejects alternate roots inside `C:\Users\mathi\.openclaw\workspace` so the agent cannot silently fork your content into parallel folders.

## Guardrails

- Do not promise automatic TikTok posting unless a separate publishing adapter exists.
- Keep secrets out of prompts and long-lived plain-text files.
- Use only one caption artifact: `caption.txt`.
- Keep `caption.txt` short, plain text, and mobile-readable.
- Treat each post as a distinct creative angle, not just a restatement of the campaign message.
- Prefer hero-frame plus variations over six unrelated images when subject consistency matters.

## References

- `references/slide-structure.md`
- `references/prompting.md`
- `references/text-overlay.md`
- `references/account-profiles.md`
