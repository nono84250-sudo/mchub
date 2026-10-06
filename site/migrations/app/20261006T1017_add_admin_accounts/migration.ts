#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6c6403673b24bb8e043ace212ba1738710f5048a590ea4ea39fd1b414c587343/contract';
import endContract from '../../snapshots/6c6403673b24bb8e043ace212ba1738710f5048a590ea4ea39fd1b414c587343/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9d6941a96315ebaf630ab41498b59f73a461b33d5d50cac4d1461db4ba80d412/contract';
import startContract from '../../snapshots/9d6941a96315ebaf630ab41498b59f73a461b33d5d50cac4d1461db4ba80d412/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'adminAccount',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('mustChangeCredentials', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('username', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'adminAccount',
        constraint: 'adminAccount_username_key',
        columns: ['username'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
