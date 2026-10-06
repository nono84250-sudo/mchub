#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/626c145f6186b4eda05b8c78468e3777f944cf40b9d6790ee8a23ecb52d85bf5/contract';
import startContract from '../../snapshots/626c145f6186b4eda05b8c78468e3777f944cf40b9d6790ee8a23ecb52d85bf5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/99d56936ef1221e7d49c613ea2bff94f68f86b4cd0f08553c9e0f40b1f82d098/contract';
import endContract from '../../snapshots/99d56936ef1221e7d49c613ea2bff94f68f86b4cd0f08553c9e0f40b1f82d098/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'notification',
        constraint: 'notification_type_check_e748acba',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'notification',
        constraint: 'notification_type_check_3cb61ae3',
        expression: "\"type\" IN ('report_replied', 'report_resolved', 'server_frozen')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
