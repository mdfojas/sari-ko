import { buildApp } from '../src/app.js';

export const app = buildApp();

export async function createProduct(payload: Record<string, unknown>) {
  const response = await app.inject({ method: 'POST', url: '/products', payload });
  return response.json();
}
