// Test des 23 modpacks AVEC la cle CurseForge d'Omniscient (lecture seule).
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
// on lit le manifest.json du pack lui-meme (telecharge avec la cle).
async function manifestFromCurseforge(name, mc) {
  const search = await cf(`/v1/mods/search?gameId=432&classId=4471&searchFilter=${encodeURIComponent(name)}&sortField=2&sortOrder=desc&pageSize=10`);
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const pack = search.data.find((m) => norm(m.name) === norm(name)) || search.data[0];
  if (!pack) throw new Error("pack introuvable sur CurseForge");
  const files = await cf(`/v1/mods/${pack.id}/files?gameVersion=${mc}&pageSize=50`);
  const file = files.data.filter((f) => !f.isServerPack).sort((a, b) => b.fileDate.localeCompare(a.fileDate))[0];
  if (!file || !file.downloadUrl) throw new Error("fichier du pack sans lien de telechargement");
  const res = await fetch(file.downloadUrl, { headers: { "x-api-key": KEY } });
  if (!res.ok) throw new Error(`telechargement du pack refuse (${res.status})`);
  let AdmZip;
  try { AdmZip = require(path.join(MCHUB, "launcher", "node_modules", "adm-zip")); } catch { throw new Error("adm-zip absent de launcher/node_modules"); }
  const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
  const manifest = JSON.parse(zip.readAsText("manifest.json"));
  return { ids: manifest.files.map((f) => f.fileID), packFile: `${pack.name} - ${file.displayName}` };
}

// Un vrai telechargement de mod, avec puis sans la cle, pour savoir si le
// launcher pourra recuperer les fichiers une fois la cle ajoutee par un relais.
async function downloadProbe(url) {
  const probe = async (headers) => {
    try {
      const res = await fetch(url, { headers });
      const status = res.status;
      await res.body?.cancel();
      return status;
    } catch (e) { return "erreur " + e.message; }
  };
  return { avecCle: await probe({ "x-api-key": KEY }), sansCle: await probe({}) };
}

async function main() {
  const picked = await pickKey();
  KEY = picked.key;
  if (!KEY) {
    fs.writeFileSync(path.join(HERE, "resultat-test-cle.json"), JSON.stringify({ date: new Date().toISOString(), erreur: "aucune cle avec acces aux fichiers", essais: picked.tried }, null, 1));
    return;
  }
  DIAG = picked.tried;
  console.log("");
  const packs = JSON.parse(fs.readFileSync(path.join(HERE, "packs-data.json"), "utf8"));
  const results = [];
  let probeUrl = null;
  for (const pack of packs) {
    process.stdout.write(`${pack.name}... `);
    const r = { name: pack.name, mc: pack.mc, loader: pack.loader, total: 0, curseforge: 0, modrinth: 0, main: 0, bloques: 0, horsCurseforge: 0, aLaMain: [] };
    try {
      const byFile = new Map(pack.mods.map((m) => [m.f, m]));
      let entries; // { cf, mod }
      if (pack.needManifest || pack.manifestFileIds) {
        let ids = pack.manifestFileIds;
        if (!ids) { const m = await manifestFromCurseforge(pack.name, pack.mc); ids = m.ids; r.packFile = m.packFile; }
        entries = ids.map((id) => ({ cf: id, mod: null }));
      } else {
        entries = pack.mods.map((m) => ({ cf: m.cf, mod: m }));
      }
      const infos = await fileInfos(entries.filter((e) => e.cf).map((e) => e.cf));
      const blocked = [];
      for (const e of entries) {
        r.total++;
        const info = e.cf ? infos.get(e.cf) : null;
        const mod = e.mod || (info && byFile.get(info.fileName)) || null;
        if (info && info.downloadUrl) {
          r.curseforge++;
          if (!probeUrl) probeUrl = info.downloadUrl;
          continue;
        }
        if (e.cf) r.bloques++; else r.horsCurseforge++;
        const sha1 = info?.hashes?.find((h) => h.algo === 1)?.value || null;
        blocked.push({ name: info?.displayName || mod?.n || mod?.f || `fichier ${e.cf}`, sha1, mr: mod?.mr || false });
      }
      const onModrinth = await modrinthBySha1(blocked.map((b) => b.sha1).filter(Boolean));
      for (const b of blocked) {
        if (b.mr || (b.sha1 && onModrinth.has(b.sha1))) r.modrinth++;
        else { r.main++; r.aLaMain.push(b.name); }
      }
      console.log(`${r.total} mods : CurseForge ${r.curseforge}, Modrinth ${r.modrinth}, pas trouve ${r.main}`);
    } catch (e) {
      r.erreur = e.message;
      console.log(`non mesure (${e.message})`);
    }
    results.push(r);
  }
  const probe = probeUrl ? await downloadProbe(probeUrl) : null;
  const ok = results.filter((r) => !r.erreur);
  const sum = (k) => ok.reduce((s, r) => s + r[k], 0);
  const total = { total: sum("total"), curseforge: sum("curseforge"), modrinth: sum("modrinth"), main: sum("main") };
  console.log("\nTOTAL", total);
  if (probe) console.log("Test de telechargement d'un mod : avec cle ->", probe.avecCle, "/ sans cle ->", probe.sansCle);
  console.log(`Appels a CurseForge : ${calls}`);
  const out = path.join(HERE, "resultat-test-cle.json");
  fs.writeFileSync(out, JSON.stringify({ date: new Date().toISOString(), total, probe, essais: DIAG, packs: results }, null, 1));
  const html = path.join(HERE, "tableau.html");
  fs.writeFileSync(html, tableHtml(results, total, probe));
  console.log(`\nResultat ecrit dans ${out}`);
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
