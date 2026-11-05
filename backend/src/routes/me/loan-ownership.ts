export type OwnershipCheckResult = { ok: true } | { ok: false; status: 404 };

// Pure decision logic, separate from fetching — callers fetch whatever data
// they actually need (the full loan for `GET /me/loans/:id`, or just the
// owning person_id for the line-items/history bridges, which don't need the
// full loan's SUM subquery) and pass just the owner id in here.
//
// Someone else's loan and a loan that doesn't exist answer identically (404):
// a 403 for the former would let a customer probe which loan ids exist.
export function checkLoanOwnership(actualPersonId: number | null, callerPersonId: number): OwnershipCheckResult {
  if (actualPersonId === null || actualPersonId !== callerPersonId) {
    return { ok: false, status: 404 };
  }
  return { ok: true };
}
