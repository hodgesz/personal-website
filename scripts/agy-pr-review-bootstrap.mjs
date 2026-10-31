// Pure bootstrap proof validators. Checked bytes are imported by the runner.
// No filesystem, process, account, model, fetch or GitHub I/O.
import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
const REPOSITORY = "hodgesz/personal-website";
const SHA = /^[a-f0-9]{40}$/;
const OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const OIDC_AUDIENCE = "agy-pr-review-bootstrap";
const check = (ok, message) => {
  if (!ok) throw new Error(message);
};
const has = (object, key) => Object.hasOwn(object, key);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : item,
  );
export function bootstrapValidators(parseJsonStrict) {
  function verifyBootstrapOidc(jwt, jwks, now = Math.floor(Date.now() / 1000)) {
    check(
      typeof jwt === "string" && jwt.length <= 32768,
      "Missing bounded GitHub OIDC proof",
    );
    const parts = jwt.split(".");
    check(
      parts.length === 3 &&
        parts.every(
          (part) =>
            /^[A-Za-z0-9_-]+$/.test(part) &&
            Buffer.from(part, "base64url").toString("base64url") === part,
        ),
      "Malformed GitHub OIDC proof",
    );
    const header = parseJsonStrict(
      Buffer.from(parts[0], "base64url").toString("utf8"),
    );
    check(
      header.alg === "RS256" &&
        typeof header.kid === "string" &&
        !header.jku &&
        !header.x5u,
      "Unsupported OIDC signature",
    );
    check(
      Array.isArray(jwks?.keys) && jwks.keys.length <= 16,
      "Invalid GitHub signing keys",
    );
    const keys = jwks.keys.filter(
      (key) =>
        key.kid === header.kid &&
        key.kty === "RSA" &&
        (!key.alg || key.alg === "RS256") &&
        (!key.use || key.use === "sig"),
    );
    check(
      keys.length === 1 &&
        verifySignature(
          "RSA-SHA256",
          Buffer.from(`${parts[0]}.${parts[1]}`),
          createPublicKey({ key: keys[0], format: "jwk" }),
          Buffer.from(parts[2], "base64url"),
        ),
      "Invalid GitHub OIDC signature",
    );
    const claims = parseJsonStrict(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    check(
      claims.iss === OIDC_ISSUER &&
        claims.aud === OIDC_AUDIENCE &&
        Number.isFinite(claims.exp) &&
        claims.exp > now &&
        claims.exp <= now + 3600 &&
        Number.isFinite(claims.iat) &&
        claims.iat >= now - 600 &&
        claims.iat <= now + 60 &&
        (!has(claims, "nbf") ||
          (Number.isFinite(claims.nbf) && claims.nbf <= now + 60)),
      "Expired or mismatched GitHub OIDC claims",
    );
    return claims;
  }
  function validateBootstrapClaims({
    claims,
    adoption,
    run,
    workflow,
    identity,
    main,
    foundation,
    foundationRun,
  }) {
    const adopted = adoption;
    check(
      typeof adopted === "string" && SHA.test(adopted),
      "Missing exact bootstrap workflow enable guard",
    );
    check(
      claims.repository === REPOSITORY &&
        claims.repository_owner === "hodgesz" &&
        claims.actor === "hodgesz" &&
        claims.event_name === "workflow_dispatch" &&
        claims.runner_environment === "github-hosted" &&
        claims.sha === adopted &&
        claims.workflow_sha === adopted &&
        typeof claims.ref === "string" &&
        claims.ref.startsWith("refs/heads/") &&
        claims.ref !== "refs/heads/main" &&
        claims.workflow_ref ===
          `${REPOSITORY}/.github/workflows/ci.yml@${claims.ref}`,
      "Unadopted or mismatched workflow provenance",
    );
    check(
      run?.repository?.full_name === REPOSITORY &&
        run.head_repository?.full_name === REPOSITORY &&
        run.actor?.login === "hodgesz" &&
        run.triggering_actor?.login === "hodgesz" &&
        run.event === "workflow_dispatch" &&
        run.status === "in_progress" &&
        run.head_sha === adopted &&
        `refs/heads/${run.head_branch}` === claims.ref &&
        String(run.id) === claims.run_id &&
        String(run.run_attempt) === claims.run_attempt &&
        run.workflow_id === 286131178 &&
        workflow?.id === 286131178 &&
        workflow.path === ".github/workflows/ci.yml" &&
        workflow.state === "active",
      "Forged or stale bootstrap workflow run",
    );
    check(
      identity.repo === REPOSITORY &&
        identity.head === adopted &&
        identity.base === main?.commit?.sha &&
        main.name === "main",
      "Bootstrap must review adopted head against actual current main",
    );
    const checkRun = foundation?.check_runs?.find(
      (item) =>
        item.name === "test" &&
        item.head_sha === adopted &&
        item.app?.id === 15368 &&
        item.status === "completed" &&
        item.conclusion === "success",
    );
    check(
      checkRun &&
        foundationRun?.repository?.full_name === REPOSITORY &&
        foundationRun.head_repository?.full_name === REPOSITORY &&
        foundationRun.head_sha === adopted &&
        foundationRun.path === ".github/workflows/ci.yml" &&
        foundationRun.event === "pull_request" &&
        foundationRun.status === "completed" &&
        foundationRun.conclusion === "success" &&
        new RegExp(
          `^https://github\\.com/${REPOSITORY}/actions/runs/${foundationRun.id}/job/[1-9][0-9]*$`,
        ).test(checkRun.details_url),
      "Missing genuine current-head CI evidence",
    );
    return adopted;
  }
  const BOOTSTRAP_MARKER = "AGY_PR_REVIEW_BOOTSTRAP_ADOPTION_V1:";
  const permitDomain = "AGY_PR_REVIEW_BOOTSTRAP_ADOPTION";
  const positiveId = (v) => Number.isSafeInteger(v) && v > 0;
  const utcSeconds = (v) => {
    check(
      typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(v),
      "Invalid bootstrap UTC timestamp",
    );
    const ms = Date.parse(v);
    check(
      Number.isFinite(ms) &&
        new Date(ms).toISOString() === v.replace(/Z$/, ".000Z"),
      "Invalid bootstrap UTC date",
    );
    return ms / 1000;
  };
  const bootstrapReceiptHash = (receipt) => sha256(canonical(receipt));
  const bootstrapPermitBody = (permit) => BOOTSTRAP_MARKER + canonical(permit);
  const permitOwner = (item, ownerId) =>
    item?.user?.login === "hodgesz" &&
    item.user.type === "User" &&
    positiveId(item.user.id) &&
    item.author_association === "OWNER" &&
    (ownerId === undefined || item.user.id === ownerId);

  function validateBootstrapPermit(
    {
      comment,
      comments,
      commentId,
      ownerId,
      identity,
      claims,
      run,
      workflowHash,
      posted,
      receipt,
      adoption,
    },
    now = Math.floor(Date.now() / 1000),
  ) {
    check(
      ownerId === undefined || positiveId(ownerId),
      "Invalid base repository owner ID",
    );
    check(
      positiveId(commentId) &&
        comment?.id === commentId &&
        permitOwner(comment, ownerId) &&
        comment.issue_url ===
          `https://api.github.com/repos/${REPOSITORY}/issues/211`,
      "Untrusted bootstrap comment identity",
    );
    const latest = comments
      .filter(
        (c) =>
          permitOwner(c, ownerId) &&
          typeof c.body === "string" &&
          c.body.includes(permitDomain),
      )
      .at(-1);
    check(
      latest?.id === commentId &&
        latest.user.id === comment.user.id &&
        ["body", "issue_url", "created_at", "updated_at"].every(
          (k) => latest[k] === comment[k],
        ) &&
        permitOwner(latest, ownerId),
      "Selected permit is not the latest owner instruction",
    );
    check(
      typeof comment.body === "string" &&
        Buffer.byteLength(comment.body) <= 8192 &&
        comment.body.startsWith(BOOTSTRAP_MARKER) &&
        comment.body.split(permitDomain).length === 2,
      "Invalid bootstrap permit marker",
    );
    const p = parseJsonStrict(comment.body.slice(BOOTSTRAP_MARKER.length));
    const keys = [
      "repo",
      "pr",
      "base",
      "head",
      "control_sha",
      "workflow_id",
      "workflow_path",
      "ref",
      "workflow_sha256",
      "review_id",
      "receipt_sha256",
      "enabled",
      "created_at",
      "expires_at",
      "nonce",
    ];
    check(
      p &&
        typeof p === "object" &&
        !Array.isArray(p) &&
        Object.keys(p).sort().join() === keys.sort().join() &&
        comment.body === bootstrapPermitBody(p),
      "Invalid exact bootstrap permit schema",
    );
    check(
      p.enabled === true &&
        p.repo === REPOSITORY &&
        p.pr === 211 &&
        identity.pr === "211" &&
        p.base === identity.base &&
        p.head === identity.head &&
        p.control_sha === adoption &&
        p.head === adoption &&
        SHA.test(p.base) &&
        SHA.test(p.head) &&
        p.workflow_id === 286131178 &&
        p.workflow_path === ".github/workflows/ci.yml" &&
        p.ref === claims.ref &&
        /^[a-f0-9]{64}$/.test(p.workflow_sha256) &&
        p.workflow_sha256 === workflowHash &&
        positiveId(p.review_id) &&
        p.review_id === posted?.id &&
        /^[a-f0-9]{64}$/.test(p.receipt_sha256) &&
        p.receipt_sha256 === bootstrapReceiptHash(receipt) &&
        typeof p.nonce === "string" &&
        /^[a-f0-9]{32}$/.test(p.nonce),
      "Bootstrap permit binding or enablement mismatch",
    );
    check(
      permitOwner(posted, ownerId) &&
        posted.commit_id === adoption &&
        ["COMMENTED", "APPROVED"].includes(posted.state),
      "Untrusted latest formal Gemini review",
    );
    const created = utcSeconds(p.created_at),
      expires = utcSeconds(p.expires_at),
      postedAt = utcSeconds(comment.created_at),
      reviewed = utcSeconds(posted.submitted_at),
      started = utcSeconds(run.created_at);
    check(
      comment.updated_at === comment.created_at &&
        created > reviewed &&
        postedAt >= created &&
        postedAt <= created + 60 &&
        postedAt > reviewed &&
        expires > created &&
        expires <= created + 1800 &&
        started >= postedAt &&
        started >= created &&
        started < expires &&
        started <= now &&
        created <= now &&
        postedAt <= now &&
        now < expires,
      "Edited, stale, expired or future bootstrap permit",
    );
    return p;
  }

  return {
    verifyBootstrapOidc,
    validateBootstrapClaims,
    BOOTSTRAP_MARKER,
    positiveId,
    bootstrapReceiptHash,
    bootstrapPermitBody,
    validateBootstrapPermit,
  };
}
