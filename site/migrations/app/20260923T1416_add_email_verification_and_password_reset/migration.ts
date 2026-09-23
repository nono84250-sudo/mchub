#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/9f36b6dd748039e461da6c81f8ab299c488d25bb2816be940113402e50ce4190/contract';
import endContract from '../../snapshots/9f36b6dd748039e461da6c81f8ab299c488d25bb2816be940113402e50ce4190/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e1ee5622db3bd7184e8d781c1f485180cd80a49859dfbb632152672c9dae9e72/contract';
import startContract from '../../snapshots/e1ee5622db3bd7184e8d781c1f485180cd80a49859dfbb632152672c9dae9e72/contract.json' with { type: 'json' };
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
        table: 'authToken',
        columns: [
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
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('token', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'authToken_kind_check_a969e32a',
            "\"kind\" IN ('email_verify', 'password_reset')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('emailVerified', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'authToken',
        constraint: 'authToken_token_key',
        columns: ['token'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'authToken',
        index: 'authToken_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'authToken',
        index: 'authToken_userId_kind_idx_ed3360ff',
        columns: ['userId', 'kind'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'authToken',
        foreignKey: {
          name: 'authToken_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
