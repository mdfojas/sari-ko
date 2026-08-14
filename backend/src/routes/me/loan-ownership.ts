export type OwnershipCheckResult = { ok: true } | { ok: false; status: 404 | 403 };

// Pure decision logic, separate from fetching — callers fetch whatever data
// they actually need (the full loan for `GET /me/loans/:id`, or just the
// owning person_id for the line-items/history bridges, which don't need the
// full loan's SUM subquery) and pass just the owner id in here.
export function checkLoanOwnership(actualPersonId: number | null, callerPersonId: number): OwnershipCheckResult {
  if (actualPersonId === null) {
    return { ok: false, status: 404 };
  }
  if (actualPersonId !== callerPersonId) {
    return { ok: false, status: 403 };
  }
  return { ok: true };
}
