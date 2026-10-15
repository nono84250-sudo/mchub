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
};
// Colonnes booleennes : stockees en 0/1 dans D1, rendues en true/false.
const BOOLEAN_COLUMNS: Record<string, string[]> = {
  server: ["published", "isPrivate", "autoConnect"],
  notification: ["read"],
  adminAccount: ["mustChangeCredentials"],
  scheduledBroadcast: ["banner", "blockLauncher"],
  news: ["published"],
  instanceWatch: ["notifyOnStatusChange", "lastKnownOnline"],
};
// Tables avec un @updatedAt : mises a jour automatiquement a chaque update.
const HAS_UPDATED_AT = new Set(["user", "server", "report", "platformSetting", "userPresence"]);
// Relations belongsTo utilisees par include().
const RELATIONS: Record<string, Record<string, { model: string; fk: string }>> = {
  Server: { owner: { model: "User", fk: "ownerId" } },
  Report: { server: { model: "Server", fk: "serverId" } },
};

// API REST D1 (https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/).
// CF_ACCOUNT_ID / CF_D1_DATABASE_ID / CF_D1_API_TOKEN sont a renseigner dans .env
// (jeton Cloudflare avec la permission "D1 Edit" sur le compte).
const CF_ENDPOINT = () =>
  `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`;

// Chaque appel compte dans la limite globale de l'API Cloudflare (1 200 appels / 5 min pour
// tout le compte, dev et prod confondus — stress test du 15/10) : moins d'appels = plus de marge.
async function d1Rest(sql: string, params: unknown[]): Promise<Row[]> {
  return (await d1RestCall({ sql, params }))[0] ?? [];
}

// Plusieurs instructions en UN seul appel (forme { batch: [...] } de l'API, verifiee le 15/10
// sur la base de dev) : resultats dans l'ordre des instructions.
async function d1RestBatch(stmts: { sql: string; params: unknown[] }[]): Promise<Row[][]> {
  return d1RestCall({ batch: stmts });
}

async function d1RestCall(body: unknown): Promise<Row[][]> {
  const res = await fetch(CF_ENDPOINT(), {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CF_D1_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // Reponse pas forcement JSON en cas de panne/blocage cote Cloudflare (page d'erreur, WAF,
  // limite de debit) : on le dit clairement plutot que de laisser .json() lever une SyntaxError opaque.
  const text = await res.text();
  let json: { success: boolean; errors?: { message: string }[]; result?: { results: Row[] }[] };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`D1 : reponse non-JSON (HTTP ${res.status} ${res.statusText}) : ${text.slice(0, 200)}`);
  }
  if (!json.success) throw new Error(`D1 : ${json.errors?.map((e) => e.message).join(", ") ?? res.statusText}`);
  return (json.result ?? []).map((r) => r.results ?? []);
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
    if (this.includes.length && this.includes.every((i) => i.columns)) return this.allJoined(sql);
    const res = await (await d1()).prepare(sql).bind(...this.params()).all<Row>();
    const rows = res.results.map((r: Row) => fromDb(table, r));
    return this.attachIncludes(rows);
  }

  // Relations lues dans la MEME requete (LEFT JOIN autour de la requete principale) plutot qu'une
  // requete de plus par relation : divise par deux les appels D1 de chaque lecture avec include()
  // (stress test du 15/10). La requete principale reste intacte en sous-requete, donc ses
  // conditions et son tri ne peuvent pas devenir ambigus avec les colonnes de la relation.
  private async allJoined(baseSql: string): Promise<Row[]> {
    const relations = RELATIONS[this.model] ?? {};
    const joins: string[] = [];
    const extra: string[] = [];
    const incs = this.includes.map((inc, i) => {
      const rel = relations[inc.rel];
      if (!rel) throw new Error(`Relation inconnue : ${this.model}.${inc.rel}`);
      const alias = `r${i}`;
      joins.push(` LEFT JOIN "${TABLES[rel.model]}" AS "${alias}" ON "${alias}"."id" = "t"."${rel.fk}"`);
      for (const c of ["id", ...inc.columns!]) extra.push(`"${alias}"."${c}" AS "${alias}__${c}"`);
      return { name: inc.rel, columns: inc.columns!, fk: rel.fk, alias, table: TABLES[rel.model] };
    });
    const order = this.orders.length ? ` ORDER BY ${this.orders.map((o) => `"t".${o}`).join(", ")}` : "";
    const sql = `SELECT "t".*, ${extra.join(", ")} FROM (${baseSql}) AS "t"${joins.join("")}${order}`;
    const res = await (await d1()).prepare(sql).bind(...this.params()).all<Row>();
    return res.results.map((raw: Row) => {
      const row: Row = {};
      for (const [k, v] of Object.entries(raw)) if (!/^r\d+__/.test(k)) row[k] = v;
      fromDb(this.table(), row);
      // Meme forme qu'avant : l'objet lie (sans son id), ou null s'il n'existe pas.
      for (const inc of incs) {
        if (raw[`${inc.alias}__id`] == null) {
          row[inc.name] = null;
        } else {
          const related: Row = {};
          for (const c of inc.columns) related[c] = raw[`${inc.alias}__${c}`];
          row[inc.name] = fromDb(inc.table, related);
        }
        // Colonne de liaison ajoutee uniquement pour l'include : on la retire si non demandee.
        if (this.columns && !this.columns.includes(inc.fk)) delete row[inc.fk];
      }
      return row;
    });
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

// Plusieurs instructions envoyees en UN seul appel a l'API (forme batch), executees dans l'ordre.
// L'atomicite n'est pas documentee pour l'API REST (elle l'est pour database.batch() en Workers) :
// risque mineur ici (compteur de vue/lancement + evenement).
export async function execBatch(stmts: { sql: string; params?: unknown[] }[]) {
  return d1RestBatch(stmts.map((s) => ({ sql: s.sql, params: (s.params ?? []).map(toDb) })));
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
