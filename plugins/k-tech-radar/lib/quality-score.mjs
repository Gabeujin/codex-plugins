export const negativeReviewScoringPolicy = Object.freeze({
  id: "negative-review-v1",
  p0Weight: 2,
  p1Weight: 0.1,
  p2Weight: 0.02,
  decimals: 2
});

function findingCount(value, field) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(
      `${field} must be a non-negative integer`
    );
  }
  return count;
}

export function calculateNegativeReviewScore({
  p0,
  p1,
  p2
}) {
  const counts = {
    p0: findingCount(p0, "p0"),
    p1: findingCount(p1, "p1"),
    p2: findingCount(p2, "p2")
  };
  const raw =
    10 -
    negativeReviewScoringPolicy.p0Weight * counts.p0 -
    negativeReviewScoringPolicy.p1Weight * counts.p1 -
    negativeReviewScoringPolicy.p2Weight * counts.p2;
  return Number(
    Math.max(0, Math.min(10, raw)).toFixed(
      negativeReviewScoringPolicy.decimals
    )
  );
}

export function assertNegativeReviewScore(
  round,
  field = "review round"
) {
  const supplied = Number(round?.score);
  const expected = calculateNegativeReviewScore(round ?? {});
  if (!Number.isFinite(supplied) || supplied !== expected) {
    throw new Error(
      `${field}.score must equal ${expected.toFixed(2)} under ${negativeReviewScoringPolicy.id}`
    );
  }
  return expected;
}
