# Account Profiles

Use account profiles to store account identity and account-level render preferences outside the skill.

## Principle

The skill is the reusable engine.
The account profile is the main account configuration file.
A campaign brief is the message for a specific piece or campaign.
A post folder is the execution layer.

Prefer separate lifecycle steps:

- create account
- create campaign
- create post

This keeps intent clear and avoids generating post scaffolds when the user only asked for account or campaign setup.

## Suggested structure

- `defaults.json`
- `<account-id>/profile.json`
- `<account-id>/examples.md`
- `<account-id>/campaigns/<campaign-id>/brief.json`
- `<account-id>/campaigns/<campaign-id>/posts/<post-id>/...`

## Put in defaults.json

- shared technical defaults
- default language
- default image provider
- default model
- default slide dimensions
- default slide count

## Put in account profile

- account name
- language
- audience
- voice/tone
- style
- overlay style
- visual style
- content pillars
- things to avoid
- offer names and summaries
- render.imageGen overrides
- render.slides overrides

If slideshow consistency is important, describe the visual subject in a way that can anchor a hero frame: clothing family, hair/facial-hair cues, desk setup, and camera angle.

## Put in the campaign brief

- specific angle
- specific offer/message for this post or campaign
- goal
- CTA
- extra notes or constraints

## Put in the post folder

- prompts
- overlay texts
- caption
- generated images
- exported package files
