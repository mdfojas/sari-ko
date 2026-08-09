import { findLoanById } from '../../queries/loans/index.js';

type Loan = NonNullable<Awaited<ReturnType<typeof findLoanById>>>;

export type LoanOwnershipResult = { ok: true; loan: Loan } | { ok: false; status: 404 | 403 };

export async function resolveOwnedLoan(loanId: number, personId: number): Promise<LoanOwnershipResult> {
  const loan = await findLoanById(loanId);
  if (!loan) {
    return { ok: false, status: 404 };
  }
  if (loan.person_id !== personId) {
    return { ok: false, status: 403 };
  }
  return { ok: true, loan };
}
