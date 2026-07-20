# jonathanhodges.ai

Personal website for Jonathan Hodges — a static, single-page portfolio site.
Migrated from Gamma to a hand-editable static site hosted on Cloudflare Pages.

## Structure

```
.
├── index.html            # the site
├── styles.css            # all styling
├── assets/images/        # all images (portrait, logos, screenshots, etc.)
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

Hosted on **Cloudflare Pages**, connected to this GitHub repo (`hodgesz/personal-website`).
Every push to `main` triggers a deploy.

- Framework preset: **None**
- Build command: *(none)*
- Output directory: **/** (repo root)

## Editing content

Text and links live directly in `index.html`. `content/site-content.md` mirrors the copy
for reference. Images go in `assets/images/`.
