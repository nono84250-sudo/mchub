// Petit menu de sauvegarde par-dessus le jeu (mode Jouer, idée de Rushi du 24/10, comme les outils
// de clips) : une fenêtre transparente, toujours au premier plan, en haut à gauche de l'écran du
// jeu. Elle ne s'affiche pas par-dessus un jeu en plein écran exclusif (seules les touches
// marchent alors) ; en fenêtré ou en plein écran fenêtré, elle est visible.
//
// Elle ne prend JAMAIS le focus (retour de Rushi du 25/10) : prendre le focus faisait clignoter
// l'icône en orange dans la barre des tâches, la faisait remonter, et réduisait le jeu en plein
// écran. Elle est créée une fois par partie, puis seulement cachée et montrée sans s'activer
// (focusable: false, showInactive, type « toolbar » : aucun bouton dans la barre des tâches).
// C'est le joueur qui met le jeu en pause (Échap) quand le petit menu le lui demande.
const path = require("node:path");
const { BrowserWindow, ipcMain, screen } = require("electron");

const WIDTH = 360;
const HEIGHT = 190;

function createSaveOverlay({ lockNavigation, log } = {}) {
  let win = null;
  let ready = null;
  let hideTimer = null;
  let pendingAnswer = null;
  let shownOnce = false;
  // Où se coller : la fenêtre du jeu (rectangle en pixels Windows, voir gameWindow.js), sinon
  // l'écran d'une fenêtre donnée (bouton « Tester »), sinon l'écran sous la souris.
  let anchorRect = null;
  let anchorBounds = null;

  function ensure() {
    if (win && !win.isDestroyed()) return;
    win = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      ...(process.platform === "win32" ? { type: "toolbar" } : {}),
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: path.join(__dirname, "overlayPreload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.setAlwaysOnTop(true, "screen-saver");
    lockNavigation?.(win.webContents);
    shownOnce = false;
    // Chargement raté (fichier absent…) : on le dit dans la console au lieu d'attendre pour rien.
    ready = new Promise((resolve, reject) => {
      win.webContents.once("did-finish-load", resolve);
      win.webContents.once("did-fail-load", (_e, code, desc) => reject(new Error(`overlay.html non chargé (${code} ${desc})`)));
      setTimeout(() => reject(new Error("overlay.html trop long à charger")), 8000);
    });
    ready.catch(() => {});
    win.loadFile(path.join(__dirname, "overlay.html"));
    win.on("closed", () => {
      win = null;
      answer(null);
    });
  }

  function answer(value) {
    const done = pendingAnswer;
    pendingAnswer = null;
    done?.(value);
  }

  ipcMain.on("overlay:answer", (event, value) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return;
    answer(typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : null);
  });

  function place() {
    if (!win || win.isDestroyed()) return;
    if (anchorRect) {
      // Pixels Windows → unités d'Electron (écrans à 125 %, 150 %…).
      const p = process.platform === "win32" && screen.screenToDipPoint ? screen.screenToDipPoint({ x: anchorRect.l, y: anchorRect.t }) : { x: anchorRect.l, y: anchorRect.t };
      const display = screen.getDisplayNearestPoint({ x: Math.round(p.x), y: Math.round(p.y) });
      // Fenêtre du jeu en plein écran ou collée en haut : on reste dans l'écran.
      const x = Math.max(display.bounds.x, Math.round(p.x)) + 16;
      const y = Math.max(display.bounds.y, Math.round(p.y)) + 16;
      win.setBounds({ x, y, width: WIDTH, height: HEIGHT });
      return;
    }
    const display = anchorBounds ? screen.getDisplayMatching(anchorBounds) : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const area = anchorBounds || display.workArea;
    win.setBounds({ x: area.x + 16, y: area.y + 16, width: WIDTH, height: HEIGHT });
  }
  function setAnchor(rect) {
    anchorRect = rect || null;
    if (win && !win.isDestroyed() && win.isVisible()) place();
  }

  async function show(state, opts = {}) {
    try {
      await showNow(state, opts);
    } catch (error) {
      log?.({ level: "warn", source: "launcher", message: `[Sauvegarde en jeu] Petit menu non affiché : ${error instanceof Error ? error.message : error}` });
    }
  }
  async function showNow(state, { focus = false, hideAfter = 0, at = null } = {}) {
    ensure();
    await ready;
    if (!win || win.isDestroyed()) return;
    clearTimeout(hideTimer);
    win.webContents.send("overlay:state", state);
    anchorBounds = at;
    place();
    // Clics : seulement pour saisir un nom, sinon ils traversent jusqu'au jeu.
    win.setIgnoreMouseEvents(state.mode !== "ask");
    void focus; // plus jamais de focus (voir en haut du fichier)
    if (!win.isVisible()) win.showInactive();
    if (hideAfter) hideTimer = setTimeout(hide, hideAfter);
    if (!shownOnce) {
      shownOnce = true;
      const b = win.getBounds();
      log?.({ level: "info", source: "launcher", message: `[Sauvegarde en jeu] Petit menu affiché en ${b.x},${b.y} (${b.width}×${b.height}), visible : ${win.isVisible()}.` });
    }
  }

  function hide() {
    clearTimeout(hideTimer);
    if (!win || win.isDestroyed()) return;
    win.webContents.send("overlay:state", { mode: "hide" });
    // Laisse le fondu se finir, puis rend la main (et le focus) au jeu.
    setTimeout(() => {
      if (win && !win.isDestroyed() && !pendingAnswer) win.hide();
    }, 180);
  }

  // Demande un nom : plus utilisé en jeu (il faudrait le focus pour taper) ; Maj+F6 marque la
  // sauvegarde, et on la renomme ensuite dans Mes mondes.
  function ask(state) {
    answer(null);
    return new Promise((resolve) => {
      pendingAnswer = resolve;
      show({ ...state, mode: "ask" });
    });
  }

  function destroy() {
    answer(null);
    clearTimeout(hideTimer);
    if (win && !win.isDestroyed()) win.destroy();
    win = null;
  }

  // Début de partie : la fenêtre est créée tout de suite (cachée), puis seulement montrée et cachée.
  function warm() {
    ensure();
  }

  return { show, hide, ask, destroy, warm, setAnchor, cancelAsk: () => answer(null) };
}

module.exports = { createSaveOverlay };
