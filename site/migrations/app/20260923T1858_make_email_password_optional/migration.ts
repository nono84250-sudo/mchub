#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/05076c494ef07e2df7a0deb3199c5e222aa70331a49e3ea8064a605c56b92b6d/contract';
import endContract from '../../snapshots/05076c494ef07e2df7a0deb3199c5e222aa70331a49e3ea8064a605c56b92b6d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9f36b6dd748039e461da6c81f8ab299c488d25bb2816be940113402e50ce4190/contract';
import startContract from '../../snapshots/9f36b6dd748039e461da6c81f8ab299c488d25bb2816be940113402e50ce4190/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropNotNull({ schema: 'public', table: 'user', column: 'email' }),
      this.dropNotNull({ schema: 'public', table: 'user', column: 'passwordHash' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
