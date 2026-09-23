#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c875b61aa2f993fd9ec482b153b363dd78afe9256ed9a55d13dd75c249b60922/contract';
import endContract from '../../snapshots/c875b61aa2f993fd9ec482b153b363dd78afe9256ed9a55d13dd75c249b60922/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e37ac9eab7cbf496098499ee4f3e4d46d3f390fca38788319ea9db2a152a08a3/contract';
import startContract from '../../snapshots/e37ac9eab7cbf496098499ee4f3e4d46d3f390fca38788319ea9db2a152a08a3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('minecraftUsername', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('minecraftUuid', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_minecraftUuid_key',
        columns: ['minecraftUuid'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
