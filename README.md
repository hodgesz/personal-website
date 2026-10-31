# jonathanhodges.ai

Personal website for Jonathan Hodges — a static, single-page applied-AI executive site hosted on Cloudflare Pages.

## Structure

```
.
├── index.html            # the site
├── styles.css            # all styling
├── assets/images/        # all images (portrait, logos, screenshots, etc.)
├── family-planner/       # public OAuth app information/privacy; no household app access
├── content/
│   └── site-content.md   # structured source content (edit here, then update index.html)
└── archive/
    └── gamma-homepage-snapshot-2026-07-19.html   # raw snapshot of the original Gamma site
```

## Local preview

```
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy

Hosted on the Cloudflare Pages Direct Upload project `personal-website`.
A Git push does not deploy this project. See `HANDOFF.md` for the current Wrangler deployment command and infrastructure notes.

## Editing content

Text and links live directly in `index.html`. `content/site-content.md` mirrors the copy
for reference. Images go in `assets/images/`.

## Checks and independent review

GitHub Actions runs static-link, deployment-boundary and offline review-protocol
checks. Independent review uses native Google-account Gemini Argon low; see
[the review and first-use procedure](docs/PR_REVIEW.md). Actions verifies a current
owner-posted receipt and never runs the model. Review setup is separate from
Cloudflare publication; a Git push or merge does not deploy this Direct Upload site.
