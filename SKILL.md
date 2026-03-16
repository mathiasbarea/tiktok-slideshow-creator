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

Do not wrap accounts in an extra `accounts/` folder when the repo only contains `defaults.json` plus account folders. Put account folders directly under the repo root.

`profile.json` should contain both:

1. account identity
2. account-level render overrides

That means language, voice, tone, style, overlay style, audience, visual identity, provider, model, slide count, and slide size can all live in one account file.

Keep business identity out of `defaults.json`. Use `defaults.json` only for global technical defaults. Let `profile.json` overwrite those defaults per account.

## Language handling

`defaults.json` should include a default `language`.

`profile.json` can override it with an account-specific `language`.

When generating images or other language-sensitive assets, resolve language in this order:

1. `profile.json`
2. `defaults.json`

Treat language as a real part of the effective configuration, not a decorative field.

## Account onboarding rule

When creating a brand-new account, do not pretend to know the account identity. If the user has not supplied enough context, ask a short onboarding set of questions first, then write `profile.json`.

At minimum, try to collect:

- language
- account/topic description
- audience
- voice.tone
- voice.style
- voice.overlayStyle
- visual.style
- one or more offerings

Provide examples when asking for tone/style/overlay style, and allow the user to write their own option instead of picking a preset.

## Workflow

### 1. Initialize a content repo

Use `scripts/init-project.js` to create a working directory for an account-centric content repo.

### 2. Create only an account

Use `scripts/create-account.js` when the user wants the account skeleton only.

Example:

```bash
node {baseDir}/scripts/create-account.js --dir content/shortform-content --account human-in-the-loop
```

This creates:

- `<account>/profile.json`
- `<account>/examples.md`

### 3. Create an account + campaign

Use `scripts/create-campaign.js` when the user wants a campaign but does not want a post scaffold yet.

Example:

```bash
node {baseDir}/scripts/create-campaign.js --dir content/shortform-content --account human-in-the-loop --campaign results-as-a-service-vs-traditional-agencies --title "Results as a Service vs Traditional Agencies" --offer "Results as a Service" --cta "See how Results as a Service works"
```

This creates:

- `<account>/profile.json` if missing
- `<account>/examples.md` if missing
- `<account>/campaigns/<campaign>/brief.json`

### 4. Create an account + campaign + post

Use `scripts/create-post.js` when the user explicitly wants a post scaffold.

Example:

```bash
node {baseDir}/scripts/create-post.js --dir content/shortform-content --account human-in-the-loop --campaign results-as-a-service-vs-traditional-agencies --title "Results as a Service vs Traditional Agencies" --offer "Results as a Service" --cta "See how Results as a Service works"
```

This creates the account skeleton if missing, ensures the campaign exists, and creates a post scaffold under `posts/`.

### 5. Generate the raw images

Use `scripts/generate-images.js`.

### 6. Add text overlays

Use `scripts/add-text-overlay.js`.

This script uses `@napi-rs/canvas` as the overlay backend, chosen over `node-canvas` for better portability in a distributed skill.

Keep text horizontally centered. Control vertical placement with `profile.render.overlay` safe-zone settings. Prefer `top-safe` for people-centric slideshows so text stays above the subject's face more often.

Example:

```bash
node {baseDir}/scripts/add-text-overlay.js --input <post-dir> --texts <post-dir>/texts.json --profile content/shortform-content/human-in-the-loop/profile.json
```

### 7. Export a ready-to-post package

Use `scripts/export-ready-package.js` to create a clean handoff folder containing only the final slide images, caption, and package manifest.

Example:

```bash
node {baseDir}/scripts/export-ready-package.js --dir content/shortform-content/human-in-the-loop/campaigns/results-as-a-service-vs-traditional-agencies/posts/results-as-a-service-vs-traditional-agencies-v2
```

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
          2026-03-16-results-as-a-service-vs-traditional-agencies/
            prompts.json
            texts.json
            caption.txt
            slide1_raw.png
            slide1.png
            texts.used.json
            package.json
```

Use this skill as the creation layer. Publishing, scheduling, and analytics should be separate adapters or later skills.
`
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
          2026-03-16-results-as-a-service-vs-traditional-agencies/
            prompts.json
            texts.json
            caption.txt
            slide1_raw.png
            slide1.png
            texts.used.json
            package.json
```

Use this skill as the creation layer. Publishing, scheduling, and analytics should be separate adapters or later skills.
he creation layer. Publishing, scheduling, and analytics should be separate adapters or later skills.
`
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
          2026-03-16-results-as-a-service-vs-traditional-agencies/
            prompts.json
            texts.json
            caption.txt
            slide1_raw.png
            slide1.png
            texts.used.json
            package.json
```

Use this skill as the creation layer. Publishing, scheduling, and analytics should be separate adapters or later skills.
