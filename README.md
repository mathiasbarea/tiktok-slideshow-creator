
# 🎬 TikTok Slideshow Creator

Create TikTok slideshow packages with scripts for drafting copy, generating images, adding text overlays, and exporting a ready-to-publish folder.

---

## 📖 Overview

TikTok Slideshow Creator is a skill focused on the **creation** side of image-first TikTok slideshows.

It helps build a repeatable workflow around:

- account profiles
- campaign briefs
- post folders
- prompt drafting
- image generation
- text overlays
- final export for manual upload

> **Note:** It does **not** handle posting, scheduling, analytics, or social delivery.

---

## 🎯 Who this is for

Use this skill if you want to:

- generate TikTok carousel/slideshow posts
- keep brand/account settings separate from campaign briefs
- reuse a consistent folder structure across multiple posts
- generate images with OpenAI, Gemini, or local files
- export a clean package ready for manual TikTok upload

---

## 📋 Requirements

- Node.js 18+
- `npm`
- An API key only if you want API-based image generation:
  - `OPENAI_API_KEY` for `openai`
  - `GEMINI_API_KEY` for `gemini`

---

## 🗂️ Repository structure

```text
content/tiktok-slideshows/
  defaults.json
  <account>/
    profile.json
    examples.md
    campaigns/
      <campaign>/
        brief.json
        posts/
          <post>/
            prompts.json
            texts.json
            caption.txt
            post.json
            images/
            ready-to-publish/

```

----------

## 🚀 Install

### 1. Provide your AI agent with this GitHub URL and ask it to install it for you.

```
https://github.com/mathiasbarea/tiktok-slideshow-creator
```

**If you are using OpenClaw, you can choose between two scopes:**

-   **Global Installation:**  `.openclaw/skills`  (available to all agents).
-   **Workspace Installation:**  `<workspace>/skills`  (restricted to a specific agent).


### 2. Install dependencies

From inside the skill folder:



```
npm install
```

Main dependency:

-   `@napi-rs/canvas` Used to add text overlays on top of slide images.
    

----------

## ⚙️ Configuration

> Set API keys outside project files only when using API image generation.

### Option 1: Environment variables

```
OPENAI_API_KEY=...
GEMINI_API_KEY=...
```

You only need the key for the image provider you actually use.

### Option 2 (OpenClaw only): OpenClaw config

Configure environment variables for this skill in your OpenClaw config under the skill entry for `tiktok-slideshow-creator`.

Should look something like this:
```
"skills": {
  "tiktok-slideshow-creator": {
    "enabled": true,
    "env": {
      "OPENAI_API_KEY": "YOUR-API-KEY-HERE",
      "GEMINI_API_KEY": "YOUR-API-KEY-HERE"
    }
  }
}
```
----------

## 🖼️ Supported image providers

-   `gemini`
    
-   `openai`
    
-   `local`
    

Use `local` when you want to place images manually instead of calling an image API.

The skill is now agent-first for creative generation:

- the agent generates post ideas, prompts, overlay text, and `caption.txt`
- the scripts build the prompt payloads and validate/apply the generated JSON
- API keys are only needed for image generation

----------

## ⚡ Quick start

Once the skill is installed and you have run `npm install`, ask your agent to use the `tiktok-slideshow-creator` skill and set up your first workflow.

A simple way to start is:

1.  Ask the agent to add an account for your TikTok brand or business.
    
    -   Example: your TikTok account name, brand name, or business identity.
        
2.  Ask the agent to create a campaign for that account.
    
    -   Example: `Why electric cars are better long term`
        
    -   The campaign should represent the message or angle you want to turn into multiple posts.
        
3.  Ask the agent to create the first post for that account and campaign.
    
    -   The agent should draft the prompts, overlay text, captions, and post structure.
        
4.  Once you're happy with the generated post, ask the agent to generate the slideshow images, apply overlays, and export the final package.
    

**Example requests you can give your agent:**

> -   `Use the tiktok-slideshow-creator skill and create an account for my brand "GreenDrive".`
>     
> -   `Create a campaign called "Why electric cars are better long term" for that account.`
>     
> -   `Now create the first post for that campaign.`
>     
> -   `Generate the slideshow images, add overlays, and export the final ready-to-publish package.`
>     

If your account, campaign, or offer is still unclear, the agent should ask a short clarifying question before generating assets.

----------

## 💻 Optional CLI workflow

If you want to run the scripts directly, the basic flow is:

### 1. Initialize the project root


```
node scripts/init-project.js --dir content/tiktok-slideshows
```

### 2. Create an account


```
node scripts/create-account.js --dir content/tiktok-slideshows --account my-brand
```

### 3. Create a campaign


```
node scripts/create-campaign.js --dir content/tiktok-slideshows --account my-brand --campaign launch-angle
```

### 4. Create a post scaffold


```
node scripts/create-post.js --dir content/tiktok-slideshows --account my-brand --campaign launch-angle --title "First slideshow"
```

### 4. Generate a post idea

```bash
node scripts/generate-post-idea.js --content-root content/tiktok-slideshow-creator --account my-brand --campaign launch-angle
```

Without additional input, this now returns the JSON task payload the agent or workflow should send to OpenClaw to generate a fresh idea.

To validate a generated idea JSON:

```bash
node scripts/generate-post-idea.js --content-root content/tiktok-slideshow-creator --account my-brand --campaign launch-angle --idea-file idea.json
```

### 5. Draft the post copy

```
node scripts/draft-post.js --defaults content/tiktok-slideshows/defaults.json --profile content/tiktok-slideshows/my-brand/profile.json --brief <campaign-dir>/brief.json --post-dir <post-dir>
```

Without additional input, this now returns the JSON task payload the agent or workflow should send to OpenClaw to generate the full draft package.

To apply an agent-generated draft JSON into the post folder:

```bash
node scripts/draft-post.js --defaults content/tiktok-slideshows/defaults.json --profile content/tiktok-slideshows/my-brand/profile.json --brief <campaign-dir>/brief.json --post-dir <post-dir> --draft-file draft.json
```

This writes `prompts.json`, `texts.json`, and a short `caption.txt`.

### 6. Generate images

```
node scripts/generate-images.js --defaults content/tiktok-slideshows/defaults.json --profile content/tiktok-slideshows/my-brand/profile.json --output <post-dir> --prompts <post-dir>/prompts.json
```

### 7. Add overlays

```
node scripts/add-text-overlay.js --input <post-dir> --texts <post-dir>/texts.json --profile content/tiktok-slideshows/my-brand/profile.json
```

### 8. Export the final package

```
node scripts/export-ready-package.js --dir <post-dir>
```

This creates `ready-to-publish/` with:

-   `slide1.png` to `slide6.png`
    
-   `caption.txt`
    
-   `package.json`
    
-   `package-for-mobile.zip` when zip creation is available
   
