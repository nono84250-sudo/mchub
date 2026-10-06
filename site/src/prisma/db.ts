import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
  // Base distante : on laisse le temps d'ouvrir une connexion quand plusieurs requêtes arrivent ensemble
  // (sinon « timeout exceeded when trying to connect » et erreurs 500).
  poolOptions: {
    connectionTimeoutMillis: 20_000,
    idleTimeoutMillis: 30_000,
  },
});
