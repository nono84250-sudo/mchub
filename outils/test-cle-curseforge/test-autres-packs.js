// Test sur D AUTRES modpacks (tres connus et moins connus), choisis sur CurseForge.
// Pour chaque pack : combien de mods CurseForge laisse telecharger, combien
// on retrouve sur Modrinth parmi les autres, combien restent a la main.
// La cle est lue comme le site la lit (chargeur Next.js). Elle n'est jamais affichee ni ecrite.
// Lancer depuis le dossier MCHub :  node outils/test-cle-curseforge/test-cle-curseforge.js
const fs = require("node:fs");
const path = require("node:path");

const HERE = __dirname;
const MCHUB = path.resolve(HERE, "..", "..");
const CF = "https://api.curseforge.com";
const MR = "https://api.modrinth.com/v2";
const UA = "Omniscient-Launcher (app.omniscient.launcher) test-couverture";

// La cle est lue EXACTEMENT comme le site la lit : avec le chargeur de Next.js
// (@next/env, dans site/node_modules), qui gere .env.local, .env, les guillemets
// et les \$ echappes. Repli : lecture simple des fichiers. Jamais affichee.
function candidateKeys() {
  const list = [];
  const siteDir = path.join(MCHUB, "site");
  try {
    const { loadEnvConfig } = require(path.join(siteDir, "node_modules", "@next", "env"));
    const before = process.env.CURSEFORGE_API_KEY;
    delete process.env.CURSEFORGE_API_KEY;
    const { loadedEnvFiles } = loadEnvConfig(siteDir, true, { info() {}, error() {} });
    const k = process.env.CURSEFORGE_API_KEY;
    if (k) list.push({ from: "chargeur du site (" + loadedEnvFiles.map((f) => f.path).join(", ") + ")", key: k.trim() });
    if (before) process.env.CURSEFORGE_API_KEY = before;
  } catch (e) {
    console.log("Chargeur du site indisponible (" + e.message + "), lecture simple des fichiers.");
  }
  for (const name of [".env.development.local", ".env.local", ".env.development", ".env"]) {
    const file = path.join(siteDir, name);
    if (!fs.existsSync(file)) continue;
    for (const l of fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
      const m = l.match(/^\s*(?:export\s+)?CURSEFORGE_API_KEY\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[1].trim();
      if (/^["']/.test(v)) v = v.slice(1, v.indexOf(v[0], 1) > 0 ? v.indexOf(v[0], 1) : undefined);
      else v = v.replace(/\s+#.*$/, "");
      v = v.replace(/\\\$/g, "$");
      if (v && !list.some((c) => c.key === v)) list.push({ from: "site/" + name, key: v });
    }
  }
  return list;
}

// Quatre essais separes : l'API (infos, recherche, liste des fichiers d'un pack)
// et le vrai telechargement d'un fichier sur edge.forgecdn.net.
async function diagnose(key) {
  const h = { "x-api-key": key, Accept: "application/json" };
  const st = async (p) => {
    try {
      const r = await fetch(CF + p.url, { method: p.body ? "POST" : "GET", headers: { ...h, ...(p.body ? { "Content-Type": "application/json" } : {}) }, body: p.body ? JSON.stringify(p.body) : undefined });
      const t = await r.text();
      return { status: r.status, invalide: r.status === 403 && /api key/i.test(t), json: r.ok ? JSON.parse(t) : null };
    } catch (e) { return { status: "erreur " + e.message }; }
  };
  const out = {};
  out.jeu = await st({ url: "/v1/games/432" });
  out.recherche = await st({ url: "/v1/mods/search?gameId=432&classId=4471&searchFilter=All%20the%20Mods%2010&pageSize=5" });
  out.fichiers = await st({ url: "/v1/mods/files", body: { fileIds: [8750384] } });
  const url = out.fichiers.json?.data?.[0]?.downloadUrl || "https://edge.forgecdn.net/files/8750/384/FramedBlocks-11.4.0.jar";
  const dl = async (headers) => { try { const r = await fetch(url, { headers }); await r.body?.cancel(); return r.status; } catch (e) { return "erreur " + e.message; } };
  out.telechargementAvecCle = await dl({ "x-api-key": key });
  out.telechargementSansCle = await dl({});
  const say = (label, s) => console.log(`  ${label.padEnd(38)} ${s.status ?? s}${s.invalide ? " (cle invalide)" : s.status === 403 ? " (refuse)" : s.status === 200 ? " OK" : ""}`);
  say("API : infos Minecraft", out.jeu);
  say("API : recherche de modpacks", out.recherche);
  say("API : liens des fichiers (ce qu'utilise le launcher)", out.fichiers);
  say("Telechargement d'un mod AVEC la cle", out.telechargementAvecCle);
  say("Telechargement d'un mod SANS la cle", out.telechargementSansCle);
  for (const k of Object.keys(out)) if (out[k] && typeof out[k] === "object") delete out[k].json;
  return out;
}

async function pickKey() {
  const cands = candidateKeys();
  if (!cands.length) {
    console.error("Cle CurseForge introuvable dans les fichiers .env du site.");
    process.exit(1);
  }
  const tried = [];
  for (const c of cands) {
    console.log(`\nCle lue par ${c.from} (${c.key.length} caracteres) :`);
    const d = await diagnose(c.key);
    tried.push({ from: c.from, longueur: c.key.length, ...d });
    if (d.fichiers.status === 200) return { key: c.key, tried };
  }
  console.error("\nAucune cle ne donne acces aux liens des fichiers : le tableau ne peut pas etre mesure.");
  return { key: null, tried };
}

let KEY = null;
let DIAG = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0;

async function cf(pathname, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    calls++;
    await sleep(250);
    const res = await fetch(CF + pathname, {
      method: body ? "POST" : "GET",
      headers: { "x-api-key": KEY, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) { await sleep(15000); continue; }
    if (!res.ok) throw new Error(`CurseForge a repondu ${res.status} sur ${pathname}`);
    return res.json();
  }
  throw new Error("CurseForge : trop de refus (429)");
}

async function modrinthBySha1(hashes) {
  const found = new Set();
  for (let i = 0; i < hashes.length; i += 300) {
    const res = await fetch(`${MR}/version_files`, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/json" },
      body: JSON.stringify({ hashes: hashes.slice(i, i + 300), algorithm: "sha1" }),
    });
    if (res.ok) for (const h of Object.keys(await res.json())) found.add(h);
    await sleep(300);
  }
  return found;
}

async function fileInfos(ids) {
  const infos = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const data = await cf("/v1/mods/files", { fileIds: ids.slice(i, i + 50) });
    for (const f of data.data) infos.set(f.id, f);
  }
  return infos;
}

// Pour All the Mods 9 et 10 : la liste publique n'a pas les numeros CurseForge,

const ALREADY = new Set(JSON.parse(fs.readFileSync(path.join(HERE, "packs-data.json"), "utf8")).map((p) => norm(p.name)));
function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

// manifest.json dans le zip du pack, sans bibliotheque.
function readZipEntry(buf, wanted) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) return null;
  let p = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    if (buf.toString("utf8", p + 46, p + 46 + nameLen) === wanted) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return (method === 8 ? require("node:zlib").inflateRawSync(data) : data).toString("utf8");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

// Packs choisis : 15 parmi les plus populaires, 15 moins connus (vers la 300e et la 1500e place).
async function choosePacks() {
  const page = async (index) => (await cf(`/v1/mods/search?gameId=432&classId=4471&sortField=2&sortOrder=desc&pageSize=50&index=${index}`)).data;
  const fresh = (list) => list.filter((m) => !ALREADY.has(norm(m.name)));
  const top = fresh(await page(0)).slice(0, 15).map((m) => ({ ...m, groupe: "Très connu" }));
  const mid = fresh(await page(300)).filter((_, i) => i % 6 === 0).slice(0, 8);
  const low = fresh(await page(1500)).filter((_, i) => i % 7 === 0).slice(0, 7);
  return [...top, ...[...mid, ...low].map((m) => ({ ...m, groupe: "Moins connu" }))];
}

const loadersFor = (loader, mc) => loader === "quilt" ? ["quilt", "fabric"] : loader === "neoforge" && mc === "1.20.1" ? ["neoforge", "forge"] : [loader];

// Recherche Modrinth par nom (comme la page scanner) : slug ou titre identique, puis version et loader compatibles.
async function modrinthByName(mod, mc, loader) {
  const keys = new Set([norm(mod.name), norm(mod.slug)].filter(Boolean));
  for (const q of [mod.name, (mod.slug || "").replace(/-/g, " ")]) {
    if (!q) continue;
    const params = new URLSearchParams({ query: q, limit: "10", facets: JSON.stringify([["project_type:mod"]]) });
    const res = await fetch(`${MR}/search?${params}`, { headers: { "User-Agent": UA } });
    await sleep(250);
    if (!res.ok) continue;
    const hit = (await res.json()).hits.find((h) => h.slug === mod.slug || keys.has(norm(h.slug)) || keys.has(norm(h.title)));
    if (hit) return hit.versions.includes(mc) && loadersFor(loader, mc).some((l) => hit.categories.includes(l));
  }
  return false;
}

async function runPack(m) {
  const r = { name: m.name, groupe: m.groupe, downloads: m.downloadCount, total: 0, curseforge: 0, modrinth: 0, main: 0, aLaMain: [] };
  const file = (m.latestFiles || []).filter((f) => !f.isServerPack).sort((a, b) => b.fileDate.localeCompare(a.fileDate))[0];
  if (!file) throw new Error("aucun fichier");
  if (!file.downloadUrl) throw new Error("le pack lui-meme ne se telecharge pas par l'API");
  if (file.fileLength > 400e6) throw new Error("pack trop lourd pour le test");
  const res = await fetch(file.downloadUrl, { headers: { "x-api-key": KEY } });
  if (!res.ok) throw new Error(`telechargement du pack refuse (${res.status})`);
  const text = readZipEntry(Buffer.from(await res.arrayBuffer()), "manifest.json");
  if (!text) throw new Error("pas de manifest.json");
  const manifest = JSON.parse(text);
  const mc = manifest.minecraft.version;
  const loaderId = (manifest.minecraft.modLoaders.find((l) => l.primary) || manifest.minecraft.modLoaders[0] || {}).id || "";
  const loader = loaderId.split("-")[0];
  r.mc = mc; r.loader = loader;
  const ids = manifest.files.map((f) => f.fileID);
  const infos = await fileInfos(ids);
  const blocked = [];
  for (const id of ids) {
    r.total++;
    const info = infos.get(id);
    if (info && info.downloadUrl) { r.curseforge++; continue; }
    blocked.push({ id, info, modId: info?.modId ?? manifest.files.find((f) => f.fileID === id).projectID });
  }
  const mods = new Map();
  const modIds = [...new Set(blocked.map((b) => b.modId))];
  for (let i = 0; i < modIds.length; i += 50) for (const x of (await cf("/v1/mods", { modIds: modIds.slice(i, i + 50) })).data) mods.set(x.id, x);
  const onModrinth = await modrinthBySha1(blocked.map((b) => b.info?.hashes?.find((h) => h.algo === 1)?.value).filter(Boolean));
  for (const b of blocked) {
    const sha1 = b.info?.hashes?.find((h) => h.algo === 1)?.value;
    const mod = mods.get(b.modId) || { name: b.info?.displayName || `mod ${b.modId}` };
    if ((sha1 && onModrinth.has(sha1)) || (await modrinthByName(mod, mc, loader))) r.modrinth++;
    else { r.main++; r.aLaMain.push(mod.name); }
  }
  return r;
}

async function main() {
  const picked = await pickKey();
  KEY = picked.key;
  if (!KEY) return;
  console.log("\nChoix des packs sur CurseForge...");
  const packs = await choosePacks();
  const results = [];
  for (const m of packs) {
    process.stdout.write(`${m.name}... `);
    try {
      const r = await runPack(m);
      results.push(r);
      console.log(`${r.total} mods : CurseForge ${r.curseforge}, Modrinth ${r.modrinth}, pas trouve ${r.main}`);
    } catch (e) {
      results.push({ name: m.name, groupe: m.groupe, downloads: m.downloadCount, mc: "", erreur: e.message });
      console.log(`non mesure (${e.message})`);
    }
  }
  const ok = results.filter((r) => !r.erreur);
  const sum = (k) => ok.reduce((s, r) => s + r[k], 0);
  const total = { total: sum("total"), curseforge: sum("curseforge"), modrinth: sum("modrinth"), main: sum("main") };
  console.log("\nTOTAL", total, `| appels CurseForge : ${calls}`);
  fs.writeFileSync(path.join(HERE, "resultat-autres-packs.json"), JSON.stringify({ date: new Date().toISOString(), total, packs: results }, null, 1));
  const html = path.join(HERE, "tableau-autres-packs.html");
  fs.writeFileSync(html, tableHtml(results.map((r) => ({ ...r, mc: `${r.groupe} · ${r.mc || ""} · ${Math.round((r.downloads || 0) / 1000)} k téléchargements` })), total, null));
  console.log(`Tableau : ${html}`);
  if (process.platform === "win32") require("node:child_process").exec(`start "" "${html}"`);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Tableau a ouvrir dans le navigateur : une ligne par pack, Total puis CurseForge / Modrinth / Pas trouve.
function tableHtml(rows, total, probe) {
  const bar = (r) => r.total ? `<div class="bar"><i class="cf" style="width:${(100 * r.curseforge) / r.total}%"></i><i class="mr" style="width:${(100 * r.modrinth) / r.total}%"></i><i class="mn" style="width:${(100 * r.main) / r.total}%"></i></div>` : "";
  const trs = rows.map((r) => r.erreur
    ? `<tr><td>${esc(r.name)} <small>${esc(r.mc)}</small></td><td colspan="4" class="tmn">non mesure : ${esc(r.erreur)}</td></tr>`
    : `<tr><td>${esc(r.name)} <small>${esc(r.mc)}</small>${bar(r)}${r.aLaMain.length ? `<details><summary>voir les ${r.main} pas trouves</summary><small>${r.aLaMain.map(esc).join(", ")}</small></details>` : ""}</td><td>${r.total}</td><td class="tcf">${r.curseforge}</td><td class="tmr">${r.modrinth}</td><td class="tmn">${r.main}</td></tr>`).join("");
  const pct = (n) => total.total ? ` <small>(${Math.round((100 * n) / total.total)} %)</small>` : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test cle CurseForge</title>
<style>body{font-family:system-ui,sans-serif;background:#111418;color:#e8eaed;margin:0;padding:16px}h1{font-size:20px}table{border-collapse:collapse;width:100%;max-width:960px}
th,td{padding:8px;border-bottom:1px solid #2a2f36;text-align:right;vertical-align:top}th:first-child,td:first-child{text-align:left}small{color:#9aa3ad}
.tcf{color:#f5a25d}.tmr{color:#4cd38a}.tmn{color:#ff6b6b}tfoot td{font-weight:700;border-top:2px solid #666;font-size:17px}
.bar{display:flex;height:8px;border-radius:4px;overflow:hidden;background:#2a2f36;margin-top:6px;max-width:320px}.bar i{display:block}.cf{background:#f5a25d}.mr{background:#4cd38a}.mn{background:#ff6b6b}
.box{background:#1b2027;border-radius:8px;padding:10px 12px;margin:12px 0;max-width:960px;line-height:1.6}summary{cursor:pointer;color:#9aa3ad;font-size:13px}</style></head><body>
<h1>Modpacks testes avec la cle CurseForge</h1>
<div class="box"><b class="tcf">CurseForge</b> : telecharge par CurseForge avec notre cle<br><b class="tmr">Modrinth</b> : refuse par CurseForge, retrouve sur Modrinth<br><b class="tmn">Pas trouve</b> : ni l'un ni l'autre, le joueur doit le telecharger lui-meme</div>
<table><thead><tr><th>Pack</th><th>Total mods</th><th class="tcf">CurseForge</th><th class="tmr">Modrinth</th><th class="tmn">Pas trouve</th></tr></thead><tbody>${trs}</tbody>
<tfoot><tr><td>Total</td><td>${total.total}</td><td class="tcf">${total.curseforge}${pct(total.curseforge)}</td><td class="tmr">${total.modrinth}${pct(total.modrinth)}</td><td class="tmn">${total.main}${pct(total.main)}</td></tr></tfoot></table>
${probe ? `<div class="box">Vrai telechargement d'un mod : avec la cle -> <b>${esc(probe.avecCle)}</b>, sans la cle -> <b>${esc(probe.sansCle)}</b> <small>(200 = marche, 403 = refuse)</small></div>` : ""}
<p><small>${new Date().toLocaleString("fr-BE")}</small></p></body></html>`;
}

main().catch((e) => { console.error("Echec :", e.message); process.exit(1); });
