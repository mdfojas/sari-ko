import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

// Proves the actual structural guarantee: a route registered with NO
// preHandler/config at all — exactly what a future route would look like if
// someone forgot to gate it — still requires auth by default, because the
// global onRequest hook in app.ts denies by default rather than the old
// per-route opt-in model.
describe('default-deny auth', () => {
  it('rejects an unguarded route with no Authorization header', async () => {
    const app = buildApp();
    app.get('/__test_unguarded_route', async () => ({ ok: true }));
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/__test_unguarded_route' });

    expect(response.statusCode).toBe(401);
  });

  it('still allows a route explicitly marked public, with no auth', async () => {
    const app = buildApp();
    app.get('/__test_public_route', { config: { public: true } }, async () => ({ ok: true }));
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/__test_public_route' });

    expect(response.statusCode).toBe(200);
  });
});
