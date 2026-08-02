import Fastify from 'fastify';
import routes from './routes/index.js';

export function buildApp() {
  const app = Fastify();

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  app.register(routes);

  return app;
}
