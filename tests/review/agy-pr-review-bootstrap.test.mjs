import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  verifyBootstrapOidc,
  validateBootstrapClaims,
  requireBootstrapBaseAbsent,
  parseArgs,
  validateBundle,
  reviewSession,
  MODEL,
  validateBootstrapPermit,
  bootstrapPermitBody,
  bootstrapReceiptHash,
  readBootstrapPages,
  BOOTSTRAP_MARKER,
} from "../../scripts/agy-pr-review.mjs";
const adopted = "c".repeat(40),
  base = "a".repeat(40),
  repo = "hodgesz/personal-website",
  now = 1800000000;
const claims = {
  iss: "https://token.actions.githubusercontent.com",
  aud: "agy-pr-review-bootstrap",
  iat: now,
  nbf: now,
  exp: now + 300,
  repository: repo,
  repository_owner: "hodgesz",
  actor: "hodgesz",
  event_name: "workflow_dispatch",
  runner_environment: "github-hosted",
  sha: adopted,
  workflow_sha: adopted,
  ref: "refs/heads/review-bootstrap",
  workflow_ref: `${repo}/.github/workflows/ci.yml@refs/heads/review-bootstrap`,
  run_id: "45",
  run_attempt: "1",
};
// Ephemeral synthetic signing material, in-memory only; no account credentials.
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwks = {
  keys: [
    {
      ...publicKey.export({ format: "jwk" }),
      kid: "synthetic-test",
      alg: "RS256",
      use: "sig",
    },
  ],
};
function token(
  payload = claims,
  header = { alg: "RS256", kid: "synthetic-test" },
) {
  const a = Buffer.from(JSON.stringify(header)).toString("base64url"),
    b = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${a}.${b}.${sign("RSA-SHA256", Buffer.from(`${a}.${b}`), privateKey).toString("base64url")}`;
}
const proof = () => ({
  claims: structuredClone(claims),
  adoption: adopted,
  run: {
    id: 45,
    run_attempt: 1,
    workflow_id: 286131178,
    repository: { full_name: repo },
    head_repository: { full_name: repo },
    actor: { login: "hodgesz" },
    triggering_actor: { login: "hodgesz" },
    event: "workflow_dispatch",
    status: "in_progress",
    head_sha: adopted,
    head_branch: "review-bootstrap",
  },
  workflow: {
    id: 286131178,
    path: ".github/workflows/ci.yml",
    state: "active",
  },
  identity: { repo, pr: "211", base, head: adopted },
  main: { name: "main", commit: { sha: base } },
  foundation: {
    check_runs: [
      {
        id: 19,
        name: "test",
        head_sha: adopted,
        app: { id: 15368 },
        status: "completed",
        conclusion: "success",
        details_url: `https://github.com/${repo}/actions/runs/88/job/99`,
      },
    ],
  },
  foundationRun: {
    id: 88,
    repository: { full_name: repo },
    head_repository: { full_name: repo },
    head_sha: adopted,
    path: ".github/workflows/ci.yml",
    event: "pull_request",
    status: "completed",
    conclusion: "success",
  },
});

const iso = (seconds) =>
  new Date(seconds * 1000).toISOString().replace(".000Z", "Z");
function permitProof() {
  const receipt = { synthetic: "pure fixture data never grants CI authority" };
  const posted = {
    id: 75,
    user: { id: 9, login: "hodgesz", type: "User" },
    author_association: "OWNER",
    commit_id: adopted,
    state: "COMMENTED",
    submitted_at: iso(now - 180),
  };
  const permit = {
    repo,
    pr: 211,
    base,
    head: adopted,
    control_sha: adopted,
    workflow_id: 286131178,
    workflow_path: ".github/workflows/ci.yml",
    ref: claims.ref,
    workflow_sha256: "e".repeat(64),
    review_id: posted.id,
    receipt_sha256: bootstrapReceiptHash(receipt),
    enabled: true,
    created_at: iso(now - 120),
    expires_at: iso(now + 600),
    nonce: "c".repeat(32),
  };
  const comment = {
    id: 77,
    issue_url: `https://api.github.com/repos/${repo}/issues/211`,
    user: { id: 9, login: "hodgesz", type: "User" },
    author_association: "OWNER",
    created_at: iso(now - 100),
    updated_at: iso(now - 100),
    body: bootstrapPermitBody(permit),
  };
  return {
    comment,
    comments: [structuredClone(comment)],
    commentId: 77,
    ownerId: 9,
    identity: proof().identity,
    claims,
    run: { created_at: iso(now - 60) },
    workflowHash: permit.workflow_sha256,
    posted,
    receipt,
    adoption: adopted,
  };
}
function changePermit(data, mutate) {
  const permit = JSON.parse(data.comment.body.slice(BOOTSTRAP_MARKER.length));
  mutate(permit);
  data.comment.body = bootstrapPermitBody(permit);
  data.comments = [structuredClone(data.comment)];
}
test("authenticated owner permit binds exact identity, workflow bytes, formal review, canonical receipt and finite time", () => {
  const data = permitProof();
  assert.equal(validateBootstrapPermit(data, now).control_sha, adopted);
  assert.equal(
    bootstrapReceiptHash({ z: { b: 2, a: 1 }, a: [1, 2] }),
    bootstrapReceiptHash({ a: [1, 2], z: { a: 1, b: 2 } }),
  );
  assert.notEqual(
    bootstrapReceiptHash({ a: [1, 2] }),
    bootstrapReceiptHash({ a: [2, 1] }),
  );
});
for (const [label, mutate] of [
  [
    "wrong login",
    (d) => {
      d.comment.user.login = "stranger";
    },
  ],
  [
    "bot",
    (d) => {
      d.comment.user.type = "Bot";
    },
  ],
  [
    "wrong owner numeric ID",
    (d) => {
      d.comment.user.id = 10;
    },
  ],
  [
    "string owner ID",
    (d) => {
      d.ownerId = "9";
    },
  ],
  [
    "non-owner association",
    (d) => {
      d.comment.author_association = "MEMBER";
    },
  ],
  [
    "wrong selected comment",
    (d) => {
      d.commentId = 78;
    },
  ],
  [
    "wrong issue URL",
    (d) => {
      d.comment.issue_url += "?other=211";
    },
  ],
  [
    "different PR",
    (d) =>
      changePermit(d, (p) => {
        p.pr = 38;
      }),
  ],
  [
    "wrong repo",
    (d) =>
      changePermit(d, (p) => {
        p.repo = "hodgesz/other";
      }),
  ],
  [
    "boolean PR",
    (d) =>
      changePermit(d, (p) => {
        p.pr = true;
      }),
  ],
  [
    "string review ID",
    (d) =>
      changePermit(d, (p) => {
        p.review_id = "75";
      }),
  ],
  [
    "boolean enable coercion",
    (d) =>
      changePermit(d, (p) => {
        p.enabled = 1;
      }),
  ],
  [
    "withdrawn",
    (d) =>
      changePermit(d, (p) => {
        p.enabled = false;
      }),
  ],
  [
    "unknown field",
    (d) =>
      changePermit(d, (p) => {
        p.allow_tools = false;
      }),
  ],
  [
    "wrong base",
    (d) =>
      changePermit(d, (p) => {
        p.base = "d".repeat(40);
      }),
  ],
  [
    "wrong head",
    (d) =>
      changePermit(d, (p) => {
        p.head = base;
      }),
  ],
  [
    "wrong control",
    (d) =>
      changePermit(d, (p) => {
        p.control_sha = base;
      }),
  ],
  [
    "wrong ref",
    (d) =>
      changePermit(d, (p) => {
        p.ref = "refs/heads/other";
      }),
  ],
  [
    "wrong workflow ID",
    (d) =>
      changePermit(d, (p) => {
        p.workflow_id++;
      }),
  ],
  [
    "wrong workflow path",
    (d) =>
      changePermit(d, (p) => {
        p.workflow_path = ".github/workflows/untrusted.yml";
      }),
  ],
  [
    "wrong workflow blob",
    (d) =>
      changePermit(d, (p) => {
        p.workflow_sha256 = "f".repeat(64);
      }),
  ],
  [
    "stale review ID",
    (d) =>
      changePermit(d, (p) => {
        p.review_id--;
      }),
  ],
  [
    "wrong receipt",
    (d) =>
      changePermit(d, (p) => {
        p.receipt_sha256 = "f".repeat(64);
      }),
  ],
  [
    "invalid nonce",
    (d) =>
      changePermit(d, (p) => {
        p.nonce = "a".repeat(31);
      }),
  ],
  [
    "expired",
    (d) =>
      changePermit(d, (p) => {
        p.expires_at = iso(now);
      }),
  ],
  [
    "excessive lifetime",
    (d) =>
      changePermit(d, (p) => {
        p.expires_at = iso(now + 1800);
      }),
  ],
  [
    "future created",
    (d) =>
      changePermit(d, (p) => {
        p.created_at = iso(now + 1);
      }),
  ],
  [
    "invalid calendar date",
    (d) =>
      changePermit(d, (p) => {
        p.created_at = "2026-02-30T00:00:00Z";
      }),
  ],
  [
    "non-UTC timestamp",
    (d) =>
      changePermit(d, (p) => {
        p.created_at = p.created_at.replace("Z", "+00:00");
      }),
  ],
  [
    "older than formal review",
    (d) => {
      d.posted.submitted_at = iso(now - 100);
    },
  ],
  [
    "edited comment",
    (d) => {
      d.comment.updated_at = iso(now - 99);
    },
  ],
  [
    "future run",
    (d) => {
      d.run.created_at = iso(now + 1);
    },
  ],
  [
    "run before comment",
    (d) => {
      d.run.created_at = iso(now - 101);
    },
  ],
  [
    "wrong formal review owner",
    (d) => {
      d.posted.user.id = 10;
    },
  ],
  [
    "dismissed formal review",
    (d) => {
      d.posted.state = "DISMISSED";
    },
  ],
  [
    "missing traversal",
    (d) => {
      d.comments = [];
    },
  ],
  [
    "later owner revocation",
    (d) => {
      const c = structuredClone(d.comment);
      c.id++;
      c.body = BOOTSTRAP_MARKER + '{"enabled":false}';
      d.comments.push(c);
    },
  ],
  [
    "later unknown owner instruction",
    (d) => {
      const c = structuredClone(d.comment);
      c.id++;
      c.body = "AGY_PR_REVIEW_BOOTSTRAP_ADOPTION_V2:{}";
      d.comments.push(c);
    },
  ],
])
  test(`permit rejects ${label}`, () => {
    const data = permitProof();
    mutate(data);
    assert.throws(() => validateBootstrapPermit(data, now));
  });
for (const suffix of [
  " trailing prose",
  "\n" + BOOTSTRAP_MARKER + "{}",
  "\n{}",
])
  test(`permit rejects ambiguous trailing data ${JSON.stringify(suffix)}`, () => {
    const d = permitProof();
    d.comment.body += suffix;
    d.comments = [structuredClone(d.comment)];
    assert.throws(() => validateBootstrapPermit(d, now));
  });
test("duplicate JSON keys and a mismatched direct/list comment fail instead of accepting claimed fields", () => {
  const d = permitProof();
  d.comment.body = d.comment.body.replace(
    '"enabled":true',
    '"enabled":false,"enabled":true',
  );
  d.comments = [structuredClone(d.comment)];
  assert.throws(() => validateBootstrapPermit(d, now), /Duplicate JSON/);
  const e = permitProof();
  e.comments[0].body += " ";
  assert.throws(() => validateBootstrapPermit(e, now));
});
test("explicit comment pagination covers later owner instructions and rejects duplicate/order/size/incomplete terminal pages", async () => {
  const first = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
  const requests = [];
  const result = await readBootstrapPages(async (route) => {
    requests.push(route);
    return JSON.stringify(route.endsWith("page=1") ? first : [{ id: 101 }]);
  }, "issues/211/comments");
  assert.equal(result.at(-1).id, 101);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((r) => !r.includes("slurp")));
  for (const value of [
    [{ id: 1 }, { id: 1 }],
    [{ id: 2 }, { id: 1 }],
    [{ id: 0 }],
    [{ id: true }],
    [{ id: "1" }],
    { id: 1 },
    Array.from({ length: 101 }, (_, i) => ({ id: i + 1 })),
  ])
    await assert.rejects(
      readBootstrapPages(
        async () => JSON.stringify(value),
        "issues/211/comments",
      ),
    );
  await assert.rejects(
    readBootstrapPages(
      async () =>
        JSON.stringify([{ id: 1, body: "x".repeat(2 * 1024 * 1024) }]),
      "issues/211/comments",
    ),
    /byte limit/,
  );
  await assert.rejects(
    readBootstrapPages(async (route) => {
      const page = Number(route.split("page=").at(-1));
      return JSON.stringify(
        first.map((r) => ({ id: r.id + (page - 1) * 100 })),
      );
    }, "issues/211/comments"),
    /page limit/,
  );
  await assert.rejects(
    readBootstrapPages(async () => JSON.stringify(first), "issues/211/comments"),
    /ascending/,
  );
});
test("adoption comment CLI selector is canonical, bounded and restricted to bootstrap verification", () => {
  assert.equal(
    parseArgs(["bootstrap-verify", "--adoption-comment-id", "77"])[
      "adoption-comment-id"
    ],
    "77",
  );
  for (const id of ["0", "-1", "01", "true", "1.5", "9007199254740992"])
    assert.throws(() =>
      parseArgs(["bootstrap-verify", "--adoption-comment-id", id]),
    );
  assert.throws(() => parseArgs(["--adoption-comment-id", "77"]));
});

test("untrusted later comments cannot grant or revoke an authenticated owner permit", () => {
  const data = permitProof();
  data.comments.push({
    id: 78,
    user: { id: 10, login: "hodgesz", type: "Bot" },
    author_association: "OWNER",
    body: BOOTSTRAP_MARKER + "{}",
  });
  assert.equal(validateBootstrapPermit(data, now).control_sha, adopted);
  assert.throws(() => validateBootstrapPermit(data, now + 601), /expired/);
});

test("signed current-job OIDC and independent run/workflow/foundation metadata bind adoption", () => {
  const verified = verifyBootstrapOidc(token(), jwks, now);
  assert.deepEqual(verified, claims);
  const data = proof();
  data.claims = verified;
  assert.equal(validateBootstrapClaims(data), adopted);
});
for (const [name, patch] of [
  [
    "expired",
    (c) => {
      c.exp = now;
    },
  ],
  [
    "future",
    (c) => {
      c.iat = now + 61;
    },
  ],
  [
    "wrong issuer",
    (c) => {
      c.iss = "https://example.invalid";
    },
  ],
  [
    "wrong audience",
    (c) => {
      c.aud = "other";
    },
  ],
  [
    "not yet valid",
    (c) => {
      c.nbf = now + 61;
    },
  ],
])
  test(`OIDC rejects ${name}`, () => {
    const c = structuredClone(claims);
    patch(c);
    assert.throws(() => verifyBootstrapOidc(token(c), jwks, now));
  });
test("OIDC rejects unsigned/altered/key-substituted tokens rather than trusting env claims", () => {
  const valid = token();
  assert.throws(() =>
    verifyBootstrapOidc(
      valid.replace(/.$/, valid.endsWith("A") ? "B" : "A"),
      jwks,
      now,
    ),
  );
  assert.throws(() =>
    verifyBootstrapOidc(
      token(claims, { alg: "none", kid: "synthetic-test" }),
      jwks,
      now,
    ),
  );
  assert.throws(() => verifyBootstrapOidc(token(), { keys: [] }, now));
  assert.throws(() =>
    verifyBootstrapOidc(
      token(claims, {
        alg: "RS256",
        kid: "synthetic-test",
        jku: "https://example.invalid",
      }),
      jwks,
      now,
    ),
  );
});
for (const [name, mutate] of [
  [
    "blank adoption",
    (d) => {
      d.adoption = "";
    },
  ],
  [
    "branch adoption",
    (d) => {
      d.adoption = "main";
    },
  ],
  [
    "unadopted SHA",
    (d) => {
      d.adoption = "d".repeat(40);
    },
  ],
  [
    "missing workflow enable guard",
    (d) => {
      d.adoption = undefined;
    },
  ],
  [
    "non-owner actor",
    (d) => {
      d.claims.actor = "stranger";
    },
  ],
  [
    "non-owner rerun",
    (d) => {
      d.run.triggering_actor.login = "stranger";
    },
  ],
  [
    "fork repository",
    (d) => {
      d.run.head_repository.full_name = "stranger/fork";
    },
  ],
  [
    "repository owner",
    (d) => {
      d.claims.repository_owner = "stranger";
    },
  ],
  [
    "workflow source mismatch",
    (d) => {
      d.claims.workflow_sha = base;
    },
  ],
  [
    "workflow ref mismatch",
    (d) => {
      d.claims.workflow_ref = `${repo}/.github/workflows/other.yml@${d.claims.ref}`;
    },
  ],
  [
    "ordinary PR event",
    (d) => {
      d.claims.event_name = "pull_request";
    },
  ],
  [
    "self-hosted runner",
    (d) => {
      d.claims.runner_environment = "self-hosted";
    },
  ],
  [
    "main dispatch",
    (d) => {
      d.claims.ref = "refs/heads/main";
    },
  ],
  [
    "forged run ID",
    (d) => {
      d.claims.run_id = "46";
    },
  ],
  [
    "stale run attempt",
    (d) => {
      d.claims.run_attempt = "2";
    },
  ],
  [
    "completed stale run",
    (d) => {
      d.run.status = "completed";
    },
  ],
  [
    "selected workflow registry mismatch",
    (d) => {
      d.workflow.path = ".github/workflows/untrusted.yml";
    },
  ],
  [
    "disabled workflow",
    (d) => {
      d.workflow.state = "disabled_manually";
    },
  ],
  [
    "changed PR head",
    (d) => {
      d.identity.head = base;
    },
  ],
  [
    "changed main base",
    (d) => {
      d.main.commit.sha = adopted;
    },
  ],
  [
    "failed foundation",
    (d) => {
      d.foundation.check_runs[0].conclusion = "failure";
      d.foundationRun.conclusion = "failure";
    },
  ],
  [
    "pending foundation",
    (d) => {
      d.foundation.check_runs[0].status = "in_progress";
    },
  ],
  [
    "old-head foundation",
    (d) => {
      d.foundation.check_runs[0].head_sha = base;
    },
  ],
  [
    "other-app foundation",
    (d) => {
      d.foundation.check_runs[0].app.id = 1;
    },
  ],
  [
    "forged foundation run",
    (d) => {
      d.foundationRun.path = ".github/workflows/other.yml";
    },
  ],
  [
    "foundation URL mismatch",
    (d) => {
      d.foundation.check_runs[0].details_url = "https://example.invalid";
    },
  ],
])
  test(`bootstrap rejects ${name}`, () => {
    const d = proof();
    mutate(d);
    assert.throws(() => validateBootstrapClaims(d));
  });

test("bootstrap absent-base check reads only real Git tree data and rejects any already-present control", async () => {
  let args;
  await requireBootstrapBaseAbsent(
    "/tmp/synthetic-data",
    base,
    async (command, argv) => {
      assert.equal(command, "git");
      args = argv;
      return { stdout: "" };
    },
  );
  assert.ok(args.includes(base));
  assert.ok(args.includes("ls-tree"));
  assert.ok(args.includes("core.hooksPath=/dev/null"));
  for (const name of [
    "scripts/agy-pr-review.mjs",
    "scripts/agy-pr-review-completion.mjs",
    "scripts/agy-pr-review-bootstrap.mjs",
    "docs/gemini-review-instructions.md",
    "scripts/agy-pr-review.sh",
  ])
    await assert.rejects(
      requireBootstrapBaseAbsent("/tmp/synthetic-data", base, async () => ({
        stdout: name + "\n",
      })),
      /already contains/,
    );
});

test("env/CLI claims and pure provenance data cannot activate general CI trust or model generation", async () => {
  const keys = [
    "CI",
    "GITHUB_ACTIONS",
    "AGY_REVIEW_BOOTSTRAP_CONTROL_SHA",
    "GITHUB_RUN_ID",
    "GITHUB_RUN_ATTEMPT",
  ];
  const prior = keys.map((k) => [k, process.env[k]]);
  try {
    Object.assign(process.env, {
      CI: "true",
      GITHUB_ACTIONS: "true",
      AGY_REVIEW_BOOTSTRAP_CONTROL_SHA: adopted,
      GITHUB_RUN_ID: "45",
      GITHUB_RUN_ATTEMPT: "1",
    });
    assert.equal(validateBootstrapClaims(proof()), adopted);
    assert.throws(
      () => parseArgs(["--trusted-review-ref", adopted]),
      /forbidden in CI/,
    );
    assert.throws(
      () =>
        validateBundle({
          base,
          control_sha: adopted,
          control_mode: "explicit-local",
        }),
      /cannot accept/,
    );
    let calls = 0;
    await assert.rejects(
      reviewSession({}, { model: MODEL }, async () => {
        calls++;
      }),
      /CI model generation is forbidden/,
    );
    assert.equal(calls, 0);
  } finally {
    for (const [k, v] of prior) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("owner-adopted verifier completes only with signed job proof, real tree absence, matching receipt and genuine foundation metadata", async (t) => {
  const fs = await import("node:fs/promises"),
    os = await import("node:os"),
    path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const {
    bounded,
    cleanEnv,
    prepare,
    preflightBatches,
    aggregateReviews,
    FALLBACK_MODEL,
    selectReviewModel,
    reviewBody,
    main,
  } = await import("../../scripts/agy-pr-review.mjs");
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fp-bootstrap-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const git = async (...args) =>
    (
      await bounded(
        "git",
        [
          "-c",
          "core.hooksPath=/dev/null",
          "-c",
          "core.fsmonitor=false",
          "-C",
          dir,
          ...args,
        ],
        { env: cleanEnv() },
      )
    ).stdout.trim();
  await git("init", "--initial-branch=main");
  await git("config", "user.email", "fictional@example.invalid");
  await git("config", "user.name", "Fictional Fixture");
  await fs.writeFile(path.join(dir, "example.mjs"), "old\n");
  await git("add", ".");
  await git("commit", "-m", "synthetic base");
  const actualBase = await git("rev-parse", "HEAD");
  for (const file of [
    "scripts/agy-pr-review.mjs",
    "scripts/agy-pr-review-completion.mjs",
    "scripts/agy-pr-review-bootstrap.mjs",
    "scripts/agy-pr-review.sh",
    "docs/gemini-review-instructions.md",
    ".github/workflows/ci.yml",
  ]) {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await fs.copyFile(path.join(root, file), path.join(dir, file));
  }
  await fs.writeFile(path.join(dir, "example.mjs"), "new\n");
  await git("add", ".");
  await git("commit", "-m", "synthetic reviewed control");
  const control = await git("rev-parse", "HEAD");
  const identity = { repo, pr: "211", base: actualBase, head: control };
  // This phase prepares a local owner's packet; only the verifier below runs
  // in CI. Do not inherit hosted markers into the mocked local preparation.
  const localMarkers = ["CI", "GITHUB_ACTIONS"].map((name) => [
    name,
    process.env[name],
  ]);
  let review, receipt, flashReceipt, primaryReceipt;
  try {
    for (const [name] of localMarkers) delete process.env[name];
    const bundle = await prepare(
      {
        ...identity,
        source: dir,
        "trusted-review-ref": control,
      },
      async () => identity,
    );
    const { requests } = preflightBatches(bundle);
    const raw = requests.map((r, i) => {
      const id = `synthetic-ci-batch-${i}`,
        usage = {
          input_tokens: 1,
          output_tokens: 1,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          total_tokens: 2,
        },
        output = {
          completed: true,
          head: control,
          batch_id: r.descriptor.batch_id,
          axes: [
            "correctness",
            "architecture",
            "security",
            "performance",
            "tests",
          ],
          covered_files: r.descriptor.files,
          summary: "Synthetic source fully inspected.",
          findings: [],
          limitations: [],
        },
        text = JSON.stringify(output) + "\n";
      return (
        [
          {
            event: "init",
            conversation_id: id,
            init: {
              model: MODEL,
              permission_mode: "request-review",
              json_schema: r.schema,
            },
          },
          {
            event: "step_update",
            step_update: {
              conversation_id: id,
              step_index: 0,
              step_type: "user_input",
              state: "DONE",
            },
          },
          {
            event: "step_update",
            step_update: {
              conversation_id: id,
              step_index: 1,
              step_type: "agent_response",
              state: "DONE",
              text_delta: text,
              usage,
            },
          },
          {
            event: "step_update",
            step_update: {
              conversation_id: id,
              step_index: 2,
              step_type: "finish",
              state: "DONE",
            },
          },
          {
            event: "result",
            result: {
              conversation_id: id,
              status: "SUCCESS",
              duration_seconds: 0,
              num_turns: 1,
              response: text,
              json_schema: r.schema,
              structured_output: output,
              usage,
            },
          },
        ]
          .map((x) => JSON.stringify(x))
          .join("\n") + "\n"
      );
    });
    receipt = aggregateReviews(
      bundle,
      raw,
      MODEL,
      "review",
      undefined,
      selectReviewModel("auto", `${MODEL} Synthetic Argon\n`, ""),
    );
    const flashEvents = raw.map(
      (text) =>
        text
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const row = JSON.parse(line);
            if (row.init) row.init.model = FALLBACK_MODEL;
            return JSON.stringify(row);
          })
          .join("\n") + "\n",
    );
    // Deliberately forged non-Argon receipt for rejection tests; never model evidence.
    flashReceipt = {...receipt, model:FALLBACK_MODEL, effort:"high",
      selection:selectReviewModel("flash-only",`${FALLBACK_MODEL} Synthetic Flash High\n`,"")};
    primaryReceipt = aggregateReviews(
      bundle,
      raw,
      MODEL,
      "review",
      undefined,
      selectReviewModel("primary-only", `${MODEL} Synthetic Argon\n`, ""),
    );
    review = {
      id: 75,
      user: { login: "hodgesz", type: "User", id: 9 },
      author_association: "OWNER",
      commit_id: control,
      state: "COMMENTED",
      submitted_at: "2026-10-18T00:00:00Z",
      body: reviewBody(receipt),
    };
  } finally {
    for (const [name, value] of localMarkers) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
  for (const [name, value] of localMarkers)
    assert.equal(process.env[name], value);
  const data = proof();
  data.adoption = control;
  data.run.head_sha = control;
  data.identity = identity;
  data.main.commit.sha = actualBase;
  data.foundation.check_runs[0].head_sha = control;
  data.foundationRun.head_sha = control;
  const map = {};
  const api = (s) => `repos/${repo}/${s}`;
  map[api("actions/runs/45")] = data.run;
  map[api("actions/workflows/286131178")] = data.workflow;
  map[api("branches/main")] = data.main;
  map[
    api(
      `commits/${control}/check-runs?check_name=test&filter=latest&per_page=100`,
    )
  ] = data.foundation;
  map[api("actions/runs/88")] = data.foundationRun;
  map[api("pulls/211")] = {
    number: 211,
    state: "open",
    draft: false,
    base: {
      ref: "main",
      sha: actualBase,
      repo: { full_name: repo, default_branch: "main", owner: { id: 9 } },
    },
    head: { sha: control, repo: { full_name: repo } },
  };
  const epoch = Math.floor(Date.now() / 1000),
    iso = (seconds) =>
      new Date(seconds * 1000).toISOString().replace(".000Z", "Z");
  review.submitted_at = iso(epoch - 180);
  data.run.created_at = iso(epoch - 60);
  map[api("pulls/211/reviews?per_page=100&page=1")] = [review];
  const permit = {
    repo,
    pr: 211,
    base: actualBase,
    head: control,
    control_sha: control,
    workflow_id: 286131178,
    workflow_path: ".github/workflows/ci.yml",
    ref: claims.ref,
    workflow_sha256: (await import("../../scripts/agy-pr-review.mjs")).sha256(
      await fs.readFile(path.join(dir, ".github/workflows/ci.yml")),
    ),
    review_id: review.id,
    receipt_sha256: bootstrapReceiptHash(receipt),
    enabled: true,
    created_at: iso(epoch - 120),
    expires_at: iso(epoch + 600),
    nonce: "c".repeat(32),
  };
  const comment = {
    id: 77,
    issue_url: `https://api.github.com/repos/${repo}/issues/211`,
    user: { id: 9, login: "hodgesz", type: "User" },
    author_association: "OWNER",
    created_at: iso(epoch - 100),
    updated_at: iso(epoch - 100),
    body: bootstrapPermitBody(permit),
  };
  map[api("issues/comments/77")] = comment;
  map[api("issues/211/comments?per_page=100&page=1")] = [comment];
  const mapFile = path.join(dir, "map.json"),
    statusFile = path.join(dir, "statuses.jsonl"),
    bin = path.join(dir, "bin"),
    callsFile = path.join(dir, "calls.jsonl"),
    countsFile = path.join(dir, "counts.json");
  await fs.mkdir(bin);
  await fs.writeFile(mapFile, JSON.stringify(map));
  await fs.writeFile(
    path.join(bin, "gh"),
    `#!/usr/bin/python3\nimport sys,json,os\nargs=sys.argv[1:]\nroute=next((a for a in args if a.startswith('repos/')),None)\nwith open(${JSON.stringify(callsFile)},'a') as f:f.write(json.dumps(args)+'\\n')\nif 'POST' in args:\n with open(${JSON.stringify(statusFile)},'a') as f:f.write(sys.stdin.read())\n print('{}')\nelse:\n data=json.load(open(${JSON.stringify(mapFile)}))[route]\n if isinstance(data,dict) and '__sequence' in data:\n  path=${JSON.stringify(countsFile)}\n  counts=json.load(open(path)) if os.path.exists(path) else {}\n  index=counts.get(route,0);counts[route]=index+1\n  with open(path,'w') as f:json.dump(counts,f)\n  data=data['__sequence'][min(index,len(data['__sequence'])-1)]\n print(json.dumps(data))\n`,
    { mode: 0o700 },
  );
  const names = [
    "CI",
    "GITHUB_ACTIONS",
    "GH_TOKEN",
    "PATH",
    "GITHUB_RUN_ID",
    "GITHUB_RUN_ATTEMPT",
    "AGY_REVIEW_BOOTSTRAP_CONTROL_SHA",
    "ACTIONS_ID_TOKEN_REQUEST_URL",
    "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  ];
  const prior = names.map((k) => [k, process.env[k]]),
    oldFetch = globalThis.fetch,
    oldLog = console.log;
  try {
    Object.assign(process.env, {
      CI: "true",
      GITHUB_ACTIONS: "true",
      GH_TOKEN: "synthetic-not-a-live-credential",
      PATH: `${bin}:${process.env.PATH}`,
      GITHUB_RUN_ID: "45",
      GITHUB_RUN_ATTEMPT: "1",
      AGY_REVIEW_BOOTSTRAP_CONTROL_SHA: control,
      ACTIONS_ID_TOKEN_REQUEST_URL:
        "https://pipelines.actions.githubusercontent.com/synthetic-token",
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "synthetic-only",
    });
    const liveClaims = {
      ...claims,
      sha: control,
      workflow_sha: control,
      iat: epoch,
      nbf: epoch,
      exp: epoch + 300,
    };
    let unsigned = false;
    globalThis.fetch = async (url) => {
      const value = String(url);
      assert.ok(
        value ===
          "https://token.actions.githubusercontent.com/.well-known/jwks" ||
          value.startsWith(
            "https://pipelines.actions.githubusercontent.com/synthetic-token?audience=agy-pr-review-bootstrap",
          ),
        "Unexpected external I/O",
      );
      return {
        ok: true,
        text: async () =>
          JSON.stringify(
            value.includes("/.well-known/jwks")
              ? jwks
              : {
                  value: unsigned
                    ? token(liveClaims, { alg: "none", kid: "synthetic-test" })
                    : token(liveClaims),
                },
          ),
      };
    };
    console.log = () => {};
    await assert.rejects(
      main(["bootstrap-verify", "--repo", repo, "--pr", "211", "--source", dir]),
      /exact adoption comment ID/,
    );
    await assert.rejects(fs.access(statusFile));
    await main([
      "bootstrap-verify",
      "--adoption-comment-id",
      "77",
      "--repo",
      repo,
      "--pr",
      "211",
      "--source",
      dir,
    ]);
    let statuses = await fs.readFile(statusFile, "utf8");
    const calls = await fs.readFile(callsFile, "utf8");
    assert.ok(
      !calls.includes("actions/variables") && !calls.includes("--slurp"),
    );
    assert.ok(
      calls.includes("issues/comments/77") &&
        calls.includes("issues/211/comments?per_page=100&page=1"),
    );
    const baselineMap = structuredClone(map);
    const invoke = () =>
      main([
        "bootstrap-verify",
        "--adoption-comment-id",
        "77",
        "--repo",
        repo,
        "--pr",
        "211",
        "--source",
        dir,
      ]);
    // Same actual signed CI proof and permit validators must admit an approved
    // primary-only Argon selection, never a relabeled or fallback receipt.
    for (const selectedReceipt of [primaryReceipt]) {
      const selectedReview = { ...review, body: reviewBody(selectedReceipt) };
      const selectedComment = {
        ...comment,
        body: bootstrapPermitBody({
          ...permit,
          receipt_sha256: bootstrapReceiptHash(selectedReceipt),
        }),
      };
      const selectedMap = structuredClone(baselineMap);
      selectedMap[api("pulls/211/reviews?per_page=100&page=1")] = [
        selectedReview,
      ];
      selectedMap[api("issues/comments/77")] = selectedComment;
      selectedMap[api("issues/211/comments?per_page=100&page=1")] = [
        selectedComment,
      ];
      await fs.writeFile(mapFile, JSON.stringify(selectedMap));
      await fs.rm(countsFile, { force: true });
      await invoke(); // EXACT workflow CLI: no model/policy inputs or overrides.
    }
    statuses = await fs.readFile(statusFile, "utf8");
    assert.equal(statuses.split('"success"').length, 3);
    for (const [label, mutate] of [
      [
        "unsigned OIDC",
        () => {
          unsigned = true;
        },
      ],
      [
        "forged env alone",
        () => {
          process.env.AGY_REVIEW_BOOTSTRAP_CONTROL_SHA = actualBase;
        },
      ],
      [
        "late owner revocation",
        (m) => {
          const revoked = {
            ...comment,
            id: 78,
            body: bootstrapPermitBody({ ...permit, enabled: false }),
          };
          m[api("issues/211/comments?per_page=100&page=1")] = {
            __sequence: [[comment], [comment, revoked]],
          };
        },
      ],
      [
        "late formal review",
        (m) => {
          m[api("pulls/211/reviews?per_page=100&page=1")] = {
            __sequence: [[review], [review, { ...review, id: 76 }]],
          };
        },
      ],
      [
        "late main change",
        (m) => {
          m[api("branches/main")] = {
            __sequence: [data.main, { name: "main", commit: { sha: control } }],
          };
        },
      ],
      [
        "late foundation failure",
        (m) => {
          const failed = structuredClone(data.foundation);
          failed.check_runs[0].conclusion = "failure";
          m[
            api(
              `commits/${control}/check-runs?check_name=test&filter=latest&per_page=100`,
            )
          ] = { __sequence: [data.foundation, failed] };
        },
      ],
      [
        "expired final permit",
        (m) => {
          const expired = {
            ...comment,
            body: bootstrapPermitBody({
              ...permit,
              expires_at: iso(epoch - 1),
            }),
          };
          m[api("issues/comments/77")] = { __sequence: [comment, expired] };
          m[api("issues/211/comments?per_page=100&page=1")] = {
            __sequence: [[comment], [expired]],
          };
        },
      ],
      [
        "late PR head",
        (m) => {
          const pr = m[api("pulls/211")];
          m[api("pulls/211")] = {
            __sequence: [
              pr,
              pr,
              pr,
              { ...pr, head: { sha: actualBase, repo: { full_name: repo } } },
            ],
          };
        },
      ],
      [
        "wrong default branch",
        (m) => {
          m[api("pulls/211")].base.repo.default_branch = "other";
        },
      ],
      [
        "edited owner permit",
        (m) => {
          m[api("issues/comments/77")].updated_at = iso(epoch - 99);
        },
      ],
      [
        "pagination byte cap",
        (m) => {
          m[api("issues/211/comments?per_page=100&page=1")] = [
            { ...comment, body: "x".repeat(2 * 1024 * 1024) },
          ];
        },
      ],
      [
        "full terminal comment page",
        (m) => {
          for (let p = 1; p <= 20; p++)
            m[api(`issues/211/comments?per_page=100&page=${p}`)] = Array.from(
              { length: 100 },
              (_, i) => ({ id: (p - 1) * 100 + i + 1 }),
            );
        },
      ],
      [
        "newer failed foundation",
        (m) => {
          m[
            api(
              `commits/${control}/check-runs?check_name=test&filter=latest&per_page=100`,
            )
          ].check_runs.push({
            ...data.foundation.check_runs[0],
            id: 20,
            conclusion: "failure",
          });
        },
      ],
      [
        "matching permit hash cannot hide partial coverage",
        (m) => {
          const partial = structuredClone(receipt);
          partial.covered_files.pop();
          const forged = { ...review, body: reviewBody(partial) };
          const c = {
            ...comment,
            body: bootstrapPermitBody({
              ...permit,
              receipt_sha256: bootstrapReceiptHash(partial),
            }),
          };
          m[api("pulls/211/reviews?per_page=100&page=1")] = [forged];
          m[api("issues/comments/77")] = c;
          m[api("issues/211/comments?per_page=100&page=1")] = [c];
        },
      ],
      [
        "wrong owner proof",
        (m) => {
          m[api("issues/comments/77")].user.id = 10;
        },
      ],
      [
        "wrong workflow blob",
        (m) => {
          const c = m[api("issues/comments/77")];
          c.body = bootstrapPermitBody({
            ...permit,
            workflow_sha256: "f".repeat(64),
          });
          m[api("issues/211/comments?per_page=100&page=1")] = [c];
        },
      ],
    ]) {
      const changed = structuredClone(baselineMap);
      await fs.rm(countsFile, { force: true });
      unsigned = false;
      process.env.AGY_REVIEW_BOOTSTRAP_CONTROL_SHA = control;
      mutate(changed);
      await fs.writeFile(mapFile, JSON.stringify(changed));
      await assert.rejects(invoke(), undefined, label);
      assert.equal(
        (await fs.readFile(statusFile, "utf8")).split('"success"').length,
        statuses.split('"success"').length,
        label,
      );
      assert.throws(
        () => parseArgs(["--trusted-review-ref", control]),
        /forbidden in CI/,
      );
    }
    unsigned = false;
    process.env.AGY_REVIEW_BOOTSTRAP_CONTROL_SHA = control;
    await fs.rm(countsFile, { force: true });
    await fs.writeFile(mapFile, JSON.stringify(baselineMap));
    assert.ok(statuses.includes('"state"'));
    assert.ok(statuses.includes('"success"'));
    assert.ok(statuses.includes('"failure"'));
    assert.throws(
      () => parseArgs(["--trusted-review-ref", control]),
      /forbidden in CI/,
    );
    map[
      api(
        `commits/${control}/check-runs?check_name=test&filter=latest&per_page=100`,
      )
    ].check_runs[0].conclusion = "failure";
    await fs.writeFile(mapFile, JSON.stringify(map));
    await assert.rejects(
      main([
        "bootstrap-verify",
        "--adoption-comment-id",
        "77",
        "--repo",
        repo,
        "--pr",
        "211",
        "--source",
        dir,
      ]),
      /CI/,
    );
    assert.equal(
      (await fs.readFile(statusFile, "utf8")).split('"success"').length,
      statuses.split('"success"').length,
    );
    map[
      api(
        `commits/${control}/check-runs?check_name=test&filter=latest&per_page=100`,
      )
    ].check_runs[0].conclusion = "success";
    delete map[api("issues/comments/77")];
    await fs.writeFile(mapFile, JSON.stringify(map));
    await assert.rejects(
      main([
        "bootstrap-verify",
        "--adoption-comment-id",
        "77",
        "--repo",
        repo,
        "--pr",
        "211",
        "--source",
        dir,
      ]),
      /bootstrap_provenance_unavailable: issues\/comments/,
    );
    assert.equal(
      (await fs.readFile(statusFile, "utf8")).split('"success"').length,
      statuses.split('"success"').length,
    );
    // Normal workflow uses exact base that now includes every trusted helper.
    // Exercise its real main()/prepare()/gh CLI/status path with the same default
    // arguments/env as YAML, independently of the local generation selection.
    await fs.writeFile(
      path.join(dir, "example.mjs"),
      "another fictional change\n",
    );
    await git("add", "example.mjs");
    await git("commit", "-m", "synthetic normal-base candidate");
    const normalHead = await git("rev-parse", "HEAD");
    const normalIdentity = { repo, pr: "211", base: control, head: normalHead };
    const normalBundle = await prepare(
      { ...normalIdentity, source: dir },
      async () => normalIdentity,
    );
    const normalRequests = preflightBatches(normalBundle).requests;
    const normalEvents = (model) =>
      normalRequests.map((r) => {
        const id = `synthetic-normal-${r.descriptor.index}`;
        const usage = {
          input_tokens: 1,
          output_tokens: 1,
          thinking_tokens: 0,
          cache_read_tokens: 0,
          total_tokens: 2,
        };
        const output = {
          completed: true,
          head: normalHead,
          batch_id: r.bundle.batch.batch_id,
          axes: [
            "correctness",
            "architecture",
            "security",
            "performance",
            "tests",
          ],
          covered_files: r.descriptor.files,
          summary: "Reviewed normal complete source.",
          findings: [],
          limitations: [],
        };
        const text = JSON.stringify(output);
        return (
          [
            {
              event: "init",
              conversation_id: id,
              init: {
                model,
                permission_mode: "request-review",
                json_schema: r.schema,
              },
            },
            {
              event: "step_update",
              step_update: {
                conversation_id: id,
                step_index: 0,
                step_type: "user_input",
                state: "DONE",
              },
            },
            {
              event: "step_update",
              step_update: {
                conversation_id: id,
                step_index: 1,
                step_type: "agent_response",
                state: "DONE",
                text_delta: text,
                usage,
              },
            },
            {
              event: "step_update",
              step_update: {
                conversation_id: id,
                step_index: 2,
                step_type: "finish",
                state: "DONE",
              },
            },
            {
              event: "result",
              result: {
                conversation_id: id,
                status: "SUCCESS",
                duration_seconds: 0,
                num_turns: 1,
                response: text,
                structured_output: output,
                json_schema: r.schema,
                usage,
              },
            },
          ]
            .map((row) => JSON.stringify(row))
            .join("\n") + "\n"
        );
      });
    const normalMap = structuredClone(baselineMap);
    normalMap[api("pulls/211")].base.sha = control;
    normalMap[api("pulls/211")].head.sha = normalHead;
    const normalInvoke = () =>
      main([
        "verify",
        "--repo",
        repo,
        "--pr",
        "211",
        "--base",
        control,
        "--head",
        normalHead,
        "--source",
        dir,
      ]);
    for (const [policy, listing, model] of [
      ["auto", `${MODEL} Synthetic Argon\n`, MODEL],
      ["primary-only", `${MODEL} Synthetic Argon\n`, MODEL],
    ]) {
      const selection = selectReviewModel(policy, listing, "");
      const normalReceipt = aggregateReviews(
        normalBundle,
        normalEvents(model),
        model,
        "review",
        undefined,
        selection,
      );
      const normalReview = {
        ...review,
        commit_id: normalHead,
        body: reviewBody(normalReceipt),
      };
      normalMap[api("pulls/211/reviews")] = [[normalReview]];
      await fs.writeFile(mapFile, JSON.stringify(normalMap));
      let successes = (await fs.readFile(statusFile, "utf8")).split(
        '"success"',
      ).length;
      await normalInvoke(); // No --model/--policy: actual workflow defaults.
      assert.equal(
        (await fs.readFile(statusFile, "utf8")).split('"success"').length,
        successes + 1,
      );
      const partial = structuredClone(normalReceipt);
      partial.covered_files = [];
      normalMap[api("pulls/211/reviews")] = [
        [{ ...normalReview, body: reviewBody(partial) }],
      ];
      await fs.writeFile(mapFile, JSON.stringify(normalMap));
      await assert.rejects(normalInvoke());
      assert.equal(
        (await fs.readFile(statusFile, "utf8")).split('"success"').length,
        successes + 1,
      );
    }
  } finally {
    globalThis.fetch = oldFetch;
    console.log = oldLog;
    for (const [k, v] of prior) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
