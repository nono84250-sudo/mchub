// Tests du catalogue de bugs, côté launcher (node travail/catalogue-bugs-31-10/tests/bc-tests.js).
// bc1 à bc12 : rien n'est lancé, rien de réel n'est touché (dossiers temporaires, faux launcher).
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "../../..");
const bc = require(path.join(ROOT, "launcher/src/bugCatalog.js"));
const crashHelp = require(path.join(ROOT, "launcher/src/crashHelp.js"));

const f4 = { slug: "sodium", status: "consent", fixAction: "loader", fixArg: "0.20.1", match: { where: "log", text: "requires version 0.20.1 or later of fabricloader || requires version 0.20.1 or later of mod 'Fabric Loader'", mc: "1.21.11", loader: "fabric" } };
const f5 = { slug: "cps", status: "consent", fixAction: "replace", fixArg: "cps-plus → 52ZXihCZ", match: { where: "crash", text: "cps-plus || cpsplus", mc: "1.21.11", loader: "fabric" } };
const f1 = { slug: "cc", status: "auto", match: { where: "launcher", text: "creativecore [2.0.0,)", mc: "< 1.13", loader: "forge" } };
const f6 = { slug: "quilt", status: "consent", fixAction: "remove", fixArg: "fabric-api", match: { where: "log", text: "Duplicate mandatory mod ids [fabric-api, quilted_fabric_api]", mc: "", loader: "quilt" } };
const CRASH = (cause) => `---- Minecraft Crash Report ----
Time: now
Description: Mouse moved

java.lang.RuntimeException: boom
\tat ${cause}

A detailed walkthrough of the error, its code path and all known details is as follows:
---------------------------------------------------------------------------------------

-- Head --
Thread: Render thread
Stacktrace:
\tat ${cause}

-- Last reload --
Details:
\tPacks: vanilla, fabric, mod/cps-plus

-- System Details --
Details:
\tFabric Mods:
\t\tcps-plus: CPS+ 1.1.0
`;

const tests = {
  "bc1 fiche 4 : le format réel de Fabric est reconnu (2e variante)": () => {
    const logText = "Incompatible mods found!\n - Mod 'Sodium Extra' (sodium-extra) 0.9.5+mc1.21.11 requires version 0.20.1 or later of mod 'Fabric Loader' (fabricloader), but only the wrong version is present: 0.19.5!\n";
    assert.equal(bc.matchGame([f4], { logText, mc: "1.21.11", loader: "fabric" })?.slug, "sodium");
  },
  "bc2 fiche 4 : l'ancien format est reconnu (1re variante), sans tenir compte des majuscules": () => {
    assert.equal(bc.matchGame([f4], { logText: "X REQUIRES VERSION 0.20.1 OR LATER OF FABRICLOADER", mc: "1.21.11", loader: "fabric" })?.slug, "sodium");
  },
  "bc3 fiche 4 : ni autre version de Minecraft, ni autre chargeur": () => {
    const logText = "requires version 0.20.1 or later of fabricloader";
    assert.equal(bc.matchGame([f4], { logText, mc: "1.21.10", loader: "fabric" }), null);
    assert.equal(bc.matchGame([f4], { logText, mc: "1.21.11", loader: "quilt" }), null);
  },
  "bc4 fiche 5 : reconnue quand CPS+ est dans la cause ou la pile d'appels": () => {
    assert.equal(bc.matchGame([f5], { crashText: CRASH("cpsplus.mixin.MixinMouse.onMove(cps-plus-1.1.0.jar)"), mc: "1.21.11", loader: "fabric" })?.slug, "cps");
  },
  "bc5 fiche 5 : PAS reconnue quand CPS+ est seulement dans la liste des mods": () => {
    const crashText = CRASH("net.minecraft.client.Mouse.onMove(Mouse.java:42)");
    assert.ok(crashText.includes("cps-plus"), "le test doit contenir le mod dans la liste");
    assert.equal(bc.matchGame([f5], { crashText, mc: "1.21.11", loader: "fabric" }), null);
  },
  "bc6 fiche 5 : le journal normal ne suffit pas pour une fiche « crash »": () => {
    assert.equal(bc.matchGame([f5], { logText: "Loading mod cps-plus", crashText: "", mc: "1.21.11", loader: "fabric" }), null);
  },
  "bc7 signaux : règle « < 1.13 », une seule fois par session": () => {
    assert.ok(bc.mcMatches("< 1.13", "1.12.2"));
    assert.ok(!bc.mcMatches("< 1.13", "1.20.1"));
    assert.ok(!bc.mcMatches("< 1.13", "1.13"));
    assert.equal(bc.matchSignal([f1], "creativecore [2.0.0,)", { loader: "forge" })?.slug, "cc");
    assert.equal(bc.matchSignal([f1], "creativecore [2.0.0,)", { loader: "fabric" }), null);
    const cat = bc.createBugCatalog({ cacheDir: fs.mkdtempSync(path.join(os.tmpdir(), "bc-")), siteUrl: "x", authHeaders: () => ({}), fetchJson: async () => ({ etag: '"1"', data: { entries: [f1] } }), isOn: () => true });
    return cat.refresh().then(() => {
      assert.equal(cat.signal("creativecore [2.0.0,)")?.slug, "cc");
      assert.equal(cat.signal("creativecore [2.0.0,)"), null);
    });
  },
  "bc8 interrupteur coupé : aucune fiche, aucun appel au site": async () => {
    let calls = 0;
    const cat = bc.createBugCatalog({ cacheDir: fs.mkdtempSync(path.join(os.tmpdir(), "bc-")), siteUrl: "x", authHeaders: () => ({}), fetchJson: async () => (calls++, {}), isOn: () => false });
    await cat.refresh();
    assert.equal(calls, 0);
    assert.equal(cat.game({ logText: "requires version 0.20.1 or later of fabricloader", mc: "1.21.11", loader: "fabric" }), null);
    assert.equal(cat.signal("creativecore [2.0.0,)"), null);
  },
  "bc9 cache et ETag : 304 garde les fiches, elles restent après redémarrage": async () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "bc-"));
    const sent = [];
    let answer = { etag: '"v1"', data: { entries: [f4] } };
    const fetchJson = async (_u, o) => (sent.push(o.headers["If-None-Match"]), answer);
    const cat = bc.createBugCatalog({ cacheDir, siteUrl: "x", authHeaders: () => ({}), fetchJson, isOn: () => true });
    await cat.refresh();
    answer = { notModified: true };
    await cat.refresh();
    assert.deepEqual(sent, [undefined, '"v1"']);
    assert.ok(cat.bySlug("sodium"));
    const again = bc.createBugCatalog({ cacheDir, siteUrl: "x", authHeaders: () => ({}), fetchJson: async () => { throw new Error("hors ligne"); }, isOn: () => true });
    await again.refresh();
    assert.ok(again.bySlug("sodium"), "fiches gardées hors ligne");
  },
  "bc10 retirer un mod : fabric-api ne touche ni quilted-fabric-api ni fabric-api-base": () => {
    assert.ok(bc.jarIsMod("fabric-api-0.92.2+1.20.1.jar", "fabric-api"));
    assert.ok(bc.jarIsMod("Fabric-API-0.92.jar", "fabric-api"));
    assert.ok(!bc.jarIsMod("quilted-fabric-api-7.0.jar", "fabric-api"));
    assert.ok(!bc.jarIsMod("fabric-api-base-0.4.jar", "fabric-api"));
    assert.deepEqual(bc.parseReplace("cps-plus → 52ZXihCZ"), { from: "cps-plus", to: "52ZXihCZ" });
  },
  "bc11 réparation : sauvegarde, ajoute AVANT de retirer ; pack officiel refusé": async () => {
    const game = fs.mkdtempSync(path.join(os.tmpdir(), "bc-"));
    const mods = path.join(game, "mods");
    fs.mkdirSync(mods);
    fs.writeFileSync(path.join(mods, "cps-plus-1.1.0.jar"), "x");
    fs.mkdirSync(path.join(game, "saves"));
    fs.writeFileSync(path.join(game, "saves", "monde.dat"), "monde");
    const order = [];
    const v = { pack: { kind: "mine" }, mods: [{ id: "cps-plus", file: { filename: "cps-plus-1.1.0.jar" } }, { id: "autre", file: { filename: "autre-1.jar" } }] };
    const steps = [];
    const api = {
      getVersion: () => v,
      modsDirOf: () => mods,
      addMods: async (_id, to) => order.push(`add ${to}`),
      removeItem: async (_id, item) => {
        order.push(`remove ${item.key}`);
        v.mods = v.mods.filter((m) => m.id !== item.key);
        fs.rmSync(path.join(mods, "cps-plus-1.1.0.jar"), { force: true });
      },
    };
    const out = await bc.repair(f5, "id", api, (s) => steps.push(s));
    assert.deepEqual(order, ["add 52ZXihCZ", "remove cps-plus"]);
    assert.deepEqual(steps, [0, 1, 2]);
    assert.ok(fs.existsSync(path.join(out.backup, "cps-plus-1.1.0.jar")), "sauvegarde du dossier mods");
    assert.ok(out.backup.includes(path.join(".omniscient", "mods-avant-reparation")));
    assert.equal(fs.readFileSync(path.join(game, "saves", "monde.dat"), "utf8"), "monde", "mondes intacts");
    const official = { getVersion: () => ({ pack: { kind: "official" } }), modsDirOf: () => mods };
    await assert.rejects(bc.repair(f5, "id", official));
    await assert.rejects(bc.repair({ ...f5, status: "manual" }, "id", api));
    await assert.rejects(bc.repair({ ...f5, fixAction: "exec", fixArg: "rm -rf" }, "id", { ...api, getVersion: () => v }), /Pas de réparation/);
    // Un mod remis aussitôt par un autre : échec annoncé, pas de faux « corrigé ».
    const back = { pack: { kind: "mine" }, mods: [{ id: "fabric-api", file: { filename: "fabric-api-1.jar" } }] };
    await assert.rejects(bc.repair(f6, "id", { getVersion: () => back, modsDirOf: () => mods, removeItem: async () => {} }), /encore demandé/);
  },
  "bc12 aide au crash : « Duplicate mandatory mod ids » détecté même avec le code de sortie 0, journal normal ignoré": () => {
    assert.ok(crashHelp.analyze("FormattedException: Duplicate mandatory mod ids [fabric-api, quilted_fabric_api]", "", 0));
    assert.equal(crashHelp.analyze("[Render thread/INFO]: cps-plus loaded\ncustomizableScreens ok", "", 0), null);
  },
};

(async () => {
  let failed = 0;
  for (const [name, run] of Object.entries(tests)) {
    try {
      await run();
      console.log(`OK    ${name}`);
    } catch (error) {
      failed++;
      console.log(`ÉCHEC ${name}\n      ${error.message}`);
    }
  }
  console.log(failed ? `${failed} échec(s)` : `${Object.keys(tests).length} tests OK`);
  process.exit(failed ? 1 : 0);
})();
