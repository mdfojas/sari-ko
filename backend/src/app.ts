import Fastify from 'fastify';
import cors from '@fastify/cors';
import routes from './routes/index.js';
import { isPublicRoute, requireAuth } from './shared/auth/guards.js';

function allowedOrigins(): string[] {
  return (process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function buildApp() {
  const app = Fastify();

  // Registered before the auth hook below so CORS preflight (OPTIONS)
  // requests are answered directly and never reach requireAuth.
  app.register(cors, { origin: allowedOrigins() });

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
