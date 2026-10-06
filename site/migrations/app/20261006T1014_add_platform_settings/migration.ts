#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/104989e3d975082814f69d570c187d855fe7e225a536b6f55ba0dc1ccc1e2cb6/contract';
import startContract from '../../snapshots/104989e3d975082814f69d570c187d855fe7e225a536b6f55ba0dc1ccc1e2cb6/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9d6941a96315ebaf630ab41498b59f73a461b33d5d50cac4d1461db4ba80d412/contract';
import endContract from '../../snapshots/9d6941a96315ebaf630ab41498b59f73a461b33d5d50cac4d1461db4ba80d412/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'platformSetting',
        columns: [
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('value', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['key'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
