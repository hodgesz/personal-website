# Handoff / Ops Notes — jonathanhodges.ai

Operational context for this repo that isn't derivable from the code. No secrets in this file.

## What this is
A clean static site (`index.html` + `styles.css`, images in `assets/images/`) migrated off Gamma.
- Structured content: `content/site-content.md`
- Raw Gamma snapshot (design reference): `archive/gamma-homepage-snapshot-2026-07-19.html`
- Design: body = **Inter**, headings = **Petrona 700**. Palette: accent blue `#007EBD`, navy `#00334d`, light bg `#f2f2f2`/`#fff`, text `#272525`. Light theme. Backgrounds kept clean/solid (no imagery). Scroll-triggered entrance animations via CSS + IntersectionObserver (no framer-motion); respects `prefers-reduced-motion`.

## Deploy (IMPORTANT: not git-connected)
The Cloudflare Pages project is **direct upload**, so a `git push` does NOT deploy the site. Auto-deploy
is off by decision (2026-07-30), so every publish is manual. **Use `./deploy.sh`:**

```bash
./deploy.sh                      # preview deploy of origin/main -- the safe default
./deploy.sh origin/main --production
```

Do NOT run `wrangler pages deploy .` by hand. It uploads the **working directory**, which publishes
uncommitted work-in-progress and every untracked file sitting in the tree. `deploy.sh` exports a
committed ref with `git archive` instead, and strips what must not ship.

**`.gitignore` does not apply to a deploy, and `.assetsignore` does nothing on Pages** — that is a
Workers Assets feature. Verified: a preview deploy with an `.assetsignore` still served `HANDOFF.md`
as `text/markdown`. The only mechanism Pages honours is what is in the upload directory, which is why
the exclusions live in `deploy.sh` rather than in a config file.

This file, `AGENTS.md`, `README.md` and `content/` were world-readable at
`https://jonathanhodges.ai/<file>` until 2026-07-30 for exactly that reason.

`assets/Jonathan_Hodges_VP_Data_AI_Resume_3Page.pdf` is committed and published, but **no committed
`index.html` links it** — the live page's résumé button points at Google Drive, and
`/assets/…Resume_3Page.pdf` has never resolved. The three links to it are in the uncommitted redesign in
this tree. It is committed because that redesign needs it, not because anything was about to 404.

`deploy.sh` refuses to deploy a ref whose `index.html` links the PDF when the archive does not contain
it. It **asserts, and does not repair**: an earlier version copied the file from the working tree, which
would publish an uncommitted draft résumé while reporting a deploy of `origin/main`. Whatever is wrong
there, the fix is a commit, not a copy.

Alternatively on a new machine, `npx wrangler login` (interactive OAuth) instead of the token.

**Cache purge needs a real API token.** The wrangler OAuth token carries `zone (read)`, not
`cache_purge`, so `POST /zones/<id>/purge_cache` returns `Authentication error` with it. Pages serves
with `cache-control: s-maxage=604800`, so a file removed from the origin can stay in the edge cache for
up to 7 days — purge from the dashboard if that matters. A cache-busting query string confirms what the
origin actually holds.

## Hosting / infra facts
- **Cloudflare Pages** project: `personal-website` (preview subdomain: `personal-website-bbg.pages.dev`)
- Custom domains: `jonathanhodges.ai` + `www` — both ACTIVE via proxied CNAMEs
- Cloudflare **account id**: `81e309dce062738de7a5a16196d06f69`
- Cloudflare **zone id**: `a40c3867d982e96743dee5ddd64c4cf8`
- DNS on Cloudflare (nameservers `olof`/`gene`.ns.cloudflare.com)

## Email
- **Inbound**: Cloudflare Email Routing — `me@jonathanhodges.ai` + catch-all → `jonathan.hodges@berkeley.edu` (verified, working)
- **Outbound**: Brevo SMTP; domain authenticated (SPF + DKIM + DMARC in DNS). Berkeley Gmail "Send mail as" `me@jonathanhodges.ai` configured.
- **DMARC** currently `p=none` (monitor). Could tighten to `p=quarantine` later.

## Secrets (NOT in repo — must transfer separately)
- **Deploys authenticate with wrangler OAuth**, not an API token. Credentials live at
  `~/Library/Preferences/.wrangler/config/default.toml` (machine-bound; `npx wrangler login` on a new
  machine). `npx wrangler whoami` confirms the account and scopes.
- The old `/tmp/cf.env` API token is **gone** — `/tmp` is wiped on reboot — and nothing uses it. The
  rotation warning that stood here is therefore moot; the OAuth path never used that token.
- The account and zone ids above are **identifiers, not credentials**: they appear in every dashboard
  URL and cannot be used without an authenticated token.

## Verify locally
```bash
python3 -m http.server 8000
# then open http://localhost:8000/  (or headless-Chrome screenshot to check)
```
