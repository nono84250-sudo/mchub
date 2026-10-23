# Mesure des appels a la base (D1) et du temps de reponse du site en local.
# Lance le site (npm run dev) avec D1_LOG=1, ouvre quelques pages, compte les appels ecrits par
# site/src/lib/db.ts, puis arrete le site. Resultat : resultat.txt a cote de ce fichier.
# Ne modifie rien dans le code ni dans la base (lectures seulement, base DEV du fichier .env).
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent $here)
$site = Join-Path $root "site"
$log = Join-Path $env:TEMP "omniscient-d1-log.txt"
$out = Join-Path $here "resultat.txt"
$base = "http://localhost:3000"

try {
  Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 3 | Out-Null
  Write-Host "Un site tourne deja sur le port 3000 : ferme-le (fenetre npm run dev) puis relance ce fichier."
  exit 1
} catch {}

Remove-Item $log -ErrorAction SilentlyContinue
$env:D1_LOG = "1"
Write-Host "Demarrage du site (1 a 2 minutes)..."
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev > `"$log`" 2>&1" -WorkingDirectory $site -PassThru -WindowStyle Minimized

function Read-Log {
  if (-not (Test-Path $log)) { return "" }
  $fs = [System.IO.File]::Open($log, "Open", "Read", "ReadWrite")
  try { return (New-Object System.IO.StreamReader($fs)).ReadToEnd() } finally { $fs.Close() }
}
function Count-D1 { return ([regex]::Matches((Read-Log), "\[D1 #")).Count }

$deadline = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $deadline -and (Read-Log) -notmatch "Ready") { Start-Sleep -Seconds 2 }

$lines = @()
function Measure-Url([string]$label, [string]$url, [hashtable]$headers = @{}) {
  $before = Count-D1
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $status = ""
  try {
    $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 180 -Headers $headers
    $status = $r.StatusCode
  } catch {
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode } else { $status = "erreur" }
  }
  $sw.Stop()
  # Les mesures lancees apres l'envoi de la page (after) ecrivent aussi en base : on les attend.
  Start-Sleep -Seconds 3
  $calls = (Count-D1) - $before
  $line = "{0,-34} code {1,-4} appels D1 : {2,-3} temps : {3} ms" -f $label, $status, $calls, $sw.ElapsedMilliseconds
  Write-Host $line
  $script:lines += $line
}

try {
  $list = Invoke-RestMethod "$base/api/public/servers" -TimeoutSec 180
  $slug = $list.servers[0].slug
  $script:lines += "Date : $(Get-Date -Format 'yyyy-MM-dd HH:mm')   serveur de test : $slug   serveurs dans la liste : $($list.servers.Count)"
  foreach ($pass in 1..3) {
    $script:lines += "--- Passage $pass (le 1er compile les pages : temps plus long) ---"
    Measure-Url "Accueil /" "$base/"
    Measure-Url "Annuaire /servers" "$base/servers"
    Measure-Url "Fiche /servers/$slug" "$base/servers/$slug"
    Measure-Url "API liste" "$base/api/public/servers"
    Measure-Url "API fiche" "$base/api/public/servers/$slug"
  }
  $etag = (Invoke-WebRequest "$base/api/public/servers" -UseBasicParsing).Headers["ETag"]
  $script:lines += "--- Liste deja connue du launcher (If-None-Match), attendu : code 304 ---"
  Measure-Url "API liste sans changement" "$base/api/public/servers" @{ "If-None-Match" = $etag }
} finally {
  $script:lines | Set-Content -Path $out -Encoding UTF8
  Add-Content -Path $out -Value "`n--- Journal des appels D1 ---" -Encoding UTF8
  (Read-Log) -split "`n" | Where-Object { $_ -match "\[D1 #" } | Add-Content -Path $out -Encoding UTF8
  & taskkill.exe /PID $proc.Id /T /F | Out-Null
  Write-Host ""
  Write-Host "Termine. Resultat enregistre dans : $out"
}
