# Notes for agents working in this repo

Read this before changing anything. Codex implements and tests; independent review uses native
Google-account Gemini `gemini-4-argon-low` with explicit low effort. Codex and CodeRabbit are not
reviewers. See [the review procedure](docs/PR_REVIEW.md).

This is a **public** repo serving `jonathanhodges.ai`. A wrong claim or a broken layout here is
visible to recruiters and hiring managers, which is the whole audience.

## What this is

A hand-written static single-page site: `index.html` and `styles.css`, plus images. No build step, no
framework, no bundler, no package manager. It was migrated off Gamma (a slide/site builder) to plain
HTML.

## Running things

- Preview: `python3 -m http.server 8000`, then open `http://localhost:8000`.
- Build: **there is none.** Checks: `python3 scripts/check-site.py`,
  `python3 -m unittest discover -s tests -p 'test_*.py'`, `bash -n deploy.sh`, and
  `node --test tests/review/*.test.mjs` (Node 22.22.2). No formatter config; match surrounding style.
- Deploy: use `./deploy.sh origin/main` for preview or `./deploy.sh origin/main --production`
  after review and current deployment checks. Never upload the working directory directly.

## Things that look like bugs and are not

- **`git push` does not deploy.** Cloudflare Pages here is **Direct Upload**, not the Git
  integration, so merging a PR changes nothing on the live site until someone runs `wrangler pages
  deploy`. The absence of a deploy workflow is the design, not an oversight.
- **`archive/gamma-homepage-snapshot-*.html` is a vendored design reference** — 340K of minified
  Next.js output from Gamma, kept for provenance. Never lint, format, refactor or "fix" it.
  `index.html` was hand-authored *from* it; nothing generates one from the other.
- **`content/*.md` is not a source of truth for the page.** There is no static site generator. The
  copy lives directly in `index.html`; the markdown mirrors it for reference and will drift.
- **Empty-looking `src`/build directories do not exist here.** If you are looking for where the real
  code is, it is the two files in the root.

## Invariants worth knowing before judging a change

- **`content/claim-matrix.md` governs every résumé number on the page.** It fixes the approved public
  wording for each metric (years of experience, org size, budget, patent count, and so on) plus the
  NDA and customer-naming boundaries. Any edit that changes a number or a claim in `index.html` must
  match the matrix. **This is the highest-value review check in this repo** — a claim that overstates
  is a professional and legal problem, not a cosmetic one.

  Note that the matrix is **untracked** (only `content/site-content.md` is committed), so it exists on
  the author's machine and not in a clone or in CI. A reviewer that cannot find the file cannot make
  this check, and should say so rather than approving the numbers by default.
- **Cache-busting is manual**: `<link rel="stylesheet" href="/styles.css?v=N" />`. Editing
  `styles.css` without bumping `?v=` ships a change that returning visitors will not see. Easy to
  miss and a real defect class.
- **CSS must degrade without JavaScript.** This bit once: `.reveal { opacity: 0 }` was
  unconditional and only JS added `is-visible`, so with JS blocked 87% of the body text was
  invisible — measured, not theoretical. Any "hide it, then reveal it with script" pattern needs a
  `<noscript>` fallback or a CSS-only end state. A `prefers-reduced-motion` guard does **not** cover
  the JS-absent case, because it still needs JS to run.
- The inline `<script>` model-routing simulator uses **illustrative** hardcoded model names and
  per-token prices. They are marketing figures, not a live pricing integration — do not "correct"
  them against real API pricing, but do expect them to date.

## Repo hygiene

`HANDOFF.md` records Cloudflare account and zone ids and operational notes. No secrets are committed
and `.wrangler/` is gitignored local state. `assets/` holds committed binaries (~9M of images and a
résumé PDF) — do not reformat or "optimise" them as part of an unrelated change.

**`HANDOFF.md` describes intent, not the tree — trust the code.** It says the entrance animations
"respect `prefers-reduced-motion`", and on `main` the tracked `index.html` has no such guard and no
`<noscript>`. That gap is how the 87%-hidden bug above went unnoticed for as long as it did: the
documentation asserted a fallback that was never implemented, so anyone checking the docs concluded
the case was handled. Treat a claim in `HANDOFF.md` as something to verify, and **report the
mismatch** rather than assuming the doc is the newer of the two.

**Deployment is separate from merge.** On October 31 the owner authorizes adding public Family
Planner information/privacy pages to this existing website and establishing Actions/Gemini review.
This narrow addition must preserve the existing homepage, resume facts and live site assets. It does
not authorize an unrelated brand-positioning redesign or exposure of the private Planner service.
Verify source versus actual deployed content before any full-site upload; preserve work absent from
this clone. Missing Cloudflare authority is an access boundary, not successful deployment.

Use non-draft PRs. Require genuine final-head foundation and complete Gemini receipt/coverage with
no unresolved findings; do not restore a Codex hook or fabricate a status. After initial reviewer
installation, normal verification executes trusted base code only. Required-check activation must
follow an actual successful current-head verifier run. Preserve history and existing protections.
Do not commit credentials, private household data or operator evidence.
