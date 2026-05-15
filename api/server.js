import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { PostgresDatabase } from './postgres.js';

const config = loadConfig();
const db = new PostgresDatabase(config.databaseUrl);
const app = createApp({ db, config });

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  await db.close();
  process.exit(1);
}

const shutdown = async () => {
  await app.close();
  await db.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
