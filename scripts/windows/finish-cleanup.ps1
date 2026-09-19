# ─────────────────────────────────────────────────────────────
#  FINALISATION DU NETTOYAGE — script unique
#
#  À LANCER EN ADMINISTRATEUR, OPENCODE FERMÉ.
#
#  Ce script enchaîne :
#    1. Vérifie qu'opencode est bien fermé
#    2. Nettoie la base opencode   (≈ +5,3 Go)  — corrige les events orphelins
#    3. Compacte le disque Docker  (≈ +8 Go)
#    4. Redémarre Docker
#    5. Affiche le bilan et la commande de reprise
#
#  USAGE
#    Clic droit sur PowerShell → "Exécuter en tant qu'administrateur"
#    cd $env:USERPROFILE\.config\opencode\scripts
#    powershell -ExecutionPolicy Bypass -File finish-cleanup.ps1
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = "Continue"

function FreeGB { [math]::Round((Get-PSDrive C).Free / 1GB, 2) }
function Line { Write-Host ("─" * 60) -ForegroundColor DarkGray }
function Head($t) { Write-Host ""; Write-Host $t -ForegroundColor Cyan; Line }

$freeBefore = FreeGB

Clear-Host
Write-Host ("═" * 60) -ForegroundColor Cyan
Write-Host "   FINALISATION DU NETTOYAGE" -ForegroundColor Cyan
Write-Host ("═" * 60) -ForegroundColor Cyan
Write-Host "   Disque C: libre au départ : $freeBefore Go"
Write-Host ("═" * 60) -ForegroundColor Cyan

# ── 0. Droits admin ? ──
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host ""
    Write-Host "❌ Ce script doit tourner en ADMINISTRATEUR (diskpart l'exige)." -ForegroundColor Red
    Write-Host "   Ferme cette fenêtre, rouvre PowerShell en admin, réessaie." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
Write-Host "`n✓ Droits administrateur OK" -ForegroundColor Green

# ── 1. opencode est-il fermé ? ──
Head "1/4 — Vérification qu'opencode est fermé"
$procs = @(Get-Process -Name opencode -ErrorAction SilentlyContinue)
if ($procs.Count -gt 0) {
    Write-Host "❌ $($procs.Count) processus opencode tournent encore." -ForegroundColor Red
    Write-Host ""
    Write-Host "   Ferme opencode (Ctrl+C dans sa fenêtre), PUIS relance ce script." -ForegroundColor Yellow
    Write-Host "   (la base est verrouillée tant qu'opencode tourne — la modifier la corromprait)"
    Write-Host ""
    exit 1
}
Write-Host "✓ Aucun processus opencode" -ForegroundColor Green

# ── 2. Nettoyage de la base opencode ──
Head "2/4 — Nettoyage de la base opencode"
$db = Join-Path $env:USERPROFILE ".local\share\opencode\opencode.db"
if (Test-Path $db) {
    $dbBefore = [math]::Round((Get-Item $db).Length / 1GB, 2)
    Write-Host "  Base avant : $dbBefore Go"
    Write-Host "  Suppression des sessions antérieures au 2026-08-24 + VACUUM..."
    Write-Host "  (le VACUUM peut prendre 2 à 5 minutes — c'est normal)"
    Write-Host ""
    node "$env:USERPROFILE\.config\opencode\scripts\cleanup-opencode-db.mjs" --cutoff 2026-08-24 --yes
    $dbAfter = [math]::Round((Get-Item $db).Length / 1GB, 2)
    Write-Host "`n  ✓ Base : $dbBefore Go → $dbAfter Go" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Base introuvable, étape ignorée : $db" -ForegroundColor Yellow
}

# ── 3. Compaction du disque Docker ──
Head "3/4 — Compaction du disque Docker"
$vhdx = "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx"
if (Test-Path $vhdx) {
    $vBefore = [math]::Round((Get-Item $vhdx).Length / 1GB, 2)
    Write-Host "  VHDX avant : $vBefore Go"
    Write-Host "  Arrêt de WSL/Docker..."
    wsl --shutdown
    Start-Sleep -Seconds 6

    Write-Host "  Compactage..."
    $dp = @"
select vdisk file="$vhdx"
attach vdisk readonly
compact vdisk
detach vdisk
exit
"@
    $tmp = Join-Path $env:TEMP "compact-vhdx.txt"
    Set-Content -Path $tmp -Value $dp -Encoding ASCII
    diskpart /s $tmp | Out-Null
    Remove-Item $tmp -Force

    $vAfter = [math]::Round((Get-Item $vhdx).Length / 1GB, 2)
    Write-Host "`n  ✓ VHDX : $vBefore Go → $vAfter Go (gagné $([math]::Round($vBefore-$vAfter,2)) Go)" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  VHDX introuvable, étape ignorée : $vhdx" -ForegroundColor Yellow
}

# ── 4. Redémarrage de Docker ──
Head "4/4 — Redémarrage de Docker"
$dd = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
if (Test-Path $dd) {
    Write-Host "  Lancement de Docker Desktop..."
    Start-Process $dd
    Write-Host "  Attente du démarrage (peut prendre 1-2 min)..."
    $ok = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 5
        $r = docker ps 2>$null
        if ($LASTEXITCODE -eq 0) { $ok = $true; break }
        Write-Host "." -NoNewline
    }
    Write-Host ""
    if ($ok) {
        Write-Host "✓ Docker répond" -ForegroundColor Green
        docker ps --format "  {{.Names}}`t{{.Status}}"
    } else {
        Write-Host "⚠️  Docker ne répond pas encore — ouvre Docker Desktop manuellement." -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️  Docker Desktop introuvable — lance-le manuellement." -ForegroundColor Yellow
}

# ── Bilan ──
$freeAfter = FreeGB
Write-Host ""
Write-Host ("═" * 60) -ForegroundColor Cyan
Write-Host "   BILAN" -ForegroundColor Cyan
Write-Host ("═" * 60) -ForegroundColor Cyan
Write-Host "   Disque C:  $freeBefore Go  →  $freeAfter Go   (gagné $([math]::Round($freeAfter-$freeBefore,2)) Go)" -ForegroundColor Green
Write-Host ("═" * 60) -ForegroundColor Cyan
Write-Host ""
Write-Host "   POUR REPRENDRE :" -ForegroundColor Yellow
Write-Host "     cd C:\Users\PC\Documents\GitHub\hashcode-community"
Write-Host "     opencode -c --auto" -ForegroundColor Green
Write-Host ""
Write-Host "   Puis dans opencode :" -ForegroundColor Yellow
Write-Host "     node ~/.config/opencode/scripts/session-review.mjs --days 1"
Write-Host ""
