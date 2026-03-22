# Visual Templates

Visual templates are the visual/layout layer for slideshow posts.

- `templateFamily` remains editorial.
- `visualTemplateId` selects the concrete layout pack.
- campaigns choose the default template in `campaigns/<campaign>/brief.json`
- posts inherit that value into `post.json`, but can override it if needed

Use visual templates when the slideshow needs fixed composition, brand assets, slot-aware text, or static closing slides.

## Template pack location

Real template packs should live with content, not inside the skill:

```text
<content-root>/
  <account>/
    templates/
      <visualTemplateId>/
        manifest.json
        slides/
          1.png
          2.png
          ...
        examples/
          1.png
          2.png
          ...
```

Optional shared packs can live here:

```text
<content-root>/
  _shared/
    templates/
      <visualTemplateId>/
```

Resolution order:

1. `content/<account>/templates/<visualTemplateId>/`
2. `content/_shared/templates/<visualTemplateId>/`

The skill should treat the content repo as the source of truth for real packs.

## Campaign and post wiring

Campaign brief:

```json
{
  "title": "Production-ready AI workflows",
  "coreOffer": "OpenClaw implementation",
  "visualTemplateId": "openclaw-multi-agent"
}
```

Post JSON:

```json
{
  "campaignId": "production-ready-ai-workflows",
  "postSlug": "2026-03-22-slideshow-openclaw-multi-agent",
  "templateFamily": "process-overload",
  "visualTemplateId": "openclaw-multi-agent"
}
```

## Manifest shape

Each pack must define a `manifest.json`.

Top-level fields:

- `id`: template id, usually matching the folder name
- `name`: human-readable label
- `description`: short description of the pack
- `renderMode`: currently `template-pack` for local asset-based composition
- `canvas.width`
- `canvas.height`
- `slides`: ordered slide definitions

Minimal example:

```json
{
  "id": "openclaw-multi-agent",
  "name": "OpenClaw Multi-Agent Architecture",
  "description": "Layout-first explainer template pack",
  "renderMode": "template-pack",
  "canvas": {
    "width": 1080,
    "height": 1920
  },
  "slides": [
    {
      "index": 1,
      "asset": "slides/1.png",
      "slots": [
        {
          "name": "headline",
          "placeholder": "Main headline",
          "x": 72,
          "y": 253,
          "width": 886,
          "height": 88,
          "fontSize": 54,
          "fontFamily": "Arial Bold",
          "fill": "#111111",
          "align": "center",
          "valign": "middle",
          "maxLines": 2
        }
      ]
    },
    {
      "index": 6,
      "asset": "slides/6.png",
      "staticFinal": true,
      "slots": []
    }
  ]
}
```

## Slide fields

Each slide object supports:

- `index`: 1-based slide number
- `asset`: relative path to the base image used for `slideN_raw.png`
- `staticFinal`: optional boolean for slides that should remain unchanged
- `slots`: editable text slots for that slide

Notes:

- `asset` is required for every slide in a `template-pack`
- a static closing slide should still define its asset
- a static slide should usually use `slots: []`
- the current pipeline copies static slides as-is during overlay composition

## Slot fields

Each slot describes where and how text should render:

- `name`: key expected in `texts.json`
- `placeholder`: helper text for scaffolding and prompt context
- `x`
- `y`
- `width`
- `height`
- `fontSize`
- `fontFamily`
- `fill`
- `align`: `left`, `center`, or `right`
- `valign`: `top`, `middle`, or `bottom`
- `maxLines`
- optional `fontWeight`
- optional `lineHeight`
- optional `stroke`
- optional `strokeWidth`
- optional `minFontSize`

Coordinates are authored against the template canvas, typically `1080x1920`. The renderer scales them to the actual slide size.

## Draft contract when a template is active

When a post uses a template pack, `texts.json` is no longer a plain string array. It becomes an array of per-slide objects keyed by slot name.

Example:

```json
[
  {
    "headline": "OpenClaw Multi-Agent",
    "subheadline": "Architecture",
    "leftLabel": "Main Agent",
    "lowerLeftLabel": "Peer Agents",
    "rightLabel": "Sub Agents"
  },
  {
    "headline": "Main Agent",
    "subheadline": "Single entry point",
    "body": "Understands intent.\n\nChooses the right worker.\n\nReports back when done."
  },
  {},
  {},
  {},
  {}
]
```

Rules:

- the array length must match the number of slides in the manifest
- each non-static slide must return exactly the slot names declared in the manifest
- static slides with no editable slots must return `{}`
- extra keys should be rejected
- missing required slot text should be rejected

## How the pipeline uses the pack

`create-post.js`

- scaffolds `texts.json` from manifest slot placeholders
- stores `visualTemplateId` in `post.json`

`draft-post.js`

- tells the agent which editable slots exist on each slide
- validates the returned `texts` objects against the manifest

`generate-images.js`

- for `template-pack`, copies slide assets into `images/slideN_raw.png`
- can skip provider calls entirely
- should still create `hero_frame.png` for compatibility with the rest of the pipeline

`add-text-overlay.js`

- renders text into the manifest-defined slots
- copies static slides unchanged

## Design guidance

- use visual templates for composition, not for editorial freshness
- keep `templateFamily` and `visualTemplateId` separate
- prefer one clear template pack per campaign instead of overloading a single pack with too many unrelated variants
- keep closing CTA slides static when the design really is fixed
- use `examples/` for human reference, not as pipeline input

## Current constraint

This system currently supports local asset-based template packs best. Mixed packs that combine fixed assets with provider-generated imagery are possible later, but they should keep the same manifest-based contract.
