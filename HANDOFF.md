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
committed ref with `git archive` instead and uploads only what the site needs.

**`.gitignore` does not apply to a deploy, and `.assetsignore` does nothing on Pages** — that is a
Workers Assets feature. Verified: a preview deploy with an `.assetsignore` still served `HANDOFF.md`
as `text/markdown`. The only mechanism Pages honours is what is in the upload directory, which is why
this lives in `deploy.sh` rather than in a config file.

**The upload set is an allowlist — `SHIP=(index.html styles.css assets)` in `deploy.sh`.** Adding a
top-level file or directory the site needs means adding it there, and the script prints everything it
left behind on every run so an omission is visible. It started as a denylist of files to remove, and the
first file nobody thought to name was `deploy.sh` itself, served at `/deploy.sh` as `application/x-sh`.
A denylist fails by publishing; an allowlist fails by 404.

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


## October 31, 2026: review setup and narrowly authorized Planner information pages

Owner authorizes adding Family Planner public information/privacy pages under this
existing site and Actions/Gemini Argon-low review patterned after JobFinder and
Family Planner. Existing homepage claims and private Planner ingress remain outside
this change. The private claim matrix is absent from this clone; no resume claim
is changed or independently cleared.

Source adds credential-free foundation checks, a trusted-base Gemini receipt
verifier and the reviewed JobFinder transport/offline cases with website identity.
There is no existing workflow/protection at inspection. Follow docs/PR_REVIEW.md
for first installation followed by genuine exact-base verification before strict
required-check activation. No synthetic status, privileged candidate bootstrap
workflow, CodeRabbit or Codex reviewer is introduced.

Initial source tests find the missing workflow, then missing review-instruction
front matter; both are addressed before final verification. Final local verification passes: one-page structure/local links, four synthetic
deployment-boundary cases, shell syntax, and all 204 offline protocol cases. Hosted
CI/Gemini, protection activation and Cloudflare publication must be recorded from
actual results. The new public pages are a subsequent content PR. Linux has no
proven Cloudflare deployment authentication; this is not a deployed-site claim.


## October 31, 2026: initial review infrastructure merged; OAuth information added

PR #4 merged normally at `cbca508efae37a792f6a3bc272c22cd82ab71687`, preserving
reviewed head `d6115deece594ab0b6d7de7561831488411e0dad`. Final-head foundation
41234236159 passes. Native Argon low review 5724680708 covers all 23 immutable
diff records across two complete batches with no findings. Its generation
completed once; the CLI publication step lacked a token environment, so the
validated original receipt/body was posted with the connected GitHub tool. The
posted owner/head/body were read back and compared. No generation was repeated.
All comments/conversations were inspected; initial verifier skip is not gate
evidence. No protection existed or was bypassed, and no Cloudflare deploy occurs.

This content slice adds `family-planner/` with an app homepage, factual privacy and
access/use information plus a local stylesheet. No real household schedule, account,
private Planner origin, credential, signup or application access is exposed. The
existing professional homepage and assets are unchanged. `deploy.sh` adds only this
public directory to its committed-ref upload allowlist. New tests catch forgotten
public-directory packaging, missing links and links to existing unshipped docs.

Use a genuine exact-base review and successful hosted verifier for this separate
content PR before activating strict foundation/gemini-review protection and merging.
Cloudflare still needs actual authenticated deployment access and confirmation that
the committed existing homepage/assets match the current deployment; the Linux
HTTP readback received 403 and must not be described as content equality.
