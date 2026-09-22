#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/a2417b707814788de18c7dcd98d70a5cdf1e9a877071c3cd76b7d87d05721ca5/contract';
import startContract from '../../snapshots/a2417b707814788de18c7dcd98d70a5cdf1e9a877071c3cd76b7d87d05721ca5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e37ac9eab7cbf496098499ee4f3e4d46d3f390fca38788319ea9db2a152a08a3/contract';
import endContract from '../../snapshots/e37ac9eab7cbf496098499ee4f3e4d46d3f390fca38788319ea9db2a152a08a3/contract.json' with { type: 'json' };
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
        table: 'serverEvent',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('serverId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('serverEvent_kind_check_6980eefc', "\"kind\" IN ('view', 'launch')"),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'server',
        column: col('discordUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'server',
        column: col('iconUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'server',
        column: col('launchCount', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'server',
        column: col('published', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'server',
        column: col('recommendedRamGB', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'server',
        column: col('viewCount', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'server',
        column: col('websiteUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'serverEvent',
        index: 'serverEvent_serverId_idx_cfc44675',
        columns: ['serverId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'serverEvent',
        index: 'serverEvent_serverId_kind_createdAt_idx_b2e960c0',
        columns: ['serverId', 'kind', 'createdAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'serverEvent',
        foreignKey: {
          name: 'serverEvent_serverId_fkey',
          columns: ['serverId'],
          references: { schema: 'public', table: 'server', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
