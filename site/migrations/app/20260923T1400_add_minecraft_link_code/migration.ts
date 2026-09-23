#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/c875b61aa2f993fd9ec482b153b363dd78afe9256ed9a55d13dd75c249b60922/contract';
import startContract from '../../snapshots/c875b61aa2f993fd9ec482b153b363dd78afe9256ed9a55d13dd75c249b60922/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e1ee5622db3bd7184e8d781c1f485180cd80a49859dfbb632152672c9dae9e72/contract';
import endContract from '../../snapshots/e1ee5622db3bd7184e8d781c1f485180cd80a49859dfbb632152672c9dae9e72/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'minecraftLinkCode',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'minecraftLinkCode',
        constraint: 'minecraftLinkCode_code_key',
        columns: ['code'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'minecraftLinkCode',
        index: 'minecraftLinkCode_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'minecraftLinkCode',
        foreignKey: {
          name: 'minecraftLinkCode_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
