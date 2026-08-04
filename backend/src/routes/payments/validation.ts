export interface CreatePaymentBody {
  amount?: number;
  note?: string | null;
}

export function validateCreatePayment(body: CreatePaymentBody): string | null {
  if (body.amount === undefined || body.amount <= 0) {
    return 'amount is required and must be greater than 0';
  }
  return null;
}

export function validateUpdatePayment(body: CreatePaymentBody): string | null {
  if (body.amount !== undefined && body.amount <= 0) {
    return 'amount must be greater than 0';
  }
  if (body.amount === undefined && body.note === undefined) {
    return 'No updatable fields provided';
  }
  return null;
}
