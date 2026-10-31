# Independent Gemini review

The owner selected native Google-account Antigravity `gemini-4-argon-low`, explicit
low effort, on October 31, 2026. Codex implements/tests; Codex and CodeRabbit are
not independent reviewers. No API credential, billing fallback or automatic model
retry is authorized. The transport and 204 offline protocol cases derive from
JobFinder commit `a478cdf934e093418c702c6e2fa23fbe7e7040f4`, with repository and diff
schema identity changed explicitly for this website.

## Review and evidence

Use Node 22.22.2 and a separately pinned Antigravity 1.4.2 executable. The copied
installer verifies official pinned bytes without running installer/shell setup.
Reuse existing native Google sign-in; never export credentials to Actions.

```sh
scripts/agy-pr-review.sh --dry-run --out /private/fresh-input PR_NUMBER
scripts/agy-pr-review.sh --model gemini-4-argon-low --effort low \
  --agy /absolute/pinned/agy --out /private/fresh-result PR_NUMBER
```

Use a fresh output directory. The normal command publishes a formal owner review
only after all bounded batches and fresh PR identity checks succeed. Local-only,
missing-auth, stale, failed, partial, finding-bearing and skipped results cannot
clear review. Inspect every batch, returned model, coverage, review body and
finding before readiness. Never retry a dispatched model failure automatically.

Scope is the complete immutable unified diff with 20 context lines, rather than
unchanged whole source. Numbered segments retain every diff byte. Denied tools and
an empty read-only sandbox keep candidate commands, source instructions, GitHub
credentials and the actual user home out of model context. The model never runs
tests. The posted receipt is the trusted owner's attestation, not cryptographic
proof of model origin. Full input, completion and usage evidence stay private.

## Actions and bootstrap

Foundation runs static/local-link checks, synthetic deployment-boundary tests,
shell syntax and offline protocol cases without model/account credentials.
Verification runs only on trusted-base `pull_request_target` or main-only manual
dispatch. Candidate checkout is Git data; candidate tests/hooks never execute in
the status-writing job. All Actions uses are full-SHA pinned with persisted
checkout credentials disabled. After posting, editing or dismissing a review,
dispatch Website CI on main with its PR number. Inspect the actual `gemini-review`
result; no instantaneous dismissal revocation is claimed.

This repository initially has no workflow or protection ruleset. Install the
review infrastructure in a first PR with genuine final-head foundation and a
complete published Argon-low review, using an explicitly frozen local control
commit after coordinator source/provenance checks. This is an initial installation,
not a passing trusted-base verifier claim. No existing required gate is removed.
The first merge does not deploy the website.

Then use a separate content PR to prove normal exact-base receipt verification.
Only after genuine success, activate strict `foundation` and `gemini-review`
requirements from GitHub Actions, required PRs/resolved conversations, blocked
force pushes/deletion, zero human self-approval requirement and no bypass actors.
Inspect all required checks and feedback before normal protected merge. Never
post a synthetic success to bridge installation. The inherited reference
bootstrap-validation module/tests are retained and pinned for compatibility;
there is no bootstrap workflow, permit activation or candidate-CI override here.
Do not use the reference repo's historical workflow/PR identifiers for activation.

Deterministic commands:

```sh
python3 scripts/check-site.py
python3 -m unittest discover -s tests -p 'test_*.py'
bash -n deploy.sh
node --test tests/review/*.test.mjs
```

Actual source/CI/review/protection/deployment evidence belongs in HANDOFF, with
incomplete boundaries kept explicit. CODEOWNERS assigns all paths to `@hodgesz`.
