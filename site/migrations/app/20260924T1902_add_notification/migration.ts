#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/586b9bde50b5ba2c5c0d22e0bef0a2b9efa4b85c4487384a1e9e54a84418dbf2/contract';
import startContract from '../../snapshots/586b9bde50b5ba2c5c0d22e0bef0a2b9efa4b85c4487384a1e9e54a84418dbf2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/6f75b7aefe9442b10a31faabf74fcee159fc812666a10c3de22b460f61b66431/contract';
import endContract from '../../snapshots/6f75b7aefe9442b10a31faabf74fcee159fc812666a10c3de22b460f61b66431/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'notification',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('read', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('recipientMinecraftUuid', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('serverName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'notification_type_check_e748acba',
            "\"type\" IN ('report_replied', 'report_resolved')",
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification',
        index: 'notification_recipientMinecraftUuid_read_createdAt_idx_7f5b47c2',
        columns: ['recipientMinecraftUuid', 'read', 'createdAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
