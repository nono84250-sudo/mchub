// Petite couche d'acces a D1 qui garde la forme d'appel de l'ancien client Prisma
// (db.orm.public.Server.where(...).first()), pour ne pas reecrire tous les appelants.
// Le site reste sur Vercel : D1 n'est donc pas accede via un binding Workers, mais par
// l'API REST de Cloudflare (voir d1() ci-dessous). Seuls les operateurs reellement
// utilises sont geres : eq, gte, lt, isNull, or, desc, include (relations belongsTo),
// select, orderBy, limit, first, all, create, update, delete.

// Lignes typees par l'appelant (comme avec l'ancien client generant les types).
type Row = any;

type Cond = { sql: string; params: unknown[] };
type Order = { order: string };
type ColRef = {
  eq: (v: unknown) => Cond;
  gte: (v: unknown) => Cond;
  lt: (v: unknown) => Cond;
  isNull: () => Cond;
  desc: () => Order;
};

const TABLES: Record<string, string> = {
  User: "user",
  Server: "server",
  ServerEvent: "serverEvent",
  Report: "report",
  Notification: "notification",
  PlatformSetting: "platformSetting",
  AdminAccount: "adminAccount",
  ScheduledBroadcast: "scheduledBroadcast",
  PlayerWarning: "playerWarning",
  AdminNote: "adminNote",
  News: "news",
  InstanceWatch: "instanceWatch",
  Friendship: "friendship",
  UserPresence: "userPresence",
  ContactMessage: "contactMessage",
  Team: "team",
};
// Colonnes booleennes : stockees en 0/1 dans D1, rendues en true/false.
const BOOLEAN_COLUMNS: Record<string, string[]> = {
  server: ["published", "isPrivate", "autoConnect", "addToServerList"],
  notification: ["read"],
  adminAccount: ["mustChangeCredentials", "isOwner"],
  scheduledBroadcast: ["banner", "blockLauncher"],
  news: ["published"],
  instanceWatch: ["notifyOnStatusChange", "lastKnownOnline"],
};
// Tables avec un @updatedAt : mises a jour automatiquement a chaque update.
const HAS_UPDATED_AT = new Set(["user", "server", "report", "platformSetting", "userPresence"]);
// Relations belongsTo utilisees par include().
const RELATIONS: Record<string, Record<string, { model: string; fk: string }>> = {
  Server: { owner: { model: "User", fk: "ownerId" }, team: { model: "Team", fk: "teamId" } },
  Report: { server: { model: "Server", fk: "serverId" } },
};

// API REST D1 (https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).
// CF_ACCOUNT_ID / CF_D1_DATABASE_ID / CF_D1_API_TOKEN sont a renseigner dans .env
// (jeton Cloudflare avec la permission "D1 Edit" sur le compte).
const CF_ENDPOINT = () =>
  `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`;

// Audit de charge du 19/10 (B5) : quand Cloudflare limite le debit (HTTP 429, ~1 200 appels par
// 5 min), TOUS les appels echouent pendant un moment. Avant : une erreur 500 obscure (« Réponse
// 500 du site Omniscient » dans le launcher), et chaque nouvelle requete reessayait aussitot,
// ce qui prolongeait le blocage. Maintenant : D1BusyError, transformee en 503 avec un message
// clair par withD1Busy() ci-dessous, et cette instance n'appelle plus Cloudflare pendant 60 s.
export const D1_BUSY_MESSAGE = "Le site Omniscient est très demandé : réessaie dans une minute.";
export class D1BusyError extends Error {
  constructor() {
    super(D1_BUSY_MESSAGE);
    this.name = "D1BusyError";
  }
}
const BUSY_PAUSE_MS = 60_000;
let busyUntil = 0;

export function isD1Busy(error: unknown): boolean {
  return error instanceof D1BusyError || (error instanceof Error && error.name === "D1BusyError");
}

// 503 + message clair (et code "busy" pour le launcher) si l'erreur vient de la limite de debit
// de Cloudflare, sinon null.
export function d1BusyResponse(error: unknown): Response | null {
  if (!isD1Busy(error)) return null;
  return Response.json({ error: D1_BUSY_MESSAGE, code: "busy" }, { status: 503, headers: { "Retry-After": "60" } });
}

// Enveloppe une route /api : une limite de debit Cloudflare devient un 503 lisible au lieu d'un 500.
export function withD1Busy<A extends unknown[]>(handler: (...args: A) => Promise<Response>): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (error) {
      const busy = d1BusyResponse(error);
      if (busy) return busy;
      throw error;
    }
  };
}

// Mesure (21/10, chantier cache des fiches) : avec D1_LOG=1 dans l'environnement (jamais en
// production), chaque appel a Cloudflare est ecrit dans la console du site avec son numero et le
// debut de la requete. Sert a compter les appels par page avant/apres un changement.
let d1CallCount = 0;

async function d1Rest(sql: string, params: unknown[]): Promise<Row[]> {
  if (Date.now() < busyUntil) throw new D1BusyError();
  if (process.env.D1_LOG === "1") console.log(`[D1 #${++d1CallCount}] ${sql.replace(/\s+/g, " ").slice(0, 60)}`);
  const res = await fetch(CF_ENDPOINT(), {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CF_D1_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  // Reponse pas forcement JSON en cas de panne/blocage cote Cloudflare (page d'erreur, WAF,
  // limite de debit) : on le dit clairement plutot que de laisser .json() lever une SyntaxError opaque.
  const text = await res.text();
  if (res.status === 429) {
    busyUntil = Date.now() + BUSY_PAUSE_MS;
    throw new D1BusyError();
  }
  let json: { success: boolean; errors?: { message: string }[]; result?: { results: Row[] }[] };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`D1 : reponse non-JSON (HTTP ${res.status} ${res.statusText}) : ${text.slice(0, 200)}`);
  }
  if (!json.success) throw new Error(`D1 : ${json.errors?.map((e) => e.message).join(", ") ?? res.statusText}`);
  return json.result?.[0]?.results ?? [];
}

// Imite l'API D1Database (prepare/bind/all/run) utilisee plus bas, pour ne pas reecrire
// la classe Query au-dessus : seul ce point d'entree change entre un binding Workers et l'API REST.
async function d1() {
  return {
    prepare(sql: string) {
      return {
        bind: (...params: unknown[]) => ({
          all: async <T = Row>() => ({ results: (await d1Rest(sql, params)) as T[] }),
          run: async () => d1Rest(sql, params),
        }),
      };
    },
  };
}

function col(name: string): ColRef {
  return {
    eq: (v) => ({ sql: `"${name}" = ?`, params: [toDb(v)] }),
    gte: (v) => ({ sql: `"${name}" >= ?`, params: [toDb(v)] }),
    lt: (v) => ({ sql: `"${name}" < ?`, params: [toDb(v)] }),
    isNull: () => ({ sql: `"${name}" IS NULL`, params: [] }),
    desc: () => ({ order: `"${name}" DESC` }),
  };
}
const cols = new Proxy({}, { get: (_t, name) => col(String(name)) }) as Record<string, ColRef>;

export function or(...conds: Cond[]): Cond {
  return { sql: `(${conds.map((c) => c.sql).join(" OR ")})`, params: conds.flatMap((c) => c.params) };
}

const toDb = (v: unknown) => (typeof v === "boolean" ? (v ? 1 : 0) : v);

function fromDb(table: string, row: Row): Row {
  for (const c of BOOLEAN_COLUMNS[table] ?? []) if (c in row && row[c] !== null) row[c] = !!row[c];
  return row;
}

function selectList(columns?: string[]) {
  return columns?.length ? columns.map((c) => `"${c}"`).join(", ") : "*";
}

class Query {
  private columns?: string[];
  private conds: Cond[] = [];
  private orders: string[] = [];
  private max?: number;
  private includes: { rel: string; columns?: string[] }[] = [];

  constructor(private model: string) {}

  select(...columns: string[]) {
    this.columns = columns;
    return this;
  }
  where(arg: Record<string, unknown> | ((c: typeof cols) => Cond | Cond[])) {
    if (typeof arg === "function") {
      const r = arg(cols);
      this.conds.push(...(Array.isArray(r) ? r : [r]));
    } else {
      for (const [k, v] of Object.entries(arg)) this.conds.push({ sql: `"${k}" = ?`, params: [toDb(v)] });
    }
    return this;
  }
  orderBy(fn: (c: typeof cols) => Order) {
    this.orders.push(fn(cols).order);
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  include(rel: string, fn?: (sub: { select: (...c: string[]) => { columns: string[] } }) => unknown) {
    let columns: string[] | undefined;
    fn?.({
      select: (...c: string[]) => {
        columns = c;
        return { columns: c };
      },
    });
    this.includes.push({ rel, columns });
    return this;
  }

  private where_() {
    return this.conds.length ? ` WHERE ${this.conds.map((c) => c.sql).join(" AND ")}` : "";
  }
  private params() {
    return this.conds.flatMap((c) => c.params);
  }
  private table() {
    return TABLES[this.model] ?? this.model;
  }

  private async attachIncludes(rows: Row[]) {
    if (!rows.length) return rows;
    const relations = RELATIONS[this.model] ?? {};
    for (const inc of this.includes) {
      const rel = relations[inc.rel];
      if (!rel) throw new Error(`Relation inconnue : ${this.model}.${inc.rel}`);
      const ids = [...new Set(rows.map((r) => r[rel.fk]).filter((v) => v != null))];
      const related = new Map<unknown, Row>();
      if (ids.length) {
        const table = TABLES[rel.model];
        const want = inc.columns ? ["id", ...inc.columns] : undefined;
        const res = await (await d1())
          .prepare(`SELECT ${selectList(want)} FROM "${table}" WHERE "id" IN (${ids.map(() => "?").join(",")})`)
          .bind(...ids)
          .all<Row>();
        for (const r of res.results) {
          const full = fromDb(table, r);
          related.set(full.id, full);
        }
      }
      for (const row of rows) {
        const found = related.get(row[rel.fk]) ?? null;
        if (found && inc.columns) {
          const { id: _id, ...rest } = found;
          row[inc.rel] = rest;
        } else {
          row[inc.rel] = found;
        }
      }
      // Colonne de liaison ajoutee uniquement pour l'include : on la retire si non demandee.
      if (this.columns && !this.columns.includes(rel.fk)) for (const row of rows) delete row[rel.fk];
    }
    return rows;
  }

  private selectColumns() {
    if (!this.columns) return undefined;
    const extra = this.includes.map((i) => RELATIONS[this.model]?.[i.rel]?.fk).filter(Boolean) as string[];
    return [...new Set([...this.columns, ...extra])];
  }

  async all(): Promise<Row[]> {
    const table = this.table();
    const order = this.orders.length ? ` ORDER BY ${this.orders.join(", ")}` : "";
    const limit = this.max ? ` LIMIT ${Math.floor(this.max)}` : "";
    const sql = `SELECT ${selectList(this.selectColumns())} FROM "${table}"${this.where_()}${order}${limit}`;
    const res = await (await d1()).prepare(sql).bind(...this.params()).all<Row>();
    const rows = res.results.map((r: Row) => fromDb(table, r));
    return this.attachIncludes(rows);
  }

  async first(): Promise<Row | null> {
    this.max = 1;
    const [row] = await this.all();
    return row ?? null;
  }

  async create(data: Row): Promise<Row> {
    const table = this.table();
    const values: Row = { id: crypto.randomUUID(), ...data };
    const keys = Object.keys(values);
    const sql = `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys.map(() => "?").join(", ")}) RETURNING *`;
    const res = await (await d1()).prepare(sql).bind(...keys.map((k) => toDb(values[k]))).all<Row>();
    return fromDb(table, res.results[0]);
  }

  async update(data: Row): Promise<Row | null> {
    const table = this.table();
    const values: Row = { ...data };
    if (HAS_UPDATED_AT.has(table)) values.updatedAt = new Date().toISOString();
    const keys = Object.keys(values);
    const set = keys.map((k) => `"${k}" = ?`).join(", ");
    const sql = `UPDATE "${table}" SET ${set}${this.where_()} RETURNING *`;
    const res = await (await d1()).prepare(sql).bind(...keys.map((k) => toDb(values[k])), ...this.params()).all<Row>();
    const row = res.results[0];
    return row ? fromDb(table, row) : null;
  }

  async delete(): Promise<void> {
    await (await d1()).prepare(`DELETE FROM "${this.table()}"${this.where_()}`).bind(...this.params()).run();
  }
}

// Acces brut pour les rares requetes SQL ecrites a la main (voir les appelants).
export async function execSql(sql: string, params: unknown[] = []) {
  return (await d1()).prepare(sql).bind(...params.map(toDb)).run();
}

// ponytail: l'API REST D1 n'offre pas de transaction (contrairement a database.batch() en
// Workers) : ces instructions s'executent l'une apres l'autre, pas de facon atomique. Risque
// mineur ici (compteur de vue/lancement + evenement) ; passer par un Worker intermediaire si
// ca doit un jour etre garanti atomique.
export async function execBatch(stmts: { sql: string; params?: unknown[] }[]) {
  for (const s of stmts) await execSql(s.sql, s.params ?? []);
}

const model = (name: string) => ({
  select: (...c: string[]) => new Query(name).select(...c),
  where: (arg: Parameters<Query["where"]>[0]) => new Query(name).where(arg),
  orderBy: (fn: Parameters<Query["orderBy"]>[0]) => new Query(name).orderBy(fn),
  limit: (n: number) => new Query(name).limit(n),
  include: (rel: string, fn?: Parameters<Query["include"]>[1]) => new Query(name).include(rel, fn),
  all: () => new Query(name).all(),
  first: () => new Query(name).first(),
  create: (data: Row) => new Query(name).create(data),
});

// Meme forme que l'ancien client : db.orm.public.<Modele>.
export const db = {
  orm: {
    public: Object.fromEntries(Object.keys(TABLES).map((name) => [name, model(name)])) as Record<string, ReturnType<typeof model>>,
  },
};
