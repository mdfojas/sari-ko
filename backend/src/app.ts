import Fastify from 'fastify';
import routes from './routes/index.js';
import { isPublicRoute, requireAuth } from './shared/auth/guards.js';

export function buildApp() {
  const app = Fastify();

  // Default-deny: every route requires auth unless it explicitly opts out
  // via `{ config: { public: true } }`. This means a future route added
  // with no preHandler at all is safe by default (any authenticated role),
  // not silently wide open — the opposite of the old opt-in-to-security model.
  app.addHook('onRequest', async (request, reply) => {
    if (isPublicRoute(request)) return;
    await requireAuth(request, reply);
  });

  app.get('/health', { config: { public: true } }, async () => {
    return { status: 'ok' };
  });

  app.register(routes);

  return app;
}
