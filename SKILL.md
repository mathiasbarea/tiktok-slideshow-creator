---
name: shortform-content
description: Generate short-form visual content packages for TikTok, Reels, Shorts, and similar platforms. Use when creating 6-slide image carousels/slideshows, writing hooks and overlay text, generating consistent image sets, adding text overlays, or exporting a ready-to-post package without relying on a posting platform. Best for early-stage shortform content pipelines where creation matters more than publishing or analytics.
metadata: {"openclaw":{"requires":{"env":["OPENAI_API_KEY"]},"primaryEnv":"OPENAI_API_KEY"}}
---

# Shortform Content

Generate short-form slideshow packages first. Keep publishing and analytics separate.

This skill is for building repeatable visual posts with an account-centric hierarchy: defaults -> account profile -> campaign brief -> post package -> images -> text overlays -> export package. Prefer it when the user wants to create content assets, test formats, or build a reusable content pipeline without tying the workflow to Postiz, TikTok APIs, or analytics tooling.

## Architecture

Use this split:

- `defaults.json` at the repo root for shared technical defaults
- `<account>/profile.json` as the single account file
- `<account>/campaigns/<campaign>/brief.json` for campaign-specific messaging
- `<account>/campaigns/<campaign>/posts/<post>/...` for concrete post assets
- `<post>/images/` for generated and final slide images

Do not wrap accounts in an extra `accounts/` folder when the repo only contains `defaults.json` plus account folders. Put account folders directly under the repo root.

`profile.json` should contain both:

1. account identity
2. account-level render overrides

Supported image providers currently include:
- `gemini` with models like `gemini-3.1-flash-image-preview` (default)
- `openai` with models like `gpt-image-1`
- `local` for manually supplied images

That means language, voice, tone, style, overlay style, audience, visual identity, provider, model, slide count, and slide size can all live in one account file.

Keep business identity out of `defaults.json`. Use `defaults.json` only for global technical defaults. Let `profile.json` overwrite those defaults per account.

## Workflow

### 1. Initialize a content repo

Use `scripts/init-project.js` to create a working directory for an account-centric content repo.

### 2. Create only an account

Use `scripts/create-account.js` when the user wants the account skeleton only.

### 3. Create an account + campaign

Use `scripts/create-campaign.js` when the user wants a campaign but does not want a post scaffold yet.

### 4. Create an account + campaign + post

Use `scripts/create-post.js` when the user wants a post folder with starter files.

This creates the post folder and an `images/` subfolder for generated slide assets.

### 5. Draft real post content

Use `scripts/draft-post.js` when the user asks to create a slideshow/post and expects real prompts, overlay text, and a caption rather than empty placeholders.

### 6. Generate the raw images

Use `scripts/generate-images.js`.

Pass the post directory to `--output`; the script will write generated files into `<post>/images/` automatically.

Prefer hero-frame + variations when consistency matters. This generates a single `hero_frame.png` first, then derives later slides from it.

### 7. Add text overlays

Use `scripts/add-text-overlay.js`.

Pass the post directory to `--input`; the script will read and write image files in `<post>/images/` automatically.

This script uses `@napi-rs/canvas` as the overlay backend, chosen over `node-canvas` for better portability in a distributed skill.

Keep text horizontally centered. Control vertical placement with `profile.render.overlay` safe-zone settings. Prefer `top-safe` for people-centric slideshows so text stays above the subject's face more often.

### 8. Export a ready-to-post package

Use `scripts/export-ready-package.js` to create a clean handoff folder containing only the final slide images, caption, and package manifest.

Use `scripts/build-post-package.js` only if you want a lightweight manifest in-place. Prefer `export-ready-package.js` for manual publishing handoff.

## Guardrails

- Do not promise automatic TikTok posting unless a separate publishing adapter exists.
- Do not mix analytics or monetization logic into the creation pipeline.
- Keep secrets out of prompts and long-lived plain-text files.
- Configure `OPENAI_API_KEY` via `skills.entries.shortform-content.apiKey` or `skills.entries.shortform-content.env.OPENAI_API_KEY` in `~/.openclaw/openclaw.json`, not in project files.
- Prefer manual publishing after the creative pipeline is stable.
- If the user asks for a new account only, do not scaffold a campaign or post.
- If the user asks for a new campaign only, do not scaffold a post.
- If the user asks for a slideshow/post/carousel, do not stop at scaffolding unless they explicitly asked for scaffolding only; draft actual prompts, overlay text, and caption.
- Respect account voice/profile constraints when drafting. Avoid self-referential phrasing that makes the brand sound like it discovered itself unless the user explicitly wants that style.
- Treat each post as a creative angle, not just another copy of the campaign message. Reuse the campaign, not the exact overlays.
- Before drafting a new post, check sibling posts in the same campaign and avoid reusing the same angle/copy family unless the user explicitly asks for a variant of an existing post.
- For image generation, prefer hero-frame + variations over six independent generations whenever subject consistency matters.
- If the user asks for a slideshow but the account, campaign, or offer is ambiguous, stop and ask a short clarifying question before generating assets.
- If there is exactly one obvious account/campaign context already established in the current working tree, reuse it and say so briefly.
- If the user asks for video, explain that this skill currently focuses on slideshow/image-first content and can later feed a video pipeline.

## What to read when

- For slide formula and hook patterns: `references/slide-structure.md`
- For image prompt guidance: `references/prompting.md`
- For overlay copy and layout rules: `references/text-overlay.md`
- For separating account identity from campaign-specific messaging: `references/account-profiles.md`

## Output convention

Prefer a tree like:

```text
content/shortform-content/
  defaults.json
  human-in-the-loop/
    profile.json
    examples.md
    campaigns/
      results-as-a-service-vs-traditional-agencies/
        brief.json
        posts/
          results-as-a-service-vs-traditional-agencies-v2/
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
              package.json
```

Use this skill as the creation layer. Publishing, scheduling, and analytics should be separate adapters or later skills.
raw.png
              slide1.png
              ...
            ready-to-publish/
              slide1.png
              ...
              caption.txt
              package.json
```

Use this skill as the creation layer. Publishing, scheduling, and analytics should be separate adapters or later skills.
