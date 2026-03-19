---
name: tiktok-slideshow-creator
description: Create 6-slide TikTok slideshow packages from a brand/account profile, campaign brief, and post angle. Use when generating slideshow hooks, overlay text, captions, image prompts, consistent slide images, text overlays, and a ready-to-publish export for manual TikTok upload.
---

# TikTok Slideshow Creator

Create image-first TikTok slideshow packages. Keep publishing and analytics separate.

Use this skill as a focused creation pipeline for 6-slide TikTok slideshows. Build from shared defaults, an account profile, a campaign brief, and a concrete post folder. Generate the draft copy, image prompts, raw images, final overlaid slides, and an export folder ready for manual upload.

## Architecture

Use this structure:

- `defaults.json` at the repo root for shared technical defaults
- `<account>/profile.json` as the main account file
- `<account>/campaigns/<campaign>/brief.json` for account-level campaign messaging
- `<account>/tiktok/examples.md` for TikTok-specific hooks and examples
- `<account>/tiktok/posts/<YYYY-MM-DD-slideshow-post>/...` for concrete slideshow assets
- `<post>/images/` for generated and final slide images

Do not wrap accounts in an extra `accounts/` folder when the repo only contains `defaults.json` plus account folders. Put account folders directly under the repo root.

Keep business identity out of `defaults.json`. Use `defaults.json` only for global technical defaults. Let `profile.json` override those defaults per account.

Supported image providers currently include:
- `gemini` with models like `gemini-3.1-flash-image-preview`
- `openai` with models like `gpt-image-1`
- `local` for manually supplied images

Use a single `caption.txt` artifact. It should already be short and optimized for TikTok.

Creative generation is agent-first:
- the agent should generate the post idea, prompts, overlay text, and caption
- the scripts should build task payloads and apply/validate the agent output
- API keys are only for image generation

## Workflow

### 1. Initialize a content repo

Use `scripts/init-project.js` to create a working directory for the slideshow project.

### 2. Create only an account

Use `scripts/create-account.js` when the user wants the account skeleton only.

### 3. Create an account + campaign

Use `scripts/create-campaign.js` when the user wants a campaign but does not want a post scaffold yet.

### 4. Create an account + campaign + post

Use `scripts/create-post.js` when the user wants a post folder with starter files.

This creates the post folder and an `images/` subfolder for generated slide assets.

### 5. Draft real post content

Use `scripts/draft-post.js` when the user asks to create a slideshow and expects real prompts, overlay text, and captions rather than placeholders.

This script should produce:
- `prompts.json`
- `texts.json`
- `caption.txt`

This script should not call external text-generation APIs. Instead it should either:
- emit a structured draft task payload the agent can use to generate creative JSON
- or apply a generated draft JSON into `prompts.json`, `texts.json`, and `caption.txt`

Default caption style:
- short and concise
- 1 hook line
- 1 value line
- 1 CTA line
- 3 to 5 hashtags max
- include a simple CTA like `Check link in bio for more.` when relevant

### 6. Generate the raw images

Use `scripts/generate-images.js`.

Pass the post directory to `--output`; the script will write generated files into `<post>/images/` automatically.

Prefer hero-frame + variations when consistency matters. Generate `hero_frame.png` first, then derive the later slides from it.

### 7. Add text overlays

Use `scripts/add-text-overlay.js`.

Pass the post directory to `--input`; the script will read and write image files in `<post>/images/` automatically.

This script uses `@napi-rs/canvas` as the overlay backend.

Keep text horizontally centered. Control vertical placement with `profile.render.overlay` safe-zone settings. Prefer `top-safe` for people-centric slideshows so text stays above the subject's face more often.

### 8. Export a ready-to-publish package

Use `scripts/export-ready-package.js` to create a clean handoff folder containing only the final slide images, caption, package manifest, and a zip when possible.

Use `scripts/build-post-package.js` only if you want a lightweight manifest in-place. Prefer `export-ready-package.js` for a clean manual-upload handoff.

## Guardrails

- Do not promise automatic TikTok posting unless a separate publishing adapter exists.
- Do not mix analytics or monetization logic into the creation pipeline.
- Keep secrets out of prompts and long-lived plain-text files.
- Configure `OPENAI_API_KEY` or `GEMINI_API_KEY` outside project files only when using API image generation.
- Prefer manual publishing after the creative pipeline is stable.
- If the user asks for a new account only, do not scaffold a campaign or post.
- If the user asks for a new campaign only, do not scaffold a post.
- If the user asks for a slideshow/post/carousel, do not stop at scaffolding unless they explicitly asked for scaffolding only; draft actual prompts, overlay text, and captions.
- Respect account voice/profile constraints when drafting. Avoid self-referential phrasing unless the user explicitly wants it.
- Treat each post as a creative angle, not just another copy of the campaign message.
- Before drafting a new post, check the most recent TikTok posts for the whole account and avoid reusing the same angle/copy family unless the user explicitly asks for a variant.
- For image generation, prefer hero-frame + variations over six independent generations whenever subject consistency matters.
- If the user asks for a slideshow but the account, campaign, or offer is ambiguous, stop and ask a short clarifying question before generating assets.
- If there is exactly one obvious account/campaign context already established in the current working tree, reuse it and say so briefly.
- If the user asks for video, explain that this skill currently focuses on slideshow/image-first content.

## What to read when

- For slide formula and hook patterns: `references/slide-structure.md`
- For image prompt guidance: `references/prompting.md`
- For overlay copy and layout rules: `references/text-overlay.md`
- For separating account identity from campaign-specific messaging: `references/account-profiles.md`

## Output convention

Prefer a tree like:

```text
content/
  defaults.json
  human-in-the-loop/
    profile.json
    campaigns/
      campaign-name/
        brief.json
    tiktok/
      examples.md
      posts/
        2026-03-17-slideshow-busy-is-not-progress/
          prompts.json
          texts.json
          caption.txt
          post.json
          images/
            hero_frame.png
            slide1_raw.png
            slide1.png
            ...
          ready-to-publish/
            slide1.png
            ...
            caption.txt
            package-for-mobile.zip
            package.json
```

Use this skill as the creation layer. Publishing, scheduling, and analytics should be separate adapters or later skills.
