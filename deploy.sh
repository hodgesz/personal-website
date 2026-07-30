#!/bin/bash
#
# Deploy the site to Cloudflare Pages from a clean export of a committed ref.
#
# Two problems this exists to solve, both of which have already happened:
#
# 1. `wrangler pages deploy .` uploads the WORKING DIRECTORY. With uncommitted work in the tree that
#    publishes work-in-progress; with untracked files it publishes those too. `.gitignore` does not
#    apply to a deploy, and `.assetsignore` is a Workers Assets feature that Pages ignores -- verified
#    on a preview deploy, where HANDOFF.md was still served as text/markdown with the file present.
#    The only mechanism Pages honours is what is in the directory, so this exports with `git archive`
#    and deletes what must not ship.
#
# 2. Repo docs were public. HANDOFF.md (which carries the Cloudflare account and zone ids), AGENTS.md,
#    README.md and content/*.md were all live at https://jonathanhodges.ai/<file> from earlier
#    deploys. Nothing in index.html references them.
#
# Usage: ./deploy.sh [ref] [--production]
#   ref defaults to origin/main. Without --production it deploys to a preview branch, which is the
#   safe default: production is the recruiter-facing site.

set -euo pipefail

ref="${1:-origin/main}"
case "${2:-}" in
--production) branch="main" ;;
"") branch="preview-$(git rev-parse --short "$ref")" ;;
*)
	echo "usage: $0 [ref] [--production]" >&2
	exit 2
	;;
esac

root="$(git rev-parse --show-toplevel)"
cd "$root"

if ! git rev-parse --verify --quiet "$ref" >/dev/null; then
	echo "deploy: '$ref' is not a ref this clone knows -- fetch first?" >&2
	exit 1
fi

# A remote-tracking ref only moves on fetch, so `origin/main` is whatever this clone last heard about --
# which for the default invocation is the difference between publishing what is on main and publishing a
# stale copy of it while reporting success. This clone sat three commits behind for days, so that is not
# hypothetical. Comparing against the remote is one network call, and the answer is worth it.
case "$ref" in
origin/*)
	remote_branch="${ref#origin/}"
	if remote_sha="$(git ls-remote origin "refs/heads/$remote_branch" 2>/dev/null | cut -f1)" &&
		[ -n "$remote_sha" ]; then
		local_sha="$(git rev-parse "$ref")"
		if [ "$remote_sha" != "$local_sha" ]; then
			echo "deploy: $ref is ${local_sha:0:12} here but ${remote_sha:0:12} on the remote." >&2
			echo "deploy: deploying it would publish a stale site and report success. Run: git fetch origin" >&2
			echo "deploy: or pass an explicit commit if you truly mean the older one." >&2
			exit 1
		fi
	else
		# No network, or the branch is gone. Refusing would make the script unusable offline for a
		# preview, so say what could not be checked and let a preview through -- but never production,
		# where the cost of being wrong is the recruiter-facing site.
		echo "deploy: could not reach the remote to confirm $ref is current." >&2
		if [ "$branch" = "main" ]; then
			echo "deploy: refusing a production deploy on an unverified ref." >&2
			exit 1
		fi
		echo "deploy: continuing anyway -- this is a preview, not production." >&2
	fi
	;;
esac

# The trap names its own variable rather than $staging, which is reassigned below to the upload subdir.
# A trap that removes a moving target cleans up whatever the variable happens to hold at exit -- here that
# would have been the subdirectory, leaving the parent behind and re-introducing the leak this fixes.
staging_root="$(mktemp -d "${TMPDIR:-/tmp}/pw-deploy.XXXXXX")"
trap 'rm -rf "$staging_root"' EXIT
staging="$staging_root"

export_dir="$staging/export"
mkdir -p "$export_dir"
git archive "$ref" | tar -x -C "$export_dir"

# AN ALLOWLIST, NOT A DENYLIST. This was `rm -f AGENTS.md HANDOFF.md README.md ...`, which publishes every
# file nobody remembered to name -- and the first such file was this script: `deploy.sh` was served at
# https://<site>/deploy.sh as application/x-sh on the preview that tested the denylist. A list of what to
# remove has to be updated by whoever adds a file, at the moment they are thinking about something else,
# and it fails by publishing. A list of what to ship fails by 404 instead, which is visible and safe.
upload="$staging/upload"
mkdir -p "$upload"
SHIP=(index.html styles.css assets)
for item in "${SHIP[@]}"; do
	if [ -e "$export_dir/$item" ]; then
		cp -R "$export_dir/$item" "$upload/$item"
	fi
done

# index.html is the site; anything else being absent is a judgement call, but this is not.
if [ ! -s "$upload/index.html" ]; then
	echo "deploy: $ref has no index.html -- refusing to publish an empty site." >&2
	exit 1
fi

# Name what was left behind. Silence here would make an accidentally-omitted new asset indistinguishable
# from a deliberate exclusion, which is how an allowlist goes wrong.
skipped="$(cd "$export_dir" && find . -maxdepth 1 -mindepth 1 -exec basename {} \; | sort | tr '\n' ' ')"
for item in "${SHIP[@]}"; do
	skipped="${skipped//$item /}"
done
[ -n "${skipped// /}" ] && echo "deploy: not publishing: ${skipped% }"

staging="$upload"

# The resume PDF is a real public download -- index.html links it three times -- so a deploy that drops
# it serves a page whose CV button 404s. It is tracked as of this commit, so `git archive` carries it and
# the check is that the archive really did: assert, do not repair.
#
# An earlier version copied it from the working tree, left over from when the file was untracked. That
# would publish an uncommitted draft resume while reporting a deploy of `origin/main` -- the exact thing
# exporting a committed ref exists to prevent. Whatever is wrong here, the fix is a commit, not a copy.
pdf="assets/Jonathan_Hodges_VP_Data_AI_Resume_3Page.pdf"
if grep -q "$pdf" "$staging/index.html" && [ ! -s "$staging/$pdf" ]; then
	echo "deploy: index.html links $pdf but $ref does not contain it." >&2
	echo "deploy: refusing to publish a page with a dead CV link. Commit the PDF first." >&2
	exit 1
fi

# Belt and braces: the claim matrix defines the NDA and customer-naming boundaries, so assert it is not in
# the upload set rather than trusting the allowlist to have been built correctly. Cheap, and it checks the
# directory that is actually about to be uploaded rather than the intent behind it.
if find "$staging" -name "claim-matrix*" -print -quit | grep -q .; then
	echo "deploy: claim-matrix is in the upload set -- aborting." >&2
	exit 1
fi

echo "deploy: $(find "$staging" -type f | wc -l | tr -d ' ') files from $ref -> branch '$branch'"
cd "$staging"

# NOT `exec`: that replaces this shell, so the EXIT trap never runs and every deploy leaves a full copy
# of the staged site behind in $TMPDIR -- resume PDF included, in a directory other local users can read.
# Five had already accumulated from testing this script. Running wrangler as a child lets the trap fire.
#
# `|| status=$?` rather than a bare call followed by `status=$?`: under `set -e` a failing wrangler aborts
# the script at the call, so the assignment after it is only ever reached with 0 -- dead code that reads
# like error handling. The trap still runs on that abort, so cleanup was never the problem; the exit
# status was, and `||` is what actually keeps it.
status=0
npx wrangler pages deploy . \
	--project-name=personal-website --branch="$branch" --commit-dirty=true || status=$?
cd "$root"
exit "$status"
