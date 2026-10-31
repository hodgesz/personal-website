import assert from "node:assert/strict";
import test from "node:test";
import { partitionPatch, outputSchema } from "../../scripts/agy-pr-review.mjs";

test("complete patch partition retains all UTF-8 bytes and line boundaries", () => {
  const patch = "diff --git a/example.py b/example.py\n" + "+café résumé\n".repeat(9000);
  const parts = partitionPatch(patch);
  assert.ok(parts.length > 1);
  assert.equal(parts.join(""), patch);
  assert.deepEqual(Buffer.from(parts.join("")), Buffer.from(patch));
  assert.ok(parts.every(p => Buffer.byteLength(p) <= 40000));
  assert.ok(parts.every(p => p.endsWith("\n")));
});

test("a single unsupported patch line fails instead of truncating or omitting it", () => {
  assert.throws(() => partitionPatch("+" + "é".repeat(25000)), /patch line exceeds/);
});


test("native schema requires the exact five axis names accepted by validation", () => {
  assert.deepEqual(outputSchema.properties.axes.const, ["correctness", "architecture", "security", "performance", "tests"]);
});
