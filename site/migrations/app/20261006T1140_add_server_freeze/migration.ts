#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/626c145f6186b4eda05b8c78468e3777f944cf40b9d6790ee8a23ecb52d85bf5/contract';
import endContract from '../../snapshots/626c145f6186b4eda05b8c78468e3777f944cf40b9d6790ee8a23ecb52d85bf5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6c6403673b24bb8e043ace212ba1738710f5048a590ea4ea39fd1b414c587343/contract';
import startContract from '../../snapshots/6c6403673b24bb8e043ace212ba1738710f5048a590ea4ea39fd1b414c587343/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'server',
        column: col('frozenAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'server',
        column: col('frozenBy', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'server',
        column: col('frozenReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
