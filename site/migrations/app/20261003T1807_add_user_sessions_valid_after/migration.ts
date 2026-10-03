#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/104989e3d975082814f69d570c187d855fe7e225a536b6f55ba0dc1ccc1e2cb6/contract';
import endContract from '../../snapshots/104989e3d975082814f69d570c187d855fe7e225a536b6f55ba0dc1ccc1e2cb6/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/355421a7d9a06bea3982b19602853a3d71789df977dfcc63a1441d0ba938165c/contract';
import startContract from '../../snapshots/355421a7d9a06bea3982b19602853a3d71789df977dfcc63a1441d0ba938165c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('sessionsValidAfter', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
