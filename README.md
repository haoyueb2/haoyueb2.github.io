# haoyueb2.github.io

This repository contains a standalone Astro blog for GitHub Pages.

## Run locally

```bash
cd /Users/haoyuebai/Dev/haoyueb2.github.io
npm install
npm run dev
```

## Publish

1. In GitHub repository settings, enable Pages with `GitHub Actions` as the source.
2. Push to `main`.

## Content model

- Chinese posts: `src/content/blog/zh/*.md`
- English posts: `src/content/blog/en/*.md`
- Required frontmatter:
  - `title`
  - `description`
  - `date`
  - `tags`
  - `draft`
  - `translationKey`

Use the same `translationKey` to connect Chinese and English versions of the same article.
