#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0189c507402e41c66e9bbccef89b447963fe77908c9fc2dd0bdbeb0c696be6b8/contract';
import startContract from '../../snapshots/0189c507402e41c66e9bbccef89b447963fe77908c9fc2dd0bdbeb0c696be6b8/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/586b9bde50b5ba2c5c0d22e0bef0a2b9efa4b85c4487384a1e9e54a84418dbf2/contract';
import endContract from '../../snapshots/586b9bde50b5ba2c5c0d22e0bef0a2b9efa4b85c4487384a1e9e54a84418dbf2/contract.json' with { type: 'json' };
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
        table: 'report',
        columns: [
          col('clientVersion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('issue', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('launcherVersion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reply', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reporterMinecraftUsername', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('reporterMinecraftUuid', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('serverId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('new'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'report_issue_check_79c13b0d',
            "\"issue\" IN ('cant_connect', 'wrong_version', 'modpack_download', 'crash', 'other')",
          ),
          checkExpression(
            'report_status_check_337da199',
            "\"status\" IN ('new', 'replied', 'resolved')",
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'report',
        index: 'report_serverId_idx_cfc44675',
        columns: ['serverId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'report',
        index: 'report_serverId_status_createdAt_idx_ed546ac1',
        columns: ['serverId', 'status', 'createdAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'report',
        foreignKey: {
          name: 'report_serverId_fkey',
          columns: ['serverId'],
          references: { schema: 'public', table: 'server', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
