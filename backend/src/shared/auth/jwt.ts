import jwt from 'jsonwebtoken';

export type Role = 'admin' | 'store_owner' | 'customer';

export interface TokenPayload {
  accountId: number;
  username: string;
  role: Role;
  personId: number | null;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

export function signToken(payload: TokenPayload, options: { expiresIn?: string | number } = {}): string {
  return jwt.sign(payload, getSecret(), { expiresIn: options.expiresIn ?? '7d' } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getSecret()) as unknown as TokenPayload;
}
