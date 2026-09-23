#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/05076c494ef07e2df7a0deb3199c5e222aa70331a49e3ea8064a605c56b92b6d/contract';
import startContract from '../../snapshots/05076c494ef07e2df7a0deb3199c5e222aa70331a49e3ea8064a605c56b92b6d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/1f15a3f81527ead19a0d991ed60606f604fb98914ea23e1aae9a63d535bcc315/contract';
import endContract from '../../snapshots/1f15a3f81527ead19a0d991ed60606f604fb98914ea23e1aae9a63d535bcc315/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'server',
        column: col('backgroundUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
