// Position de la fenêtre de Minecraft (Windows), pour coller le petit menu de sauvegarde en haut à
// gauche du JEU, sur le bon écran, comme l'overlay de Discord (retour de test de Rushi, 24/10).
// Electron ne voit pas les fenêtres des autres programmes : un petit PowerShell lit toutes les
// 1,5 s le rectangle de la fenêtre principale du processus Java du jeu (GetWindowRect) et l'écrit
// sur une ligne. Rien n'est injecté dans le jeu. Ailleurs que sous Windows : pas de suivi (null).
const { spawn } = require("node:child_process");

const SCRIPT = (pid) => `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System; using System.Runtime.InteropServices;
public class OmniWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
}
"@
while ($true) {
  $p = Get-Process -Id ${pid}
  if (-not $p) { break }
  $h = $p.MainWindowHandle
  if ($h -ne [IntPtr]::Zero -and -not [OmniWin]::IsIconic($h)) {
    $r = New-Object OmniWin+RECT
    if ([OmniWin]::GetWindowRect($h, [ref]$r)) { [Console]::Out.WriteLine("$($r.L),$($r.T),$($r.R),$($r.B)"); [Console]::Out.Flush() }
  }
  Start-Sleep -Milliseconds 1500
}
`;

function trackGameWindow(pid, { onRect, log } = {}) {
  if (process.platform !== "win32" || !pid) return { stop() {}, rect: () => null };
  let last = null;
  let buf = "";
  let child;
  try {
    child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", SCRIPT(Number(pid))], { windowsHide: true });
  } catch (error) {
    log?.(`suivi de la fenêtre du jeu impossible (${error.message})`);
    return { stop() {}, rect: () => null };
  }
  child.stdout.on("data", (chunk) => {
    buf += chunk.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const line of lines) {
      const m = /^(-?\d+),(-?\d+),(-?\d+),(-?\d+)$/.exec(line.trim());
      if (!m) continue;
      const [l, t, r, b] = m.slice(1).map(Number);
      const changed = !last || last.l !== l || last.t !== t || last.r !== r || last.b !== b;
      if (!last) log?.(`fenêtre du jeu trouvée en ${l},${t} (${r - l}×${b - t}).`);
      last = { l, t, r, b };
      if (changed) onRect?.(last);
    }
  });
  child.on("error", (error) => log?.(`suivi de la fenêtre du jeu arrêté (${error.message})`));
  return {
    rect: () => last,
    stop() {
      try {
        child.kill();
      } catch {}
    },
  };
}

module.exports = { trackGameWindow };
