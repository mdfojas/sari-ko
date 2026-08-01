import 'dotenv/config';
import { buildApp } from './app.js';

const app = buildApp();
const port = Number(process.env.PORT) || 8080;

app.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`SariKo backend listening at ${address}`);
});
