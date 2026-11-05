import Fastify, { type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import routes from './routes/index.js';
import { isDataException } from './shared/pg-errors.js';
import { isPublicRoute, requireAuth } from './shared/auth/guards.js';

function allowedOrigins(): string[] {
  return (process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify(options);

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

  // Backstop for input a route's validator didn't cover: Postgres bad-input
  // errors (NUL byte, out-of-range number) are a 400, not a 500. Logged first,
  // since the same code on a stored row (not the request) would be a real fault
  // this would otherwise hide. Everything else goes through Fastify's default
  // handling unchanged.
  app.setErrorHandler((error, request, reply) => {
    if (isDataException(error)) {
      // Code and route only: pg's message embeds the offending value.
      request.log.warn({ code: (error as { code?: string }).code, route: request.routeOptions.url }, 'Postgres rejected request input; replying 400');
      return reply.code(400).send({ error: 'Invalid input' });
    }
    return reply.send(error);
  });

  app.get('/health', { config: { public: true } }, async () => {
    return { status: 'ok' };
  });

  app.register(routes);

  return app;
}
