# Handoff / Ops Notes — jonathanhodges.ai

Operational context for this repo that isn't derivable from the code. No secrets in this file.

## What this is
A clean static site (`index.html` + `styles.css`, images in `assets/images/`) migrated off Gamma.
- Structured content: `content/site-content.md`
- Raw Gamma snapshot (design reference): `archive/gamma-homepage-snapshot-2026-07-19.html`
- Design: body = **Inter**, headings = **Petrona 700**. Palette: accent blue `#007EBD`, navy `#00334d`, light bg `#f2f2f2`/`#fff`, text `#272525`. Light theme. Backgrounds kept clean/solid (no imagery). Scroll-triggered entrance animations via CSS + IntersectionObserver (no framer-motion); respects `prefers-reduced-motion`.

## Deploy (IMPORTANT: not git-connected)
The Cloudflare Pages project is **direct upload**, so a `git push` does NOT deploy the site. Deploy manually:

```bash
export CLOUDFLARE_API_TOKEN=<token>   # not in repo; see "Secrets" below
npx wrangler pages deploy . --project-name=personal-website --branch=main --commit-dirty=true
```

Alternatively on a new machine, `npx wrangler login` (interactive OAuth) instead of the token.

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
- **Cloudflare API token**: previously stored machine-locally at `/tmp/cf.env` (does not travel; `/tmp` is wiped). Copy it securely to the other machine, or use `wrangler login`.
- ⚠️ The token was exposed in a prior chat transcript — **consider rotating it** in the Cloudflare dashboard.

## Verify locally
```bash
python3 -m http.server 8000
# then open http://localhost:8000/  (or headless-Chrome screenshot to check)
```
