#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/355421a7d9a06bea3982b19602853a3d71789df977dfcc63a1441d0ba938165c/contract';
import endContract from '../../snapshots/355421a7d9a06bea3982b19602853a3d71789df977dfcc63a1441d0ba938165c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/472d26a5cdf5b8b25ee1ab6f10f29828e66976f99ea28d694d5b260a36382cac/contract';
import startContract from '../../snapshots/472d26a5cdf5b8b25ee1ab6f10f29828e66976f99ea28d694d5b260a36382cac/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropTable({ schema: 'public', table: 'authToken' }),
      this.dropTable({ schema: 'public', table: 'minecraftLinkCode' }),
      this.dropColumn({ schema: 'public', table: 'user', column: 'emailVerified' }),
      this.dropColumn({ schema: 'public', table: 'user', column: 'passwordHash' }),
      this.dropConstraint({ schema: 'public', table: 'user', constraint: 'user_email_key' }),
      this.dropColumn({ schema: 'public', table: 'user', column: 'email' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
