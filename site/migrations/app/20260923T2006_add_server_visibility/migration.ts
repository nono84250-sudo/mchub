#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0189c507402e41c66e9bbccef89b447963fe77908c9fc2dd0bdbeb0c696be6b8/contract';
import endContract from '../../snapshots/0189c507402e41c66e9bbccef89b447963fe77908c9fc2dd0bdbeb0c696be6b8/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/1f15a3f81527ead19a0d991ed60606f604fb98914ea23e1aae9a63d535bcc315/contract';
import startContract from '../../snapshots/1f15a3f81527ead19a0d991ed60606f604fb98914ea23e1aae9a63d535bcc315/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'server',
        column: col('inviteCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'server',
        column: col('isPrivate', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'server',
        constraint: 'server_inviteCode_key',
        columns: ['inviteCode'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
