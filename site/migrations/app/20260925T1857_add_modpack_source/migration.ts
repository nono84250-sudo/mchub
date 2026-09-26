#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/472d26a5cdf5b8b25ee1ab6f10f29828e66976f99ea28d694d5b260a36382cac/contract';
import endContract from '../../snapshots/472d26a5cdf5b8b25ee1ab6f10f29828e66976f99ea28d694d5b260a36382cac/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6f75b7aefe9442b10a31faabf74fcee159fc812666a10c3de22b460f61b66431/contract';
import startContract from '../../snapshots/6f75b7aefe9442b10a31faabf74fcee159fc812666a10c3de22b460f61b66431/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'server',
        column: col('modpackSource', 'text', {
          notNull: true,
          default: lit('curseforge'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'server',
        constraint: 'server_modpackSource_check_dc063fb6',
        expression: "\"modpackSource\" IN ('curseforge', 'modrinth')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
