#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/99d56936ef1221e7d49c613ea2bff94f68f86b4cd0f08553c9e0f40b1f82d098/contract';
import startContract from '../../snapshots/99d56936ef1221e7d49c613ea2bff94f68f86b4cd0f08553c9e0f40b1f82d098/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d7d7315a4fdaf199396e809bbbb981c84dfafcce5b907078abdf7a2a727fef1c/contract';
import endContract from '../../snapshots/d7d7315a4fdaf199396e809bbbb981c84dfafcce5b907078abdf7a2a727fef1c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'notification',
        constraint: 'notification_type_check_3cb61ae3',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'notification',
        constraint: 'notification_type_check_1e65cfab',
        expression:
          "\"type\" IN ('report_replied', 'report_resolved', 'server_frozen', 'admin_info', 'admin_warning', 'admin_error')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
