// PAGE DE TEST TEMPORAIRE (20/10) : a supprimer apres le test, ne jamais commiter.
// Ouvrir http://localhost:3000/test-cle-curseforge avec `npm run dev`.
// Mesure, sur 23 modpacks connus, ce que notre systeme de telechargement CurseForge
// (getFilesInfo, comme /api/launcher/curseforge/files) laisse telecharger, ce que Modrinth
// retrouve parmi le reste, et ce qui reste a la main. La cle reste cote serveur.
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { CurseforgeForbiddenError, getFilesInfo, getModpackInstallFile, type CurseforgeFileInfo } from "@/lib/curseforge";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Mod = { n: string | null; f: string | null; cf: number | null; mr: boolean };
type Pack = { name: string; mc: string; loader: string; mods: Mod[]; manifestFileIds?: number[]; needManifest?: boolean };
type Row = { name: string; mc: string; total: number; curseforge: number; modrinth: number; main: number; aLaMain: string[]; erreur?: string; packFile?: string };

// Identifiants CurseForge des deux packs dont la liste publique n'a pas les numeros de fichiers.
const MANIFEST_PACKS: Record<string, string> = { "All the Mods 10": "925200", "All the Mods 9": "715572" };
const MR_UA = "Omniscient-Launcher (app.omniscient.launcher) test-couverture";

function isLocal(request: Request) {
  const host = (request.headers.get("host") ?? "").split(":")[0];
  return process.env.NODE_ENV === "development" && (host === "localhost" || host === "127.0.0.1");
}

// Lecture de manifest.json dans le zip du modpack (pas de bibliotheque zip sur le site).
function readZipEntry(buf: Buffer, wanted: string): string | null {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) return null;
  let p = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return (method === 8 ? zlib.inflateRawSync(data) : data).toString("utf8");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

async function manifestIds(packName: string) {
  const { file, modpack } = await getModpackInstallFile(MANIFEST_PACKS[packName], { name: packName });
  const res = await fetch(file.downloadUrl!, { headers: { "x-api-key": process.env.CURSEFORGE_API_KEY ?? "" } });
  if (!res.ok) throw new Error(`téléchargement du pack refusé (${res.status})`);
  const text = readZipEntry(Buffer.from(await res.arrayBuffer()), "manifest.json");
  if (!text) throw new Error("manifest.json absent du pack");
  return { ids: (JSON.parse(text).files as { fileID: number }[]).map((f) => f.fileID), packFile: `${modpack.name} - ${file.displayName}` };
}

async function modrinthBySha1(hashes: string[]) {
  const found = new Set<string>();
  for (let i = 0; i < hashes.length; i += 300) {
    const res = await fetch("https://api.modrinth.com/v2/version_files", {
      method: "POST",
      headers: { "User-Agent": MR_UA, "Content-Type": "application/json" },
      body: JSON.stringify({ hashes: hashes.slice(i, i + 300), algorithm: "sha1" }),
    });
    if (res.ok) for (const h of Object.keys(await res.json())) found.add(h);
  }
  return found;
}

async function runPack(pack: Pack, probe: { url: string | null }): Promise<Row> {
  const row: Row = { name: pack.name, mc: pack.mc, total: 0, curseforge: 0, modrinth: 0, main: 0, aLaMain: [] };
  const byFile = new Map(pack.mods.map((m) => [m.f, m]));
  let entries: { cf: number | null; mod: Mod | null }[];
  if (pack.needManifest || pack.manifestFileIds) {
    let ids = pack.manifestFileIds;
    if (!ids) {
      const m = await manifestIds(pack.name);
      ids = m.ids;
      row.packFile = m.packFile;
    }
    entries = ids.map((id) => ({ cf: id, mod: null }));
  } else {
    entries = pack.mods.map((m) => ({ cf: m.cf, mod: m }));
  }
  const infos = new Map<number, CurseforgeFileInfo>();
  for (const f of await getFilesInfo(entries.flatMap((e) => (e.cf ? [e.cf] : [])))) infos.set(f.id, f);
  const rest: { name: string; sha1: string | null; mr: boolean }[] = [];
  for (const e of entries) {
    row.total++;
    const info = e.cf ? infos.get(e.cf) : undefined;
    const mod = e.mod ?? (info ? byFile.get(info.fileName) : undefined) ?? null;
    if (info?.downloadUrl) {
      row.curseforge++;
      probe.url ??= info.downloadUrl;
      continue;
    }
    rest.push({ name: info?.modName || info?.displayName || mod?.n || mod?.f || `fichier ${e.cf}`, sha1: info?.sha1 ?? null, mr: mod?.mr ?? false });
  }
  const onModrinth = await modrinthBySha1(rest.flatMap((r) => (r.sha1 ? [r.sha1] : [])));
  for (const r of rest) {
    if (r.mr || (r.sha1 && onModrinth.has(r.sha1))) row.modrinth++;
    else {
      row.main++;
      row.aLaMain.push(r.name);
    }
  }
  return row;
}

async function downloadStatus(url: string, withKey: boolean) {
  try {
    const res = await fetch(url, { headers: withKey ? { "x-api-key": process.env.CURSEFORGE_API_KEY ?? "" } : {} });
    await res.body?.cancel();
    return String(res.status);
  } catch (e) {
    return "erreur " + (e as Error).message;
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function page(body: string) {
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test clé CurseForge</title>
<style>body{font-family:system-ui,sans-serif;background:#111418;color:#e8eaed;margin:0;padding:16px}h1{font-size:20px}table{border-collapse:collapse;width:100%;max-width:900px}
th,td{padding:6px 8px;border-bottom:1px solid #2a2f36;text-align:right}th:first-child,td:first-child{text-align:left}
.cf{color:#f5a25d}.mr{color:#4cd38a}.mn{color:#ff6b6b}tfoot td{font-weight:700;border-top:2px solid #555}.err{color:#ff6b6b}.box{background:#1b2027;border-radius:8px;padding:10px 12px;margin:12px 0;max-width:900px}
details{margin:4px 0}small{color:#9aa3ad}</style></head><body>${body}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  if (!isLocal(request)) return new Response("Not found", { status: 404 });
  if (!process.env.CURSEFORGE_API_KEY) return page(`<h1>Test clé CurseForge</h1><p class="err">Aucune clé CURSEFORGE_API_KEY dans le .env du site.</p>`);

  const file = path.join(process.cwd(), "..", "outils", "test-cle-curseforge", "packs-data.json");
  const packs = JSON.parse(await fs.readFile(file, "utf8")) as Pack[];
  const probe = { url: null as string | null };
  const rows: Row[] = [];
  for (const pack of packs) {
    try {
      rows.push(await runPack(pack, probe));
    } catch (e) {
      if (e instanceof CurseforgeForbiddenError) {
        return page(
          `<h1>Test clé CurseForge</h1><p class="err">${esc(e.message)}</p><p><small>${e.invalidKey ? "CurseForge dit que la clé est invalide ou révoquée." : "La clé est reconnue mais n'a pas le droit de lire la liste des fichiers (clé limitée)."}</small></p>`,
        );
      }
      rows.push({ name: pack.name, mc: pack.mc, total: 0, curseforge: 0, modrinth: 0, main: 0, aLaMain: [], erreur: (e as Error).message });
    }
  }
  const ok = rows.filter((r) => !r.erreur);
  const sum = (k: "total" | "curseforge" | "modrinth" | "main") => ok.reduce((s, r) => s + r[k], 0);
  const total = { total: sum("total"), curseforge: sum("curseforge"), modrinth: sum("modrinth"), main: sum("main") };
  const dl = probe.url ? { avec: await downloadStatus(probe.url, true), sans: await downloadStatus(probe.url, false) } : null;

  await fs.writeFile(path.join(path.dirname(file), "resultat-page-test.json"), JSON.stringify({ date: new Date().toISOString(), total, dl, rows }, null, 1));

  const trs = rows
    .map((r) =>
      r.erreur
        ? `<tr><td>${esc(r.name)} <small>${r.mc}</small></td><td colspan="4" class="err">non mesuré : ${esc(r.erreur)}</td></tr>`
        : `<tr><td>${esc(r.name)} <small>${r.mc}</small>${r.packFile ? `<br><small>${esc(r.packFile)}</small>` : ""}${r.aLaMain.length ? `<details><summary><small>voir les ${r.main} pas trouvés</small></summary><small>${r.aLaMain.map(esc).join(", ")}</small></details>` : ""}</td><td>${r.total}</td><td class="cf">${r.curseforge}</td><td class="mr">${r.modrinth}</td><td class="mn">${r.main}</td></tr>`,
    )
    .join("");
  return page(`<h1>Test avec la clé CurseForge du site</h1>
<div class="box"><span class="cf">■ CurseForge</span> : téléchargé avec la clé · <span class="mr">■ Modrinth</span> : bloqué sur CurseForge mais retrouvé sur Modrinth · <span class="mn">■ Pas trouvé</span> : ni l’un ni l’autre, le joueur doit le télécharger lui-même</div>
<table><thead><tr><th>Pack</th><th>Total mods</th><th class="cf">CurseForge</th><th class="mr">Modrinth</th><th class="mn">Pas trouvé</th></tr></thead><tbody>${trs}</tbody>
<tfoot><tr><td>Total</td><td>${total.total}</td><td class="cf">${total.curseforge}</td><td class="mr">${total.modrinth}</td><td class="mn">${total.main}</td></tr></tfoot></table>
${dl ? `<div class="box">Vrai téléchargement d'un mod : <b>avec la clé → ${esc(dl.avec)}</b>, sans la clé → ${esc(dl.sans)} <small>(200 = ça marche, 403 = refusé)</small></div>` : ""}
<p><small>Résultat aussi enregistré dans outils/test-cle-curseforge/resultat-page-test.json</small></p>`);
}
