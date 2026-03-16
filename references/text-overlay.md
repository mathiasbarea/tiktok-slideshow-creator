# Text Overlay Rules

This skill uses an opinionated slideshow overlay layout inspired by the practical settings seen in Larry.

## Layout defaults

- keep text horizontally centered
- font size: ~6.2% to 6.5% of image width
- outline width: ~15% of font size
- max text width: ~72% to 75% of image width
- vertical placement should come from safe-zone presets, not fixed middle placement
- for people-centric slideshows, prefer a `top-safe` overlay zone so text stays above the face more often

## Copy rules

- reactions beat labels
- 4 to 6 words per line is ideal
- use manual `\\n` line breaks whenever possible
- 3 to 4 lines is a good target
- avoid emoji in overlay text

## Better

```json
[
  "I showed my landlord\\nwhat AI thinks our\\nkitchen should look like",
  "She said I can't\\nchange anything so\\nI tried this"
]
```

## Worse

```json
[
  "Modern minimalist kitchen design",
  "Affordable redesign options"
]
```

The goal is to be readable at a glance while scrolling.
