import Fastify from 'fastify';
import productRoutes from './products/routes.js';

export function buildApp() {
  const app = Fastify();

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  app.register(productRoutes);

  return app;
}
